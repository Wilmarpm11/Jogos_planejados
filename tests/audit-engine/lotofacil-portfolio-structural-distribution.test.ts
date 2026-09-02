import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  auditBasicPortfolio,
  auditPortfolioIntersections,
  auditPortfolioStructuralDistribution,
  PortfolioStructuralDistributionAuditCancelledError,
  validatePortfolioAuditCandidates,
} from "@boloes/audit-engine";
import {
  PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_ALGORITHM_VERSION,
  STRUCTURAL_BAND_ORDER,
  portfolioStructuralDistributionAuditRequestSchema,
  portfolioStructuralDistributionAuditResultSchema,
  type PortfolioStructuralDistributionAdapter,
  type StructuralBand,
} from "@boloes/lottery-contracts";
import {
  LOTOFACIL_DEFINITION,
  LOTOFACIL_METRIC_ENGINE_VERSION,
  LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION,
  calculateLotofacilMetricProfile,
  classifyLotofacilStructuralProfile,
  lotofacilPortfolioStructuralDistributionAdapter,
  summarizeLotofacilStructuralProfile,
} from "@boloes/lottery-lotofacil";
import { describe, expect, it, vi } from "vitest";

const stubDefinition = {
  id: "stub-lottery",
  version: "1.0.0",
  totalNumbers: 10,
  drawSize: 2,
  minBetSize: 2,
  maxBetSize: 2,
};

const stubBandByFirstNumber: Readonly<Record<number, StructuralBand>> = {
  1: "ZERO_EXTREMES",
  3: "ONE_EXTREME",
  5: "TWO_EXTREMES",
  7: "THREE_EXTREMES",
  9: "FOUR_PLUS_EXTREMES",
};

const stubAdapter: PortfolioStructuralDistributionAdapter = {
  lotteryId: stubDefinition.id,
  betSize: 2,
  metricEngineVersion: "stub-metrics/1.0.0",
  classifierVersion: "stub-classifier/1.0.0",
  supportsDefinition(definition) {
    return definition.id === stubDefinition.id &&
      definition.version === stubDefinition.version &&
      definition.totalNumbers === stubDefinition.totalNumbers &&
      definition.drawSize === stubDefinition.drawSize &&
      definition.minBetSize === stubDefinition.minBetSize &&
      definition.maxBetSize === stubDefinition.maxBetSize;
  },
  summarize(numbers) {
    const band = stubBandByFirstNumber[numbers[0]!] ?? "ZERO_EXTREMES";
    return {
      applicable: true,
      extremeCount: STRUCTURAL_BAND_ORDER.indexOf(band),
      band,
      isCentralCore: null,
    };
  },
};

const stubRequest = {
  contractVersion: "1.0" as const,
  lotteryDefinition: stubDefinition,
  candidates: [
    { numbers: [1, 2] },
    { numbers: [1, 2] },
    { numbers: [3, 4] },
    { numbers: [5, 6] },
    { numbers: [5, 7] },
    { numbers: [5, 8] },
    { numbers: [9, 10] },
  ],
};

const firstGame = Array.from({ length: 15 }, (_, index) => index + 1);
const secondGame = [...Array.from({ length: 14 }, (_, index) => index + 1), 16];
const thirdGame = [...Array.from({ length: 13 }, (_, index) => index + 1), 16, 17];
const lotofacilRequest = {
  contractVersion: "1.0" as const,
  lotteryDefinition: LOTOFACIL_DEFINITION,
  candidates: [
    { numbers: firstGame },
    { numbers: secondGame },
    { numbers: thirdGame },
    { numbers: firstGame },
  ],
};

function writeRequest(input: unknown): string {
  const directory = mkdtempSync(join(tmpdir(), "boloes-structural-distribution-"));
  const inputPath = join(directory, "request.json");
  writeFileSync(inputPath, JSON.stringify(input));
  return inputPath;
}

