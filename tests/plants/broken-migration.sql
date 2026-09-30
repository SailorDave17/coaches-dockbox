-- prove-tests plant for CI's "Start Supabase" step (#27). Copied into supabase/migrations only on
-- a hand-run of the workflow with `plant: broken-migration`. It is never committed there.
--
-- It cannot apply (22012, division by zero), so `supabase start` fails on something other than an
-- image pull. Predicted: the step fails on attempt 1 with "not on an image pull: not retrying". A
-- green step, or a retry, means the step is not reading the CLI's exit status.
select 1 / 0;
