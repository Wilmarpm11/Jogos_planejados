import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  CombinationIterationCancelledError,
  forEachCombination,
  forEachCombinationAsync,
} from "@boloes/combinatorics";
import {
  LOTOFACIL_STRUCTURAL_MAX_COMBINATION_VISITS,
  StructuralArtifactHashMismatchError,
  StructuralPolicyBuildCancelledError,
  canonicalExactFractionSchema,
  lotofacilStructuralMassArtifactSchema,
  lotofacilStructuralPolicyErrorCodeSchema,
  lotofacilStructuralPolicySchema,
  lotofacilStructuralPolicyProgressSchema,
  lotofacilStructuralPolicySetSchema,
  type LotofacilStructuralPolicySet,
} from "@boloes/lottery-contracts";
import {
  LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT,
  buildLotofacilStructuralPolicySet,
  calculateLotofacilMetricProfile,
  calculateLotofacilStructuralArtifactHash,
  classifyLotofacilStructuralProfile,
  classifyLotofacilStructuralProfileV2,
  createLotofacilStructuralClassifierV2,
  getLotofacilCanonicalFormulaManifest,
  getLotofacilCanonicalFormulaManifestV1_1,
  serializeLotofacilStructuralCanonicalJson,
  summarizeLotofacilStructuralProfile,
  summarizeLotofacilStructuralProfileV2,
  verifyLotofacilStructuralPolicySet,
} from "@boloes/lottery-lotofacil";
import {
  deriveOraclePolicies,
  enumerateOracleMass,
  selectOracleTail,
  type OraclePolicy,
} from "../oracles/lotofacil-structural-16-20-oracle.js";

const fixturePath = resolve(
  "tests/fixtures/lotofacil/structural-15-20/policy-set-1.0.0.json",
);
const fixtureBytes = readFileSync(fixturePath);
const fixture = lotofacilStructuralPolicySetSchema.parse(JSON.parse(fixtureBytes.toString("utf8")));
let built: LotofacilStructuralPolicySet;
let progress: Array<Record<string, unknown>>;

function expectStructuralPolicySchemaRejection(input: unknown): void {
  const result = lotofacilStructuralPolicySchema.safeParse(input);
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.name).toBe("ZodError");
  expect(() => lotofacilStructuralPolicySchema.parse(input)).toThrowError(
    expect.objectContaining({ name: "ZodError" }),
  );
}

beforeAll(async () => {
  progress = [];
  built = await buildLotofacilStructuralPolicySet({
    onProgress: (event) => progress.push(event),
  });
}, 90_000);

