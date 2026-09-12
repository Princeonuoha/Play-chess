/* ---------------------------------------------------------------------------
 * The `/study` sub-surface contract (plan todo 17).
 *
 * `/study` carries two different jobs that used to sit side by side at the same
 * visual weight: a GUIDED pass (Stockfish grades a finished game and tells you
 * what you missed) and an OPEN one (MultiPV on the live position, plus a free
 * Explore board). This spec locks the split:
 *
 *   1. both surfaces are separately discoverable through a real `SegmentedNav`,
 *      and they never carry the same weight at the same time;
 *   2. the whole guided-to-open journey still works end to end;
 *   3. choosing a surface is presentation only — it can never move the position
 *      the controller is showing;
 *   4. the sub-navigation is operable from the keyboard alone;
 *   5. at 375px nothing overflows and every target clears DESIGN.md 8.5's 44px.
 *
 * NOTE: no test here plays a move inside Explore. `smoke.spec.ts` step 8
 * documents the pre-existing Stockfish WASM `unreachable` trap that rapid
 * stop/setMultiPV/go sequencing produces, which predates this redesign and is
 * tracked separately. This spec deliberately stays on the same side of that
 * boundary: it starts and exits Explore, and never claims refresh behavior the
 * smoke suite excludes.
 * ------------------------------------------------------------------------- */
import { expect, test, type Locator, type Page } from '@playwright/test'

/** DESIGN.md 8.5 A11Y-02. */
const TARGET_MIN = 44

const PHONE = { width: 375, height: 812 } as const

const REVIEW_SURFACE = 'section[aria-label="Guided game review"]'
const ANALYSIS_SURFACE = 'section[aria-label="Open analysis and Explore"]'

function subNav(page: Page): Locator {
  return page.getByRole('group', { name: 'Study surface' })
}

function segment(page: Page, name: 'Review' | 'Analysis'): Locator {
  return subNav(page).getByRole('button', { name, exact: true })
}

function block(page: Page, name: string): Locator {
  return page.locator(`[data-study-block="${name}"]`)
}

/** The guided surface tells one story; these are its beats, in the order plan todo 17 fixes. */
const GUIDED_ORDER = ['progress', 'story', 'legend', 'commentary', 'better', 'moves', 'scoresheet'] as const

async function renderedBlocks(page: Page): Promise<(string | undefined)[]> {
  return page.locator('[data-study-block]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.studyBlock))
}

async function dismissIntro(page: Page): Promise<void> {
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible()) await gotIt.click()
}

async function move(page: Page, from: string, to: string): Promise<void> {
  await page.locator(`.piece.mine[data-square="${from}"]`).click()
  await page.locator(`.sq[data-square="${to}"]`).click({ force: true })
}

async function openStudy(page: Page): Promise<void> {
  await page.goto('/study')
  await dismissIntro(page)
  await expect(subNav(page)).toBeVisible()
}

/** A two-ply game is the cheapest input a real review can grade. */
async function playShortGame(page: Page): Promise<void> {
  await page.goto('/play')
  await dismissIntro(page)
  await page.getByRole('button', { name: 'New game' }).click()
  await move(page, 'e2', 'e4')
  await expect(page.locator('.piece[data-square="e4"]')).toBeVisible()
  // `mine` returns to the player's pieces only once Stockfish has replied.
  await expect(page.locator('.piece.mine')).toHaveCount(16, { timeout: 20_000 })
  await page.getByRole('link', { name: 'Study', exact: true }).click()
}

async function reviewTheGame(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /^Review game$/ }).click()
  const gradedMoves = page.locator('div.max-h-80 button')
  await expect(gradedMoves.first()).toBeVisible({ timeout: 90_000 })
  return gradedMoves
}

/** Document-space piece layout: the only honest proof that a position held. */
async function boardState(page: Page): Promise<string> {
  return page.locator('.board .piece').evaluateAll((pieces) =>
    JSON.stringify(
      pieces
        .map((piece) => ({ square: piece.getAttribute('data-square'), color: piece.getAttribute('data-color') }))
        .sort((left, right) => (left.square ?? '').localeCompare(right.square ?? '')),
    ),
  )
}

async function horizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

