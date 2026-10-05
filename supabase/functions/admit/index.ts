// The admit function (#59, D15): POST { "email": "..." } with the service-role key. It admits the
// roster person carrying that email (see ../_shared/admission.ts) and answers:
//   200 { personId, accountCreated }   admitted, now or before
//   400 the body has no usable email   401 the caller is not the service role
//   404 no roster person has the email, and no account was created
//   409 the email's account is already another person's
//
// Server code only: the roster sync, the bootstrap command, the live test-people script. A director
// admitting from their screen is #90's, which adds its own check of the director's right here.
import { admit } from '../_shared/admission.ts'
import { loadEnv } from '../_shared/env.ts'

const env = loadEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
const config = { supabaseUrl: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY }
const encoder = new TextEncoder()

Deno.serve(async (request) => {
  if (request.method !== 'POST') return answer(405, { error: 'POST only' })
  // The gateway has already checked the JWT's signature. Any valid JWT passes it, the public key's
  // included, so the key itself is compared: only a holder of the service-role key may admit.
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
  if (!sameSecret(token, env.SUPABASE_SERVICE_ROLE_KEY)) return answer(401, { error: 'service role only' })

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null
  if (typeof body?.email !== 'string') return answer(400, { error: 'expected { "email": string }' })

  try {
    const result = await admit(body.email, config)
    switch (result.status) {
      case 'admitted':
        return answer(200, { personId: result.personId, accountCreated: result.accountCreated })
      case 'invalid-email':
        return answer(400, { error: 'not an email address' })
      case 'not-on-roster':
        return answer(404, { error: 'no roster person has this email' })
      case 'conflict':
        return answer(409, { error: "this email's account belongs to another person" })
    }
  } catch (error) {
    console.error('admit failed:', error instanceof Error ? error.message : error)
    return answer(502, { error: 'admission failed' })
  }
})

function answer(status: number, body: unknown): Response {
  return Response.json(body, { status })
}

/** Compares two secrets in time that does not depend on where they first differ. */
function sameSecret(given: string, expected: string): boolean {
  const a = encoder.encode(given)
  const b = encoder.encode(expected)
  let difference = a.length ^ b.length
  for (let i = 0; i < b.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return difference === 0
}
