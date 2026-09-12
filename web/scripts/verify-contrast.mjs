#!/usr/bin/env node
/* ---------------------------------------------------------------------------
 * DESIGN.md §8.6 contrast gate (plan todo 9).
 *
 * Re-computes every documented text/background pair from the tokens actually
 * declared in `web/src/index.css` — not from the numbers written in DESIGN.md —
 * and fails when a pair drops below its documented floor or drifts away from
 * its documented measurement. It additionally measures the five review-grade
 * inks introduced in `StudyPanel`, whose backgrounds are the same status token
 * composited at 20% over `--surface-1`.
 *
 * Usage: node scripts/verify-contrast.mjs [--json]
 * ------------------------------------------------------------------------- */

import { readFileSync, writeFileSync } from 'node:fs'
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
const GRADES = ['best', 'good', 'inaccuracy', 'mistake', 'blunder'].map((grade) => ({
  name: `review grade \`${grade}\` ink on --status-${grade}/20 over --surface-1`,
  foreground: `color-mix(in oklab, var(--status-${grade}) 65%, var(--text-primary))`,
  background: `color-mix(in oklab, var(--status-${grade}) 20%, transparent)`,
  floor: 4.5,
}))

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

const failures = results.filter((result) => !result.pass)
const report = { optimismMargin: OPTIMISM_MARGIN, pairs: results.length, failures: failures.length, results }

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
console.log(`\ncontrast: PASS — ${results.length} pairs measured from ${'src/index.css'} tokens.`)
