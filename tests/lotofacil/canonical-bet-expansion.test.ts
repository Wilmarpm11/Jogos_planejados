import { spawnSync } from "node:child_process";
import { auditExactPortfolioCoverage } from "@boloes/coverage-engine";
import {
  CANONICAL_BET_EXPANSION_ALGORITHM_VERSION,
  CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
  CANONICAL_BET_EXPANSION_MAX_CANDIDATES,
  canonicalBetExpansionExecutionSchema,
  canonicalBetExpansionRequestSchema,
  canonicalBetExpansionResultSchema,
} from "@boloes/lottery-contracts";
import {
  expandLotofacilCanonicalBet,
  lotofacilCanonicalBetExpansionAdapter,
  lotofacilExactCoverageAdapter,
  LOTOFACIL_DEFINITION,
} from "@boloes/lottery-lotofacil";
import { describe, expect, it, vi } from "vitest";

const expectedCounts = new Map([
  [15, 1],
  [16, 16],
  [17, 136],
  [18, 816],
  [19, 3_876],
  [20, 15_504],
]);

function sourceNumbers(size: number): number[] {
  return Array.from({ length: size }, (_, index) => index + 1);
}

function request(size: number): {
  contractVersion: typeof CANONICAL_BET_EXPANSION_CONTRACT_VERSION;
  lotteryDefinition: typeof LOTOFACIL_DEFINITION;
  sourceBet: { numbers: number[] };
} {
  return {
    contractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
    lotteryDefinition: LOTOFACIL_DEFINITION,
    sourceBet: { numbers: sourceNumbers(size) },
  };
}

