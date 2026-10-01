// The home screen, held to the accessibility bar every screen carries (#36, D20). Today it is the
// scaffold; the stories that build the real screens add their own spec beside this one.
import { expect, test } from '@playwright/test'
import { expectScreenClean } from '../a11y/screen.ts'

test('the home screen scans clean', async ({ page }) => {
  // config.ts throws at load without its two public values, which leaves a blank page that scans
  // clean. The heading and the error list together rule that out.
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: "Coaches' Dockbox" })).toBeVisible()
  await expectScreenClean(page)
  expect(errors).toEqual([])
})
