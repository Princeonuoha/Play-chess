# Task 10 — Standardize SVG iconography, remove structural glyph controls

Plan: `.omo/plans/frontend-visual-polish.md` todo 10. Branch `frontend-visual-polish`,
worktree `/Users/prince.onuoha/work/tmp/chess-stockfish-worktrees/frontend-visual-polish`.

## What shipped

| Deliverable | Where |
| --- | --- |
| The one icon family (local typed SVG, no dependency) | `web/src/ui/icons.tsx` — `Icon`, `IconButton`, `IconLabel`, `IconName`, `IconSize`, 14 marks |
| Icon gate | `web/scripts/verify-icons.mjs`, wired as `npm run verify:icons` and into `verify:design` **and `build`** |
| Contract record | `DESIGN.md` 5.1 (family chosen + module path) and 5.4 (the surviving domain glyphs, by site) |

`web/src/workspace/WorkspaceChrome.tsx`'s todo-7 `NavIcon` was absorbed into the module rather than
duplicated: the navigation artwork is byte-identical, now sourced from `ICON_ARTWORK`, and the
onboarding cards draw the same mark as the destination they link to.

## Glyphs replaced

| Site | Before | After |
| --- | --- | --- |
| Header help control | `?` text | `Icon name="help"` |
| Move transport (x4) | `⏮ ◀ ▶ ⏭` | `IconButton` `skip-back` / `chevron-left` / `chevron-right` / `skip-forward` |
| Transport keyboard hint | `· use ← →` | `· use the arrow keys` |
| Onboarding cards (x4) | `♟ 📖 🏆 🔎` | `circle-play` / `book` / `trophy` / `search` |
| Onboarding card affordance | `→` | `chevron-right` |
| Onboarding prose | `the ◀ ▶ buttons` | inline `chevron-left` + `chevron-right` |
| Play / Games / Openings watch controls | `▶ Watch…`, `■ Stop…` | `IconLabel` `play` / `stop` + unchanged words |
| Study explore | `↔ Explore — play your own moves` | `IconLabel` `explore` |
| Study back-to-position | `← Back to final position` | `IconLabel` `arrow-left` |
| Study better-move marker | `▸ Qg5` | `arrow-right` + `sr-only` "Better move:" |
| Openings back | `‹ Back to list` | `IconLabel` `chevron-left` |
| Openings breadcrumb | `variation › subline` | `variation · subline` |
| Trainer "book move played" status | `▸ Nf3 — book.` | `• Nf3 — book.` (`web/src/core/controller.ts`, display string only) |
| Games DB note prose | `a7 → d1` | `a7 all the way to d1` (`web/src/core/book.ts`) |

Kept as text under DESIGN.md 5.4, now rendered in `--type-font-numeric` and `aria-hidden` where the
spelled grade is already visible: `★` Best, `✓` Good / book move, `✗` off book, `?!`, `?`, `??`.
The gate allows exactly `U+2605`, `U+2713`, `U+2717` and nothing else. `StudyPanel`'s duplicate
`LABEL_ICON` map was deleted in favour of `GRADE_GLYPH` from `web/src/core/controller.ts`, so the
documented exception now has exactly one declaration feeding both the board badge and the panel.

## Runtime proof (`before/report.json` vs `after/report.json`)

Captured by `capture-icon-evidence.mjs` against two static servers: the pre-task build
(`git archive 54c1e82 dist`) and the rebuilt `dist/`.

| Measure | Before | After |
| --- | --- | --- |
| Banned glyphs in the first-visit DOM | `U+265F`x1 `U+2192`x4 `U+1F4D6` `U+1F3C6` `U+1F50E` `U+25C0` `U+25B6`x3 | **none** |
| Banned glyphs in the workspace DOM | `U+23EE` `U+25C0` `U+2190` `U+2192` `U+25B6` `U+23ED` `U+2194` | **none** |
| "How it works" hit area | 32x32 | 44x44 |
| Transport hit areas (x4) | 36x36 | 44x44 |
| Icon-only controls without an accessible name | (promotion dialog x4) | 0 — every one is named |
| Rendered `svg[data-icon]` stroke widths | n/a | one: `1.75px` |
| Rendered `svg[data-icon]` grids | n/a | one: `0 0 24 24` |
| Rendered icon sizes | n/a | `20px` (`--icon-size-md`), `16px` (`--icon-size-sm`) |

