import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  auditExpandedPortfolioCoverage,
  ExactCoverageAuditCancelledError,
} from "@boloes/coverage-engine";
import {
  CANONICAL_BET_EXPANSION_ALGORITHM_VERSION,
  CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
  EXACT_COVERAGE_AUDIT_ALGORITHM_VERSION,
  EXACT_COVERAGE_AUDIT_CONTRACT_VERSION,
  EXACT_COVERAGE_AUDIT_TIMEOUT_MS,
  EXPANDED_COVERAGE_COMPOSITION_ALGORITHM_VERSION,
  EXPANDED_COVERAGE_COMPOSITION_CONTRACT_VERSION,
  expandedCoverageCompositionExecutionSchema,
  expandedCoverageCompositionRequestSchema,
  expandedCoverageCompositionResultBaseSchema,
  expandedCoverageCompositionResultSchema,
  type ExactCoverageAdapter,
} from "@boloes/lottery-contracts";
import {
  LOTOFACIL_CANONICAL_BET_EXPANSION_ADAPTER_VERSION,
  LOTOFACIL_DEFINITION,
  LOTOFACIL_EXACT_COVERAGE_ADAPTER_VERSION,
  lotofacilCanonicalBetExpansionAdapter,
  lotofacilExactCoverageAdapter,
} from "@boloes/lottery-lotofacil";
import { describe, expect, it, vi } from "vitest";

function sourceNumbers(size: number, offset = 0): number[] {
  return Array.from({ length: size }, (_, index) => index + 1 + offset);
}

function request(sourceBets: readonly { readonly numbers: readonly number[] }[]) {
  return {
    contractVersion: EXPANDED_COVERAGE_COMPOSITION_CONTRACT_VERSION,
    lotteryDefinition: LOTOFACIL_DEFINITION,
    sourceBets,
  };
}

function writeRequest(input: unknown): string {
  const directory = mkdtempSync(join(tmpdir(), "boloes-expanded-coverage-"));
  const inputPath = join(directory, "request.json");
  writeFileSync(inputPath, JSON.stringify(input));
  return inputPath;
}

function tinyCoverageAdapter(
  visitedCandidates: number[][] = [],
): ExactCoverageAdapter {
  return {
    lotteryId: "lotofacil",
    adapterVersion: "lotofacil-test-coverage/1.0.0",
    betSize: 15,
    universeSize: 1,
    coveredOutcomeVisitsPerCandidate: 1,
    tiers: [{ minimumHits: 15, grossCoveredOutcomesPerCandidate: 1 }],
    supportsDefinition: (definition) => (
      definition.id === LOTOFACIL_DEFINITION.id &&
      definition.version === LOTOFACIL_DEFINITION.version
    ),
    enumerateCoveredOutcomeRanks: (numbers, visitor) => {
      visitedCandidates.push([...numbers]);
      visitor(0, 15);
    },
  };
}

