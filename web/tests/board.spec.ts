/* ---------------------------------------------------------------------------
 * The board contract (DESIGN.md 2.2 / 4.3 / 6.3 / 6.4 / 8.2 / 8.5, plan todo 13).
 *
 * Four things are locked here:
 *
 *   1. The two square fills are FROZEN. They are read out of DESIGN.md rather
 *      than copied, so the document stays the single source of the contract.
 *   2. Every board state carries a NON-COLOUR cue. Each assertion reads a shape
 *      — a border geometry, a bracket, a glyph — never a colour value, so the
 *      suite fails if a cue is ever reduced to a hue.
 *   3. Nothing on the board animates a layout property, and reduced motion is a
 *      path rather than a deletion.
 *   4. The board is a stable square from first paint: engine boot moves nothing.
 *
 * The engine is stubbed to a minimal UCI responder. That is deliberate: the
 * review grade badge is board state, but reaching it through real Stockfish runs
 * into the pre-existing stop/go WASM race DESIGN.md 8.7 records as D-05, which
 * this plan forbids fixing. Stubbing the worker exercises the real controller,
 * the real render path, and the real cascade without betting the suite on a
 * known-racy engine lifecycle.
 * ------------------------------------------------------------------------- */
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DESIGN = readFileSync(fileURLToPath(new URL('../../DESIGN.md', import.meta.url)), 'utf8')

function frozenFill(token: string): string {
  const row = DESIGN.match(new RegExp(`\\|\\s*\`${token}\`\\s*\\|\\s*\`(#[0-9a-fA-F]{6})\`\\s*\\|`))
  if (row === null) throw new Error(`DESIGN.md 2.2 no longer freezes ${token}`)
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(row[1].slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

const IVORY = frozenFill('--board-square-ivory')
const GREEN = frozenFill('--board-square-green')

/** DESIGN.md 3.2: `--type-label` is the rendered floor. */
const TYPE_FLOOR = 12

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '768x900', width: 768, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
] as const

const SHORT_LANDSCAPE = VIEWPORTS[2]

/** A worker that speaks just enough UCI to boot and to answer `go`. */
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

async function openBoard(page: Page, route = '/play'): Promise<void> {
  await page.goto(route)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.locator('.board .piece').first().waitFor()
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible()) await gotIt.click()
}

async function clickSquare(page: Page, square: string): Promise<void> {
  const box = await page.locator(`.board .sq[data-square="${square}"]`).boundingBox()
  if (box === null) throw new Error(`square ${square} has no box`)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

/* The board refuses input while a piece is travelling, and a click on a board
   that still holds a stale selection is consumed clearing it, so selecting is a
   retry rather than a single click. */
async function selectSquare(page: Page, square: string): Promise<void> {
  const selected = page.locator('.board .hl.sel')
  for (let attempt = 0; attempt < 5; attempt++) {
    await clickSquare(page, square)
    if (await selected.count()) return
    await page.waitForTimeout(300)
  }
  throw new Error(`${square} never became the selected square`)
}

async function dragSquare(page: Page, from: string, to: string): Promise<void> {
  const a = await page.locator(`.board .sq[data-square="${from}"]`).boundingBox()
  const b = await page.locator(`.board .sq[data-square="${to}"]`).boundingBox()
  if (a === null || b === null) throw new Error('drag endpoints have no box')
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
  await page.mouse.up()
}

type Cue = {
  readonly cue: string | undefined
  readonly borderStyle: string
  readonly borderWidth: number
  readonly bracketTop: number
  readonly bracketRight: number
}

/** Reads only geometry. Nothing here can be satisfied by a colour. */
async function cueShape(page: Page, selector: string): Promise<Cue> {
  return page.locator(selector).first().evaluate((node) => {
    const own = getComputedStyle(node)
    const bracket = getComputedStyle(node, '::before')
    return {
      cue: (node as HTMLElement).dataset.cue,
      borderStyle: own.borderTopStyle,
      borderWidth: Number.parseFloat(own.borderTopWidth),
      bracketTop: Number.parseFloat(bracket.borderTopWidth) || 0,
      bracketRight: Number.parseFloat(bracket.borderRightWidth) || 0,
    }
  })
}

/** Plays 1.e4 e5 2.Bc4 Nf6 3.Bxf7+ in Explore, where the player drives both sides. */
async function playIntoCheck(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Explore/i }).first().click()
  for (const [from, to] of [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['g8', 'f6'], ['c4', 'f7']]) {
    await clickSquare(page, from)
    await clickSquare(page, to)
    // A capture leaves the taken piece in the DOM until the travel finishes, so
    // settle on the committed last-move cue and let the board unlock input.
    await expect(page.locator('.board .hl.last')).toHaveCount(2)
    await page.waitForTimeout(300)
  }
}

