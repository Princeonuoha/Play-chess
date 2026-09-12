# chesswithprince.com — Design Contract

> **Machine-checked.** `node web/scripts/validate-design-contract.mjs` must exit 0 before any
> visual task in `.omo/plans/frontend-visual-polish.md` is considered done. The validator asserts
> the eight section headings below (present, ordered, and the only `##` headings), the named
> direction, the frozen board colors, every primitive and required state row, every accessibility
> constraint row, every route, every persona, and the absence of banned direction language.
>
> This document is the single source of truth for color, type, spacing, depth, icon, and motion
> values. Any component value that is not traceable to a token defined here is a defect.

---

## Section 1 — Atmosphere and product intent

### 1.1 Named direction

**Precision Chess Studio.**

A quiet, instrument-grade room built around one lit object: the board. The surrounding chrome
behaves like studio equipment — machined, tonal, low-glare — so that the only things that
compete for attention are the position and the single action the current route is asking for.
The product is a focused analysis instrument, not a dashboard and not a marketing surface.

### 1.2 What the direction commits to

| Commitment | Meaning in practice |
| --- | --- |
| The board is the hero | Every layout at every width places the board first in reading order and gives it the largest optical mass. Chrome recedes; the board is the only element allowed a true drop shadow of `--depth-board`. |
| One decision per screen | Each route exposes exactly one primary action. Every other control is secondary, tertiary, or progressively disclosed. Four equal-weight tabs competing for the same attention is the failure this redesign removes. |
| Machined, not decorated | Surfaces are separated by tone and a single hairline, never by gradients, glows, or ornamental borders. Depth comes from a 4-step tonal stack plus one inset hairline highlight. |
| Restraint is the accent strategy | Brass is the only interaction accent in the product. Its scarcity is what makes it read as important. See §2.4. |
| Motion reports state | Animation exists to explain a state change (piece travel, evaluation shift, route transition, dialog entry). Decorative motion, hover motion on non-interactive elements, and motion with no informational payload are prohibited. |
| Dark-only | The canvas is a single dark studio. A second (day/bright) palette and any theme switching control are out of scope for this system; there is exactly one canvas. |

### 1.3 Material language

- **Canvas:** midnight blue-charcoal (`#0f151b`) with one large, very low-opacity brass wash in the
  upper-right, reading as a single off-frame lamp. No second light source, ever.
- **Surfaces:** four tonal steps lifted off the canvas, each separated by a hairline at
  `rgba(255,255,255,0.06–0.10)` and an optional 1px inset top highlight. No surface uses a gradient
  fill.
- **Board:** classic tournament ivory/green, fully preserved (§2.2). It is framed like a physical
  board — a deep contact shadow, a hairline rim, and a brass rim-light only while it holds focus.
- **Type:** editorial sans for language, monospace for anything numeric or notational, so a rating,
  an evaluation, and a SAN move are always visually typed as data.

### 1.4 Inspiration, not imitation

Research inputs are recorded here so later review can audit intent. **No logo, wordmark, asset,
icon set, illustration, screenshot, or copy string from any of these products is reproduced.**

| Source | What was taken | What was explicitly not taken |
| --- | --- | --- |
| Linear | Hierarchy discipline, tonal surface stacking, hairline separation, restraint in accent usage, keyboard-first posture. | Its palette, including its accent hue; its typography; its iconography; any copy. |
| Chess.com | The structural insight that guided review and open analysis are different products and must not share one undifferentiated surface. | Visual identity, board theme, grade badge artwork, copy. |
| Lichess | Board-stays-stable-while-tools-change layout model; visible inline mode tabs on mobile for discoverability; a compact-board affordance on short screens; the precedent that a screen-reader-operable board is a shipped feature, not a nicety. | Visual identity, typography, board theme, copy. |
| Chessable | Separation of browsing a line from drilling a line, with an explicit handoff between them. | Visual identity, course structure, copy. |

### 1.5 Anti-goals

Generic SaaS hero sections, feature-card grids, glassmorphism, purple-on-white gradients, emoji used
as interface icons, mixed icon families, unlabeled icon-only navigation, decorative particle or
parallax motion, and any second accent hue introduced alongside brass.

---

## Section 2 — Color tokens

All color is semantic. Components reference the semantic name, never a raw hex value and never a
raw Tailwind color. Tokens are declared once, in `web/src/index.css`, and exposed to Tailwind via
`@theme`; the duplicate `:root` block that currently mirrors them is removed in todo 9.

### 2.1 Canvas family

| Token | Value | Use |
| --- | --- | --- |
| `--canvas-base` | `#0f151b` | Document background. The one true backdrop. |
| `--canvas-veil` | `color-mix(in oklab, var(--brass-base) 10%, transparent)` | The single off-frame lamp wash, applied as one radial at `1200px 600px at 85% -12%`. Never repeated elsewhere. |
| `--canvas-sunken` | `rgba(0,0,0,0.25)` | Recessed wells: input fills, segmented-nav track, scrubber track. |
| `--canvas-scrim` | `rgba(0,0,0,0.60)` | Dialog backdrop. |

### 2.2 Board family — FROZEN

> **Immutable.** The two square fills below are the product's memory. They are reproduced here
> byte-exact, may not be recolored, re-toned, theme-swapped, opacity-adjusted, or filtered by any
> task in this plan, and the validator fails if either literal disappears from this document.

| Token | Value | Status |
| --- | --- | --- |
| `--board-square-ivory` | `#eeeed2` | **Immutable.** Light square fill. |
| `--board-square-green` | `#769656` | **Immutable.** Dark square fill. |

Everything drawn *on* the board is a separate, changeable token:

