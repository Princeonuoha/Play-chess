#!/usr/bin/env node
/* ---------------------------------------------------------------------------
 * Shell geometry probe (plan todo 12).
 *
 * DESIGN.md 8.3 turns "the board is below the fold on a phone" into a number:
 * on a first visit the board's top edge must render at or above `y=560`. This
 * script measures that number — and the rest of the §8.2 layout contract — at
 * every §8.2 viewport, against a running preview server, and writes one JSON
 * document plus one full-page screenshot per viewport.
 *
 * It is a measurement tool, not a gate: `web/tests/layout.spec.ts` owns the
 * assertions. This exists so the same numbers can be captured identically
 * before and after a composition change, which is the only way a before/after
 * claim means anything.
 *
 * Every position is reported in DOCUMENT space (`rect.top + scrollY`), because
 * a viewport-relative top silently changes meaning the moment the page is
 * scrolled.
 *
 * Usage:
 *   node scripts/measure-geometry.mjs --out <dir> --label before [--base <url>]
 * ------------------------------------------------------------------------- */

import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x900', width: 768, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x1000', width: 1440, height: 1000 },
]

/**
 * Candidate selectors per landmark, most explicit first. The redesign marks
 * every shell region with `data-shell`; the fallbacks keep the probe able to
 * measure the pre-redesign DOM so before/after use one methodology.
 */
const TARGETS = {
  header: ['[data-shell="header"]', 'header'],
  intro: ['[data-shell="intro"]', 'header + div'],
  board: ['.board'],
  status: ['[data-shell="status"]', 'main > *:nth-child(2) > div:first-child'],
  nav: ['[data-nav-safe-area="true"]'],
  inspector: ['[data-shell="inspector"]', 'main > *:nth-child(2)'],
  footer: ['[data-shell="footer"]', 'footer'],
}

const arg = (flag, fallback) => {
  const index = process.argv.indexOf(flag)
  return index === -1 ? fallback : process.argv[index + 1]
}

const outDir = arg('--out', null)
const label = arg('--label', 'geometry')
const baseURL = arg('--base', 'http://127.0.0.1:8000')
if (outDir === null) throw new Error('measure-geometry: --out <dir> is required')

async function measure(page) {
  return page.evaluate((targets) => {
    const box = (selectors) => {
      for (const selector of selectors) {
        const node = document.querySelector(selector)
        if (node === null) continue
        const rect = node.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        return {
          selector,
          x: Math.round((rect.left + window.scrollX) * 10) / 10,
          y: Math.round((rect.top + window.scrollY) * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
          bottom: Math.round((rect.bottom + window.scrollY) * 10) / 10,
        }
      }
      return null
    }
    const geometry = {}
    for (const [key, selectors] of Object.entries(targets)) geometry[key] = box(selectors)
    return {
      geometry,
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      },
    }
  }, targets())
}

function targets() {
  return TARGETS
}

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()
const captures = []

await mkdir(outDir, { recursive: true })
for (const viewport of VIEWPORTS) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.goto(`${baseURL}/play`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('.board')
  await page.waitForSelector('text=Welcome — here\'s how it works')
  // The board sizes itself from the viewport, so let one frame settle first.
  await page.waitForTimeout(250)
  const shot = join(outDir, `${label}-${viewport.name}.png`)
  await page.screenshot({ path: shot, fullPage: true })
  const measured = await measure(page)
  captures.push({ viewport, state: 'first-visit', screenshot: shot, ...measured })
  const board = measured.geometry.board
  console.log(
    `${label} ${viewport.name}: board.y=${board?.y} board.size=${board?.width} nav.y=${measured.geometry.nav?.y} ` +
      `footer.y=${measured.geometry.footer?.y} overflow=${measured.document.horizontalOverflow}`,
  )
}

const out = join(outDir, `${label}-geometry.json`)
await writeFile(out, `${JSON.stringify({ label, baseURL, capturedAt: new Date().toISOString(), captures }, null, 2)}\n`)
console.log(`measure-geometry: wrote ${out}`)

await context.close()
await browser.close()
