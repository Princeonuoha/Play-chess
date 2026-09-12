// Playwright is an explicitly permitted Node-side E2E driver, not the forbidden jsdom/@testing-library/react unit-test harness.
import { expect, test, type Locator, type Page } from '@playwright/test'

/* ---------------------------------------------------------------------------
 * Plan todo 16 — `/games` as a master-game library and replay workspace.
 *
 * Every assertion here drives the real production bundle: the real BOOK data,
 * the real single `ChessController`, and the real DESIGN.md 7.3 primitives. The
 * spec is deliberately built around one invariant that the pre-redesign panel
 * broke — *the visible game context always agrees with the picker* — because a
 * filtered-away selection used to keep rendering its own metadata underneath an
 * empty `<select>`.
 * ------------------------------------------------------------------------- */

const IMMORTAL = 'The “Immortal Game” · 1851  (You: White)'
const RETI = 'Réti–Bogoljubov · 1924  (You: White)'
const TARGET_MIN = 44
const GAME_COUNT = 10

function library(page: Page): Locator {
  return page.getByRole('region', { name: 'Game library' })
}

function selectedGame(page: Page): Locator {
  return page.getByRole('region', { name: 'Selected game' })
}

function picker(page: Page): Locator {
  return page.getByLabel('Master game')
}

async function openGames(page: Page): Promise<void> {
  await page.goto('/games')
  const intro = page.getByRole('button', { name: 'Got it' })
  if (await intro.isVisible()) await intro.click()
  await expect(picker(page)).toBeVisible()
}

/** The engine boots before any controller flow, exactly as `smoke.spec.ts` waits for it. */
async function waitForEngine(page: Page): Promise<void> {
  await expect(page.locator('header > span.rounded-\\[var\\(--radius-pill\\)\\]')).not.toHaveText('loading engine…', {
    timeout: 20_000,
  })
}

async function optionLabels(page: Page): Promise<string[]> {
  return picker(page).locator('option:not([disabled])').evaluateAll((options) => options.map((option) => option.textContent ?? ''))
}

async function groupLabels(page: Page): Promise<string[]> {
  return picker(page)
    .locator('optgroup')
    .evaluateAll((groups) => groups.map((group) => group.getAttribute('label') ?? ''))
}

/** The label the native picker is actually showing right now. */
async function pickedLabel(page: Page): Promise<string> {
  return picker(page).evaluate((node) => {
    const select = node as HTMLSelectElement
    return select.selectedIndex < 0 ? '' : (select.options[select.selectedIndex].textContent ?? '')
  })
}

/**
 * The anti-stale invariant. The heading of the selected-game context must name
 * the game the picker currently holds — never a game that a filter removed.
 */
async function expectContextMatchesPicker(page: Page): Promise<void> {
  const picked = await pickedLabel(page)
  const heading = selectedGame(page).getByRole('heading')
  await expect(heading).toBeVisible()
  const headingText = (await heading.textContent())?.trim() ?? ''
  expect(headingText.length, 'the selected-game context must name a game').toBeGreaterThan(0)
  expect(picked, `picker "${picked}" and context "${headingText}" disagree`).toContain(headingText)
}

async function expectTarget(control: Locator, name: string): Promise<void> {
  await expect(control).toBeVisible()
  const box = await control.boundingBox()
  expect(box, `${name} has no box`).not.toBeNull()
  expect(box?.height ?? 0, `${name} is under ${TARGET_MIN}px tall`).toBeGreaterThanOrEqual(TARGET_MIN)
}

async function horizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
}