describe("Lotofacil structural policies and masses 15-20", () => {
  it("matches the complete frozen fixture and exact two-pass visit ceiling", () => {
    expect(fixtureBytes.byteLength).toBe(205_425);
    expect(createHash("sha256").update(fixtureBytes).digest("hex"))
      .toBe("f64fd32bb00953a9b7dcff2d0b3159c8816b06fb17b6f7c9624c851fb9b710c1");
    expect(built).toEqual(fixture);
    expect(built.combinationVisits).toBe(LOTOFACIL_STRUCTURAL_MAX_COMBINATION_VISITS);
    expect(built.policies.map((policy) => policy.betSize)).toEqual([15, 16, 17, 18, 19, 20]);
    expect(built.masses.map((mass) => mass.universeSize)).toEqual([
      3_268_760, 2_042_975, 1_081_575, 480_700, 177_100, 53_130,
    ]);
  });

  it("keeps 15 v1 immutable while v2 applies the frozen 15 policy without recalibration", () => {
    const profile = calculateLotofacilMetricProfile(
      Array.from({ length: 15 }, (_, index) => index + 1),
    );
    const v1 = classifyLotofacilStructuralProfile(profile);
    const v2 = classifyLotofacilStructuralProfileV2(profile, built.policies[0]);
    expect(v2.extremeRules).toEqual(v1.extremeRules);
    expect(summarizeLotofacilStructuralProfileV2(profile, v2, built.policies[0])).toMatchObject(
      summarizeLotofacilStructuralProfile(profile, v1),
    );
    expect(built.policies[0]!.rules.map((rule) => rule.tails.map((tail) => tail.limit))).toEqual([
      [4, 11], [149, 241], [6, 14], [4, 12], [5, 12], [2, 9], [1, 7], [18],
      [{ numerator: 8, denominator: 15 }], [{ numerator: 8, denominator: 15 }],
    ]);
    expect(built.masses[0]!.bandMasses.map((cell) => cell.count)).toEqual(
      LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT.buckets.map((bucket) => bucket.occurrences),
    );
  });

  it("reconciles v1 and frozen v2 exhaustively across the complete U15 universe", () => {
    const classifier = createLotofacilStructuralClassifierV2(built.policies[0]);
    let reconciled = 0;
    let firstMismatch: string | undefined;
    forEachCombination(25, 15, (indexes) => {
      const profile = calculateLotofacilMetricProfile(indexes.map((index) => index + 1));
      const v1 = classifyLotofacilStructuralProfile(profile);
      const v2 = classifier.classify(profile);
      if (!firstMismatch) {
        for (const ruleId of ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10"] as const) {
          const legacyFlag = v1.extremeRules[ruleId];
          const currentFlag = v2.extremeRules[ruleId];
          if (legacyFlag.applicable !== currentFlag.applicable || legacyFlag.isExtreme !== currentFlag.isExtreme) {
            firstMismatch = `${profile.selectedNumbers.join(",")}:${ruleId}`;
            break;
          }
        }
        const legacySummary = summarizeLotofacilStructuralProfile(profile, v1);
        const currentSummary = classifier.summarize(profile, v2);
        if (!firstMismatch && (
          legacySummary.applicable !== currentSummary.applicable ||
          legacySummary.extremeCount !== currentSummary.extremeCount ||
          legacySummary.band !== currentSummary.band ||
          legacySummary.isCentralCore !== currentSummary.isCentralCore ||
          Object.keys(legacySummary.centralCoreCriteria ?? {}).some((key) =>
            legacySummary.centralCoreCriteria?.[key as keyof typeof legacySummary.centralCoreCriteria] !==
            currentSummary.centralCoreCriteria?.[key as keyof typeof currentSummary.centralCoreCriteria])
        )) firstMismatch = `${profile.selectedNumbers.join(",")}:summary`;
      }
      reconciled += 1;
    });
    expect(firstMismatch).toBeUndefined();
    expect(reconciled).toBe(3_268_760);
  }, 90_000);

  it.each([16, 17, 18, 19, 20] as const)(
    "applies all E1-E10 and the central core through policy v2 for betSize %i",
    (betSize) => {
      const profile = calculateLotofacilMetricProfile(
        Array.from({ length: betSize }, (_, index) => index + 1),
      );
      const policy = built.policies.find((candidate) => candidate.betSize === betSize)!;
      const legacy = classifyLotofacilStructuralProfile(profile);
      const v2 = classifyLotofacilStructuralProfileV2(profile, policy);
      expect(Object.values(legacy.extremeRules).every((rule) => !rule.applicable)).toBe(true);
      expect(Object.values(v2.extremeRules).every((rule) => rule.applicable)).toBe(true);
      expect(v2.auxiliaryAxisSignals).toEqual({
        rows: { applicable: false, signal: null },
        columns: { applicable: false, signal: null },
      });
      expect(summarizeLotofacilStructuralProfileV2(profile, v2, policy)).toMatchObject({
        applicable: true,
        extremeCount: expect.any(Number),
        band: expect.any(String),
        isCentralCore: expect.any(Boolean),
      });
    },
  );

  it("keeps AXES_WITH_0/1 auditable for every size but operational auxiliary policy only for 15", () => {
    for (const policy of built.policies) {
      expect(policy.axisDistributions.map((distribution) =>
        `${distribution.axis}:${distribution.metric}`)).toEqual([
        "ROWS:AXES_WITH_0", "ROWS:AXES_WITH_1", "ROWS:DEVIATION_NORMALIZED",
        "COLUMNS:AXES_WITH_0", "COLUMNS:AXES_WITH_1", "COLUMNS:DEVIATION_NORMALIZED",
      ]);
      expect(policy.auxiliaryOperationalPolicyApplicable).toBe(policy.betSize === 15);
    }
  });

  it("reconciles all exact masses, counters, bands, core criteria, and crossings", () => {
    for (const mass of built.masses) {
      expect(mass.extremeCountMasses.reduce((sum, cell) => sum + cell.count, 0)).toBe(mass.universeSize);
      expect(mass.bandMasses.reduce((sum, cell) => sum + cell.count, 0)).toBe(mass.universeSize);
      expect(mass.bandMasses[4]!.count).toBe(
        mass.extremeCountMasses.slice(4).reduce((sum, cell) => sum + cell.count, 0),
      );
      expect(mass.bandByCentralCoreMasses.reduce((sum, cell) => sum + cell.count, 0)).toBe(mass.universeSize);
      expect(mass.bandByCentralCoreMasses.filter((cell) => cell.isCentralCore)
        .reduce((sum, cell) => sum + cell.count, 0)).toBe(mass.centralCoreMass.count);
      for (const cell of [
        ...mass.ruleMasses,
        ...mass.extremeCountMasses,
        ...mass.bandMasses,
        ...mass.centralCoreCriterionMasses,
        mass.centralCoreMass,
        ...mass.bandByCentralCoreMasses,
      ]) {
        expect(BigInt(cell.frequency.numerator) * BigInt(mass.universeSize)).toBe(
          BigInt(cell.count) * BigInt(cell.frequency.denominator),
        );
      }
    }
  });

  it("matches an independent full-enumeration oracle with no production imports", () => {
    built.policies.forEach((policy, index) => {
      const oracle = enumerateOracleMass(policy as OraclePolicy);
      const mass = built.masses[index]!;
      expect(oracle.totalOutcomes).toBe(mass.universeSize);
      expect(oracle.ruleCounts).toEqual(mass.ruleMasses.map((cell) => cell.count));
      expect(oracle.extremeCounts).toEqual(mass.extremeCountMasses.map((cell) => cell.count));
      expect(Object.values(oracle.bandCounts)).toEqual(mass.bandMasses.map((cell) => cell.count));
      expect(oracle.coreCriterionCounts).toEqual(mass.centralCoreCriterionMasses.map((cell) => cell.count));
      expect(oracle.centralCoreCount).toBe(mass.centralCoreMass.count);
      expect(Object.values(oracle.bandCoreCounts)).toEqual(mass.bandByCentralCoreMasses.map((cell) => cell.count));
    });
  }, 90_000);

  it("derives every policy limit and exact tail count with an independent first-pass oracle", () => {
    const policies = deriveOraclePolicies();
    expect(policies.map((policy) => policy.betSize)).toEqual([15, 16, 17, 18, 19, 20]);
    expect(policies.reduce((sum, policy) => sum + policy.enumerationVisits, 0)).toBe(7_104_240);
    policies.forEach((oracle, policyIndex) => {
      const actual = built.policies[policyIndex]!;
      const classifier = createLotofacilStructuralClassifierV2(actual);
      oracle.rules.forEach((rule, ruleIndex) => {
        expect(rule.metric).toBe(actual.rules[ruleIndex]!.metric);
        expect(rule.tails.map(({ limit, count, distanceNumerator }) => ({
          limit, count, distanceNumerator,
        }))).toEqual(actual.rules[ruleIndex]!.tails.map((tail) => ({
          limit: tail.limit,
          count: tail.count,
          distanceNumerator: tail.distanceNumerator,
        })));
        rule.tails.forEach((tail, tailIndex) => {
          const atLimit = classifier.classify(calculateLotofacilMetricProfile(tail.atLimit));
          expect(atLimit.extremeRules[actual.rules[ruleIndex]!.ruleId].isExtreme).toBe(true);
          const nonExtremeAdjacent = actual.rules[ruleIndex]!.tails[tailIndex]!.tail === "LOWER"
            ? tail.above
            : tail.below;
          if (nonExtremeAdjacent) {
            const adjacent = classifier.classify(calculateLotofacilMetricProfile(nonExtremeAdjacent));
            expect(adjacent.extremeRules[actual.rules[ruleIndex]!.ruleId].isExtreme).toBe(false);
          }
        });
      });
      oracle.centralCore.forEach((criterion, criterionIndex) => {
        const actualCriterion = actual.centralCore[criterionIndex]!;
        expect({
          metric: criterion.metric,
          minInclusive: criterion.minInclusive,
          maxInclusive: criterion.maxInclusive,
          lowerTail: {
            limit: criterion.lowerTail.limit,
            count: criterion.lowerTail.count,
            distanceNumerator: criterion.lowerTail.distanceNumerator,
          },
          upperTail: {
            limit: criterion.upperTail.limit,
            count: criterion.upperTail.count,
            distanceNumerator: criterion.upperTail.distanceNumerator,
          },
        }).toEqual({
          metric: actualCriterion.metric,
          minInclusive: actualCriterion.minInclusive,
          maxInclusive: actualCriterion.maxInclusive,
          lowerTail: {
            limit: actualCriterion.lowerTail.limit,
            count: actualCriterion.lowerTail.count,
            distanceNumerator: actualCriterion.lowerTail.distanceNumerator,
          },
          upperTail: {
            limit: actualCriterion.upperTail.limit,
            count: actualCriterion.upperTail.count,
            distanceNumerator: actualCriterion.upperTail.distanceNumerator,
          },
        });
        const criterionKey = [
          "evenCount", "sum", "borderCount", "lowCount", "consecutivePairCount",
        ][criterionIndex] as "evenCount" | "sum" | "borderCount" | "lowCount" | "consecutivePairCount";
        for (const tail of [criterion.lowerTail, criterion.upperTail]) {
          const profile = calculateLotofacilMetricProfile(tail.atLimit);
          const classification = classifier.classify(profile);
          expect(classifier.summarize(profile, classification).centralCoreCriteria?.[criterionKey]).toBe(true);
        }
        if (criterion.lowerTail.below) {
          const profile = calculateLotofacilMetricProfile(criterion.lowerTail.below);
          expect(classifier.summarize(profile, classifier.classify(profile))
            .centralCoreCriteria?.[criterionKey]).toBe(false);
        }
        if (criterion.upperTail.above) {
          const profile = calculateLotofacilMetricProfile(criterion.upperTail.above);
          expect(classifier.summarize(profile, classifier.classify(profile))
            .centralCoreCriteria?.[criterionKey]).toBe(false);
        }
      });
    });
    expect(built.policies[1]!.centralCore[2]).toMatchObject({
      metric: "BORDER_COUNT",
      minInclusive: 9,
      lowerTail: { count: 127_270, distanceNumerator: 189_310_235_400 },
    });
  }, 90_000);

  it("applies conservative count and residual-limit tie breaks in the independent oracle", () => {
    const countTie = new Map([[1, 2], [2, 3], [3, 5]]);
    expect(selectOracleTail(countTie, 10, 7, 20, "LESS_THAN_OR_EQUAL", false)).toBe(1);
    const residualTie = new Map([[1, 2], [2, 0], [3, 8]]);
    expect(selectOracleTail(residualTie, 10, 2, 10, "LESS_THAN_OR_EQUAL", false)).toBe(1);
    expect(selectOracleTail(residualTie, 10, 2, 10, "LESS_THAN_OR_EQUAL", true)).toBe(2);
  });

  it("implements the two normative canonical-byte fixtures exactly", () => {
    const cases = [
      {
        value: { fraction: { denominator: 2, numerator: 1 } },
        bytes: 44,
        hash: "7569c6b59b86ed222bbe8829d54ac1db9f9d3c684f92c422169c34c60525e262",
      },
      {
        value: { a: [null, "linha\n\"\\", { frequency: { denominator: 2, numerator: 1 } }], label: "Lotofácil", z: 0 },
        bytes: 99,
        hash: "dab0cbac6cb7e2ae4f7ac477976fb942626cbcf2b523f2ecb1de4739f064e012",
      },
    ];
    for (const item of cases) {
      const canonical = serializeLotofacilStructuralCanonicalJson(item.value);
      expect(Buffer.byteLength(canonical, "utf8")).toBe(item.bytes);
      expect(createHash("sha256").update(Buffer.from(canonical, "utf8")).digest("hex")).toBe(item.hash);
    }
  });

  it("orders keys recursively by UTF-8 bytes, preserves arrays/Unicode, and rejects non-canonical values", () => {
    expect(serializeLotofacilStructuralCanonicalJson({ z: 0, a: [{ b: 2, a: 1 }] }))
      .toBe('{"a":[{"a":1,"b":2}],"z":0}');
    expect(serializeLotofacilStructuralCanonicalJson(["e\u0301", "é"]))
      .toBe('["é","é"]');
  });

  it("rejects non-canonical numbers, fractions, undefined, surrogates, and unknown nested fields", () => {
    for (const invalid of [NaN, Infinity, -Infinity, -0, 1.5, undefined]) {
      expect(() => serializeLotofacilStructuralCanonicalJson(invalid)).toThrow();
    }
    expect(() => serializeLotofacilStructuralCanonicalJson("\ud800")).toThrow();
    expect(() => serializeLotofacilStructuralCanonicalJson(new Date(0))).toThrow();
    expect(() => serializeLotofacilStructuralCanonicalJson(new (class Example { value = 1; })())).toThrow();
    expect(() => serializeLotofacilStructuralCanonicalJson({ value: 1, toJSON: () => ({ value: 2 }) })).toThrow();
    expect(() => serializeLotofacilStructuralCanonicalJson({ [Symbol("hidden")]: 1 })).toThrow();
    const accessor = Object.defineProperty({}, "value", { enumerable: true, get: () => 1 });
    expect(() => serializeLotofacilStructuralCanonicalJson(accessor)).toThrow();
    const nonEnumerable = Object.defineProperty({}, "value", { enumerable: false, value: 1 });
    expect(() => serializeLotofacilStructuralCanonicalJson(nonEnumerable)).toThrow();
    const sparse = Array.from({ length: 2 }) as unknown[];
    expect(() => serializeLotofacilStructuralCanonicalJson(sparse)).toThrow();
    const customArray = [1] as unknown[] & { extra?: number };
    customArray.extra = 2;
    expect(() => serializeLotofacilStructuralCanonicalJson(customArray)).toThrow();
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => serializeLotofacilStructuralCanonicalJson(cyclic)).toThrow();
    expect(() => canonicalExactFractionSchema.parse({ numerator: 1, denominator: 2, extra: true })).toThrow();
    expect(() => canonicalExactFractionSchema.parse({ numerator: 2, denominator: 4 })).toThrow();
    const invalidPolicy = structuredClone(built.policies[1]!);
    (invalidPolicy.rules[0] as unknown as Record<string, unknown>).unexpected = true;
    expect(() => lotofacilStructuralPolicySchema.parse(invalidPolicy)).toThrow();
    const invalidMass = structuredClone(built.masses[1]!);
    (invalidMass.bandMasses[0] as unknown as Record<string, unknown>).unexpected = true;
    expect(() => lotofacilStructuralMassArtifactSchema.parse(invalidMass)).toThrow();
    const invalidSet = { ...structuredClone(built), unexpected: true };
    expect(() => lotofacilStructuralPolicySetSchema.parse(invalidSet)).toThrow();
    expect(() => lotofacilStructuralPolicyProgressSchema.parse({
      ...progress[0],
      totalWork: 1,
    })).toThrow();
  });

  it("enforces the unilateral E8 schema without leaking TypeError", () => {
    const valid = fixture.policies[0]!;
    expect(valid.rules[7]).toMatchObject({
      ruleId: "E8",
      metric: "AMPLITUDE",
      tails: [{ tail: "LOWER", operator: "LESS_THAN_OR_EQUAL" }],
    });
    expect(lotofacilStructuralPolicySchema.safeParse(valid).success).toBe(true);

    const secondTail = structuredClone(valid) as unknown as {
      rules: Array<{ tails: unknown[] }>;
    };
    secondTail.rules[7]!.tails.push({
      ...structuredClone(valid.rules[7]!.tails[0]),
      tail: "UPPER",
      operator: "GREATER_THAN_OR_EQUAL",
      limit: { numerator: 8, denominator: 15 },
      referenceLimit: { numerator: 8, denominator: 15 },
    });
    expectStructuralPolicySchemaRejection(secondTail);

    const missingTail = structuredClone(valid) as unknown as {
      rules: Array<{ tails: unknown[] }>;
    };
    missingTail.rules[7]!.tails = [];
    expectStructuralPolicySchemaRejection(missingTail);

    const incorrectShape = structuredClone(valid) as unknown as {
      rules: Array<{ tails: Array<Record<string, unknown>> }>;
    };
    incorrectShape.rules[7]!.tails[0]!.referenceLimit = { numerator: 8 };
    expectStructuralPolicySchemaRejection(incorrectShape);

    const additionalField = structuredClone(valid) as unknown as {
      rules: Array<{ tails: Array<Record<string, unknown>> }>;
    };
    additionalField.rules[7]!.tails[0]!.unexpected = true;
    expectStructuralPolicySchemaRejection(additionalField);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])(
    "rejects E%i when one of its two contracted tails is absent",
    (ruleIndex) => {
      const invalid = structuredClone(fixture.policies[0]!) as unknown as {
        rules: Array<{ tails: unknown[] }>;
      };
      invalid.rules[ruleIndex]!.tails.pop();
      expectStructuralPolicySchemaRejection(invalid);
    },
  );

  it.each([8, 9])("preserves the unilateral exact-fraction contract for E%i", (ruleIndex) => {
    const valid = fixture.policies[0]!;
    expect(valid.rules[ruleIndex]).toMatchObject({
      tails: [{ tail: "UPPER", operator: "GREATER_THAN_OR_EQUAL" }],
    });
    expect(typeof valid.rules[ruleIndex]!.tails[0]!.limit).not.toBe("number");
    expect(lotofacilStructuralPolicySchema.safeParse(valid).success).toBe(true);

    const secondTail = structuredClone(valid) as unknown as {
      rules: Array<{ tails: unknown[] }>;
    };
    secondTail.rules[ruleIndex]!.tails.push(
      structuredClone(valid.rules[ruleIndex]!.tails[0]),
    );
    expectStructuralPolicySchemaRejection(secondTail);

    const scalarLimit = structuredClone(valid) as unknown as {
      rules: Array<{ tails: Array<Record<string, unknown>> }>;
    };
    scalarLimit.rules[ruleIndex]!.tails[0]!.limit = 8;
    expectStructuralPolicySchemaRejection(scalarLimit);
  });

  it("keeps the complete fixture and all canonical policy and mass hashes unchanged", () => {
    expect(lotofacilStructuralPolicySetSchema.safeParse(fixture).success).toBe(true);
    expect(fixture.policies.map((policy) => policy.artifactHash)).toEqual([
      "sha256:09e65525e23e3212533718c7300533d6164815ed2e6efa82cd8a9e98e055ae30",
      "sha256:7b7f0d46777176183742fb73d4abb5ada770d47a43eb43991d3a2434e3d275d5",
      "sha256:bbcd0c7cb13fccbc0a594ebe0e7bd09515ea4c1c26ace156d17e675f259f75a4",
      "sha256:eadf7c0d62c337e6db9fadf000482fea8f565cc35a23b859598ac15ac983ad0d",
      "sha256:5692c8b7400d3174cffc3d59b52ff572f28e0bd726fb3c5ea07782b3b0146680",
      "sha256:ca1437b44d3006637a9e49f366f455da0513298f59f8e8c531d1834e2e7958df",
    ]);
    expect(fixture.masses.map((mass) => mass.artifactHash)).toEqual([
      "sha256:b8c2348b86774f2bbc99f73de788960f9d5a8c52e653cdf1927c26e3b7574c25",
      "sha256:e6aa9ed585e011b252521039536fdb94d779b91adc50155a95a887a100d9c150",
      "sha256:e7876bab904049b5162fc453a435e9d43359ef9e8785cd2f89eb4df8ba33d991",
      "sha256:f8a1194582cf99b07cdeffe2e09465f9cc9264709141f8e82c4da674ee72f85c",
      "sha256:263a3163de8cd97de8df3c4d37716c3a0c1fea714695e07e3d17e9486f43854a",
      "sha256:f022c9ecca2b13336a45afb76d27701156564570b0c38a0bf591d50d8c69ee08",
    ]);
    expect(fixture.index.artifactHash).toBe(
      "sha256:3a607dbb863e5dbdc92d00cce3efd93455afcc344626c3d9aa6bc97e1decc141",
    );
  });

  it("verifies every artifact hash and rejects a one-field mutation", () => {
    expect(verifyLotofacilStructuralPolicySet(built)).toEqual(built);
    for (const artifact of [...built.policies, ...built.masses, built.index]) {
      const clone = structuredClone(artifact) as unknown as Record<string, unknown>;
      const expectedHash = clone.artifactHash;
      delete clone.artifactHash;
      expect(calculateLotofacilStructuralArtifactHash(clone)).toBe(expectedHash);
    }
    const tampered = structuredClone(built);
    tampered.policies[1]!.descriptiveMeanSum += 1;
    expect(() => verifyLotofacilStructuralPolicySet(tampered)).toThrow();
    const validShapeWrongHash = structuredClone(built);
    validShapeWrongHash.policies[1]!.artifactHash = `sha256:${"0".repeat(64)}`;
    validShapeWrongHash.index.references[1]!.policyHash = validShapeWrongHash.policies[1]!.artifactHash;
    expect(() => verifyLotofacilStructuralPolicySet(validShapeWrongHash))
      .toThrow(StructuralArtifactHashMismatchError);
  });

  it("freezes all six public error codes and rejects incompatible policy/profile pairs", () => {
    expect(lotofacilStructuralPolicyErrorCodeSchema.options).toEqual([
      "INVALID_STRUCTURAL_POLICY_REQUEST",
      "STRUCTURAL_POLICY_DEPENDENCY_MISMATCH",
      "STRUCTURAL_POLICY_LIMIT_DERIVATION_FAILED",
      "STRUCTURAL_MASS_RECONCILIATION_FAILED",
      "STRUCTURAL_ARTIFACT_HASH_MISMATCH",
      "STRUCTURAL_POLICY_BUILD_CANCELLED",
    ]);
    const profile15 = calculateLotofacilMetricProfile(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(() => classifyLotofacilStructuralProfileV2(profile15, built.policies[1])).toThrow(
      "profile identity and policy dependencies must agree",
    );
    expect(() => classifyLotofacilStructuralProfileV2(
      { ...profile15, metricEngineVersion: "forged" },
      built.policies[0],
    )).toThrow("profile identity and policy dependencies must agree");
    expect(() => classifyLotofacilStructuralProfileV2(
      { ...profile15, lotteryDefinition: { ...profile15.lotteryDefinition, id: "forged" } },
      built.policies[0],
    )).toThrow("profile identity and policy dependencies must agree");

    const recalibrated15 = structuredClone(built.policies[0]) as unknown as Record<string, unknown>;
    const rules = recalibrated15.rules as Array<{ tails: Array<{ limit: number | object }> }>;
    rules[0]!.tails[0]!.limit = 5;
    delete recalibrated15.artifactHash;
    const artifactHash = calculateLotofacilStructuralArtifactHash(recalibrated15);
    expect(() => lotofacilStructuralPolicySchema.parse({ ...recalibrated15, artifactHash })).toThrow(
      "15-number policy must remain identical",
    );
  });

  it("emits monotonic typed progress without adding FINALIZE to combination visits", () => {
    expect(progress[0]).toMatchObject({ phase: "BUILD_EXACT_DISTRIBUTIONS", betSize: 15, processedWork: 0 });
    expect(progress.at(-1)).toMatchObject({
      phase: "FINALIZE_ARTIFACTS", betSize: null, processedWork: 13, totalWork: 13,
      overallProcessedWork: LOTOFACIL_STRUCTURAL_MAX_COMBINATION_VISITS,
      overallPercent: 100,
    });
    for (let index = 1; index < progress.length; index += 1) {
      expect(progress[index]!.overallProcessedWork).toBeGreaterThanOrEqual(
        progress[index - 1]!.overallProcessedWork as number,
      );
    }
    for (const event of progress) {
      expect(event.overallTotalWork).toBe(LOTOFACIL_STRUCTURAL_MAX_COMBINATION_VISITS);
      if (event.phase !== "FINALIZE_ARTIFACTS") {
        expect(event.totalWork).toBe(fixture.policies.find((policy) =>
          policy.betSize === event.betSize)!.universeSize);
      }
    }
    for (const phase of ["BUILD_EXACT_DISTRIBUTIONS", "BUILD_CLASSIFIED_MASSES"] as const) {
      const terminalVisits = [15, 16, 17, 18, 19, 20].reduce((phaseTotal, betSize) => {
        const events = progress.filter((event) => event.phase === phase && event.betSize === betSize);
        expect(events[0]!.processedWork).toBe(0);
        expect(events.at(-1)!.processedWork).toBe(events.at(-1)!.totalWork);
        for (let index = 1; index < events.length; index += 1) {
          expect((events[index]!.processedWork as number) -
            (events[index - 1]!.processedWork as number)).toBeLessThanOrEqual(10_000);
        }
        return phaseTotal + (events.at(-1)!.processedWork as number);
      }, 0);
      expect(terminalVisits).toBe(7_104_240);
    }
  });

  it("supports cooperative cancellation before and during enumeration without a partial result", async () => {
    const before = new AbortController();
    before.abort();
    await expect(buildLotofacilStructuralPolicySet({ signal: before.signal }))
      .rejects.toBeInstanceOf(StructuralPolicyBuildCancelledError);

    const during = new AbortController();
    let completed = false;
    const promise = buildLotofacilStructuralPolicySet({
      signal: during.signal,
      onProgress: (event) => {
        if (event.phase === "BUILD_EXACT_DISTRIBUTIONS" && event.processedWork >= 10_000) during.abort();
      },
    }).then(() => { completed = true; });
    await expect(promise).rejects.toBeInstanceOf(StructuralPolicyBuildCancelledError);
    expect(completed).toBe(false);
  });

  it("also cancels cooperatively during the classified-mass phase", async () => {
    const controller = new AbortController();
    let completed = false;
    const promise = buildLotofacilStructuralPolicySet({
      signal: controller.signal,
      onProgress: (event) => {
        if (event.phase === "BUILD_CLASSIFIED_MASSES" && event.processedWork >= 10_000) {
          controller.abort();
        }
      },
    }).then(() => { completed = true; });
    await expect(promise).rejects.toBeInstanceOf(StructuralPolicyBuildCancelledError);
    expect(completed).toBe(false);
  }, 30_000);

  it("extends the formula manifest additively while preserving the legacy manifest", () => {
    const legacy = getLotofacilCanonicalFormulaManifest();
    const extended = getLotofacilCanonicalFormulaManifestV1_1(built);
    expect(legacy.formulaVersion).toBe("1.0.0");
    expect(extended.formulaVersion).toBe("1.1.0");
    expect(extended.legacyManifest).toEqual(legacy);
    expect(extended.structuralPolicySet.references).toHaveLength(6);
  });
});

