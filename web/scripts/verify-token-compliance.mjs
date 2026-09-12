#!/usr/bin/env node
/* ---------------------------------------------------------------------------
 * DESIGN.md token-compliance gate (plan todo 9).
 *
 * Fails the build when product source reaches past `web/src/index.css` for a
 * visual value:
 *
 *   A. a raw colour   — hex, rgb()/hsl()/lab()/lch()/oklch(), or a named
 *                       CSS/Tailwind colour used as a colour
 *   B. a raw type size — a px/rem/em/pt font size that is not a `--type-*` token
 *   C. a raw motion value — a duration or easing literal that is not a
 *                       `--motion-*` token
 *   D. a second token source — any DESIGN.md token declared outside index.css,
 *                       declared twice, or any alias declared alongside them
 *
 * Allowlist (DESIGN.md §2.2 / todo 9 brief):
 *   - `src/core/pieces.ts` — the project's original SVG piece artwork
 *   - generated output (`dist/`, `node_modules/`) is never scanned
 *   - verification code (`tests/`, `__tests__/`) is never scanned: it asserts
 *     on raw values by design
 *   - browser mechanics stay raw: `transparent`, `currentColor`, `none`,
 *     hairline widths, and the `0.01ms` reduced-motion kill switch DESIGN.md
 *     §6.4 specifies verbatim
 *
 * DEFERRALS carries the sub-`--type-label` strings DESIGN.md §3.2 itself
 * defers. Each entry is matched by exact count, so a new violation fails and a
 * fixed one fails too — the list can only shrink.
 *
 * Usage: node scripts/verify-token-compliance.mjs [--json]
 * ------------------------------------------------------------------------- */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('../', import.meta.url))
const DESIGN = readFileSync(`${WEB}../DESIGN.md`, 'utf8')
const AUTHORITY = 'src/index.css'
const ART_ALLOWLIST = ['src/core/pieces.ts']

/** DESIGN.md 3.2 names these as defects and hands them to todos 12-14. */
const DEFERRALS = [
  { file: 'src/index.css', literal: 'font-size: 11.5px', count: 1, owner: 'DESIGN.md 3.2 names `.tr-status .path`; todos 12-14' },
  { file: 'src/panels/StudyPanel.tsx', literal: 'text-[10px]', count: 3, owner: 'DESIGN.md 3.2; todo 17' },
  { file: 'src/panels/StudyPanel.tsx', literal: 'text-[11px]', count: 2, owner: 'DESIGN.md 3.2; todo 17' },
]

const NAMED_COLOURS =
  'white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|silver|gold|navy|olive|maroon|aqua|magenta|brown|beige|ivory|tan'
const COLOUR_UTILITY =
  'bg|text|border|ring|outline|divide|accent|shadow|fill|stroke|from|via|to|decoration|caret|placeholder'

const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/g
const RAW_COLOUR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklch)\s*\(/g
const RAW_COLOUR_UTILITY = new RegExp(`\\b(?:${COLOUR_UTILITY})-(?:${NAMED_COLOURS})\\b`, 'g')
const RAW_TSX_FONT_SIZE = /text-\[(?![a-z-]*:?\s*var\()[^\]]*\d[\d.]*(?:px|rem|em|pt)[^\]]*\]|\bfontSize\s*:/g
const RAW_TSX_MOTION = /\bduration-(?!\[var\()[\w[\].]+|\bease-\[(?!var\()[^\]]*\]|\btransition-duration\s*:/g
const DURATION_LITERAL = /(?<![\w-])\d+(?:\.\d+)?m?s(?![\w-])/
const RAW_LENGTH = /(?<![\w-])\d+(?:\.\d+)?(?:px|rem|em|pt)(?![\w-])/

const walk = (dir) =>
  readdirSync(`${WEB}${dir}`, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(path)
    return /\.(?:ts|tsx|css)$/.test(entry.name) && !ART_ALLOWLIST.includes(path) ? [path] : []
  })

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\w])\/\/[^\n]*/g, '$1')

/** index.css declares the tokens; that block and its one responsive step are the authority. */
const stripAuthority = (css) =>
  css
    .replace(/@theme\s+static\s*\{[\s\S]*?\n\}/, ' ')
    .replace(/@media\s*\(min-width:\s*768px\)\s*\{\s*:root\s*\{[\s\S]*?\}\s*\}/, ' ')

/** DESIGN.md 6.4 specifies the `0.01ms` kill switch verbatim, so it is not a stray literal. */
const stripReducedMotion = (css) =>
  css.replace(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/g, ' ')

const cssDeclarations = (css) =>
  [...css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)[;}]/g)].map((m) => ({
    property: m[1],
    value: m[2].trim(),
    index: m.index,
  }))

/** A token reference is not a literal, so resolve it away before hunting literals. */
const withoutTokens = (value) => value.replace(/var\(\s*--[a-z0-9-]+\s*\)/g, ' ')

const isNamedColour = (value) =>
  withoutTokens(value)
    .split(/[\s,()]+/)
    .some((part) => new RegExp(`^(?:${NAMED_COLOURS})$`, 'i').test(part))

const lineOf = (source, index) => source.slice(0, index).split('\n').length