| Token | Value | Use |
| --- | --- | --- |
| `--board-coord-on-ivory` | `#3d4f2c` | Rank/file coordinate ink on an ivory square. Measured 7.5:1 against `#eeeed2` at full opacity. |
| `--board-coord-on-green` | `#1b2412` | Rank/file coordinate ink on a green square. Measured 4.8:1 against `#769656` at full opacity. |
| `--board-rim` | `#0a0f14` | 1px board frame. |
| `--board-select` | `color-mix(in oklab, var(--brass-base) 40%, transparent)` | Selected-square wash. |
| `--board-last` | `color-mix(in oklab, var(--brass-base) 20%, transparent)` | Last-move wash. |
| `--board-dot` | `rgba(15,21,27,0.40)` | Legal-move dot and capture ring. |
| `--board-check` | `var(--status-critical)` | King-in-check radial. |

The classic complementary-color coordinate convention (green ink on ivory, ivory ink on green) is
**deliberately abandoned**: complementary ink measures 2.8:1 at full opacity and roughly 2.0:1 at the
shipped `opacity: .65`, which fails Section 8's contrast constraint. Dark engraved-style coordinates
on both square colors are the replacement. Square fills are untouched by this change.

### 2.3 Surface family

| Token | Value | Use |
| --- | --- | --- |
| `--surface-1` | `#161d25` | Primary panel / inspector body. |
| `--surface-2` | `#1b232d` | Raised region inside a panel: panel header, selected row, dialog body. |
| `--surface-3` | `#212a35` | Highest tonal step: hovered row, active segmented item track. |
| `--surface-inset` | `rgba(255,255,255,0.03)` | Secondary button and quiet chip fill. |
| `--surface-inset-hover` | `rgba(255,255,255,0.07)` | Hover state of `--surface-inset`. |
| `--surface-overlay` | `#1b232d` | Dialog and toast body, opaque (never translucent, so text never sits over a moving board). |

### 2.4 Brass family — the one accent

| Token | Value | Use |
| --- | --- | --- |
| `--brass-base` | `#c69a52` | The accent. Primary button fill, active navigation fill, focus ring, board rim-light. Measured 7.2:1 against `--canvas-base`. |
| `--brass-lift` | `#d9ad60` | Hover state of a brass-filled surface only. |
| `--brass-dim` | `#9c793d` | Brass at rest on a lit surface: eval-bar midline, quiet rules. |
| `--brass-rim` | `color-mix(in oklab, var(--brass-base) 50%, transparent)` | 1px accent border on a non-filled element. |
| `--brass-wash` | `color-mix(in oklab, var(--brass-base) 12%, transparent)` | Tint behind a brass-bordered note or banner. |
| `--text-on-brass` | `#1a130a` | The only text color permitted on a brass fill. Measured 7.2:1 against `--brass-base`. |

**Brass restraint rule (enforced in review):**

1. **At most one brass-filled element per visible viewport region.** A region is the board column,
   the inspector column, the navigation, a dialog, or a toast. Two brass fills visible in the same
   region at the same time is a defect.
2. Everywhere else brass may appear only as: a 1px rim (`--brass-rim`), a focus ring
   (`--border-focus`), a wash at or below 20% (`--brass-wash`, `--board-select`, `--board-last`), or
   a text accent on a link or numeric emphasis.
3. **Brass is never used to mean status.** Success, caution, and failure are the `--status-*` family.
   Brass means *this is the interaction*, nothing else.
4. **No second accent hue may be introduced.** Any new hue must be a `--status-*` token with a
   documented semantic, or it does not ship.

### 2.5 Text family

| Token | Value | Contrast on `--canvas-base` | Use |
| --- | --- | --- | --- |
| `--text-primary` | `#e7ecf1` | 15.7:1 | Headings, body, move text, any primary reading. |
| `--text-secondary` | `#c6ccd4` | 11.2:1 | Black's move column, secondary rows, long descriptive copy. |
| `--text-muted` | `#8c98a6` | 6.4:1 (6.1:1 on `--surface-1`) | Labels, metadata, helper text. **Floor: no token below 4.5:1 is permitted for text of any size.** |
| `--text-on-brass` | `#1a130a` | — (7.2:1 on brass) | Text on a brass fill. |
| `--text-link` | `var(--brass-base)` | 7.2:1 | Inline links. Always additionally underlined on hover and focus — color alone never marks a link. |

### 2.6 Status family

Status carries meaning, so every status token ships with a non-color partner (icon, glyph, or word).

| Token | Value | Semantic | Non-color partner |
| --- | --- | --- | --- |
| `--status-positive` | `#7ea86a` | Correct move, ready engine, success. | Check icon + word. |
| `--status-info` | `#5f9ea0` | Good-but-not-best, informational. | Info icon + word. |
| `--status-caution` | `#d6a95d` | Inaccuracy, degraded state. | Caution icon + word. |
| `--status-warning` | `#d08a3e` | Mistake. | Warning icon + word. |
| `--status-critical` | `#c0453f` | Blunder, check, hard failure. | Error icon + word. |
| `--status-best` | `var(--status-positive)` | Review grade `Best`. | Annotation glyph, documented §5.4. |
| `--status-good` | `var(--status-info)` | Review grade `Good`. | Annotation glyph. |
| `--status-inaccuracy` | `var(--status-caution)` | Review grade `Inaccuracy`. | Annotation glyph. |
| `--status-mistake` | `var(--status-warning)` | Review grade `Mistake`. | Annotation glyph. |
| `--status-blunder` | `var(--status-critical)` | Review grade `Blunder`. | Annotation glyph. |

Grade badges keep their existing fills so review artwork stays recognizable; the tokenized values
above are the source, and each badge additionally renders its glyph and an accessible name.

### 2.7 Border family

| Token | Value | Use |
| --- | --- | --- |
| `--border-hairline` | `rgba(255,255,255,0.06)` | Default separation between tonal steps. |
| `--border-subtle` | `rgba(255,255,255,0.10)` | Control outlines, card edges. |
| `--border-strong` | `#2a333f` | Structural rules: footer rule, table rules, eval-bar edge. |
| `--border-brass` | `var(--brass-rim)` | Accent edge on a selected or annotated element. |
| `--border-focus` | `var(--brass-base)` | Focus ring color. See §7.2 for geometry. |

