/* ---------------------------------------------------------------------------
 * The shell geometry contract (DESIGN.md 8.2 / 8.3, plan todo 12).
 *
 * DESIGN.md 8.3 states the defect this spec exists to close as a number: on a
 * first visit at 375x812 the board's top edge must render at or above `y=560`
 * CSS pixels. Before this redesign it rendered at y=738, because a 578px-tall
 * onboarding block sat between an 88px wrapped header and the board.
 *
 * The threshold is read out of DESIGN.md rather than copied here, so the
 * document stays the single source of the contract and a change to it cannot
 * silently pass.
 * ------------------------------------------------------------------------- */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DESIGN = readFileSync(fileURLToPath(new URL('../../DESIGN.md', import.meta.url)), 'utf8')

function designThreshold(): number {
  const match = DESIGN.match(/board's top edge must render at[\s\S]{0,80}?`y=(\d+)`/)
  if (match === null) throw new Error('DESIGN.md 8.3 no longer states a mobile board-visibility threshold')
  return Number(match[1])
}

const MOBILE_BOARD_TOP_MAX = designThreshold()

const PHONES = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
] as const
const TABLETS = [{ name: '768x900', width: 768, height: 900 }] as const
const SHORT_LANDSCAPE = [{ name: '1024x768', width: 1024, height: 768 }] as const
const DESKTOPS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x1000', width: 1440, height: 1000 },
] as const
const ALL_VIEWPORTS = [...PHONES, ...TABLETS, ...SHORT_LANDSCAPE, ...DESKTOPS]

/** DESIGN.md 8.5 A11Y-02. */
const TARGET_MIN = 44

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly bottom: number }

/** Document-space geometry: a viewport-relative top changes meaning the moment the page scrolls. */
async function boxOf(page: Page, selector: string): Promise<Box> {
  const measured = await page.locator(selector).evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom + window.scrollY,
    }
  })
  return measured
}

async function firstVisit(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport)
  await page.goto('/play')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByText("Welcome — here's how it works")).toBeVisible()
  await expect(page.locator('.board')).toBeVisible()
}

async function dismissIntro(page: Page): Promise<void> {
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible()) await gotIt.click()
}

async function horizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

async function expectTarget(target: Locator, name: string): Promise<void> {
  await expect(target, `${name} should be visible`).toBeVisible()
  const box = await target.boundingBox()
  expect(box, `${name} should have a box`).not.toBeNull()
  expect(box?.width ?? 0, `${name} width`).toBeGreaterThanOrEqual(TARGET_MIN)
  expect(box?.height ?? 0, `${name} height`).toBeGreaterThanOrEqual(TARGET_MIN)
}

