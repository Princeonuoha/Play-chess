# Blocked-reason flake: final root cause and fix

## Bottom line

Two independent mechanisms caused the flake. First, typed move entry left the INPUT focused and the window-level keyboard handler intentionally ignores ArrowLeft/End from form controls. Second, after a valid ArrowLeft, the layout's non-Study effect treated the resulting `reviewPly` update as a route departure and immediately called `resumeGame()`, even though the route had not changed.

The fix spans both correct layers: the test waits for the visible/enabled Previous move affordance and focuses that actual keyboard control before sending ArrowLeft; the product now resumes a reviewed position only on a real transition away from Study. Placement checks use Playwright's web-first assertions so they wait for the accessible board render without sleeps or retries.

## Runtime evidence

The final investigation captured the exact focus and handler state:

```text
HISTORY_DEBUG thinking {
  active: 'INPUT',
  previousPresent: false,
  blocked: 'Stockfish is thinking.'
}
HISTORY_DEBUG keydown-listeners ["Z=>{const at=Z.target;at instanceof HTMLElement&&[\"INPUT\",\"SELECT\",\"TEXTAREA\"].includes(at.tagName)||(Z.key===\"ArrowLeft\"?g.navPrev():Z.key===\"ArrowRight\"?g.navNext():Z.key===\"Home\"?g.navFirst():Z.key===\"End\"&&g.navLast())}"]
HISTORY_DEBUG browsable {
  active: 'INPUT',
  previousPresent: true,
  previousDisabled: false,
  blocked: 'It is not your move.'
}
HISTORY_DEBUG input-target-result It is not your move.
```

This proves the handler is registered on `window`, the UI's own browse signal was present and enabled, and the key was dropped because its target was still the move-entry INPUT. Focusing the Previous move button before the same keypress made the test pass.

The repeated test then exposed the product defect. A MutationObserver recorded this sequence after a focused ArrowLeft:

```text
HISTORY_STATE_SEQUENCE ["You are browsing an earlier move. Press End to return to the live position.","It is not your move."]
```

The successful browse state was immediately reset by `ChessWorkspaceLayout`'s effect because it previously called `resumeGame()` for every non-Study `reviewPly` update. The fix records the previous pathname and calls `resumeGame()` only when the route actually transitions from `/study` to another route.

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

## Blocked-reason logic and final test synchronization

The blocked-reason ordering itself was already correct and remains unchanged:

```ts
if (snapshot.analyzing) return 'The position is being analysed.'
if (snapshot.reviewPly !== null) return 'You are browsing an earlier move. Press End to return to the live position.'
if (snapshot.thinking) return 'Stockfish is thinking.'
if (snapshot.statusWho !== 'Your move') return 'It is not your move.'
```

Thus, once history browsing persists, its actionable explanation wins over thinking and turn state. The controller still rejects navigation while thinking:

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

Test synchronization proves both temporal states, waits for the product's real affordance, and places focus on that keyboard control:

```ts
await expect(boardAlt(page, 'blocked')).toContainText('Stockfish is thinking.')
await expect(previous).toBeVisible()
await expect(previous).toBeEnabled()
await previous.focus()
await expect(previous).toBeFocused()
await page.keyboard.press('ArrowLeft')
await expect(boardAlt(page, 'blocked')).toContainText('You are browsing an earlier move')
```

The same visible/enabled preconditions are asserted immediately before End. Both position checks are web-first. No timeout or retry was added.

## Verification summary

- Build: PASS; rebuilt `dist` and `git diff --exit-code -- dist` was clean.
- Typecheck: PASS.
- Unit tests: PASS, 6 files / 133 tests.
- Token verification: PASS.
- Icon verification: PASS.
- No-devtools verification: PASS.
- Isolated `a11y.spec.ts`: PASS 10/10 consecutive runs, 21 tests each.
- Full E2E run 1: PASS — baseline 1, main 170, showcase 3.
- Full E2E run 2: PASS — baseline 1, main 170, showcase 3.
- Full E2E run 3: PASS — baseline 1, main 170, showcase 3.
- Full E2E run 4: PASS — baseline 1, main 170, showcase 3.
- Full E2E run 5: PASS — baseline 1, main 170, showcase 3.
- Axe contract: all four route audit tests (`/play`, `/openings`, `/games`, `/study`) passed in every isolated and full-suite run; each asserts an empty violations array.

Verbatim outputs are stored beside this file.

## Scope and risk

- Product change is narrow: only route-transition cleanup changed; controller APIs, engine lifecycle, chess rules, mount, and message wording remain untouched.
- Browsing now remains available on Play/Openings/Games as the UI advertises. Leaving Study still resumes live play.
- The test's engine stub is configurable only to create a deterministic busy window; all other tests retain the 5 ms default.
- The test now verifies the exact race boundary using rendered state, so slower hosts increase waiting time rather than changing behavior.