### 2.8 Depth family

| Token | Value | Use |
| --- | --- | --- |
| `--depth-flat` | `none` | Default. Most elements have no shadow. |
| `--depth-inset-hairline` | `inset 0 1px 0 0 rgba(255,255,255,0.05)` | Top highlight on a raised surface. |
| `--depth-raised` | `0 18px 44px -22px rgba(0,0,0,0.75)` | Panels and inspectors. |
| `--depth-floating` | `0 10px 30px rgba(0,0,0,0.45)` | Toast, popover, sticky navigation. |
| `--depth-overlay` | `0 28px 70px -20px rgba(0,0,0,0.85)` | Dialog. |
| `--depth-board` | `0 24px 60px -24px rgba(0,0,0,0.75)` | The board's contact shadow. The heaviest shadow in the product; nothing else may equal or exceed it. |

---

## Section 3 — Typography tokens

### 3.1 Families

| Token | Stack | Role |
| --- | --- | --- |
| `--type-font-ui` | `"Archivo", system-ui, -apple-system, sans-serif` | All language: headings, body, labels, buttons, navigation. Weights loaded: 500, 600, 700, 800. |
| `--type-font-numeric` | `"IBM Plex Mono", ui-monospace, monospace` | All data: SAN moves, evaluations, Elo, clock/think time, engine tag, coordinates, PGN, PV lines. Weights loaded: 400, 500, 600. |

**Rule:** if a string is a number, a notation token, or an identifier a player would compare against
another value, it renders in `--type-font-numeric`. If it is language, it renders in
`--type-font-ui`. There is no third family, and no font swap is in scope for this plan.

### 3.2 Scale

A 7-step scale. Sizes are `rem`-based so 200% zoom and user font-size preferences scale cleanly;
no component may declare a raw `px` font size.

| Token | Size / line-height | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `--type-display` | `1.875rem / 1.15` (`2.25rem` ≥768px) | 800 | `-0.02em` | Product wordmark only. |
| `--type-title` | `1.25rem / 1.25` | 700 | `-0.01em` | Route heading, dialog title. |
| `--type-heading` | `1.0625rem / 1.3` | 700 | `-0.005em` | Panel heading, status line. |
| `--type-body` | `0.875rem / 1.55` | 500 | `0` | Default UI text and controls. |
| `--type-body-sm` | `0.8125rem / 1.55` | 500 | `0` | Secondary copy, helper text, commentary. |
| `--type-label` | `0.75rem / 1.35` | 600 | `0.06em`, uppercase | Field labels, chip and badge text. |
| `--type-numeric` | `0.8125rem / 1.45` | 500 | `0.01em` | Monospace data rows. |

**Minimum rendered size is `--type-label` (12px at default zoom).** The current 10px and 11px
strings (`.coord`, `.tr-status .path`, the onboarding footnote) are defects and are raised in
todos 12–14. The single permitted exception is the in-board coordinate, which may render at 10px
because it is a redundant duplicate of information exposed in the board's accessible alternative
(§8.6) and in the move list.

### 3.3 Measure and wrapping

Descriptive copy is capped at `--type-measure: 68ch`. Every text container must survive a 3x-length
string without clipping or overflow; truncation is only permitted where a full value is reachable by
another route (tooltip, expanded row, or the accessible name).

---

## Section 4 — Spacing, radius, depth, z-index tokens

### 4.1 Spacing — 4px grid

Every margin, padding, and gap resolves to a token. No arbitrary value is permitted.

| Token | Value | Typical use |
| --- | --- | --- |
| `--space-1` | `4px` | Icon-to-label, tight chip padding. |
| `--space-2` | `8px` | Control inner padding, adjacent control gap. |
| `--space-3` | `12px` | Field stack gap, list row padding. |
| `--space-4` | `16px` | Panel padding, page gutter at ≤767px. |
| `--space-5` | `20px` | Section gap inside a panel. |
| `--space-6` | `24px` | Major block gap, page gutter at ≥768px. |
| `--space-8` | `32px` | Column gap on desktop. |
| `--space-10` | `40px` | Page gutter at ≥1280px, header-to-content separation. |
| `--space-12` | `48px` | Reserved for the widest desktop rhythm. |

### 4.2 Radius

| Token | Value | Use |
| --- | --- | --- |
| `--radius-xs` | `4px` | Board highlight corner, tiny inline marker. |
| `--radius-sm` | `8px` | Chip, badge, eval bar. |
| `--radius-md` | `10px` | Icon button, list row. |
| `--radius-lg` | `12px` | Button, input, select, segmented item. |
| `--radius-xl` | `16px` | Panel, dialog, toast. |
| `--radius-pill` | `999px` | Status pill, engine tag. |
| `--radius-board` | `14px` | The board frame. Unchanged. |

### 4.3 Depth usage rules

Depth tokens are defined in §2.8. Usage is constrained here so the scene reads as one lit room:

1. Depth is applied in exactly one direction (light from upper-right, shadow falls down and left).
2. A component may carry at most one depth token plus `--depth-inset-hairline`.
3. `--depth-board` is reserved to the board. Nothing else may carry an equal or heavier shadow.
4. Tonal separation (`--surface-1` → `--surface-2` → `--surface-3`) is the primary depth mechanism;
   shadow is the secondary one. A hover state changes tone, not elevation.

### 4.4 Z-index

The complete stacking contract. No component may declare a raw `z-index`.

| Token | Value | Layer |
| --- | --- | --- |
| `--z-base` | `0` | Document flow. |
| `--z-board-layer` | `2` | Board pieces. |
| `--z-board-badge` | `3` | Review grade badges pinned to squares. |
| `--z-board-drag` | `5` | The piece under the pointer. |
| `--z-sticky` | `20` | Sticky header. |
| `--z-nav` | `30` | Mobile workspace navigation. |
| `--z-scrim` | `40` | Dialog backdrop. |
| `--z-dialog` | `50` | Dialog surface. |
| `--z-toast` | `60` | Toast region. Always above a dialog so confirmations remain visible. |

