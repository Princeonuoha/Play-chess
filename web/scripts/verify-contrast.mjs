#!/usr/bin/env node
/* ---------------------------------------------------------------------------
 * DESIGN.md §8.6 contrast gate (plan todo 9; ink audit added in todo 24).
 *
 * Re-computes every documented text/background pair from the tokens actually
 * declared in `web/src/index.css` — not from the numbers written in DESIGN.md —
 * and fails when a pair drops below its documented floor or drifts away from
 * its documented measurement. It additionally measures the five review-grade
 * inks introduced in `StudyPanel`, whose backgrounds are the same status token
 * composited at 20% over `--surface-1`.
 *
 * THE INK AUDIT (todo 24). The seven documented pairs are hand-picked, so the
 * gate used to be blind to anything nobody thought to write down: a token could
 * be used as text ink on a surface it had never been measured against and the
 * script would still report PASS. `--status-critical` did exactly that — it was
 * `color:` in seven places and measured 3.37:1 on `--surface-1`, well under the
 * AA normal-text floor, while this script reported twelve green pairs.
 *
 * So the ink list is no longer authored: §"ink discovery" below reads every
 * `color:` declaration in every `web/src` CSS file and every `text-[color:…]`
 * arbitrary value in every `web/src` TSX file, and each discovered ink is measured
 * against EVERY backdrop it can actually render on. An ink with no entry in
 * `INK_SCOPES` is itself a failure ("unmapped ink"), so adding a new text
 * colour to the product forces its backdrops to be declared and measured
 * rather than silently skipped.
 *
 * Backdrop sets are grounded in a real-browser sweep of all four routes at
 * 390x844 and 1280x900 (`.omo/evidence/.../contrast-fix/ink-sweep.mjs`), which
 * enumerated every rendered text node's used colour and its composited
 * backdrop. They are a superset of what that sweep observed, never a subset.
 *
 * Usage: node scripts/verify-contrast.mjs [--json]
 * ------------------------------------------------------------------------- */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('../', import.meta.url))
const DESIGN = readFileSync(`${WEB}../DESIGN.md`, 'utf8')
const INDEX_CSS = readFileSync(`${WEB}src/index.css`, 'utf8')
/**
 * The hard gate is the floor. DESIGN.md additionally publishes an authored,
 * rounded measurement per pair; the shipped tokens must be at least that good,
 * allowing a rounding margin. A token edited to something dimmer therefore
 * fails even while it still clears the floor.
 */
const OPTIMISM_MARGIN = 0.5

/* ---- colour maths ------------------------------------------------------ */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(v * 255)))
}

