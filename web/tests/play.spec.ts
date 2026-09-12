/* ---------------------------------------------------------------------------
 * The `/play` workspace contract (plan todo 14).
 *
 * `/play` had no hierarchy: `New game`, `Flip`, and `Take back` sat in one
 * three-up row at identical size, the two engine demonstrations bracketed the
 * setup stack, and the tier and think-time read-outs rendered at 10px. This
 * spec pins the shape that replaced it — one brass call to action, labelled
 * setup, subordinate board actions, and a separated demonstration surface —
 * so a second competing primary, an unlabelled control, a sub-44px target,
 * microcopy below the DESIGN.md 3.2 floor, or a setting lost across a route
 * change all fail here.
 *
 * The thresholds are read out of DESIGN.md rather than copied, so the document
 * stays the single source of the contract.
 * ------------------------------------------------------------------------- */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DESIGN = readFileSync(fileURLToPath(new URL('../../DESIGN.md', import.meta.url)), 'utf8')

function designNumber(pattern: RegExp, what: string): number {
  const match = DESIGN.match(pattern)
  if (match === null) throw new Error(`DESIGN.md no longer states ${what}`)
  return Number(match[1])
}

/** DESIGN.md 3.2: "Minimum rendered size is `--type-label` (12px at default zoom)." */
const TYPE_FLOOR = designNumber(/Minimum rendered size is `--type-label` \((\d+)px at default zoom\)/, 'a minimum rendered type size')

/** DESIGN.md 7.2 / 8.5 A11Y-02 target floor. */
const TARGET_MIN = designNumber(/hit area of at least `(\d+)px × \d+px`/, 'a minimum target size')

/** DESIGN.md 3.3 measure rule: every text container survives a 3x-length string. */
const LONG_COPY_FACTOR = designNumber(/Every text container must survive a (\d)x-length\s+string/, 'a long-copy factor')

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '768x900', width: 768, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
] as const

/** The routed panel body. The board, status line, and navigation sit outside it. */
const PANEL = '[data-shell="inspector"]'

async function openPlay(page: Page, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport)
  await page.goto('/play')
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible()) await gotIt.click()
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible()
}

/** The same reach `tests/routes.spec.ts` uses, so both specs pin one DOM shape. */
function setting(page: Page, label: string): Locator {
  return page.locator('label').filter({ hasText: label }).getByRole('slider')
}

function sliderBlock(page: Page, label: string): Locator {
  return page.locator('.ui-slider').filter({ hasText: label })
}

async function horizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

/** Elements whose own painted box escapes the panel it lives in. */
async function escapingChildren(page: Page): Promise<string[]> {
  return page.locator(PANEL).evaluate((panel) => {
    const bounds = panel.getBoundingClientRect()
    const escaped: string[] = []
    for (const node of panel.querySelectorAll<HTMLElement>('*')) {
      const rect = node.getBoundingClientRect()
      // Visually hidden live regions are 1x1 and positioned off the flow; they
      // paint nothing, so they cannot be an overflow.
      if (rect.width <= 1 || rect.height <= 1) continue
      if (rect.right > bounds.right + 1 || rect.left < bounds.left - 1) {
        escaped.push(`${node.tagName.toLowerCase()}.${String(node.className)} → ${Math.round(rect.left)}..${Math.round(rect.right)}`)
      }
    }
    return escaped
  })
}

