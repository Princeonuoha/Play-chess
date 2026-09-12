import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const evidenceDir = '/Users/prince.onuoha/work/tmp/chess-stockfish/.omo/evidence/frontend-visual-polish/task-2-frontend-visual-polish'
const manifestPath = join(evidenceDir, 'baseline-manifest.json')
const viewports = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x900', width: 768, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x1000', width: 1440, height: 1000 },
] as const
const tabs = ['Play', 'Openings', 'Games', 'Study'] as const

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
type Artifact = { readonly tab: (typeof tabs)[number]; readonly path: string }
type Capture = {
  readonly viewport: (typeof viewports)[number]
  readonly state: 'first-visit-intro'
  readonly artifacts: { readonly screenshot: string; readonly geometry: string; readonly accessibility: readonly Artifact[] }
  readonly geometry: Record<'intro' | 'board' | 'tabs' | 'header' | 'footer', Box>
}

async function dismissIntro(page: Page): Promise<void> {
  const intro = page.getByRole('button', { name: 'Got it' })
  if (await intro.isVisible()) await intro.click()
}

async function move(page: Page, from: string, to: string, color: 'w' | 'b'): Promise<void> {
  const movingPiece = page.locator(`.piece.mine[data-square="${from}"]`)
  await expect(movingPiece).toHaveAttribute('data-color', color)
  await movingPiece.click()
  await page.locator(`.sq[data-square="${to}"]`).click({ force: true })
}

async function boardState(page: Page): Promise<string> {
  return page
    .locator('.board .piece')
    .evaluateAll((pieces) => pieces.map((piece) => `${piece.getAttribute('data-square')}:${piece.getAttribute('data-color')}`).sort().join('|'))
}

async function moveListState(page: Page): Promise<string> {
  const moveList = page.locator('.moves')
  await expect(moveList).toBeVisible()
  return (await moveList.textContent())?.replace(/\s+/g, ' ').trim() ?? ''
}

async function measuredBox(page: Page, selector: string): Promise<Box> {
  const value = await page.locator(selector).boundingBox()
  if (!value) throw new Error(`Expected visible geometry target: ${selector}`)
  return { x: value.x, y: value.y, width: value.width, height: value.height }
}

async function visitTab(page: Page, tab: (typeof tabs)[number]): Promise<void> {
  await page.getByRole('link', { name: tab, exact: true }).click()
  await expect(page.getByRole('link', { name: tab, exact: true })).toBeVisible()
}

