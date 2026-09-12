/* ---------------------------------------------------------------------------
 * The first-visit guide contract (DESIGN.md 7.3 `DialogSurface`, 8.3, 8.5
 * A11Y-02/A11Y-10; plan todo 18).
 *
 * Two things are being proved at once, and they pull against each other:
 *
 *   1. The guide is a real modal dialog — semantics, initial focus, a trap,
 *      Escape, a backdrop exit, and focus restored to the control that opened
 *      it.
 *   2. Being that dialog costs the document nothing. The original defect was
 *      geometric: an in-flow welcome block pushed the board's top edge to
 *      y=738 on a 375px phone. The threshold is read out of DESIGN.md rather
 *      than copied here — the same source `tests/layout.spec.ts` reads — so the
 *      document stays the single authority and the board is measured with the
 *      guide open, not after it is dismissed.
 *
 * Both pointer and keyboard are driven at 375 and 1440, because the reopen
 * control has to restore focus identically whether it was tapped or activated
 * with a key.
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
/** DESIGN.md 8.5 A11Y-02. */
const TARGET_MIN = 44

const PHONE = { name: '375x812', width: 375, height: 812 } as const
const DESKTOP = { name: '1440x1000', width: 1440, height: 1000 } as const
const VIEWPORTS = [PHONE, DESKTOP] as const

const TITLE = "Welcome — here's how it works"
const ROUTES = [
  { label: 'Play', path: '/play' },
  { label: 'Openings', path: '/openings' },
  { label: 'Games', path: '/games' },
  { label: 'Study', path: '/study' },
] as const

function dialog(page: Page): Locator {
  return page.getByRole('dialog')
}

function helpControl(page: Page): Locator {
  return page.getByRole('button', { name: 'How it works' })
}

function dismissControl(page: Page): Locator {
  return page.getByRole('button', { name: 'Got it' })
}

/** Document-space geometry: a viewport-relative top changes meaning the moment the page scrolls. */
async function boardTop(page: Page): Promise<number> {
  return page.locator('.board').evaluate((node) => node.getBoundingClientRect().top + window.scrollY)
}

async function horizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

/**
 * A live `translateY` routes `getBoundingClientRect` through float32 maths, so
 * a 44px control reads as 43.999998 while the dialog is still entering. Targets
 * are a property of the resting layout, so the entry is awaited rather than
 * fudged with an epsilon.
 */
async function settled(page: Page): Promise<void> {
  await dialog(page).evaluate(async (node) => {
    await Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)))
  })
}

/** A visit with storage cleared, i.e. the state a brand-new player arrives in. */
async function firstVisit(page: Page, viewport: { width: number; height: number }, path = '/play'): Promise<void> {
  await page.setViewportSize(viewport)
  await page.goto(path)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(dialog(page)).toBeVisible()
  await expect(page.locator('.board')).toBeVisible()
}

/** A return visit: storage already carries the dismissal. */
async function returningVisit(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await firstVisit(page, viewport)
  await dismissControl(page).click()
  await expect(dialog(page)).toBeHidden()
}

async function activeElementInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => document.activeElement?.closest('dialog') !== null)
}

async function activeElementLabel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return ''
    return active.getAttribute('aria-label') ?? active.textContent?.trim() ?? ''
  })
}