function documentedTokens() {
  const names = new Set()
  for (const row of DESIGN.matchAll(/^\|\s*`(--[a-z0-9-]+)`\s*\|/gm)) names.add(row[1])
  for (const row of DESIGN.matchAll(/`(--[a-z0-9-]+):\s*[^`]+`/g)) names.add(row[1])
  return names
}

const violations = []
const add = (file, line, rule, detail) => violations.push({ file, line, rule, detail })

for (const file of walk('src')) {
  const original = readFileSync(`${WEB}${file}`, 'utf8')
  const isCss = file.endsWith('.css')
  let source = stripComments(original)
  if (file === AUTHORITY) source = stripAuthority(source)

  const scan = (regex, rule) => {
    for (const match of source.matchAll(regex)) {
      add(file, lineOf(source, match.index), rule, match[0].trim())
    }
  }

  scan(RAW_HEX, 'raw-colour')
  scan(RAW_COLOUR_FN, 'raw-colour')
  scan(RAW_COLOUR_UTILITY, 'raw-colour')

  if (isCss) {
    const motionSource = stripReducedMotion(source)
    for (const { property, value, index } of cssDeclarations(source)) {
      if (/^font(-size)?$/.test(property) && !value.includes('var(--type-') && RAW_LENGTH.test(value)) {
        add(file, lineOf(source, index), 'raw-type-size', `${property}: ${value}`)
      }
      if (isNamedColour(value)) {
        add(file, lineOf(source, index), 'raw-colour', `${property}: ${value}`)
      }
    }
    const MOTION_PROPERTY =
      /^(?:transition|transition-duration|transition-timing-function|animation|animation-duration|animation-timing-function)$/
    for (const { property, value, index } of cssDeclarations(motionSource)) {
      if (!MOTION_PROPERTY.test(property)) continue
      const literal = withoutTokens(value)
      if (DURATION_LITERAL.test(literal) || /cubic-bezier\s*\(/.test(literal) || /\bease(?:-in|-out|-in-out)?\b/.test(literal)) {
        add(file, lineOf(motionSource, index), 'raw-motion', `${property}: ${value.replace(/\s+/g, ' ')}`)
      }
    }
  } else {
    scan(RAW_TSX_FONT_SIZE, 'raw-type-size')
    scan(RAW_TSX_MOTION, 'raw-motion')
  }
}

/* ---- D. one token authority ------------------------------------------- */
const documented = documentedTokens()
const declarations = new Map()
for (const file of walk('src').filter((path) => path.endsWith('.css'))) {
  const css = stripComments(readFileSync(`${WEB}${file}`, 'utf8'))
  for (const match of css.matchAll(/(?:^|[;{])\s*(--[a-z0-9-]+)\s*:\s*[^;{}]+;/gm)) {
    const sites = declarations.get(match[1]) ?? []
    sites.push({ file, line: lineOf(css, match.index) })
    declarations.set(match[1], sites)
  }
}
for (const [token, sites] of declarations) {
  const permitted = token === '--type-display' ? 2 : 1
  const authored = sites.filter((site) => site.file === AUTHORITY)
  if (authored.length && !documented.has(token)) {
    add(AUTHORITY, authored[0].line, 'undocumented-token', `${token} is an alias — DESIGN.md declares no such token`)
  }
  if (!documented.has(token)) continue
  for (const site of sites.filter((s) => s.file !== AUTHORITY)) {
    add(site.file, site.line, 'second-token-source', `${token} must be declared only in ${AUTHORITY}`)
  }
  if (sites.length > permitted) {
    add(sites[0].file, sites[0].line, 'duplicate-token', `${token} declared ${sites.length}x (max ${permitted})`)
  }
}
for (const token of documented) {
  if (!declarations.has(token)) add(AUTHORITY, 0, 'missing-token', `${token} is documented but never declared`)
}

/* ---- deferrals: exact-count, so the list can only shrink --------------- */
const deferred = []
for (const entry of DEFERRALS) {
  const matches = violations.filter((v) => v.file === entry.file && v.detail === entry.literal)
  if (matches.length !== entry.count) {
    add(entry.file, 0, 'stale-deferral', `expected ${entry.count}x \`${entry.literal}\`, found ${matches.length}`)
    continue
  }
  for (const match of matches) {
    violations.splice(violations.indexOf(match), 1)
    deferred.push({ ...match, owner: entry.owner })
  }
}

const report = {
  authority: AUTHORITY,
  scanned: walk('src').length,
  tokensDocumented: documented.size,
  tokensDeclared: declarations.size,
  deferred: deferred.length,
  violations,
}

if (process.argv.includes('--json')) {
  const out = `${WEB}token-compliance.json`
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`token-compliance: report written to ${out}`)
}

for (const v of violations) console.error(`${v.file}:${v.line}  [${v.rule}]  ${v.detail}`)
if (violations.length) {
  console.error(`\ntoken-compliance: FAIL — ${violations.length} violation(s).`)
  process.exit(1)
}
console.log(
  `token-compliance: PASS — ${report.scanned} files, ${report.tokensDeclared}/${report.tokensDocumented} DESIGN.md tokens declared once in ${AUTHORITY}, ${report.deferred} documented deferral(s).`,
)
