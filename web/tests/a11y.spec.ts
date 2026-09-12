/* ---------------------------------------------------------------------------
 * The accessibility contract (DESIGN.md 8.4 personas, 8.5 A11Y-01..A11Y-12,
 * plan todo 21).
 *
 * Every assertion here is written against a persona rather than a rule number:
 *
 *   P1 low vision            → axe, 200% zoom, non-colour cues
 *   P2 keyboard-only         → skip link, landmarks, focus, a whole move typed
 *   P3 temporary motor limit → 44px targets measured while focused
 *   P4 short-height mobile   → the console never displaces the board
 *
 * The engine is stubbed to a minimal UCI responder for the same reason
 * `board.spec.ts` stubs it: the Explore surface this suite drives runs into the
 * pre-existing Stockfish stop/go WASM race DESIGN.md 8.7 records as D-05, which
 * this plan forbids fixing. Stubbing the worker exercises the real controller,
 * the real board, and the real accessible surface without betting the suite on
 * a known-racy engine lifecycle.
 * ------------------------------------------------------------------------- */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

/** DESIGN.md 8.5 A11Y-02. */
const TARGET_MIN = 44

const ROUTES = ['/play', '/openings', '/games', '/study'] as const

/** DESIGN.md 8.5 A11Y-01 names WCAG 2.2 AA as the floor; best-practice is carried too. */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

const UCI_STUB = `self.onmessage = (event) => {
  const cmd = String(event.data || '')
  if (cmd === 'uci') self.postMessage('uciok')
  else if (cmd === 'isready') self.postMessage('readyok')
  else if (cmd.slice(0, 2) === 'go') setTimeout(() => self.postMessage('bestmove (none)'), 5)
}`

async function stubEngine(page: Page): Promise<void> {
  await page.route('**/stockfish-18-lite-single.js*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: UCI_STUB }),
  )
}

async function openWorkspace(page: Page, route: string = '/play'): Promise<void> {
  await page.goto(route)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.locator('.board .piece').first().waitFor()
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible()) await gotIt.click()
  await expect(gotIt).toBeHidden()
}

const consoleEntry = (page: Page): Locator => page.locator('[data-board-alt="entry"]')

const boardAlt = (page: Page, part: string): Locator => page.locator(`[data-board-alt="${part}"]`)

async function placement(page: Page): Promise<string> {
  return ((await boardAlt(page, 'placement').textContent()) ?? '').replace(/\s+/g, ' ').trim()
}

/** Types one instruction into the board console and submits it with the keyboard only. */
async function type(page: Page, text: string): Promise<void> {
  const entry = consoleEntry(page)
  await entry.focus()
  await entry.fill(text)
  await page.keyboard.press('Enter')
}

/**
 * Waits until the board has finished travelling the piece.
 *
 * The last-move brackets are drawn by the render that runs when the animation
 * ends, so they are the one signal that says the board will accept input again.
 * The accessible summary is NOT that signal: the controller records a move
 * before it animates it, so an engine-analysis snapshot arriving mid-flight can
 * publish the new move while the board is still busy.
 */
async function settled(page: Page, on: string): Promise<void> {
  const square = await page
    .locator(`.board .sq[data-square="${on}"]`)
    .evaluate((node) => ({ left: (node as HTMLElement).offsetLeft, top: (node as HTMLElement).offsetTop }))
  const last = page.locator('.board .hl.last')
  await expect(last).toHaveCount(2)
  await expect(last.nth(1)).toHaveJSProperty('offsetLeft', square.left)
  await expect(last.nth(1)).toHaveJSProperty('offsetTop', square.top)
}

async function playTyped(page: Page, text: string, spoken: string, on: string): Promise<void> {
  await type(page, text)
  await expect(boardAlt(page, 'summary')).toContainText(`Last move ${spoken}`)
  await settled(page, on)
}

async function startExplore(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Explore/i }).first().click()
  await expect(boardAlt(page, 'blocked')).toBeHidden()
}

/** Every element the Tab key can reach, in document order. */
const TABBABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'

