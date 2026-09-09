# P3 cancellation audit

Source audited: `web/src/core/controller.ts`. Line numbers below come from fresh
`grep -n` output on the P2-stacked `p3-mode-model-refactor` worktree.

## `epoch` (captured-then-compared token)

### Write sites (12)

- `767` — `startTrainerLine`: bumps the token before exiting other modes and starting a trainer line.
- `811` — `startReplay`: bumps the token before review/self-play/trainer teardown and replay setup.
- `868` — `stopReplay`: bumps the token while stopping replay and clearing its pending timer.
- `884` — `watchFullGame`: bumps the token before resetting the board and entering full-game self-play.
- `899` — `startSelfPlay`: bumps the token before replay/trainer teardown and the first engine move.
- `908` — `stopSelfPlay`: bumps the token before clearing self-play and stopping the engine.
- `922` — `watchMovesOut`: bumps the token before mode teardown, loading the supplied line, and starting self-play.
- `949` — `previewLine`: bumps the token before mode teardown and loading a non-engine preview position.
- `1170` — `reviewGame`: bumps the token immediately before capturing the review run's token and starting its async analysis loop.
- `1509` — `annotateOpening`: bumps the token immediately before capturing the annotation run's token and starting its async extension/analysis loop.
- `1681` — `undo`: bumps the token before review teardown and changing the live game position.
- `1704` — `newGame`: bumps the token before all mode/engine teardown and board reset.

### Read sites (6 async capture/check contexts; 12 references)

- `494` / `496` — `applyMove` animation continuation: captures immediately before `animateThen`; its callback compares before rendering and calling `afterMove`, and falls back to `renderAll()` when stale.
- `742` / `749` — `extendCoach` trainer engine-move continuation: captures before `await evalPosition`; after the await it compares the token (and verifies trainer mode still exists) before consuming the engine result.
- `1171` / `1184` — `reviewGame` review loop: captures when the review starts; each async loop iteration compares before updating the review board and awaiting another position evaluation, aborting a stale review.
- `1404` / `1406` — `tryExploreMove` animation continuation: captures before `animateThen`; its callback compares before rendering and starting analysis of the explored position, and falls back to `renderAll()` when stale.
- `1510` / `1537` — `annotateOpening` annotation loop: captures when annotation starts; each loop iteration compares before board updates and `await evalPosition`, aborting stale annotation work.
- `1575` / `1579` — `annotateOpening` final-position continuation: reuses the token captured at `1510`; it guards the optional final `await evalPosition` with an equality check, then compares again after that await and aborts before deriving annotation items if stale.

> **Invariant E1 (epoch):** every base-mode transition and every `newGame` bumps `this.epoch` BEFORE any async continuation is scheduled. Every async continuation that outlives a possible transition captures `const myEpoch = this.epoch` at its start and no-ops (or aborts back to `renderAll()`) if `myEpoch !== this.epoch` at continuation time. P3 preserves each existing capture/check pair BYTE-IDENTICALLY.

## `engineExpected` (persistent gate for onBest)

- `570` — `engineMove`: sets `this.engineExpected = true` before waiting for engine readiness and issuing `go`.
- `591` — `onBest`: early-returns when no human-vs-engine result is expected; this protects the persistent listener from unrelated/stale best-move events.
- `596` — `onBest`: clears the gate on the accepted human-vs-engine success path before applying the engine move.
- `910` — `stopSelfPlay`: clears the gate during self-play teardown before stopping the engine.
- `1707` — `newGame`: clears the gate during new-game teardown before stopping/resetting the engine.

> **Invariant E2 (engineExpected):** the human-vs-engine game path uses `engineExpected` (not `epoch`) to gate `onBest` because `onBest` is a persistent engine listener, not a captured continuation. `engineMove:570` sets it true; `onBest:591` early-returns if false; `onBest:596` clears it on the success path; `stopSelfPlay:910` and `newGame:1707` clear it as teardown. P3 does not touch this mechanism; the six-flag collapse does not include `engineExpected` (which is not a mode flag — it's a callback gate). All 5 sites remain byte-identical.

## Self-check

```sh
bash -c 'test $(grep -c "this\.epoch" web/src/core/controller.ts) -eq 24 && test $(grep -c "this\.engineExpected" web/src/core/controller.ts) -eq 5 && grep -q "Invariant E1" web/.omo/notes/p3-cancellation-audit.md && grep -q "Invariant E2" web/.omo/notes/p3-cancellation-audit.md && echo AUDIT_OK'
```