Accessible names are preserved verbatim minus the glyph: `▶ Watch this game` -> `Watch this game`,
`■ Stop replay` -> `Stop replay`, `↔ Explore — play your own moves` -> `Explore — play your own
moves`. `web/tests/smoke.spec.ts` was retargeted to the delabelled names (5 selectors).
The promotion dialog's four piece buttons gained `aria-label="Promote to Queen|Rook|Bishop|Knight"`
plus the 44px floor; they previously had no accessible name at all.

Screenshots: `before/` and `after/`, routes `01-intro` / `02-openings` / `03-games` / `04-study`
at 1280 and 375 CSS px.

## Bundle impact (`bundle-delta.txt`)

No dependency added. `+3,159 B` raw / `+586 B` gzip total (JS `+3,204 B` raw / `+594 B` gzip;
CSS `-45 B` raw / `-8 B` gzip — the deleted `h-5 w-5` icon utilities). Measured against the
pre-task build `54c1e82`.

## Gate failure proof (`icon-audit-failure-proof.txt`)

Four deliberate regressions, each reverted and re-proven green:

| Injection | Rule fired | Exit |
| --- | --- | --- |
| `📖` back in an onboarding card header | `structural-glyph U+1F4D6` + `glyph-only-control` | 1 |
| `strokeWidth: '2'` in the family `<svg>` | `mixed-stroke` + `module-contract` | 1 |
| Inline `<svg viewBox="0 0 20 20" strokeWidth={1.5}/>` in a panel | `stray-icon-source` x3 + `mixed-stroke` + `mixed-geometry` | 1 |
| Bare `?` back in the header control | `glyph-only-control` | 1 |

Clean tree before and after: `verify-icons: PASS — 21 files, 14 icons from src/ui/icons.tsx,
stroke var(--icon-stroke), grid 0 0 24 24, 3 documented DESIGN.md 5.4 glyph(s).`

## Gate scope

Scans `web/src/**` (`.ts`, `.tsx`, `.css`) plus `web/index.html`. Excluded, each for a stated
reason: `src/dev/**` is the dev-only DESIGN.md 7.3 showcase reachable only through `showcase.html`,
which `vite build` never bundles (`grep -rl sc-icon dist` finds nothing); `__tests__`/`tests` assert
on raw values by design; `src/core/pieces.ts` is the project's original board artwork, allowlisted
exactly as `verify-token-compliance.mjs` allowlists it. Comments are stripped before scanning — a
comment is not interface furniture.

## Commands

```
npm --prefix web run typecheck                  PASS
npm --prefix web test                           127 passed (6 files)
npm --prefix web run verify:tokens              PASS — 98/98 tokens, 21 deferrals
npm --prefix web run verify:icons               PASS — 14 icons, one stroke, one grid
npm --prefix web run build                      PASS (verify:icons runs first)
npm --prefix web run verify:no-devtools         PASS
git diff --exit-code -- dist                    clean
npx playwright test --project=chromium --no-deps \
  tests/routes.spec.ts tests/navigation.spec.ts tests/smoke.spec.ts
                                                20 passed (routes 12, navigation 7, smoke 1)
```

Run twice: once before and once after the `GRADE_GLYPH` dedupe, 20 passed both times.

`baseline.spec.ts` and `showcase.spec.ts` were not run: another worker owns them, plus
`playwright.config.ts` and `.github/workflows/ci.yml`, and the chromium project declares a
`baseline` dependency, so `--no-deps` was used to stay out of their repair.

`.github/workflows/ci.yml` is fenced, so `verify:icons` was wired into `build` — the one script CI
already runs — rather than added as a CI step.