describe("cooperative combinatorics extension", () => {
  it("preserves lexicographic order and reports exact batches", async () => {
    const combinations: number[][] = [];
    const batches: number[] = [];
    const visited = await forEachCombinationAsync(5, 3, (combination) => {
      combinations.push([...combination]);
    }, { batchSize: 3, onBatch: (processed) => batches.push(processed) });
    expect(visited).toBe(10);
    expect(combinations).toEqual([
      [0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4],
      [0, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4],
    ]);
    expect(batches).toEqual([3, 6, 9, 10]);
  });

  it("observes AbortSignal after a bounded yield", async () => {
    const controller = new AbortController();
    await expect(forEachCombinationAsync(10, 5, () => undefined, {
      signal: controller.signal,
      batchSize: 4,
      onBatch: () => controller.abort(),
    })).rejects.toBeInstanceOf(CombinationIterationCancelledError);
  });
});

describe("structural policy CLI", () => {
  it("builds the complete set with JSONL progress only on stderr and one final stdout JSON", () => {
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "apps/cli/src/index.ts", "lotofacil", "structural-policy", "build",
    ], { cwd: process.cwd(), encoding: "utf8", timeout: 45_000, maxBuffer: 2 * 1024 * 1024 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    expect(lotofacilStructuralPolicySetSchema.parse(JSON.parse(result.stdout))).toEqual(fixture);
    const lines = result.stderr.trim().split("\n").map((line) =>
      lotofacilStructuralPolicyProgressSchema.parse(JSON.parse(line)));
    expect(lines[0]).toMatchObject({ phase: "BUILD_EXACT_DISTRIBUTIONS", betSize: 15, processedWork: 0 });
    expect(lines.at(-1)).toMatchObject({ phase: "FINALIZE_ARTIFACTS", betSize: null, processedWork: 13 });
  }, 50_000);

  it("verifies a complete fixture with one stdout JSON and empty stderr", () => {
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "apps/cli/src/index.ts", "lotofacil", "structural-policy",
      "verify", "--input", fixturePath,
    ], { cwd: process.cwd(), encoding: "utf8", timeout: 15_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(result.stdout)).toEqual(fixture);
  });

  it("returns one stable JSONL error and no stdout when verify input is absent", () => {
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "apps/cli/src/index.ts", "lotofacil", "structural-policy", "verify",
    ], { cwd: process.cwd(), encoding: "utf8", timeout: 15_000 });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(result.stderr)).toMatchObject({
      type: "error",
      code: "INVALID_STRUCTURAL_POLICY_REQUEST",
    });
  });

  it("converts SIGINT during build to exit 130 without partial stdout", async () => {
    const outcome = await new Promise<{ code: number | null; stdout: string; stderr: string }>((done) => {
      const child = spawn(process.execPath, [
        "--import", "tsx", "apps/cli/src/index.ts", "lotofacil", "structural-policy", "build",
      ], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let interrupted = false;
      child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
        stderr += chunk;
        if (!interrupted && stderr.includes('"processedWork":10000')) {
          interrupted = child.kill("SIGINT");
        }
      });
      child.on("close", (code) => done({ code, stdout, stderr }));
    });
    expect(outcome.code).toBe(130);
    expect(outcome.stdout).toBe("");
    const lines = outcome.stderr.trim().split("\n").map((line) => JSON.parse(line));
    expect(lines.at(-1)).toMatchObject({ type: "error", code: "STRUCTURAL_POLICY_BUILD_CANCELLED" });
  }, 30_000);
});
