# Code Quality Hardening — Learnings

## Todo 7: Type UCI engine listener contract

- Replaced `Engine.on`'s broad `any` callback with event-specific overloads for `best`, `info`, and `boot`.
- `handle` now accepts either raw UCI text or `MessageEvent<string>` and preserves the prior empty-data fallback.
- A discriminated listener-registration tuple lets the implementation assign each listener without assertions or `any`.
- `controller.ts`'s existing `best` and `info` listener callbacks remain compatible without changes.

## Todo 6: Type chess-square arguments and move local

- `chess.js` exports `Square` as the algebraic-square union; casting the existing string values at the four call sites preserves the controller field contracts and runtime behavior.
- The review walker move result is `Move | null`, so the temporary move local can be typed directly without changing its existing null guard.
