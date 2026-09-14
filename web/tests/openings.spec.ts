/* ---------------------------------------------------------------------------
 * The `/openings` discovery-then-training contract (plan todo 15).
 *
 * The defect this spec closes: browsing and training shared one undifferentiated
 * surface, so a player mid-session saw the same search field, popular chips, and
 * "Train this line" button as a player who had not started — and leaving the
 * route dropped them back into browse while the board stayed mid-session.
 *
 * Every assertion here is about that separation. The phase a panel is in is
 * published on its root as `data-openings-phase`, so the state can be asserted
 * without sampling a colour or guessing from a label.
 * ------------------------------------------------------------------------- */
import { expect, test, type Locator, type Page } from '@playwright/test'

/** DESIGN.md 8.5 A11Y-02. */
const TARGET_MIN = 44

/** DESIGN.md 3.2: the rendered floor is the 12px `--type-label` step. */
const TYPE_MIN = 12

const PHONE = { width: 375, height: 812 } as const
const TABLET = { width: 768, height: 900 } as const
const DESKTOP = { width: 1280, height: 800 } as const
const ALL_VIEWPORTS = [PHONE, TABLET, DESKTOP] as const

const SEARCH_PLACEHOLDER = 'name or ECO — e.g. Najdorf, Caro-Kann, B12'

function phase(page: Page): Locator {
  return page.locator('[data-openings-phase]')
}

async function phaseName(page: Page): Promise<string | null> {
  await expect(phase(page)).toHaveCount(1)
  return phase(page).getAttribute('data-openings-phase')
}

async function openOpenings(page: Page, viewport: { width: number; height: number } = DESKTOP): Promise<void> {
  await page.setViewportSize(viewport)
  await page.goto('/openings')
  const intro = page.getByRole('button', { name: 'Got it' })
  if (await intro.isVisible()) await intro.click()
  await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeVisible()
}

/** The French Alapin is the unambiguous five-ply data line the smoke flow uses. */
async function openAlapinDetail(page: Page): Promise<void> {
  await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill('French Defense: Alapin Gambit')
  await page.getByRole('button', { name: /French Defense: Alapin Gambit/ }).click()
  await expect(phase(page)).toHaveAttribute('data-openings-phase', 'detail')
}

async function startTraining(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Train this line', exact: true }).click()
  await expect(phase(page)).toHaveAttribute('data-openings-phase', 'training')
}

async function horizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

async function expectTarget(target: Locator, name: string): Promise<void> {
  await expect(target, `${name} should be visible`).toBeVisible()
  const box = await target.boundingBox()
  expect(box, `${name} should have a box`).not.toBeNull()
  expect(box!.height, `${name} should clear the ${TARGET_MIN}px floor`).toBeGreaterThanOrEqual(TARGET_MIN)
}