test.describe('master-game library and replay workspace', () => {
  test.describe.configure({ timeout: 90_000 })

  test('narrows the library by search and reports the result count', async ({ page }) => {
    // Given the full library, when a player is searched, then the count, the picker, and the group label all narrow together.
    await openGames(page)

    await expect(library(page)).toContainText(`${GAME_COUNT} master games, grouped by opening`)
    expect(await optionLabels(page)).toHaveLength(GAME_COUNT)

    await page.getByLabel('Search games').fill('Fischer')

    await expect(library(page)).toContainText(`of ${GAME_COUNT} games match “Fischer”`)
    const fischer = await optionLabels(page)
    expect(fischer).toHaveLength(3)
    expect(fischer.every((label) => /Fischer|Benko|Byrne|Spassky/.test(label))).toBe(true)
    expect(await groupLabels(page)).toEqual(['3 results'])
    await expectContextMatchesPicker(page)

    await page.getByLabel('Search games').fill('Kieseritzky')

    expect(await optionLabels(page)).toEqual([IMMORTAL])
    await expect(selectedGame(page)).toContainText('Kieseritzky')
  })

  test('regroups the library when a facet is chosen', async ({ page }) => {
    // Given the library, when era and theme facets are chosen, then the picker regroups and the strip reports the active facet.
    await openGames(page)

    const browse = page.getByRole('group', { name: 'Browse by' })
    await browse.getByRole('button', { name: 'Era', exact: true }).click()

    await expect(browse.getByRole('button', { name: 'Era', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(library(page)).toContainText(`${GAME_COUNT} master games, grouped by era`)
    expect(await groupLabels(page)).toEqual([
      'Romantic (1800s)',
      'Classical (early 1900s)',
      'Modern (20th c.)',
      'World Championship',
    ])
    expect(await optionLabels(page)).toHaveLength(GAME_COUNT)

    await browse.getByRole('button', { name: 'Theme', exact: true }).click()

    await expect(library(page)).toContainText(`${GAME_COUNT} master games, grouped by theme`)
    expect(await groupLabels(page)).toEqual(['Attack', 'Sacrifice', 'Combination', 'Counterattack', 'Positional'])
    await expectContextMatchesPicker(page)
  })

  test('shows the selected game’s full context and swaps it on a new selection', async ({ page }) => {
    // Given a chosen master game, when it is selected, then its players, event, year, result and study facts are all visible.
    await openGames(page)

    await picker(page).selectOption({ label: IMMORTAL })

    const context = selectedGame(page)
    await expect(context.getByRole('heading', { name: 'The “Immortal Game”' })).toBeVisible()
    await expect(context).toContainText('Anderssen')
    await expect(context).toContainText('Kieseritzky')
    await expect(context).toContainText('1–0')
    await expect(context).toContainText('1851')
    await expect(context).toContainText("King's Gambit")
    await expect(context).toContainText('Sacrifice')
    await expect(context).toContainText('Romantic (1800s)')
    await expect(context).toContainText('White · Anderssen')
    await expect(context).toContainText('23 moves')
    await expectContextMatchesPicker(page)

    await picker(page).selectOption({ label: RETI })

    await expect(context.getByRole('heading', { name: 'Réti–Bogoljubov' })).toBeVisible()
    await expect(context).toContainText('Bogoljubov')
    await expect(context).not.toContainText('Kieseritzky')
    await expectContextMatchesPicker(page)
  })

  test('plays the selected game through on the single mounted board', async ({ page }) => {
    // Given the Immortal Game, when Play through runs, then the session starts on the one board and the context stays put.
    await openGames(page)
    await waitForEngine(page)
    await picker(page).selectOption({ label: IMMORTAL })

    const playThrough = page.getByRole('button', { name: 'Play through' })
    await expect(playThrough).toBeEnabled()
    await playThrough.click()

    await expect(page.locator('.board')).toHaveCount(1)
    await expect(page.locator('.tr-status')).toContainText('The “Immortal Game” · 1851')
    await expect(page.locator('.tr-status')).toContainText('move 0/23')
    await expect(selectedGame(page)).toContainText('Playing through The “Immortal Game”')
    await expect(selectedGame(page).getByRole('heading', { name: 'The “Immortal Game”' })).toBeVisible()

    const gameMove = page.getByRole('button', { name: 'Play game move' })
    await expect(gameMove).toBeEnabled()
    await gameMove.click()

    await expect(page.locator('.piece[data-square="e4"]')).toBeVisible()
    await expect(page.locator('.tr-status')).toContainText('move 1/23')
    await expect(page.locator('.board')).toHaveCount(1)
  })

  test('keeps the game’s context and a stop control visible while replaying', async ({ page }) => {
    // Given the Immortal Game, when Watch this game replays it, then progress is reported and the context never leaves.
    await openGames(page)
    await waitForEngine(page)
    await picker(page).selectOption({ label: IMMORTAL })

    await page.getByRole('button', { name: 'Watch this game' }).click()

    const context = selectedGame(page)
    await expect(context.getByText('Replaying The “Immortal Game” — Anderssen vs Kieseritzky.')).toBeVisible()
    await expect(context.locator('[aria-busy="true"]')).toHaveCount(1)
    await expect(context.getByRole('heading', { name: 'The “Immortal Game”' })).toBeVisible()
    await expect(context).toContainText('Kieseritzky')

    await expect.poll(() => page.locator('.tr-status').textContent(), { timeout: 30_000 }).toMatch(/· (?:[3-9]|[1-9]\d)[.…]/)

    await page.getByRole('button', { name: 'Stop replay' }).click()

    await expect(page.getByRole('button', { name: 'Watch this game' })).toBeVisible()
    await expect(context.locator('[aria-busy="true"]')).toHaveCount(0)
    await expect(context.getByRole('heading', { name: 'The “Immortal Game”' })).toBeVisible()
  })

  test('never leaves a filtered-away selection on screen and offers a way back', async ({ page }) => {
    // Given a selected game, when a search excludes it, then the context clears, the failure is announced, and recovery restores the library.
    await openGames(page)
    await picker(page).selectOption({ label: IMMORTAL })
    await expect(selectedGame(page)).toContainText('Kieseritzky')

    await page.getByLabel('Search games').fill('zzzz')

    await expect(library(page)).toContainText(`0 of ${GAME_COUNT} games match “zzzz”`)
    await expect(picker(page)).toHaveAttribute('aria-invalid', 'true')
    const errorId = await picker(page).getAttribute('aria-errormessage')
    expect(errorId, 'the invalid picker must point at a real error message').toBeTruthy()
    await expect(page.locator(`[id="${errorId}"]`)).toHaveText('No games match “zzzz”.')
    expect(await optionLabels(page)).toEqual([])
    await expect(picker(page).locator('option[disabled]')).toHaveText('No games match “zzzz”')

    // The stale selection may not survive anywhere on screen.
    await expect(selectedGame(page)).not.toContainText('Kieseritzky')
    await expect(selectedGame(page)).not.toContainText('Anderssen')
    await expect(selectedGame(page)).toContainText('No master game is selected')
    await expect(selectedGame(page)).toContainText('Replay controls stay off until a master game is selected.')
    await expect(page.getByRole('button', { name: 'Play through' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Watch this game' })).toBeDisabled()

    // The empty state is recoverable by a real control, not by instructions.
    const clear = library(page).getByRole('button', { name: 'Clear search' })
    await expectTarget(clear, 'empty-state recovery action')
    await clear.focus()
    await expect(clear).toBeFocused()
    await clear.click()

    await expect(library(page)).toContainText(`${GAME_COUNT} master games, grouped by opening`)
    expect(await optionLabels(page)).toHaveLength(GAME_COUNT)
    await expect(picker(page)).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('button', { name: 'Play through' })).toBeEnabled()
    await expectContextMatchesPicker(page)
  })

  test('repoints the selection when a narrowing filter drops the current game', async ({ page }) => {
    // Given a selected game, when a filter keeps results but drops that game, then the picker and the context move together.
    await openGames(page)
    await picker(page).selectOption({ label: IMMORTAL })
    await expect(selectedGame(page)).toContainText('Kieseritzky')

    await page.getByLabel('Search games').fill('Réti')

    expect(await optionLabels(page)).toEqual([RETI])
    await expect(selectedGame(page)).not.toContainText('Kieseritzky')
    await expect(selectedGame(page)).toContainText('Bogoljubov')
    await expectContextMatchesPicker(page)

    await page.getByRole('group', { name: 'Browse by' }).getByRole('button', { name: 'Player', exact: true }).click()

    expect(await optionLabels(page)).toHaveLength(GAME_COUNT)
    await expectContextMatchesPicker(page)
  })

  for (const viewport of [
    { name: '375x812', width: 375, height: 812 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1280x800', width: 1280, height: 800 },
  ] as const) {
    test(`keeps every library control reachable and unclipped at ${viewport.name}`, async ({ page }) => {
      // Given each supported width, when the workspace renders, then DESIGN.md 7.2 targets hold and nothing overflows sideways.
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await openGames(page)
      await picker(page).selectOption({ label: IMMORTAL })

      await expectTarget(page.getByLabel('Search games'), 'search field')
      await expectTarget(picker(page), 'master game picker')
      await expectTarget(page.getByRole('button', { name: 'Play through' }), 'play through')
      await expectTarget(page.getByRole('button', { name: 'Watch this game' }), 'watch this game')
      await expectTarget(page.getByRole('button', { name: 'Play game move' }), 'play game move')
      await expectTarget(page.getByText('Show hint (highlight the next move)'), 'hint toggle')
      for (const facet of ['Opening', 'Player', 'Theme', 'Era']) {
        await expectTarget(page.getByRole('group', { name: 'Browse by' }).getByRole('button', { name: facet, exact: true }), `${facet} facet`)
      }

      expect(await horizontalOverflow(page), `the games workspace overflows at ${viewport.name}`).toBe(false)

      // Long values must wrap rather than truncate: the era fact is the longest string in the summary.
      await expect(selectedGame(page)).toContainText('Romantic (1800s)')
      const clipped = await selectedGame(page).evaluate((region) =>
        [...region.querySelectorAll('dd, h3, p')].some((node) => node.scrollWidth > node.clientWidth + 1),
      )
      expect(clipped, 'a summary value is clipped instead of wrapped').toBe(false)
    })
  }
})
