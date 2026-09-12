#!/usr/bin/env node
/* ---------------------------------------------------------------------------
 * DESIGN.md Section 5 icon gate (plan todo 10).
 *
 * Fails the build when the product surface reaches outside the one icon family
 * declared in `web/src/ui/icons.tsx`:
 *
 *   A. structural glyph      — an emoji, transport control, arrow, chevron, or
 *                              geometric shape character used as interface
 *                              furniture (DESIGN.md 5.2). The three domain
 *                              glyphs DESIGN.md 5.4 documents are allowed and
 *                              nothing else is.
 *   B. glyph-only control    — a `<button>` whose entire visible content is a
 *                              punctuation or symbol character, e.g. the old
 *                              help `?`
 *   C. stray icon source     — an `<svg>`, `viewBox`, or stroke width authored
 *                              outside the icon module
 *   D. mixed stroke          — any stroke width that is not `var(--icon-stroke)`
 *   E. mixed geometry        — any icon `viewBox` other than the family grid
 *   F. mixed size            — any icon size that is not an `--icon-size-*`
 *                              token reference
 *   G. unnamed icon control  — a control with no visible text and no
 *                              `aria-label` (DESIGN.md 5.2), or one that skips
 *                              the `--icon-target-min` hit-area floor
 *   H. module contract       — the family's shared `<svg>` attributes
 *
 * Scope is the shipped product surface. `src/dev/**` is excluded: it is the
 * dev-only DESIGN.md 7.3 showcase, reachable only through `showcase.html`,
 * which `vite build` never bundles (the build input is `index.html` alone), so
 * its stand-in primitives are not a second product icon family. `__tests__` and
 * `tests/` are excluded because verification code asserts on raw values by
 * design, and `src/core/pieces.ts` is allowlisted as the project's original
 * board artwork exactly as the token gate allowlists it.
 *
 * Usage: node scripts/verify-icons.mjs [--json]
 * ------------------------------------------------------------------------- */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('../', import.meta.url))
const MODULE = 'src/ui/icons.tsx'
const ART_ALLOWLIST = ['src/core/pieces.ts']
const EXCLUDED_DIRS = new Set(['dev', '__tests__'])

const FAMILY_VIEWBOX = '0 0 24 24'
const STROKE_TOKEN = 'var(--icon-stroke)'
const SIZE_TOKENS = ['var(--icon-size-sm)', 'var(--icon-size-md)', 'var(--icon-size-lg)']
const TARGET_TOKEN = 'var(--icon-target-min)'

/**
 * Ranges are written as code points, never as literal characters, so this gate
 * can never be defeated by the very glyphs it bans appearing in its own source.
 */
const BANNED_RANGES = [
  [0x2039, 0x203a], // single angle quotation marks used as chevrons
  [0x00ab, 0x00ab], // guillemets, likewise
  [0x00bb, 0x00bb],
  [0x2190, 0x21ff], // arrows
  [0x2300, 0x23ff], // misc technical, incl. the transport controls U+23E9-U+23FA
  [0x25a0, 0x25ff], // geometric shapes: squares, triangles, the play caret
  [0x2600, 0x27bf], // misc symbols (chess pieces, stars) and dingbats
  [0x2b00, 0x2bff], // misc symbols and arrows
  [0xfe0f, 0xfe0f], // emoji variation selector
  [0x200d, 0x200d], // zero-width joiner (emoji sequences)
  [0x1f000, 0x1faff], // emoji planes
]

/** DESIGN.md 5.4: the documented chess-annotation exception, and nothing else. */
const DOMAIN_GLYPHS = new Map([
  [0x2605, 'grade badge: Best'],
  [0x2713, 'grade badge / book move: Good'],
  [0x2717, 'off-book move mark'],
])

const isBanned = (code) => BANNED_RANGES.some(([lo, hi]) => code >= lo && code <= hi)

