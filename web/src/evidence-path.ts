import { join, resolve } from 'node:path'

/**
 * Select evidence output directory for baseline tests.
 *
 * Selection priority:
 * 1. Explicit env override PLAYWRIGHT_EVIDENCE_DIR
 * 2. CI environment: workspace-local temp directory (no .omo overwrite)
 * 3. Local dev: workspace-local directory under playwright-report (gitignored)
 *
 * This ensures:
 * - CI isolation: each run writes to temp, never overwrites .omo archive
 * - Local dev: outputs go to a gitignored workspace folder
 * - Explicit override: respects user intent via env var
 */
export function getEvidenceDir(): string {
  // Priority 1: explicit env override (allows absolute or relative)
  if (process.env.PLAYWRIGHT_EVIDENCE_DIR) {
    return process.env.PLAYWRIGHT_EVIDENCE_DIR
  }

  // Priority 2: CI environment (detect via standard CI env vars)
  // Use workspace-local temp directory to isolate CI runs.
  // This prevents CI from writing to .omo/ which is preserved for local archival.
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS) {
    return resolve(process.cwd(), 'playwright-report', '.test-evidence-ci')
  }

  // Priority 3: Local dev (default gitignored path)
  return resolve(process.cwd(), 'playwright-report', '.test-evidence-local')
}
