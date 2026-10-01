// Controls for the accessibility helper (#36): each fixture plants one defect, and the helper must
// report exactly that defect and nothing else. A control that stops going red here means the helper
// stopped checking something, while every screen test would still pass.
//
// The fixtures load the app's real stylesheet, so they use its tokens. Each control also asserts the
// planted size it relies on: an app-wide minimum size would otherwise defeat the plant silently
// (cairn memory, axe-core-in-a-test-suite).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { AXE_VERSION, scanScreen } from '../a11y/screen.ts'

async function openFixture(page: Page, name: string): Promise<void> {
  await page.setContent(readFileSync(new URL(`../a11y/fixtures/${name}`, import.meta.url), 'utf8'))
  await page.addStyleTag({ path: fileURLToPath(new URL('../../src/index.css', import.meta.url)) })
}

test('passes a 56 px button, at the axe-core version it was calibrated with', async ({ page }) => {
  await openFixture(page, 'button-56px.html')
  expect(await page.getByRole('button', { name: 'Save' }).boundingBox()).toMatchObject({
    width: 56,
    height: 56,
  })
  const scan = await scanScreen(page)
  expect(scan.axeVersion).toBe(AXE_VERSION)
  expect(scan.problems).toEqual([])
  expect(scan.textMeasured).toBeGreaterThan(0)
})

test('reds a 40 px button, naming it', async ({ page }) => {
  await openFixture(page, 'button-40px.html')
  expect(await page.getByRole('button', { name: 'Save' }).boundingBox()).toMatchObject({
    width: 40,
    height: 40,
  })
  expect((await scanScreen(page)).problems).toEqual(['target button "Save" is 40×40 CSS px, under 56×56'])
})

test("runs axe's WCAG 2.2 target-size rule", async ({ page }) => {
  await openFixture(page, 'touching-20px-pair.html')
  expect(await page.getByRole('button', { name: 'A' }).boundingBox()).toMatchObject({ width: 20, height: 20 })
  expect((await scanScreen(page)).problems).toEqual([
    expect.stringMatching(/^axe target-size \(2\): /),
    'target button "A" is 20×20 CSS px, under 56×56',
    'target button "B" is 20×20 CSS px, under 56×56',
  ])
})

test('reds red text on paper, which axe passes at 5.38:1', async ({ page }) => {
  await openFixture(page, 'red-on-paper.html')
  expect((await scanScreen(page)).problems).toEqual([
    'glare: p: --red (#bd3426) on --paper (#f5f9fc) is 5.38:1, under 7:1 for text on paper and pale backgrounds',
  ])
})