test.describe('play workspace: one primary action and a readable hierarchy', () => {
  test.describe.configure({ timeout: 60_000 })

  test('offers exactly one primary call to action, and it is New game', async ({ page }) => {
    // Given the Play workspace, when it renders, then one brass button carries the DESIGN.md 8.1 primary action and every other button is secondary.
    await openPlay(page, VIEWPORTS[2])

    const primary = page.locator(`${PANEL} .ui-btn--primary`)
    await expect(primary, 'exactly one primary call to action may exist on /play').toHaveCount(1)
    await expect(primary).toHaveAccessibleName('New game')

    const buttons = page.locator(`${PANEL} .ui-btn`)
    const total = await buttons.count()
    expect(total, 'the panel still offers its board actions and engine demonstrations').toBeGreaterThan(1)
    await expect(page.locator(`${PANEL} .ui-btn--secondary`)).toHaveCount(total - 1)
  })

  test('keeps flip and take back present but subordinate to New game', async ({ page }) => {
    // Given the Play workspace, when the board actions render, then they are reachable, secondary, and grouped away from the primary action.
    await openPlay(page, VIEWPORTS[2])

    const actions = page.getByRole('region', { name: 'While you play' })
    for (const name of ['Flip board', 'Take back']) {
      const button = actions.getByRole('button', { name })
      await expect(button).toBeEnabled()
      await expect(button).toHaveClass(/ui-btn--secondary/)
    }
    await expect(actions.locator('.ui-btn--primary'), 'the board actions never compete with New game').toHaveCount(0)
  })

  test('separates the engine demonstrations from the setup flow', async ({ page }) => {
    // Given the Play workspace, when the demonstrations render, then they live in their own named surface, outside game setup.
    await openPlay(page, VIEWPORTS[2])

    const demos = page.getByRole('region', { name: 'Watch the engine' })
    await expect(demos).toBeVisible()
    await expect(demos).toHaveClass(/ui-surface/)
    await expect(demos.getByRole('button', { name: 'Watch Stockfish finish this game' })).toBeEnabled()
    await expect(demos.getByRole('button', { name: 'Watch a full engine game' })).toBeEnabled()

    const setup = page.getByRole('region', { name: 'Game setup' })
    await expect(setup.getByRole('button', { name: /^Watch/ }), 'setup holds no engine demonstration').toHaveCount(0)
    await expect(setup.getByRole('button', { name: 'New game' })).toBeVisible()
  })

  test('labels every control it offers', async ({ page }) => {
    // Given the Play workspace, when assistive technology reads it, then no interactive control is anonymous and both settings are bound to their own label.
    await openPlay(page, VIEWPORTS[2])

    await expect(page.getByRole('group', { name: 'Play as' })).toBeVisible()
    for (const side of ['white', 'black', 'random']) {
      await expect(page.getByRole('button', { name: side, exact: true })).toBeVisible()
    }

    await expect(setting(page, 'Difficulty'), 'the wrapper must not steal the control name').toHaveAccessibleName('Difficulty')
    await expect(setting(page, 'Think time')).toHaveAccessibleName('Think time')

    const anonymous = await page.locator(PANEL).evaluate((panel) => {
      const unnamed: string[] = []
      for (const node of panel.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')) {
        const label = node.getAttribute('aria-label') ?? ''
        const labelled = node.getAttribute('aria-labelledby') ?? ''
        const bound = node.id === '' ? [] : Array.from(panel.ownerDocument.querySelectorAll(`label[for="${node.id}"]`))
        const text = (node.textContent ?? '').trim()
        if (label === '' && labelled === '' && text === '' && bound.length === 0) {
          unnamed.push(`${node.tagName.toLowerCase()}.${String(node.className)}`)
        }
      }
      return unnamed
    })
    expect(anonymous, 'every interactive control carries a name').toEqual([])
  })

  test('announces a committed difficulty change without narrating every tick', async ({ page }) => {
    // Given the difficulty slider, when it is stepped from the keyboard, then the human tier reaches both `aria-valuetext` and the polite region.
    await openPlay(page, VIEWPORTS[2])

    const block = sliderBlock(page, 'Difficulty')
    const slider = setting(page, 'Difficulty')
    await slider.focus()
    await page.keyboard.press('ArrowRight')

    const shown = (await block.locator('.ui-slider-value').textContent())?.trim() ?? ''
    expect(shown, 'the tier and its Elo are the read-out, never a bare number').toMatch(/\d|full strength/)
    await expect(slider).toHaveAttribute('aria-valuetext', shown)
    await expect(block.locator('[aria-live="polite"]')).toHaveText(shown)
  })

  test(`renders no copy below the DESIGN.md 3.2 ${TYPE_FLOOR}px floor`, async ({ page }) => {
    // Given the Play workspace, when its text renders, then the engine, tier, and think-time read-outs are legible rather than microcopy.
    await openPlay(page, VIEWPORTS[0])

    const undersized = await page.locator(PANEL).evaluate((panel, floor) => {
      const bad: string[] = []
      for (const node of panel.querySelectorAll<HTMLElement>('*')) {
        const ownText = Array.from(node.childNodes).some((child) => child.nodeType === 3 && (child.textContent ?? '').trim() !== '')
        if (!ownText) continue
        const size = Number.parseFloat(getComputedStyle(node).fontSize)
        if (size < floor) bad.push(`${node.tagName.toLowerCase()}.${String(node.className)} at ${size}px`)
      }
      return bad
    }, TYPE_FLOOR)

    expect(undersized, `DESIGN.md 3.2 floors rendered text at ${TYPE_FLOOR}px`).toEqual([])

    const setup = page.getByRole('region', { name: 'Game setup' })
    await expect(setup, 'the engine is named at a readable step').toContainText('Opponent')
    await expect(sliderBlock(page, 'Difficulty').locator('.ui-slider-value'), 'the tier is readable beside its label').not.toBeEmpty()
  })

  test(`keeps every target at least ${TARGET_MIN}px at ${VIEWPORTS[0].name}`, async ({ page }) => {
    // Given the smallest supported phone, when the panel renders, then DESIGN.md 8.5 A11Y-02 holds for every control it owns.
    await openPlay(page, VIEWPORTS[0])

    const undersized = await page.locator(PANEL).evaluate((panel, min) => {
      const bad: string[] = []
      for (const node of panel.querySelectorAll<HTMLElement>('button, input[type="range"]')) {
        const rect = node.getBoundingClientRect()
        if (rect.width < min || rect.height < min) {
          bad.push(`${node.tagName.toLowerCase()}.${String(node.className)} ${Math.round(rect.width)}x${Math.round(rect.height)}`)
        }
      }
      return bad
    }, TARGET_MIN)

    expect(undersized, `DESIGN.md 8.5 A11Y-02 puts the floor at ${TARGET_MIN}px`).toEqual([])
  })

  for (const viewport of VIEWPORTS) {
    test(`never overflows at ${viewport.name}`, async ({ page }) => {
      // Given every DESIGN.md 8.2 step, when the panel renders and then its copy triples in length, then nothing escapes the panel or scrolls the page sideways.
      await openPlay(page, viewport)

      expect(await horizontalOverflow(page), 'the resting panel scrolls the page sideways').toBe(false)
      expect(await escapingChildren(page), 'the resting panel paints outside itself').toEqual([])

      await page.locator(PANEL).evaluate((panel, factor) => {
        for (const node of panel.querySelectorAll<HTMLElement>('.ui-btn-label, .ui-field-desc, .ui-surface-body, .ui-surface-title, .ui-seg-label, .ui-field-label, .ui-slider-value')) {
          node.textContent = Array.from({ length: factor }, () => `${node.textContent ?? ''} unabbreviated`).join(' ')
        }
      }, LONG_COPY_FACTOR)

      expect(await horizontalOverflow(page), `${LONG_COPY_FACTOR}x copy scrolls the page sideways`).toBe(false)
      expect(await escapingChildren(page), `${LONG_COPY_FACTOR}x copy paints outside the panel`).toEqual([])
    })
  }

  test('keeps side, difficulty, and think time across a trip to Study and back', async ({ page }) => {
    // Given a configured setup, when the route changes and returns, then the persistent controller is still the one that was configured.
    await openPlay(page, VIEWPORTS[2])

    await setting(page, 'Difficulty').fill('12')
    await setting(page, 'Think time').fill('2200')
    await page.getByRole('button', { name: 'black', exact: true }).click()
    await expect(page.getByRole('button', { name: 'black', exact: true })).toHaveAttribute('aria-pressed', 'true')

    const marker = `play-${Date.now()}`
    await page.locator('.board').evaluate((board, value) => {
      board.dataset.playTestMount = value
    }, marker)

    await page.getByRole('link', { name: 'Study', exact: true }).click()
    await expect(page).toHaveURL(/\/study$/)
    await page.getByRole('link', { name: 'Play', exact: true }).click()
    await expect(page).toHaveURL(/\/play$/)

    const board = page.locator('.board')
    await expect(board, 'exactly one board stays mounted').toHaveCount(1)
    await expect(board, 'the controller must not be reconstructed by routing').toHaveAttribute('data-play-test-mount', marker)

    await expect(setting(page, 'Difficulty')).toHaveValue('12')
    await expect(setting(page, 'Think time')).toHaveValue('2200')
    await expect(page.getByRole('button', { name: 'black', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(`${PANEL} .ui-btn--primary`), 'the route returns to one primary action').toHaveCount(1)
  })

  test('starts and stops a watched engine game from the demonstration surface', async ({ page }) => {
    // Given a booted engine, when the demonstration starts, then it announces itself as stoppable and the same control returns the workspace to rest.
    await openPlay(page, VIEWPORTS[0])
    await expect(page.locator('header [role="status"]')).not.toHaveText('loading engine…', { timeout: 30_000 })

    const demos = page.getByRole('region', { name: 'Watch the engine' })
    const watch = demos.getByRole('button', { name: 'Watch Stockfish finish this game' })
    await expect(watch).toBeEnabled()
    await watch.click()

    const stop = demos.getByRole('button', { name: 'Stop' }).first()
    await expect(stop).toBeVisible({ timeout: 15_000 })
    await stop.click()
    await expect(watch).toBeVisible({ timeout: 15_000 })
  })
})
