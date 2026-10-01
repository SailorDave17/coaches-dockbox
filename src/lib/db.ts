// The one module that talks to the Supabase database (ADR 011: one data module per store), so the
// query layer can change without a sweep through the screens.
//
// Medical flags are NOT read here. The medical_flags table is closed to every client role; the
// only path to it is the medical Edge Function, called from src/medical/ once that story lands
// (ADR 002).
import { createClient } from '@supabase/supabase-js'
import type { FirstNameRead } from '../auth/session.ts'
import { config } from '../config.ts'

// The default auth settings are the sign-in design (#52): the implicit flow, so an emailed link opens
// on whichever device it is tapped and needs no verifier stored by the device that asked for it; the
// session kept in localStorage, so it survives a reload; and the session read from the link's URL
// fragment when the app loads.
export const db = createClient(config.supabaseUrl, config.supabaseAnonKey)

/** The signed-in person's first name, from public.me, which returns the caller's own people row and
 * nothing else (#52). Not retried: postgrest-js would retry a read that got no answer three times,
 * 1, 2 and 4 s apart, behind the loading screen. The problem screen's Try again is the retry. */
export async function readMyFirstName(): Promise<FirstNameRead> {
  const { data, error } = await db.from('me').select('first_name').retry(false).maybeSingle()
  if (error) return { ok: false }
  const firstName: unknown = data?.first_name
  return { ok: true, firstName: typeof firstName === 'string' ? firstName : null }
}
