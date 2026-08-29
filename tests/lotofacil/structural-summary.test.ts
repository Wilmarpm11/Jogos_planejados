import { describe, expect, it } from "vitest";
import {
  calculateLotofacilMetricProfile,
  classifyLotofacilStructuralProfile,
  summarizeLotofacilStructuralProfile,
  type LotofacilExtremeRuleId,
  type LotofacilStructuralClassification,
} from "@boloes/lottery-lotofacil";

const ruleIds: readonly LotofacilExtremeRuleId[] = [
  "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10",
];

function classificationWithExtremeCount(count: number): LotofacilStructuralClassification {
  return {
    classifierVersion: "test",
    extremeRules: Object.fromEntries(
      ruleIds.map((ruleId, index) => [
        ruleId,
        { applicable: true, isExtreme: index < count },
      ]),
    ) as LotofacilStructuralClassification["extremeRules"],
    auxiliaryAxisSignals: {
      rows: { applicable: true, signal: "VERY_RARE" },
      columns: { applicable: true, signal: "ATTENTION" },
    },
  };
}

describe("Lotofácil structural summary", () => {
  it.each([
    [0, "ZERO_EXTREMES"],
    [1, "ONE_EXTREME"],
    [2, "TWO_EXTREMES"],
    [3, "THREE_EXTREMES"],
    [4, "FOUR_PLUS_EXTREMES"],
    [10, "FOUR_PLUS_EXTREMES"],
  ] as const)("maps %i extreme rules to %s", (count, expectedBand) => {
    const profile = calculateLotofacilMetricProfile(
      Array.from({ length: 15 }, (_, index) => index + 1),
    );
    const summary = summarizeLotofacilStructuralProfile(
      profile,
      classificationWithExtremeCount(count),
    );

    expect(summary.extremeCount).toBe(count);
    expect(summary.band).toBe(expectedBand);
  });

  it("recognizes the central core using only the five canonical criteria", () => {
    const profile = calculateLotofacilMetricProfile([
      1, 2, 3, 6, 7, 8, 11, 12, 13, 16, 17, 18, 21, 22, 23,
    ]);
    const classification = classifyLotofacilStructuralProfile(profile);
    const summary = summarizeLotofacilStructuralProfile(profile, classification);

    expect(summary.isCentralCore).toBe(true);
    expect(summary.centralCoreCriteria).toEqual({
      evenCount: true,
      sum: true,
      borderCount: true,
      lowCount: true,
      consecutivePairCount: true,
    });
  });

  it("does not let auxiliary occupancy signals affect extreme count or central core", () => {
    const profile = calculateLotofacilMetricProfile([
      1, 2, 3, 6, 7, 8, 11, 12, 13, 16, 17, 18, 21, 22, 23,
    ]);
    const withAuxiliarySignals = classificationWithExtremeCount(2);
    const summary = summarizeLotofacilStructuralProfile(profile, withAuxiliarySignals);

    expect(summary.extremeCount).toBe(2);
    expect(summary.band).toBe("TWO_EXTREMES");
    expect(summary.isCentralCore).toBe(true);
  });

  it("is explicitly not applicable for 16–20 number bets", () => {
    const profile = calculateLotofacilMetricProfile(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
    const classification = classifyLotofacilStructuralProfile(profile);

    expect(summarizeLotofacilStructuralProfile(profile, classification)).toEqual({
      applicable: false,
      extremeCount: null,
      band: null,
      isCentralCore: null,
      centralCoreCriteria: null,
    });
  });
});
