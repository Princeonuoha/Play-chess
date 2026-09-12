/* ---------------------------------------------------------------------------
 * The feedback contract (DESIGN.md 7.3 `DialogSurface` / `Toast` /
 * `EngineStatus` / `InlineFeedback` / `Empty` / `Error`, 8.5 A11Y-04 and
 * A11Y-07; plan todo 19).
 *
 * The defects this locks down are the ones a screenshot cannot see. A
 * promotion overlay that looks right but has no dialog role, no trap and no
 * named choices is unusable with a keyboard. A toast that announces by taking
 * focus destroys the player's place on the board. An engine that fails with no
 * worded explanation and no way back leaves a board that silently refuses to
 * answer. So every assertion below is behavioral: roles, live regions,
 * `document.activeElement`, and the recovery control actually working.
 *
 * The promotion dialog is reached through a real on-board sequence in Explore,
 * never a test-only hook, because the dialog only exists as the answer to a
 * legal promoting move.
 * ------------------------------------------------------------------------- */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const evidenceDir =
  '/Users/prince.onuoha/work/tmp/chess-stockfish/.omo/evidence/frontend-visual-polish/task-19-frontend-visual-polish/screens'

const PHONE = { name: '375', width: 375, height: 812 } as const
const DESKTOP = { name: '1280', width: 1280, height: 800 } as const
const VIEWPORTS = [PHONE, DESKTOP] as const

const PROMOTION_CHOICES = ['Promote to Queen', 'Promote to Rook', 'Promote to Bishop', 'Promote to Knight'] as const

/**
 * White walks the a-pawn to b8 while Black shuffles a knight. Explore accepts
 * legal moves for both colours, so this reaches the promotion dialog without a
 * test-only FEN hook — the same route `tests/baseline.spec.ts` takes.
 */
const TO_PROMOTION = [
  ['a2', 'a4', 'w'], ['b8', 'c6', 'b'], ['a4', 'a5', 'w'], ['g8', 'h6', 'b'], ['a5', 'a6', 'w'],
  ['h6', 'g8', 'b'], ['a6', 'b7', 'w'], ['a7', 'a6', 'b'], ['b7', 'b8', 'w'],
] as const

async function shot(page: Page, name: string): Promise<void> {
  await mkdir(evidenceDir, { recursive: true })
  await page.screenshot({ path: join(evidenceDir, `${name}.png`), fullPage: true })
}

async function dismissIntro(page: Page): Promise<void> {
  const intro = page.getByRole('button', { name: 'Got it' })
  if (await intro.isVisible()) await intro.click()
}

async function move(page: Page, from: string, to: string, color: 'w' | 'b'): Promise<void> {
  const movingPiece = page.locator(`.piece.mine[data-square="${from}"]`)
  await expect(movingPiece).toHaveAttribute('data-color', color)
  await movingPiece.click()
  await page.locator(`.sq[data-square="${to}"]`).click({ force: true })
}

/** The element focus is actually on, described well enough to fail readably. */
async function activeElement(page: Page): Promise<{ tag: string | null; name: string | null; connected: boolean; inDialog: boolean }> {
  return page.evaluate(() => {
    const active = document.activeElement
    return {
      tag: active?.tagName ?? null,
      name: active?.getAttribute('aria-label') ?? active?.textContent?.trim().slice(0, 40) ?? null,
      connected: active?.isConnected ?? false,
      inDialog: active instanceof Element && active.closest('dialog') !== null,
    }
  })
}

/**
 * A `<dialog>` fires `close` on a queued task, so the restoration it triggers
 * lands a beat after the element stops being visible. The settled state is the
 * contract, so it is polled rather than sampled.
 */
async function expectFocusSettledOutsideDialog(page: Page, because: string): Promise<void> {
  await expect
    .poll(async () => {
      const active = await activeElement(page)
      return { inDialog: active.inDialog, connected: active.connected }
    }, { message: because })
    .toEqual({ inDialog: false, connected: true })
}

