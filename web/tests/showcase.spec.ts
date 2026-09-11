import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 375 },
  { name: 'tablet', width: 768 },
  { name: 'desktop', width: 1280 },
] as const

for (const viewport of viewports) {
  test(`dev-only primitive showcase remains accessible at ${viewport.width}px`, async ({ page }, testInfo) => {
    // Given the dev-only Vite entry at a representative viewport; when it renders; then it fits the viewport.
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto('http://127.0.0.1:4173/showcase.html')
    await expect(page.locator('[data-sc-ready="true"]')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)

    // Given keyboard navigation; when Tab leaves the focus seed; then the Btn primitive exposes the contracted focus ring.
    const seed = page.locator('[data-sc-seed="Btn:focus"]')
    await seed.focus()
    await page.keyboard.press('Tab')
    const focused = page.getByRole('button', { name: 'Start training' })
    await expect(focused).toBeFocused()
    await expect
      .poll(() =>
        focused.evaluate((element) => {
          const style = getComputedStyle(element)
          return style.outlineStyle === 'solid' && style.outlineWidth === '2px' && style.outlineOffset === '2px'
        }),
      )
      .toBe(true)

    // Given a reduced-motion preference; when the loading state renders; then its animation becomes one near-instant iteration.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    const spinner = page.locator('.sc-spinner').first()
    await expect(spinner).toBeVisible()
    await expect
      .poll(() =>
        spinner.evaluate((element) => {
          const style = getComputedStyle(element)
          const duration = style.animationDuration
          const durationMs = duration.endsWith('ms') ? Number.parseFloat(duration) : Number.parseFloat(duration) * 1000
          return durationMs <= 0.01 && style.animationIterationCount === '1'
        }),
      )
      .toBe(true)

    await page.screenshot({ path: testInfo.outputPath(`showcase-${viewport.name}-${viewport.width}.png`), fullPage: true })
  })
}
