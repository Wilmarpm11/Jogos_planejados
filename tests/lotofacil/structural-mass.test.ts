import { describe, expect, it } from "vitest";
import { forEachCombination } from "@boloes/combinatorics";
import {
  calculateLotofacilStructuralMass,
  LOTOFACIL_STRUCTURAL_MASS_ALGORITHM_VERSION,
  LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT,
} from "@boloes/lottery-lotofacil";

describe("Lotofácil structural mass", () => {
  it("enumerates combinations exactly once in lexicographic order", () => {
    const combinations: number[][] = [];
    forEachCombination(4, 2, (combination) => combinations.push([...combination]));

    expect(combinations).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
  });

  it("rejects invalid combination dimensions", () => {
    expect(() => forEachCombination(-1, 0, () => undefined)).toThrow();
    expect(() => forEachCombination(4, 5, () => undefined)).toThrow();
  });

  it("conserves the complete simple-bet universe in mutually exclusive structural bands", () => {
    const mass = calculateLotofacilStructuralMass();

    expect(mass).toMatchObject({
      lotteryId: "lotofacil",
      algorithmVersion: LOTOFACIL_STRUCTURAL_MASS_ALGORITHM_VERSION,
      betSize: 15,
      totalOutcomes: 3_268_760,
    });
    expect(mass.buckets.map((bucket) => bucket.band)).toEqual([
      "ZERO_EXTREMES",
      "ONE_EXTREME",
      "TWO_EXTREMES",
      "THREE_EXTREMES",
      "FOUR_PLUS_EXTREMES",
    ]);
    expect(mass.buckets.map((bucket) => bucket.occurrences)).toEqual([
      2_955_715,
      252_024,
      41_775,
      12_286,
      6_960,
    ]);
    expect(mass.buckets.reduce((sum, bucket) => sum + bucket.occurrences, 0)).toBe(
      mass.totalOutcomes,
    );
  }, 30_000);

  it("uses exact serializable frequencies matching the published percentages", () => {
    const mass = calculateLotofacilStructuralMass();
    const percentages = mass.buckets.map(
      (bucket) => Number(((bucket.frequency.numerator / bucket.frequency.denominator) * 100).toFixed(4)),
    );

    expect(percentages).toEqual([90.4231, 7.7101, 1.278, 0.3759, 0.2129]);
    expect(JSON.parse(JSON.stringify(mass))).toEqual(mass);
    expect(mass).toEqual(LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT);
  });
});