async function expectTarget(target: Locator, name: string): Promise<void> {
  await expect(target, `${name} should be visible`).toBeVisible()
  const box = await target.boundingBox()
  expect(box, `${name} should have a box`).not.toBeNull()
  expect(box?.height ?? 0, `${name} height`).toBeGreaterThanOrEqual(TARGET_MIN)
  expect(box?.width ?? 0, `${name} width`).toBeGreaterThanOrEqual(TARGET_MIN)
}

test.describe('study: guided review beside open analysis', () => {
  test('offers Review and Analysis as separate surfaces that never carry equal weight', async ({ page }) => {
    // Given the Study workspace, when it renders, then a sub-navigation names both surfaces and exactly one is foregrounded.
    await openStudy(page)

    await expect(segment(page, 'Review')).toBeVisible()
    await expect(segment(page, 'Analysis')).toBeVisible()
    await expect(page.locator(REVIEW_SURFACE)).toBeVisible()
    await expect(page.locator(ANALYSIS_SURFACE)).toBeVisible()

    // Guided is the landing surface: it is the expanded one, and it says so in
    // the nav, in its tone, and in which of its blocks exist at all.
    await expect(segment(page, 'Review')).toHaveAttribute('data-selected', 'true')
    await expect(segment(page, 'Analysis')).toHaveAttribute('data-selected', 'false')
    await expect(segment(page, 'Review')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(REVIEW_SURFACE)).toHaveAttribute('data-tone', '2')
    await expect(page.locator(ANALYSIS_SURFACE)).toHaveAttribute('data-tone', '1')
    await expect(block(page, 'scoresheet'), 'the guided surface owns the scoresheet').toBeVisible()
    await expect(block(page, 'multipv'), 'the open surface stays collapsed until it is chosen').toHaveCount(0)

    // Both entry actions stay reachable from either surface — collapsed is not hidden.
    await expect(page.getByRole('button', { name: /^Review game$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Analyze' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Explore — play your own moves/ })).toBeVisible()

    await segment(page, 'Analysis').click()

    // Choosing the open surface swaps the emphasis; it never doubles it.
    await expect(segment(page, 'Analysis')).toHaveAttribute('data-selected', 'true')
    await expect(segment(page, 'Review')).toHaveAttribute('data-selected', 'false')
    await expect(page.locator(ANALYSIS_SURFACE)).toHaveAttribute('data-tone', '2')
    await expect(page.locator(REVIEW_SURFACE)).toHaveAttribute('data-tone', '1')
    await expect(block(page, 'multipv'), 'the open surface expands when chosen').toBeVisible()
    await expect(block(page, 'explore'), 'MultiPV comes before Explore').toBeVisible()
    await expect(block(page, 'scoresheet'), 'the guided surface collapses when it is not chosen').toHaveCount(0)

    const order = await renderedBlocks(page)
    expect(order, 'the open surface orders MultiPV, then Explore').toEqual(['multipv', 'explore'])

    await expect(page.getByRole('button', { name: /^Review game$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Analyze' })).toBeVisible()
  })

  test('walks a game through review, a stepped move, Explore, exit and Copy PGN', async ({ page }) => {
    // Given a played game, when it is reviewed, stepped, explored and exported, then every stage of the journey works.
    await playShortGame(page)
    const gradedMoves = await reviewTheGame(page)

    // Guided review orders its story: progress finishes, then legend, commentary and the scoresheet.
    await expect(block(page, 'legend')).toBeVisible()
    await expect(block(page, 'scoresheet')).toBeVisible()

    await gradedMoves.first().click()
    await expect(block(page, 'commentary'), 'stepping a move explains that move').toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to final position' })).toBeVisible()
    const guidedOrder = await renderedBlocks(page)
    expect(guidedOrder, 'commentary, the better line and the scoresheet all arrived').toEqual(
      expect.arrayContaining(['legend', 'commentary', 'moves', 'scoresheet']),
    )
    expect(guidedOrder, 'the guided surface keeps its beats in order').toEqual(
      GUIDED_ORDER.filter((beat) => guidedOrder.includes(beat)),
    )

    await page.getByRole('button', { name: /Explore — play your own moves/ }).click()
    await expect(page.getByText('Exploring — play any moves')).toBeVisible()
    await expect(
      segment(page, 'Analysis'),
      'starting Explore brings the open surface forward',
    ).toHaveAttribute('data-selected', 'true')
    await expect(segment(page, 'Review'), 'Explore pins its own surface open so Exit stays reachable').toHaveAttribute(
      'aria-disabled',
      'true',
    )

    await page.getByRole('button', { name: 'Exit' }).click()
    await expect(page.getByRole('button', { name: /Explore — play your own moves/ })).toBeVisible()
    await expect(page.getByText('Exploring — play any moves')).toHaveCount(0)

    await segment(page, 'Review').click()
    await expect(block(page, 'scoresheet')).toBeVisible()
    await page.getByRole('button', { name: 'Copy PGN' }).click()
    await expect(page.getByText('PGN copied to clipboard')).toBeVisible()
  })

  test('keeps the reviewed position while the chosen surface changes', async ({ page }) => {
    // Given a stepped review position, when the surface is switched away and back, then the board and the selection are untouched.
    await playShortGame(page)
    const gradedMoves = await reviewTheGame(page)

    await gradedMoves.first().click()
    await expect(gradedMoves.first()).toHaveClass(/brass-wash/)
    const stepped = await boardState(page)

    await segment(page, 'Analysis').click()
    await expect(block(page, 'multipv')).toBeVisible()
    expect(await boardState(page), 'leaving the guided surface must not move the board').toBe(stepped)

    await segment(page, 'Review').click()
    await expect(block(page, 'commentary')).toBeVisible()
    expect(await boardState(page), 'returning to the guided surface must not move the board').toBe(stepped)
    await expect(gradedMoves.first(), 'the stepped move is still the selected one').toHaveClass(/brass-wash/)
    await expect(page.getByRole('button', { name: 'Back to final position' })).toBeVisible()
  })

  test('drives the sub-navigation from the keyboard alone', async ({ page }) => {
    // Given focus on the sub-navigation, when only arrow and activation keys are used, then the surface changes.
    await openStudy(page)

    await segment(page, 'Review').focus()
    await expect(segment(page, 'Review')).toBeFocused()

    await page.keyboard.press('ArrowRight')
    await expect(segment(page, 'Analysis'), 'arrow keys rove focus inside the group').toBeFocused()
    await page.keyboard.press('Enter')
    await expect(segment(page, 'Analysis')).toHaveAttribute('data-selected', 'true')
    await expect(block(page, 'multipv')).toBeVisible()

    await page.keyboard.press('ArrowLeft')
    await expect(segment(page, 'Review')).toBeFocused()
    await page.keyboard.press('Space')
    await expect(segment(page, 'Review')).toHaveAttribute('data-selected', 'true')
    await expect(block(page, 'scoresheet')).toBeVisible()

    await page.keyboard.press('End')
    await expect(segment(page, 'Analysis'), 'End jumps to the last surface').toBeFocused()
    await page.keyboard.press('Home')
    await expect(segment(page, 'Review'), 'Home jumps back to the first').toBeFocused()
  })

  test(`fits ${PHONE.width}px with every study target at least ${TARGET_MIN}px`, async ({ page }) => {
    // Given the smallest supported phone, when either surface is chosen, then nothing overflows and every control is reachable.
    await page.setViewportSize(PHONE)
    await openStudy(page)

    await expectTarget(segment(page, 'Review'), 'Review segment')
    await expectTarget(segment(page, 'Analysis'), 'Analysis segment')
    await expectTarget(page.getByRole('button', { name: 'Analyze' }), 'Analyze action')
    await expectTarget(page.getByRole('button', { name: /Explore — play your own moves/ }), 'Explore action')
    await expectTarget(page.getByRole('button', { name: 'Copy PGN' }), 'Copy PGN action')
    expect(await horizontalOverflow(page), 'the guided surface overflows horizontally').toBe(false)

    await segment(page, 'Analysis').click()
    await expect(block(page, 'multipv')).toBeVisible()
    expect(await horizontalOverflow(page), 'the open surface overflows horizontally').toBe(false)

    const navBox = await subNav(page).boundingBox()
    expect(navBox?.width ?? 0, 'the sub-navigation stays inside the viewport').toBeLessThanOrEqual(PHONE.width)
  })
})
