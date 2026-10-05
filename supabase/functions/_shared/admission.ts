// Admission (#59, D15): the one way a sign-in account comes to exist. Sign-ups are off, so a person
// can sign in only after server code admits the email their roster row already carries. The admit
// function serves this to the roster sync, the bootstrap command and the director screen.
//
// It talks to Auth's admin API and PostgREST with the service role and plain fetch, so the functions
// keep no dependencies. It never reads or writes user_metadata: a user can rewrite that with only the
// public key, so it cannot decide who someone is (cairn memory, supabase-user-metadata-is-user-writable).
// The link is people.auth_user_id, which only the server writes.

export interface AdmissionConfig {
  supabaseUrl: string
  serviceRoleKey: string
}

export type Admission =
  | { status: 'admitted'; personId: string; accountCreated: boolean }
  | { status: 'invalid-email' }
  | { status: 'not-on-roster' }
  | { status: 'conflict'; personId: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Admits the roster person whose email this is, creating their account once. Safe to repeat. */
export async function admit(rawEmail: string, config: AdmissionConfig): Promise<Admission> {
  const email = rawEmail.trim().toLowerCase()
  if (!EMAIL.test(email)) return { status: 'invalid-email' }

  const api = client(config)
  const person = await findPerson(api, email)
  if (!person) return { status: 'not-on-roster' }
  if (person.auth_user_id) return { status: 'admitted', personId: person.id, accountCreated: false }

  const account = await createAccount(api, email)
  // Only an unlinked row is linked, so two admissions at once both end on the same account.
  const linked = await api.rest(`people?id=eq.${person.id}&auth_user_id=is.null`, {
    method: 'PATCH',
    body: JSON.stringify({ auth_user_id: account.id }),
    headers: { Prefer: 'return=minimal' },
  })
  // 409 is PostgREST's answer to a unique violation: this account is already another person's.
  if (linked.status === 409) return { status: 'conflict', personId: person.id }
  await expectOk(linked, 'link the person to their account')
  await linked.body?.cancel()

  const after = await findPerson(api, email)
  if (after?.auth_user_id !== account.id) return { status: 'conflict', personId: person.id }
  return { status: 'admitted', personId: person.id, accountCreated: account.created }
}

interface Person {
  id: string
  auth_user_id: string | null
}

async function findPerson(api: Api, email: string): Promise<Person | undefined> {
  const response = await api.rest(`people?select=id,auth_user_id&email=eq.${encodeURIComponent(email)}`)
  await expectOk(response, 'read the roster')
  const rows = (await response.json()) as Person[]
  return rows[0]
}

/** Creates a confirmed account for the email, or finds the one that already exists. */
async function createAccount(api: Api, email: string): Promise<{ id: string; created: boolean }> {
  const created = await api.auth('admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, email_confirm: true }),
  })
  if (created.ok) return { id: ((await created.json()) as AuthUser).id, created: true }

  // Refused, so look for the account before failing. An earlier admission may have created it and
  // stopped before linking (422 email_exists), or a concurrent one may be creating it now: Auth then
  // answers the loser 500, not 422 (measured, two admissions at once).
  const refusal = (await created.json().catch(() => ({}))) as { error_code?: string }
  // The filter matches a substring, so the email is compared whole.
  const listed = await api.auth(`admin/users?filter=${encodeURIComponent(email)}&per_page=1000`)
  await expectOk(listed, 'find the existing account')
  const { users } = (await listed.json()) as { users: AuthUser[] }
  const existing = users.find((user) => user.email?.toLowerCase() === email)
  if (!existing) {
    throw new Error(`create the account: Auth answered ${created.status} ${refusal.error_code ?? ''}`)
  }
  if (!existing.email_confirmed_at) {
    const confirmed = await api.auth(`admin/users/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({ email_confirm: true }),
    })
    await expectOk(confirmed, 'confirm the existing account')
    await confirmed.body?.cancel()
  }
  return { id: existing.id, created: false }
}

interface AuthUser {
  id: string
  email?: string
  email_confirmed_at?: string | null
}

interface Api {
  rest(path: string, init?: RequestInit): Promise<Response>
  auth(path: string, init?: RequestInit): Promise<Response>
}

function client({ supabaseUrl, serviceRoleKey }: AdmissionConfig): Api {
  const call =
    (base: string) =>
    (path: string, init: RequestInit = {}) =>
      fetch(`${supabaseUrl}/${base}/${path}`, {
        ...init,
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      })
  return { rest: call('rest/v1'), auth: call('auth/v1') }
}

async function expectOk(response: Response, what: string): Promise<void> {
  if (response.ok) return
  const body = await response.text().catch(() => '')
  throw new Error(`${what}: ${response.status} ${body.slice(0, 200)}`)
}