function rgbToOklab([R, G, B]) {
  const [r, g, b] = [R, G, B].map((v) => toLinear(v / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ]
}

const relativeLuminance = ([r, g, b]) => {
  const [R, G, B] = [r, g, b].map((v) => toLinear(v / 255))
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

const contrast = (fg, bg) => {
  const [hi, lo] = [relativeLuminance(fg), relativeLuminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

const composite = ({ rgb, alpha }, backdrop) => rgb.map((v, i) => Math.round(v * alpha + backdrop[i] * (1 - alpha)))

/* ---- token resolution -------------------------------------------------- */
const theme = INDEX_CSS.match(/@theme\s+static\s*\{([\s\S]*?)\n\}/)
if (!theme) throw new Error('index.css no longer declares an `@theme static` block')
const TOKENS = new Map(
  [...theme[1].replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
)

const parseHex = (hex) => {
  const raw = hex.slice(1)
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw
  return { rgb: [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)), alpha: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1 }
}

/** Resolves a token name or CSS colour expression to `{ rgb, alpha }`. */
function resolve(expression, seen = new Set()) {
  const value = expression.trim()

  if (value.startsWith('--')) {
    if (seen.has(value)) throw new Error(`token cycle at ${value}`)
    const declared = TOKENS.get(value)
    if (!declared) throw new Error(`index.css declares no ${value}`)
    return resolve(declared, new Set([...seen, value]))
  }
  const reference = value.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/)
  if (reference) return resolve(reference[1], seen)

  if (value === 'transparent') return { rgb: [0, 0, 0], alpha: 0 }
  if (value.startsWith('#')) return parseHex(value)

  const rgba = value.match(/^rgba?\(([^)]+)\)$/)
  if (rgba) {
    const parts = rgba[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 }
  }

  const mix = value.match(/^color-mix\(\s*in\s+oklab\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+?)\s*\)$/)
  if (mix) {
    const weight = Number(mix[2]) / 100
    const a = resolve(mix[1], seen)
    const b = resolve(mix[3], seen)
    const alpha = a.alpha * weight + b.alpha * (1 - weight)
    if (alpha === 0) return { rgb: [0, 0, 0], alpha: 0 }
    const [la, lb] = [rgbToOklab(a.rgb), rgbToOklab(b.rgb)]
    return { rgb: oklabToRgb(la.map((v, i) => v * weight + lb[i] * (1 - weight))), alpha }
  }

  throw new Error(`cannot resolve colour expression: ${value}`)
}

/** Flattens a possibly-translucent token onto an opaque backdrop. */
const flatten = (expression, backdrop) => {
  const colour = resolve(expression)
  return colour.alpha === 1 ? colour.rgb : composite(colour, backdrop)
}

/* ---- pairs ------------------------------------------------------------- */
const section = DESIGN.slice(DESIGN.indexOf('### 8.6 '))
const documented = [...section.slice(0, section.indexOf('\n### ')).matchAll(
  /^\|\s*`(--[a-z0-9-]+)`\s+on\s+`(--[a-z0-9-]+)`\s*\|\s*([\d.]+):1\s*\|\s*≥([\d.]+):1/gm,
)].map((row) => ({
  name: `${row[1]} on ${row[2]}`,
  foreground: row[1],
  background: row[2],
  documented: Number(row[3]),
  floor: Number(row[4]),
}))

if (documented.length < 7) throw new Error(`DESIGN.md 8.6 yielded only ${documented.length} pairs`)

/** StudyPanel grade ink: the status token lifted toward --text-primary, on its own 20% fill. */
const GRADE_INK = (grade) => `color-mix(in oklab, var(--status-${grade}) 65%, var(--text-primary))`
const GRADES = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'].map((grade) => ({
  name: `review grade \`${grade}\` ink on --status-${grade}/20 over --surface-1`,
  foreground: GRADE_INK(grade),
  background: `color-mix(in oklab, var(--status-${grade}) 20%, transparent)`,
  floor: 4.5,
}))

/* ---- ink discovery ------------------------------------------------------
 * Which tokens does the product ACTUALLY paint text with? Read it out of the
 * source rather than trusting a list, so a new ink cannot arrive unmeasured.
 * ----------------------------------------------------------------------- */
const sourceFiles = (dir) =>
  readdirSync(`${WEB}${dir}`, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? entry.name === '__tests__'
        ? []
        : sourceFiles(`${dir}/${entry.name}`)
      : /\.(?:tsx|css)$/.test(entry.name)
        ? [`${dir}/${entry.name}`]
        : [],
  )

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ')

/** Tailwind writes arbitrary values with `_` where CSS wants a space. */
const unescapeArbitrary = (value) => value.replace(/_/g, ' ').trim()
/** One key per colour EXPRESSION, so `color-mix(…)` written either way collapses to one ink. */
const inkKey = (expression) => expression.replace(/\s+/g, '').toLowerCase()

/** `color:` only — never `background-color`, `border-*-color`, `caret-color`, … */
const CSS_INK = /(?<![-\w])color\s*:\s*([^;{}]+)[;}]/g
const TSX_INK = /text-\[color:((?:[^[\]]|\[[^\]]*\])+)\]/g
const NOT_A_COLOUR = /^(?:inherit|currentcolor|transparent|unset|initial|revert)$/i

const inkSites = new Map()
for (const file of sourceFiles('src')) {
  const source = stripComments(readFileSync(`${WEB}${file}`, 'utf8'))
  const pattern = file.endsWith('.css') ? CSS_INK : TSX_INK
  for (const match of source.matchAll(pattern)) {
    const expression = unescapeArbitrary(match[1])
    if (NOT_A_COLOUR.test(expression)) continue
    const line = source.slice(0, match.index).split('\n').length
    const entry = inkSites.get(inkKey(expression)) ?? { expression, sites: [] }
    entry.sites.push(`${file}:${line}`)
    inkSites.set(inkKey(expression), entry)
  }
}

