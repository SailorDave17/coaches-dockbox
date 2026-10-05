// Which functions the RLS policies call (#43, ADR 001 as amended by D3). A security-definer helper
// called from a policy is allowed only when it returns the caller's own facts, is stable with
// search_path='', has execute revoked from public and anon, and is tested. This file is the test:
// - every function any policy calls, in any schema, is on ALLOWED below, with the reason it is safe,
//   and every function on ALLOWED is still called;
// - every definer one is stable, pins search_path to empty, and neither anon nor PUBLIC may execute
//   it.
// A policy records the functions it calls in pg_depend when it is created, so this reads the
// catalog's own record rather than the policy text. pg_get_expr prints a function on the search path
// without its schema, so a pattern over the text can miss one (cairn memory, supabase-rls-column-
// grants, tender #21).
//
// Its prove-tests mutation is tests/mutations/policy-calls-unlisted-definer.sql: a well-formed
// definer helper that no one listed, called from a new policy. Predicted: exactly the allow-list case
// turns red.
//
// It connects straight to Postgres from DB_URL (`npx supabase status -o env`) as `postgres`, like
// api-roles-reach.test.ts. With nothing set it fails rather than skipping.
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

const dbUrl = process.env.DB_URL
if (!dbUrl) {
  throw new Error('DB_URL is not set. Run `npx supabase start`, then export `npx supabase status -o env`.')
}
const sql = postgres(dbUrl, { max: 1, onnotice: () => {} })
afterAll(() => sql.end())

type Db = postgres.Sql | postgres.TransactionSql

// Every function an RLS policy may call, keyed as the failure message names it, with the reason it
// is safe. Adding a policy that calls a function means adding it here, in the same pull request.
const ALLOWED: Record<string, string> = {
  'private.my_roster_season_ids()':
    "Definer, so the memberships policy can read memberships without re-entering itself. Returns only the caller's own scope: the ids of the current seasons of the programs they coach or direct this season (#43).",
  'private.my_linked_sailor_ids()':
    "Definer, so the people policy can read the caller's own auth_user_id and their links, neither of which a guardian may select. Returns only the caller's own facts: the ids of the sailors they are currently linked to (#53).",
  'private.my_person_id()':
    "Definer, so the people policy and public.me can read the caller's own auth_user_id, which no client may select. Returns only the caller's own fact: the id of the person their session is linked to (#52).",
}

type PolicyFunction = {
  fn: string
  definer: boolean
  stable: boolean
  config: string[]
  anon: boolean
  public: boolean
}

/** Every function an RLS policy calls, in any schema, with what D3 asks of a definer one. */
async function policyFunctions(db: Db): Promise<PolicyFunction[]> {
  return db<PolicyFunction[]>`
    select distinct
      format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as fn,
      p.prosecdef as definer,
      p.provolatile = 's' as stable,
      coalesce(p.proconfig, '{}') as config,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
      exists (
        select 1
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      ) as public
    from pg_policy pol
    join pg_depend d
      on d.classid = 'pg_policy'::regclass
     and d.objid = pol.oid
     and d.refclassid = 'pg_proc'::regclass
    join pg_proc p on p.oid = d.refobjid
    join pg_namespace n on n.oid = p.pronamespace
    order by 1`
}

/** What each definer function among `functions` lacks of D3's conditions. */
function definerFaults(functions: PolicyFunction[]): string[] {
  return functions
    .filter((f) => f.definer)
    .flatMap((f) => [
      ...(f.stable ? [] : [`${f.fn} is not stable`]),
      ...(f.config.includes('search_path=""') ? [] : [`${f.fn} does not pin search_path to ''`]),
      ...(f.anon ? [`anon may execute ${f.fn}`] : []),
      ...(f.public ? [`PUBLIC may execute ${f.fn}`] : []),
    ])
}

class Rollback extends Error {}

/** Runs `probe` in a transaction that is always rolled back, so it leaves nothing behind. */
async function rolledBack<T>(probe: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const box: { result?: T } = {}
  try {
    await sql.begin(async (tx) => {
      box.result = await probe(tx)
      throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }
  if (!('result' in box)) throw new Error('the probe never finished')
  return box.result as T
}

describe('RLS policies call only listed functions, and every definer one is hardened (#43, D3)', () => {
  it('calls exactly the functions on the allow-list', async () => {
    for (const [fn, reason] of Object.entries(ALLOWED)) expect(reason.trim(), fn).not.toBe('')
    const called = (await policyFunctions(sql)).map((f) => f.fn).sort()
    expect(called).toEqual(Object.keys(ALLOWED).sort())
  })

  it('finds every definer function a policy calls stable, on an empty search_path, and closed to anon and PUBLIC', async () => {
    expect(definerFaults(await policyFunctions(sql))).toEqual([])
  })

  // The positive control, rolled back: the same reads see a new policy's function, see that it is a
  // definer, and see each of D3's conditions it breaks.
  it('sees an unlisted definer helper a new policy calls, and each condition it breaks, with the same reads', async () => {
    const seen = await rolledBack(async (tx) => {
      await tx`create table public.policy_probe (id int)`
      await tx`create function private.policy_probe_fn() returns boolean language sql volatile security definer as 'select true'`
      await tx`grant execute on function private.policy_probe_fn() to public`
      await tx`create policy policy_probe_read on public.policy_probe for select using (private.policy_probe_fn())`
      return policyFunctions(tx)
    })
    expect(seen.map((f) => f.fn)).toContain('private.policy_probe_fn()')
    expect(definerFaults(seen)).toEqual([
      'private.policy_probe_fn() is not stable',
      "private.policy_probe_fn() does not pin search_path to ''",
      'anon may execute private.policy_probe_fn()',
      'PUBLIC may execute private.policy_probe_fn()',
    ])
  })
})
