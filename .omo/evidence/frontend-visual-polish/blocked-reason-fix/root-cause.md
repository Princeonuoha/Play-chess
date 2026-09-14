# Blocked-reason flake: root cause and fix

## Bottom line

The proposed product-precedence bug is refuted. The product already reports history browsing before either engine-thinking or turn-state reasons; the flaky test sometimes pressed ArrowLeft while the controller deliberately disabled history navigation during engine thinking, so the input was ignored and the board remained live.

The fix is at the test layer: hold the stubbed engine in its thinking state long enough to observe that state, then use a web-first assertion on the Previous move control before sending ArrowLeft. This waits for the product's actual `canBrowse` signal rather than a timeout and preserves the assertions for both the earlier and live positions.

## Runtime evidence

With `bestmove (none)` delayed to 750 ms, the uncorrected test failed on its first targeted run:

```text
Locator: locator('[data-board-alt="blocked"]')
Expected substring: "You are browsing an earlier move"
Received string:    "It is not your move."
...
5 × locator resolved to <p data-board-alt="blocked">Stockfish is thinking.</p>
9 × locator resolved to <p data-board-alt="blocked">It is not your move.</p>
```

This transition proves the board stayed live: it first exposed the busy reason, then the opponent-turn reason after the stub answered. It never had `reviewPly` set by ArrowLeft. Full output is in `red-delayed-engine.log`.

The corrected targeted run passed in 2.2 seconds; full output is in `green-targeted.log`.

## Blocked-reason logic: before and after

There is intentionally no product-code change. This ordering was already correct before the fix and remains correct after it:

```ts
if (snapshot.analyzing) return 'The position is being analysed.'
if (snapshot.reviewPly !== null) return 'You are browsing an earlier move. Press End to return to the live position.'
if (snapshot.thinking) return 'Stockfish is thinking.'
if (snapshot.statusWho !== 'Your move') return 'It is not your move.'
```

Thus, once history browsing exists, its actionable explanation wins over thinking and turn state. The controller remains read-only and still rejects navigation while thinking:

```ts
private canBrowse() {
  return (
    this.activeMode.kind !== 'selfPlay' &&
    this.activeMode.kind !== 'replay' &&
    !this.thinking &&
    !this.animating &&
    this.activeMode.kind !== 'explore' &&
    this.game.history().length > 0
  )
}
```

Test synchronization changed from immediately pressing ArrowLeft after the move to proving both temporal states and waiting on the real UI affordance:

```ts
await expect(boardAlt(page, 'blocked')).toContainText('Stockfish is thinking.')
await expect(page.getByRole('button', { name: 'Previous move' })).toBeVisible()
await page.getByRole('heading', { level: 1 }).click()
await page.keyboard.press('ArrowLeft')
await expect(boardAlt(page, 'blocked')).toContainText('You are browsing an earlier move')
```

After End, the existing assertion still proves the live-position order reports `It is not your move.`. No timeout or retry was added.

## Verification summary

- Build: PASS; rebuilt `dist` and `git diff --exit-code -- dist` was clean.
- Typecheck: PASS.
- Unit tests: PASS, 6 files / 133 tests.
- Token verification: PASS.
- Icon verification: PASS.
- No-devtools verification: PASS.
- Full E2E run 1: PASS — baseline 1, main 170, showcase 3.
- Full E2E run 2: PASS — baseline 1, main 170, showcase 3.
- Full E2E run 3: PASS — baseline 1, main 170, showcase 3.
- Axe contract: all four route audit tests (`/play`, `/openings`, `/games`, `/study`) passed in each full run; each asserts an empty violations array.

Verbatim outputs are stored beside this file.

## Scope and risk

- Product risk is minimal: no product source, controller API, engine lifecycle, chess rule, mount, or message wording changed.
- The test's engine stub is configurable only to create a deterministic busy window; all other tests retain the 5 ms default.
- The test now verifies the exact race boundary using rendered state, so slower hosts increase waiting time rather than changing behavior.