const walk = (dir) =>
  readdirSync(`${WEB}${dir}`, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return EXCLUDED_DIRS.has(entry.name) ? [] : walk(path)
    return /\.(?:ts|tsx|css)$/.test(entry.name) ? [path] : []
  })

const files = [...walk('src'), 'index.html']
const violations = []
const add = (file, line, rule, detail) => violations.push({ file, line, rule, detail })
const lineOf = (source, index) => source.slice(0, index).split('\n').length

/** JSX expressions first, then tags: `() =>` inside an attribute otherwise ends the tag early. */
function literalText(block) {
  let depth = 0
  let stripped = ''
  for (const char of block) {
    if (char === '{') depth++
    else if (char === '}') depth = Math.max(0, depth - 1)
    else if (depth === 0) stripped += char
  }
  return stripped.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Splits a `<button>` block into its opening tag and its children. Attribute
 * expressions hold both `>` (from `=>`) and text, so a brace-depth scan is the
 * only way to tell an attribute apart from a child.
 */
function buttonChildren(block) {
  let depth = 0
  for (let i = 0; i < block.length; i++) {
    const char = block[i]
    if (char === '{') depth++
    else if (char === '}') depth--
    else if (char === '>' && depth === 0) return block.slice(i + 1).replace(/<\/button>\s*$/, '')
  }
  return ''
}

/** Comments describe the code; only rendered source is interface furniture. */
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\w])\/\/[^\n]*/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, ' ')

const GLYPH_ONLY = /^[\p{P}\p{S}]{1,3}$/u
const strokeValues = new Map()
const viewBoxValues = new Map()

