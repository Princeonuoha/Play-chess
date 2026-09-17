/* ---------------------------------------------------------------------------
 * The evaluation bar's orientation contract (DESIGN.md 6.3 / 8.2, plan todo 7).
 *
 * `board.spec.ts` already owns the bar's compositing and legibility floors. This
 * file owns the one thing those cannot see: the bar is HORIZONTAL, it sits ABOVE
 * the board rather than beside it, and it spans exactly the position it measures
 * at every width the board is capped by — the two Tailwind caps on the shared
 * wrapper AND the two viewport-height caps in `index.css`, which bind on short
 * viewports where the column is wider than the board.
 *
 * Those two height caps are the reason width parity is asserted against the
 * measured board rather than against the column: a bar that filled its column
 * would overhang the board by the height cap's margin on exactly the short
 * landscape viewport the rest of the suite already exercises. Each media query is
 * confirmed to have matched before its geometry is read, so a rule that stopped
 * applying fails here instead of quietly passing against the base rule.
 * ------------------------------------------------------------------------- */
import { expect, test, type Page } from '@playwright/test'

/** DESIGN.md 3.2: `--type-label` is the rendered floor. */
const TYPE_FLOOR = 12

/** `--space-4` on the border box, which is the 14px readout chip plus the 1px rim. */
const TRACK_HEIGHT = 16

/** DESIGN.md 8.2 caps the board — and so the bar — at 560px on a tablet, 600px on a desktop. */
const WIDTH_CAPS = [
  { name: '768x900', width: 768, height: 900, cap: 560 },
  { name: '1280x900', width: 1280, height: 900, cap: 600 },
] as const

/** The two `index.css` rules that cap the board against the viewport height instead of the column. */
const HEIGHT_CAPS = [
  { name: '768x600', width: 768, height: 600, query: '(max-width: 900px)' },
  { name: '1024x768', width: 1024, height: 768, query: '(min-width: 901px) and (max-height: 799px)' },
] as const

const PHONE = { name: '375x812', width: 375, height: 812 } as const
const DESKTOP = { name: '1280x900', width: 1280, height: 900 } as const

/** The evaluation Stockfish reports for the side to move; the controller flips it to White's view. */
const STUB_CP = -150

const UCI_STUB = `self.onmessage = (event) => {
  const cmd = String(event.data || '')
  if (cmd === 'uci') self.postMessage('uciok')
  else if (cmd === 'isready') self.postMessage('readyok')
  else if (cmd.slice(0, 2) === 'go') {
    self.postMessage('info depth 12 score cp ${STUB_CP} pv e7e5')
    setTimeout(() => self.postMessage('bestmove (none)'), 5)
  }
}`

type Geometry = {
  readonly bar: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly bottom: number; readonly right: number }
  readonly board: { readonly x: number; readonly y: number; readonly width: number; readonly bottom: number }
  readonly wrapper: number
  readonly barPrecedesBoard: boolean
  readonly shareAParent: boolean
}

/**
 * Chromium always reports a computed transform as `matrix(a, b, c, d, tx, ty)`,
 * never as the authored function — so an axis has to be read out of the terms:
 * `a` scales x, `d` scales y, and `b`/`c` are non-zero only under rotation or shear.
 */
function matrixOf(transform: string): { readonly a: number; readonly b: number; readonly c: number; readonly d: number } {
  const terms = transform.match(/^matrix\(([^)]+)\)$/)
  if (terms === null) throw new Error(`expected a 2-D matrix, got ${transform}`)
  const [a, b, c, d] = terms[1].split(',').map((term) => Number.parseFloat(term))
  return { a, b, c, d }
}

/** `ChessController.setEval`: the fill fraction is a sigmoid of the centipawn score. */
function sigmoid(centipawns: number): number {
  return 1 / (1 + Math.exp(-Math.max(-1500, Math.min(1500, centipawns)) / 400))
}