/* ---- backdrops ----------------------------------------------------------
 * A backdrop is one opaque base plus the ordered translucent films the cascade
 * stacks on top of it. Modelling the stack (rather than a single layer) is what
 * lets the scopes below say "a hoverable row inside a sunken well", which is
 * the real geometry of every scrolling list in the product.
 * ----------------------------------------------------------------------- */
const BASES = {
  '--canvas-base': 'var(--canvas-base)',
  // `Card` in WorkspaceChrome: --surface-1 at 80% over the canvas. Every panel body sits on it.
  'panel card': 'color-mix(in oklab, var(--surface-1) 80%, transparent)',
  '--surface-1': 'var(--surface-1)',
  '--surface-2': 'var(--surface-2)',
  '--surface-3': 'var(--surface-3)',
  '--surface-overlay': 'var(--surface-overlay)',
  '--brass-base': 'var(--brass-base)',
  '--brass-lift': 'var(--brass-lift)',
  '--board-square-ivory': 'var(--board-square-ivory)',
  '--board-square-green': 'var(--board-square-green)',
}
const FILMS = {
  inset: 'var(--surface-inset)',
  'inset-hover': 'var(--surface-inset-hover)',
  sunken: 'var(--canvas-sunken)',
}

/** Resolves a `{ base, films }` backdrop to the opaque rgb the eye actually sees. */
function backdropOf({ base, films }) {
  let seen = flatten(BASES[base], resolve('--canvas-base').rgb)
  for (const film of films) seen = flatten(FILMS[film] ?? film, seen)
  return seen
}
const describe = ({ base, films }) => (films.length === 0 ? base : `${base} + ${films.join(' + ')}`)

const ALL_BASES = ['--canvas-base', 'panel card', '--surface-1', '--surface-2', '--surface-3', '--surface-overlay']
/** Bases that host hoverable rows DIRECTLY — every such list in the panels sits on the card or --surface-1. */
const ROW_BASES = ['--canvas-base', 'panel card', '--surface-1']
/** A scrolling row list on a raised Surface is a sunken well (the `.ui-control` / `.ui-stateblock` idiom). */
const WELL_BASES = ['--surface-1', '--surface-2', '--surface-3']

const backdrops = (bases, ...filmSets) => bases.flatMap((base) => filmSets.map((films) => ({ base, films })))

/** Panel body ink: any surface, plus inset chips and sunken wells. */
const PANEL = backdrops(ALL_BASES, [], ['inset'], ['sunken'])
/** Ink that also renders inside a hoverable row. */
const PANEL_AND_ROWS = [
  ...PANEL,
  ...backdrops(ROW_BASES, ['inset-hover']),
  ...backdrops(WELL_BASES, ['sunken', 'inset-hover']),
]
/** `--text-primary` labels sit on every hover fill, including inside tone-3 surfaces. */
const EVERYWHERE = [...PANEL_AND_ROWS, ...backdrops(ALL_BASES, ['inset-hover'])]

/* ---- ink scopes ---------------------------------------------------------
 * Every discovered ink must appear here, with the backdrops it can land on.
 * Text floors are 4.5:1; the board coordinates are text too. An ink missing
 * from this map fails the run — that is the blind spot this map closes.
 * ----------------------------------------------------------------------- */
const INK_SCOPES = {
  'var(--text-primary)': EVERYWHERE,
  'var(--text-secondary)': PANEL,
  'var(--text-muted)': PANEL_AND_ROWS,
  'var(--text-link)': PANEL_AND_ROWS,
  'var(--brass-base)': PANEL_AND_ROWS,
  'var(--brass-lift)': PANEL_AND_ROWS,
  'var(--status-positive)': PANEL_AND_ROWS,
  'var(--status-caution)': PANEL_AND_ROWS,
  'var(--status-warning)': PANEL_AND_ROWS,
  'var(--status-info)': PANEL_AND_ROWS,
  // The raw critical red is a NON-text token: 3.37:1 on --surface-1. If it ever
  // returns as `color:` this scope measures it there and the run fails again.
  'var(--status-critical)': PANEL_AND_ROWS,
  'var(--status-critical-ink)': PANEL_AND_ROWS,
  'var(--text-on-brass)': backdrops(['--brass-base', '--brass-lift'], []),
  'var(--board-coord-on-ivory)': backdrops(['--board-square-ivory'], []),
  'var(--board-coord-on-green)': backdrops(['--board-square-green'], []),
}
/** The five review-grade inks render on their own 20% status fill, over any panel base. */
for (const grade of ['best', 'good', 'inaccuracy', 'mistake', 'blunder']) {
  INK_SCOPES[GRADE_INK(grade)] = backdrops(ALL_BASES, [`color-mix(in oklab, var(--status-${grade}) 20%, transparent)`])
}