for (const file of files) {
  const source = stripComments(readFileSync(`${WEB}${file}`, 'utf8'))
  const artwork = ART_ALLOWLIST.includes(file)

  /* ---- A. structural glyphs ------------------------------------------- */
  for (let i = 0; i < source.length; i++) {
    const code = source.codePointAt(i)
    if (code > 0xffff) i++
    if (!isBanned(code) || DOMAIN_GLYPHS.has(code)) continue
    add(file, lineOf(source, i), 'structural-glyph', `U+${code.toString(16).toUpperCase().padStart(4, '0')}`)
  }

  /* ---- B + G. controls ------------------------------------------------- */
  for (const match of source.matchAll(/<button\b[\s\S]*?<\/button>|<button\b[^>]*\/>/g)) {
    const block = match[0]
    const line = lineOf(source, match.index)
    const children = buttonChildren(block)
    const text = literalText(children)
    if (GLYPH_ONLY.test(text)) {
      add(file, line, 'glyph-only-control', `visible content is \`${text}\` — use an <Icon>`)
      continue
    }
    if (text || /\{/.test(children)) continue
    if (!/aria-label[=\s]/.test(block)) add(file, line, 'unnamed-icon-control', 'icon-only <button> without aria-label')
    if (!block.includes(TARGET_TOKEN)) {
      add(file, line, 'unnamed-icon-control', `icon-only <button> without a ${TARGET_TOKEN} hit area`)
    }
  }

  /* ---- C. one icon source --------------------------------------------- */
  if (file !== MODULE && !artwork) {
    for (const match of source.matchAll(/<svg\b|viewBox|strokeWidth|stroke-width/g)) {
      add(file, lineOf(source, match.index), 'stray-icon-source', `\`${match[0]}\` belongs in ${MODULE}`)
    }
  }

  /* ---- D + E. one stroke, one grid ------------------------------------ */
  if (artwork) continue
  for (const match of source.matchAll(/stroke-?[Ww]idth\s*[:=]\s*(?:\{\s*)?['"]?([^,'"`}\s/>]+)/g)) {
    strokeValues.set(match[1], `${file}:${lineOf(source, match.index)}`)
  }
  for (const match of source.matchAll(/viewBox\s*=\s*["']([^"']+)["']/g)) {
    viewBoxValues.set(match[1], `${file}:${lineOf(source, match.index)}`)
  }
}

for (const [value, site] of strokeValues) {
  if (value !== STROKE_TOKEN) add(...site.split(':'), 'mixed-stroke', `stroke width \`${value}\` is not ${STROKE_TOKEN}`)
}
for (const [value, site] of viewBoxValues) {
  if (value !== FAMILY_VIEWBOX) add(...site.split(':'), 'mixed-geometry', `viewBox \`${value}\` is not the family grid`)
}

/* ---- F + H. the module's own contract --------------------------------- */
const moduleSource = stripComments(readFileSync(`${WEB}${MODULE}`, 'utf8'))
const openingTag = moduleSource.match(/<svg[\s\S]*?>/)?.[0] ?? ''
const REQUIRED_ATTRS = ['viewBox="0 0 24 24"', 'fill="none"', 'stroke="currentColor"', `strokeWidth: '${STROKE_TOKEN}'`]
for (const attr of REQUIRED_ATTRS) {
  if (!openingTag.includes(attr)) add(MODULE, lineOf(moduleSource, moduleSource.indexOf('<svg')), 'module-contract', `the family <svg> must declare ${attr}`)
}
for (const match of moduleSource.matchAll(/(?:width|height):\s*(?:SIZE_TOKEN\[[^\]]+\]|'([^']+)')/g)) {
  if (match[1] && !SIZE_TOKENS.includes(match[1])) add(MODULE, lineOf(moduleSource, match.index), 'mixed-size', `icon size \`${match[1]}\` is not an --icon-size-* token`)
}
for (const match of moduleSource.matchAll(/sm:\s*'([^']+)',\s*md:\s*'([^']+)',\s*lg:\s*'([^']+)'/g)) {
  const declared = [match[1], match[2], match[3]]
  if (declared.join('|') !== SIZE_TOKENS.join('|')) {
    add(MODULE, lineOf(moduleSource, match.index), 'mixed-size', `the size scale is \`${declared.join(', ')}\``)
  }
}
for (const match of moduleSource.matchAll(/className={?['"`][^'"`]*\b(?:h|w|size)-(?!\[var\()[\w[\].]+/g)) {
  add(MODULE, lineOf(moduleSource, match.index), 'mixed-size', `\`${match[0].split(/['"`]/).pop()}\` sizes an icon outside the token scale`)
}

const artworkBlock = moduleSource.match(/const ICON_ARTWORK = \{[\s\S]*?\n\} as const/)?.[0] ?? ''
const iconNames = [...artworkBlock.matchAll(/^ {2}'?([a-z][a-z-]*)'?:/gm)].map((m) => m[1])
if (iconNames.length === 0) add(MODULE, 1, 'module-contract', 'ICON_ARTWORK declares no icons')
const report = {
  module: MODULE,
  scanned: files.length,
  icons: iconNames.length,
  strokeWidths: [...strokeValues.keys()],
  viewBoxes: [...viewBoxValues.keys()],
  domainGlyphsAllowed: [...DOMAIN_GLYPHS.entries()].map(([code, why]) => `U+${code.toString(16).toUpperCase()} (${why})`),
  violations,
}

if (process.argv.includes('--json')) {
  const out = `${WEB}icon-audit.json`
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`verify-icons: report written to ${out}`)
}

for (const v of violations) console.error(`${v.file}:${v.line}  [${v.rule}]  ${v.detail}`)
if (violations.length) {
  console.error(`\nverify-icons: FAIL — ${violations.length} violation(s).`)
  process.exit(1)
}
console.log(
  `verify-icons: PASS — ${report.scanned} files, ${report.icons} icons from ${MODULE}, ` +
    `stroke ${report.strokeWidths.join('/') || 'none'}, grid ${report.viewBoxes.join('/') || 'none'}, ` +
    `${report.domainGlyphsAllowed.length} documented DESIGN.md 5.4 glyph(s).`,
)
