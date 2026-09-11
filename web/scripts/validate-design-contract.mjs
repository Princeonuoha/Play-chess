#!/usr/bin/env node
// Machine-checks the root DESIGN.md against the Precision Chess Studio contract.
//
//   node web/scripts/validate-design-contract.mjs [path/to/DESIGN.md]
//
// Exit 0 = contract intact. Exit 1 = contract broken (a required section, token
// family, primitive state row, accessibility row, route, persona, or literal is
// missing, or banned design-direction language appeared). Exit 2 = usage error.
//
// This script is the todo-1 gate for `.omo/plans/frontend-visual-polish.md` and is
// intended to keep running in CI as later todos edit the contract.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_TARGET = resolve(HERE, '..', '..', 'DESIGN.md')

/* ------------------------------------------------------------------ contract */

/** The eight H2 sections, in order. These must be the ONLY H2 headings. */
const REQUIRED_SECTIONS = [
  { n: 1, label: 'Atmosphere and product intent', keywords: ['atmosphere', 'product intent'] },
  { n: 2, label: 'Color tokens', keywords: ['color tokens'] },
  { n: 3, label: 'Typography tokens', keywords: ['typography tokens'] },
  { n: 4, label: 'Spacing, radius, depth, z-index tokens', keywords: ['spacing', 'radius', 'depth', 'z-index'] },
  { n: 5, label: 'Icon system', keywords: ['icon system'] },
  { n: 6, label: 'Motion tokens', keywords: ['motion tokens'] },
  { n: 7, label: 'Primitives and states', keywords: ['primitives and states'] },
  {
    n: 8,
    label: 'Responsive layouts, personas, accessibility constraints, accepted debt',
    keywords: ['responsive layouts', 'personas', 'accessibility constraints', 'accepted debt'],
  },
]

/** Semantic token families. Each must declare at least one token. */
const TOKEN_FAMILIES = [
  ['canvas', '--canvas-'],
  ['board (frozen squares)', '--board-square-'],
  ['surface', '--surface-'],
  ['text', '--text-'],
  ['brass', '--brass-'],
  ['status', '--status-'],
  ['border', '--border-'],
  ['depth', '--depth-'],
  ['type', '--type-'],
  ['spacing', '--space-'],
  ['radius', '--radius-'],
  ['icon', '--icon-'],
  ['motion', '--motion-'],
  ['z-index', '--z-'],
]

/** Every primitive and the states it must contract for, as matrix rows. */
const PRIMITIVE_STATES = {
  Btn: ['default', 'hover', 'focus', 'active', 'disabled', 'loading'],
  IconButton: ['default', 'hover', 'focus', 'active', 'disabled'],
  Field: ['default', 'focus', 'disabled', 'error'],
  GroupedSelect: ['default', 'hover', 'focus', 'disabled', 'empty'],
  Slider: ['default', 'hover', 'focus', 'active', 'disabled'],
  Surface: ['default', 'hover', 'focus'],
  SegmentedNav: ['default', 'hover', 'focus', 'active', 'disabled'],
  WorkspaceNav: ['default', 'hover', 'focus', 'active', 'loading'],
  EngineStatus: ['default', 'loading', 'error'],
  StatusNote: ['default', 'error'],
  InlineFeedback: ['default', 'loading', 'empty', 'error'],
  DialogSurface: ['default', 'focus', 'active'],
  Toast: ['default', 'focus', 'active'],
  Loading: ['loading'],
  Empty: ['empty'],
  Error: ['error'],
}

/** Accessibility constraint rows. Removing any one breaks the contract. */
const A11Y_ROWS = Array.from({ length: 12 }, (_, i) => `A11Y-${String(i + 1).padStart(2, '0')}`)

/** Personas. */
const PERSONAS = [
  ['P1', 'low-vision'],
  ['P2', 'keyboard-only'],
  ['P3', 'temporary motor limitation'],
  ['P4', 'mobile short-height'],
]

/** Routes that must each own a row in the route table. */
const ROUTES = ['/play', '/openings', '/games', '/study']

/** Literals the contract may never lose. */
const REQUIRED_LITERALS = [
  ['named direction', 'Precision Chess Studio'],
  ['frozen ivory square', '#eeeed2'],
  ['frozen green square', '#769656'],
  ['minimum target size', '44px'],
  ['reduced-motion media query', 'prefers-reduced-motion'],
  ['conformance target', 'WCAG 2.2 AA'],
  ['zoom constraint', '200%'],
  ['UI font', 'Archivo'],
  ['numeric font', 'IBM Plex Mono'],
  ['brass restraint rule', 'Brass restraint rule'],
  ['mobile board threshold', 'y=560'],
  ['mobile board baseline', 'y=706'],
]

/** Design directions this product rejected. Their presence is a contract break. */
const BANNED_DIRECTIONS = [
  ['violet accent direction', /violet/i],
  ['second (day) theme direction', /light[\s_-]?theme/i],
]

/* ------------------------------------------------------------------- harness */

const failures = []
const passes = []

