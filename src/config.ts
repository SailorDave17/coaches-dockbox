// The one typed loader for the browser's configuration (ADR 011). It runs at import, which
// main.tsx does first, so a deploy missing a value fails on load with a message naming it,
// instead of failing later at whichever request happens to need it.
//
// Only public values belong here. Anything prefixed VITE_ is compiled into the bundle, so a
// secret here would ship to every phone. The service-role key and the medical encryption key
// live in Edge Function secrets and nowhere else (charter: Security & compliance).

type PublicEnvName = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'

function required(name: PublicEnvName): string {
  const value: unknown = import.meta.env[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`)
  }
  return value
}

export const config = {
  supabaseUrl: required('VITE_SUPABASE_URL'),
  supabaseAnonKey: required('VITE_SUPABASE_ANON_KEY'),
} as const
