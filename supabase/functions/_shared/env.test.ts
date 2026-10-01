// The Edge Functions' env loader, under Deno (#35): `npm run test:functions`. Each case imports
// testdata/needs-env.ts the way the edge runtime imports a function, so what is tested is the boot,
// not only the loader called by hand.
//
// Every refusal is matched on the loader's whole message. A Deno permission error names the
// variable too ("Requires env access to DOCKBOX_TEST_KEY"), so a match on the name alone would pass
// on that instead, if the test script's --allow-env lost a name.
//
// Its prove-tests mutation is a default for a missing value (`Deno.env.get(name) ?? 'unset'`),
// which turns exactly one case red: the missing one. A blank value is a separate case because `??`
// leaves it untouched, so it guards the blank check on its own.
import assert from 'node:assert/strict'

const NAMES = ['DOCKBOX_TEST_URL', 'DOCKBOX_TEST_KEY', 'DOCKBOX_TEST_TOKEN'] as const
type Values = Partial<Record<(typeof NAMES)[number], string>>

/** Boots the fixture with exactly these values set, as a fresh module each time. */
async function boot(values: Values): Promise<unknown> {
  const saved = NAMES.map((name) => [name, Deno.env.get(name)] as const)
  for (const name of NAMES) {
    const value = values[name]
    if (value === undefined) Deno.env.delete(name)
    else Deno.env.set(name, value)
  }
  try {
    // A query string makes each import a new module, so its top level runs again.
    const url = new URL(`./testdata/needs-env.ts?boot=${crypto.randomUUID()}`, import.meta.url)
    return await import(url.href)
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) Deno.env.delete(name)
      else Deno.env.set(name, value)
    }
  }
}

const url = 'http://127.0.0.1:54321'

Deno.test('boots with every required value set, and returns each by its name', async () => {
  const values = { DOCKBOX_TEST_URL: url, DOCKBOX_TEST_KEY: 'key-1', DOCKBOX_TEST_TOKEN: 'token-1' }
  const module = (await boot(values)) as { env: Record<string, string> }
  assert.deepEqual(module.env, values)
})

Deno.test('fails at boot naming the variable when a required value is missing', async () => {
  // Two missing and one set: the message names both missing ones, and not the set one.
  await assert.rejects(boot({ DOCKBOX_TEST_URL: url }), {
    name: 'Error',
    message: 'Missing required environment variable(s): DOCKBOX_TEST_KEY, DOCKBOX_TEST_TOKEN.',
  })
})

Deno.test('fails at boot naming the variable when a required value is blank', async () => {
  await assert.rejects(
    boot({ DOCKBOX_TEST_URL: url, DOCKBOX_TEST_KEY: '  ', DOCKBOX_TEST_TOKEN: 'token-1' }),
    {
      name: 'Error',
      message: 'Missing required environment variable(s): DOCKBOX_TEST_KEY.',
    },
  )
})
