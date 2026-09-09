# Code Quality Hardening — Learnings

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
