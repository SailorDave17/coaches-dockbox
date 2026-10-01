// The glare token test (#36, D23): src/index.css's colour tokens, and every text-on-background pair
// the app's stylesheets declare, held to the owner's glare contrast. A pair is a rule that sets both a
// text colour and a background. Text that inherits its background is the screen helper's half
// (tests/a11y/screen.ts), because only a rendered screen shows what text sits on.
//
// Its control is tests/a11y/fixtures/white-on-cyan.css, which must be refused for exactly its two
// faults.
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  checkDeclaredPairs,
  classificationProblems,
  contrastRatio,
  formatRatio,
  readColourTokens,
  type CssSource,
} from '../a11y/glare.ts'

const src = new URL('../../src/', import.meta.url)
const indexCss = readFileSync(new URL('index.css', src), 'utf8')
const { tokens, problems: tokenProblems } = readColourTokens(indexCss)

const appStylesheets: CssSource[] = readdirSync(src, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.css'))
  .map((file) => ({
    file: `src/${file.replaceAll('\\', '/')}`,
    css: readFileSync(new URL(file, src), 'utf8'),
  }))

describe('glare contrast', () => {
  it('computes WCAG contrast, printed as axe prints it', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 9)
    expect(contrastRatio('#00aeef', '#00aeef')).toBe(1)
    // axe 4.13 printed these for the same pairs (#36 probe, 2026-10-01). It truncates; 6.968 is 6.96.
    expect(formatRatio(contrastRatio('#12182b', '#00aeef'))).toBe('6.96')
    expect(formatRatio(contrastRatio('#ffffff', '#00aeef'))).toBe('2.52')
    expect(formatRatio(contrastRatio('#bd3426', '#f5f9fc'))).toBe('5.38')
    expect(formatRatio(contrastRatio('#12182b', '#f5f9fc'))).toBe('16.65')
  })

  it('reads every colour token in src/index.css and classifies each one', () => {
    expect(tokenProblems).toEqual([])
    expect(tokens.size).toBeGreaterThan(0)
    expect(classificationProblems(tokens)).toEqual([])
  })

  it("holds every text-on-background pair the app declares to the owner's glare contrast", () => {
    const { pairs, problems } = checkDeclaredPairs(appStylesheets, tokens)
    expect(problems, problems.join('\n')).toEqual([])
    // :root declares ink on paper; a read that found no pair checked nothing.
    expect(pairs).toBeGreaterThan(0)
  })

  it('refuses white text on --cyan, for both of its faults', () => {
    const fixture = {
      file: 'white-on-cyan.css',
      css: readFileSync(new URL('../a11y/fixtures/white-on-cyan.css', import.meta.url), 'utf8'),
    }
    expect(checkDeclaredPairs([fixture], tokens)).toEqual({
      pairs: 1,
      problems: [
        'white-on-cyan.css .fixture-cta: #ffffff on --cyan (#00aeef) is 2.52:1, under 4.5:1 for text on a brand-coloured control',
        'white-on-cyan.css .fixture-cta: --cyan must carry --ink (#12182b), not #ffffff',
      ],
    })
  })

  // One case per branch of the static check. Each of the refusals is a branch that otherwise
  // nothing reaches, so deleting it would leave every other test green. A loop rather than it.each,
  // whose $case titles are cut at 40 characters.
  for (const { case: name, css, pairs, problems } of [
    {
      case: 'a --cyan background with no text colour',
      css: '.a { background: var(--cyan) }',
      pairs: 0,
      problems: ['case.css .a: a --cyan background must declare color: var(--ink)'],
    },
    {
      case: 'a rule inside a media query',
      css: '@media (min-width: 1px) { .a { background: var(--cyan) } }',
      pairs: 0,
      problems: ['case.css .a: a --cyan background must declare color: var(--ink)'],
    },
    {
      case: 'text on paper under 7:1, by background-color',
      css: '.a { color: var(--red); background-color: var(--paper) }',
      pairs: 1,
      problems: [
        'case.css .a: --red (#bd3426) on --paper (#f5f9fc) is 5.38:1, under 7:1 for text on paper and pale backgrounds',
      ],
    },
    {
      case: 'white on a brand control that is not --cyan',
      css: '.a { color: #fff; background: var(--navy) }',
      pairs: 1,
      problems: [],
    },
    {
      case: 'a token src/index.css does not declare',
      css: '.a { color: var(--ink); background: var(--sand) }',
      pairs: 0,
      problems: ['case.css .a: --sand is not a colour token in src/index.css'],
    },
    {
      case: 'a background that is not one colour',
      css: '.a { color: var(--ink); background: linear-gradient(var(--paper), var(--cyan)) }',
      pairs: 0,
      problems: [
        'case.css .a: cannot read one colour from "linear-gradient(var(--paper), var(--cyan))"; use a token',
      ],
    },
    {
      case: 'a text colour used as a background',
      css: '.a { color: var(--paper); background: var(--ink) }',
      pairs: 0,
      problems: ['case.css .a: --ink is a text colour, not a background'],
    },
    {
      case: 'a text colour that inherits',
      css: '.a { color: inherit; background: var(--paper) }',
      pairs: 0,
      problems: [],
    },
  ]) {
    it(`reads ${name}`, () => {
      expect(checkDeclaredPairs([{ file: 'case.css', css }], tokens)).toEqual({ pairs, problems })
    })
  }

  it('refuses a colour token not written as hex, and one left unclassified or classified and gone', () => {
    expect(readColourTokens(':root { --sand: rgb(1 2 3); --gap: 8px; --sea: #0af }')).toEqual({
      tokens: new Map([['--sea', '#00aaff']]),
      problems: ['--sand: write the colour as #rrggbb, not "rgb(1 2 3)"'],
    })
    expect(classificationProblems(new Map([...tokens, ['--sea', '#00aaff']]))).toEqual([
      '--sea is not classified pale, control or text in TOKEN_KINDS',
    ])
    expect(classificationProblems(new Map([...tokens].filter(([name]) => name !== '--red')))).toEqual([
      'TOKEN_KINDS lists --red, which src/index.css no longer declares',
    ])
  })
})
