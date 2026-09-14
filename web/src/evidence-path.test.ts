import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getEvidenceDir } from './evidence-path'

describe('getEvidenceDir', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear CI-related env vars
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS
    delete process.env.PLAYWRIGHT_EVIDENCE_DIR
  })

  afterEach(() => {
    // Restore original env
    Object.assign(process.env, originalEnv)
  })

  it('selects explicit override when PLAYWRIGHT_EVIDENCE_DIR is set', () => {
    process.env.PLAYWRIGHT_EVIDENCE_DIR = '/custom/evidence/path'
    expect(getEvidenceDir()).toBe('/custom/evidence/path')
  })

  it('selects CI directory when CI=true', () => {
    process.env.CI = 'true'
    const result = getEvidenceDir()
    expect(result).toContain('.test-evidence-ci')
    expect(result).toContain('playwright-report')
  })

  it('selects CI directory when GITHUB_ACTIONS is set', () => {
    process.env.GITHUB_ACTIONS = 'true'
    const result = getEvidenceDir()
    expect(result).toContain('.test-evidence-ci')
    expect(result).toContain('playwright-report')
  })

  it('selects local directory by default (neither CI nor override)', () => {
    const result = getEvidenceDir()
    expect(result).toContain('.test-evidence-local')
    expect(result).toContain('playwright-report')
  })

  it('never defaults to .omo/ path', () => {
    // Test with CI
    process.env.CI = 'true'
    expect(getEvidenceDir()).not.toContain('.omo')

    // Test with local default
    delete process.env.CI
    expect(getEvidenceDir()).not.toContain('.omo')
  })
})
