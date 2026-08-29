import { describe, expect, it } from "vitest";
import {
  calculateLotofacilMetricProfile,
  LOTOFACIL_BORDER_NUMBERS,
  LOTOFACIL_CENTER_NUMBERS,
  LOTOFACIL_DEFINITION,
} from "@boloes/lottery-lotofacil";

const allRuleIds = ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"] as const;

describe("Lotofácil canonical metrics", () => {
  it("uses the official 25/15 definition and a complete, disjoint 5x5 border", () => {
    const declared = new Set([...LOTOFACIL_BORDER_NUMBERS, ...LOTOFACIL_CENTER_NUMBERS]);

    expect(LOTOFACIL_DEFINITION).toMatchObject({
      id: "lotofacil",
      totalNumbers: 25,
      drawSize: 15,
      minBetSize: 15,
      maxBetSize: 20,
    });
    expect(LOTOFACIL_BORDER_NUMBERS).toHaveLength(16);
    expect(LOTOFACIL_CENTER_NUMBERS).toHaveLength(9);
    expect(declared.size).toBe(25);
  });

  it("calculates canonical counts, runs, amplitude, and axis occupancy", () => {
    const profile = calculateLotofacilMetricProfile(
      [15, 1, 14, 2, 13, 3, 12, 4, 11, 5, 10, 6, 9, 7, 8],
    );

    expect(profile.selectedNumbers).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(profile.metrics).toEqual({
      evenCount: 7,
      oddCount: 8,
      sum: 120,
      lowCount: 13,
      highCount: 2,
      borderCount: 9,
      centerCount: 6,
      consecutivePairCount: 14,
      maxConsecutiveRun: 15,
      sequenceCount: 1,
      amplitude: 14,
    });
    expect(profile.axisOccupancy.rows.counts).toEqual([5, 5, 5, 0, 0]);
    expect(profile.axisOccupancy.columns.counts).toEqual([3, 3, 3, 3, 3]);
  });

  it("counts pairs and maximal sequences without treating isolated numbers as sequences", () => {
    const profile = calculateLotofacilMetricProfile([
      1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16, 18, 20, 22, 24,
    ]);

    expect(profile.metrics.consecutivePairCount).toBe(5);
    expect(profile.metrics.maxConsecutiveRun).toBe(2);
    expect(profile.metrics.sequenceCount).toBe(5);
    expect(profile.metrics.amplitude).toBe(23);
  });

  it("applies every canonical E1–E8 threshold to simple 15-number bets", () => {
    const e1 = calculateLotofacilMetricProfile([
      1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 2, 4, 6, 8,
    ]);
    const e2 = calculateLotofacilMetricProfile(Array.from({ length: 15 }, (_, index) => index + 1));
    const e3 = calculateLotofacilMetricProfile([
      7, 8, 9, 12, 13, 14, 17, 18, 19, 1, 2, 3, 4, 5, 6,
    ]);
    const e4 = calculateLotofacilMetricProfile([
      1, 2, 3, 4, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
    ]);
    const e5e6 = calculateLotofacilMetricProfile([
      1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16, 18, 20, 22, 24,
    ]);
    const e7 = calculateLotofacilMetricProfile([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 15, 17, 19, 21,
    ]);
    const e8 = calculateLotofacilMetricProfile(Array.from({ length: 15 }, (_, index) => index + 1));

    expect(e1.extremeRules.E1.isExtreme).toBe(true);
    expect(e2.extremeRules.E2.isExtreme).toBe(true);
    expect(e3.extremeRules.E3.isExtreme).toBe(true);
    expect(e4.extremeRules.E4.isExtreme).toBe(true);
    expect(e5e6.extremeRules.E5.isExtreme).toBe(true);
    expect(e5e6.extremeRules.E6.isExtreme).toBe(true);
    expect(e7.extremeRules.E7.isExtreme).toBe(true);
    expect(e8.extremeRules.E8.isExtreme).toBe(true);
  });

  it("applies the upper extreme arms of E1–E7 without changing their boundaries", () => {
    const e1 = calculateLotofacilMetricProfile([
      2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 1, 3, 5, 7,
    ]);
    const e2 = calculateLotofacilMetricProfile(Array.from({ length: 15 }, (_, index) => index + 11));
    const e3 = calculateLotofacilMetricProfile([
      1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 7,
    ]);
    const e4 = calculateLotofacilMetricProfile([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16,
    ]);
    const e5 = calculateLotofacilMetricProfile([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17,
    ]);
    const e6 = calculateLotofacilMetricProfile([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16,
    ]);
    const e7 = calculateLotofacilMetricProfile([
      1, 2, 4, 5, 7, 8, 10, 11, 13, 14, 16, 17, 19, 20, 22,
    ]);

    expect(e1.metrics.evenCount).toBe(11);
    expect(e1.extremeRules.E1.isExtreme).toBe(true);
    expect(e2.metrics.sum).toBe(270);
    expect(e2.extremeRules.E2.isExtreme).toBe(true);
    expect(e3.metrics.borderCount).toBe(14);
    expect(e3.extremeRules.E3.isExtreme).toBe(true);
    expect(e4.metrics.lowCount).toBe(12);
    expect(e4.extremeRules.E4.isExtreme).toBe(true);
    expect(e5.metrics.consecutivePairCount).toBe(12);
    expect(e5.extremeRules.E5.isExtreme).toBe(true);
    expect(e6.metrics.maxConsecutiveRun).toBe(9);
    expect(e6.extremeRules.E6.isExtreme).toBe(true);
    expect(e7.metrics.sequenceCount).toBe(7);
    expect(e7.extremeRules.E7.isExtreme).toBe(true);
  });

  it("returns metrics but makes E1–E8 explicitly non-applicable for larger bets", () => {
    const profile = calculateLotofacilMetricProfile(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );

    expect(profile.metrics.sum).toBe(136);
    for (const ruleId of allRuleIds) {
      expect(profile.extremeRules[ruleId]).toEqual({
        applicable: false,
        isExtreme: null,
      });
    }
  });

  it.each([15, 16, 17, 18, 19, 20])(
    "returns the full profile for bet size %i",
    (betSize) => {
      const profile = calculateLotofacilMetricProfile(
        Array.from({ length: betSize }, (_, index) => index + 1),
      );

      expect(profile.selectedNumbers).toHaveLength(betSize);
      expect(profile.metrics.evenCount + profile.metrics.oddCount).toBe(betSize);
      expect(profile.metrics.lowCount + profile.metrics.highCount).toBe(betSize);
      expect(profile.metrics.borderCount + profile.metrics.centerCount).toBe(betSize);
    },
  );
});
