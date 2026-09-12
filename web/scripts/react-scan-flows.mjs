import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8000'
const outputDirectory = resolve(process.env.REACT_SCAN_OUTPUT ?? 'react-scan-report')

const flows = [
  {
    name: 'route-switches',
    run: async (page) => {
      for (const name of ['Openings', 'Games', 'Study', 'Play']) {
        await page.getByRole('link', { name, exact: true }).click()
        await page.getByRole('heading', { name, exact: true }).waitFor()
      }
    },
  },
  {
    name: 'making-a-move',
    run: async (page) => {
      await page.getByRole('button', { name: 'New game' }).click()
      await page.locator('.piece.mine[data-square="e2"]').click()
      await page.locator('.sq[data-square="e4"]').click({ force: true })
      await page.locator('.piece[data-square="e4"]').waitFor()
    },
  },
  {
    name: 'opening-a-dialog',
    run: async (page) => {
      await page.getByRole('button', { name: 'How it works' }).click()
      await page.getByRole('dialog').waitFor()
      await page.getByRole('button', { name: 'Got it' }).click()
    },
  },
  {
    name: 'toast',
    run: async (page) => {
      await page.getByRole('link', { name: 'Study', exact: true }).click()
      await page.getByRole('button', { name: 'Copy PGN' }).click()
    },
  },
]

await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const consoleErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})

const reports = []
try {
  for (const flow of flows) {
    await page.goto(`${baseURL}/play`, { waitUntil: 'domcontentloaded' })
    await page.locator('.board').waitFor()
    const intro = page.getByRole('button', { name: 'Got it' })
    if (await intro.isVisible()) await intro.click()
    await page.evaluate(() => {
      window.__reactScanRenders = []
      window.__reactScanFlowStart = performance.now()
    })
    await flow.run(page)
    await page.waitForTimeout(250)
    const renders = await page.evaluate(() => window.__reactScanRenders)
    const unnecessary = renders.filter((render) => render.unnecessary === true)
    const report = { flow: flow.name, renders, unnecessary }
    reports.push(report)
    await writeFile(resolve(outputDirectory, `${flow.name}.json`), `${JSON.stringify(report, null, 2)}\n`)
  }
} finally {
  await browser.close()
}

const summary = { baseURL, reports, consoleErrors }
await writeFile(resolve(outputDirectory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
if (consoleErrors.length > 0 || reports.some((report) => report.unnecessary.length > 0)) process.exitCode = 1