async function openPromotionDialog(page: Page): Promise<Locator> {
  for (const [from, to, color] of TO_PROMOTION) {
    await move(page, from, to, color)
    if (to !== 'b8') await expect(page.locator(`.piece[data-square="${to}"][data-color="${color}"]`)).toBeVisible()
  }
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

async function enterExplore(page: Page, viewport: (typeof VIEWPORTS)[number]): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.goto('/study')
  await dismissIntro(page)
  await page.getByRole('button', { name: /Explore — play your own moves/ }).click()
  await expect(page.getByText('Exploring — play any moves')).toBeVisible()
}

for (const viewport of VIEWPORTS) {
  test(`promotion is a named, keyboard-operable dialog that returns focus at ${viewport.name}px`, async ({ page }) => {
    // Given a pawn about to promote in Explore, when the choice is demanded, then it arrives as a real dialog.
    await enterExplore(page, viewport)
    const dialog = await openPromotionDialog(page)

    await expect(dialog, 'the dialog names itself from its own heading').toHaveAccessibleName('Promote to')
    await expect(page.getByRole('heading', { name: 'Promote to' })).toBeVisible()
    await expect(page.locator('dialog[open]'), 'exactly one modal is open').toHaveCount(1)

    // Given the four promotion pieces, when each is read, then it is named rather than left as bare artwork.
    for (const name of PROMOTION_CHOICES) {
      await expect(dialog.getByRole('button', { name, exact: true }), `${name} is an accessibly named choice`).toBeVisible()
    }
    await expect(dialog.getByRole('button', { name: 'Cancel promotion' })).toBeVisible()
    await shot(page, `promotion-${viewport.name}`)

    // Given the dialog opened, when focus is measured, then it is inside and on the default choice.
    await expect(dialog.getByRole('button', { name: 'Promote to Queen', exact: true })).toBeFocused()

    // Given repeated Tab presses, when the last control is passed, then focus wraps instead of escaping to the page.
    for (let tab = 0; tab < 8; tab += 1) {
      await page.keyboard.press('Tab')
      expect((await activeElement(page)).inDialog, `focus escaped the trap after ${tab + 1} tabs`).toBe(true)
    }

    // Given Escape, when the dialog closes, then the pawn goes back and focus lands on a live element outside it.
    const beforeClose = await activeElement(page)
    expect(beforeClose.inDialog).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.locator('.piece[data-square="b7"]'), 'cancelling returns the pawn to the square it came from').toHaveCount(1)
    await expect(page.locator('.piece[data-square="b8"]')).toHaveCount(0)
    await expectFocusSettledOutsideDialog(page, 'a dismissed dialog must hand focus back to the document')

    // Given the move re-offered — a cancelled promotion leaves the pawn selected, so tapping the
    // square again re-asks — when a choice is taken with the keyboard alone, then that exact piece is promoted.
    await page.locator('.sq[data-square="b8"]').click({ force: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Promote to Queen', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Promote to Rook', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(page.getByText(/b8=R/), 'the keyboard choice is the piece the rules were given').toBeVisible()
    await expectFocusSettledOutsideDialog(page, 'a resolved dialog must not keep focus')
  })
}

test.describe('toast', () => {
  test.use({ permissions: ['clipboard-write'] })

  for (const viewport of VIEWPORTS) {
    test(`announces a clipboard success politely without moving focus at ${viewport.name}px`, async ({ page }) => {
      // Given a game with a move in it, when the PGN is copied, then the result is announced and the player's place is untouched.
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/play')
      await dismissIntro(page)
      await page.getByRole('button', { name: 'New game' }).click()
      await move(page, 'e2', 'e4', 'w')
      await expect(page.locator('.piece[data-square="e4"]')).toBeVisible()
      await page.getByRole('link', { name: 'Study', exact: true }).click()

      const copy = page.getByRole('button', { name: 'Copy PGN' })
      await copy.click()
      await page.evaluate(() => {
        ;(window as unknown as { __focusAtRequest?: Element | null }).__focusAtRequest = document.activeElement
      })

      const polite = page.locator('[data-toast-lane="polite"]')
      await expect(polite, 'routine confirmations wait their turn').toHaveAttribute('aria-live', 'polite')
      await expect(polite.getByText('PGN copied to clipboard')).toBeVisible()
      await shot(page, `toast-success-${viewport.name}`)

      // Given the toast on screen, when focus is measured, then it is exactly where the player left it.
      expect(
        await page.evaluate(
          () => document.activeElement === (window as unknown as { __focusAtRequest?: Element | null }).__focusAtRequest,
        ),
        'a toast must never take focus',
      ).toBe(true)
      await expect(copy).toBeFocused()

      // Given the dismiss control, when it is used, then the toast goes and focus is not handed to anything new.
      const dismiss = polite.getByRole('button', { name: 'Dismiss notification' })
      await dismiss.click()
      await expect(polite.locator('.ui-toast')).toHaveCount(0)
      const afterDismiss = await activeElement(page)
      expect(afterDismiss.connected, 'dismissal must not strand focus on a removed node').toBe(true)
    })
  }

  test('announces a clipboard failure assertively, still without moving focus', async ({ page }) => {
    // Given a clipboard that refuses, when the PGN is copied, then the refusal interrupts and the documented prompt fallback still offers the text.
    await page.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true,
        value: () => Promise.reject(new Error('clipboard blocked for the failure path')),
      })
    })
    const prompts: string[] = []
    page.on('dialog', (dialog) => {
      prompts.push(dialog.type())
      void dialog.dismiss()
    })

    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height })
    await page.goto('/play')
    await dismissIntro(page)
    await page.getByRole('button', { name: 'New game' }).click()
    await move(page, 'e2', 'e4', 'w')
    await expect(page.locator('.piece[data-square="e4"]')).toBeVisible()
    await page.getByRole('link', { name: 'Study', exact: true }).click()

    const copy = page.getByRole('button', { name: 'Copy PGN' })
    await copy.click()

    const assertive = page.locator('[data-toast-lane="assertive"]')
    await expect(assertive, 'a failure is allowed to interrupt').toHaveAttribute('aria-live', 'assertive')
    await expect(assertive.getByText(/Couldn’t reach the clipboard/)).toBeVisible()
    await expect(page.locator('[data-toast-lane="polite"] .ui-toast'), 'a failure never reads as a confirmation').toHaveCount(0)
    await shot(page, 'toast-failure-1280')
    await expect(copy, 'even an interrupting toast leaves focus alone').toBeFocused()
    await expect.poll(() => prompts, { timeout: 5_000 }).toEqual(['prompt'])
  })
})

