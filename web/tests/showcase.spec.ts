import { expect, test, type Locator, type Page } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 375 },
  { name: 'tablet', width: 768 },
  { name: 'desktop', width: 1280 },
] as const

/**
 * DESIGN.md §7.3, transcribed. Every row is a contract the gallery must render;
 * deleting one here or in the gallery fails this spec, which is the point.
 */
const MATRIX: Readonly<Record<string, readonly string[]>> = {
  Btn: ['default', 'hover', 'focus', 'active', 'disabled', 'loading'],
  IconButton: ['default', 'hover', 'focus', 'active', 'disabled'],
  Field: ['default', 'focus', 'disabled', 'error'],
  GroupedSelect: ['default', 'hover', 'focus', 'disabled', 'empty'],
  Slider: ['default', 'hover', 'focus', 'active', 'disabled'],
  Surface: ['default', 'hover', 'focus'],
  SegmentedNav: ['default', 'hover', 'focus', 'active', 'disabled'],
  WorkspaceNav: ['default', 'hover', 'focus', 'active', 'loading'],
  EngineStatus: ['default', 'loading', 'error'],
  StatusNote: ['default', 'error'],
  InlineFeedback: ['default', 'loading', 'empty', 'error'],
  DialogSurface: ['default', 'focus', 'active'],
  Toast: ['default', 'focus', 'active'],
  Loading: ['loading'],
  Empty: ['empty'],
  Error: ['error'],
}

const MIN_TARGET = 44

const background = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor)

async function measureTargets(page: Page) {
  return page.evaluate((floor) => {
    const focusable = 'button, a[href], input, select, textarea, summary, [tabindex]'
    return [...document.querySelectorAll<HTMLElement>(`.sc-cell-body ${focusable}`)]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          where: element.closest('[data-sc-case]')?.getAttribute('data-sc-case') ?? '?',
          name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      })
      .filter((target) => target.width > 0 && (target.width < floor || target.height < floor))
  }, MIN_TARGET)
}

for (const viewport of viewports) {
  test(`dev-only primitive showcase remains accessible at ${viewport.width}px`, async ({ page }, testInfo) => {
    // Given the dev-only Vite entry at a representative viewport; when it renders; then it fits the viewport.
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto('http://127.0.0.1:4173/showcase.html')
    await expect(page.locator('[data-sc-ready="true"]')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)

    // Given the DESIGN.md 7.3 matrix; when the gallery renders; then every contracted state is present exactly once.
    for (const [primitive, states] of Object.entries(MATRIX)) {
      for (const state of states) {
        await expect(page.locator(`[data-sc-case="${primitive}:${state}"]`), `${primitive}/${state}`).toHaveCount(1)
      }
    }

    // Given every interactive element in the gallery; when measured; then none is below the 44px hit-area floor.
    expect(await measureTargets(page)).toEqual([])

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

    // Given a pointer over a resting Btn; when it hovers; then the fill lifts to the hover tone.
    const hoverable = page.locator('[data-sc-case="Btn:hover"] button')
    const restingFill = await background(hoverable)
    await hoverable.hover()
    await expect.poll(() => background(hoverable)).not.toBe(restingFill)

    // Given a pressed Btn; when the pointer is held down; then it reports the press with a scale, never a layout change.
    const pressable = page.locator('[data-sc-case="Btn:active"] button')
    const box = await pressable.boundingBox()
    if (box === null) throw new Error('the Btn active case is not rendered')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await expect
      .poll(() => pressable.evaluate((element) => getComputedStyle(element).transform))
      .toContain('matrix')
    await page.mouse.up()

    // Given the loading Btn; when it is busy; then it is announced busy and locks its width against reflow.
    const idle = page.locator('[data-sc-probe="btn-idle"] button')
    const busy = page.locator('[data-sc-probe="btn-loading"] button')
    await expect(busy).toHaveAttribute('aria-busy', 'true')
    expect((await busy.boundingBox())?.width).toBe((await idle.boundingBox())?.width)

    // Given a Field in its error state; when inspected; then the control itself carries the error wiring and a worded message.
    const invalid = page.locator('[data-sc-case="Field:error"] .ui-control')
    await expect(invalid).toHaveAttribute('aria-invalid', 'true')
    const errorId = await invalid.getAttribute('aria-errormessage')
    expect(errorId).toBeTruthy()
    await expect(page.locator(`[id="${errorId}"]`)).toContainText('Error')

    // Given the DialogSurface trigger; when it opens; then focus enters, stays trapped, and Escape returns it to the invoker.
    const invoker = page.getByRole('button', { name: 'Open dialog and return focus here' })
    await invoker.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Queen' })).toBeFocused()
    for (let tab = 0; tab < 8; tab += 1) await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(invoker).toBeFocused()

    // Given a toast; when it is dismissed; then it never hands focus to anything else.
    const dismiss = page.locator('[data-sc-case="Toast:default"]').getByRole('button', { name: 'Dismiss notification' })
    await dismiss.focus()
    await dismiss.click()
    await expect(page.locator('[data-sc-case="Toast:default"] .ui-toast')).toHaveCount(0)
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY')

    await page.screenshot({ path: testInfo.outputPath(`showcase-${viewport.name}-${viewport.width}.png`), fullPage: true })

    // Given a reduced-motion preference; when the loading state renders; then its animation becomes one near-instant
    // iteration and the spinner still reads as a determinate mark rather than a frozen ring.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    for (const selector of ['.ui-spinner', '.ui-skeleton']) {
      const animated = page.locator(selector).first()
      await expect(animated).toBeVisible()
      await expect
        .poll(() =>
          animated.evaluate((element) => {
            const style = getComputedStyle(element)
            const duration = style.animationDuration
            const durationMs = duration.endsWith('ms') ? Number.parseFloat(duration) : Number.parseFloat(duration) * 1000
            return durationMs <= 0.01 && style.animationIterationCount === '1'
          }),
        )
        .toBe(true)
    }
    await expect
      .poll(() => page.locator('.ui-spinner').first().evaluate((element) => getComputedStyle(element).borderRightColor))
      .not.toBe('rgba(0, 0, 0, 0)')

    await page.screenshot({
      path: testInfo.outputPath(`showcase-reduced-motion-${viewport.name}-${viewport.width}.png`),
      fullPage: true,
    })
  })
}
