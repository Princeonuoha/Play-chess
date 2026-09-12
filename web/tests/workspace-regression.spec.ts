import { expect, test, type Page } from '@playwright/test'

const PRE_REDESIGN_BOARD_TOP = 738
const MOBILE_BOARD_TOP_MAX = 560
const UCI_STUB = `self.onmessage = (event) => {
  const cmd = String(event.data || '')
  if (cmd === 'uci') self.postMessage('uciok')
  else if (cmd === 'isready') self.postMessage('readyok')
  else if (cmd.slice(0, 2) === 'go') setTimeout(() => self.postMessage('bestmove (none)'), 5)
}`

const ROUTES = [
  { path: '/play', name: 'Play', ready: (page: Page) => page.getByRole('button', { name: 'New game' }) },
  { path: '/openings', name: 'Openings', ready: (page: Page) => page.getByPlaceholder('name or ECO — e.g. Najdorf, Caro-Kann, B12') },
  { path: '/games', name: 'Games', ready: (page: Page) => page.getByLabel('Master game', { exact: true }) },
  { path: '/study', name: 'Study', ready: (page: Page) => page.getByRole('group', { name: 'Study surface' }) },
] as const

const VISUAL_VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

async function stubEngine(page: Page): Promise<void> {
  await page.route('**/stockfish-18-lite-single.js*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: UCI_STUB }),
  )
}

async function openWorkspace(page: Page, path: (typeof ROUTES)[number]['path']): Promise<void> {
  await page.goto(path)
  await page.evaluate(() => localStorage.setItem('cwp_intro_seen', '1'))
  await page.reload()
  const route = ROUTES.find((entry) => entry.path === path)
  if (route === undefined) throw new Error(`Unrecognised workspace route: ${path}`)
  await expect(route.ready(page)).toBeVisible()
}

async function move(page: Page, from: string, to: string): Promise<void> {
  await page.locator(`.piece.mine[data-square="${from}"]`).click()
  await page.locator(`.sq[data-square="${to}"]`).click({ force: true })
}

async function boardState(page: Page): Promise<string> {
  return page.locator('.board .piece').evaluateAll((pieces) =>
    pieces
      .map((piece) => `${piece.getAttribute('data-square')}:${piece.getAttribute('data-color')}`)
      .sort()
      .join('|'),
  )
}

async function horizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

test.describe('workspace regression matrix', () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ page }) => {
    await stubEngine(page)
  })

  test('proves the first-use board leads instead of retaining the recorded pre-redesign geometry', async ({ page }) => {
    // Given first-use geometry recorded in task 12's authoritative before/after archive,
    // when the same 375x812 visit is measured, then the board is no longer below the old 738px intro.
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/play')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByRole('dialog', { name: "Welcome — here's how it works" })).toBeVisible()

    const boardTop = await page.locator('.board').evaluate((board) => board.getBoundingClientRect().top + window.scrollY)

    expect(boardTop, 'first-use board must improve on task-12 pre-redesign y=738').toBeLessThan(PRE_REDESIGN_BOARD_TOP)
    expect(boardTop, 'the board must lead within the current mobile visibility budget').toBeLessThanOrEqual(MOBILE_BOARD_TOP_MAX)
  })

  for (const viewport of VISUAL_VIEWPORTS) {
    for (const route of ROUTES) {
      test(`matches the stable ${route.name} workspace at ${viewport.name}`, async ({ page }) => {
        // Given a settled route at a supported viewport, when volatile engine output is masked, then its visual composition stays approved.
        await page.setViewportSize(viewport)
        await openWorkspace(page, route.path)

        await expect(page).toHaveScreenshot(`${route.name.toLowerCase()}-${viewport.name}.png`, {
          animations: 'disabled',
          caret: 'hide',
          fullPage: true,
          maxDiffPixelRatio: 0.01,
          mask: [
            page.locator('.evalbar'),
            page.locator('.an-line'),
            page.locator('[data-shell="status"]'),
            page.locator('header [role="status"]'),
            page.locator('.clock'),
          ],
        })
      })
    }
  }

  test('keeps an in-progress position through browser back and forward history', async ({ page }) => {
    // Given e4 on the persistent board, when routed history is traversed, then both route and exact position return unchanged.
    await openWorkspace(page, '/play')
    await page.getByRole('button', { name: 'New game' }).click()
    await move(page, 'e2', 'e4')
    await expect(page.locator('.piece[data-square="e4"]')).toBeVisible()
    const expected = await boardState(page)

    await page.getByRole('link', { name: 'Study', exact: true }).click()
    await expect(page).toHaveURL(/\/study$/)
    expect(await boardState(page)).toBe(expected)

    await page.goBack()
    await expect(page).toHaveURL(/\/play$/)
    expect(await boardState(page)).toBe(expected)

    await page.goForward()
    await expect(page).toHaveURL(/\/study$/)
    expect(await boardState(page)).toBe(expected)
  })

  for (const route of ROUTES) {
    test(`opens and escapes contextual help without focus loss on ${route.name}`, async ({ page }) => {
      // Given each routed workspace, when its help dialog opens and Escape closes it, then focus returns to the invoking control.
      await openWorkspace(page, route.path)
      const help = page.getByRole('button', { name: 'How it works' })
      await help.click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toBeHidden()
      await expect(help).toBeFocused()
    })
  }

  for (const route of ROUTES) {
    test(`contains ${route.name} under short-height long and empty-content stress`, async ({ page }) => {
      // Given the 1024x768 compact layout, when the route's longest useful empty state is rendered, then it remains reachable without horizontal overflow.
      await page.setViewportSize({ width: 1024, height: 768 })
      await openWorkspace(page, route.path)

      if (route.path === '/openings') {
        await page.getByPlaceholder('name or ECO — e.g. Najdorf, Caro-Kann, B12').fill('zzzzzzzzzzzzzzzzzz')
        await expect(page.getByText(/No openings match/)).toBeVisible()
      } else if (route.path === '/games') {
        await page.getByLabel('Search games').fill('zzzzzzzzzzzzzzzzzz')
        await expect(page.getByRole('button', { name: 'Clear search' })).toBeVisible()
      } else if (route.path === '/study') {
        await expect(page.getByText(/No moves yet\./)).toBeVisible()
        await page.getByRole('group', { name: 'Study surface' }).getByRole('button', { name: 'Analysis', exact: true }).click()
        await expect(page.getByText(/No lines yet\./)).toBeVisible()
      } else {
        await page.locator('[data-shell="status"]').evaluate((node) => {
          node.textContent = 'Draw — threefold repetition '.repeat(16).trim()
        })
        await expect(page.locator('[data-shell="status"]')).toContainText('threefold repetition')
      }

      expect(await horizontalOverflow(page), `${route.name} must not overflow under stress`).toBe(false)
      await expect(page.locator('.board')).toBeVisible()
    })
  }
})