---

## Section 5 — Icon system

### 5.1 One family

A single lightweight SVG icon family is used for every interface icon. Selection, install, and
bundle accounting happen in todo 10; whatever is chosen, these rules bind:

| Token | Value | Use |
| --- | --- | --- |
| `--icon-size-sm` | `16px` | Inline with `--type-body-sm`. |
| `--icon-size-md` | `20px` | Default: buttons, navigation, status. |
| `--icon-size-lg` | `24px` | Dialog header, empty-state illustration mark. |
| `--icon-stroke` | `1.75` | Uniform stroke width across every icon at every size. |
| `--icon-target-min` | `44px` | Minimum hit area of any icon-only control. |

**Chosen family (todo 10): a local typed set, `web/src/ui/icons.tsx`.** No icon package is
installed — the dependency cost of a tree-shaken package exceeds the bytes of the marks this product
actually draws, and a local set makes "one family" a type error to break rather than a review note.
The module is the single icon source: it exports `Icon`, `IconButton`, the `IconName` union, and the
`IconSize` scale, every mark is authored on one `viewBox="0 0 24 24"` grid, stroked with
`stroke="currentColor"` over `fill="none"`, and both size and stroke are `var()` references to the
tokens above rather than literals. `scripts/verify-icons.mjs` (`npm run verify:icons`) fails the
build on a structural emoji or transport glyph in product source, on an `<svg>` authored outside the
module, and on any second stroke width, size, or geometry grid.

`web/src/dev/pending.tsx` holds a dev-only stand-in with the same `Icon`/`IconName` shape for the
§7.3 showcase. It is never imported by product code and never reaches the production bundle; todo 11
deletes it when the real primitives land.

### 5.2 Prohibitions

- **No emoji is used as an interface icon**, anywhere, ever. The current onboarding card marks, the
  help `?` glyph, and the transport controls (first / previous / next / last, play, stop) are all
  replaced with family SVG in todo 10.
- **No mixed families.** One package, or one local typed set. Two icon vocabularies in one product
  is a defect.
- **No arrow, chevron, or symbol characters used structurally** (`→`, `◀`, `▶`, `⏮`, `⏭`, `■`).
- **No icon-only control without an accessible name.** Every icon-only control carries a visible
  label, an `aria-label`, or an adjacent `<span class="sr-only">`.

### 5.3 Decorative vs meaningful

Decorative icons are `aria-hidden="true"` and paired with visible text. Meaningful icons (the only
carrier of their information) supply an accessible name. An icon is never the sole carrier of a
status — §2.6 requires a word alongside.

### 5.4 Chess annotation glyphs — the one documented exception

Standard chess annotation glyphs (`!`, `?`, `?!`, `??`, and the star/check marks on grade badges)
are domain notation, not interface icons, and may remain as text. Each must:

1. Render in `--type-font-numeric`,
2. Be accompanied by the spelled grade name (`Best`, `Good`, `Inaccuracy`, `Mistake`, `Blunder`) in
   the accessible name, and
3. Never be the only distinguishing feature between two grades — the `--status-*` color and the word
   are both present.

The surviving sites are exactly one declaration, and `scripts/verify-icons.mjs` allows this set and
no other character: `GRADE_GLYPH` in `web/src/core/controller.ts` feeds both the on-board grade
badge and every `web/src/panels/StudyPanel.tsx` surface (the review legend, the commentary card, and
the per-move rows), alongside the `✓` / `✗` book-move marks in the trainer status line. Every one
renders in `--type-font-numeric`, is `aria-hidden` where visible text already spells the grade, and
is paired with the spelled word in the accessible name.

---

## Section 6 — Motion tokens

### 6.1 Durations and easings

| Token | Value | Use |
| --- | --- | --- |
| `--motion-instant` | `80ms` | Press feedback, active-state tone change. |
| `--motion-fast` | `140ms` | Hover tone, focus ring, icon state. |
| `--motion-base` | `200ms` | Dialog and toast entry, route content transition, segmented indicator. |
| `--motion-slow` | `320ms` | Evaluation bar travel — slow enough to read as a measurement moving. |
| `--motion-piece` | `180ms` | Piece travel between squares. Unchanged duration; the property changes (§6.3). |
| `--motion-ease-out` | `cubic-bezier(0.2, 0.7, 0.3, 1)` | Default for entering and settling. |
| `--motion-ease-in` | `cubic-bezier(0.4, 0.0, 1, 1)` | Exits. |
| `--motion-ease-standard` | `cubic-bezier(0.4, 0.0, 0.2, 1)` | Continuous/positional change. |

### 6.2 Meaning rule

Every animation must name the state change it reports. Permitted causes: a piece moved, an
evaluation changed, a route or sub-surface changed, a dialog or toast appeared or dismissed, a
control changed state under the user's own pointer or key, or an async operation started or
finished. Anything else — ambient drift, decorative hover on non-interactive elements, parallax,
entrance animation on static content — is prohibited.

### 6.3 Compositing rule

Animation is restricted to `transform`, `opacity`, and `filter`. Animating layout properties is
prohibited. The board's pieces currently transition `left`/`top`
(`web/src/index.css:76-81`); todo 13 converts them to `transform: translate3d()` while preserving the
existing `--motion-piece` duration and easing so the board feels identical.

### 6.4 Reduced motion

A global `@media (prefers-reduced-motion: reduce)` block is mandatory and ships in todo 9. Under
reduced motion:

- All transitions and animations collapse to `0.01ms` **except** state changes that would otherwise
  become invisible; those become instant, not absent.
