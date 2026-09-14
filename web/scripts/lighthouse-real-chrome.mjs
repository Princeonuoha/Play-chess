import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'

const baseURL = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:8000'
const outputDirectory = resolve(process.env.LIGHTHOUSE_OUTPUT ?? 'lighthouse-report')
const samples = Number(process.env.LIGHTHOUSE_SAMPLES ?? 3)
const routes = ['/play', '/openings', '/games', '/study']
const formFactors = [
  { name: 'mobile', screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleRatio: 1.75 } },
  { name: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleRatio: 1 } },
]
const categoryIds = ['performance', 'accessibility', 'best-practices', 'seo']
const acceptedPerformanceFloors = {
  '/play': { mobile: 93, desktop: 76 },
  '/openings': { mobile: 91, desktop: 72 },
  '/games': { mobile: 95, desktop: 74 },
  '/study': { mobile: 95, desktop: 74 },
}
const enforceBudget = process.env.LIGHTHOUSE_ENFORCE_BUDGET === '1'

// Build chrome launcher config: honor CHROME_PATH if set, otherwise let chrome-launcher discover
const launchConfig = {
  chromeFlags: ['--headless=new', '--no-first-run', '--no-default-browser-check', '--no-proxy-server'],
}
if (process.env.CHROME_PATH) {
  launchConfig.chromePath = process.env.CHROME_PATH
}

const chrome = await launch(launchConfig)

await mkdir(outputDirectory, { recursive: true })
const results = []
try {
  for (const route of routes) {
    for (const formFactor of formFactors) {
      const scores = []
      for (let sample = 1; sample <= samples; sample += 1) {
        const report = await lighthouse(`${baseURL}${route}`, {
          formFactor: formFactor.name,
          logLevel: 'error',
          output: ['json', 'html'],
          port: chrome.port,
          screenEmulation: formFactor.screenEmulation,
        })
        const reportName = `${route.slice(1)}-${formFactor.name}-${sample}`
        const [json, html] = report.report
        await writeFile(resolve(outputDirectory, `${reportName}.json`), json)
        await writeFile(resolve(outputDirectory, `${reportName}.html`), html)
        const lhr = JSON.parse(json)
        scores.push(Object.fromEntries(categoryIds.map((id) => [id, Math.round(lhr.categories[id].score * 100)])))
      }
      const median = Object.fromEntries(
        categoryIds.map((id) => [
          id,
          [...scores].map((score) => score[id]).sort((left, right) => left - right)[Math.floor(scores.length / 2)],
        ]),
      )
      results.push({ route, formFactor: formFactor.name, samples: scores, median })
    }
  }
} finally {
  await chrome.kill()
}

await writeFile(resolve(outputDirectory, 'summary.json'), `${JSON.stringify({ baseURL, samples, results }, null, 2)}\n`)

if (enforceBudget) {
  const failures = results.flatMap(({ route, formFactor, median }) => {
    const floor = acceptedPerformanceFloors[route][formFactor]
    const qualityFailures = categoryIds
      .filter((category) => category !== 'performance' && median[category] !== 100)
      .map((category) => `${route} ${formFactor} ${category}=${median[category]} (required 100)`)
    return median.performance < floor
      ? [...qualityFailures, `${route} ${formFactor} performance=${median.performance} (required ${floor})`]
      : qualityFailures
  })
  if (failures.length > 0) {
    throw new Error(`Real-Chrome quality budget failed:\n${failures.join('\n')}`)
  }
}
