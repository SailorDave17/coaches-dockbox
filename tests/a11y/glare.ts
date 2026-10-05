// The owner's glare contrast (D23, 2026-09-30), shared by the token test (tests/unit) and the screen
// helper (screen.ts) (#36):
// - text on paper and pale backgrounds reaches at least 7:1;
// - text on a brand-coloured control reaches at least 4.5:1;
// - a --cyan background carries --ink, never white.
// Which bar a background is held to is decided once per token, in TOKEN_KINDS below. A background
// that is no token's colour is held to 7:1, so an unplanned colour fails toward the stricter bar.
//
// The ratio is WCAG 2.2's (relative luminance, sRGB). It is computed here rather than read from
// axe, which reports it truncated to two decimals. The rule compares the exact value; a message
// prints it truncated the same way, so its number is the one axe shows (6.96 for ink on cyan, whose
// exact ratio is 6.968).
import postcss from 'postcss'

export const PALE_RATIO = 7
export const CONTROL_RATIO = 4.5

// pale: paper and pale backgrounds (7:1). control: brand-coloured controls (4.5:1). text: a text
// colour that is not a background, so a rule using it as one is refused.
export type TokenKind = 'pale' | 'control' | 'text'

// Every colour token in src/index.css. A token missing here, or listed here and gone from the CSS,
// fails the token test: a new colour does not ship until someone decides which bar it is held to.
export const TOKEN_KINDS: Readonly<Record<string, TokenKind>> = {
  '--paper': 'pale',
  '--cyan-pale': 'pale',
  '--cyan': 'control',
  '--cyan-deep': 'control',
  '--red': 'control',
  '--red-dark': 'control',
  '--navy': 'control',
  '--navy-deep': 'control',
  '--ink': 'text',
}

// A colour token's name and its #rrggbb value, lower case.
export type Tokens = ReadonlyMap<string, string>

function channel(hex: string, at: number): number {
  const c = parseInt(hex.slice(at, at + 2), 16) / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
}

// WCAG contrast of two #rrggbb colours, from 1 to 21.
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// A ratio as axe prints it: truncated, never rounded up, so 6.996 is "6.99" and not "7.00".
export function formatRatio(ratio: number): string {
  return (Math.floor(ratio * 100) / 100).toFixed(2)
}

// #rgb or #rrggbb, lower-cased to #rrggbb. Anything else, alpha included, is undefined.
export function normaliseHex(value: string): string | undefined {
  const v = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join('')}`
  return undefined
}

const COLOUR_FUNCTION = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i

// The colour tokens declared in a stylesheet's :root, and what could not be read as one. A token
// written as anything but hex is refused rather than skipped, so it cannot escape classification.
export function readColourTokens(css: string): { tokens: Tokens; problems: string[] } {
  const tokens = new Map<string, string>()
  const problems: string[] = []
  postcss.parse(css).walkRules(':root', (rule) => {
    rule.walkDecls(/^--/, (decl) => {
      const hex = normaliseHex(decl.value)
      if (hex) tokens.set(decl.prop, hex)
      else if (COLOUR_FUNCTION.test(decl.value.trim()) || /^#/.test(decl.value.trim()))
        problems.push(`${decl.prop}: write the colour as #rrggbb, not "${decl.value}"`)
    })
  })
  return { tokens, problems }
}

// Tokens with no kind, and kinds with no token.
export function classificationProblems(tokens: Tokens): string[] {
  const problems: string[] = []
  for (const name of tokens.keys()) {
    if (!(name in TOKEN_KINDS))
      problems.push(`${name} is not classified pale, control or text in TOKEN_KINDS`)
  }
  for (const name of Object.keys(TOKEN_KINDS)) {
    if (!tokens.has(name)) problems.push(`TOKEN_KINDS lists ${name}, which src/index.css no longer declares`)
  }
  return problems
}

function tokenOf(hex: string, tokens: Tokens): string | undefined {
  for (const [name, value] of tokens) if (value === hex) return name
  return undefined
}

// A colour named for a message: the token and its value, or the bare value.
export function nameColour(hex: string, tokens: Tokens): string {
  const token = tokenOf(hex, tokens)
  return token ? `${token} (${hex})` : hex
}

