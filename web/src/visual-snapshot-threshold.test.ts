import { describe, it, expect } from 'vitest'
import { visualSnapshotThreshold } from './visual-snapshot-threshold'

describe('visualSnapshotThreshold', () => {
  it('returns 0.01 for darwin (macOS)', () => {
    expect(visualSnapshotThreshold('darwin')).toBe(0.01)
  })

  it('returns 0.04 for linux (CI renderer variance upper bound)', () => {
    expect(visualSnapshotThreshold('linux')).toBe(0.04)
  })

  it('returns 0.01 for win32 (Windows, conservative)', () => {
    expect(visualSnapshotThreshold('win32')).toBe(0.01)
  })

  it('defaults to 0.01 for unknown platforms', () => {
    expect(visualSnapshotThreshold('freebsd')).toBe(0.01)
  })

  it('uses process.platform when not specified', () => {
    // When called without argument, uses process.platform
    const result = visualSnapshotThreshold()
    expect([0.01, 0.04]).toContain(result)
  })
})