describe("Lotofácil expanded exact-coverage composition", () => {
  it("composes one canonical source with the unchanged exact coverage contracts", async () => {
    const result = await auditExpandedPortfolioCoverage(
      request([{ numbers: sourceNumbers(15) }]),
      lotofacilCanonicalBetExpansionAdapter,
      lotofacilExactCoverageAdapter,
    );

    expect(result).toMatchObject({
      contractVersion: EXPANDED_COVERAGE_COMPOSITION_CONTRACT_VERSION,
      algorithmVersion: EXPANDED_COVERAGE_COMPOSITION_ALGORITHM_VERSION,
      componentVersions: {
        expansionContractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
        expansionAlgorithmVersion: CANONICAL_BET_EXPANSION_ALGORITHM_VERSION,
        expansionAdapterVersion: LOTOFACIL_CANONICAL_BET_EXPANSION_ADAPTER_VERSION,
        coverageContractVersion: EXACT_COVERAGE_AUDIT_CONTRACT_VERSION,
        coverageAlgorithmVersion: EXACT_COVERAGE_AUDIT_ALGORITHM_VERSION,
        coverageAdapterVersion: LOTOFACIL_EXACT_COVERAGE_ADAPTER_VERSION,
      },
      lottery: { id: "lotofacil", definitionVersion: "1.0.0" },
      sourceBetCount: 1,
      expandedCandidateCount: 1,
      distinctCandidateCount: 1,
      duplicateCandidateOccurrences: 0,
      transient: true,
      persisted: false,
      frozen: false,
      portfolioStateChanged: false,
    });
    expect(result.sources).toEqual([{
      sourceIndex: 0,
      sourceBet: { numbers: sourceNumbers(15) },
      sourceBetSize: 15,
      expectedCandidateCount: 1,
    }]);
    expect(result.coverage).toMatchObject({
      contractVersion: EXACT_COVERAGE_AUDIT_CONTRACT_VERSION,
      candidateCount: 1,
      exact: true,
      absoluteError: 0,
      coverageCalculated: true,
    });
    expect(expandedCoverageCompositionResultSchema.parse(result)).toEqual(result);
  });

  it("preserves source order, lexicographic expansion order and duplicate occurrences", async () => {
    const visitedCandidates: number[][] = [];
    const firstSource = { numbers: sourceNumbers(16) };
    const repeatedCandidate = { numbers: sourceNumbers(15) };
    const input = request([firstSource, repeatedCandidate]);
    const frozenSnapshot = JSON.stringify(input);

    const result = await auditExpandedPortfolioCoverage(
      input,
      lotofacilCanonicalBetExpansionAdapter,
      tinyCoverageAdapter(visitedCandidates),
    );

    expect(result.sources.map((source) => ({
      sourceIndex: source.sourceIndex,
      sourceBetSize: source.sourceBetSize,
      expectedCandidateCount: source.expectedCandidateCount,
    }))).toEqual([
      { sourceIndex: 0, sourceBetSize: 16, expectedCandidateCount: 16 },
      { sourceIndex: 1, sourceBetSize: 15, expectedCandidateCount: 1 },
    ]);
    expect(visitedCandidates).toHaveLength(17);
    expect(visitedCandidates[0]).toEqual(sourceNumbers(15));
    expect(visitedCandidates[15]).toEqual(sourceNumbers(15, 1));
    expect(visitedCandidates[16]).toEqual(sourceNumbers(15));
    expect(result).toMatchObject({
      expandedCandidateCount: 17,
      distinctCandidateCount: 16,
      duplicateCandidateOccurrences: 1,
    });
    expect(result.coverage).toMatchObject({
      candidateCount: 17,
      tiers: [{
        grossCoveredOutcomes: 17,
        uniqueCoveredOutcomes: 1,
        repeatedCoveredOutcomes: 16,
        efficiency: { numerator: 1, denominator: 17 },
      }],
    });
    expect(expandedCoverageCompositionResultBaseSchema.parse(result)).toEqual(result);
    expect(JSON.stringify(input)).toBe(frozenSnapshot);
  });

  it("accepts every eligible source size and exactly 1,000 occurrences", async () => {
    const sourceBets = [
      { numbers: sourceNumbers(15) },
      { numbers: sourceNumbers(16) },
      { numbers: sourceNumbers(17) },
      { numbers: sourceNumbers(18) },
      ...Array.from({ length: 31 }, () => ({ numbers: sourceNumbers(15) })),
    ];

    const result = await auditExpandedPortfolioCoverage(
      request(sourceBets),
      lotofacilCanonicalBetExpansionAdapter,
      tinyCoverageAdapter(),
    );

    expect(result.sources.slice(0, 4).map((source) => source.expectedCandidateCount))
      .toEqual([1, 16, 136, 816]);
    expect(result).toMatchObject({
      sourceBetCount: 35,
      expandedCandidateCount: 1_000,
      coverage: { candidateCount: 1_000 },
    });
  });

  it("runs the largest eligible single source within the inherited timeout", async () => {
    const startedAt = performance.now();
    const result = await auditExpandedPortfolioCoverage(
      request([{ numbers: sourceNumbers(18) }]),
      lotofacilCanonicalBetExpansionAdapter,
      lotofacilExactCoverageAdapter,
    );

    expect(result.expandedCandidateCount).toBe(816);
    expect(result.coverage.candidateCount).toBe(816);
    expect(performance.now() - startedAt).toBeLessThan(EXACT_COVERAGE_AUDIT_TIMEOUT_MS);
  }, 35_000);

  it("rejects 1,001 occurrences and sources 19-20 before adapters or progress", async () => {
    const expansion = vi.fn(lotofacilCanonicalBetExpansionAdapter.expand);
    const expansionAdapter = {
      ...lotofacilCanonicalBetExpansionAdapter,
      expand: expansion,
    };
    const progress = vi.fn();
    const overLimit = request([
      { numbers: sourceNumbers(15) },
      { numbers: sourceNumbers(16) },
      { numbers: sourceNumbers(17) },
      { numbers: sourceNumbers(18) },
      ...Array.from({ length: 32 }, () => ({ numbers: sourceNumbers(15) })),
    ]);

    expect(expandedCoverageCompositionRequestSchema.safeParse(overLimit).success).toBe(false);
    await expect(auditExpandedPortfolioCoverage(
      overLimit,
      expansionAdapter,
      tinyCoverageAdapter(),
      { onProgress: progress },
    )).rejects.toThrow("limited to 1000 candidate occurrences");
    expect(expansion).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();

    for (const size of [19, 20]) {
      await expect(auditExpandedPortfolioCoverage(
        request([{ numbers: sourceNumbers(size) }]),
        expansionAdapter,
        tinyCoverageAdapter(),
        { onProgress: progress },
      )).rejects.toThrow("limited to 1000 candidate occurrences");
    }
    expect(expansion).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
  });

  it("keeps request, result and execution boundaries strict and linked", async () => {
    const validRequest = request([{ numbers: sourceNumbers(15) }]);
    const result = await auditExpandedPortfolioCoverage(
      validRequest,
      lotofacilCanonicalBetExpansionAdapter,
      lotofacilExactCoverageAdapter,
    );
    expect(expandedCoverageCompositionExecutionSchema.safeParse({
      request: validRequest,
      result,
    }).success).toBe(true);

    expect(expandedCoverageCompositionRequestSchema.safeParse({
      ...validRequest,
      history: [],
    }).success).toBe(false);
    expect(expandedCoverageCompositionRequestSchema.safeParse({
      ...validRequest,
      lotteryDefinition: { ...LOTOFACIL_DEFINITION, history: [] },
    }).success).toBe(false);
    expect(expandedCoverageCompositionRequestSchema.safeParse({
      ...validRequest,
      sourceBets: [{ numbers: sourceNumbers(15), strategy: {} }],
    }).success).toBe(false);
    expect(expandedCoverageCompositionRequestSchema.safeParse({
      ...validRequest,
      sourceBets: [],
    }).success).toBe(false);
    expect(expandedCoverageCompositionRequestSchema.safeParse({
      ...validRequest,
      sourceBets: [{ numbers: [...sourceNumbers(14), 14] }],
    }).success).toBe(false);

    expect(expandedCoverageCompositionResultBaseSchema.safeParse({
      ...result,
      strategy: {},
    }).success).toBe(false);
    expect(expandedCoverageCompositionResultBaseSchema.safeParse({
      ...result,
      expandedCandidateCount: 2,
    }).success).toBe(false);
    expect(expandedCoverageCompositionResultBaseSchema.safeParse({
      ...result,
      duplicateCandidateOccurrences: 1,
    }).success).toBe(false);
    expect(expandedCoverageCompositionResultBaseSchema.safeParse({
      ...result,
      componentVersions: {
        ...result.componentVersions,
        coverageAdapterVersion: "tampered",
      },
    }).success).toBe(false);
    expect(expandedCoverageCompositionResultBaseSchema.safeParse({
      ...result,
      sources: result.sources.map((source) => ({
        ...source,
        expectedCandidateCount: source.expectedCandidateCount + 1,
      })),
      expandedCandidateCount: 2,
      coverage: { ...result.coverage, candidateCount: 2 },
    }).success).toBe(false);
    expect(expandedCoverageCompositionResultBaseSchema.safeParse({
      ...result,
      sources: result.sources.map((source) => ({
        ...source,
        sourceBet: { numbers: [...source.sourceBet.numbers].reverse() },
      })),
    }).success).toBe(false);
    const outOfLotofacilRangeResult = {
      ...result,
      sources: result.sources.map((source) => ({
        ...source,
        sourceBet: { numbers: sourceNumbers(15, 25) },
      })),
    };
    expect(expandedCoverageCompositionResultBaseSchema.safeParse(
      outOfLotofacilRangeResult,
    ).success).toBe(true);
    expect(expandedCoverageCompositionResultSchema.safeParse(
      outOfLotofacilRangeResult,
    ).success).toBe(false);
    expect(expandedCoverageCompositionExecutionSchema.safeParse({
      request: request([{ numbers: sourceNumbers(15, 1) }]),
      result,
    }).success).toBe(false);
    const twoSourceRequest = request([
      { numbers: sourceNumbers(15) },
      { numbers: sourceNumbers(15) },
    ]);
    const twoSourceResult = await auditExpandedPortfolioCoverage(
      twoSourceRequest,
      lotofacilCanonicalBetExpansionAdapter,
      lotofacilExactCoverageAdapter,
    );
    expect(expandedCoverageCompositionResultSchema.safeParse(
      twoSourceResult,
    ).success).toBe(true);
    expect(expandedCoverageCompositionExecutionSchema.safeParse({
      request: validRequest,
      result: twoSourceResult,
    }).success).toBe(false);
  });

  it("forwards progress and preserves typed cancellation and timeout", async () => {
    const progress: Array<{ processedWork: number; percent: number }> = [];
    await auditExpandedPortfolioCoverage(
      request([{ numbers: sourceNumbers(15) }]),
      lotofacilCanonicalBetExpansionAdapter,
      tinyCoverageAdapter(),
      { onProgress: (event) => progress.push(event) },
    );
    expect(progress[0]).toMatchObject({ processedWork: 0, percent: 0 });
    expect(progress.at(-1)).toMatchObject({ percent: 100 });

    const preCancelled = new AbortController();
    preCancelled.abort();
    const expansion = vi.fn(lotofacilCanonicalBetExpansionAdapter.expand);
    await expect(auditExpandedPortfolioCoverage(
      request([{ numbers: sourceNumbers(15) }]),
      { ...lotofacilCanonicalBetExpansionAdapter, expand: expansion },
      tinyCoverageAdapter(),
      { signal: preCancelled.signal },
    )).rejects.toBeInstanceOf(ExactCoverageAuditCancelledError);
    expect(expansion).not.toHaveBeenCalled();

    const cooperativeCancellation = new AbortController();
    await expect(auditExpandedPortfolioCoverage(
      request([{ numbers: sourceNumbers(15) }]),
      lotofacilCanonicalBetExpansionAdapter,
      tinyCoverageAdapter(),
      {
        signal: cooperativeCancellation.signal,
        onProgress: (event) => {
          if (event.processedWork === 0) cooperativeCancellation.abort();
        },
      },
    )).rejects.toBeInstanceOf(ExactCoverageAuditCancelledError);

    let clockCalls = 0;
    await expect(auditExpandedPortfolioCoverage(
      request([{ numbers: sourceNumbers(15) }]),
      lotofacilCanonicalBetExpansionAdapter,
      tinyCoverageAdapter(),
      { now: () => (++clockCalls >= 3 ? EXACT_COVERAGE_AUDIT_TIMEOUT_MS : 0) },
    )).rejects.toMatchObject({ name: "TimeoutError", code: "COVERAGE_TIMEOUT" });
  });

  it("exposes the composed CLI with isolated streams and no partial errors", () => {
    const inputPath = writeRequest(request([{ numbers: sourceNumbers(15) }]));
    const success = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "apps/cli/src/index.ts",
        "portfolio",
        "audit-expanded-coverage",
        "--input",
        inputPath,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(success.status, success.stderr).toBe(0);
    const progress = success.stderr
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(progress[0]).toMatchObject({
      phase: "MARK_COVERED_OUTCOMES",
      processedWork: 0,
      percent: 0,
    });
    expect(progress.at(-1)).toMatchObject({
      phase: "COUNT_UNIQUE_OUTCOMES",
      percent: 100,
    });
    expect(JSON.parse(success.stdout)).toMatchObject({
      sourceBetCount: 1,
      expandedCandidateCount: 1,
      coverage: { method: "EXACT_ENUMERATION", candidateCount: 1 },
    });

    const failure = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "apps/cli/src/index.ts",
        "portfolio",
        "audit-expanded-coverage",
        "--input",
        writeRequest(request([{ numbers: sourceNumbers(19) }])),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(failure.status).toBe(1);
    expect(failure.stdout).toBe("");
    expect(JSON.parse(failure.stderr)).toMatchObject({
      type: "error",
      code: "INVALID_COVERAGE_REQUEST",
    });
  });
});