- Piece movement becomes an instant reposition — the piece still moves, it just does not travel.
- The evaluation bar jumps to its new height rather than sliding.
- Spinners become a static determinate mark plus text (`Thinking…`), never a silent frozen ring.
- No information is lost in either mode. Reduced motion is a path, not a degraded product.

### 6.5 Motion library policy

No motion dependency is added. CSS transitions and the Web Animations API cover this system. A
library may only be introduced if the primitive showcase (todo 4 / todo 11) demonstrates a required
mechanism CSS/WAAPI cannot express, and the added bundle cost is recorded as debt in §8.7.

---

## Section 7 — Primitives and states

### 7.1 Inventory

| Primitive | Source today | Status |
| --- | --- | --- |
| `Btn` | `web/src/ui/primitives.tsx:6` | Refactor to tokens; add `loading`. |
| `IconButton` | ad hoc (`web/src/App.tsx:62`, `:166`) | New shared primitive. |
| `Field` | `web/src/ui/primitives.tsx:42` | Refactor; add description + error slot. |
| `GroupedSelect` | `web/src/ui/primitives.tsx:56` | Refactor; keep native `<select>`. |
| `Slider` | ad hoc (`PlayPanel`) | New shared primitive. |
| `Surface` | ad hoc `Card` (`web/src/App.tsx:48`) | Promote to shared primitive with tone prop. |
| `SegmentedNav` | ad hoc tab strip (`web/src/App.tsx:274`) | New primitive; the presentational base. |
| `WorkspaceNav` | ad hoc tab strip (`web/src/App.tsx:274`) | New routed primitive built on `SegmentedNav`, using `NavLink`. |
| `EngineStatus` | ad hoc chip (`web/src/App.tsx:163`) | New primitive. |
| `StatusNote` | `web/src/ui/primitives.tsx:91` | Refactor; add error tone. |
| `InlineFeedback` | none | New primitive: the in-panel async/result reporter. |
| `DialogSurface` | ad hoc divs (`web/src/App.tsx:176`, `:369`) | New primitive with real dialog semantics. |
| `Toast` | ad hoc div (`web/src/App.tsx:399`) | New primitive with a live region. |
| `Loading` | none | New state primitive. |
| `Empty` | none | New state primitive. |
| `Error` | none | New state primitive. |

### 7.2 Universal state contract

These apply to every interactive primitive and are not repeated per row.

- **Focus:** `outline: 2px solid var(--border-focus); outline-offset: 2px`. Focus is never removed
  and never rendered as color-change-only. `:focus-visible` is used for pointer input;
  keyboard focus is always visible.
- **Target size:** every interactive element has a hit area of at least `44px × 44px`
  (`--icon-target-min`). Visual size may be smaller; the hit area may not.
- **Disabled:** `opacity: 0.4`, `cursor: not-allowed`, `aria-disabled` or the native attribute, and
  an adjacent explanation whenever the reason is not obvious from context.
- **Press:** `transform: scale(0.98)` over `--motion-instant`. Never a layout change.
- **Non-color:** no state is signalled by color alone. Every state pairs color with a shape, icon,
  weight, border, position, or text change.

### 7.3 Primitive and state matrix

Each row is a required, individually reviewable contract. Removing a row is a contract break and the
validator fails.