test.describe('engine state', () => {
  test('reports a boot failure in language and recovers through its own retry', async ({ page }) => {
    // Given an engine that cannot load, when the workspace settles, then the failure is announced with a way back.
    let blocked = true
    await page.route('**/stockfish-18-lite-single.js*', async (route) => {
      if (blocked) await route.abort('failed')
      else await route.continue()
    })

    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height })
    await page.goto('/play')
    await dismissIntro(page)

    const failure = page.getByRole('alert')
    await expect(failure).toBeVisible({ timeout: 40_000 })
    await expect(failure).toContainText('Engine failed')
    await expect(failure, 'the consequence is stated, not implied').toContainText('will not reply to your moves')
    await expect(page.locator('header [role="status"]')).toContainText('engine failed to load')
    await shot(page, 'engine-failure-1280')

    // Given the retry control, when it is used against a reachable engine, then the board gets its opponent back.
    blocked = false
    await failure.getByRole('button', { name: 'Retry' }).click()
    await expect(page.locator('header [role="status"]')).toContainText('Stockfish 18', { timeout: 40_000 })
    await expect(page.getByRole('button', { name: 'Retry' }), 'a recovered engine leaves no stale failure behind').toHaveCount(0)
  })

  test('keeps the engine wait in the header, so the panel never shifts under the player', async ({ page }) => {
    // Given an engine whose script never arrives, when the workspace renders, then the wait is named and marked busy where it costs no layout.
    await page.route('**/stockfish-18-lite-single.js*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 60_000))
      await route.abort('failed')
    })

    await page.setViewportSize({ width: PHONE.width, height: PHONE.height })
    await page.goto('/play')
    await dismissIntro(page)

    const pill = page.locator('header [role="status"]')
    await expect(pill).toContainText('loading engine…')
    await expect(pill).toHaveAttribute('aria-busy', 'true')
    await expect(pill.locator('.ui-spinner'), 'the wait carries the primitive spinner').toHaveCount(1)
    await expect(
      page.locator('[data-shell="engine-state"]'),
      'a block that appears for the boot and then leaves would shift the panel',
    ).toHaveCount(0)
    await shot(page, 'engine-loading-375')
  })
})

