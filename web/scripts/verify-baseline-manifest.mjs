import { existsSync, readFileSync } from 'node:fs'

const manifestPath = process.argv[2]
if (!manifestPath) throw new Error('Usage: node scripts/verify-baseline-manifest.mjs <baseline-manifest.json>')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const requiredViewports = ['375x812', '390x844', '768x900', '1024x768', '1280x800', '1440x1000']
const requiredTabs = ['Play', 'Openings', 'Games', 'Study']
const geometryTargets = ['intro', 'board', 'tabs', 'header', 'footer']
const requiredStates = ['firstVisitIntro', 'persistence', 'keyboardMoveNavigation', 'toast', 'promotion', 'engine', 'consoleNetwork']

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function isMeasuredBox(value) {
  return value && ['x', 'y', 'width', 'height'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))
}

assert(manifest.generatedAgainst === 'production preview', 'Manifest must state that it was generated against production preview')
assert(Array.isArray(manifest.viewports), 'Manifest viewports must be an array')
assert(requiredViewports.every((viewport) => manifest.viewports.some((item) => item.name === viewport && item.width > 0 && item.height > 0)), `Missing required viewport: ${requiredViewports.join(', ')}`)
assert(Array.isArray(manifest.tabs) && requiredTabs.every((tab) => manifest.tabs.includes(tab)), `Missing required tab: ${requiredTabs.join(', ')}`)
assert(Array.isArray(manifest.captures) && manifest.captures.length === requiredViewports.length, 'Manifest must contain exactly one capture per required viewport')
assert(manifest.states && requiredStates.every((state) => manifest.states[state]), `Missing required state: ${requiredStates.join(', ')}`)

for (const viewport of requiredViewports) {
  const capture = manifest.captures.find((item) => item.viewport?.name === viewport)
  assert(capture, `Missing capture for ${viewport}`)
  assert(capture.state === 'first-visit-intro', `Capture state is missing for ${viewport}`)
  assert(capture.artifacts?.screenshot && existsSync(capture.artifacts.screenshot), `Missing screenshot artifact for ${viewport}`)
  assert(capture.artifacts?.geometry && existsSync(capture.artifacts.geometry), `Missing geometry artifact for ${viewport}`)
  assert(geometryTargets.every((target) => isMeasuredBox(capture.geometry?.[target])), `Incomplete measured geometry for ${viewport}`)
  assert(Array.isArray(capture.artifacts?.accessibility), `Missing accessibility artifacts for ${viewport}`)
  for (const tab of requiredTabs) {
    const artifact = capture.artifacts.accessibility.find((item) => item.tab === tab)
    assert(artifact?.path && existsSync(artifact.path), `Missing ${tab} accessibility artifact for ${viewport}`)
  }
}

const persistence = manifest.behavior?.persistence
assert(persistence?.state === 'captured', 'Persistence state was not captured')
assert(persistence?.evidenceType === 'board-and-move-list-dom' && persistence?.nonUrlEvidence === true, 'Persistence must prove board and move-list DOM state; URL-only evidence is rejected')
assert(Array.isArray(persistence?.selectors) && persistence.selectors.includes('.board .piece[data-square][data-color]') && persistence.selectors.includes('.moves'), 'Persistence must name real board and move-list DOM selectors')
assert(persistence.before?.board && persistence.before?.moveList && persistence.after?.board && persistence.after?.moveList, 'Persistence must record before and after board and move-list DOM values')
assert(JSON.stringify(persistence.before) === JSON.stringify(persistence.after), 'Persistence DOM evidence changed across tabs')
assert(manifest.behavior?.keyboardMoveNavigation?.state === 'captured', 'Keyboard navigation was not captured')
assert(manifest.behavior?.toast?.state === 'captured', 'Toast path was not captured')
assert(manifest.behavior?.promotion?.state === 'captured', 'Promotion path was not captured')
assert(manifest.behavior?.engine?.boot?.state === 'captured', 'Engine boot presentation was not captured')
assert(manifest.behavior?.engine?.failure?.state === 'not-captured' && manifest.behavior.engine.failure.reason, 'Engine failure must be captured or explicitly not-captured with a reason')
assert(manifest.consoleNetwork?.knownBaselineDefects?.some((defect) => defect.defect === 'favicon 404' && defect.status === 404), 'Known favicon 404 baseline defect is not recorded')

console.log(`baseline manifest verified: ${manifest.captures.length} viewports, ${requiredTabs.length} tabs, ${requiredStates.length} states`)
