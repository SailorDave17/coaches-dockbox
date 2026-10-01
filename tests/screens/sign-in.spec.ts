// The sign-in screens (#52), each held to the accessibility bar every screen carries (#36, D20).
//
// The built app talks to a fake Supabase here: every request that leaves the preview server is
// answered by fakeSupabase() below or aborted, so no test reaches a real project whatever URL the
// build was given. The fake's answers copy what local Auth and PostgREST answered on 2026-10-01. The
// real server half is tests/db/sign-in.test.ts, and the decisions are tests/unit/sign-in.test.ts.
import { expect, test, type Page } from '@playwright/test'
import { expectScreenClean } from '../a11y/screen.ts'

type Answer = { status: number; json?: unknown } | 'no answer'

interface Fake {
  otp?: (email: string) => Answer
  me?: () => Answer
}

interface Seen {
  method: string
  url: URL
  body: unknown
  authorization: string | undefined
}

const OTP_DISABLED = { code: 422, error_code: 'otp_disabled', msg: 'Signups not allowed for otp' }

/** Answers the app's Supabase requests from `fake`, and records every one. A request nothing here
 * answers is aborted and listed in `unexpected`. */
async function fakeSupabase(page: Page, fake: Fake) {
  const seen: Seen[] = []
  const unexpected: string[] = []
  await page.route(
    (url) => url.origin !== new URL(test.info().project.use.baseURL ?? '').origin,
    async (route) => {
      const request = route.request()
      const cors = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': (await request.headerValue('access-control-request-headers')) ?? '*',
      }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      const url = new URL(request.url())
      const body: unknown = request.postData() ? request.postDataJSON() : undefined
      seen.push({
        method: request.method(),
        url,
        body,
        authorization: (await request.headerValue('authorization')) ?? undefined,
      })
      const email = (body as { email?: string } | undefined)?.email ?? ''
      const answer: Answer | undefined =
        url.pathname === '/auth/v1/otp'
          ? fake.otp?.(email)
          : url.pathname === '/auth/v1/user'
            ? { status: 200, json: USER }
            : url.pathname === '/auth/v1/logout'
              ? { status: 204 }
              : url.pathname === '/rest/v1/me'
                ? fake.me?.()
                : undefined
      if (answer === undefined) {
        unexpected.push(`${request.method()} ${url.pathname}`)
        return route.abort()
      }
      if (answer === 'no answer') return route.abort('failed')
      return route.fulfill({
        status: answer.status,
        headers: cors,
        contentType: 'application/json',
        body: answer.json === undefined ? '' : JSON.stringify(answer.json),
      })
    },
  )
  return { seen, unexpected }
}

const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'jordan@example.test',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-10-01T00:00:00Z',
}

/** The address a sign-in link redirects to: the app, with a session in the URL fragment, the way
 * Auth's /verify sends it (implicit flow). */
function linkLanding(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const jwt = [
    part({ alg: 'HS256', typ: 'JWT' }),
    part({ sub: USER.id, email: USER.email, aud: 'authenticated', role: 'authenticated', exp }),
    'not-a-signature',
  ].join('.')
  const fragment = new URLSearchParams({
    access_token: jwt,
    expires_in: '3600',
    expires_at: String(exp),
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    type: 'magiclink',
  })
  return `/#${fragment}`
}

/** Fails the test on an error thrown in the page: config.ts stops the app at load without its two
 * public values, which leaves a blank page. */
function watchPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 2, name, exact: true })

test('opens signed out on the sign-in screen, without a request, and it scans clean', async ({ page }) => {
  const errors = watchPageErrors(page)
  const { seen, unexpected } = await fakeSupabase(page, {})
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: "Coaches' Dockbox" })).toBeVisible()
  await expect(heading(page, 'Sign in')).toBeVisible()
  await expectScreenClean(page)
  expect({ errors, seen, unexpected }).toEqual({ errors: [], seen: [], unexpected: [] })
})

