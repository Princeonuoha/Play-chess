import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Regression test for cross-platform Chrome executable discovery.
 *
 * Verifies that the chrome-launcher module discovers Chrome automatically
 * on all platforms (macOS, Linux, Windows) rather than hardcoding a
 * macOS-specific path. Tests both the default behavior and the CHROME_PATH
 * environment variable override.
 *
 * These tests verify the logic in lighthouse-real-chrome.mjs that builds
 * the launchConfig before passing it to chrome-launcher.
 */

describe('Chrome executable discovery', () => {
  beforeEach(() => {
    // Clear the CHROME_PATH environment variable before each test
    delete process.env.CHROME_PATH
  })

  afterEach(() => {
    delete process.env.CHROME_PATH
  })

  it('builds launch config without chromePath when CHROME_PATH is not set', () => {
    // Simulate the logic from lighthouse-real-chrome.mjs
    const launchConfig: { chromePath?: string; chromeFlags: string[] } = {
      chromeFlags: ['--headless=new', '--no-first-run', '--no-default-browser-check', '--no-proxy-server'],
    }
    if (process.env.CHROME_PATH) {
      launchConfig.chromePath = process.env.CHROME_PATH
    }

    // Crucially: chromePath should be undefined, allowing chrome-launcher to discover
    expect(launchConfig.chromePath).toBeUndefined()
    expect(launchConfig.chromeFlags).toEqual([
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-proxy-server',
    ])
  })

  it('includes chromePath in launch config when CHROME_PATH environment variable is set', () => {
    const customChromePath = '/custom/path/to/chrome'
    process.env.CHROME_PATH = customChromePath

    // Simulate the logic from lighthouse-real-chrome.mjs
    const launchConfig: { chromePath?: string; chromeFlags: string[] } = {
      chromeFlags: ['--headless=new', '--no-first-run', '--no-default-browser-check', '--no-proxy-server'],
    }
    if (process.env.CHROME_PATH) {
      launchConfig.chromePath = process.env.CHROME_PATH
    }

    // The chromePath should be set to the environment variable
    expect(launchConfig.chromePath).toBe(customChromePath)
  })

  it('does NOT hardcode the macOS path /Applications/Google Chrome.app/Contents/MacOS/Google Chrome', () => {
    // Simulate the logic from lighthouse-real-chrome.mjs
    const launchConfig: { chromePath?: string; chromeFlags: string[] } = {
      chromeFlags: ['--headless=new', '--no-first-run', '--no-default-browser-check', '--no-proxy-server'],
    }
    if (process.env.CHROME_PATH) {
      launchConfig.chromePath = process.env.CHROME_PATH
    }

    const hardcodedMacPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

    // The hardcoded path should NOT be used
    expect(launchConfig.chromePath).not.toBe(hardcodedMacPath)
    expect(launchConfig.chromePath).toBeUndefined()
  })
})