test.describe('responsive workspace shell geometry', () => {
  test.describe.configure({ timeout: 60_000 })

  for (const viewport of PHONES) {
    test(`leads with the board above the DESIGN.md 8.3 threshold on a first visit at ${viewport.name}`, async ({ page }) => {
      // Given a phone with nothing dismissed, when the workspace loads, then the board's top edge is inside the DESIGN.md 8.3 budget.
      await firstVisit(page, viewport)

      const board = await boxOf(page, '.board')
      expect(
        board.y,
        `board top must be at or above y=${MOBILE_BOARD_TOP_MAX} on a first visit (DESIGN.md 8.3)`,
      ).toBeLessThanOrEqual(MOBILE_BOARD_TOP_MAX)
      // The board leads: nothing but the header and the first-visit strip precedes it.
      expect(board.y, 'board must sit below the header, not above it').toBeGreaterThan(0)
      expect(await boxOf(page, '[data-shell="intro"]'), 'the first-visit strip is composed, never deleted').toBeTruthy()
    })

    test(`orders board, status, navigation, and inspector down the column at ${viewport.name}`, async ({ page }) => {
      // Given a phone, when the shell is composed, then DESIGN.md 8.2's mobile order holds and navigation stays reachable.
      await firstVisit(page, viewport)

      const header = await boxOf(page, '[data-shell="header"]')
      const board = await boxOf(page, '.board')
      const status = await boxOf(page, '[data-shell="status"]')
      const nav = await boxOf(page, '[data-nav-safe-area="true"]')
      const footer = await boxOf(page, '[data-shell="footer"]')

      expect(header.bottom).toBeLessThanOrEqual(board.y)
      expect(board.bottom).toBeLessThanOrEqual(status.y)
      expect(status.bottom).toBeLessThanOrEqual(nav.y)
      expect(nav.bottom).toBeLessThanOrEqual(footer.y)
      // Reachable: navigation is inside the first screenful of scrolling past the board.
      expect(nav.y - board.bottom, 'navigation must follow the board closely').toBeLessThan(viewport.height)
    })
  }

  for (const viewport of [...SHORT_LANDSCAPE, ...DESKTOPS]) {
    test(`top-aligns the board and the inspector at ${viewport.name}`, async ({ page }) => {
      // Given a two-column viewport, when both columns render, then they share one top edge (DESIGN.md 8.2).
      await firstVisit(page, viewport)

      const board = await boxOf(page, '.board')
      const inspector = await boxOf(page, '[data-shell="inspector"]')
      const column = await boxOf(page, '[data-shell="board-column"]')

      expect(Math.abs(board.y - inspector.y), 'board and inspector must share a top edge').toBeLessThanOrEqual(1)
      expect(Math.abs(column.y - inspector.y), 'both grid tracks must start on the same row').toBeLessThanOrEqual(1)
      expect(inspector.x, 'the inspector must sit beside the board, not under it').toBeGreaterThan(board.x)
    })
  }

  for (const viewport of SHORT_LANDSCAPE) {
    test(`fits the whole board on screen without scrolling at ${viewport.name}`, async ({ page }) => {
      // Given a short landscape viewport, when the shell renders, then DESIGN.md 8.2's compact-board rule keeps the board whole.
      await firstVisit(page, viewport)

      const board = await boxOf(page, '.board')
      expect(board.bottom, 'the board must end above the fold on a short viewport').toBeLessThanOrEqual(viewport.height)
      expect(board.width, 'the board must stay square and whole').toBeGreaterThan(0)
      expect(Math.abs(board.width - board.height), 'the board must stay square').toBeLessThanOrEqual(1)
    })
  }

  for (const viewport of TABLETS) {
    test(`centres a balanced single-column board at ${viewport.name}`, async ({ page }) => {
      // Given a tablet, when the single-column shell renders, then the board is capped and centred (DESIGN.md 8.2).
      await firstVisit(page, viewport)

      const board = await boxOf(page, '.board')
      const inspector = await boxOf(page, '[data-shell="inspector"]')
      expect(board.width, 'DESIGN.md 8.2 caps the tablet board at 560px').toBeLessThanOrEqual(560)
      expect(inspector.y, 'the inspector sits below the board on a tablet').toBeGreaterThan(board.y)
      expect(inspector.width, 'the inspector spans the full tablet column').toBeGreaterThan(board.width)
    })
  }

  for (const viewport of ALL_VIEWPORTS) {
    test(`has zero horizontal overflow at ${viewport.name}`, async ({ page }) => {
      // Given every DESIGN.md 8.2 viewport, when the first-visit shell renders and then the guide is opened and dismissed, then nothing ever scrolls sideways.
      await firstVisit(page, viewport)
      expect(await horizontalOverflow(page), 'first-visit state overflows horizontally').toBe(false)

      await page.locator('[data-shell="intro"] summary').click()
      await expect(page.getByRole('button', { name: /^Play:/ })).toBeVisible()
      expect(await horizontalOverflow(page), 'expanded guide overflows horizontally').toBe(false)

      await dismissIntro(page)
      expect(await horizontalOverflow(page), 'dismissed state overflows horizontally').toBe(false)
    })
  }

  test(`keeps every primary shell target at least ${TARGET_MIN}px at ${PHONES[0].name}`, async ({ page }) => {
    // Given the smallest supported phone, when the shell renders, then DESIGN.md 8.5 A11Y-02 holds for every primary control.
    await firstVisit(page, PHONES[0])

    await expectTarget(page.getByRole('button', { name: 'How it works' }), 'header help control')
    await expectTarget(page.getByRole('button', { name: 'Got it' }), 'first-visit dismiss')
    for (const label of ['Play', 'Openings', 'Games', 'Study']) {
      await expectTarget(page.getByRole('link', { name: label, exact: true }), `${label} workspace link`)
    }

    await dismissIntro(page)
    await expectTarget(page.getByRole('button', { name: 'New game' }), 'primary route action')
  })

  for (const viewport of [PHONES[0], DESKTOPS[0]]) {
    test(`keeps the GPL licence notice present and legible at ${viewport.name}`, async ({ page }) => {
      // Given any viewport, when the shell renders, then the licence that lets this product ship Stockfish is visible and whole.
      await firstVisit(page, viewport)

      const footer = page.locator('[data-shell="footer"]')
      await expect(footer).toBeVisible()
      await expect(footer).toContainText('Stockfish 18')
      const licence = footer.getByRole('link', { name: 'GPLv3' })
      await expect(licence).toBeVisible()
      await expect(licence).toHaveAttribute('href', 'https://www.gnu.org/licenses/gpl-3.0.html')

      const box = await boxOf(page, '[data-shell="footer"]')
      expect(box.height, 'the notice must occupy real space, never be collapsed away').toBeGreaterThan(0)
      const fontSize = await footer.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize))
      expect(fontSize, 'DESIGN.md 3.2 puts the floor at the 12px label step').toBeGreaterThanOrEqual(12)
    })
  }

  test('holds the board above the threshold while the engine is still loading', async ({ page }) => {
    // Given an engine that never finishes booting, when the first visit renders, then the loading chrome costs the board nothing.
    let release = () => {}
    const stalled = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/stockfish-18-lite-single.js*', async (route) => {
      await stalled
      // A route left pending across the reload inside `firstVisit` is already
      // discarded by the time it is released; that is expected, not a failure.
      await route.abort().catch(() => {})
    })

    try {
      await firstVisit(page, PHONES[0])
      await expect(page.locator('header [role="status"]')).toContainText('loading engine…')

      const board = await boxOf(page, '.board')
      expect(board.y, `board top under a loading engine (DESIGN.md 8.3)`).toBeLessThanOrEqual(MOBILE_BOARD_TOP_MAX)
      expect(await horizontalOverflow(page), 'loading state overflows horizontally').toBe(false)
      const header = await boxOf(page, '[data-shell="header"]')
      expect(header.height, 'the header must not grow while the engine boots').toBeLessThanOrEqual(64)
    } finally {
      release()
      await page.unroute('**/stockfish-18-lite-single.js*')
    }
  })

  for (const viewport of [PHONES[0], DESKTOPS[0]]) {
    test(`holds its geometry under the longest status copy at ${viewport.name}`, async ({ page }) => {
      // Given status copy far longer than anything the controller emits, when it is forced into the live status slot, then the shell absorbs it.
      await firstVisit(page, viewport)
      const before = await boxOf(page, '.board')

      // A pure layout probe: the controller's own longest strings are
      // "Stockfish vs Stockfish" and "Draw — threefold repetition", so this
      // over-stresses the slot by an order of magnitude to prove real headroom.
      await page.locator('[data-shell="status"]').evaluate((node) => {
        const longest = 'Draw — threefold repetition '.repeat(10).trim()
        for (const line of node.querySelectorAll(':scope > div')) line.textContent = longest
      })
      await expect(page.locator('[data-shell="status"]')).toContainText('threefold repetition')

      expect(await horizontalOverflow(page), 'a long status banner must never widen the document').toBe(false)
      const after = await boxOf(page, '.board')
      expect(after.y, 'a long status must never push the board down').toBeLessThanOrEqual(before.y)
      expect(after.width, 'a long status must never shrink the board').toBe(before.width)
      const inspector = await boxOf(page, '[data-shell="inspector"]')
      expect(inspector.x + inspector.width, 'the inspector must stay inside the viewport').toBeLessThanOrEqual(viewport.width)
    })
  }
})
