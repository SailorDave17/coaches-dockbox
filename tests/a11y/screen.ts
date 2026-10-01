// The accessibility helper every screen test calls (#36, D20). One scan holds a rendered screen to:
// - axe-core's WCAG 2.0, 2.1 and 2.2 A and AA rules. axe 4.13 runs `target-size` (2.5.8) only when
//   the wcag22aa tag is asked for (cairn memory, axe-core-in-a-test-suite);
// - 56 by 56 CSS px for every visible interactive element, the dock's one-thumb size, which is
//   stricter than WCAG's 24 px and has no spacing exception;
// - the owner's glare contrast (D23, glare.ts), applied to every text node axe measured. axe's own
//   check stops at 4.5:1, and red on paper passes it at 5.38:1 while failing D23's 7:1.
//
// Usage, in a test under tests/screens:
//   await page.goto('/the-screen')
//   await expectScreenClean(page)
//
// Stated limits:
// - Violations only. A node axe marks `incomplete` (text over an image or a gradient, or text too
//   short to call) is neither failed nor measured, so the glare rule does not reach it.
// - The target check reads the element's own box. A visually hidden input whose label is the real
//   target is still measured as itself.
// - Focus order, keyboard traps and what a screen reader says stay with a person and ux-design.
import { readFileSync } from 'node:fs'
import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { glareProblems, normaliseHex, readColourTokens } from './glare.ts'

// The axe-core version the helper's controls were calibrated with (tests/screens/a11y-helper.spec.ts
// holds it). A bump can add rules, so it reddens there until this line moves.
export const AXE_VERSION = '4.13.0'

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

export const MIN_TARGET_PX = 56

const { tokens } = readColourTokens(readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8'))

export interface ScreenScan {
  problems: string[]
  axeVersion: string
  textMeasured: number
}

interface ContrastData {
  fgColor?: string
  bgColor?: string
}

// Runs in the page. Every visible interactive element smaller than `min` either way, named.
function findSmallTargets(min: number): string[] {
  const interactive = [
    'a[href]',
    'area[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    ...[
      'button',
      'link',
      'checkbox',
      'radio',
      'switch',
      'tab',
      'menuitem',
      'menuitemcheckbox',
      'menuitemradio',
      'option',
      'slider',
      'spinbutton',
      'combobox',
      'textbox',
      'searchbox',
      'treeitem',
    ].map((role) => `[role="${role}"]`),
  ].join(',')
  const found: string[] = []
  for (const el of document.querySelectorAll<HTMLElement>(interactive)) {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
    const box = el.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    if (box.width >= min - 0.01 && box.height >= min - 0.01) continue
    const labels = 'labels' in el ? (el as HTMLInputElement).labels : null
    const name = [
      el.getAttribute('aria-label'),
      labels?.[0]?.textContent,
      el.textContent,
      el.getAttribute('title'),
      el.getAttribute('placeholder'),
    ]
      .map((text) => (text ?? '').trim().replace(/\s+/g, ' '))
      .find((text) => text !== '')
      ?.slice(0, 40)
    const tag = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '')
    const size = `${Math.round(box.width * 10) / 10}×${Math.round(box.height * 10) / 10}`
    found.push(`target ${tag} ${name ? `"${name}"` : '(no name)'} is ${size} CSS px, under ${min}×${min}`)
  }
  return found
}

// Scans the page as it is now and returns every problem found, without failing. expectScreenClean
// is the assertion; this is for the helper's own controls.
export async function scanScreen(page: Page): Promise<ScreenScan> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const problems: string[] = []

  for (const v of results.violations) {
    problems.push(`axe ${v.id} (${v.nodes.length}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  }

  problems.push(...(await page.evaluate(findSmallTargets, MIN_TARGET_PX)))

  // Text axe failed is already a violation above; the glare rule reads the text it passed.
  let textMeasured = results.violations.find((v) => v.id === 'color-contrast')?.nodes.length ?? 0
  for (const node of results.passes.find((r) => r.id === 'color-contrast')?.nodes ?? []) {
    const where = node.target.join(' ')
    const check = [...node.any, ...node.all, ...node.none].find((c) => c.id === 'color-contrast')
    const data = check?.data as ContrastData | undefined
    const fg = data?.fgColor && normaliseHex(data.fgColor)
    const bg = data?.bgColor && normaliseHex(data.bgColor)
    if (!fg || !bg) {
      problems.push(`glare: ${where}: axe passed its contrast without reporting both colours`)
      continue
    }
    textMeasured += 1
    for (const p of glareProblems(fg, bg, tokens)) problems.push(`glare: ${where}: ${p}`)
  }

  // The floor for a scan that read nothing. A blank page, such as the app stopped at load by a
  // missing setting, still applies a few document rules, so a count of applied rules passed it in
  // #36's mutation round; it measures no text. Neither does a run that applied no rules at all.
  if (textMeasured === 0) {
    problems.push('axe measured the contrast of no text, so the glare rule checked nothing')
  }

  return { problems, axeVersion: results.testEngine.version, textMeasured }
}

// Fails the test, naming every problem, unless the screen scans clean.
export async function expectScreenClean(page: Page): Promise<void> {
  const { problems } = await scanScreen(page)
  // The joined list goes in the message: a long array is shortened on the failure's first line.
  expect(problems, `accessibility problems:\n  ${problems.join('\n  ')}`).toEqual([])
}
