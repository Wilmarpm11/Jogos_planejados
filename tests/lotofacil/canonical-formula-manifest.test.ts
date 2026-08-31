import { describe, expect, it } from "vitest";
import {
  getLotofacilCanonicalFormulaManifest,
  LOTOFACIL_AXIS_AUXILIARY_POLICY,
  LOTOFACIL_CANONICAL_FORMULA_VERSION,
  LOTOFACIL_CENTRAL_CORE_LIMITS,
  LOTOFACIL_EXTREME_RULE_LIMITS,
  LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT,
} from "@boloes/lottery-lotofacil";

describe("Lotofácil canonical formula manifest", () => {
  it("serializes a deterministic reference to the canonical contracts", () => {
    const first = getLotofacilCanonicalFormulaManifest();
    const second = getLotofacilCanonicalFormulaManifest();

    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toMatchObject({
      formulaVersion: LOTOFACIL_CANONICAL_FORMULA_VERSION,
      lotteryDefinition: {
        id: "lotofacil",
        totalNumbers: 25,
        drawSize: 15,
        minBetSize: 15,
        maxBetSize: 20,
      },
      supportedBetSizes: [15, 16, 17, 18, 19, 20],
      metricEngine: { version: "1.0.0" },
      axisOccupancy: { expectedPerAxis: "bet_size / 5" },
      canonicalPortfolioIdentity: {
        canonicalizeFunction: "canonicalizePortfolio",
        hashAlgorithm: "sha256",
        hashVersion: "1",
      },
    });
  }, 30_000);

  it("uses the same limits as the classifier and keeps auxiliary signals separate", () => {
    const manifest = getLotofacilCanonicalFormulaManifest();

    expect(manifest.structuralClassification.extremeRuleLimits).not.toBe(
      LOTOFACIL_EXTREME_RULE_LIMITS,
    );
    expect(manifest.structuralClassification.extremeRuleLimits).toEqual(
      LOTOFACIL_EXTREME_RULE_LIMITS,
    );
    expect(manifest.structuralClassification.centralCoreLimits).not.toBe(
      LOTOFACIL_CENTRAL_CORE_LIMITS,
    );
    expect(manifest.structuralClassification.centralCoreLimits).toEqual(
      LOTOFACIL_CENTRAL_CORE_LIMITS,
    );
    expect(manifest.axisOccupancy.auxiliaryPolicy).not.toBe(LOTOFACIL_AXIS_AUXILIARY_POLICY);
    expect(manifest.axisOccupancy.auxiliaryPolicy).toEqual(LOTOFACIL_AXIS_AUXILIARY_POLICY);
    expect(manifest.structuralClassification).toMatchObject({
      applicableBetSize: 15,
      nonApplicableBetSizes: [16, 17, 18, 19, 20],
      extremeRuleLimits: {
        E1: { atMost: 4, atLeast: 11 },
        E8: { atMost: 18 },
        E9: { axis: "ROWS", deviationAtLeast: 8 },
        E10: { axis: "COLUMNS", deviationAtLeast: 8 },
      },
      centralCoreLimits: {
        evenCount: { min: 6, max: 9 },
        sum: { min: 176, max: 214 },
      },
    });
  }, 30_000);

  it("does not expose mutable references to internal classifier policies", () => {
    const manifest = getLotofacilCanonicalFormulaManifest();
    const exposedLimits = manifest.structuralClassification.extremeRuleLimits as unknown as {
      E1: { atMost: number };
    };
    exposedLimits.E1.atMost = 999;

    expect(LOTOFACIL_EXTREME_RULE_LIMITS.E1.atMost).toBe(4);
    expect(getLotofacilCanonicalFormulaManifest().structuralClassification.extremeRuleLimits.E1.atMost).toBe(4);
    expect(Object.isFrozen(LOTOFACIL_EXTREME_RULE_LIMITS)).toBe(true);
    expect(Object.isFrozen(LOTOFACIL_EXTREME_RULE_LIMITS.E1)).toBe(true);
    expect(Object.isFrozen(LOTOFACIL_AXIS_AUXILIARY_POLICY.priority)).toBe(true);
  }, 30_000);

  it("includes only the exact simple-bet mass and no historical or generation inputs", () => {
    const manifest = getLotofacilCanonicalFormulaManifest();

    expect(manifest.structuralMass).not.toBe(LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT);
    expect(manifest.structuralMass).toEqual(LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT);
    expect(manifest.structuralMass).toMatchObject({
      betSize: 15,
      totalOutcomes: 3_268_760,
    });
    expect(manifest.structuralMass.buckets).toHaveLength(5);
    expect(manifest).not.toHaveProperty("history");
    expect(manifest).not.toHaveProperty("strategy");
    expect(manifest).not.toHaveProperty("generation");
    expect(manifest).not.toHaveProperty("coverage");
    expect(manifest.exclusions).toEqual([
      "HISTORY",
      "RESULTS",
      "STRATEGY",
      "GENERATION",
      "COVERAGE",
      "PERSISTENCE",
    ]);
  }, 30_000);
});