test.describe('first-visit workspace guide', () => {
  test.describe.configure({ timeout: 60_000 })

  for (const viewport of VIEWPORTS) {
    test(`greets a first visit with a semantic modal dialog at ${viewport.name}`, async ({ page }) => {
      // Given cleared storage, when the workspace loads, then the guide is a real modal dialog carrying the DESIGN.md 8.3 promise and all four destinations.
      await firstVisit(page, viewport)

      const guide = dialog(page)
      await expect(guide).toBeVisible()
      await expect(guide).toHaveJSProperty('tagName', 'DIALOG')
      expect(await guide.evaluate((node) => (node as HTMLDialogElement).matches(':modal')), 'the guide must be a MODAL dialog').toBe(
        true,
      )
      await expect(guide).toHaveAccessibleName(TITLE)
      // Rendered through a portal, not inside the shell it must not displace.
      expect(await guide.evaluate((node) => node.parentElement?.tagName)).toBe('BODY')

      await expect(guide.getByText(TITLE)).toBeVisible()
      await expect(guide.getByText('One board, four workspaces.', { exact: false })).toBeVisible()
      for (const route of ROUTES) {
        const choice = guide.getByRole('button', { name: `Open ${route.label}` })
        await expect(choice).toBeVisible()
        // DESIGN.md 5.1: the destination mark is drawn SVG, never an emoji.
        await expect(choice.locator('svg[data-icon]')).toHaveCount(1)
      }
      expect(await guide.textContent(), 'no emoji may be used as an interface mark').not.toMatch(/\p{Extended_Pictographic}/u)
      expect(await horizontalOverflow(page), 'the open guide must never widen the document').toBe(false)
    })

    test(`keeps every guide target at or above ${TARGET_MIN}px at ${viewport.name}`, async ({ page }) => {
      // Given the open guide, when its controls are measured at rest, then DESIGN.md 8.5 A11Y-02 holds for each of them.
      await firstVisit(page, viewport)
      await settled(page)

      const targets = [
        dismissControl(page),
        dialog(page).getByRole('button', { name: 'Close the guide' }),
        ...ROUTES.map((route) => dialog(page).getByRole('button', { name: `Open ${route.label}` })),
      ]
      for (const target of targets) {
        const name = (await target.getAttribute('aria-label')) ?? (await target.innerText())
        const box = await target.boundingBox()
        expect(box, `${name} should have a box`).not.toBeNull()
        expect(box?.height ?? 0, `${name} height`).toBeGreaterThanOrEqual(TARGET_MIN)
        expect(box?.width ?? 0, `${name} width`).toBeGreaterThanOrEqual(TARGET_MIN)
      }
    })
  }

  test(`holds the board above y=${MOBILE_BOARD_TOP_MAX} while the guide is open at ${PHONE.name}`, async ({ page }) => {
    // Given a first visit on the smallest phone, when the guide is open, then the board is exactly where it is without it — the dialog overlays, it never displaces.
    await firstVisit(page, PHONE)

    const withGuide = await boardTop(page)
    expect(withGuide, `board top with the guide open (DESIGN.md 8.3)`).toBeLessThanOrEqual(MOBILE_BOARD_TOP_MAX)

    await dismissControl(page).click()
    await expect(dialog(page)).toBeHidden()
    const withoutGuide = await boardTop(page)
    expect(withGuide, 'opening the guide must cost the document zero height').toBe(withoutGuide)
    expect(await horizontalOverflow(page), 'the dismissed state must not overflow either').toBe(false)
  })

  test('moves focus into the guide, traps it, and restores it to the invoker on Escape', async ({ page }) => {
    // Given the guide reopened from the header help control, when focus is driven around it, then it enters, cannot leave, and comes back on Escape.
    await returningVisit(page, PHONE)

    const invoker = helpControl(page)
    await invoker.click()
    await expect(dialog(page)).toBeVisible()

    await expect(dialog(page).getByRole('button', { name: 'Open Play' })).toBeFocused()
    expect(await activeElementLabel(page), 'initial focus lands on the first destination').toBe('Open Play')

    // Twice around the dialog's own controls: a trap that only holds for one
    // lap is not a trap.
    for (let tab = 0; tab < 14; tab += 1) {
      await page.keyboard.press('Tab')
      expect(await activeElementInsideDialog(page), `focus escaped the trap after ${tab + 1} forward tabs`).toBe(true)
    }
    for (let tab = 0; tab < 8; tab += 1) {
      await page.keyboard.press('Shift+Tab')
      expect(await activeElementInsideDialog(page), `focus escaped the trap after ${tab + 1} backward tabs`).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    await expect(invoker, 'focus must return to the control that opened the guide').toBeFocused()
  })

  test('closes on a backdrop click and still returns focus to the invoker', async ({ page }) => {
    // Given the guide opened from the header, when the scrim outside it is clicked, then it closes and hands focus back rather than dropping it on the body.
    await returningVisit(page, DESKTOP)

    const invoker = helpControl(page)
    await invoker.click()
    const guide = dialog(page)
    await expect(guide).toBeVisible()

    const box = await guide.boundingBox()
    expect(box, 'the guide must have a box to click outside of').not.toBeNull()
    await page.mouse.click(Math.max(8, (box?.x ?? 0) / 2), Math.max(8, (box?.y ?? 0) / 2))

    await expect(guide).toBeHidden()
    await expect(invoker, 'a backdrop exit restores focus like every other exit').toBeFocused()
  })

  test('reopens from the header with the keyboard and returns focus there', async ({ page }) => {
    // Given a keyboard-only player on a phone, when the help control is activated with a key, then the guide opens and Escape returns focus to that same control.
    await returningVisit(page, PHONE)

    const invoker = helpControl(page)
    await invoker.focus()
    await expect(invoker).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(dialog(page)).toBeVisible()
    expect(await activeElementInsideDialog(page), 'a keyboard open must still move focus inside').toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    await expect(invoker).toBeFocused()
  })

  test.describe('on a touch phone', () => {
    test.use({ hasTouch: true })

    test(`reopens from a touch tap at ${PHONE.name}`, async ({ page }) => {
      // Given a touch-only phone, when the help control is tapped, then the guide opens and a tap on a destination navigates.
      await firstVisit(page, PHONE)
      await dismissControl(page).tap()
      await expect(dialog(page)).toBeHidden()

      await helpControl(page).tap()
      await expect(dialog(page)).toBeVisible()
      await dialog(page).getByRole('button', { name: 'Open Study' }).tap()
      await expect(page).toHaveURL(/\/study$/)
      await expect(dialog(page)).toBeHidden()
    })
  })

  test('persists its dismissal across a reload and reopens on demand', async ({ page }) => {
    // Given a dismissed guide, when the page is reloaded, then it stays away — and the header control still brings it back without clearing that memory.
    await firstVisit(page, PHONE)
    await dismissControl(page).click()
    await expect(dialog(page)).toBeHidden()
    expect(await page.evaluate(() => localStorage.getItem('cwp_intro_seen'))).toBe('1')

    await page.reload()
    await expect(page.locator('.board')).toBeVisible()
    await expect(dialog(page)).toBeHidden()

    await helpControl(page).click()
    await expect(dialog(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    expect(await page.evaluate(() => localStorage.getItem('cwp_intro_seen')), 'reopening must not un-dismiss the guide').toBe('1')

    await page.reload()
    await expect(page.locator('.board')).toBeVisible()
    await expect(dialog(page)).toBeHidden()
  })

  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`navigates to ${route.label} from its guide choice at ${viewport.name}`, async ({ page }) => {
        // Given the guide open on a first visit, when a destination is chosen, then the workspace routes there, the guide closes, and the board is never remounted.
        await firstVisit(page, viewport)
        const boardId = await page
          .locator('.board')
          .evaluate((node) => ((node as HTMLElement).dataset.probe = 'one-mount'))

        await dialog(page).getByRole('button', { name: `Open ${route.label}` }).click()

        await expect(page).toHaveURL(new RegExp(`${route.path}$`))
        await expect(dialog(page)).toBeHidden()
        await expect(page.getByRole('link', { name: route.label, exact: true })).toHaveAttribute('aria-current', 'page')
        await expect(page.locator('.board'), 'one board mount, always').toHaveCount(1)
        expect(await page.locator('.board').getAttribute('data-probe'), 'the board element survived the route change').toBe(boardId)
      })
    }
  }

  test('explains a route that has nothing to show yet', async ({ page }) => {
    // Given a workspace with no game played, when Play and Study render, then each says what it is waiting for instead of showing an unexplained blank.
    await returningVisit(page, PHONE)

    const playHint = page.locator('[data-route-hint="Play"]')
    await expect(playHint).toBeVisible()
    await expect(playHint).toContainText('New game')

    await page.getByRole('link', { name: 'Study', exact: true }).click()
    const studyHint = page.locator('[data-route-hint="Study"]')
    await expect(studyHint).toBeVisible()
    await expect(studyHint).toContainText('nothing to review yet')
    expect(await horizontalOverflow(page), 'a route hint must never widen the document').toBe(false)
  })
})
