import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  combinationRank,
  createCombinationRanker,
  forEachCombination,
} from "@boloes/combinatorics";
import {
  auditExactPortfolioCoverage,
  ExactCoverageAuditCancelledError,
  ExactCoverageAuditTimeoutError,
} from "@boloes/coverage-engine";
import {
  auditBasicPortfolio,
  auditPortfolioIntersections,
  auditPortfolioStructuralDistribution,
} from "@boloes/audit-engine";
import {
  EXACT_COVERAGE_AUDIT_ALGORITHM_VERSION,
  EXACT_COVERAGE_AUDIT_MAX_CANDIDATES,
  EXACT_COVERAGE_AUDIT_TIMEOUT_MS,
  EXACT_COVERAGE_TIERS,
  exactCoverageAuditRequestSchema,
  exactCoverageAuditResultSchema,
} from "@boloes/lottery-contracts";
import {
  LOTOFACIL_DEFINITION,
  LOTOFACIL_EXACT_COVERAGE_ADAPTER_VERSION,
  lotofacilExactCoverageAdapter,
  lotofacilPortfolioStructuralDistributionAdapter,
} from "@boloes/lottery-lotofacil";
import {
  exactCoverageAuditErrorRecord,
  exactCoverageAuditExitCode,
} from "../../apps/cli/src/coverage-errors.js";
import { describe, expect, it, vi } from "vitest";

const firstGame = Array.from({ length: 15 }, (_, index) => index + 1);
const secondGame = [...Array.from({ length: 14 }, (_, index) => index + 1), 16];
const request = {
  contractVersion: "1.0" as const,
  lotteryDefinition: LOTOFACIL_DEFINITION,
  candidates: [{ numbers: firstGame }],
};

function firstCanonicalCandidates(count: number): Array<{ numbers: number[] }> {
  const combination = Array.from({ length: LOTOFACIL_DEFINITION.drawSize }, (_, index) => index);
  const candidates: Array<{ numbers: number[] }> = [];
  while (candidates.length < count) {
    candidates.push({ numbers: combination.map((number) => number + 1) });
    let position = combination.length - 1;
    while (
      position >= 0 &&
      combination[position] === LOTOFACIL_DEFINITION.totalNumbers - combination.length + position
    ) position -= 1;
    if (position < 0) break;
    combination[position] = combination[position]! + 1;
    for (let index = position + 1; index < combination.length; index += 1) {
      combination[index] = combination[index - 1]! + 1;
    }
  }
  return candidates;
}

function bruteForceUniqueCoverage(candidates: readonly { numbers: readonly number[] }[]): number[] {
  const candidateSets = candidates.map(({ numbers }) => new Set(numbers.map((number) => number - 1)));
  const uniqueByTier = EXACT_COVERAGE_TIERS.map(() => 0);
  forEachCombination(LOTOFACIL_DEFINITION.totalNumbers, LOTOFACIL_DEFINITION.drawSize, (outcome) => {
    let maximumHits = 0;
    for (const candidate of candidateSets) {
      let hits = 0;
      for (const number of outcome) if (candidate.has(number)) hits += 1;
      maximumHits = Math.max(maximumHits, hits);
    }
    EXACT_COVERAGE_TIERS.forEach((tier, index) => {
      if (maximumHits >= tier.minimumHits) uniqueByTier[index]! += 1;
    });
  });
  return uniqueByTier;
}

function writeRequest(input: unknown): string {
  const directory = mkdtempSync(join(tmpdir(), "boloes-exact-coverage-"));
  const inputPath = join(directory, "request.json");
  writeFileSync(inputPath, JSON.stringify(input));
  return inputPath;
}

describe("combination ranking", () => {
  it("assigns every small-universe combination one dense deterministic rank", () => {
    const rank = createCombinationRanker(8, 4);
    const ranks: number[] = [];
    forEachCombination(8, 4, (combination) => ranks.push(rank(combination)));

    expect(new Set(ranks).size).toBe(70);
    expect(Math.min(...ranks)).toBe(0);
    expect(Math.max(...ranks)).toBe(69);
    expect(combinationRank(8, [0, 1, 2, 3])).toBe(0);
    expect(() => rank([0, 1, 1, 3])).toThrow("strictly increasing");
    expect(() => rank([0, 1, 2, 8])).toThrow("outside 0-7");
  });
});