test.describe('openings: discovery, then focused training', () => {
  test.describe.configure({ timeout: 60_000 })

  test('browsing and training are different surfaces, not one merged view', async ({ page }) => {
    // Given the opening explorer, when a line is trained, then the browse affordances leave and the session names itself.
    await openOpenings(page)

    expect(await phaseName(page), 'the route opens in browse').toBe('browse')
    await expect(page.getByRole('button', { name: 'Italian Game' })).toBeVisible()

    await openAlapinDetail(page)
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER), 'detail replaces the search surface').toBeHidden()
    await expect(page.getByText('French Defense', { exact: false }).first()).toBeVisible()

    await startTraining(page)

    // The browse surface is gone, and nothing about it lingers behind the session.
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER), 'training hides the search field').toBeHidden()
    await expect(page.getByRole('button', { name: 'Italian Game' }), 'training hides the popular picks').toBeHidden()
    await expect(page.getByRole('button', { name: 'Train this line', exact: true }), 'training hides the start CTA').toBeHidden()

    // And the session states what it is, for whom, and how to leave.
    await expect(page.getByRole('region', { name: 'Training session' })).toBeVisible()
    await expect(page.getByText('You play White')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play book move' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Leave training' })).toBeVisible()
  })

  test('offers exactly one start-training action while browsing', async ({ page }) => {
    // Given the detail state, when its actions are counted, then one control starts a session and no second one competes.
    await openOpenings(page)
    await openAlapinDetail(page)

    const starters = page
      .getByRole('button', { name: /train this line/i })
      .filter({ visible: true })
    await expect(starters, 'detail must present a single Start Training action').toHaveCount(1)
    await expect(starters).toHaveAccessibleName('Train this line')

    // The deeper aids exist, but they are disclosed rather than competing at rest.
    await expect(page.getByRole('button', { name: 'Watch this line played out' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Suggest best moves' })).toBeHidden()
    await page.getByText('Other ways to study this line').click()
    await expect(page.getByRole('button', { name: 'Watch this line played out' })).toBeVisible()
    await expect(starters, 'disclosing the aids must not add a second starter').toHaveCount(1)
  })

  test('an empty search explains itself and offers a way back', async ({ page }) => {
    // Given a query that matches nothing, when the results render, then the state is announced, named, and recoverable.
    await openOpenings(page)
    const search = page.getByPlaceholder(SEARCH_PLACEHOLDER)
    await search.fill('zzzzzzz not an opening')

    await expect(page.locator('[data-openings-results]')).toHaveCount(0)
    const empty = page.getByText(/No openings match/)
    await expect(empty).toBeVisible()
    await expect(empty, 'the empty state names the query it failed on').toContainText('zzzzzzz not an opening')
    await expect(empty, 'the empty state says what to try instead').toContainText('ECO code')

    const recover = page.getByRole('button', { name: 'Clear the search' })
    await expectTarget(recover, 'empty-state recovery')
    await recover.click()

    await expect(search).toHaveValue('')
    await expect(search, 'recovery returns focus to the field it emptied').toBeFocused()
    await expect(page.getByRole('button', { name: 'Italian Game' })).toBeVisible()
    expect(await phaseName(page)).toBe('browse')
  })

  test('names the load as it happens instead of showing an empty panel', async ({ page }) => {
    // Given a slow database response, when the route opens, then a busy region names the operation.
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/openings.json', async (route) => {
      await held
      await route.continue()
    })

    await page.setViewportSize(DESKTOP)
    await page.goto('/openings')
    const intro = page.getByRole('button', { name: 'Got it' })
    if (await intro.isVisible()) await intro.click()

    await expect(phase(page)).toHaveAttribute('data-openings-phase', 'loading')
    const loading = page.getByText('Loading the opening database…')
    await expect(loading).toBeVisible()
    await expect(loading.locator('xpath=..')).toHaveAttribute('aria-busy', 'true')

    release()
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeVisible({ timeout: 20_000 })
  })

  test('reports a failed database load in plain language and retries', async ({ page }) => {
    // Given a database that cannot be fetched, when the route opens, then the failure is an alert with a working retry.
    let fail = true
    await page.route('**/openings.json', async (route) => {
      if (fail) await route.abort('failed')
      else await route.continue()
    })

    await page.setViewportSize(DESKTOP)
    await page.goto('/openings')
    const intro = page.getByRole('button', { name: 'Got it' })
    if (await intro.isVisible()) await intro.click()

    await expect(phase(page)).toHaveAttribute('data-openings-phase', 'error')
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert, 'the headline is language, not a stack trace').toContainText('Couldn’t load the opening database')
    await expect(alert.getByText('Technical detail'), 'the raw failure stays behind a disclosure').toBeVisible()

    const retry = alert.getByRole('button', { name: 'Retry' })
    await expectTarget(retry, 'database retry')
    fail = false
    await retry.click()

    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeVisible({ timeout: 20_000 })
    expect(await phaseName(page)).toBe('browse')
  })

  test('a training session survives leaving the route and coming back', async ({ page }) => {
    // Given a live session, when the workspace routes away and returns, then the same session is still the surface shown.
    await openOpenings(page)
    await openAlapinDetail(page)
    await startTraining(page)

    await page.getByRole('button', { name: 'Play book move' }).click()
    await expect(page.locator('.piece[data-square="e4"]')).toBeVisible()
    await expect(page.locator('.tr-status')).toContainText('move 1/20')

    await page.getByRole('link', { name: 'Study', exact: true }).click()
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toHaveCount(0)
    await page.getByRole('link', { name: 'Openings', exact: true }).click()

    expect(await phaseName(page), 'returning must not drop the player into browse').toBe('training')
    const session = page.getByRole('region', { name: 'Training session' })
    await expect(session).toBeVisible()
    await expect(session.getByText('French Defense', { exact: true })).toBeVisible()
    await expect(session.getByText('C00')).toBeVisible()
    await expect(page.locator('.tr-status'), 'the session keeps its progress').toContainText('move 1/20')
    await expect(page.getByPlaceholder(SEARCH_PLACEHOLDER)).toBeHidden()
  })

  test('a hint is reachable inside training, and leaving returns to that opening', async ({ page }) => {
    // Given a live session, when a hint is taken and the player leaves, then the aid works and the exit lands back on the line.
    await openOpenings(page)
    await openAlapinDetail(page)
    await startTraining(page)

    const hint = page.getByLabel('Show hint (highlight the book move)')
    await hint.check()
    await expect(page.locator('.board .hl.hint')).toHaveCount(2)

    await expect(page.getByText('Show the whole line')).toBeVisible()
    await expect(page.getByText('1.e4 e6 2.d4 d5 3.Be3')).toBeHidden()
    await page.getByText('Show the whole line').click()
    await expect(page.getByText('1.e4 e6 2.d4 d5 3.Be3')).toBeVisible()

    await page.getByRole('button', { name: 'Leave training' }).click()

    expect(await phaseName(page), 'leaving returns to the line that was trained').toBe('detail')
    await expect(page.locator('.tr-status')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Train this line', exact: true })).toBeVisible()
  })

  test('a training session ends when the board is taken by another route', async ({ page }) => {
    // Given a live session, when a new game claims the board, then the panel stops claiming a session that no longer exists.
    await openOpenings(page)
    await openAlapinDetail(page)
    await startTraining(page)

    await page.getByRole('link', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'New game' }).click()
    await page.getByRole('link', { name: 'Openings', exact: true }).click()

    expect(await phaseName(page), 'a discarded session must not be shown as live').toBe('detail')
    await expect(page.getByRole('button', { name: 'Train this line', exact: true })).toBeVisible()
  })

  for (const viewport of ALL_VIEWPORTS) {
    test(`keeps every openings state within ${viewport.width}px`, async ({ page }) => {
      // Given each DESIGN.md 8.2 viewport, when browse, empty, detail, and training render, then nothing scrolls sideways.
      await openOpenings(page, viewport)
      expect(await horizontalOverflow(page), 'browse overflows horizontally').toBe(false)

      await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill('zzzzzzz not an opening')
      await expect(page.getByText(/No openings match/)).toBeVisible()
      expect(await horizontalOverflow(page), 'the empty state overflows horizontally').toBe(false)

      await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill('French Defense: Alapin Gambit')
      await page.getByRole('button', { name: /French Defense: Alapin Gambit/ }).click()
      expect(await horizontalOverflow(page), 'detail overflows horizontally').toBe(false)

      await startTraining(page)
      expect(await horizontalOverflow(page), 'training overflows horizontally').toBe(false)
    })
  }

  test(`keeps every openings control at least ${TARGET_MIN}px on the smallest phone`, async ({ page }) => {
    // Given the smallest supported phone, when each phase renders, then DESIGN.md 8.5 A11Y-02 holds for its controls.
    await openOpenings(page, PHONE)

    await expectTarget(page.getByPlaceholder(SEARCH_PLACEHOLDER), 'search field')
    await expectTarget(page.getByRole('button', { name: 'Italian Game' }), 'popular pick')

    await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill('French Defense: Alapin Gambit')
    await expectTarget(page.getByRole('button', { name: /French Defense: Alapin Gambit/ }), 'search result row')
    await page.getByRole('button', { name: /French Defense: Alapin Gambit/ }).click()

    await expectTarget(page.getByRole('button', { name: 'Back to all openings' }), 'back control')
    await expectTarget(page.getByRole('button', { name: 'White', exact: true }), 'side selector')
    await expectTarget(page.getByRole('button', { name: 'Train this line', exact: true }), 'start training')

    await startTraining(page)
    await expectTarget(page.getByRole('button', { name: 'Play book move' }), 'book move')
    await expectTarget(page.getByRole('button', { name: 'Leave training' }), 'leave training')
    await expectTarget(page.getByText('Show the whole line'), 'line disclosure')
  })

  test(`renders no openings copy below the ${TYPE_MIN}px type floor`, async ({ page }) => {
    // Given detail and training, when every rendered string is measured, then DESIGN.md 3.2's floor holds for this panel's own copy.
    await openOpenings(page)
    await openAlapinDetail(page)
    await page.getByText('Other ways to study this line').click()

    const measure = async (where: string) => {
      const offenders = await page.locator('[data-openings-phase]').evaluate((root, floor) => {
        const found: { text: string; size: number; deferred: boolean }[] = []
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const text = node.textContent?.trim() ?? ''
          const parent = node.parentElement
          if (text === '' || parent === null) continue
          const size = Number.parseFloat(getComputedStyle(parent).fontSize)
          if (size < floor) found.push({ text: text.slice(0, 40), size, deferred: parent.closest('.tr-status') !== null })
        }
        return found
      }, TYPE_MIN)

      expect(
        offenders.filter((o) => !o.deferred),
        `${where} renders panel copy below the DESIGN.md 3.2 floor`,
      ).toEqual([])

      // The controller's own status path is the 11.5px string DESIGN.md 3.2 names
      // and defers to todos 12-14; `index.css` owns it, this panel does not.
      for (const row of offenders) expect(row.size).toBe(11.5)
    }

    await measure('detail')
    await startTraining(page)
    await measure('training')
  })
})
