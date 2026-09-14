import { describe, it, expect } from 'vitest';
import { evaluateBudget, LIGHTHOUSE_BUDGET, computeFloor } from './lighthouse';
import type { LighthouseAudit } from './lighthouse';

describe('Lighthouse Budget Policy', () => {
  describe('computeFloor', () => {
    it('subtracts variance tolerance from baseline', () => {
      const baseline = 75;
      const floor = computeFloor(baseline);
      expect(floor).toBe(70); // 75 - 5
    });

    it('handles edge case: baseline equals tolerance', () => {
      const floor = computeFloor(5);
      expect(floor).toBe(0);
    });
  });

  describe('evaluateBudget', () => {
    describe('passing audits', () => {
      it('passes when performance equals floor', () => {
        const audit: LighthouseAudit = {
          route: '/openings',
          metrics: {
            performance: 70, // floor for /openings is 75 - 5 = 70
            accessibility: 100,
            'best-practices': 100,
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        expect(result.pass).toBe(true);
        expect(result.failures).toBeUndefined();
      });

      it('passes when performance exceeds floor', () => {
        const audit: LighthouseAudit = {
          route: '/openings',
          metrics: {
            performance: 85,
            accessibility: 100,
            'best-practices': 100,
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        expect(result.pass).toBe(true);
      });

      it('passes when all strict categories are 100', () => {
        const audit: LighthouseAudit = {
          route: '/',
          metrics: {
            performance: 80,
            accessibility: 100,
            'best-practices': 100,
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        expect(result.pass).toBe(true);
      });
    });

    describe('failing audits - performance below floor', () => {
      it('fails when performance is below floor', () => {
        const audit: LighthouseAudit = {
          route: '/openings',
          metrics: {
            performance: 69, // below floor of 70
            accessibility: 100,
            'best-practices': 100,
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        expect(result.pass).toBe(false);
        expect(result.failures).toBeDefined();
        expect(result.failures!).toHaveLength(1);
        expect(result.failures![0].category).toBe('performance');
        expect(result.failures![0].measured).toBe(69);
        expect(result.failures![0].floor).toBe(70);
      });

      it('fails when performance is significantly below floor', () => {
        const audit: LighthouseAudit = {
          route: '/openings',
          metrics: {
            performance: 50,
            accessibility: 100,
            'best-practices': 100,
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        expect(result.pass).toBe(false);
        expect(result.failures!).toHaveLength(1);
        expect(result.failures![0].measured).toBe(50);
        expect(result.failures![0].floor).toBe(70);
      });
    });

    describe('failing audits - strict category regression', () => {
      it('fails when accessibility drops below 100', () => {
        const audit: LighthouseAudit = {
          route: '/openings',
          metrics: {
            performance: 75,
            accessibility: 99, // Strict category regression
            'best-practices': 100,
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        expect(result.pass).toBe(false);
        expect(result.failures).toBeDefined();
        expect(result.failures!).toHaveLength(1);
        expect(result.failures![0].category).toBe('accessibility');
        expect(result.failures![0].measured).toBe(99);
        expect(result.failures![0].floor).toBe(100);
      });

      it('fails when best-practices drops below 100', () => {
        const audit: LighthouseAudit = {
          route: '/',
          metrics: {
            performance: 80,
            accessibility: 100,
            'best-practices': 99, // Strict category regression
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        expect(result.pass).toBe(false);
        expect(result.failures!).toHaveLength(1);
        expect(result.failures![0].category).toBe('best-practices');
      });

      it('fails when seo drops below 100', () => {
        const audit: LighthouseAudit = {
          route: '/',
          metrics: {
            performance: 80,
            accessibility: 100,
            'best-practices': 100,
            seo: 99, // Strict category regression
          },
        };
        const result = evaluateBudget(audit);
        expect(result.pass).toBe(false);
        expect(result.failures!).toHaveLength(1);
        expect(result.failures![0].category).toBe('seo');
      });

      it('fails with multiple failures when multiple categories regress', () => {
        const audit: LighthouseAudit = {
          route: '/openings',
          metrics: {
            performance: 60, // Below floor of 70
            accessibility: 99, // Below strict floor of 100
            'best-practices': 100,
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        expect(result.pass).toBe(false);
        expect(result.failures!).toHaveLength(2);
        const categories = result.failures!.map((f) => f.category).sort();
        expect(categories).toEqual(['accessibility', 'performance']);
      });
    });

    describe('unknown routes', () => {
      it('fails with helpful message for undefined route', () => {
        const audit: LighthouseAudit = {
          route: '/unknown-page',
          metrics: {
            performance: 90,
            accessibility: 100,
            'best-practices': 100,
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        expect(result.pass).toBe(false);
        expect(result.failures![0].message).toContain(
          'No budget defined for route'
        );
      });
    });

    describe('message clarity', () => {
      it('includes floor, baseline, and tolerance in performance failure message', () => {
        const audit: LighthouseAudit = {
          route: '/openings',
          metrics: {
            performance: 68,
            accessibility: 100,
            'best-practices': 100,
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        const message = result.failures![0].message;
        expect(message).toContain('68'); // measured
        expect(message).toContain('70'); // floor
        expect(message).toContain('75'); // baseline
        expect(message).toContain('5'); // tolerance
      });

      it('includes measured and floor for strict category failure', () => {
        const audit: LighthouseAudit = {
          route: '/',
          metrics: {
            performance: 80,
            accessibility: 98,
            'best-practices': 100,
            seo: 100,
          },
        };
        const result = evaluateBudget(audit);
        const message = result.failures![0].message;
        expect(message).toContain('accessibility');
        expect(message).toContain('98'); // measured
        expect(message).toContain('100'); // floor
      });
    });
  });

  describe('policy constants', () => {
    it('defines variance tolerance', () => {
      expect(LIGHTHOUSE_BUDGET.VARIANCE_TOLERANCE_POINTS).toBe(5);
    });

    it('includes approved baselines for all routes', () => {
      expect(LIGHTHOUSE_BUDGET.APPROVED_BASELINES['/']).toBeDefined();
      expect(LIGHTHOUSE_BUDGET.APPROVED_BASELINES['/openings']).toBeDefined();
    });

    it('ensures /openings desktop baseline supports floor of 70', () => {
      const baseline = LIGHTHOUSE_BUDGET.APPROVED_BASELINES['/openings'];
      const floor = computeFloor(baseline.performance);
      expect(floor).toBe(70);
    });

    it('ensures strict categories are in the constant list', () => {
      const strictCategories = LIGHTHOUSE_BUDGET.STRICT_CATEGORIES;
      expect(strictCategories).toContain('accessibility');
      expect(strictCategories).toContain('best-practices');
      expect(strictCategories).toContain('seo');
      expect(strictCategories).not.toContain('performance');
    });
  });
});