test("says 'check your email' whatever address is entered, asking with create_user false", async ({
  page,
}) => {
  const { seen, unexpected } = await fakeSupabase(page, {
    otp: (email) =>
      email === 'jordan@example.test' ? { status: 200, json: {} } : { status: 422, json: OTP_DISABLED },
  })
  const shown: string[] = []
  for (const email of ['jordan@example.test', 'nobody@example.test']) {
    await page.goto('/')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
    await expect(heading(page, 'Check your email')).toBeVisible()
    await expect(heading(page, 'Check your email')).toBeFocused()
    shown.push((await page.getByRole('main').innerText()).replaceAll(email, '<address>'))
    if (email === 'nobody@example.test') await expectScreenClean(page)
  }
  expect(shown[1]).toBe(shown[0])
  expect(shown[0]).toContain('If <address> is on a Dockbox roster, a sign-in link is on its way to it.')
  const origin = new URL(page.url()).origin
  expect(
    seen.map(({ method, url, body }) => ({
      request: `${method} ${url.pathname}`,
      redirectTo: url.searchParams.get('redirect_to'),
      email: (body as { email?: unknown }).email,
      createUser: (body as { create_user?: unknown }).create_user,
    })),
  ).toEqual([
    { request: 'POST /auth/v1/otp', redirectTo: origin, email: 'jordan@example.test', createUser: false },
    { request: 'POST /auth/v1/otp', redirectTo: origin, email: 'nobody@example.test', createUser: false },
  ])
  expect(unexpected).toEqual([])
})

test("says Dockbox can't be reached when the link request gets no answer, and it scans clean", async ({
  page,
}) => {
  await fakeSupabase(page, { otp: () => 'no answer' })
  await page.goto('/')
  await page.getByLabel('Email').fill('jordan@example.test')
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    "Dockbox can't be reached right now. Check your connection, then try again.",
  )
  await expect(heading(page, 'Check your email')).toHaveCount(0)
  await expectScreenClean(page)
})

test('opens signed in from a sign-in link, keeps the session across a reload, and scans clean', async ({
  page,
}) => {
  const errors = watchPageErrors(page)
  const { seen, unexpected } = await fakeSupabase(page, {
    me: () => ({ status: 200, json: [{ first_name: 'Jordan' }] }),
  })
  await page.goto(linkLanding())
  await expect(heading(page, 'Signed in as Jordan')).toBeVisible()
  // supabase-js takes the session out of the address bar once it has read it.
  expect(new URL(page.url()).hash).not.toContain('access_token')
  await expectScreenClean(page)

  await page.reload()
  await expect(heading(page, 'Signed in as Jordan')).toBeVisible()
  const names = seen.filter(({ url }) => url.pathname === '/rest/v1/me')
  expect(names).toHaveLength(2)
  for (const { authorization } of names) expect(authorization).toMatch(/^Bearer ey/)
  expect({ errors, unexpected }).toEqual({ errors: [], unexpected: [] })
})

test("Sign out ends this device's session, and the sign-in screen stays after a reload", async ({ page }) => {
  const { seen, unexpected } = await fakeSupabase(page, {
    me: () => ({ status: 200, json: [{ first_name: 'Jordan' }] }),
  })
  await page.goto(linkLanding())
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(heading(page, 'Sign in')).toBeVisible()
  const logout = seen.filter(({ url }) => url.pathname === '/auth/v1/logout')
  expect(logout.map(({ method, url }) => `${method} ${url.search}`)).toEqual(['POST ?scope=local'])
  const stored = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.endsWith('-auth-token')),
  )
  expect(stored).toEqual([])

  await page.reload()
  await expect(heading(page, 'Sign in')).toBeVisible()
  expect(unexpected).toEqual([])
})

test("shows 'not on a Dockbox roster' to a session linked to no person, and it scans clean", async ({
  page,
}) => {
  await fakeSupabase(page, { me: () => ({ status: 200, json: [] }) })
  await page.goto(linkLanding())
  await expect(heading(page, "You're not on a Dockbox roster yet")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expectScreenClean(page)
})

test('shows the problem screen, not the sign-in screen, when the name cannot be read, and it scans clean', async ({
  page,
}) => {
  let answer: Answer = 'no answer'
  await fakeSupabase(page, { me: () => answer })
  await page.goto(linkLanding())
  await expect(heading(page, "Dockbox can't be reached right now")).toBeVisible()
  await expectScreenClean(page)

  answer = { status: 200, json: [{ first_name: 'Jordan' }] }
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(heading(page, 'Signed in as Jordan')).toBeVisible()
})
