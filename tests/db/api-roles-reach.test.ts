// The schema-wide reach guard (#34, D69). It reads the catalog, so every later table, view and
// function is covered without editing this file:
// - anon holds no privilege on any table or view in public;
// - neither anon nor PUBLIC may execute a function in public, unless EXEMPT says why;
// - a table or function a later migration creates in public is granted to no API role, and the
//   table gets RLS (migration 20261001120000), probed in a transaction that is rolled back;
// - no table in a schema that supabase/config.toml exposes has RLS off.
// Each query has a positive control beside it, so a query that could never see a grant, or a
// table with RLS off, does not pass for the wrong reason.
//
// It connects straight to Postgres from DB_URL (`npx supabase status -o env`) as `postgres`, the
// role the migrations run as. With nothing set it fails rather than skipping. The prove-tests
// mutation is tests/mutations/anon-select-on-programs.sql (expected: exactly the anon case turns
// red), and the plant tests/plants/table-without-rls.sql reddens the RLS case and CI's advisors.
import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

const dbUrl = process.env.DB_URL
if (!dbUrl) {
  throw new Error('DB_URL is not set. Run `npx supabase start`, then export `npx supabase status -o env`.')
}
const sql = postgres(dbUrl, { max: 1, onnotice: () => {} })
afterAll(() => sql.end())

type Db = postgres.Sql | postgres.TransactionSql
const API_ROLES = ['anon', 'authenticated', 'service_role']

// Functions in public that anon or PUBLIC may execute, keyed as the failure message names them,
// each with the reason it is safe. Empty: a function a signed-in client calls is granted to
// `authenticated`, which this test does not refuse.
const EXEMPT: Record<string, string> = {}

/** Every privilege `role` holds on a table, view, materialized view or foreign table in public,
 * whether granted to it, to a role it is a member of, or to PUBLIC. A grant on one column counts. */
async function tablePrivileges(db: Db, role: string): Promise<string[]> {
  const rows = await db<{ held: string }[]>`
    select format('%I.%I %s', n.nspname, c.relname, p.privilege) as held
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
    ]) as p(privilege)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and case
        when p.privilege in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
          then has_any_column_privilege(${role}, c.oid, p.privilege)
        else has_table_privilege(${role}, c.oid, p.privilege)
      end
    order by 1`
  return rows.map((row) => row.held)
}

/** Every function in public that anon may execute, or that PUBLIC holds EXECUTE on. */
async function executableFunctions(db: Db): Promise<Array<{ fn: string; grantee: string }>> {
  const rows = await db<{ fn: string; grantee: string }[]>`
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as fn,
      g.grantee
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral (values
      ('anon', has_function_privilege('anon', p.oid, 'EXECUTE')),
      ('PUBLIC', exists (
        select 1
        from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      ))
    ) as g(grantee, holds)
    where n.nspname = 'public' and g.holds
    order by 1, 2`
  return rows.map(({ fn, grantee }) => ({ fn, grantee }))
}

/** Every table in `schemas` with row level security off. */
async function rlsOff(db: Db, schemas: string[]): Promise<string[]> {
  const rows = await db<{ relation: string }[]>`
    select format('%I.%I', n.nspname, c.relname) as relation
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = any(${db.array(schemas)})
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
    order by 1`
  return rows.map((row) => row.relation)
}

