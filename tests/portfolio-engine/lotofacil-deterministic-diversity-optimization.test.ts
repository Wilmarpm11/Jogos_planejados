import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  INTERSECTION_CARDINALITY_ALGORITHM_VERSION,
  intersectionCardinality,
} from "@boloes/combinatorics";
import {
  PORTFOLIO_DIVERSITY_OPTIMIZATION_ALGORITHM,
  PORTFOLIO_DIVERSITY_OPTIMIZATION_CONTRACT_VERSION,
  portfolioDiversityOptimizationErrorCodeSchema,
  portfolioDiversityOptimizationProgressSchema,
  portfolioDiversityOptimizationRequestSchema,
  portfolioDiversityOptimizationResultSchema,
  type PortfolioDiversityOptimizationAdapter,
} from "@boloes/lottery-contracts";
import {
  generateLotofacilPortfolio,
  lotofacilPortfolioDiversityOptimizationAdapter,
  LOTOFACIL_DEFINITION,
} from "@boloes/lottery-lotofacil";
import {
  DuplicatePortfolioDiversityCandidateError,
  InfeasiblePortfolioDiversityAllocationError,
  InvalidPortfolioDiversityRequestError,
  optimizePortfolioDiversity,
  PortfolioDiversityOptimizationCancelledError,
} from "@boloes/portfolio-engine";
import {
  portfolioDiversityOptimizationErrorRecord,
  portfolioDiversityOptimizationExitCode,
} from "../../apps/cli/src/portfolio-diversity-errors.js";
import { describe, expect, it, vi } from "vitest";

const overlapPool = [
  { numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
  { numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16] },
  { numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17] },
  { numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 19, 20] },
] as const;

const neutralRequest = (
  candidates: readonly { readonly numbers: readonly number[] }[] = overlapPool,
  targetCandidateCount = 3,
) => ({
  contractVersion: PORTFOLIO_DIVERSITY_OPTIMIZATION_CONTRACT_VERSION,
  algorithm: PORTFOLIO_DIVERSITY_OPTIMIZATION_ALGORITHM,
  lotteryDefinition: LOTOFACIL_DEFINITION,
  candidates,
  targetCandidateCount,
  structuralConstraint: { mode: "NEUTRAL" as const },
});

const structuralAllocation = (
  zeroExtremes: number,
  oneExtreme: number,
  twoExtremes: number,
  threeExtremes: number,
  fourPlusExtremes: number,
) => ({ zeroExtremes, oneExtreme, twoExtremes, threeExtremes, fourPlusExtremes });

function generatedPool(candidateCount: number) {
  return generateLotofacilPortfolio({
    lotteryDefinition: LOTOFACIL_DEFINITION,
    strategy: {
      id: "story-4.9-neutral",
      version: "1.0",
      lotteryId: "lotofacil",
      betSize: 15,
      mode: "NEUTRAL",
      statisticalLabel: "NEUTRAL",
      seed: "strategy-seed",
      requiresManualAcknowledgement: false,
    },
    parameters: {
      seed: `story-4.9-pool-${candidateCount}`,
      candidateCount,
    },
  }).candidates;
}

function runCli(input: unknown) {
  const directory = mkdtempSync(join(tmpdir(), "boloes-diversity-"));
  const inputPath = join(directory, "request.json");
  writeFileSync(inputPath, JSON.stringify(input));
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "optimize-diversity", "--input", inputPath],
    { cwd: process.cwd(), encoding: "utf8" },
  );
}