| Primitive | State | Visual contract | Accessibility / behavior contract |
| --- | --- | --- | --- |
| `Btn` | default | Primary: `--brass-base` fill, `--text-on-brass`, `--radius-lg`, `--depth-flat`. Secondary: `--surface-inset` fill, `--border-subtle`, `--text-primary`. | Native `<button>`; `--type-body` at weight 600; min height 44px. |
| `Btn` | hover | Primary → `--brass-lift`. Secondary → `--surface-inset-hover`. `--motion-fast`. | Hover is never the only affordance; the control is already visibly a button at rest. |
| `Btn` | focus | Universal focus ring (§7.2). | Reachable in DOM order; no positive `tabindex`. |
| `Btn` | active | `scale(0.98)` over `--motion-instant`; tone holds. | Activates on both `Enter` and `Space`. |
| `Btn` | disabled | `opacity: 0.4`, no hover response. | `disabled` attribute; the reason is stated in adjacent text. |
| `Btn` | loading | Label persists, an inline spinner replaces the leading icon slot, width is locked to prevent reflow. | `aria-busy="true"`; the button stays focused; the result is announced by `InlineFeedback` or `Toast`. |
| `IconButton` | default | `--radius-md`, transparent fill, `--icon-size-md` glyph in `--text-primary`. Hit area 44px. | Requires `aria-label`; `title` alone is never sufficient. |
| `IconButton` | hover | Fill → `--surface-inset-hover` over `--motion-fast`. | — |
| `IconButton` | focus | Universal focus ring, clipped to the 44px hit area so the ring is fully visible. | — |
| `IconButton` | active | `scale(0.95)` over `--motion-instant`. | — |
| `IconButton` | disabled | `opacity: 0.4`, no hover response. | `disabled`; adjacent text explains why when non-obvious. |
| `Field` | default | `--type-label` uppercase label in `--text-muted`, `--space-2` gap, optional `--type-body-sm` description. | `<label>` wraps or is bound by `for`/`id`; description linked via `aria-describedby`. |
| `Field` | focus | Label shifts to `--text-primary`; the control shows the universal focus ring. | Focus moves to the control, never the label. |
| `Field` | disabled | Label and control at `opacity: 0.4`. | `disabled` propagates to the control. |
| `Field` | error | `--status-critical` 1px border on the control, an error icon plus message below in `--status-critical`. | `aria-invalid="true"`; message linked via `aria-errormessage`; message is text, never color-only. |
| `GroupedSelect` | default | Native `<select>`, `--canvas-sunken` fill, `--border-subtle`, `--radius-lg`, `--type-body`, min height 44px. | Native element retained for platform picker behavior and screen-reader support. |
| `GroupedSelect` | hover | Border → `--border-strong`. | — |
| `GroupedSelect` | focus | Universal focus ring; border → `--border-focus`. | — |
| `GroupedSelect` | disabled | `opacity: 0.4`. | `disabled`. |
| `GroupedSelect` | empty | Single disabled option carrying the caller's empty text, plus an adjacent `Empty` block offering a recovery action. | Empty text is real language (`No openings match "…"`), never a bare dash. |
| `Slider` | default | `--canvas-sunken` track, `--brass-base` filled portion, 20px thumb inside a 44px hit area; the current value renders beside the label in `--type-font-numeric`. | Native `range`; `aria-valuetext` carries the human label (`Casual · 1580 Elo`), not just the number. |
| `Slider` | hover | Thumb ring lightens to `--surface-3`. | — |
| `Slider` | focus | Universal focus ring on the thumb. | Arrow keys step by 1, `Home`/`End` jump to the ends. |
| `Slider` | active | Thumb `scale(1.1)` over `--motion-instant`; value text switches to `--text-primary`. | Value change is announced on commit, not on every intermediate tick. |
| `Slider` | disabled | `opacity: 0.4`, thumb hidden from pointer. | `disabled`. |
| `Surface` | default | Tone from `--surface-1`…`--surface-3`, `--border-hairline`, `--radius-xl`, `--depth-raised`, `--depth-inset-hairline`. | Renders as a `<section>` with an accessible name when it represents a region. |
| `Surface` | hover | Only when the whole surface is interactive: tone steps up one level over `--motion-fast`. Non-interactive surfaces never respond to hover. | An interactive surface contains exactly one focusable control representing the whole action. |
| `Surface` | focus | Interactive surfaces take the universal focus ring on the surface itself. | — |
| `SegmentedNav` | default | `--canvas-sunken` track, `--radius-lg`; items `--type-body` weight 600 in `--text-muted`. | `role="tablist"` semantics only when it controls in-page panels; the routed variant uses navigation semantics instead. |
| `SegmentedNav` | hover | Item text → `--text-primary`; track unchanged. | — |
| `SegmentedNav` | focus | Universal focus ring on the item. | Roving focus with arrow keys inside the group. |
| `SegmentedNav` | active | Selected item: `--brass-base` fill, `--text-on-brass`, plus a 2px indicator that slides over `--motion-base`. | Selection is marked by fill **and** indicator, never color alone. |
| `SegmentedNav` | disabled | Item at `opacity: 0.4`. | `aria-disabled="true"`; remains focusable so its state is discoverable. |
| `WorkspaceNav` | default | `SegmentedNav` visuals plus a `--icon-size-md` leading icon and a visible text label on every destination at every width. | `<nav aria-label="Workspace">` containing `NavLink`s; labels are never hidden on mobile. |
| `WorkspaceNav` | hover | Inherits `SegmentedNav` hover. | — |
| `WorkspaceNav` | focus | Inherits the universal focus ring. | `Tab` order follows visual order. |
| `WorkspaceNav` | active | Inherits `SegmentedNav` active. | `aria-current="page"` on the active destination; after navigation focus moves to the route heading. |
| `WorkspaceNav` | loading | Pending destination shows a 2px indeterminate bar under its label over `--motion-base`. | `aria-busy` on the nav while a route transition is pending; the label never disappears. |
| `EngineStatus` | default | `--radius-pill`, `--surface-inset` fill, `--border-subtle`, engine tag in `--type-font-numeric`, a leading positive dot **and** the word `Ready`. | Exposed as `role="status"` so the transition to ready is announced once. |
| `EngineStatus` | loading | Indeterminate brass arc plus the word `Loading engine…`. | `aria-busy="true"`; under reduced motion the arc is static and the text still updates. |
| `EngineStatus` | error | `--status-critical` dot, the word `Engine failed`, and a `Retry` `Btn`. | `role="alert"`; the retry control is keyboard-reachable and explains the consequence. |
| `StatusNote` | default | Status line in `--type-heading`; the note sits behind a 3px `--brass-base` left rule on `--brass-wash`. | The status region is a live region; the note is plain text with an accessible heading relationship. |
| `StatusNote` | error | Left rule and text switch to `--status-critical` with a leading error icon and the word `Error`. | `role="alert"` for the error tone only, so routine status updates do not interrupt. |
| `InlineFeedback` | default | Hidden until there is something to report; occupies reserved height so appearing never shifts layout. | Container is `aria-live="polite"` and present in the DOM from first render. |
| `InlineFeedback` | loading | Skeleton rows at `--surface-2` plus the operation name (`Analyzing move 14…`). | `aria-busy="true"`; skeletons are `aria-hidden` and the text carries the meaning. |
| `InlineFeedback` | empty | Short sentence plus one recovery action. | The recovery action is a real focusable control, not instructional text. |
| `InlineFeedback` | error | `--status-critical` icon, plain-language cause, and a retry action. | `role="alert"`; the message names what failed and what to do next. |
| `DialogSurface` | default | `--surface-overlay` body, `--radius-xl`, `--depth-overlay`, over a `--canvas-scrim` backdrop. Enters with `opacity` + `translateY(8px)` over `--motion-base`. | Native `<dialog>` or `role="dialog" aria-modal="true"` with `aria-labelledby`; rendered in a portal. |
| `DialogSurface` | focus | The initial focus target carries a visible focus ring on open. | Focus moves into the dialog on open, is trapped inside while open, and returns to the invoking element on close. |
| `DialogSurface` | active | The close control and each choice follow `Btn`/`IconButton` active behavior. | `Escape` closes; a backdrop click closes only when nothing is at risk of being lost. |
| `Toast` | default | `--surface-overlay`, `--brass-rim` border, `--depth-floating`, bottom-center, entering with `opacity` + `translateY(8px)` over `--motion-base`. | Rendered into a persistent `aria-live="polite"` region; **never takes focus**. |
| `Toast` | focus | The dismiss `IconButton` shows the universal focus ring when reached. | Reachable by keyboard; auto-dismiss is paused while the toast has focus or hover. |
| `Toast` | active | Dismiss press follows `IconButton` active. | Dismissal returns focus nowhere — the user's place is never moved. |
| `Loading` | loading | Reserved-height skeletons at `--surface-2` with a `1.6s` shimmer, plus a text label naming the operation. | `aria-busy="true"` on the region; skeletons `aria-hidden`; under reduced motion the shimmer stops and the label remains. |
| `Empty` | empty | Centered `--icon-size-lg` mark in `--text-muted`, a one-line explanation, and exactly one primary action. | The explanation names why the region is empty; the action is a real control. |
| `Error` | error | `--status-critical` `--icon-size-lg` mark, a plain-language cause, a retry action, and an optional technical detail behind a disclosure. | `role="alert"`; the message never exposes a raw stack trace as the primary text. |

