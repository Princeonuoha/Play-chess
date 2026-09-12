/* Icon evidence capture for plan todo 10. Runs against a static server of a
 * built `dist/`, so the same script measures the pre-change and post-change
 * builds identically. Usage: node capture-icon-evidence.mjs <baseURL> <outDir> */

import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const [baseURL, outDir] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })

const VIEWPORTS = [
  { name: '1280', width: 1280, height: 900 },
  { name: '375', width: 375, height: 812 },
]

const ICON_CONTROLS = [
  'How it works',
  'First move',
  'Previous move',
  'Next move',
  'Latest / live',
]

const BANNED = [
  [0x2190, 0x21ff],
  [0x2300, 0x23ff],
  [0x25a0, 0x25ff],
  [0x2600, 0x27bf],
  [0x2b00, 0x2bff],
  [0x1f000, 0x1faff],
]
const ALLOWED = [0x2605, 0x2713, 0x2717]

const scanGlyphs = (page) =>
  page.evaluate(
    ([banned, allowed]) => {
      const found = {}
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const char of node.textContent ?? '') {
          const code = char.codePointAt(0)
          if (allowed.includes(code)) continue
          if (!banned.some(([lo, hi]) => code >= lo && code <= hi)) continue
          const key = `U+${code.toString(16).toUpperCase()}`
          found[key] = (found[key] ?? 0) + 1
        }
      }
      return found
    },
    [BANNED, ALLOWED],
  )

const buttonNames = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('button')].map(
      (button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
    ),
  )

const report = {
  baseURL,
  accessibleNames: {},
  iconOnlyTargets: [],
  iconGeometry: [],
  glyphScanIntro: {},
  glyphScanWorkspace: {},
  buttonNamesByRoute: {},
}

const browser = await chromium.launch()

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  const page = await context.newPage()

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${outDir}/01-intro-${viewport.name}.png`, fullPage: true })
  if (viewport.name === '1280') report.glyphScanIntro = await scanGlyphs(page)

  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible()) await gotIt.click()

  await page.getByRole('link', { name: 'Openings', exact: true }).click()
  await page.getByPlaceholder(/name or ECO/).fill('French Defense: Alapin Gambit')
  await page.getByRole('button', { name: /French Defense: Alapin Gambit/ }).first().click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${outDir}/02-openings-${viewport.name}.png`, fullPage: true })
  if (viewport.name === '1280') report.buttonNamesByRoute.openings = await buttonNames(page)

  await page.getByRole('link', { name: 'Games', exact: true }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${outDir}/03-games-${viewport.name}.png`, fullPage: true })
  if (viewport.name === '1280') report.buttonNamesByRoute.games = await buttonNames(page)

  await page.getByRole('link', { name: 'Study', exact: true }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${outDir}/04-study-${viewport.name}.png`, fullPage: true })
  if (viewport.name === '1280') report.buttonNamesByRoute.study = await buttonNames(page)

  if (viewport.name === '1280') {
    for (const name of ICON_CONTROLS) {
      const control = page.getByRole('button', { name, exact: true })
      const count = await control.count()
      const box = count ? await control.first().boundingBox() : null
      report.accessibleNames[name] = {
        found: count > 0,
        width: box ? Math.round(box.width) : null,
        height: box ? Math.round(box.height) : null,
        meetsTarget: box ? box.width >= 44 && box.height >= 44 : null,
      }
    }

    report.iconOnlyTargets = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((button) => !button.textContent?.trim())
        .map((button) => {
          const rect = button.getBoundingClientRect()
          return {
            accessibleName: button.getAttribute('aria-label') ?? '',
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            meetsTarget: rect.width >= 44 && rect.height >= 44,
          }
        }),
    )

    report.iconGeometry = await page.evaluate(() =>
      [...document.querySelectorAll('svg[data-icon]')].map((svg) => {
        const style = getComputedStyle(svg)
        return {
          icon: svg.getAttribute('data-icon'),
          viewBox: svg.getAttribute('viewBox'),
          strokeWidth: style.strokeWidth,
          width: style.width,
          height: style.height,
          fill: style.fill,
          stroke: style.stroke,
          hidden: svg.getAttribute('aria-hidden'),
        }
      }),
    )

    report.glyphScanWorkspace = await scanGlyphs(page)
  }

  await context.close()
}

await browser.close()
writeFileSync(`${outDir}/report.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