describe("Story 4.9 public contracts", () => {
  it("freezes the four public error codes and rejects undeclared request fields", () => {
    expect(portfolioDiversityOptimizationErrorCodeSchema.options).toEqual([
      "INVALID_PORTFOLIO_DIVERSITY_REQUEST",
      "DUPLICATE_PORTFOLIO_DIVERSITY_CANDIDATE",
      "INFEASIBLE_PORTFOLIO_DIVERSITY_ALLOCATION",
      "PORTFOLIO_DIVERSITY_OPTIMIZATION_CANCELLED",
    ]);
    expect(portfolioDiversityOptimizationRequestSchema.safeParse({
      ...neutralRequest(),
      history: [],
    }).success).toBe(false);
    expect(portfolioDiversityOptimizationRequestSchema.safeParse({
      ...neutralRequest(),
      targetCandidateCount: 5,
    }).success).toBe(false);
    expect(portfolioDiversityOptimizationRequestSchema.safeParse({
      ...neutralRequest(),
      candidates: [{ numbers: [...overlapPool[0].numbers].reverse() }],
      targetCandidateCount: 1,
    }).success).toBe(false);
    expect(portfolioDiversityOptimizationRequestSchema.safeParse({
      ...neutralRequest(),
      lotteryDefinition: { ...LOTOFACIL_DEFINITION, drawSize: 21 },
    }).success).toBe(false);
  });

  it("keeps result schemas strict and enforces canonical output invariants", async () => {
    const result = await optimizePortfolioDiversity(
      neutralRequest(),
      lotofacilPortfolioDiversityOptimizationAdapter,
    );
    expect(portfolioDiversityOptimizationResultSchema.safeParse({
      ...result,
      history: [],
    }).success).toBe(false);
    expect(portfolioDiversityOptimizationResultSchema.safeParse({
      ...result,
      candidates: [
        { numbers: [...result.candidates[0]!.numbers].reverse() },
        ...result.candidates.slice(1),
      ],
    }).success).toBe(false);

    expect(portfolioDiversityOptimizationResultSchema.safeParse({
      ...result,
      candidates: [...result.candidates].reverse(),
    }).success).toBe(false);

    const invalidProvenance = structuredClone(result);
    invalidProvenance.selectionOrder[0]!.provenance.inputIndex = 999;
    expect(portfolioDiversityOptimizationResultSchema.safeParse(invalidProvenance).success)
      .toBe(false);

    const invalidUniverse = structuredClone(result);
    const selectedKey = invalidUniverse.selectionOrder[0]!.candidate.numbers.join(",");
    invalidUniverse.selectionOrder[0]!.candidate.numbers[14] = 999;
    const finalCandidate = invalidUniverse.candidates.find(
      (candidate) => candidate.numbers.join(",") === selectedKey,
    )!;
    finalCandidate.numbers[14] = 999;
    expect(portfolioDiversityOptimizationResultSchema.safeParse(invalidUniverse).success)
      .toBe(false);

    const invalidHistogram = structuredClone(result);
    const histogram = invalidHistogram.selectionOrder[1]!.winningIncrementalHistogram!;
    const populatedIndex = histogram.findIndex((bucket) => bucket.count === 1);
    histogram[populatedIndex]!.count = 0;
    histogram[(populatedIndex + 1) % histogram.length]!.count = 1;
    expect(portfolioDiversityOptimizationResultSchema.safeParse(invalidHistogram).success)
      .toBe(false);
  });

  it("validates zero-work and regular progress semantics", () => {
    expect(portfolioDiversityOptimizationProgressSchema.parse({
      phase: "BUILD_OVERLAP_MATRIX",
      processedWork: 0,
      totalWork: 0,
      percent: 100,
      overallProcessedWork: 0,
      overallTotalWork: 0,
      overallPercent: 0,
    })).toBeTruthy();
    expect(portfolioDiversityOptimizationProgressSchema.safeParse({
      phase: "SELECT_CANDIDATES",
      processedWork: 1,
      totalWork: 2,
      percent: 51,
      overallProcessedWork: 7,
      overallTotalWork: 8,
      overallPercent: 87,
    }).success).toBe(false);
  });

  it("exposes the single shared linear intersection primitive", () => {
    expect(INTERSECTION_CARDINALITY_ALGORITHM_VERSION).toBe(
      "intersection-cardinality/1.0.0",
    );
    expect(intersectionCardinality([1, 3, 5, 7], [2, 3, 6, 7])).toBe(2);
  });
});