// The bar text on this background is held to, and the words for it.
export function requiredRatio(backgroundHex: string, tokens: Tokens): { ratio: number; on: string } {
  const token = tokenOf(backgroundHex, tokens)
  return token && TOKEN_KINDS[token] === 'control'
    ? { ratio: CONTROL_RATIO, on: 'a brand-coloured control' }
    : { ratio: PALE_RATIO, on: 'paper and pale backgrounds' }
}

// The glare rule for one text colour on one background, as problems; none means it passes.
export function glareProblems(textHex: string, backgroundHex: string, tokens: Tokens): string[] {
  const problems: string[] = []
  const text = nameColour(textHex, tokens)
  const background = nameColour(backgroundHex, tokens)
  const ratio = contrastRatio(textHex, backgroundHex)
  const required = requiredRatio(backgroundHex, tokens)
  if (ratio < required.ratio) {
    problems.push(
      `${text} on ${background} is ${formatRatio(ratio)}:1, under ${required.ratio}:1 for text on ${required.on}`,
    )
  }
  const cyan = tokens.get('--cyan')
  const ink = tokens.get('--ink')
  if (cyan && backgroundHex === cyan && textHex !== ink) {
    problems.push(`--cyan must carry --ink${ink ? ` (${ink})` : ''}, not ${text}`)
  }
  return problems
}

// Keywords that declare no colour of their own: the rule then declares no pair.
const NOT_A_COLOUR = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'currentcolor',
  'transparent',
  'none',
])

type Resolved = { hex: string } | { none: true } | { problem: string }

function resolveColour(value: string, tokens: Tokens): Resolved {
  const v = value.trim().toLowerCase()
  const variable = /^var\(\s*(--[a-z0-9-]+)\s*(,[^)]*)?\)$/.exec(v)
  if (variable) {
    const name = variable[1] as string
    const hex = tokens.get(name)
    return hex ? { hex } : { problem: `${name} is not a colour token in src/index.css` }
  }
  if (v === 'white') return { hex: '#ffffff' }
  if (v === 'black') return { hex: '#000000' }
  const hex = normaliseHex(v)
  if (hex) return { hex }
  if (NOT_A_COLOUR.has(v)) return { none: true }
  return { problem: `cannot read one colour from "${value}"; use a token` }
}

export interface CssSource {
  file: string
  css: string
}

// Every text-on-background pair the stylesheets declare, held to the glare rule. A pair is a rule
// that sets both a text colour and a background. A rule that sets only one leaves its pair to
// inheritance, which only a rendered screen shows; the screen helper checks that half.
export function checkDeclaredPairs(
  sources: CssSource[],
  tokens: Tokens,
): { pairs: number; problems: string[] } {
  let pairs = 0
  const problems: string[] = []
  const cyan = tokens.get('--cyan')
  for (const { file, css } of sources) {
    postcss.parse(css).walkRules((rule) => {
      let color: string | undefined
      let background: string | undefined
      rule.each((node) => {
        if (node.type !== 'decl') return
        if (node.prop === 'color') color = node.value
        if (node.prop === 'background' || node.prop === 'background-color') background = node.value
      })
      const where = `${file} ${rule.selector}`
      const text = color === undefined ? undefined : resolveColour(color, tokens)
      const back = background === undefined ? undefined : resolveColour(background, tokens)
      for (const r of [text, back]) if (r && 'problem' in r) problems.push(`${where}: ${r.problem}`)
      if (!back || !('hex' in back)) return
      const backToken = tokenOf(back.hex, tokens)
      if (backToken && TOKEN_KINDS[backToken] === 'text') {
        problems.push(`${where}: ${backToken} is a text colour, not a background`)
        return
      }
      if (!text || !('hex' in text)) {
        if (back.hex === cyan) problems.push(`${where}: a --cyan background must declare color: var(--ink)`)
        return
      }
      pairs += 1
      for (const p of glareProblems(text.hex, back.hex, tokens)) problems.push(`${where}: ${p}`)
    })
  }
  return { pairs, problems }
}
