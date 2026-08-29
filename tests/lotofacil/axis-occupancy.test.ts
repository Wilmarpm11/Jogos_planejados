import { describe, expect, it } from "vitest";
import {
  DEFAULT_RARITY_THRESHOLDS,
  rarityThresholdsSchema,
  type TheoreticalAxisDistribution,
} from "@boloes/lottery-contracts";
import {
  assessLotofacilAxisRarity,
  axisMetricValue,
  calculateLotofacilAxisOccupancy,
  calculateLotofacilTheoreticalAxisProfile,
  LOTOFACIL_SUPPORTED_BET_SIZES,
  type LotofacilBetSize,
} from "@boloes/lottery-lotofacil";

const expectedUniverses: Readonly<Record<LotofacilBetSize, number>> = {
  15: 3_268_760,
  16: 2_042_975,
  17: 1_081_575,
  18: 480_700,
  19: 177_100,
  20: 53_130,
};

function findDistribution(
  distributions: readonly TheoreticalAxisDistribution[],
  axis: "ROWS" | "COLUMNS",
  metric: "AXES_WITH_0" | "AXES_WITH_1" | "DEVIATION_NORMALIZED",
): TheoreticalAxisDistribution {
  const distribution = distributions.find(
    (candidate) => candidate.axis === axis && candidate.metric === metric,
  );
  if (!distribution) {
    throw new Error("Missing theoretical distribution.");
  }
  return distribution;
}

describe("Lotofácil axis occupancy", () => {
  it("calculates complete row and column occupancy with exact normalized deviations", () => {
    const profile = calculateLotofacilAxisOccupancy([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);

    expect(profile.rows.counts).toEqual([5, 5, 5, 0, 0]);
    expect(profile.columns.counts).toEqual([3, 3, 3, 3, 3]);
    expect(profile.rows.axesWith).toEqual({ 0: 2, 1: 0, 2: 0, 3: 0, 4: 0, 5: 3 });
    expect(profile.columns.axesWith).toEqual({
      0: 0,
      1: 0,
      2: 0,
      3: 5,
      4: 0,
      5: 0,
    });
    expect(profile.rows.expectedPerAxis).toEqual({ numerator: 3, denominator: 1 });
    expect(profile.rows.deviation).toEqual({ numerator: 12, denominator: 1 });
    expect(profile.rows.deviationNormalized).toEqual({ numerator: 4, denominator: 5 });
    expect(profile.columns.deviationNormalized).toEqual({ numerator: 0, denominator: 1 });
  });

  it.each(LOTOFACIL_SUPPORTED_BET_SIZES)(
    "uses bet_size / 5 and conserves all marked numbers for bet size %i",
    (betSize) => {
      const profile = calculateLotofacilAxisOccupancy(
        Array.from({ length: betSize }, (_, index) => index + 1),
      );

      expect(profile.rows.counts.reduce((sum, count) => sum + count, 0)).toBe(betSize);
      expect(profile.columns.counts.reduce((sum, count) => sum + count, 0)).toBe(betSize);
      expect(
        profile.rows.expectedPerAxis.numerator * 5,
      ).toBe(profile.rows.expectedPerAxis.denominator * betSize);
      expect(
        profile.columns.expectedPerAxis.numerator * 5,
      ).toBe(profile.columns.expectedPerAxis.denominator * betSize);
    },
  );

  it("rejects invalid sizes, duplicate numbers, and numbers outside the 5x5 grid", () => {
    expect(() => calculateLotofacilAxisOccupancy(Array.from({ length: 14 }, (_, index) => index + 1))).toThrow();
    expect(() => calculateLotofacilAxisOccupancy([1, 1, ...Array.from({ length: 13 }, (_, index) => index + 2)])).toThrow();
    expect(() => calculateLotofacilAxisOccupancy([...Array.from({ length: 14 }, (_, index) => index + 1), 26])).toThrow();
  });

  it("enumerates exact, independent theoretical distributions per supported bet size", () => {
    for (const betSize of LOTOFACIL_SUPPORTED_BET_SIZES) {
      const profile = calculateLotofacilTheoreticalAxisProfile(betSize);
      expect(profile.totalOutcomes).toBe(expectedUniverses[betSize]);
      expect(profile.distributions).toHaveLength(6);

      for (const distribution of profile.distributions) {
        expect(distribution.betSize).toBe(betSize);
        expect(distribution.totalOutcomes).toBe(expectedUniverses[betSize]);
        expect(distribution.tail).toBe("GREATER_THAN_OR_EQUAL");
        expect(distribution.buckets.reduce((sum, bucket) => sum + bucket.occurrences, 0)).toBe(
          expectedUniverses[betSize],
        );
      }

      expect(findDistribution(profile.distributions, "ROWS", "AXES_WITH_0")).not.toBe(
        findDistribution(profile.distributions, "COLUMNS", "AXES_WITH_0"),
      );
    }
  }, 60_000);

  it("uses an explicit upper tail for rarity and never turns a singleton into a fixed rejection rule", () => {
    const occupancy = calculateLotofacilAxisOccupancy([
      1, 2, 3, 4, 6, 7, 8, 11, 12, 13, 16, 17, 18, 21, 22,
    ]);
    const theoretical = calculateLotofacilTheoreticalAxisProfile(15);
    const singletonDistribution = findDistribution(
      theoretical.distributions,
      "COLUMNS",
      "AXES_WITH_1",
    );
    const assessment = assessLotofacilAxisRarity(
      singletonDistribution,
      axisMetricValue(occupancy.columns, "AXES_WITH_1"),
    );

    expect(occupancy.columns.axesWith[1]).toBe(1);
    expect(assessment.tail).toBe("GREATER_THAN_OR_EQUAL");
    expect(assessment.tailOccurrences).toBeGreaterThan(0);
    expect(assessment.totalOutcomes).toBe(expectedUniverses[15]);
    expect(["NORMAL", "ATTENTION", "RARE", "VERY_RARE"]).toContain(assessment.rarityClass);

    const deviationAssessment = assessLotofacilAxisRarity(
      findDistribution(theoretical.distributions, "ROWS", "DEVIATION_NORMALIZED"),
      axisMetricValue(occupancy.rows, "DEVIATION_NORMALIZED"),
    );
    expect(deviationAssessment.tailOccurrences).toBeGreaterThan(0);
  });

  it("keeps default rarity cutoffs configurable and rejects inverted thresholds", () => {
    expect(rarityThresholdsSchema.parse(DEFAULT_RARITY_THRESHOLDS)).toEqual(
      DEFAULT_RARITY_THRESHOLDS,
    );
    expect(() =>
      rarityThresholdsSchema.parse({
        normalMin: { numerator: 1, denominator: 100 },
        attentionMin: { numerator: 2, denominator: 100 },
        rareMin: { numerator: 5, denominator: 1000 },
      }),
    ).toThrow();
  });
});