/** The schemas the Data API serves: `schemas` under `[api]` in supabase/config.toml. */
function exposedSchemas(): string[] {
  const toml = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8')
  const api = /^\[api\][^\S\n]*$([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(toml)?.[1] ?? ''
  const list = /^schemas\s*=\s*\[([^\]]*)\]/m.exec(api)?.[1] ?? ''
  const schemas = [...list.matchAll(/"([^"]+)"|'([^']+)'/g)].map((match) => match[1] ?? match[2] ?? '')
  if (schemas.length === 0) throw new Error('found no `schemas` under [api] in supabase/config.toml')
  return schemas
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

describe('API roles reach nothing by default (#34, D69)', () => {
  it('gives anon no privilege on any table or view in public', async () => {
    expect(await tablePrivileges(sql, 'anon')).toEqual([])
  })

  // The positive control: the same query, for a role that does hold privileges.
  it('sees a privilege service_role holds, with the same query', async () => {
    expect(await tablePrivileges(sql, 'service_role')).toContain('public.programs SELECT')
  })

  it('lets neither anon nor PUBLIC execute a function in public, unless it is exempted with a reason', async () => {
    for (const [fn, reason] of Object.entries(EXEMPT)) expect(reason.trim(), fn).not.toBe('')
    const held = await executableFunctions(sql)
    expect(
      held
        .filter(({ fn }) => !Object.hasOwn(EXEMPT, fn))
        .map(({ fn, grantee }) => `${grantee} may execute ${fn}`),
    ).toEqual([])
  })

  // Its positive control, rolled back: the same query sees a function granted to PUBLIC.
  it('sees a function PUBLIC may execute, with the same query', async () => {
    const seen = await rolledBack(async (tx) => {
      await tx`create function public.reach_probe_fn() returns int language sql as 'select 1'`
      await tx`grant execute on function public.reach_probe_fn() to public`
      return executableFunctions(tx)
    })
    expect(seen).toContainEqual({ fn: 'public.reach_probe_fn()', grantee: 'PUBLIC' })
    expect(seen).toContainEqual({ fn: 'public.reach_probe_fn()', grantee: 'anon' })
  })

  // What a later migration's new objects get, simulated in a transaction that is rolled back.
  it('grants a new table or function in public to no API role, and enables RLS on the table', async () => {
    const probe = await rolledBack(async (tx) => {
      const [session] = await tx<{ role: string }[]>`select current_user as role`
      await tx`create table public.reach_probe (id int)`
      await tx`create function public.reach_probe_fn() returns int language sql as 'select 1'`
      const [table] = await tx<{ rls: boolean }[]>`
        select relrowsecurity as rls from pg_class where oid = 'public.reach_probe'::regclass`
      const held: string[] = []
      for (const role of API_ROLES) {
        for (const privilege of await tablePrivileges(tx, role)) {
          if (privilege.startsWith('public.reach_probe ')) held.push(`${role}: ${privilege}`)
        }
        const [fn] = await tx<{ execute: boolean }[]>`
          select has_function_privilege(${role}, 'public.reach_probe_fn()'::regprocedure, 'EXECUTE') as execute`
        if (fn?.execute) held.push(`${role}: EXECUTE public.reach_probe_fn()`)
      }
      // The control: the migration's own grant is what makes the table reachable.
      await tx`grant select on public.reach_probe to authenticated`
      const granted = await tablePrivileges(tx, 'authenticated')
      return { role: session?.role, rls: table?.rls, held, granted }
    })
    // The defaults are set `for role postgres`; probing as any other role would test nothing.
    expect(probe.role).toBe('postgres')
    expect(probe.rls).toBe(true)
    expect(probe.held).toEqual([])
    expect(probe.granted).toContain('public.reach_probe SELECT')
  })

  it('finds no table with RLS off in a schema supabase/config.toml exposes', async () => {
    const schemas = exposedSchemas()
    const [known] = await sql<{ count: number }[]>`
      select count(*)::int as count from pg_namespace where nspname = any(${sql.array(schemas)})`
    expect(known?.count, `every schema under [api] exists: ${schemas.join(', ')}`).toBe(schemas.length)
    expect(await rlsOff(sql, schemas)).toEqual([])
  })

  // Its positive control, rolled back: the same query sees a table whose RLS is switched off.
  it('sees a table with RLS off, with the same query', async () => {
    const seen = await rolledBack(async (tx) => {
      await tx`create table public.reach_probe (id int)`
      await tx`alter table public.reach_probe disable row level security`
      return rlsOff(tx, exposedSchemas())
    })
    expect(seen).toContain('public.reach_probe')
  })
})
