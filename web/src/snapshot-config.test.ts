import { describe, it, expect } from 'vitest'
import { SNAPSHOT_PATH_TEMPLATE } from '../playwright.config'

/**
 * Validates Playwright snapshot path template uses only supported tokens.
 *
 * Supported tokens per https://playwright.dev/docs/test-snapshots#snapshot-path-template:
 * - {arg}: Relative snapshot path without extension
 * - {ext}: Snapshot extension (with leading dot)
 * - {platform}: process.platform value
 * - {projectName}: Project name (filesystem-sanitized)
 * - {snapshotDir}: Project's snapshot directory (defaults to testDir)
 * - {testDir}: Project's test directory (absolute)
 * - {testFileDir}: Directories in relative path from testDir to test file
 * - {testFileBaseName}: Test file name without last extension
 * - {testFileName}: Test file name with extension
 * - {testFilePath}: Relative path from testDir to test file
 * - {testName}: File-system-sanitized test title
 *
 * UNSUPPORTED tokens that cause literal directory names:
 * - {dir}: Not recognized, becomes literal directory
 *
 * Each token can be preceded with a single character like {/projectName} to conditionally include that character.
 */
describe('snapshot-config', () => {
  const SUPPORTED_TOKENS = new Set([
    '{arg}',
    '{ext}',
    '{platform}',
    '{projectName}',
    '{snapshotDir}',
    '{testDir}',
    '{testFileDir}',
    '{testFileBaseName}',
    '{testFileName}',
    '{testFilePath}',
    '{testName}',
  ])

  const UNSUPPORTED_TOKENS = new Set(['{dir}'])

  it('does not use unsupported {dir} token', () => {
    expect(SNAPSHOT_PATH_TEMPLATE).not.toMatch(/{dir}/)
  })

  it('uses only supported Playwright snapshot path tokens', () => {
    // Extract all {token} patterns from template
    const tokenMatches = SNAPSHOT_PATH_TEMPLATE.matchAll(/{\/?[\w]+}/g)
    const foundTokens = Array.from(tokenMatches).map((m) => m[0])

    // Check each token is supported (tokens may have leading character like {/projectName})
    const unsupportedFound = foundTokens.filter(
      (token) => !SUPPORTED_TOKENS.has(token.replace(/^{\//, '{'))
    )

    expect(
      unsupportedFound,
      `Found unsupported tokens: ${unsupportedFound.join(', ')}`
    ).toHaveLength(0)
  })

  it('resolves to the existing snapshot baseline directory structure', () => {
    // Template should resolve to: testDir/testFileName-snapshots/...
    // For workspace-regression.spec.ts, this would be:
    //   {testDir} = './tests' (or absolute path)
    //   {testFileName} = 'workspace-regression.spec.ts'
    //   Result: ./tests/workspace-regression.spec.ts-snapshots/

    // Verify the template contains both testDir and testFileName
    expect(SNAPSHOT_PATH_TEMPLATE).toContain('{testDir}')
    expect(SNAPSHOT_PATH_TEMPLATE).toContain('{testFileName}')

    // Verify it preserves the -snapshots naming convention
    expect(SNAPSHOT_PATH_TEMPLATE).toContain('-snapshots')

    // Verify it includes the snapshot argument and extension placeholders
    expect(SNAPSHOT_PATH_TEMPLATE).toContain('{arg}')
    expect(SNAPSHOT_PATH_TEMPLATE).toContain('{ext}')
  })
})
