-- Scheduled jobs (#41, ADR 011, D21(e)): every job runs the same way, pg_cron calling an Edge Function
-- through pg_net, and every run leaves a row in public.job_runs. The heartbeat is the first job. The
-- roster sync, the purge, the digest and the health check follow this pattern.
--
-- How a run goes:
-- 1. pg_cron runs private.run_job(<job>, <every>) on the job's schedule, as postgres.
-- 2. run_job reads the cron secret and the project's URL from Vault, and raises before anything else
--    when either is missing. Neither is ever in a migration: a person stores both per project
--    (README, Scheduled jobs).
-- 3. A job's windows are fixed slots of <every>. run_job claims the current window, and any windows
--    missed since the last claimed one (up to p_catch_up), by inserting a job_runs row for each. The
--    (job, window_start) key is what makes a window run once: a claim that meets it does nothing.
-- 4. For each window it claimed, run_job POSTs { run, job, window } to the job's function with the
--    cron secret. pg_net sends it once the transaction commits, and keeps the response in
--    net._http_response for 6 hours.
-- 5. The function (supabase/functions/_shared/job.ts) refuses a call without the secret, does the
--    work, and writes finished_at, ok and detail on the run. So a finished run is proof at the far
--    end, as D21(e) asks; cron.job_run_details records only that the SQL ran.
--
-- A window that was claimed and then failed is not retried: the next window's run follows. Retrying
-- would repeat work that may have half-happened. Emailing the owner about a failed run is #119's.
--
-- Windows come from date_bin, which takes no months or years: a monthly job (#122's digest) needs a
-- window rule of its own.

-- pg_cron and pg_net, as Supabase installs them (docs: Cron, Install; pg_net).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create extension if not exists pg_net with schema extensions;

-- One row per claimed window. RLS is on with no policy, enabled here as every table's own migration
-- does since #34 (the ensure_rls trigger would enable it too), and no client role holds any
-- privilege: anon and authenticated are refused outright. service_role, which the job functions
-- use, may read a run and finish it, and nothing more. run_job runs as postgres, which owns the
-- table.
create table public.job_runs (
  id bigint generated always as identity primary key,
  job text not null check (job ~ '^[a-z][a-z0-9-]*$'),
  window_start timestamptz not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  -- Counts and ids only, never personal data: it is written by the job, whose work may handle it.
  detail text check (char_length(detail) <= 500),
  request_id bigint,
  constraint job_runs_job_window_key unique (job, window_start),
  constraint job_runs_finished_with_outcome check ((finished_at is null) = (ok is null))
);

alter table public.job_runs enable row level security;

comment on table public.job_runs is
  'One row per scheduled job window (#41): claimed by private.run_job, finished by the job''s function.';

grant select, update (finished_at, ok, detail) on table public.job_runs to service_role;

-- The SQL half of every job. p_now exists for the tests, which pass fixed times so that windows are
-- known; pg_cron never passes it. Returns how many windows it called out for.
create function private.run_job(
  p_job text,
  p_every interval,
  p_catch_up int default 4,
  p_now timestamptz default now()
)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_secret text;
  v_url text;
  v_missing text[];
  v_current timestamptz;
  v_last timestamptz;
  v_window timestamptz;
  v_run bigint;
  v_request bigint;
  v_called int := 0;
begin
  if p_catch_up < 1 then
    raise exception 'run_job(%): p_catch_up must be at least 1, not %', p_job, p_catch_up;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  v_missing := array_remove(array[
    case when coalesce(v_secret, '') = '' then 'cron_secret' end,
    case when coalesce(v_url, '') = '' then 'project_url' end
  ], null);
  if cardinality(v_missing) > 0 then
    raise exception 'run_job(%): Vault holds no %, so nothing was called', p_job,
      array_to_string(v_missing, ' or ')
      using hint = 'Store it with vault.create_secret (README, Scheduled jobs).';
  end if;

  -- Windows are slots of p_every from a fixed origin, so every run of a job agrees where they fall.
  v_current := date_bin(p_every, p_now, timestamptz '2000-01-01 00:00:00+00');
  select max(window_start) into v_last
  from public.job_runs
  where job = p_job and window_start <= v_current;

  -- Due: every window after the last claimed one, up to the current one, and the current one always.
  -- The windows in between are the missed ones. A second run in the current window meets its claim
  -- and calls nothing, so the key is the only thing that stops a window running twice. A job never
  -- run before starts at the current window. The last window is put back on this p_every's grid
  -- before stepping on from it: one claimed under an earlier interval may sit between two slots, and
  -- stepping from it would walk past the current window without landing on it.
  for v_window in
    select w
    from generate_series(
      greatest(
        least(
          coalesce(date_bin(p_every, v_last, timestamptz '2000-01-01 00:00:00+00') + p_every, v_current),
          v_current
        ),
        v_current - p_every * (p_catch_up - 1)
      ),
      v_current,
      p_every
    ) as w
  loop
    v_run := null;
    insert into public.job_runs (job, window_start)
    values (p_job, v_window)
    on conflict do nothing
    returning id into v_run;
    continue when v_run is null;

    v_request := net.http_post(
      url := rtrim(v_url, '/') || '/functions/v1/' || p_job,
      body := jsonb_build_object('run', v_run, 'job', p_job, 'window', v_window),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Secret', v_secret),
      timeout_milliseconds := 10000
    );
    update public.job_runs set request_id = v_request where id = v_run;
    v_called := v_called + 1;
  end loop;
  return v_called;
end;
$$;

comment on function private.run_job(text, interval, int, timestamptz) is
  'Claims each due window of a scheduled job and calls its Edge Function once per window (#41).';

-- The heartbeat, every 15 minutes. cron.schedule replaces a job of the same name, so this file can
-- be re-run. Until Vault holds both secrets each run raises, and cron.job_run_details says why.
select cron.schedule(
  'heartbeat',
  '*/15 * * * *',
  $$select private.run_job('heartbeat', interval '15 minutes')$$
);
