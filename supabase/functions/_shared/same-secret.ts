// A comparison of a presented secret with the expected one, shared by the functions that check a
// secret themselves: admit (the service-role key) and the cron-driven jobs (CRON_SECRET, ./job.ts).

const encoder = new TextEncoder()

/** Compares two secrets in time that does not depend on where they first differ. */
export function sameSecret(given: string, expected: string): boolean {
  const a = encoder.encode(given)
  const b = encoder.encode(expected)
  let difference = a.length ^ b.length
  for (let i = 0; i < b.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return difference === 0
}
