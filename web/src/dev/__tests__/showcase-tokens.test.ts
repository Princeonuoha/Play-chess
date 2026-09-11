/* ---------------------------------------------------------------------------
 * The gate `showcase-tokens.css` and `showcase.css` promise in their headers.
 *
 * 1. Drift: every token in the dev token bridge is transcribed verbatim from
 *    the DESIGN.md tables, and the bridge invents nothing DESIGN.md does not
 *    declare.
 * 2. Raw values: `showcase.css` declares no colour, no font size, and no
 *    margin/padding/gap that is not a DESIGN.md token.
 * 3. Production leak: the committed build carries no showcase identifier.
 * ------------------------------------------------------------------------- */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

const DESIGN = read('../../../../DESIGN.md')
const TOKENS_CSS = read('../showcase-tokens.css')
const SHOWCASE_CSS = read('../showcase.css')
const DIST = fileURLToPath(new URL('../../../../dist/', import.meta.url))

/** Whitespace is not semantic in any token value here, so `rgba(0,0,0,.25)` and `rgba(0, 0, 0, .25)` compare equal. */
const normalise = (value: string): string => value.replace(/\s+/g, '').toLowerCase()

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** DESIGN.md is written as `### <number> — <title>`; token tables are read per section. */
function designSection(number: string): string {
  const start = DESIGN.indexOf(`### ${number} `)
  if (start === -1) throw new Error(`DESIGN.md is missing section ${number}`)
  const next = DESIGN.indexOf('\n### ', start + 1)
  const end = DESIGN.indexOf('\n## ', start + 1)
  const stop = [next, end].filter((index) => index !== -1).sort((a, b) => a - b)[0] ?? DESIGN.length
  return DESIGN.slice(start, stop)
}

/** Sections whose tables are plain `| \`--token\` | \`value\` | … |` rows. */
const VALUE_TABLE_SECTIONS = [
  '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8',
  '3.1', '4.1', '4.2', '4.4', '5.1', '6.1',
] as const