describe("portfolio structural distribution audit", () => {
  it("keeps the exported canonical validator safe for an empty direct call", () => {
    expect(() => validatePortfolioAuditCandidates(stubDefinition, []))
      .toThrow("requires at least one candidate");
  });

  it("emits all canonical buckets in order with exact reduced frequencies", async () => {
    const first = await auditPortfolioStructuralDistribution(stubRequest, stubAdapter);
    const second = await auditPortfolioStructuralDistribution(stubRequest, stubAdapter);

    expect(first).toEqual(second);
    expect(first.algorithmVersion).toBe(PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_ALGORITHM_VERSION);
    expect(first.buckets).toEqual([
      { band: "ZERO_EXTREMES", count: 2, frequency: { numerator: 2, denominator: 7 } },
      { band: "ONE_EXTREME", count: 1, frequency: { numerator: 1, denominator: 7 } },
      { band: "TWO_EXTREMES", count: 3, frequency: { numerator: 3, denominator: 7 } },
      { band: "THREE_EXTREMES", count: 0, frequency: { numerator: 0, denominator: 1 } },
      { band: "FOUR_PLUS_EXTREMES", count: 1, frequency: { numerator: 1, denominator: 7 } },
    ]);
    expect(first.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(first.candidateCount);
    expect(first).toMatchObject({
      metricEngineVersion: stubAdapter.metricEngineVersion,
      classifierVersion: stubAdapter.classifierVersion,
      candidateCount: 7,
      transient: true,
      persisted: false,
      frozen: false,
      coverageCalculated: false,
      portfolioStateChanged: false,
    });
    expect(first).not.toHaveProperty("summaries");
    expect(first).not.toHaveProperty("centralCore");
    expect(first).not.toHaveProperty("coverage");
  });

  it("keeps request and result contracts strict and enforces conservation, order and fractions", async () => {
    expect(portfolioStructuralDistributionAuditRequestSchema.safeParse({ ...stubRequest, history: [] }).success).toBe(false);
    const result = await auditPortfolioStructuralDistribution(stubRequest, stubAdapter);
    expect(portfolioStructuralDistributionAuditResultSchema.safeParse({ ...result, strategy: {} }).success).toBe(false);
    expect(portfolioStructuralDistributionAuditResultSchema.safeParse({
      ...result,
      buckets: [...result.buckets].reverse(),
    }).success).toBe(false);
    expect(portfolioStructuralDistributionAuditResultSchema.safeParse({
      ...result,
      buckets: result.buckets.map((bucket, index) => index === 0
        ? { ...bucket, frequency: { numerator: 1, denominator: 2 } }
        : bucket),
    }).success).toBe(false);
  });

  it("counts duplicate candidates independently and accepts more than 1,000 candidates", async () => {
    const candidates = Array.from({ length: 1_001 }, () => ({ numbers: [1, 2] }));
    const result = await auditPortfolioStructuralDistribution(
      { ...stubRequest, candidates },
      stubAdapter,
    );

    expect(result.candidateCount).toBe(1_001);
    expect(result.buckets[0]).toEqual({
      band: "ZERO_EXTREMES",
      count: 1_001,
      frequency: { numerator: 1, denominator: 1 },
    });
  });

  it("handles a single candidate with reduced one and zero frequencies", async () => {
    const result = await auditPortfolioStructuralDistribution(
      { ...stubRequest, candidates: [{ numbers: [3, 4] }] },
      stubAdapter,
    );

    expect(result.buckets).toEqual([
      { band: "ZERO_EXTREMES", count: 0, frequency: { numerator: 0, denominator: 1 } },
      { band: "ONE_EXTREME", count: 1, frequency: { numerator: 1, denominator: 1 } },
      { band: "TWO_EXTREMES", count: 0, frequency: { numerator: 0, denominator: 1 } },
      { band: "THREE_EXTREMES", count: 0, frequency: { numerator: 0, denominator: 1 } },
      { band: "FOUR_PLUS_EXTREMES", count: 0, frequency: { numerator: 0, denominator: 1 } },
    ]);
  });

  it("composes the canonical Lotofácil metric engine, classifier and summary", async () => {
    for (const candidate of lotofacilRequest.candidates) {
      const profile = calculateLotofacilMetricProfile(candidate.numbers);
      const classification = classifyLotofacilStructuralProfile(profile);
      expect(lotofacilPortfolioStructuralDistributionAdapter.summarize(candidate.numbers)).toEqual(
        summarizeLotofacilStructuralProfile(profile, classification),
      );
    }

    const result = await auditPortfolioStructuralDistribution(
      lotofacilRequest,
      lotofacilPortfolioStructuralDistributionAdapter,
    );
    expect(result).toMatchObject({
      metricEngineVersion: LOTOFACIL_METRIC_ENGINE_VERSION,
      classifierVersion: LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION,
      lottery: { id: "lotofacil", definitionVersion: LOTOFACIL_DEFINITION.version },
      betSize: 15,
      candidateCount: 4,
    });
  });

  it("rejects unsupported modality and Lotofácil expanded bets before progress", async () => {
    const progress = vi.fn();
    await expect(auditPortfolioStructuralDistribution({
      ...lotofacilRequest,
      lotteryDefinition: { ...LOTOFACIL_DEFINITION, id: "other-lottery" },
    }, lotofacilPortfolioStructuralDistributionAdapter, { onProgress: progress }))
      .rejects.toThrow("No structural distribution adapter");
    expect(progress).not.toHaveBeenCalled();

    await expect(auditPortfolioStructuralDistribution({
      ...lotofacilRequest,
      lotteryDefinition: { ...LOTOFACIL_DEFINITION, version: "tampered-definition" },
    }, lotofacilPortfolioStructuralDistributionAdapter, { onProgress: progress }))
      .rejects.toThrow("does not support this lottery definition");
    expect(progress).not.toHaveBeenCalled();

    await expect(auditPortfolioStructuralDistribution({
      ...lotofacilRequest,
      candidates: [{ numbers: Array.from({ length: 16 }, (_, index) => index + 1) }],
    }, lotofacilPortfolioStructuralDistributionAdapter, { onProgress: progress }))
      .rejects.toThrow("supports only 15-number bets");
    expect(progress).not.toHaveBeenCalled();
  });

  it("emits initial, monotonic and completed progress", async () => {
    const progress: Array<{ processedCandidates: number; totalCandidates: number; percent: number }> = [];
    await auditPortfolioStructuralDistribution(stubRequest, stubAdapter, {
      onProgress: (event) => progress.push(event),
    });

    expect(progress[0]).toMatchObject({ processedCandidates: 0, totalCandidates: 7, percent: 0 });
    expect(progress.at(-1)).toMatchObject({ processedCandidates: 7, totalCandidates: 7, percent: 100 });
    expect(progress.every((event, index) => index === 0 || event.percent > progress[index - 1]!.percent)).toBe(true);
  });

  it("rejects cancellation before and during batches without returning a partial result", async () => {
    const preCancelled = new AbortController();
    preCancelled.abort();
    await expect(auditPortfolioStructuralDistribution(stubRequest, stubAdapter, { signal: preCancelled.signal }))
      .rejects.toBeInstanceOf(PortfolioStructuralDistributionAuditCancelledError);

    const duringCalculation = new AbortController();
    const largeRequest = {
      ...stubRequest,
      candidates: Array.from({ length: 1_001 }, () => ({ numbers: [1, 2] })),
    };
    await expect(auditPortfolioStructuralDistribution(largeRequest, stubAdapter, {
      signal: duringCalculation.signal,
      onProgress: (event) => {
        if (event.processedCandidates > 0) duringCalculation.abort();
      },
    })).rejects.toMatchObject({
      name: "AbortError",
      code: "PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_CANCELLED",
    });
  });

  it("preserves the basic and pairwise audit behavior", async () => {
    const before = auditBasicPortfolio(lotofacilRequest);
    await auditPortfolioStructuralDistribution(
      lotofacilRequest,
      lotofacilPortfolioStructuralDistributionAdapter,
    );
    expect(auditBasicPortfolio(lotofacilRequest)).toEqual(before);
    const pairwise = await auditPortfolioIntersections(lotofacilRequest);
    expect(pairwise.totals).toEqual({ expectedPairs: 6, processedPairs: 6 });
  });

  it("writes progress only to stderr and the completed CLI result only to stdout", () => {
    const inputPath = writeRequest(lotofacilRequest);
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "audit-structural-distribution", "--input", inputPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    const progress = result.stderr.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(progress[0]).toMatchObject({ phase: "STRUCTURAL_DISTRIBUTION", processedCandidates: 0, percent: 0 });
    expect(progress.at(-1)).toMatchObject({ processedCandidates: 4, percent: 100 });
    expect(JSON.parse(result.stdout)).toMatchObject({ candidateCount: 4, transient: true });
  });

  it("rejects unsupported CLI modality before progress or partial stdout", () => {
    const inputPath = writeRequest({
      ...lotofacilRequest,
      lotteryDefinition: { ...LOTOFACIL_DEFINITION, id: "other-lottery" },
    });
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "audit-structural-distribution", "--input", inputPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("STRUCTURAL_DISTRIBUTION");
    expect(result.stderr).toContain("No structural distribution adapter");
  });

  it("converts CLI SIGINT into cooperative cancellation without partial stdout", async () => {
    const inputPath = writeRequest({
      ...lotofacilRequest,
      candidates: Array.from({ length: 5_000 }, () => ({ numbers: firstGame })),
    });

    const outcome = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
      signalSent: boolean;
      stdout: string;
      stderr: string;
    }>((resolve) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "audit-structural-distribution", "--input", inputPath],
        { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      let interrupted = false;
      let signalSent = false;
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => { stdout += chunk; });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
        if (!interrupted && stderr.includes('"processedCandidates":0')) {
          interrupted = true;
          signalSent = child.exitCode === null && child.signalCode === null && child.kill("SIGINT");
        }
      });
      child.on("close", (code, signal) => resolve({ code, signal, signalSent, stdout, stderr }));
    });

    expect(outcome.signalSent).toBe(true);
    expect(outcome.signal).toBeNull();
    expect(outcome.code).toBe(130);
    expect(outcome.stdout).toBe("");
    expect(outcome.stderr).toContain("Portfolio structural distribution audit cancelled.");
  }, 20_000);
});
