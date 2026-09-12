import { expect, test, type Page } from '@playwright/test'

const routes = [
  { path: '/play', label: 'Play' },
  { path: '/openings', label: 'Openings' },
  { path: '/games', label: 'Games' },
  { path: '/study', label: 'Study' },
] as const

async function dismissIntro(page: Page): Promise<void> {
  const intro = page.getByRole('button', { name: 'Got it' })
  if (await intro.isVisible()) await intro.click()
}

async function tabToLink(page: Page, label: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.keyboard.press('Tab')
    if (await page.evaluate((expected) => document.activeElement?.textContent?.trim() === expected, label)) return
  }
  throw new Error(`Tab did not reach the ${label} workspace link`)
}

test.describe('workspace navigation accessibility', () => {
  test('marks exactly one active link with a non-color indicator and stronger weight', async ({ page }) => {
    await page.goto('/play')
    await dismissIntro(page)

    const links = page.getByRole('navigation', { name: 'Workspace' }).getByRole('link')
    await expect(links).toHaveCount(routes.length)
    await expect(links.filter({ has: page.locator('[data-nav-indicator="active"]') })).toHaveCount(1)
    await expect(links.filter({ has: page.locator('[data-nav-indicator="rest"]') })).toHaveCount(routes.length - 1)
    await expect(page.locator('nav[aria-label="Workspace"] a[aria-current="page"]')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Play', exact: true })).toHaveAttribute('aria-current', 'page')

    const activeWeight = await page.getByRole('link', { name: 'Play', exact: true }).evaluate((link) => getComputedStyle(link).fontWeight)
    const restWeight = await page.getByRole('link', { name: 'Openings', exact: true }).evaluate((link) => getComputedStyle(link).fontWeight)
    expect(Number(activeWeight)).toBeGreaterThan(Number(restWeight))
  })

  test('keeps every workspace link at least 44 by 44 CSS pixels at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/play')
    await dismissIntro(page)

    for (const route of routes) {
      const box = await page.getByRole('link', { name: route.label, exact: true }).boundingBox()
      expect(box, `${route.label} link should be visible`).not.toBeNull()
      expect(box?.width, `${route.label} width`).toBeGreaterThanOrEqual(44)
      expect(box?.height, `${route.label} height`).toBeGreaterThanOrEqual(44)
    }
  })

  test('reaches every workspace by Tab and Enter and moves focus to its route heading', async ({ page }) => {
    for (const route of routes) {
      await page.goto('/play')
      await dismissIntro(page)
      await tabToLink(page, route.label)
      await page.keyboard.press('Enter')

      await expect(page).toHaveURL(new RegExp(`${route.path}$`))
      await expect(page.getByRole('heading', { name: route.label, exact: true })).toBeFocused()
    }
  })

  for (const width of [375, 768, 1280]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/play')
      await dismissIntro(page)

      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
  }

  test('applies safe-area padding through the marked navigation track', async ({ page }) => {
    await page.goto('/play')
    await dismissIntro(page)

    const track = page.locator('[data-nav-safe-area="true"]')
    await expect(track).toHaveCount(1)
    await expect(track).toHaveAttribute('style', /safe-area-inset-(left|right|bottom)/)
    const padding = await track.evaluate((element) => {
      const style = getComputedStyle(element)
      return [style.paddingLeft, style.paddingRight, style.paddingBottom]
    })
    expect(padding.every((value) => Number.parseFloat(value) >= 4)).toBe(true)
  })
})