function check(name, ok, detail) {
  if (ok) passes.push(name)
  else failures.push(detail ? `${name} — ${detail}` : name)
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Matches a markdown table row whose first cell is `` `first` `` and second cell is `second`. */
function hasMatrixRow(text, first, second) {
  const re = new RegExp(`^\\|\\s*\`${escapeRe(first)}\`\\s*\\|\\s*${escapeRe(second)}\\s*\\|`, 'im')
  return re.test(text)
}

/** Matches a markdown table row whose first cell is exactly `id`. */
function hasIdRow(text, id) {
  return new RegExp(`^\\|\\s*${escapeRe(id)}\\s*\\|`, 'm').test(text)
}

/* ----------------------------------------------------------------- the gates */

function validate(text, target) {
  // 1. Section headings: present, ordered, and the only H2 headings in the file.
  const headings = [...text.matchAll(/^##(?!#)\s*(.+?)\s*$/gm)].map((m) => m[1])
  check(
    'H2 count is exactly 8',
    headings.length === REQUIRED_SECTIONS.length,
    `found ${headings.length}: ${headings.map((h) => JSON.stringify(h)).join(', ') || '(none)'}`,
  )
  for (const [i, spec] of REQUIRED_SECTIONS.entries()) {
    const heading = headings[i]
    const lower = (heading ?? '').toLowerCase()
    const ok =
      typeof heading === 'string' &&
      new RegExp(`^section\\s+${spec.n}\\b`, 'i').test(heading) &&
      spec.keywords.every((k) => lower.includes(k))
    check(
      `Section ${spec.n} heading in position ${i + 1}: "${spec.label}"`,
      ok,
      heading === undefined ? 'heading missing' : `got "${heading}"`,
    )
  }

  // 2. Required literals.
  for (const [name, literal] of REQUIRED_LITERALS) {
    check(`literal present (${name}): "${literal}"`, text.includes(literal))
  }

  // 3. Board squares are declared immutable, not merely mentioned.
  check(
    'board squares declared immutable',
    /immutable/i.test(text) && /#eeeed2/.test(text) && /#769656/.test(text),
    'expected an "Immutable" statement alongside both frozen square colors',
  )

  // 4. Semantic token families.
  for (const [name, prefix] of TOKEN_FAMILIES) {
    check(`token family declared: ${name} (${prefix}*)`, text.includes(prefix))
  }

  // 5. Primitive + state matrix rows.
  for (const [primitive, states] of Object.entries(PRIMITIVE_STATES)) {
    check(`primitive documented: ${primitive}`, text.includes(`\`${primitive}\``))
    for (const state of states) {
      check(
        `state row present: ${primitive} / ${state}`,
        hasMatrixRow(text, primitive, state),
        `expected a matrix row "| \`${primitive}\` | ${state} | …"`,
      )
    }
  }

  // 6. Accessibility constraint rows.
  for (const id of A11Y_ROWS) {
    check(`accessibility row present: ${id}`, hasIdRow(text, id), `expected a row "| ${id} | …"`)
  }

  // 7. Routes.
  for (const route of ROUTES) {
    check(`route documented: ${route}`, hasIdRow(text, `\`${route}\``), `expected a row "| \`${route}\` | …"`)
  }
  check('root redirect documented', text.includes('`/` redirects to `/play`'))

  // 8. Personas.
  for (const [id, keyword] of PERSONAS) {
    const re = new RegExp(`^\\|\\s*${id}\\s*\\|[^|]*${escapeRe(keyword)}`, 'im')
    check(`persona row present: ${id} (${keyword})`, re.test(text), `expected a row "| ${id} | …${keyword}…"`)
  }

  // 9. Accepted debt section + at least one debt row.
  check(
    '`## Accepted debt` section heading present',
    /^##(?!#)\s.*accepted debt\s*$/im.test(text),
    'expected an H2 heading declaring the accepted-debt section',
  )
  check('accepted debt row present (D-01)', hasIdRow(text, 'D-01'))

  // 10. Banned design directions.
  for (const [name, re] of BANNED_DIRECTIONS) {
    const hit = text.match(re)
    check(
      `banned direction absent: ${name}`,
      hit === null,
      hit ? `found ${JSON.stringify(hit[0])} at index ${hit.index}` : undefined,
    )
  }

  /* ------------------------------------------------------------------ report */

  const total = passes.length + failures.length
  process.stdout.write(`design contract: ${target}\n`)
  process.stdout.write(`checks: ${total}  passed: ${passes.length}  failed: ${failures.length}\n`)
  if (failures.length === 0) {
    process.stdout.write('RESULT: PASS — Precision Chess Studio contract intact.\n')
    return 0
  }
  process.stdout.write('\nFAILURES:\n')
  for (const f of failures) process.stdout.write(`  - ${f}\n`)
  process.stdout.write('\nRESULT: FAIL — DESIGN.md no longer satisfies the contract.\n')
  return 1
}

/* -------------------------------------------------------------------- runner */

const target = resolve(process.argv[2] ?? DEFAULT_TARGET)
let source
try {
  source = readFileSync(target, 'utf8')
} catch (err) {
  process.stderr.write(`cannot read design contract at ${target}: ${err.message}\n`)
  process.exit(2)
}
process.exit(validate(source, target))