test.describe('workspace accessibility contract', () => {
  test.describe.configure({ timeout: 90_000 })

  test.beforeEach(async ({ page }) => {
    await stubEngine(page)
  })

  /* ----------------------------------------------- A11Y-01 automated audit */
  for (const route of ROUTES) {
    test(`passes an axe audit on ${route}`, async ({ page }) => {
      // Given a booted workspace, when axe scans the route, then it reports no violation at any level.
      await openWorkspace(page, route)

      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()

      const summary = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => node.target.join(' ')),
      }))
      expect(summary, `axe violations on ${route}`).toEqual([])
    })
  }

  /* --------------------------------------------------- A11Y-12 landmarks */
  for (const route of ROUTES) {
    test(`exposes landmarks, one heading order, and a working skip link on ${route}`, async ({ page }) => {
      // Given each route, when its structure is read, then the landmarks and the skip link are all present and correct.
      await openWorkspace(page, route)

      await expect(page.getByRole('banner')).toHaveCount(1)
      await expect(page.getByRole('main')).toHaveCount(1)
      await expect(page.getByRole('contentinfo')).toHaveCount(1)
      await expect(page.getByRole('navigation', { name: 'Workspace' })).toHaveCount(1)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)

      const skip = page.getByRole('link', { name: 'Skip to the board' })
      await expect(skip).toHaveAttribute('href', '#workspace-main')
      const parked = await skip.boundingBox()
      expect(parked?.y ?? 0, 'the skip link is out of the composition until it is focused').toBeLessThan(0)

      await page.keyboard.press('Tab')
      await expect(skip).toBeFocused()
      await expect(skip, 'a focused skip link must be on screen').toBeInViewport()
      await expect
        .poll(async () => (await skip.boundingBox())?.height ?? 0, { message: 'the skip link is a real target' })
        .toBeGreaterThanOrEqual(TARGET_MIN)

      await page.keyboard.press('Enter')
      await expect(page.getByRole('main')).toBeFocused()
    })
  }

  /* ------------------------------------------------- A11Y-08 board as text */
  test('states the whole position, the turn and the instructions before a move is played', async ({ page }) => {
    // Given a fresh board, when the accessible surface is read, then it carries the starting position, the turn, and how to use it.
    await openWorkspace(page)

    await expect(boardAlt(page, 'summary')).toContainText('White to move, move 1.')
    await expect(boardAlt(page, 'summary')).toContainText('No moves have been played.')
    await expect(boardAlt(page, 'summary')).toContainText('Neither king is in check.')
    await expect(boardAlt(page, 'selection')).toHaveText('No square is selected.')
    await expect(boardAlt(page, 'instructions')).toContainText('Type a square such as e2')
    await expect(boardAlt(page, 'instructions')).toContainText('Arrow keys browse the game')

    const start = await placement(page)
    expect(start, 'rank 8 is stated piece by piece').toContain(
      'Rank 8: a8 black rook, b8 black knight, c8 black bishop, d8 black queen, e8 black king, f8 black bishop, g8 black knight, h8 black rook.',
    )
    expect(start, 'rank 1 is stated piece by piece').toContain(
      'Rank 1: a1 white rook, b1 white knight, c1 white bishop, d1 white queen, e1 white king, f1 white bishop, g1 white knight, h1 white rook.',
    )
    expect(start, 'the empty middle is stated, not omitted').toContain('Rank 4: empty.')
    await expect(boardAlt(page, 'placement').locator('li'), 'all eight ranks are listed').toHaveCount(8)
  })

  test('updates the accessible position after e4', async ({ page }) => {
    // Given the starting position, when e4 is played, then the text board follows the pieces exactly.
    await openWorkspace(page)
    const before = await placement(page)

    await playTyped(page, 'e4', '1. e4.', 'e4')

    const after = await placement(page)
    expect(before, 'the pawn started on e2').toContain('e2 white pawn')
    expect(after, 'the pawn left e2').not.toContain('e2 white pawn')
    expect(after, 'the pawn arrived on e4').toContain('Rank 4: e4 white pawn.')
    await expect(boardAlt(page, 'summary')).toContainText('Black to move, move 1.')
    await expect(boardAlt(page, 'summary')).toContainText('Last move 1. e4.')
    await expect(boardAlt(page, 'announce')).toContainText('1. e4 played.')
    await expect(boardAlt(page, 'announce')).toHaveAttribute('aria-live', 'polite')
  })

  test('announces a king in check in words, not only as a red square', async ({ page }) => {
    // Given a line that ends in check, when the king is attacked, then the accessible board says so.
    await openWorkspace(page, '/study')
    await startExplore(page)

    for (const [text, spoken, on] of [
      ['e4', '1. e4.', 'e4'],
      ['e5', '1\u2026 e5.', 'e5'],
      ['Bc4', '2. Bc4.', 'c4'],
      ['Nf6', '2\u2026 Nf6.', 'f6'],
      ['Bxf7', '3. Bxf7+.', 'f7'],
    ] as const) {
      await playTyped(page, text, spoken, on)
    }

    await expect(boardAlt(page, 'summary')).toContainText('Black is in check.')
    await expect(boardAlt(page, 'announce')).toContainText('Black is in check.')
    expect(await placement(page), 'the bishop is stated on f7').toContain('f7 white bishop')
    await expect(page.locator('.board .hl.check'), 'the visual cue is unchanged').toHaveCount(1)
  })

  test('updates the accessible position through a promotion', async ({ page }) => {
    // Given a pawn reaching the last rank, when the promotion dialog is answered from the keyboard, then the new piece is stated as text.
    await openWorkspace(page, '/study')
    await startExplore(page)

    for (const [text, spoken, on] of [
      ['e4', '1. e4.', 'e4'],
      ['d5', '1\u2026 d5.', 'd5'],
      ['exd5', '2. exd5.', 'd5'],
      ['c6', '2\u2026 c6.', 'c6'],
      ['dxc6', '3. dxc6.', 'c6'],
      ['Nf6', '3\u2026 Nf6.', 'f6'],
      ['cxb7', '4. cxb7.', 'b7'],
      ['Ne4', '4\u2026 Ne4.', 'e4'],
    ] as const) {
      await playTyped(page, text, spoken, on)
    }

    await type(page, 'bxa8')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Promote to Queen' })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.locator('.board .piece[data-square="a8"]')).toBeVisible()
    await settled(page, 'a8')
    await expect(boardAlt(page, 'placement'), 'the promoted queen is stated by name').toContainText('a8 white queen')
    await expect(boardAlt(page, 'summary')).toContainText('Last move 5. bxa8=Q')
  })

  test('follows the board back through history and into the live position', async ({ page }) => {
    // Given a played move, when history is browsed with the keyboard, then the text board follows and move entry is gated with a reason.
    await openWorkspace(page)
    await playTyped(page, 'e4', '1. e4.', 'e4')

    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.press('ArrowLeft')
    await expect(boardAlt(page, 'blocked')).toContainText('You are browsing an earlier move')
    expect(await placement(page), 'browsing shows the position before e4').toContain('e2 white pawn')

    await page.keyboard.press('End')
    /* The stubbed engine answers `bestmove (none)`, so the turn stays with it —
       the gate is expected to change its reason, not to open. */
    await expect(boardAlt(page, 'blocked')).toContainText('It is not your move.')
    expect(await placement(page), 'the live position is back').toContain('Rank 4: e4 white pawn.')
  })

  /* ------------------------------------- A11Y-09 a move without a pointer */
  test('lets a keyboard-only player select a square and complete a move', async ({ page }) => {
    // Given no pointer at all, when a player tabs to the board console and types, then the selection is announced and the move lands.
    await openWorkspace(page)

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to the board' })).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await expect(consoleEntry(page), 'the first stop after the skip link is the move entry').toBeFocused()

    await expect(page.locator('[data-shell="board-console"]'), 'the console shows itself once it holds focus').toBeInViewport()

    await page.keyboard.type('e2')
    await page.keyboard.press('Enter')
    await expect(boardAlt(page, 'selection')).toHaveText('Selected e2, white pawn. Legal moves: e3, e4.')
    await expect(page.locator('.board .hl.sel'), 'the visual board shows the same selection').toHaveCount(1)
    await expect(page.locator('.board .dot'), 'and the same destinations').toHaveCount(2)

    await page.keyboard.type('e4')
    await page.keyboard.press('Enter')
    await expect(page.locator('.board .piece[data-square="e4"]')).toBeVisible()
    await expect(page.locator('.board .hl.last')).toHaveCount(2)
    await expect(boardAlt(page, 'selection')).toHaveText('No square is selected.')
    await expect(consoleEntry(page), 'focus never leaves the player').toBeFocused()
  })

  test('refuses an illegal instruction with a reason instead of silence', async ({ page }) => {
    // Given a mistyped instruction, when it is submitted, then the console explains it and the board does not move.
    await openWorkspace(page)

    await type(page, 'e5')
    await expect(boardAlt(page, 'announce')).toContainText('e5 is empty.')
    await type(page, 'Qh9')
    await expect(boardAlt(page, 'announce')).toContainText('is not a legal move or a square on this board')
    await expect(page.locator('.board .hl.last'), 'nothing was played').toHaveCount(0)
  })

  /* ----------------------------------------------------- A11Y-02 targets */
  test('gives every keyboard target a 44px hit area at 375x812', async ({ page }) => {
    // Given a phone, when each tab stop is focused in turn, then every one of them meets the DESIGN.md 8.5 A11Y-02 floor.
    await page.setViewportSize({ width: 375, height: 812 })
    await openWorkspace(page)

    const undersized = await page.evaluate(
      ({ selector, minimum }) => {
        const offenders: { target: string; width: number; height: number }[] = []
        for (const node of document.querySelectorAll<HTMLElement>(selector)) {
          /* A control inside a closed disclosure or an unselected panel is not
             rendered, so the Tab key never reaches it and there is no target to
             measure. `getClientRects()` is the rendered-or-not test. */
          if (node.getClientRects().length === 0) continue
          /* WCAG 2.2 SC 2.5.8 exempts a target whose size is set by the
             line-height of the sentence it sits in — the GPL grant in the
             footer is one run of prose, and padding its links to 44px would
             break the paragraph it is legally required to state. */
          const style = getComputedStyle(node)
          if (style.display === 'inline' && node.closest('p') !== null) continue
          node.focus()
          const box = node.getBoundingClientRect()
          if (box.width < minimum || box.height < minimum) {
            offenders.push({
              target: `${node.tagName.toLowerCase()}${node.className ? `.${String(node.className).split(' ')[0]}` : ''}`,
              width: Math.round(box.width),
              height: Math.round(box.height),
            })
          }
        }
        return offenders
      },
      { selector: TABBABLE, minimum: TARGET_MIN },
    )

    expect(undersized, 'every keyboard target must be at least 44px square when it is focused').toEqual([])
  })

  /* --------------------------------------------------------- A11Y-06 zoom */
  for (const viewport of [
    { name: '1280x800 at 200%', width: 640, height: 400 },
    { name: '375x812 at 200%', width: 320, height: 406 },
  ]) {
    test(`keeps content and function at ${viewport.name}`, async ({ page }) => {
      // Given 200% zoom expressed as its CSS-pixel equivalent, when the workspace reflows, then nothing is lost and a move still lands.
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openWorkspace(page)

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
        'zoomed text must reflow, never scroll sideways',
      ).toBe(false)
      await expect(page.locator('.board')).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible()
      await expect(page.getByRole('contentinfo')).toBeVisible()

      await playTyped(page, 'd4', '1. d4.', 'd4')
      const panel = await page.locator('[data-shell="board-console"]').boundingBox()
      expect(panel?.width ?? 0, 'the console fits the zoomed viewport').toBeLessThanOrEqual(viewport.width)
    })
  }

  /* ------------------------------------------------ A11Y-05 non-colour cues */
  test('keeps the selection, last move and check distinguishable by shape', async ({ page }) => {
    // Given the board states todo 13 shaped, when the accessible surface exists alongside them, then each one still publishes its own geometry.
    await openWorkspace(page, '/study')
    await startExplore(page)
    await playTyped(page, 'e4', '1. e4.', 'e4')
    await type(page, 'e7')

    const cues = await page.locator('.board .hl').evaluateAll((nodes) =>
      nodes.map((node) => ({
        cue: (node as HTMLElement).dataset.cue,
        style: getComputedStyle(node).borderTopStyle,
      })),
    )
    expect(cues.map((entry) => entry.cue).sort(), 'the last move and the selection are both shaped').toEqual([
      'corner-brackets',
      'corner-brackets',
      'ring-solid',
    ])
    expect(cues.find((entry) => entry.cue === 'ring-solid')?.style, 'selection stays a solid ring').toBe('solid')
  })

  /* ----------------------------------------------------- A11Y-04 motion */
  test.describe('under reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('collapses every animation and loses no state', async ({ page }) => {
      // Given a player who asked for reduced motion, when the workspace is driven from the keyboard, then durations collapse and every state still reports.
      await openWorkspace(page)

      await page.keyboard.press('Tab')
      const durations = await page.evaluate(() => {
        const read = (selector: string) => {
          const node = document.querySelector(selector)
          if (node === null) return 0
          const style = getComputedStyle(node)
          return Math.max(
            Number.parseFloat(style.transitionDuration) || 0,
            Number.parseFloat(style.animationDuration) || 0,
          )
        }
        return {
          skiplink: read('.ui-skiplink'),
          piece: read('.board .piece'),
          plate: read('.evalbar .white'),
          navIndicator: read('[data-nav-indicator]'),
          rim: Number.parseFloat(getComputedStyle(document.querySelector('.board') as Element, '::after').transitionDuration),
        }
      })
      for (const [name, seconds] of Object.entries(durations)) {
        expect(seconds, `DESIGN.md 6.4 must collapse ${name}`).toBeLessThan(0.01)
      }

      await expect(page.getByRole('link', { name: 'Skip to the board' })).toBeInViewport()
      await playTyped(page, 'e4', '1. e4.', 'e4')
      await expect(page.locator('.board .hl.last'), 'the last-move cue survives').toHaveCount(2)
    })
  })

  /* ------------------------------------------------ P4 short-height mobile */
  test('never displaces the board with the accessible surface', async ({ page }) => {
    // Given the surface DESIGN.md 8.3 measures, when the console is added, then it occupies no layout and the board keeps its place.
    await page.setViewportSize({ width: 375, height: 812 })
    await openWorkspace(page)

    const console_ = await page.locator('[data-shell="board-console"]').boundingBox()
    expect(console_?.height ?? 0, 'the resting console is out of the flow').toBeLessThanOrEqual(1)

    const before = await page.locator('.board').boundingBox()
    await consoleEntry(page).focus()
    const after = await page.locator('.board').boundingBox()
    expect(after?.y, 'revealing the console must not move the board').toBe(before?.y)
    expect(after?.height, 'revealing the console must not resize the board').toBe(before?.height)
  })
})
