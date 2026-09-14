/**
 * Lighthouse budget policy and evaluation logic.
 *
 * ## Policy
 *
 * This module defines measurable Lighthouse score floors for critical routes,
 * tied to approved measured baselines. CI variance tolerance accounts for
 * noisy shared GitHub runner environments.
 *
 * - **Approved baseline**: measured local median from a production build
 * - **CI variance tolerance**: +5 points (captures GitHub runner noise)
 * - **Floor**: approved baseline - tolerance
 *
 * Example: `/openings` desktop measured at 75 → floor 70 (75 - 5)
 *
 * ## Quality categories (always 100)
 *
 * Accessibility, best-practices, SEO must remain at 100.
 * Performance may regress within budget; other categories must not.
 *
 * ## Rationale
 *
 * - Shared CI runners exhibit variance in measured Lighthouse scores (~5-10 pts)
 * - Local testing may measure 75, CI may measure 70-80 on identical code
 * - Encoding only 3 points tolerance (75 → 72) causes flaky CI
 * - 5 points tolerance is conservative and documented, not magic
 */

/** Lighthouse audit result for a single route */
export interface LighthouseAudit {
  route: string;
  metrics: {
    performance: number;
    accessibility: number;
    'best-practices': number;
    seo: number;
  };
}

/**
 * Budget policy: approved baselines and CI variance tolerance.
 *
 * All values are local median measurements on production builds.
 * CI floors are baseline - VARIANCE_TOLERANCE_POINTS.
 */
export const LIGHTHOUSE_BUDGET = {
  /** CI variance tolerance in points, applied to all baselines */
  VARIANCE_TOLERANCE_POINTS: 5,

  /**
   * Approved measured baselines (local production median).
   * Used to compute CI floors.
   */
  APPROVED_BASELINES: {
    '/': {
      performance: 85,
      accessibility: 100,
      'best-practices': 100,
      seo: 100,
    },
    '/openings': {
      performance: 75,
      accessibility: 100,
      'best-practices': 100,
      seo: 100,
    },
  } as const,

  /**
   * Quality categories that must always remain at 100.
   * Performance may regress within budget; other categories must not.
   */
  STRICT_CATEGORIES: ['accessibility', 'best-practices', 'seo'] as const,
} as const;

/**
 * Compute the CI floor (minimum acceptable score) for a given baseline and category.
 *
 * @param baseline - Approved local median measurement
 * @returns CI floor (baseline - variance tolerance)
 */
export function computeFloor(baseline: number): number {
  return baseline - LIGHTHOUSE_BUDGET.VARIANCE_TOLERANCE_POINTS;
}

/**
 * Evaluate a Lighthouse audit against the budget policy.
 *
 * Returns { pass: true } if all categories meet their respective floors.
 * Returns { pass: false, failures } with detailed failure information if any floor is missed.
 *
 * @param audit - Lighthouse audit result (route + metrics)
 * @returns { pass: boolean; failures?: FailureDetail[] }
 */
export function evaluateBudget(audit: LighthouseAudit): {
  pass: boolean;
  failures?: FailureDetail[];
} {
  const failures: FailureDetail[] = [];
  const baseline =
    LIGHTHOUSE_BUDGET.APPROVED_BASELINES[
      audit.route as keyof typeof LIGHTHOUSE_BUDGET.APPROVED_BASELINES
    ];

  if (!baseline) {
    return {
      pass: false,
      failures: [
        {
          route: audit.route,
          category: 'unknown',
          measured: 0,
          floor: 0,
          message: `No budget defined for route: ${audit.route}`,
        },
      ],
    };
  }

  // Check each category against its floor
  for (const [category, measured] of Object.entries(audit.metrics)) {
    const baselineScore = baseline[category as keyof typeof baseline];
    const floor = computeFloor(baselineScore);

    // Strict categories must stay at 100
    if (
      LIGHTHOUSE_BUDGET.STRICT_CATEGORIES.includes(
        category as (typeof LIGHTHOUSE_BUDGET.STRICT_CATEGORIES)[number]
      )
    ) {
      if (measured < 100) {
        failures.push({
          route: audit.route,
          category,
          measured,
          floor: 100,
          message: `${category} must stay at 100, got ${measured}`,
        });
      }
    } else {
      // Performance can regress within budget
      if (measured < floor) {
        failures.push({
          route: audit.route,
          category,
          measured,
          floor,
          message: `${category} scored ${measured}, floor is ${floor} (baseline ${baselineScore} - tolerance ${LIGHTHOUSE_BUDGET.VARIANCE_TOLERANCE_POINTS})`,
        });
      }
    }
  }

  return failures.length === 0 ? { pass: true } : { pass: false, failures };
}

export interface FailureDetail {
  route: string;
  category: string;
  measured: number;
  floor: number;
  message: string;
}