const SCOPES = new Map(Object.entries(INK_SCOPES).map(([expression, scope]) => [inkKey(expression), scope]))

const CANVAS = resolve('--canvas-base').rgb
const results = []

for (const pair of documented) {
  const backdrop = flatten(pair.background, CANVAS)
  const measured = contrast(flatten(pair.foreground, backdrop), backdrop)
  const advertised = pair.documented - OPTIMISM_MARGIN
  results.push({
    ...pair,
    measured: Number(measured.toFixed(2)),
    pass: measured >= pair.floor && measured >= advertised,
    reason:
      measured < pair.floor
        ? 'below floor'
        : measured < advertised
          ? `worse than the ${pair.documented}:1 DESIGN.md advertises`
          : '',
  })
}

const SURFACE = resolve('--surface-1').rgb
for (const pair of GRADES) {
  const backdrop = flatten(pair.background, SURFACE)
  const measured = contrast(flatten(pair.foreground, backdrop), backdrop)
  results.push({ ...pair, measured: Number(measured.toFixed(2)), pass: measured >= pair.floor, reason: measured >= pair.floor ? '' : 'below floor' })
}

/* ---- the ink audit ------------------------------------------------------
 * Every discovered ink, on every backdrop it can render on, at the AA normal-
 * text floor. Enlarging text to buy the 3:1 large-text exemption is not an
 * escape hatch here: the floor is 4.5:1 for all of it.
 * ----------------------------------------------------------------------- */
const TEXT_FLOOR = 4.5
const unmapped = []

for (const [key, { expression, sites }] of [...inkSites].sort(([a], [b]) => a.localeCompare(b))) {
  const scope = SCOPES.get(key)
  if (scope === undefined) {
    unmapped.push({ expression, sites })
    continue
  }
  for (const backdrop of scope) {
    const seen = backdropOf(backdrop)
    const measured = contrast(flatten(expression, seen), seen)
    results.push({
      name: `ink ${expression} on ${describe(backdrop)}`,
      floor: TEXT_FLOOR,
      measured: Number(measured.toFixed(2)),
      pass: measured >= TEXT_FLOOR,
      reason: measured >= TEXT_FLOOR ? '' : `below the AA text floor — used at ${sites.slice(0, 3).join(', ')}`,
    })
  }
}

for (const { expression, sites } of unmapped) {
  results.push({
    name: `ink ${expression} — UNMAPPED`,
    floor: TEXT_FLOOR,
    measured: 0,
    pass: false,
    reason: `no INK_SCOPES entry, so its backdrops were never measured; used at ${sites.slice(0, 3).join(', ')}`,
  })
}

const failures = results.filter((result) => !result.pass)
const report = {
  optimismMargin: OPTIMISM_MARGIN,
  inks: inkSites.size,
  unmapped: unmapped.length,
  pairs: results.length,
  failures: failures.length,
  results,
}

if (process.argv.includes('--json')) {
  const out = `${WEB}contrast-report.json`
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`contrast: report written to ${out}`)
}

for (const result of results) {
  const flag = result.pass ? 'ok  ' : 'FAIL'
  const expected = result.documented ? ` (DESIGN.md ${result.documented}:1)` : ''
  console.log(`${flag} ${result.measured.toFixed(2)}:1  ≥${result.floor}:1  ${result.name}${expected} ${result.reason}`)
}

if (failures.length) {
  console.error(`\ncontrast: FAIL — ${failures.length} pair(s) below the DESIGN.md 8.6 contract.`)
  process.exit(1)
}
console.log(
  `\ncontrast: PASS — ${results.length} pairs measured from ${'src/index.css'} tokens, ` +
    `covering ${inkSites.size} ink(s) discovered in web/src.`,
)