### 7.4 Composition rules

1. A primitive is defined once in `web/src/ui/` and imported. Re-implementing a primitive's visuals
   inside a panel is a defect.
2. Panels compose primitives; they do not declare color, radius, shadow, or motion values.
3. A new visual need extends this document first (new token or new row above), then the primitive,
   then the panel. One-off overrides are never the answer.

---

## Section 8 — Responsive layouts, personas, accessibility constraints, and accepted debt

### 8.1 Routes

The workspace is routed so every mode is a shareable destination while the board, the controller,
and the current game stay mounted across navigation.

| Route | Purpose | Primary action | Document title |
| --- | --- | --- | --- |
| `/play` | Play a game against the engine. | `New game` | `Play — chesswithprince.com` |
| `/openings` | Browse opening theory, then drill one line. | `Start training` | `Openings — chesswithprince.com` |
| `/games` | Search master games, then play or watch one through. | `Play through` | `Games — chesswithprince.com` |
| `/study` | Guided `Review` and open `Analysis` / `Explore`, as two distinct sub-surfaces. | `Review this game` | `Study — chesswithprince.com` |
| `/` | Redirect. | — | — |

`/` redirects to `/play`. Exactly one `ChessController` instance exists for the lifetime of the
document; navigating between routes never remounts it, never resets the position, and never clears
side, strength, or think-time settings.

### 8.2 Breakpoints and layout contracts

| Viewport | Class | Layout contract |
| --- | --- | --- |
| `375x812` | Small phone | Single column. Order: compact header, board, status, `WorkspaceNav`, route inspector, footer. Gutter `--space-4`. Board width `min(100%, 100dvw - 32px)`. |
| `390x844` | Standard phone | Same as 375 with the extra height spent on the status block, not on chrome. |
| `768x900` | Tablet portrait | Single column, board centered at `min(560px, 100% - 48px)`, inspector below at full width in a two-up field grid. Gutter `--space-6`. |
| `1024x768` short landscape | Short landscape / small laptop | Two columns `minmax(0,1fr) 360px`. **Compact-board mode:** board is capped at `calc(100dvh - 180px)` so board plus scrubber fit without scrolling. Header collapses to one line. |
| `1280x800` | Desktop | Two columns `minmax(0,1fr) 380px`, gutter `--space-10`, board and inspector share the same top edge. |
| `1440x1000` | Wide desktop | Same two-column structure, board at its `600px` cap, content centered within `max-width: 1152px`. |

Zero horizontal overflow is required at every viewport above, in both orientations, with the
longest realistic content in every slot.

### 8.3 Mobile board-visibility threshold — measured gate

> **On `375x812`, on a first visit with nothing dismissed, the board's top edge must render at
> `y=560` CSS pixels or less.** The board must therefore be visible above `y=560` without scrolling.
>
> **Baseline before this redesign: the board's top edge rendered at `y=706`** with the first-visit
> onboarding block present (the block itself measured 343x558 at `y=124`, and the mode tabs did not
> begin until `y=1137`). That baseline is the defect this threshold exists to close.

The threshold is asserted by the responsive Playwright specs in todos 12 and 22 and is measured with
the onboarding dialog in its first-visit state, the engine still loading, and the longest status
banner present. Moving onboarding into a portal dialog (todo 18) is what makes the threshold
achievable without hiding anything; the target is met by removing layout displacement, never by
removing content.

### 8.4 Personas

Every route and every primitive state is walked as each persona before a task is done.

| ID | Persona | Situation | What must be true |
| --- | --- | --- | --- |
| P1 | **Low-vision player** | Uses 200% browser zoom, OS large text, and sometimes a high-contrast mode. | No text below `--type-label`; every text token ≥4.5:1; layout reflows at 200% with no horizontal scroll and no clipped control; board state is distinguishable without relying on hue. |
| P2 | **Keyboard-only player** | No pointer. Drives the entire product with `Tab`, arrows, `Enter`, `Space`, `Escape`. | Every action is reachable and operable by keyboard, including making a move; focus is always visible; dialogs trap and restore focus; route changes move focus to the route heading; no keyboard trap anywhere. |
| P3 | **Temporary motor limitation** | One hand, a phone, or a trackpad after an injury; imprecise and slow pointing. | Every primary target is ≥44px with ≥8px separation; no hover-only affordance; no action requires a drag — every move is also achievable by tap-then-tap; no timed interaction expires before the user can act, and toasts never steal focus mid-action. |
| P4 | **Mobile short-height player** | Phone in landscape, or a short-viewport laptop, with the browser chrome eating vertical space. | The board is visible without scrolling under the §8.3 threshold and the compact-board rule; navigation stays reachable; the inspector is scrollable independently of the board; nothing critical is pushed below the fold. |

### 8.5 Accessibility constraints

Each row is an individually reviewable, testable constraint. Removing a row is a contract break and
the validator fails.