test.describe('board presentation contract', () => {
  test.describe.configure({ timeout: 90_000 })

  test.beforeEach(async ({ page }) => {
    await stubEngine(page)
  })

  for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
    test(`keeps the DESIGN.md 2.2 frozen square fills byte-exact at ${viewport.name}`, async ({ page }) => {
      // Given any viewport, when the board paints, then both square fills are exactly what DESIGN.md freezes.
      await page.setViewportSize(viewport)
      await openBoard(page)

      const fills = await page.locator('.board .sq').evaluateAll((squares) => {
        const light = new Set<string>()
        const dark = new Set<string>()
        for (const square of squares) {
          const fill = getComputedStyle(square).backgroundColor
          ;(square.classList.contains('light') ? light : dark).add(fill)
        }
        return { light: [...light], dark: [...dark], count: squares.length }
      })

      expect(fills.count, 'the board is 64 squares').toBe(64)
      expect(fills.light, 'every light square is the frozen ivory').toEqual([IVORY])
      expect(fills.dark, 'every dark square is the frozen green').toEqual([GREEN])
    })
  }

  test('holds one stable square through engine boot, with no layout shift', async ({ page }) => {
    // Given a cold load, when the engine finishes booting, then the board has not moved or resized and the page logged no shift.
    await page.addInitScript(() => {
      ;(window as unknown as { __cls: number }).__cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
          if (!shift.hadRecentInput) (window as unknown as { __cls: number }).__cls += shift.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.setViewportSize(VIEWPORTS[3])
    await page.goto('/play')
    await page.locator('.board .piece').first().waitFor()

    const booting = await page.locator('.board').boundingBox()
    await expect(page.locator('header [role="status"]')).toContainText('Stockfish 18')
    const booted = await page.locator('.board').boundingBox()

    expect(booting, 'the board has a box before the engine is up').not.toBeNull()
    expect(booted?.width, 'engine boot must not resize the board').toBe(booting?.width)
    expect(booted?.height, 'engine boot must not resize the board').toBe(booting?.height)
    expect(booted?.y, 'engine boot must not move the board').toBe(booting?.y)
    expect(Math.abs((booted?.width ?? 0) - (booted?.height ?? 1)), 'the board is square').toBeLessThanOrEqual(1)

    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
    expect(cls, 'booting the engine must not shift the layout').toBeLessThan(0.01)
  })

  test('gives the selected square and its last move cues that survive without colour', async ({ page }) => {
    // Given a player picking up a piece and playing it, when each state renders, then each carries its own shape.
    await page.setViewportSize(VIEWPORTS[3])
    await openBoard(page)

    await clickSquare(page, 'e2')
    await expect(page.locator('.board .hl.sel')).toBeVisible()
    const selected = await cueShape(page, '.board .hl.sel')
    expect(selected.cue, 'the selected square publishes its shape').toBe('ring-solid')
    expect(selected.borderStyle, 'selection is a closed solid ring, not a wash').toBe('solid')
    expect(selected.borderWidth, 'the ring has real thickness').toBeGreaterThanOrEqual(2)
    await expect(page.locator('.board .dot'), 'legal destinations are marked').not.toHaveCount(0)

    await clickSquare(page, 'e4')
    await expect(page.locator('.board .piece[data-square="e4"]')).toBeVisible()
    await expect(page.locator('.board .hl.last')).toHaveCount(2)
    const last = await cueShape(page, '.board .hl.last')
    expect(last.cue, 'the last move publishes its shape').toBe('corner-brackets')
    expect(last.borderStyle === 'none' || last.borderWidth === 0, 'the last move is not a ring').toBe(true)
    expect(last.bracketTop, 'the bracket draws its top edge').toBeGreaterThan(0)
    expect(last.bracketRight, 'the bracket is an open L, never a closed box').toBe(0)
  })

  test('gives a king in check a double ring, not just a red square', async ({ page }) => {
    // Given a line that ends in check, when the king is attacked, then the square carries a double ring.
    await page.setViewportSize(VIEWPORTS[3])
    await openBoard(page, '/study')
    await playIntoCheck(page)

    await expect(page.locator('.board .hl.check')).toHaveCount(1)
    const check = await cueShape(page, '.board .hl.check')
    expect(check.cue, 'check publishes its shape').toBe('ring-double')
    expect(check.borderStyle, 'check is a double ring').toBe('double')
    expect(check.borderWidth, 'a double ring needs room for two lines').toBeGreaterThanOrEqual(3)
  })

  test('gives a hint a dashed ring so it cannot be read as a selection', async ({ page }) => {
    // Given the opening trainer with hints on, when the book move is highlighted, then it is dashed rather than solid.
    await page.setViewportSize(VIEWPORTS[3])
    await openBoard(page, '/openings')
    await page.getByRole('button', { name: 'Italian Game' }).first().click()
    await page.getByRole('button', { name: 'Train this line' }).first().click()
    await page.getByLabel('Show hint (highlight the book move)').check()

    await expect(page.locator('.board .hl.hint')).toHaveCount(2)
    const hint = await cueShape(page, '.board .hl.hint')
    expect(hint.cue, 'the hint publishes its shape').toBe('ring-dashed')
    expect(hint.borderStyle, 'a hint is a dashed ring').toBe('dashed')
  })

  test('grades a reviewed move with a glyph, and announces browsing in words', async ({ page }) => {
    // Given a played move, when the game is reviewed and then browsed, then the grade is a glyph and the position is stated in text.
    await page.setViewportSize(VIEWPORTS[3])
    await openBoard(page)
    await clickSquare(page, 'e2')
    await clickSquare(page, 'e4')
    await expect(page.locator('.board .piece[data-square="e4"]')).toBeVisible()

    await page.getByRole('link', { name: 'Study', exact: true }).click()
    await page.getByRole('button', { name: /^Review game$/ }).click()
    await expect(page.locator('.board .gb')).toHaveCount(1)

    const badge = await page.locator('.board .gb').evaluate((node) => {
      const pill = node.querySelector('.gb-badge') as HTMLElement
      return {
        cue: (node as HTMLElement).dataset.cue,
        glyph: (pill.textContent ?? '').trim(),
        fontSize: Number.parseFloat(getComputedStyle(pill).fontSize),
      }
    })
    expect(badge.cue, 'the grade badge publishes its shape').toBe('grade-glyph')
    expect(badge.glyph.length, 'the grade is spelled as a glyph, not only a fill').toBeGreaterThan(0)
    expect(badge.fontSize, 'the glyph is legible').toBeGreaterThanOrEqual(TYPE_FLOOR)

    await page.keyboard.press('ArrowLeft')
    await expect(page.getByText(/Viewing move/), 'browsing history is stated in words').toBeVisible()
  })

  test('draws every board state with a different shape', async ({ page }) => {
    // Given every cue captured in one run, when their geometries are compared, then no two states share a shape.
    await page.setViewportSize(VIEWPORTS[3])
    await openBoard(page, '/study')
    await playIntoCheck(page)
    await selectSquare(page, 'f6')
    await expect(page.locator('.board .hl.sel')).toBeVisible()
    await expect(page.locator('.board .hl.check')).toBeVisible()

    const shapes = await page.locator('.board .hl').evaluateAll((nodes) => {
      const seen: Record<string, string> = {}
      for (const node of nodes) {
        const cue = (node as HTMLElement).dataset.cue
        const style = getComputedStyle(node)
        const bracket = getComputedStyle(node, '::before')
        if (cue === undefined) continue
        seen[cue] =
          Number.parseFloat(style.borderTopWidth) > 0
            ? `${style.borderTopStyle}-${style.borderTopWidth}`
            : `bracket-${bracket.borderTopWidth}/${bracket.borderRightWidth}`
      }
      return seen
    })

    const drawn = Object.values(shapes)
    expect(Object.keys(shapes).sort(), 'selected, last move and check are all on the board').toEqual([
      'corner-brackets',
      'ring-double',
      'ring-solid',
    ])
    for (const [cue, shape] of Object.entries(shapes)) {
      expect(shape, `${cue} must draw a real mark, not an empty one`).not.toMatch(/^bracket-0px\/0px$/)
    }
    expect(new Set(drawn).size, `each state needs its own shape, got ${JSON.stringify(shapes)}`).toBe(drawn.length)
  })

  for (const viewport of VIEWPORTS) {
    test(`keeps coordinates and the evaluation readout legible at ${viewport.name}`, async ({ page }) => {
      // Given every supported viewport, when the board and the evaluation bar render, then no board text falls under the DESIGN.md 3.2 floor and the readout stays inside its bar.
      await page.setViewportSize(viewport)
      await openBoard(page)

      const sizes = await page.locator('.board .coord').evaluateAll((nodes) =>
        [...new Set(nodes.map((node) => Number.parseFloat(getComputedStyle(node).fontSize)))],
      )
      expect(sizes.length, 'coordinates are rendered').toBeGreaterThan(0)
      for (const size of sizes) expect(size, 'coordinate ink under the DESIGN.md 3.2 floor').toBeGreaterThanOrEqual(TYPE_FLOOR)

      const readout = await page.locator('.evalbar').evaluate((bar) => {
        const num = bar.querySelector('.num') as HTMLElement
        const barBox = bar.getBoundingClientRect()
        const numBox = num.getBoundingClientRect()
        return {
          fontSize: Number.parseFloat(getComputedStyle(num).fontSize),
          text: (num.textContent ?? '').trim(),
          inside: numBox.left >= barBox.left - 1 && numBox.right <= barBox.right + 1 && numBox.top >= barBox.top - 1,
        }
      })
      expect(readout.fontSize, 'evaluation readout under the DESIGN.md 3.2 floor').toBeGreaterThanOrEqual(TYPE_FLOOR)
      expect(readout.text, 'the evaluation is stated as a number').not.toBe('')
      expect(readout.inside, 'the readout must stay inside its bar at every width').toBe(true)
    })
  }

  test(`keeps the whole board above the fold at ${SHORT_LANDSCAPE.name}`, async ({ page }) => {
    // Given the short landscape viewport, when the compact-board rule applies, then the board is whole, square, and nothing scrolls sideways.
    await page.setViewportSize(SHORT_LANDSCAPE)
    await openBoard(page)

    const board = await page.locator('.board').boundingBox()
    expect(board, 'the board renders').not.toBeNull()
    expect(board?.y ?? -1, 'the board starts inside the viewport').toBeGreaterThanOrEqual(0)
    expect((board?.y ?? 0) + (board?.height ?? 0), 'DESIGN.md 8.2 compact-board: the board ends above the fold').toBeLessThanOrEqual(
      SHORT_LANDSCAPE.height,
    )
    expect(Math.abs((board?.width ?? 0) - (board?.height ?? 1)), 'the compact board stays square').toBeLessThanOrEqual(1)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      'the compact board must not push the document sideways',
    ).toBe(false)

    await clickSquare(page, 'e2')
    await clickSquare(page, 'e4')
    await expect(page.locator('.board .piece[data-square="e4"]')).toBeVisible()
    const browser = await page.locator('[data-shell="board-column"]').boundingBox()
    expect((browser?.y ?? 0) + (browser?.height ?? 0), 'the move browser fits under the compact board').toBeLessThanOrEqual(
      SHORT_LANDSCAPE.height,
    )
  })

  test('moves pieces and the evaluation on transform only', async ({ page }) => {
    // Given DESIGN.md 6.3, when the animated board elements are inspected, then neither of them transitions a layout property.
    await page.setViewportSize(VIEWPORTS[3])
    await openBoard(page)

    const motion = await page.evaluate(() => {
      const piece = getComputedStyle(document.querySelector('.board .piece') as Element)
      const plate = getComputedStyle(document.querySelector('.evalbar .white') as Element)
      return {
        pieceProperty: piece.transitionProperty,
        pieceLeft: piece.left,
        pieceTop: piece.top,
        pieceTransform: piece.transform,
        plateProperty: plate.transitionProperty,
        plateTransform: plate.transform,
      }
    })

    expect(motion.pieceProperty, 'pieces must travel on transform').toBe('transform')
    expect(motion.pieceLeft, 'a piece must not be positioned by a layout property it animates').toBe('0px')
    expect(motion.pieceTop, 'a piece must not be positioned by a layout property it animates').toBe('0px')
    expect(motion.pieceTransform, 'a piece is placed by its transform').not.toBe('none')
    expect(motion.plateProperty, 'the evaluation plate must scale, never grow its height').toBe('transform')
    expect(motion.plateTransform, 'the evaluation plate is placed by its transform').not.toBe('none')
  })

  test('lights the board rim only while it is engaged', async ({ page }) => {
    // Given the DESIGN.md 1.3 rim-light, when a square is selected and then released, then the brass rim appears and withdraws.
    await page.setViewportSize(VIEWPORTS[3])
    await openBoard(page)
    const rim = () => page.locator('.board').evaluate((board) => getComputedStyle(board, '::after').opacity)

    expect(Number(await rim()), 'the rim is dark at rest').toBe(0)
    await clickSquare(page, 'e2')
    await expect(page.locator('.board .hl.sel')).toBeVisible()
    await expect.poll(async () => Number(await rim()), { message: 'the rim lights while engaged' }).toBe(1)
  })

  test('completes a drag move as well as a click move', async ({ page }) => {
    // Given both input styles, when a piece is dragged and another is clicked, then both land.
    await page.setViewportSize(VIEWPORTS[3])
    await openBoard(page)

    await dragSquare(page, 'd2', 'd4')
    await expect(page.locator('.board .piece[data-square="d4"]')).toBeVisible()
    await expect(page.locator('.board .hl.last')).toHaveCount(2)
  })

  test.describe('under reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('repositions the piece instantly instead of dropping the move', async ({ page }) => {
      // Given a player who asked for reduced motion, when a move is played, then travel collapses but the move still happens.
      await page.setViewportSize(VIEWPORTS[3])
      await openBoard(page)

      const durations = await page.evaluate(() => ({
        piece: Number.parseFloat(getComputedStyle(document.querySelector('.board .piece') as Element).transitionDuration),
        plate: Number.parseFloat(getComputedStyle(document.querySelector('.evalbar .white') as Element).transitionDuration),
      }))
      expect(durations.piece, 'DESIGN.md 6.4 collapses piece travel').toBeLessThan(0.01)
      expect(durations.plate, 'DESIGN.md 6.4 collapses evaluation travel').toBeLessThan(0.01)

      await clickSquare(page, 'e2')
      await clickSquare(page, 'e4')
      await expect(page.locator('.board .piece[data-square="e4"]'), 'the move still lands').toBeVisible()
      await expect(page.locator('.board .hl.last'), 'the last-move cue still renders').toHaveCount(2)
    })
  })
})
