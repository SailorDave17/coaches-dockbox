// The one typed loader for the Edge Functions' configuration (ADR 011), the Deno twin of
// src/config.ts. Every function calls it at module scope, before Deno.serve, so a deploy missing a
// value fails the worker at boot with a message naming it, instead of failing later at whichever
// request happens to need it.
//
// It never supplies a default. A missing secret that quietly became an empty string or a
// placeholder would boot, pass a heartbeat and fail on the first real request, or worse, succeed
// against the wrong thing.

/** Reads each named variable, or throws naming every one that is unset or blank. */
export function loadEnv<const Name extends string>(names: readonly Name[]): Readonly<Record<Name, string>> {
  const env: Partial<Record<Name, string>> = {}
  const missing: Name[] = []
  for (const name of names) {
    const value = Deno.env.get(name)
    if (value === undefined || value.trim() === '') missing.push(name)
    else env[name] = value
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}.`)
  }
  return env as Record<Name, string>
}
