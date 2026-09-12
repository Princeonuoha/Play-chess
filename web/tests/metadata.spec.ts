import { expect, test, type Page } from '@playwright/test'

const canonicalOrigin = 'https://play.chesswithprince.com'

const routes = [
  {
    path: '/play',
    title: 'Play — chesswithprince.com',
    description: 'Play chess against Stockfish on chesswithprince.com.',
  },
  {
    path: '/openings',
    title: 'Openings — chesswithprince.com',
    description: 'Explore chess openings on chesswithprince.com.',
  },
  {
    path: '/games',
    title: 'Games — chesswithprince.com',
    description: 'Browse chess games on chesswithprince.com.',
  },
  {
    path: '/study',
    title: 'Study — chesswithprince.com',
    description: 'Study chess positions on chesswithprince.com.',
  },
] as const

async function expectRouteHead(page: Page, route: (typeof routes)[number]): Promise<void> {
  await expect(page).toHaveTitle(route.title)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', route.description)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonicalOrigin}${route.path}`)
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', route.title)
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', route.description)
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${canonicalOrigin}${route.path}`)
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary')
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', route.title)
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', route.description)
}

test('exposes complete route metadata and loads every production resource cleanly', async ({ page }) => {
  // Given the production preview, when every shareable workspace loads, then its head is route-specific and no browser resource fails.
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  const errorResponses: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) errorResponses.push(`${response.status()} ${response.url()}`)
  })

  for (const route of routes) {
    const response = await page.goto(route.path)

    expect(response?.status()).toBe(200)
    await expectRouteHead(page, route)
  }

  const favicon = await page.request.get('/favicon.ico')

  expect(favicon.status()).toBe(200)
  expect(consoleErrors).toEqual([])
  expect(failedRequests).toEqual([])
  expect(errorResponses).toEqual([])
})
