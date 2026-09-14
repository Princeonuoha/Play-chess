import { describe, it, expect } from 'vitest'
import { buildChromeLaunchConfig } from '../build-chrome-launch-config'

describe('Chrome executable discovery', () => {
  it('omits chromePath when CHROME_PATH is absent', () => {
    const config = buildChromeLaunchConfig({})

    expect(config.chromePath).toBeUndefined()
    expect(config.chromeFlags).toEqual([
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-proxy-server',
    ])
  })

  it('includes chromePath when CHROME_PATH environment variable is set', () => {
    const customChromePath = '/custom/path/to/chrome'
    const config = buildChromeLaunchConfig({ CHROME_PATH: customChromePath })

    expect(config.chromePath).toBe(customChromePath)
  })

  it('never hardcodes /Applications/Google Chrome.app/Contents/MacOS/Google Chrome', () => {
    const config = buildChromeLaunchConfig({})
    const hardcodedMacPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

    expect(config.chromePath).not.toBe(hardcodedMacPath)
    expect(config.chromePath).toBeUndefined()
  })
})
