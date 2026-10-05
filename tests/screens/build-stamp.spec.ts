// The build stamp (#38): the footer names the commit the build was made from, which the post-deploy
// check reads (scripts/check-deploy.ts), and the screen it sits on still scans clean (#36, D20).
// vite.config.ts stamps `git rev-parse HEAD`, which in CI is the commit the run checked out.
import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { expectScreenClean } from '../a11y/screen.ts'

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

test('the footer shows the short commit the build was made from, and the screen scans clean', async ({
  page,
}) => {
  // Signed out, the app makes no request (sign-in.spec.ts). Any that leaves the preview server is
  // refused here, so nothing reaches the project a local build was given.
  const left: string[] = []
  await page.route(
    (url) => url.origin !== new URL(test.info().project.use.baseURL ?? '').origin,
    (route) => {
      left.push(route.request().url())
      return route.abort()
    },
  )
  await page.goto('/')
  await expect(page.getByRole('contentinfo')).toHaveText(`Build ${commit.slice(0, 7)}`)
  await expectScreenClean(page)
  expect(left).toEqual([])
})