function compareNumberSequences(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

describe("Lotofácil canonical bet expansion", () => {
  it.each([...expectedCounts])(
    "materializes C(%i,15) = %i unique canonical candidates",
    (size, expectedCandidateCount) => {
      const result = expandLotofacilCanonicalBet(request(size));
      const identities = result.candidates.map(({ numbers }) => numbers.join(","));

      expect(result.expectedCandidateCount).toBe(expectedCandidateCount);
      expect(result.candidates).toHaveLength(expectedCandidateCount);
      expect(new Set(identities).size).toBe(expectedCandidateCount);
      expect(result.candidates.every(({ numbers }) => (
        numbers.length === 15 &&
        numbers.every((number, index) => index === 0 || number > numbers[index - 1]!)
      ))).toBe(true);
      expect(result.candidates.every(({ numbers }) => (
        numbers.every((number) => result.sourceBet.numbers.includes(number))
      ))).toBe(true);
      expect(result.candidates.every((candidate, index) => (
        index === 0 || compareNumberSequences(result.candidates[index - 1]!.numbers, candidate.numbers) < 0
      ))).toBe(true);
      expect(canonicalBetExpansionResultSchema.parse(result)).toEqual(result);
    },
  );

  it("returns identity for 15 and the canonical endpoints for 20 without mutating the source", () => {
    const frozenNumbers = Object.freeze(sourceNumbers(20));
    const frozenRequest = Object.freeze({
      contractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
      lotteryDefinition: Object.freeze({ ...LOTOFACIL_DEFINITION }),
      sourceBet: Object.freeze({ numbers: frozenNumbers }),
    });
    const before = [...frozenNumbers];
    const expanded = expandLotofacilCanonicalBet(frozenRequest);
    const identity = expandLotofacilCanonicalBet(request(15));

    expect(identity.candidates).toEqual([{ numbers: sourceNumbers(15) }]);
    expect(expanded.candidates[0]!.numbers).toEqual(sourceNumbers(15));
    expect(expanded.candidates.at(-1)!.numbers).toEqual(sourceNumbers(20).slice(5));
    expect(frozenNumbers).toEqual(before);
    expect(expanded).toMatchObject({
      contractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
      algorithmVersion: CANONICAL_BET_EXPANSION_ALGORITHM_VERSION,
      lottery: { id: "lotofacil", definitionVersion: "1.0.0" },
      sourceBetSize: 20,
      simpleBetSize: 15,
      expectedCandidateCount: 15_504,
      transient: true,
      persisted: false,
      frozen: false,
      coverageCalculated: false,
      portfolioStateChanged: false,
    });
  });

  it("keeps request and result schemas strict and enforces result invariants", () => {
    const validRequest = request(16);
    const result = expandLotofacilCanonicalBet(validRequest);

    expect(canonicalBetExpansionRequestSchema.safeParse({ ...validRequest, history: [] }).success)
      .toBe(false);
    expect(canonicalBetExpansionRequestSchema.safeParse({
      ...validRequest,
      lotteryDefinition: { ...LOTOFACIL_DEFINITION, history: [] },
    }).success).toBe(false);
    expect(canonicalBetExpansionRequestSchema.safeParse({
      ...validRequest,
      sourceBet: { ...validRequest.sourceBet, strategy: {} },
    }).success).toBe(false);
    expect(canonicalBetExpansionResultSchema.safeParse({ ...result, history: [] }).success)
      .toBe(false);
    expect(canonicalBetExpansionResultSchema.safeParse({
      ...result,
      expectedCandidateCount: result.expectedCandidateCount + 1,
    }).success).toBe(false);
    const truncatedCandidates = result.candidates.slice(0, -1);
    expect(canonicalBetExpansionResultSchema.safeParse({
      ...result,
      expectedCandidateCount: truncatedCandidates.length,
      candidates: truncatedCandidates,
    }).success).toBe(false);
    expect(canonicalBetExpansionResultSchema.safeParse({
      ...result,
      candidates: [...result.candidates].reverse(),
    }).success).toBe(false);
    expect(canonicalBetExpansionResultSchema.safeParse({
      ...result,
      sourceBet: { numbers: [...result.sourceBet.numbers].reverse() },
    }).success).toBe(false);
  });

  it("binds results to the originating request and rejects oversized workloads", () => {
    const origin = request(16);
    const result = expandLotofacilCanonicalBet(origin);
    expect(canonicalBetExpansionExecutionSchema.parse({ request: origin, result }).result)
      .toEqual(result);
    expect(canonicalBetExpansionExecutionSchema.safeParse({
      request: origin,
      result: { ...result, lottery: { id: "other", definitionVersion: "1.0.0" } },
    }).success).toBe(false);
    expect(canonicalBetExpansionExecutionSchema.safeParse({
      request: origin,
      result: { ...result, lottery: { id: "lotofacil", definitionVersion: "2.0.0" } },
    }).success).toBe(false);
    expect(canonicalBetExpansionExecutionSchema.safeParse({
      request: origin,
      result: expandLotofacilCanonicalBet({
        ...origin,
        sourceBet: { numbers: sourceNumbers(16).map((number) => number + 1) },
      }),
    }).success).toBe(false);
    expect(canonicalBetExpansionExecutionSchema.safeParse({
      request: {
        ...origin,
        lotteryDefinition: {
          ...LOTOFACIL_DEFINITION,
          drawSize: 14,
          minBetSize: 14,
        },
      },
      result,
    }).success).toBe(false);

    const oversized = {
      contractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
      lotteryDefinition: {
        id: "generic",
        version: "1.0.0",
        totalNumbers: 30,
        drawSize: 15,
        minBetSize: 15,
        maxBetSize: 30,
      },
      sourceBet: { numbers: sourceNumbers(30) },
    };
    expect(canonicalBetExpansionRequestSchema.safeParse(oversized).success).toBe(false);
    expect(CANONICAL_BET_EXPANSION_MAX_CANDIDATES).toBe(15_504);
  });

  it("rejects oversized candidate arrays through direct result-schema parsing", () => {
    const numbers = sourceNumbers(CANONICAL_BET_EXPANSION_MAX_CANDIDATES + 1);
    const candidates = numbers.map((number) => ({ numbers: [number] }));

    expect(canonicalBetExpansionResultSchema.safeParse({
      contractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
      algorithmVersion: CANONICAL_BET_EXPANSION_ALGORITHM_VERSION,
      lottery: { id: "generic", definitionVersion: "1.0.0" },
      sourceBet: { numbers },
      sourceBetSize: numbers.length,
      simpleBetSize: 1,
      expectedCandidateCount: candidates.length,
      candidates,
      transient: true,
      persisted: false,
      frozen: false,
      coverageCalculated: false,
      portfolioStateChanged: false,
    }).success).toBe(false);
  });

  it.each([
    { label: "other lottery", value: { ...request(15), lotteryDefinition: { ...LOTOFACIL_DEFINITION, id: "other" } } },
    { label: "other definition version", value: { ...request(15), lotteryDefinition: { ...LOTOFACIL_DEFINITION, version: "2.0.0" } } },
    { label: "14 numbers", value: request(14) },
    { label: "21 numbers", value: request(21) },
    { label: "number outside 01-25", value: { ...request(15), sourceBet: { numbers: [...sourceNumbers(14), 26] } } },
    { label: "duplicate", value: { ...request(15), sourceBet: { numbers: [...sourceNumbers(14), 14] } } },
    { label: "descending order", value: { ...request(15), sourceBet: { numbers: [...sourceNumbers(15)].reverse() } } },
    { label: "non-integer", value: { ...request(15), sourceBet: { numbers: [...sourceNumbers(14), 15.5] } } },
  ])("rejects $label during preflight", ({ value }) => {
    expect(() => expandLotofacilCanonicalBet(value)).toThrow();
  });

  it("exposes the reusable adapter without widening the supported definition", () => {
    expect(lotofacilCanonicalBetExpansionAdapter.lotteryId).toBe("lotofacil");
    expect(lotofacilCanonicalBetExpansionAdapter.supportsDefinition(LOTOFACIL_DEFINITION)).toBe(true);
    expect(lotofacilCanonicalBetExpansionAdapter.supportsDefinition({
      ...LOTOFACIL_DEFINITION,
      version: "2.0.0",
    })).toBe(false);
    expect(lotofacilCanonicalBetExpansionAdapter.expand(request(16)))
      .toEqual(expandLotofacilCanonicalBet(request(16)));
  });

  it("keeps exact coverage 1.0 restricted to simple 15-number candidates", async () => {
    const progress = vi.fn();
    await expect(auditExactPortfolioCoverage({
      contractVersion: "1.0",
      lotteryDefinition: LOTOFACIL_DEFINITION,
      candidates: [{ numbers: sourceNumbers(16) }],
    }, lotofacilExactCoverageAdapter, { onProgress: progress }))
      .rejects.toThrow("supports only 15-number bets");
    expect(progress).not.toHaveBeenCalled();
  });

  it("provides a local CLI command with isolated stdout and stderr", () => {
    const success = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "lotofacil", "expand", "--numbers", sourceNumbers(16).join(",")],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(success.status, success.stderr).toBe(0);
    expect(success.stderr).toBe("");
    expect(JSON.parse(success.stdout)).toMatchObject({
      sourceBetSize: 16,
      simpleBetSize: 15,
      expectedCandidateCount: 16,
      transient: true,
      persisted: false,
      frozen: false,
      coverageCalculated: false,
      portfolioStateChanged: false,
    });

    const failure = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "lotofacil", "expand", "--numbers", sourceNumbers(14).join(",")],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(failure.status).toBe(1);
    expect(failure.stdout).toBe("");
    expect(failure.stderr).not.toBe("");
  });
});