function documentedTokens(): Map<string, string> {
  const tokens = new Map<string, string>()

  for (const section of VALUE_TABLE_SECTIONS) {
    for (const row of designSection(section).matchAll(/^\|\s*`(--[a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|/gm)) {
      tokens.set(row[1], row[2])
    }
  }

  // 3.2 splits one CSS `font` shorthand across a size/line-height, a weight, and
  // a tracking column, so the expected value is assembled rather than read.
  for (const row of designSection('3.2').matchAll(/^\|\s*`(--type-[a-z-]+)`\s*\|([^|]+)\|\s*(\d{3})\s*\|/gm)) {
    const [token, sizeCell, weight] = [row[1], row[2], row[3]]
    const sizes = [...sizeCell.matchAll(/`([^`]+)`/g)].map((match) => match[1])
    const [size, lineHeight] = sizes[0].split('/').map((part) => part.trim())
    const family = token === '--type-numeric' ? 'var(--type-font-numeric)' : 'var(--type-font-ui)'
    tokens.set(token, `${weight} ${size}/${lineHeight} ${family}`)
  }

  const measure = designSection('3.3').match(/`(--type-measure):\s*([^`]+)`/)
  if (!measure) throw new Error('DESIGN.md 3.3 no longer declares --type-measure')
  tokens.set(measure[1], measure[2])

  return tokens
}

function declaredTokens(css: string): Map<string, string> {
  const block = stripComments(css).match(/:root\s*\{([\s\S]*?)\n\}/)
  if (!block) throw new Error('showcase-tokens.css no longer declares a :root block')
  const tokens = new Map<string, string>()
  for (const declaration of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(declaration[1], declaration[2].trim())
  }
  return tokens
}

/** Every `property: value` pair in the file, with selectors and at-rule preludes ignored. */
function declarations(css: string): readonly (readonly [string, string])[] {
  return [...stripComments(css).matchAll(/([a-z-]+)\s*:\s*([^;{}]+)[;}]/g)].map(
    (match) => [match[1], match[2].trim()] as const,
  )
}

const RAW_COLOUR = [
  /#[0-9a-f]{3,8}\b/i,
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\s*\(/i,
  /\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|navy|teal|olive|maroon|lime|aqua|fuchsia|cyan|magenta|brown|beige|ivory|tan)\b/i,
]

const SPACING_PROPERTY = /^(?:margin|padding|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?$/
const RAW_LENGTH = /\d+(?:\.\d+)?(?:px|rem|em|ch|vw|vh|%)/

describe('showcase token bridge tracks DESIGN.md', () => {
  const documented = documentedTokens()
  const declared = declaredTokens(TOKENS_CSS)

  it('reads a non-trivial number of tokens out of DESIGN.md', () => {
    expect(documented.size).toBeGreaterThan(60)
  })

  it('declares every token DESIGN.md documents', () => {
    const missing = [...documented.keys()].filter((token) => !declared.has(token))
    expect(missing).toEqual([])
  })

  it('declares no token DESIGN.md does not document', () => {
    const undeclared = [...declared.keys()].filter((token) => !documented.has(token))
    expect(undeclared).toEqual([])
  })

  it.each([...documented].map(([token, value]) => ({ token, value })))(
    '$token matches DESIGN.md verbatim',
    ({ token, value }) => {
      expect(normalise(declared.get(token) ?? '<missing>')).toBe(normalise(value))
    },
  )

  it('grows the wordmark step at the 768px breakpoint DESIGN.md 3.2 documents', () => {
    const breakpointSize = designSection('3.2').match(/`--type-display`[^|]*\|[^|]*`([0-9.]+rem)`\s*≥768px/)
    if (!breakpointSize) throw new Error('DESIGN.md 3.2 no longer documents a ≥768px display size')
    const override = stripComments(TOKENS_CSS).match(/@media\s*\(min-width:\s*768px\)\s*\{[\s\S]*?:root\s*\{([\s\S]*?)\}/)
    if (!override) throw new Error('showcase-tokens.css no longer declares the 768px :root override')
    expect(normalise(override[1])).toContain(normalise(`--type-display: 800 ${breakpointSize[1]}/1.15 var(--type-font-ui)`))
  })
})

describe('showcase.css resolves every value to a token', () => {
  const pairs = declarations(SHOWCASE_CSS)

  it('parses the stylesheet it is asserting on', () => {
    expect(pairs.length).toBeGreaterThan(100)
  })

  it('declares no raw colour', () => {
    const offenders = pairs.filter(([, value]) => RAW_COLOUR.some((pattern) => pattern.test(value)))
    expect(offenders).toEqual([])
  })

  it('declares no raw font size', () => {
    const offenders = pairs.filter(([property, value]) => /^font(-size)?$/.test(property) && !value.includes('var(--type-'))
    expect(offenders).toEqual([])
  })

  it('declares no raw margin, padding, or gap', () => {
    const offenders = pairs.filter(([property, value]) => SPACING_PROPERTY.test(property) && RAW_LENGTH.test(value))
    expect(offenders).toEqual([])
  })
})

describe('the showcase stays out of the production build', () => {
  const LEAKED_IDENTIFIERS = [
    'showcase',
    'sc-root',
    'sc-cell',
    'sc-iconbtn',
    'sc-statusnote-scaffold',
    'useControlGroups',
    'useFeedbackGroups',
    'Primitive showcase',
    'Tab from here',
    'PENDING todo 11',
  ]

  function distFiles(directory: string): readonly string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = `${directory}${entry.name}`
      if (entry.isDirectory()) return distFiles(`${path}/`)
      return /\.(js|css|html)$/.test(entry.name) ? [path] : []
    })
  }

  it('has a committed build to assert against', () => {
    expect(existsSync(DIST)).toBe(true)
  })

  it('emits no showcase.html', () => {
    expect(existsSync(`${DIST}showcase.html`)).toBe(false)
  })

  it('ships no showcase identifier in any built asset', () => {
    const leaks = distFiles(DIST).flatMap((path) => {
      const contents = readFileSync(path, 'utf8')
      return LEAKED_IDENTIFIERS.filter((identifier) => contents.includes(identifier)).map(
        (identifier) => `${path.slice(DIST.length)}: ${identifier}`,
      )
    })
    expect(leaks).toEqual([])
  })
})