async function stubEngine(page: Page): Promise<void> {
  await page.route('**/stockfish-18-lite-single.js*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: UCI_STUB }),
  )
}

async function openBoard(page: Page): Promise<void> {
  await page.goto('/play')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.locator('.board .piece').first().waitFor()
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible()) await gotIt.click()
}

async function clickSquare(page: Page, square: string): Promise<void> {
  const position = await page.locator(`.board .sq[data-square="${square}"]`).evaluate((node) => ({
    x: (node as HTMLElement).offsetLeft + (node as HTMLElement).offsetWidth / 2,
    y: (node as HTMLElement).offsetTop + (node as HTMLElement).offsetHeight / 2,
  }))
  await page.locator('.board').click({ position })
}

/** One read, so the bar and the board can never be measured across different frames. */
async function geometryOf(page: Page): Promise<Geometry> {
  return page.locator('.evalbar').evaluate((bar) => {
    const board = document.querySelector('.board') as HTMLElement
    const barBox = bar.getBoundingClientRect()
    const boardBox = board.getBoundingClientRect()
    return {
      bar: { x: barBox.x, y: barBox.y, width: barBox.width, height: barBox.height, bottom: barBox.bottom, right: barBox.right },
      board: { x: boardBox.x, y: boardBox.y, width: boardBox.width, bottom: boardBox.bottom },
      wrapper: (bar.parentElement as HTMLElement).getBoundingClientRect().width,
      barPrecedesBoard: (bar.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      shareAParent: bar.parentElement === board.parentElement?.parentElement,
    }
  })
}

async function fillOf(page: Page): Promise<{
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
  readonly origin: string
  readonly label: string
  readonly left: number
  readonly right: number
  readonly height: number
  readonly trackLeft: number
  readonly trackHeight: number
  readonly trackWidth: number
}> {
  const raw = await page.locator('.evalbar').evaluate((bar) => {
    const plate = bar.querySelector('.white') as HTMLElement
    const style = getComputedStyle(plate)
    const plateBox = plate.getBoundingClientRect()
    const barBox = bar.getBoundingClientRect()
    const rim = Number.parseFloat(getComputedStyle(bar).borderLeftWidth)
    return {
      transform: style.transform,
      origin: style.transformOrigin,
      label: ((bar.querySelector('.num') as HTMLElement).textContent ?? '').trim(),
      left: plateBox.left,
      right: plateBox.right,
      height: plateBox.height,
      trackLeft: barBox.left + rim,
      trackHeight: bar.clientHeight,
      trackWidth: bar.clientWidth,
    }
  })
  return { ...raw, ...matrixOf(raw.transform) }
}

test.describe('evaluation bar orientation contract', () => {
  test.describe.configure({ timeout: 90_000 })

  test.beforeEach(async ({ page }) => {
    await stubEngine(page)
  })

  test(`renders above the board rather than beside it at ${DESKTOP.name}`, async ({ page }) => {
    // Given a desktop viewport, when the board column composes, then the bar leads the board as a wide horizontal rule.
    await page.setViewportSize(DESKTOP)
    await openBoard(page)

    const { bar, board, barPrecedesBoard, shareAParent } = await geometryOf(page)

    expect(barPrecedesBoard, 'the bar must come before the board in reading order').toBe(true)
    expect(shareAParent, 'the bar and the board must hang off one width-capped wrapper').toBe(true)
    expect(bar.bottom, 'the bar must end at or above the board, never overlap it').toBeLessThanOrEqual(board.y)
    expect(board.y - bar.bottom, 'only the column gap may separate them').toBeLessThanOrEqual(TRACK_HEIGHT)
    expect(bar.height, 'the bar is a track, not a strip').toBe(TRACK_HEIGHT)
    expect(bar.width, 'a horizontal bar is an order of magnitude wider than it is tall').toBeGreaterThan(bar.height * 10)
    expect(Math.abs(bar.x - board.x), 'the bar and the board share a left edge').toBeLessThanOrEqual(1)
    expect(Math.abs(bar.right - (board.x + board.width)), 'the bar and the board share a right edge').toBeLessThanOrEqual(1)
  })

  for (const viewport of WIDTH_CAPS) {
    test(`spans the board at the ${viewport.cap}px cap at ${viewport.name}`, async ({ page }) => {
      // Given a viewport where DESIGN.md 8.2's width cap binds, when both render, then the bar measures exactly the board.
      await page.setViewportSize(viewport)
      await openBoard(page)

      const { bar, board } = await geometryOf(page)

      expect(bar.width, `DESIGN.md 8.2 caps this viewport at ${viewport.cap}px`).toBe(viewport.cap)
      expect(Math.abs(bar.width - board.width), 'the bar must measure exactly the board it reports on').toBeLessThanOrEqual(1)
      expect(Math.abs(bar.x - board.x), 'the bar and the board share a left edge').toBeLessThanOrEqual(1)
      expect(bar.height, 'the bar stays horizontal at every cap').toBe(TRACK_HEIGHT)
      expect(bar.bottom, 'the bar stays above the board at every cap').toBeLessThanOrEqual(board.y)
    })
  }

  for (const viewport of HEIGHT_CAPS) {
    test(`tracks the height-capped board under ${viewport.query} at ${viewport.name}`, async ({ page }) => {
      // Given a viewport short enough that the board is capped against its height, when the rule fires, then the bar shrinks with it instead of filling the column.
      await page.setViewportSize(viewport)
      await openBoard(page)

      const matched = await page.evaluate((query) => window.matchMedia(query).matches, viewport.query)
      expect(matched, `${viewport.query} must be the rule in force at ${viewport.name}`).toBe(true)

      const { bar, board, wrapper } = await geometryOf(page)

      expect(bar.width, 'the height cap must bind here, not the column width').toBeLessThan(wrapper - 1)
      expect(Math.abs(bar.width - board.width), 'the bar must shrink with the board, never overhang it').toBeLessThanOrEqual(1)
      expect(Math.abs(bar.x - board.x), 'the bar and the board stay left-aligned under the height cap').toBeLessThanOrEqual(1)
      expect(bar.height, 'the height cap changes the width, never the orientation').toBe(TRACK_HEIGHT)
      expect(bar.bottom, 'the bar stays above the board under the height cap').toBeLessThanOrEqual(board.y)
    })
  }

  test('grows the fill rightward from the left edge as White gains', async ({ page }) => {
    // Given a real evaluation arriving from the engine, when the fill settles, then only the x term moved and it is still pinned to the left edge.
    await page.setViewportSize(DESKTOP)
    await openBoard(page)

    const neutral = await fillOf(page)
    expect(neutral.a, 'an unstarted game is drawn at half the track').toBeCloseTo(0.5, 2)
    expect(neutral.d, 'the y term must be 1 before the evaluation moves').toBe(1)

    await clickSquare(page, 'e2')
    await clickSquare(page, 'e4')
    await expect(page.locator('.board .piece[data-square="e4"]')).toBeVisible()
    await expect
      .poll(async () => (await fillOf(page)).label, { message: 'the engine must report an evaluation' })
      .not.toBe(neutral.label)

    const expected = sigmoid(-STUB_CP)
    await expect
      .poll(async () => Math.abs((await fillOf(page)).a - expected) <= 0.002, { message: `the fill must settle at ${expected}` })
      .toBe(true)

    const filled = await fillOf(page)
    expect(filled.a, 'White gaining must grow the x term').toBeGreaterThan(neutral.a)
    expect(filled.d, 'a horizontal fill must never touch the y term').toBe(1)
    expect(filled.b === 0 && filled.c === 0, 'the fill is a pure scale, never a rotation or a shear').toBe(true)
    expect(filled.origin, 'the fill is anchored to the left edge of the track').toMatch(/^0px /)
    expect(Math.abs(filled.left - neutral.left), 'the left edge must stay pinned while the fill grows').toBeLessThanOrEqual(1)
    expect(Math.abs(filled.left - filled.trackLeft), 'the fill starts at the track, not inset from it').toBeLessThanOrEqual(1)
    expect(filled.right, 'the fill must extend rightward').toBeGreaterThan(neutral.right + 1)
    expect(Math.abs(filled.height - filled.trackHeight), 'a horizontal fill keeps the full track height').toBeLessThanOrEqual(1)
    expect(Math.abs(filled.right - filled.left - filled.trackWidth * filled.a), 'the rendered fill is the x term of the track').toBeLessThanOrEqual(1)
  })

  for (const viewport of [PHONE, DESKTOP]) {
    test(`keeps the readout chip upright and legible at ${viewport.name}`, async ({ page }) => {
      // Given the horizontal bar, when the readout renders, then it reads left-to-right on its own opaque chip at the right end of the track.
      await page.setViewportSize(viewport)
      await openBoard(page)

      const readout = await page.locator('.evalbar .num').evaluate((num) => {
        const style = getComputedStyle(num)
        const box = num.getBoundingClientRect()
        const barBox = (num.parentElement as HTMLElement).getBoundingClientRect()
        return {
          transform: style.transform,
          fontSize: Number.parseFloat(style.fontSize),
          background: style.backgroundColor,
          borderWidth: Number.parseFloat(style.borderTopWidth),
          text: (num.textContent ?? '').trim(),
          width: box.width,
          height: box.height,
          fromRightEdge: barBox.right - box.right,
          insetLeft: box.left - barBox.left,
        }
      })

      const chip = matrixOf(readout.transform)
      expect(chip.b === 0 && chip.c === 0, 'the readout must never be rotated back onto its side').toBe(true)
      expect(chip.a, 'the readout is rendered at its natural scale').toBe(1)
      expect(chip.d, 'the readout is rendered at its natural scale').toBe(1)
      expect(readout.width, 'an upright readout is wider than it is tall').toBeGreaterThan(readout.height)
      expect(readout.fontSize, 'the readout must clear the DESIGN.md 3.2 floor').toBeGreaterThanOrEqual(TYPE_FLOOR)
      expect(readout.text, 'the evaluation is stated as a number').not.toBe('')
      expect(readout.background, 'the chip must stay opaque so the fill can never wash the ink out').not.toMatch(/rgba\(.*, 0(\.\d+)?\)$/)
      expect(readout.borderWidth, 'the chip keeps its rim against the track').toBeGreaterThanOrEqual(1)
      expect(readout.fromRightEdge, 'the readout is anchored to the right end of the track').toBeLessThanOrEqual(TRACK_HEIGHT)
      expect(readout.insetLeft, 'the readout must not drift back over the neutral midpoint').toBeGreaterThan(0)
    })
  }

  test(`stays horizontal at ${PHONE.name}, where no breakpoint may stand it back up`, async ({ page }) => {
    // Given the smallest supported phone, when the board column renders in one column, then the bar is still a wide rule above the board.
    await page.setViewportSize(PHONE)
    await openBoard(page)

    const { bar, board, barPrecedesBoard } = await geometryOf(page)

    expect(bar.height, 'no phone breakpoint may turn the track into a strip').toBe(TRACK_HEIGHT)
    expect(bar.width, 'the bar stays an order of magnitude wider than it is tall').toBeGreaterThan(bar.height * 10)
    expect(barPrecedesBoard, 'the bar still leads the board on a phone').toBe(true)
    expect(bar.bottom, 'the bar still sits above the board on a phone').toBeLessThanOrEqual(board.y)
    expect(Math.abs(bar.width - board.width), 'the bar still measures exactly the board on a phone').toBeLessThanOrEqual(1)
  })
})