test.describe('empty and error states', () => {
  for (const viewport of VIEWPORTS) {
    test(`a search with no results explains itself and offers a way out at ${viewport.name}px`, async ({ page }) => {
      // Given a library search that matches nothing, when it returns, then the region says why and hands back a recovery control.
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/games')
      await dismissIntro(page)

      const search = page.getByPlaceholder('player, opening, e.g. Fischer or Berlin')
      await search.fill('zzzz-no-such-game')
      const empty = page.locator('.ui-stateblock').filter({ hasText: 'zzzz-no-such-game' })
      await expect(empty).toBeVisible()
      await shot(page, `empty-${viewport.name}`)

      await empty.getByRole('button', { name: 'Clear search' }).click()
      await expect(empty).toHaveCount(0)
      await expect(search).toHaveValue('')
    })
  }

  test('a fresh Study route reports its empty regions instead of rendering blanks', async ({ page }) => {
    // Given a workspace with no game yet, when Study opens, then the scoresheet and the analysis both say what is missing.
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height })
    await page.goto('/study')
    await dismissIntro(page)

    await expect(page.getByText(/No moves yet\./)).toBeVisible()
    await page.getByRole('group', { name: 'Study surface' }).getByRole('button', { name: 'Analysis', exact: true }).click()
    await expect(page.getByText(/No lines yet\./)).toBeVisible()
  })

  test('an unknown workspace path recovers through an empty state rather than a blank shell', async ({ page }) => {
    // Given an address that is not a workspace, when it loads, then the shell explains it and offers the way back.
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height })
    await page.goto('/not-a-workspace')
    await dismissIntro(page)

    const empty = page.locator('.ui-stateblock')
    await expect(empty).toContainText('not one of the four workspaces')
    await shot(page, 'empty-unknown-route-1280')
    await empty.getByRole('button', { name: 'Go to Play' }).click()
    await expect(page).toHaveURL(/\/play$/)
    await expect(page.locator('.board')).toHaveCount(1)
  })

  test('a failed opening database keeps its plain-language error and its retry', async ({ page }) => {
    // Given a database request that fails, when the route renders, then the error is worded and recoverable.
    await page.route('**/openings.json', (route) => route.abort('failed'))
    await page.setViewportSize({ width: PHONE.width, height: PHONE.height })
    await page.goto('/openings')
    await dismissIntro(page)

    const failure = page.getByRole('alert')
    await expect(failure).toBeVisible()
    await expect(failure).toContainText('Couldn’t load the opening database')
    await expect(failure.getByRole('button', { name: 'Retry' })).toBeVisible()
    await shot(page, 'error-375')
  })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce', permissions: ['clipboard-write'] })

  test('collapses every dialog and toast animation while keeping both legible', async ({ page }) => {
    // Given a player who asked for less motion, when a dialog and a toast appear, then they arrive without travel and still read.
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height })
    await page.goto('/play')

    const guide = page.getByRole('dialog')
    await expect(guide).toBeVisible()
    expect(await animation(guide), 'the dialog rise must collapse under reduced motion').toEqual({ collapsed: true, iterations: '1' })
    await expect(guide.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    await dismissIntro(page)

    await page.getByRole('button', { name: 'New game' }).click()
    await move(page, 'e2', 'e4', 'w')
    await expect(page.locator('.piece[data-square="e4"]')).toBeVisible()
    await page.getByRole('link', { name: 'Study', exact: true }).click()
    await page.getByRole('button', { name: 'Copy PGN' }).click()

    const toast = page.locator('.ui-toast').first()
    await expect(toast).toBeVisible()
    expect(await animation(toast), 'the toast rise must collapse under reduced motion').toEqual({ collapsed: true, iterations: '1' })
    await expect(toast).toContainText('PGN copied to clipboard')
    await shot(page, 'reduced-motion-1280')
  })
})

async function animation(locator: Locator): Promise<{ collapsed: boolean; iterations: string }> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    const raw = style.animationDuration
    const ms = raw.endsWith('ms') ? Number.parseFloat(raw) : Number.parseFloat(raw) * 1000
    return { collapsed: ms <= 0.01, iterations: style.animationIterationCount }
  })
}