| ID | Constraint | Verification |
| --- | --- | --- |
| A11Y-01 | The product targets **WCAG 2.2 AA** as its conformance floor across every route and every primitive state. | `axe` scan per route in the accessibility spec; zero violations at `serious` or above. |
| A11Y-02 | Every interactive target has a hit area of at least **44px** by 44px, with at least 8px separation from adjacent targets. | Bounding-box measurement of every focusable element at `375x812` in the touch-target spec. |
| A11Y-03 | Focus is always **visible**: a 2px `--border-focus` ring at `2px` offset, never removed, never color-change-only, and never clipped by an ancestor's overflow. | Keyboard walk of every route capturing the focused element's computed outline. |
| A11Y-04 | A **`prefers-reduced-motion`** path exists for every animation; no information is available only through motion. | Playwright run with `reducedMotion: 'reduce'` asserting durations collapse and every state remains legible. |
| A11Y-05 | No state, grade, or result is conveyed by color alone — every one pairs color with an icon, glyph, shape, or word (**non-color cues**). | Grayscale-forced screenshot review plus DOM assertions that each status carries text. |
| A11Y-06 | Text and layout survive **200%** browser zoom and a 200% OS text size with no horizontal scroll, no clipping, and no lost control. | Zoom spec at `1280x800` and `375x812`; assert `scrollWidth <= clientWidth`. |
| A11Y-07 | Asynchronous results are announced through **live regions**: `aria-live="polite"` for status and toasts, `role="alert"` for errors. Toasts never move focus. | Accessibility-tree assertions after engine boot, move commit, copy-PGN, and engine failure. |
| A11Y-08 | A **screen-reader board alternative** exposes, as text, the side to move, the full piece placement, the selected square and its legal destinations, the last move, check and result state, and the operating instructions — and updates on every position change. | Accessible-snapshot assertions after `e4`, after a check, after a promotion, and after a review jump. |
| A11Y-09 | The board is **keyboard-operable**: a move can be made without a pointer, and `Home`/`End`/`ArrowLeft`/`ArrowRight` browse history without stealing input from form controls. | Keyboard-only game spec playing and browsing a full sequence. |
| A11Y-10 | Dialogs move focus in on open, **trap** focus while open, close on `Escape`, and **restore** focus to the invoking element on close. | Onboarding and promotion dialog specs asserting focus identity before, during, and after. |
| A11Y-11 | Every form control has a programmatically associated **label**; every icon-only control has an accessible name; no control relies on `title` alone. | Accessibility-tree assertion that no focusable element has an empty accessible name. |
| A11Y-12 | The page exposes **landmarks and headings**: one `<main>`, a labeled `<nav>`, a skip link to main content, and one `<h1>` per route with a correct heading order. | Landmark and heading-order assertions per route. |

### 8.6 Contrast floor

| Pair | Measured | Requirement |
| --- | --- | --- |
| `--text-primary` on `--canvas-base` | 15.7:1 | ≥4.5:1 |
| `--text-secondary` on `--canvas-base` | 11.2:1 | ≥4.5:1 |
| `--text-muted` on `--surface-1` | 6.1:1 | ≥4.5:1 |
| `--brass-base` on `--canvas-base` | 7.2:1 | ≥4.5:1 (text) / ≥3:1 (UI edges) |
| `--text-on-brass` on `--brass-base` | 7.2:1 | ≥4.5:1 |
| `--board-coord-on-ivory` on `--board-square-ivory` | 7.5:1 | ≥4.5:1 |
| `--board-coord-on-green` on `--board-square-green` | 4.8:1 | ≥4.5:1 |

A contrast script re-computes this table in todo 9 and fails the build on any regression.

### 8.7 Accepted debt

Debt is recorded here with an owner, a reason, and an exit condition. Nothing is accepted silently.

| ID | Debt | Why accepted | Exit condition |
| --- | --- | --- | --- |
| D-01 | In-board rank/file coordinates may render at 10px, below the §3.2 minimum. | They are a redundant duplicate of information already exposed in the move list and in the A11Y-08 board alternative, and enlarging them obscures the squares. | Revisit if user testing shows players reading coordinates off the board; the tokens already meet the §8.6 contrast floor. |
| D-02 | The board remains imperative DOM driven by `ChessController` rather than React-rendered. | Drag and animation performance depends on direct DOM writes; converting it would risk the product's most-tested behavior for no visual gain. | Only revisit if React's rendering model demonstrably matches the current drag latency. |
| D-03 | `StatusNote` renders trusted controller-produced HTML via `dangerouslySetInnerHTML`. | The string is generated in-process by the controller with no user or network input, and the markup carries the status coloring. | Replace with structured props when `StatusNote` is refactored in todo 11 if the controller can emit structured data cheaply. |
| D-04 | A `window.prompt` fallback remains in the PGN path. | Removing it would change functional behavior, which this plan explicitly forbids. | Replace with a `DialogSurface` in a future functional change, not in this plan. |
| D-05 | The pre-existing Stockfish stop/go WASM race in `Explore` is not fixed. | Out of scope by the plan's guardrails; touching engine lifecycle risks the tested chess behavior. | Tracked separately. The redesign must not worsen it and must not claim refresh behavior the current smoke suite excludes. |
| D-06 | `react-grab`, `react-scan`, and `react-doctor` add devDependency and lockfile surface. | Production bundle cost is 0 bytes — they are development-only dynamic imports and a static scanner — and they are the mandated React audit tooling. | `npm run verify:no-devtools` plus the CI static scan keep production clean; revisit only if a leak is ever detected. |
| D-07 | Fonts are loaded from Google Fonts rather than self-hosted. | Already shipped and preconnected; changing it is only justified by measurement. | Self-host if todo 20 or todo 23 measurement shows font loading costs Lighthouse points or blocks render. |
| D-08 | No motion library is included, so complex shared-element transitions are out of reach. | CSS and WAAPI cover every mechanism this system needs (§6.5), and a library would add bundle cost for decoration. | Only revisit if the primitive showcase proves a required mechanism is inexpressible; the cost must then be recorded here. |
