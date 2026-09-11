import { expect, test, type Locator, type Page } from '@playwright/test'

const routes = [
  { path: '/play', name: 'Play', content: (page: Page) => page.getByRole('button', { name: 'New game' }) },
  {
    path: '/openings',
    name: 'Openings',
    content: (page: Page) => page.getByPlaceholder('name or ECO — e.g. Najdorf, Caro-Kann, B12'),
  },
  { path: '/games', name: 'Games', content: (page: Page) => page.getByPlaceholder('player, opening, e.g. Fischer or Berlin') },
  { path: '/study', name: 'Study', content: (page: Page) => page.getByText('Scoresheet', { exact: true }) },
] as const

type Route = (typeof routes)[number]

const pendingRouterEnabled = process.env.RUN_PENDING_ROUTER === '1'

async function dismissIntro(page: Page): Promise<void> {
  const intro = page.getByRole('button', { name: 'Got it' })
  if (await intro.isVisible()) await intro.click()
}

async function move(page: Page, from: string, to: string): Promise<void> {
  await page.locator(`.piece.mine[data-square="${from}"]`).click()
  await page.locator(`.sq[data-square="${to}"]`).click({ force: true })
}

async function expectWorkspace(page: Page, route: Route): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`${route.path}$`))
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: route.name, exact: true })).toBeVisible()
  await expect(route.content(page)).toBeVisible()
  await expect(page).toHaveTitle(new RegExp(`^${route.name} .*chesswithprince`, 'i'))
  await expect(page.getByRole('link', { name: route.name, exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.board')).toHaveCount(1)
}

async function boardState(page: Page): Promise<string> {
  return page.locator('.board .piece').evaluateAll((pieces) =>
    JSON.stringify(
      pieces
        .map((piece) => ({
          square: piece.getAttribute('data-square'),
          color: piece.getAttribute('data-color'),
          artwork: piece.innerHTML,
        }))
        .sort((left, right) => (left.square ?? '').localeCompare(right.square ?? '')),
    ),
  )
}

async function moveListState(page: Page): Promise<string> {
  const moveList = page.locator('.moves')
  await expect(moveList).toBeVisible()
  return (await moveList.textContent())?.replace(/\s+/g, ' ').trim() ?? ''
}

async function expectBoardMount(page: Page, marker: string): Promise<void> {
  const board = page.locator('.board')
  await expect(board).toHaveCount(1)
  await expect(board).toHaveAttribute('data-route-test-mount', marker)
}

async function navigateTo(page: Page, name: Route['name']): Promise<void> {
  const link = page.getByRole('link', { name, exact: true })
  await expect(link).toBeVisible()
  await link.click()
}

function setting(page: Page, label: string): Locator {
  return page.locator('label').filter({ hasText: label }).getByRole('slider')
}

test.describe('@pending-router routed persistent workspace', () => {
  test.describe.configure({ timeout: 30_000 })
  test.fixme(!pendingRouterEnabled, 'TODO 6: enable after the persistent routed workspace is implemented')

  test('redirects the application root to the Play workspace', async ({ page }) => {
    // Given the application root, when it is opened, then routing replaces it with the canonical Play workspace.
    await page.goto('/')

    await expectWorkspace(page, routes[0])
  })

  for (const route of routes) {
    test(`deep-links to the ${route.name} workspace with route semantics`, async ({ page }) => {
      // Given a canonical workspace URL, when it is loaded directly, then its content, metadata, landmark, and active navigation agree.
      const response = await page.goto(route.path)

      expect(response?.status()).toBeLessThan(400)
      await expectWorkspace(page, route)
    })

    test(`preserves the ${route.name} workspace across a full refresh`, async ({ page }) => {
      // Given a directly loaded workspace, when the document reloads, then the same semantic workspace is restored.
      await page.goto(route.path)
      await expect(route.content(page)).toBeVisible()

      const response = await page.reload()

      expect(response?.status()).toBeLessThan(400)
      await expectWorkspace(page, route)
    })
  }

  test('uses browser back and forward history between workspaces', async ({ page }) => {
    // Given three routed navigation entries, when history is traversed, then the matching workspace is restored at each entry.
    await page.goto('/play')
    await dismissIntro(page)
    await navigateTo(page, 'Openings')
    await navigateTo(page, 'Study')

    await page.goBack()
    await expectWorkspace(page, routes[1])
    await page.goForward()
    await expectWorkspace(page, routes[3])
  })

  test('renders an unknown in-app path inside the application shell instead of a hard 404', async ({ page }) => {
    // Given an unknown client-side path, when it is requested, then the shared shell remains available for recovery.
    const response = await page.goto('/not-a-workspace')

    expect(response?.status()).toBeLessThan(400)
    await expect(page.getByRole('heading', { name: /chesswithprince\.com/i })).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('navigation')).toBeVisible()
    await expect(page.locator('.board')).toHaveCount(1)
  })

  test('keeps one board, the exact game, move history, and settings while routes change', async ({ page }) => {
    // Given a configured game after e4 and Stockfish's reply, when routes change, then the same mounted workspace state returns intact.
    await page.goto('/play')
    await dismissIntro(page)
    await setting(page, 'Difficulty').fill('7')
    await setting(page, 'Think time').fill('1700')
    await page.getByRole('button', { name: 'New game' }).click()
    await move(page, 'e2', 'e4')
    await expect(page.locator('.piece[data-square="e4"]')).toBeVisible()
    await expect(page.locator('.piece.mine')).toHaveCount(16, { timeout: 5_000 })
    await page.getByRole('button', { name: 'black', exact: true }).click()

    const expectedBoard = await boardState(page)
    const mountMarker = `board-${Date.now()}`
    await page.locator('.board').evaluate((board, marker) => {
      board.dataset.routeTestMount = marker
    }, mountMarker)

    await navigateTo(page, 'Study')
    await expectBoardMount(page, mountMarker)
    const expectedMoves = await moveListState(page)
    expect(expectedMoves).toContain('e4')

    await navigateTo(page, 'Openings')
    await expectBoardMount(page, mountMarker)
    await navigateTo(page, 'Games')
    await expectBoardMount(page, mountMarker)
    await navigateTo(page, 'Play')

    await expectBoardMount(page, mountMarker)
    expect(await boardState(page)).toBe(expectedBoard)
    await expect(setting(page, 'Difficulty')).toHaveValue('7')
    await expect(setting(page, 'Think time')).toHaveValue('1700')
    await expect(page.getByRole('button', { name: 'black', exact: true })).toHaveClass(/bg-\[var\(--color-brass\)\]/)

    await navigateTo(page, 'Study')
    await expectBoardMount(page, mountMarker)
    expect(await boardState(page)).toBe(expectedBoard)
    expect(await moveListState(page)).toBe(expectedMoves)
  })
})
