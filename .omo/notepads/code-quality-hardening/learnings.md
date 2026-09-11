# Code Quality Hardening — Learnings

## Todo 29: Extract StudyPanel

- **The Stockfish/GPLv3 notice is NOT in the Study block.** It lives in `App.tsx`'s shared page
  `<footer>` (outside every `tab === …` branch), so per the todo's own conditional it stayed in
  `App.tsx` completely untouched — `git diff` shows zero `+`/`-` lines in the footer. A doc comment
  in `StudyPanel.tsx` records where it lives so a future extractor does not go looking for it.
- Study-only helpers moved verbatim into `StudyPanel.tsx`: `LABEL_STYLE`, `LABEL_ICON`,
  `reviewComment`, `formatMovesFrom`. Every one had exactly zero non-Study readers, and leaving
  them in `App.tsx` would have forced the panel to import `App.tsx` — the circular import
  `ui/primitives.tsx` exists to prevent. Nothing new was added to `ui/primitives.tsx`: the Study
  block's only shared primitive is `Btn`, already there since todo 26. `Card`/`NavBtn` stay in
  `App.tsx` because only App's own chrome (panel shell, board scrubber) uses them.
- The Study-tagged derived values from the P4 audit (`review`, `exploreMoves`, `rows`, `copyPGN`)
  are recomputed inside the panel from `snap`/`history` rather than passed down, so `App` now
  derives only what its own chrome reads. `exploring`, `reviewPly` and `history` **stay** in `App`
  and travel as props: the board scrubber's `canBrowse` guard and the ply readout share them.
- `copyPGN` moved with the tab but `showToast` did not — `App` owns the `toast` state and its
  fixed-position toast element, so the panel takes `showToast` as a prop.
- Verified the extraction is structural only: normalizing indentation and rewriting `ctrl.` →
  `controller.`, the 219 JSX lines diff **clean** against the old block — zero className, copy, or
  handler changes.
- `App.tsx` 682 → 406 LOC, already under todo 30's ≤ 500 target before todo 30 runs.
- Pre-existing dead code spotted, deliberately **not** touched here to keep this commit a pure
  extraction: `openingGroups()` (and with it the `type Group` import) in `App.tsx` has had no
  callers since todo 27 moved the Openings tab out. `noUnusedLocals` is `false` in
  `web/tsconfig.json`, so `tsc` does not flag it. Worth deleting in a follow-up.

## Todo 27: Extract TrainPanel

- The `tab === 'train'` block is only 11 lines because the whole tab body was already a
  self-contained `OpeningsExplorer` component living in `App.tsx`. There is no `SessionView`
  in this codebase — the plan's `setHints`/`startTrainerLine` wiring is internal to the explorer,
  so `TrainPanel` needs no extra handler props.
- `OpeningsExplorer` had to move out of `App.tsx` with the panel: a `TrainPanel` that imported it
  from `../App` would be the exact circular import that `ui/primitives.tsx` exists to prevent.
  It moved **verbatim** (354 lines, byte-identical), so its six `useState`/one `useEffect`/three
  `useMemo` calls are still the explorer's own local state — no hook left or entered `App()`.
  A diff of the `App()` body before/after shows only the `<OpeningsExplorer>` → `<TrainPanel>`
  JSX swap.
- `formatMoves` is Train-only and moved into `TrainPanel.tsx`; `StatusNote` is shared with the
  Games tab, so it moved to `ui/primitives.tsx` per the todo-26 note. Both are byte-identical and
  the Games call site is untouched.
- `App.tsx` also dropped its now-unused `./core/openings` and `COACH` imports and the
  `SessionSlot`/`AnnotationState` type imports; `SetKey` stays (App's `watchLabel` still uses it).
- Result: `App.tsx` 1228 → 836 LOC, which is what makes todo 30's ≤ 500 target reachable once
  Games and Study extract.

## Todo 26: Extract PlayPanel

- The Play block consumes two of App's local styled primitives (`Btn`, `Field`). Importing them
  from `App.tsx` into a panel would create a circular import, so both moved verbatim into a new
  shared `web/src/ui/primitives.tsx`. Todos 27–29 should pull from that module too, and can move
  `Card` / `NavBtn` there as their panels need them. ClassNames and tokens were not touched.
- Play-tagged computed values (`diff`, `finishLabel`, `fullLabel` per the P4 audit) are passed as
  props rather than recomputed, so `App` stays the single owner of `elo`/`tt`/`sideChoice` state.
- `snap` is passed whole (per the plan's prop list) and `selfPlay` is derived inside the panel,
  matching how `App` derives it — no behavioral difference.
- Normalized diff of the old block vs the new panel body shows handler-wiring substitutions only:
  zero className, copy, or structural changes.

## Todo 7: Type UCI engine listener contract

- Replaced `Engine.on`'s broad `any` callback with event-specific overloads for `best`, `info`, and `boot`.
- `handle` now accepts either raw UCI text or `MessageEvent<string>` and preserves the prior empty-data fallback.
- A discriminated listener-registration tuple lets the implementation assign each listener without assertions or `any`.
- `controller.ts`'s existing `best` and `info` listener callbacks remain compatible without changes.

## Todo 6: Type chess-square arguments and move local

- `chess.js` exports `Square` as the algebraic-square union; casting the existing string values at the four call sites preserves the controller field contracts and runtime behavior.
- The review walker move result is `Move | null`, so the temporary move local can be typed directly without changing its existing null guard.