describe("Lotofácil exact coverage audit", () => {
  it("reports the canonical gross formula and exact single-candidate union", async () => {
    const result = await auditExactPortfolioCoverage(request, lotofacilExactCoverageAdapter);

    expect(result).toMatchObject({
      algorithmVersion: EXACT_COVERAGE_AUDIT_ALGORITHM_VERSION,
      adapterVersion: LOTOFACIL_EXACT_COVERAGE_ADAPTER_VERSION,
      method: "EXACT_ENUMERATION",
      exact: true,
      absoluteError: 0,
      relativeError: { numerator: 0, denominator: 1 },
      universeSize: 3_268_760,
      betSize: 15,
      candidateCount: 1,
      timeoutMs: EXACT_COVERAGE_AUDIT_TIMEOUT_MS,
      transient: true,
      persisted: false,
      frozen: false,
      coverageCalculated: true,
      portfolioStateChanged: false,
    });
    expect(result.tiers).toEqual(EXACT_COVERAGE_TIERS.map((tier) => ({
      minimumHits: tier.minimumHits,
      grossCoveredOutcomes: tier.grossCoveredOutcomesPerCandidate,
      uniqueCoveredOutcomes: tier.grossCoveredOutcomesPerCandidate,
      repeatedCoveredOutcomes: 0,
      efficiency: { numerator: 1, denominator: 1 },
    })));
    expect(result.processedWork).toBe(result.totalWork);
  });

  it("counts duplicate gross occurrences without increasing the unique union", async () => {
    const result = await auditExactPortfolioCoverage({
      ...request,
      candidates: [{ numbers: firstGame }, { numbers: firstGame }],
    }, lotofacilExactCoverageAdapter);

    expect(result.tiers).toEqual(EXACT_COVERAGE_TIERS.map((tier) => ({
      minimumHits: tier.minimumHits,
      grossCoveredOutcomes: tier.grossCoveredOutcomesPerCandidate * 2,
      uniqueCoveredOutcomes: tier.grossCoveredOutcomesPerCandidate,
      repeatedCoveredOutcomes: tier.grossCoveredOutcomesPerCandidate,
      efficiency: { numerator: 1, denominator: 2 },
    })));
  });

  it("matches an independent exhaustive union for overlapping candidates", async () => {
    const candidates = [{ numbers: firstGame }, { numbers: secondGame }];
    const expectedUnique = bruteForceUniqueCoverage(candidates);
    const result = await auditExactPortfolioCoverage(
      { ...request, candidates },
      lotofacilExactCoverageAdapter,
    );

    expect(result.tiers.map((tier) => tier.uniqueCoveredOutcomes)).toEqual(expectedUnique);
    for (const tier of result.tiers) {
      expect(tier.uniqueCoveredOutcomes + tier.repeatedCoveredOutcomes)
        .toBe(tier.grossCoveredOutcomes);
    }
  });

  it("keeps request/result contracts strict, ordered and conservative", async () => {
    expect(exactCoverageAuditRequestSchema.safeParse({ ...request, history: [] }).success).toBe(false);
    const result = await auditExactPortfolioCoverage(request, lotofacilExactCoverageAdapter);
    expect(exactCoverageAuditResultSchema.safeParse({ ...result, strategy: {} }).success).toBe(false);
    expect(exactCoverageAuditResultSchema.safeParse({
      ...result,
      lottery: { id: "other-lottery", definitionVersion: "1.0.0" },
    }).success).toBe(false);
    expect(exactCoverageAuditResultSchema.safeParse({
      ...result,
      universeSize: result.universeSize + 1,
    }).success).toBe(false);
    expect(exactCoverageAuditResultSchema.safeParse({
      ...result,
      betSize: 16,
    }).success).toBe(false);
    expect(exactCoverageAuditResultSchema.safeParse({
      ...result,
      tiers: [...result.tiers].reverse(),
    }).success).toBe(false);
    expect(exactCoverageAuditResultSchema.safeParse({
      ...result,
      tiers: result.tiers.slice(0, 1),
    }).success).toBe(false);
    expect(exactCoverageAuditResultSchema.safeParse({
      ...result,
      tiers: result.tiers.map((tier, index) => index === 1
        ? { ...tier, grossCoveredOutcomes: tier.grossCoveredOutcomes + 1 }
        : tier),
    }).success).toBe(false);
    expect(exactCoverageAuditResultSchema.safeParse({
      ...result,
      tiers: result.tiers.map((tier, index) => index === 0
        ? { ...tier, repeatedCoveredOutcomes: 1 }
        : tier),
    }).success).toBe(false);
  });

  it("reproduces the frozen 286-candidate exact regression", async () => {
    const result = await auditExactPortfolioCoverage({
      ...request,
      candidates: firstCanonicalCandidates(286),
    }, lotofacilExactCoverageAdapter);

    expect(result.tiers.map((tier) => tier.uniqueCoveredOutcomes)).toEqual([
      286, 8_866, 93_808, 471_328,
    ]);
  }, 20_000);

  it("accepts 1,000 candidates within the hard timeout", async () => {
    const startedAt = performance.now();
    const result = await auditExactPortfolioCoverage({
      ...request,
      candidates: firstCanonicalCandidates(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES),
    }, lotofacilExactCoverageAdapter);

    expect(performance.now() - startedAt).toBeLessThan(EXACT_COVERAGE_AUDIT_TIMEOUT_MS);
    expect(result.candidateCount).toBe(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES);
    expect(result.totalWork).toBe(62_744_760);
  }, 35_000);

  it("rejects 1,001, unsupported definitions and expanded bets before progress", async () => {
    const progress = vi.fn();
    const overLimit = {
      ...request,
      candidates: firstCanonicalCandidates(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES + 1),
    };
    expect(exactCoverageAuditRequestSchema.safeParse(overLimit).success).toBe(false);
    await expect(auditExactPortfolioCoverage(overLimit, lotofacilExactCoverageAdapter, { onProgress: progress }))
      .rejects.toThrow();
    expect(progress).not.toHaveBeenCalled();

    await expect(auditExactPortfolioCoverage({
      ...request,
      lotteryDefinition: { ...LOTOFACIL_DEFINITION, version: "tampered" },
    }, lotofacilExactCoverageAdapter, { onProgress: progress })).rejects.toThrow("No exact coverage adapter");
    expect(progress).not.toHaveBeenCalled();

    await expect(auditExactPortfolioCoverage({
      ...request,
      candidates: [{ numbers: Array.from({ length: 16 }, (_, index) => index + 1) }],
    }, lotofacilExactCoverageAdapter, { onProgress: progress })).rejects.toThrow("supports only 15-number bets");
    expect(progress).not.toHaveBeenCalled();
  });

  it("emits initial, strictly monotonic and completed progress", async () => {
    const progress: Array<{ processedWork: number; totalWork: number; percent: number }> = [];
    await auditExactPortfolioCoverage(request, lotofacilExactCoverageAdapter, {
      onProgress: (event) => progress.push(event),
    });

    expect(progress[0]).toMatchObject({ processedWork: 0, percent: 0 });
    expect(progress.at(-1)).toMatchObject({ processedWork: progress[0]!.totalWork, percent: 100 });
    expect(progress.every((event, index) => (
      index === 0 || event.processedWork > progress[index - 1]!.processedWork
    ))).toBe(true);
  });

  it("cancels cooperatively and times out with typed errors and no result", async () => {
    const cancellation = new AbortController();
    await expect(auditExactPortfolioCoverage(request, lotofacilExactCoverageAdapter, {
      signal: cancellation.signal,
      onProgress: (event) => {
        if (event.processedWork === 0) cancellation.abort();
      },
    })).rejects.toBeInstanceOf(ExactCoverageAuditCancelledError);

    let clockCalls = 0;
    await expect(auditExactPortfolioCoverage(request, lotofacilExactCoverageAdapter, {
      now: () => (++clockCalls >= 3 ? EXACT_COVERAGE_AUDIT_TIMEOUT_MS : 0),
    })).rejects.toMatchObject({ name: "TimeoutError", code: "COVERAGE_TIMEOUT" });
  });

  it("preserves the 4.3-4.5 audits without adding coverage to them", async () => {
    const regressionRequest = {
      ...request,
      candidates: [{ numbers: firstGame }, { numbers: secondGame }],
    };
    expect(auditBasicPortfolio(regressionRequest).coverageCalculated).toBe(false);
    expect((await auditPortfolioIntersections(regressionRequest)).coverageCalculated).toBe(false);
    expect((await auditPortfolioStructuralDistribution(
      regressionRequest,
      lotofacilPortfolioStructuralDistributionAdapter,
    )).coverageCalculated).toBe(false);
  });

  it("maps cancellation and timeout to the documented CLI exit codes", () => {
    expect(exactCoverageAuditExitCode(new ExactCoverageAuditCancelledError())).toBe(130);
    expect(exactCoverageAuditExitCode(new ExactCoverageAuditTimeoutError())).toBe(124);
    expect(exactCoverageAuditExitCode(new Error("invalid"))).toBe(1);
    expect(exactCoverageAuditErrorRecord(new ExactCoverageAuditTimeoutError())).toMatchObject({
      type: "error",
      code: "COVERAGE_TIMEOUT",
    });
  });

  it("writes JSONL progress only to stderr and the final CLI result only to stdout", () => {
    const inputPath = writeRequest(request);
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "audit-coverage", "--input", inputPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    const progress = result.stderr
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[0]).toMatchObject({ phase: "MARK_COVERED_OUTCOMES", processedWork: 0, percent: 0 });
    expect(progress.at(-1)).toMatchObject({ phase: "COUNT_UNIQUE_OUTCOMES", percent: 100 });
    expect(JSON.parse(result.stdout)).toMatchObject({ method: "EXACT_ENUMERATION", candidateCount: 1 });
  });

  it("converts CLI SIGINT into exit 130 without partial stdout", async () => {
    const inputPath = writeRequest({
      ...request,
      candidates: firstCanonicalCandidates(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES),
    });
    const outcome = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "audit-coverage", "--input", inputPath],
        { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      let interrupted = false;
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => { stdout += chunk; });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
        if (!interrupted && stderr.includes('"processedWork":0')) {
          interrupted = true;
          child.kill("SIGINT");
        }
      });
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });

    expect(outcome.code).toBe(130);
    expect(outcome.stdout).toBe("");
    expect(outcome.stderr).toContain("Exact coverage audit cancelled.");
  }, 20_000);
});