test('capture pre-redesign production behavior, geometry, console, and visual baselines', async ({ page, context }) => {
  const consoleErrors: string[] = []
  const requestFailures: string[] = []
  const responseErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`))
  page.on('response', (response) => {
    if (response.status() >= 400) responseErrors.push(`${response.status()} ${response.url()}`)
  })
  await context.grantPermissions(['clipboard-write'], { origin: 'http://127.0.0.1:8000' })
  await mkdir(evidenceDir, { recursive: true })

  const captures: Capture[] = []
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByText("Welcome — here's how it works")).toBeVisible()

    const screenshot = join(evidenceDir, `first-visit-${viewport.name}.png`)
    const geometryPath = join(evidenceDir, `geometry-${viewport.name}.json`)
    await page.screenshot({ path: screenshot, fullPage: true })
    const geometry = {
      intro: await measuredBox(page, 'header + div.rounded-\\[var\\(--radius-xl\\)\\]'),
      board: await measuredBox(page, '.board'),
      tabs: await measuredBox(page, '[data-nav-safe-area="true"]'),
      header: await measuredBox(page, 'header'),
      footer: await measuredBox(page, 'footer'),
    }
    await writeFile(geometryPath, `${JSON.stringify({ viewport, state: 'first-visit-intro', geometry }, null, 2)}\n`)

    const accessibility: Artifact[] = []
    for (const tab of tabs) {
      await visitTab(page, tab)
      const path = join(evidenceDir, `a11y-${viewport.name}-${tab.toLowerCase()}.txt`)
      await writeFile(path, `${await page.locator('body').ariaSnapshot()}\n`)
      accessibility.push({ tab, path })
    }
    captures.push({ viewport, state: 'first-visit-intro', artifacts: { screenshot, geometry: geometryPath, accessibility }, geometry })
  }

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.reload()
  await dismissIntro(page)
  await page.getByRole('button', { name: 'New game' }).click()
  await move(page, 'e2', 'e4', 'w')
  await expect(page.locator('.piece[data-square="e4"]')).toBeVisible()
  // Wait for the one expected engine reply; only then is the position stable enough to prove tab persistence.
  await expect(page.locator('.piece.mine')).toHaveCount(16, { timeout: 5_000 })
  await visitTab(page, 'Study')
  const before = { board: await boardState(page), moveList: await moveListState(page) }
  expect(before.moveList).toContain('e4')
  for (const tab of tabs) await visitTab(page, tab)
  await visitTab(page, 'Play')
  await visitTab(page, 'Study')
  const after = { board: await boardState(page), moveList: await moveListState(page) }
  expect(after).toEqual(before)

  await page.keyboard.press('Home')
  await expect(page.getByText(/Viewing move 0.*start/)).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText(/Viewing move 1/)).toBeVisible()
  await page.keyboard.press('End')
  await expect(page.getByText(/Live · move/)).toBeVisible()

  await page.getByRole('button', { name: 'Copy PGN' }).click()
  await expect(page.getByText('PGN copied to clipboard')).toBeVisible()

  // Given a completed live-game check, when promotion capture begins, then Explore starts from a reset board.
  await visitTab(page, 'Play')
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(page.locator('.board .piece')).toHaveCount(32)
  await expect(page.locator('.piece.mine[data-square="e2"]')).toHaveAttribute('data-color', 'w')
  await visitTab(page, 'Study')

  // Explore accepts legal moves for both colors, so this real on-board sequence reaches the existing promotion dialog without a test-only FEN hook.
  await page.getByRole('button', { name: /Explore — play your own moves/ }).click()
  for (const [from, to, color] of [
    ['a2', 'a4', 'w'], ['b8', 'c6', 'b'], ['a4', 'a5', 'w'], ['g8', 'h6', 'b'], ['a5', 'a6', 'w'], ['h6', 'g8', 'b'], ['a6', 'b7', 'w'], ['a7', 'a6', 'b'], ['b7', 'b8', 'w'],
  ]) {
    await move(page, from, to, color)
    if (to !== 'b8') await expect(page.locator(`.piece[data-square="${to}"][data-color="${color}"]`)).toBeVisible()
  }
  await expect(page.getByRole('heading', { name: 'Promote to' })).toBeVisible()
  const promotionChoices = page.locator('h3:text-is("Promote to") + div button')
  await expect(promotionChoices).toHaveCount(4)
  await promotionChoices.first().click()
  await expect(page.locator('.piece[data-square="b8"]')).toBeVisible()

  const engineBadge = page.locator('header > span.rounded-\\[var\\(--radius-pill\\)\\]')
  await expect(engineBadge).not.toHaveText('loading engine…', { timeout: 15_000 })
  const enginePresentation = { selector: 'header > span.rounded-\\[var\\(--radius-pill\\)\\]', visibleText: (await engineBadge.textContent())?.trim() ?? '' }

  // Chromium does not request a favicon for this document without a link tag. Fetching the conventional path records the existing missing asset as a known baseline defect.
  await page.evaluate(async () => {
    await fetch('/favicon.ico')
  })
  const behaviorPath = join(evidenceDir, 'behavior.json')
  const consoleNetworkPath = join(evidenceDir, 'console-network.json')
  const behavior = {
    firstVisitIntro: { storageKey: 'cwp_intro_seen', clearedLocalStorage: true, state: 'captured' },
    persistence: {
      state: 'captured',
      evidenceType: 'board-and-move-list-dom',
      nonUrlEvidence: true,
      selectors: ['.board .piece[data-square][data-color]', '.moves'],
      before,
      after,
      visitedTabs: tabs,
    },
    keyboardMoveNavigation: { state: 'captured', keys: ['Home', 'ArrowRight', 'End'], evidence: ['Viewing move 0 · start', 'Viewing move 1', 'Live · move'] },
    toast: { state: 'captured', trigger: 'Study / Copy PGN', visibleText: 'PGN copied to clipboard' },
    promotion: { state: 'captured', trigger: 'real Explore board sequence a2-a4 … b7-b8', choiceCount: 4, selected: 'first visual piece choice' },
    engine: {
      boot: { state: 'captured', ...enginePresentation },
      failure: { state: 'not-captured', reason: 'No deterministic engine-failure control exists without mutating production code or network behavior.' },
    },
  }
  const consoleNetwork = {
    consoleErrors,
    requestFailures,
    responseErrors,
    knownBaselineDefects: [{ defect: 'favicon 404', path: '/favicon.ico', status: 404, reason: 'unchanged app has no favicon asset' }],
  }
  await writeFile(behaviorPath, `${JSON.stringify(behavior, null, 2)}\n`)
  await writeFile(consoleNetworkPath, `${JSON.stringify(consoleNetwork, null, 2)}\n`)
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAgainst: 'production preview',
        viewports,
        tabs,
        captures,
        states: {
          firstVisitIntro: 'captured at every viewport',
          persistence: behaviorPath,
          keyboardMoveNavigation: behaviorPath,
          toast: behaviorPath,
          promotion: behaviorPath,
          engine: behaviorPath,
          consoleNetwork: consoleNetworkPath,
        },
        behavior,
        consoleNetwork,
      },
      null,
      2,
    )}\n`,
  )
})
