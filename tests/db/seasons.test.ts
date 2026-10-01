// Seasons and club time (#39). club_today() must give the club's date in America/New_York, whatever
// the server or session zone and across a DST change. The seasons table must keep RLS on, grant anon
// nothing, and grant authenticated nothing but the select the roster read (#43) needs.
//
// It connects straight to Postgres from DB_URL (`npx supabase status -o env`) as `postgres`, like
// api-roles-reach.test.ts. With nothing set it fails rather than skipping.
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

const dbUrl = process.env.DB_URL
if (!dbUrl) {
  throw new Error('DB_URL is not set. Run `npx supabase start`, then export `npx supabase status -o env`.')
}
// The session runs in a zone that is neither the club's nor UTC, and is off UTC by 45 minutes, so
// a club_today() that slipped to the session's zone, or to UTC, cannot match New York by accident
// (cairn memory: a timezone pin must differ in minutes and be asserted).
const SESSION_ZONE = 'Pacific/Chatham'
const sql = postgres(dbUrl, { max: 1, onnotice: () => {}, connection: { TimeZone: SESSION_ZONE } })
afterAll(() => sql.end())

/** Each instant, given in UTC, with the club date it falls on. 23:30 and 00:30 club time either
 * side of midnight, on the days either side of both 2026-27 DST changes. */
const INSTANTS: Array<[string, string, string]> = [
  // DST ends 2026-11-01 at 02:00 EDT.
  ['23:30 EDT on 31 Oct', '2026-11-01T03:30:00Z', '2026-10-31'],
  ['00:30 EDT on 1 Nov', '2026-11-01T04:30:00Z', '2026-11-01'],
  ['23:30 EST on 1 Nov', '2026-11-02T04:30:00Z', '2026-11-01'],
  ['00:30 EST on 2 Nov', '2026-11-02T05:30:00Z', '2026-11-02'],
  // DST starts 2027-03-14 at 02:00 EST.
  ['23:30 EST on 13 Mar', '2027-03-14T04:30:00Z', '2027-03-13'],
  ['00:30 EST on 14 Mar', '2027-03-14T05:30:00Z', '2027-03-14'],
  ['23:30 EDT on 14 Mar', '2027-03-15T03:30:00Z', '2027-03-14'],
  ['00:30 EDT on 15 Mar', '2027-03-15T04:30:00Z', '2027-03-15'],
]

describe('club_today() is the date in America/New_York (#39)', () => {
  // Without this, a zone the server could not resolve, or a dropped connection option, would leave
  // the session on UTC, and a slip to UTC would read as the session zone.
  it(`runs the session in ${SESSION_ZONE}, which is not the club's zone or UTC`, async () => {
    const [row] = await sql<{ zone: string; offset: string }[]>`
      select current_setting('TimeZone') as zone,
        to_char(now(), 'TZH:TZM') as offset`
    expect(row?.zone).toBe(SESSION_ZONE)
    expect(row?.offset).toMatch(/^\+1[23]:45$/)
  })

  it.each(INSTANTS)('dates %s (%s) as %s', async (_, at, expected) => {
    const [row] = await sql<{ day: string }[]>`select public.club_today(${at}::timestamptz)::text as day`
    expect(row?.day).toBe(expected)
  })
})

const PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']

/** Every privilege `role` holds on public.seasons, directly, through a role or through PUBLIC. A
 * grant on one column counts. */
async function seasonPrivileges(role: string): Promise<string[]> {
  const rows = await sql<{ privilege: string }[]>`
    select p.privilege
    from unnest(${sql.array(PRIVILEGES)}::text[]) as p(privilege)
    where case
      when p.privilege in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
        then has_any_column_privilege(${role}, 'public.seasons'::regclass, p.privilege)
      else has_table_privilege(${role}, 'public.seasons'::regclass, p.privilege)
    end
    order by 1`
  return rows.map((row) => row.privilege)
}

describe('seasons is closed to clients except for the roster read (#39, #43)', () => {
  it('has row level security on', async () => {
    const [row] = await sql<{ rls: boolean }[]>`
      select relrowsecurity as rls from pg_class where oid = 'public.seasons'::regclass`
    expect(row?.rls).toBe(true)
  })

  // Which columns authenticated may select, and which rows, is roster-reads.test.ts's.
  it('grants anon nothing, and authenticated only select', async () => {
    expect({
      anon: await seasonPrivileges('anon'),
      authenticated: await seasonPrivileges('authenticated'),
    }).toEqual({ anon: [], authenticated: ['SELECT'] })
  })

  // The positive control: the same query sees what the server side holds.
  it('grants service_role the four verbs the server side uses, with the same query', async () => {
    expect(await seasonPrivileges('service_role')).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE'])
  })
})