describe("deterministic greedy minimum-overlap selection", () => {
  it("uses the descending incremental histogram and canonical tie-breaking", async () => {
    const result = await optimizePortfolioDiversity(
      neutralRequest(),
      lotofacilPortfolioDiversityOptimizationAdapter,
    );

    expect(portfolioDiversityOptimizationResultSchema.parse(result)).toEqual(result);
    expect(result.selectionOrder.map((entry) => entry.candidate.numbers)).toEqual([
      overlapPool[0].numbers,
      overlapPool[3].numbers,
      overlapPool[2].numbers,
    ]);
    expect(result.candidates.map((candidate) => candidate.numbers)).toEqual([
      overlapPool[0].numbers,
      overlapPool[2].numbers,
      overlapPool[3].numbers,
    ]);
    expect(result.selectionOrder[1]!.winningIncrementalHistogram).toEqual(
      Array.from({ length: 15 }, (_, index) => ({
        intersectionSize: 14 - index,
        count: index === 2 ? 1 : 0,
      })),
    );
    expect(result).toMatchObject({
      selectionMode: "GREEDY_SUBSET",
      changed: true,
      globallyOptimal: false,
      probabilityClaimed: false,
      timeoutApplied: false,
      transient: true,
      persisted: false,
      frozen: false,
      coverageCalculated: false,
      portfolioStateChanged: false,
      work: {
        phases: [
          { phase: "BUILD_OVERLAP_MATRIX", totalWork: 6, processedWork: 6 },
          { phase: "SELECT_CANDIDATES", totalWork: 5, processedWork: 5 },
        ],
        overallTotalWork: 11,
        overallProcessedWork: 11,
      },
    });
  });

  it("is independent from input pool order except for recorded provenance", async () => {
    const reversed = [...overlapPool].reverse();
    const [first, second] = await Promise.all([
      optimizePortfolioDiversity(neutralRequest(), lotofacilPortfolioDiversityOptimizationAdapter),
      optimizePortfolioDiversity(neutralRequest(reversed), lotofacilPortfolioDiversityOptimizationAdapter),
    ]);

    expect(second.candidates).toEqual(first.candidates);
    expect(second.selectionOrder.map(({ candidate, provenance }) => ({
      candidate,
      canonicalPoolIndex: provenance.canonicalPoolIndex,
    }))).toEqual(first.selectionOrder.map(({ candidate, provenance }) => ({
      candidate,
      canonicalPoolIndex: provenance.canonicalPoolIndex,
    })));
    expect(second.selectionOrder.map((entry) => entry.provenance.inputIndex)).not.toEqual(
      first.selectionOrder.map((entry) => entry.provenance.inputIndex),
    );
  });

  it("breaks a complete histogram tie with the smallest canonical sequence", async () => {
    const first = overlapPool[0];
    const smallerTie = overlapPool[1];
    const largerTie = {
      numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17],
    } as const;
    const result = await optimizePortfolioDiversity(
      neutralRequest([largerTie, first, smallerTie], 2),
      lotofacilPortfolioDiversityOptimizationAdapter,
    );
    expect(result.selectionOrder.map((entry) => entry.candidate)).toEqual([
      first,
      smallerTie,
    ]);
  });

  it("uses explicit identity and singleton shortcuts without fabricated histograms", async () => {
    const progress: unknown[] = [];
    const [identity, singleton] = await Promise.all([
      optimizePortfolioDiversity(
        neutralRequest(overlapPool, overlapPool.length),
        lotofacilPortfolioDiversityOptimizationAdapter,
        { onProgress: (event) => progress.push(event) },
      ),
      optimizePortfolioDiversity(
        neutralRequest(overlapPool, 1),
        lotofacilPortfolioDiversityOptimizationAdapter,
      ),
    ]);

    expect(identity).toMatchObject({ selectionMode: "IDENTITY", changed: false });
    expect(identity.candidates).toEqual(overlapPool);
    expect(identity.selectionOrder.every(
      (entry) => entry.reason === "IDENTITY_SHORTCUT" && entry.winningIncrementalHistogram === null,
    )).toBe(true);
    expect(progress).toEqual([
      expect.objectContaining({
        phase: "BUILD_OVERLAP_MATRIX",
        processedWork: 0,
        totalWork: 0,
        percent: 100,
        overallPercent: 0,
      }),
      expect.objectContaining({
        phase: "SELECT_CANDIDATES",
        processedWork: 0,
        totalWork: 0,
        percent: 100,
        overallPercent: 100,
      }),
    ]);
    expect(singleton).toMatchObject({
      selectionMode: "LEXICOGRAPHIC_SINGLETON",
      changed: true,
      candidates: [overlapPool[0]],
      selectionOrder: [{
        candidate: overlapPool[0],
        reason: "SINGLE_TARGET",
        winningIncrementalHistogram: null,
      }],
    });
  });

  it("rejects invalid and duplicate candidates before progress with typed errors", async () => {
    const onProgress = vi.fn();
    await expect(optimizePortfolioDiversity(
      { ...neutralRequest(), candidates: [{ numbers: [1, 2, 3] }], targetCandidateCount: 1 },
      lotofacilPortfolioDiversityOptimizationAdapter,
      { onProgress },
    )).rejects.toBeInstanceOf(InvalidPortfolioDiversityRequestError);
    await expect(optimizePortfolioDiversity(
      neutralRequest([overlapPool[0], overlapPool[0]], 1),
      lotofacilPortfolioDiversityOptimizationAdapter,
      { onProgress },
    )).rejects.toBeInstanceOf(DuplicatePortfolioDiversityCandidateError);
    await expect(optimizePortfolioDiversity(
      {
        ...neutralRequest(overlapPool, 1),
        lotteryDefinition: { ...LOTOFACIL_DEFINITION, version: "2.0.0" },
      },
      lotofacilPortfolioDiversityOptimizationAdapter,
      { onProgress },
    )).rejects.toBeInstanceOf(InvalidPortfolioDiversityRequestError);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("does not infer structural groups in neutral mode", async () => {
    const adapter: PortfolioDiversityOptimizationAdapter = {
      ...lotofacilPortfolioDiversityOptimizationAdapter,
      classifyStructuralGroup: vi.fn(() => {
        throw new Error("must not classify");
      }),
      resolveStructuralTargets: vi.fn(() => {
        throw new Error("must not allocate");
      }),
    };
    const result = await optimizePortfolioDiversity(neutralRequest(), adapter);
    expect(adapter.classifyStructuralGroup).not.toHaveBeenCalled();
    expect(adapter.resolveStructuralTargets).not.toHaveBeenCalled();
    expect(result.structuralConstraint).toEqual({ mode: "NEUTRAL" });
    expect(result.componentVersions.structuralClassifierVersion).toBeNull();
  });

  it("preserves the explicit Lotofácil allocation by the existing largest-remainder rule", async () => {
    const allocation = structuralAllocation(20, 20, 20, 20, 20);
    const candidates = generateLotofacilPortfolio({
      lotteryDefinition: LOTOFACIL_DEFINITION,
      strategy: {
        id: "story-4.9-structural",
        version: "1.0",
        lotteryId: "lotofacil",
        betSize: 15,
        mode: "ADVANCED",
        structuralAllocation: allocation,
        statisticalLabel: "NEUTRAL",
        seed: "strategy-seed",
        requiresManualAcknowledgement: false,
      },
      parameters: { seed: "structural-pool", candidateCount: 10 },
    }).candidates;
    const result = await optimizePortfolioDiversity({
      ...neutralRequest(candidates, 7),
      structuralConstraint: {
        mode: "PRESERVE_EXPLICIT_ALLOCATION",
        allocation,
      },
    }, lotofacilPortfolioDiversityOptimizationAdapter);

    expect(result.structuralConstraint).toEqual({
      mode: "PRESERVE_EXPLICIT_ALLOCATION",
      groups: [
        { group: "ZERO_EXTREMES", requestedPercent: 20, targetCount: 2, selectedCount: 2 },
        { group: "ONE_EXTREME", requestedPercent: 20, targetCount: 2, selectedCount: 2 },
        { group: "TWO_EXTREMES", requestedPercent: 20, targetCount: 1, selectedCount: 1 },
        { group: "THREE_EXTREMES", requestedPercent: 20, targetCount: 1, selectedCount: 1 },
        { group: "FOUR_PLUS_EXTREMES", requestedPercent: 20, targetCount: 1, selectedCount: 1 },
      ],
    });
  });

  it("rejects an infeasible explicit allocation before progress", async () => {
    const candidates = generateLotofacilPortfolio({
      lotteryDefinition: LOTOFACIL_DEFINITION,
      strategy: {
        id: "story-4.9-one-band",
        version: "1.0",
        lotteryId: "lotofacil",
        betSize: 15,
        mode: "ADVANCED",
        structuralAllocation: structuralAllocation(100, 0, 0, 0, 0),
        statisticalLabel: "NEUTRAL",
        seed: "strategy-seed",
        requiresManualAcknowledgement: false,
      },
      parameters: { seed: "one-band-pool", candidateCount: 3 },
    }).candidates;
    const onProgress = vi.fn();
    await expect(optimizePortfolioDiversity({
      ...neutralRequest(candidates, 1),
      structuralConstraint: {
        mode: "PRESERVE_EXPLICIT_ALLOCATION",
        allocation: structuralAllocation(0, 100, 0, 0, 0),
      },
    }, lotofacilPortfolioDiversityOptimizationAdapter, { onProgress }))
      .rejects.toBeInstanceOf(InfeasiblePortfolioDiversityAllocationError);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("rejects a structural identity request whose full pool distribution differs", async () => {
    const candidates = generateLotofacilPortfolio({
      lotteryDefinition: LOTOFACIL_DEFINITION,
      strategy: {
        id: "story-4.9-identity-band",
        version: "1.0",
        lotteryId: "lotofacil",
        betSize: 15,
        mode: "ADVANCED",
        structuralAllocation: structuralAllocation(100, 0, 0, 0, 0),
        statisticalLabel: "NEUTRAL",
        seed: "strategy-seed",
        requiresManualAcknowledgement: false,
      },
      parameters: { seed: "identity-band-pool", candidateCount: 3 },
    }).candidates;
    const onProgress = vi.fn();
    await expect(optimizePortfolioDiversity({
      ...neutralRequest(candidates, candidates.length),
      structuralConstraint: {
        mode: "PRESERVE_EXPLICIT_ALLOCATION",
        allocation: structuralAllocation(0, 100, 0, 0, 0),
      },
    }, lotofacilPortfolioDiversityOptimizationAdapter, { onProgress }))
      .rejects.toBeInstanceOf(InfeasiblePortfolioDiversityAllocationError);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("supports cooperative cancellation before and during both work phases", async () => {
    const before = new AbortController();
    before.abort();
    const beforeProgress = vi.fn();
    await expect(optimizePortfolioDiversity(
      neutralRequest(),
      lotofacilPortfolioDiversityOptimizationAdapter,
      { signal: before.signal, onProgress: beforeProgress },
    )).rejects.toBeInstanceOf(PortfolioDiversityOptimizationCancelledError);
    expect(beforeProgress).not.toHaveBeenCalled();

    for (const phase of ["BUILD_OVERLAP_MATRIX", "SELECT_CANDIDATES"] as const) {
      const cancellation = new AbortController();
      await expect(optimizePortfolioDiversity(
        neutralRequest(),
        lotofacilPortfolioDiversityOptimizationAdapter,
        {
          signal: cancellation.signal,
          onProgress: (event) => {
            if (event.phase === phase && event.processedWork > 0) cancellation.abort();
          },
        },
      )).rejects.toBeInstanceOf(PortfolioDiversityOptimizationCancelledError);
    }
  });

  it("completes the bounded 1,000/999 worst path with exact work totals", async () => {
    const result = await optimizePortfolioDiversity(
      neutralRequest(generatedPool(1_000), 999),
      lotofacilPortfolioDiversityOptimizationAdapter,
    );
    expect(result.candidates).toHaveLength(999);
    expect(result.work).toEqual({
      phases: [
        { phase: "BUILD_OVERLAP_MATRIX", processedWork: 499_500, totalWork: 499_500 },
        { phase: "SELECT_CANDIDATES", processedWork: 499_499, totalWork: 499_499 },
      ],
      overallProcessedWork: 998_999,
      overallTotalWork: 998_999,
    });
  }, 30_000);
});

describe("portfolio optimize-diversity CLI", () => {
  it("keeps progress on stderr and writes only the final result to stdout", () => {
    const execution = runCli(neutralRequest(overlapPool, 1));
    expect(execution.status, execution.stderr).toBe(0);
    expect(JSON.parse(execution.stdout)).toMatchObject({
      selectionMode: "LEXICOGRAPHIC_SINGLETON",
      globallyOptimal: false,
      probabilityClaimed: false,
      timeoutApplied: false,
    });
    const progress = execution.stderr.trim().split("\n").map((line) => JSON.parse(line));
    expect(progress).toHaveLength(2);
    expect(progress.map((event) => event.phase)).toEqual([
      "BUILD_OVERLAP_MATRIX",
      "SELECT_CANDIDATES",
    ]);
  });

  it("maps preflight failures to one public JSONL error and exit 1", () => {
    const execution = runCli(neutralRequest([overlapPool[0], overlapPool[0]], 1));
    expect(execution.status).toBe(1);
    expect(execution.stdout).toBe("");
    expect(execution.stderr.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(execution.stderr)).toMatchObject({
      type: "error",
      code: "DUPLICATE_PORTFOLIO_DIVERSITY_CANDIDATE",
    });
  });

  it("maps all four public classes without a timeout/124 path", () => {
    const invalid = new InvalidPortfolioDiversityRequestError();
    const duplicate = new DuplicatePortfolioDiversityCandidateError(
      overlapPool[0].numbers,
      [0, 1],
    );
    const infeasible = new InfeasiblePortfolioDiversityAllocationError(
      "ZERO_EXTREMES",
      2,
      1,
    );
    const cancelled = new PortfolioDiversityOptimizationCancelledError();
    expect([invalid, duplicate, infeasible, cancelled].map(
      (error) => portfolioDiversityOptimizationErrorRecord(error).code,
    )).toEqual([
      "INVALID_PORTFOLIO_DIVERSITY_REQUEST",
      "DUPLICATE_PORTFOLIO_DIVERSITY_CANDIDATE",
      "INFEASIBLE_PORTFOLIO_DIVERSITY_ALLOCATION",
      "PORTFOLIO_DIVERSITY_OPTIMIZATION_CANCELLED",
    ]);
    expect([invalid, duplicate, infeasible, cancelled].map((error) => error.name)).toEqual([
      "InvalidPortfolioDiversityRequestError",
      "DuplicatePortfolioDiversityCandidateError",
      "InfeasiblePortfolioDiversityAllocationError",
      "PortfolioDiversityOptimizationCancelledError",
    ]);
    expect([invalid, duplicate, infeasible].map(portfolioDiversityOptimizationExitCode))
      .toEqual([1, 1, 1]);
    expect(portfolioDiversityOptimizationExitCode(cancelled)).toBe(130);
    expect(portfolioDiversityOptimizationExitCode(cancelled)).not.toBe(124);
  });

  it("converts SIGINT into exit 130 without partial stdout", async () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-diversity-sigint-"));
    const inputPath = join(directory, "request.json");
    writeFileSync(inputPath, JSON.stringify(neutralRequest(generatedPool(1_000), 999)));

    const outcome = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolveOutcome, rejectOutcome) => {
        const child = spawn(
          process.execPath,
          ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "optimize-diversity", "--input", inputPath],
          { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "";
        let stderr = "";
        let signalSent = false;
        child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
        child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
          stderr += chunk;
          if (!signalSent && stderr.includes("BUILD_OVERLAP_MATRIX")) {
            signalSent = child.kill("SIGINT");
          }
        });
        child.on("error", rejectOutcome);
        child.on("close", (code) => resolveOutcome({ code, stdout, stderr }));
      },
    );

    expect(outcome.code).toBe(130);
    expect(outcome.stdout).toBe("");
    const lines = outcome.stderr.trim().split("\n").map((line) => JSON.parse(line));
    expect(lines.at(-1)).toMatchObject({
      type: "error",
      code: "PORTFOLIO_DIVERSITY_OPTIMIZATION_CANCELLED",
    });
  }, 15_000);
});
