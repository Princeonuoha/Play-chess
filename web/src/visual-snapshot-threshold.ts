/**
 * Platform-aware visual snapshot threshold policy
 *
 * CI platform rasterization variance:
 * - Darwin (macOS): strict 0.01 (reviewed baseline)
 * - Linux: 0.04 (observed max 3% renderer variance, 4% upper bound with margin)
 * - Windows: strict 0.01 (fallback, no observed variance data)
 *
 * Policy: Retain strict local review while accommodating measured CI renderer differences.
 * Do not exceed 4% on any platform; do not regenerate snapshots blindly.
 */

export function visualSnapshotThreshold(platform: string = process.platform): number {
  const threshold: Record<string, number> = {
    darwin: 0.01, // Reviewed macOS baselines
    linux: 0.04,  // Max observed ~3%, 4% upper bound with margin
    win32: 0.01,  // Conservative, no observed variance
  }

  return threshold[platform] ?? 0.01
}
