import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  auditBasicPortfolio,
  auditPortfolioIntersections,
  PairwisePortfolioAuditCancelledError,
} from "@boloes/audit-engine";
import {
  PAIRWISE_PORTFOLIO_AUDIT_ALGORITHM_VERSION,
  PAIRWISE_PORTFOLIO_AUDIT_MAX_CANDIDATES,
  pairwisePortfolioAuditRequestSchema,
} from "@boloes/lottery-contracts";
import { LOTOFACIL_DEFINITION } from "@boloes/lottery-lotofacil";
import { describe, expect, it, vi } from "vitest";

const firstGame = Array.from({ length: 15 }, (_, index) => index + 1);
const secondGame = [...Array.from({ length: 14 }, (_, index) => index + 1), 16];
const thirdGame = [...Array.from({ length: 13 }, (_, index) => index + 1), 16, 17];
const request = {
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
  const directory = mkdtempSync(join(tmpdir(), "boloes-pairwise-audit-"));
  const inputPath = join(directory, "request.json");
  writeFileSync(inputPath, JSON.stringify(input));
  return inputPath;
}

describe("pairwise portfolio intersection audit", () => {
  it("emits every unordered pair and a complete deterministic overlap histogram", async () => {
    const first = await auditPortfolioIntersections(request);
    const second = await auditPortfolioIntersections(request);

    expect(first).toEqual(second);
    expect(first.algorithmVersion).toBe(PAIRWISE_PORTFOLIO_AUDIT_ALGORITHM_VERSION);
    expect(first.intersections).toEqual([
      { candidateIndexes: [0, 1], intersectionSize: 14 },
      { candidateIndexes: [0, 2], intersectionSize: 13 },
      { candidateIndexes: [0, 3], intersectionSize: 15 },
      { candidateIndexes: [1, 2], intersectionSize: 14 },
      { candidateIndexes: [1, 3], intersectionSize: 14 },
      { candidateIndexes: [2, 3], intersectionSize: 13 },
    ]);
    expect(first.overlapHistogram).toHaveLength(16);
    expect(first.overlapHistogram.filter((bucket) => bucket.pairCount > 0)).toEqual([
      { intersectionSize: 13, pairCount: 2 },
      { intersectionSize: 14, pairCount: 3 },
      { intersectionSize: 15, pairCount: 1 },
    ]);
    expect(first.overlapHistogram.reduce((sum, bucket) => sum + bucket.pairCount, 0)).toBe(6);
    expect(first.overlapHistogram.reduce(
      (sum, bucket) => sum + (bucket.intersectionSize * bucket.pairCount),
      0,
    )).toBe(83);
    expect(first).toMatchObject({
      candidateCount: 4,
      totals: { expectedPairs: 6, processedPairs: 6 },
      transient: true,
      persisted: false,
      frozen: false,
      coverageCalculated: false,
      portfolioStateChanged: false,
    });
  });

  it("emits initial, monotonic and completed progress", async () => {
    const progress: Array<{ processedPairs: number; totalPairs: number; percent: number }> = [];

    await auditPortfolioIntersections(request, { onProgress: (event) => progress.push(event) });

    expect(progress[0]).toMatchObject({ processedPairs: 0, totalPairs: 6, percent: 0 });
    expect(progress.at(-1)).toMatchObject({ processedPairs: 6, totalPairs: 6, percent: 100 });
    expect(progress.every((event, index) => index === 0 || event.percent > progress[index - 1]!.percent)).toBe(true);
  });

  it("rejects cancellation before and during calculation without returning a result", async () => {
    const preCancelled = new AbortController();
    preCancelled.abort();
    await expect(auditPortfolioIntersections(request, { signal: preCancelled.signal }))
      .rejects.toBeInstanceOf(PairwisePortfolioAuditCancelledError);

    const duringCalculation = new AbortController();
    let lastProgress = 0;
    await expect(auditPortfolioIntersections(request, {
      signal: duringCalculation.signal,
      onProgress: (event) => {
        lastProgress = event.processedPairs;
        if (event.processedPairs > 0) duringCalculation.abort();
      },
    })).rejects.toMatchObject({ name: "AbortError", code: "PAIRWISE_PORTFOLIO_AUDIT_CANCELLED" });
    expect(lastProgress).toBeGreaterThan(0);
    expect(lastProgress).toBeLessThan(6);
  });

  it("accepts the 1,000-candidate ceiling and processes exactly 499,500 pairs", async () => {
    const ceilingRequest = {
      ...request,
      candidates: Array.from(
        { length: PAIRWISE_PORTFOLIO_AUDIT_MAX_CANDIDATES },
        () => ({ numbers: firstGame }),
      ),
    };

    const result = await auditPortfolioIntersections(ceilingRequest);

    expect(result.intersections).toHaveLength(499_500);
    expect(result.totals).toEqual({ expectedPairs: 499_500, processedPairs: 499_500 });
    expect(result.overlapHistogram[15]).toEqual({ intersectionSize: 15, pairCount: 499_500 });
  }, 20_000);

  it("rejects 1,001 candidates and invalid candidates before progress", async () => {
    const progress = vi.fn();
    const overLimitRequest = {
      ...request,
      candidates: Array.from(
        { length: PAIRWISE_PORTFOLIO_AUDIT_MAX_CANDIDATES + 1 },
        () => ({ numbers: firstGame }),
      ),
    };

    expect(pairwisePortfolioAuditRequestSchema.safeParse(overLimitRequest).success).toBe(false);
    await expect(auditPortfolioIntersections(overLimitRequest, { onProgress: progress })).rejects.toThrow();
    expect(progress).not.toHaveBeenCalled();

    await expect(auditPortfolioIntersections({
      ...request,
      candidates: [{ numbers: firstGame }, { numbers: [...firstGame.slice(0, 14), 26] }],
    }, { onProgress: progress })).rejects.toThrow("outside 1-25");
    expect(progress).not.toHaveBeenCalled();
  });

  it("keeps unrelated fields outside the strict contract and preserves the basic audit", async () => {
    expect(() => pairwisePortfolioAuditRequestSchema.parse({ ...request, history: [] })).toThrow();
    const before = auditBasicPortfolio(request);
    await auditPortfolioIntersections(request);
    expect(auditBasicPortfolio(request)).toEqual(before);
  });

  it("exposes progress on stderr and only the completed result on stdout", () => {
    const inputPath = writeRequest(request);
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "audit-intersections", "--input", inputPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    const progress = result.stderr.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(progress[0]).toMatchObject({ processedPairs: 0, totalPairs: 6, percent: 0 });
    expect(progress.at(-1)).toMatchObject({ processedPairs: 6, totalPairs: 6, percent: 100 });
    expect(JSON.parse(result.stdout)).toMatchObject({
      algorithmVersion: PAIRWISE_PORTFOLIO_AUDIT_ALGORITHM_VERSION,
      totals: { expectedPairs: 6, processedPairs: 6 },
      transient: true,
    });
  });

  it("rejects an over-limit CLI request before progress or partial stdout", () => {
    const inputPath = writeRequest({
      ...request,
      candidates: Array.from(
        { length: PAIRWISE_PORTFOLIO_AUDIT_MAX_CANDIDATES + 1 },
        () => ({ numbers: firstGame }),
      ),
    });
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "audit-intersections", "--input", inputPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("PAIRWISE_INTERSECTIONS");
    expect(result.stderr).toContain("Too big");
  });

  it("converts CLI SIGINT into cooperative cancellation without partial stdout", async () => {
    const inputPath = writeRequest({
      ...request,
      candidates: Array.from(
        { length: PAIRWISE_PORTFOLIO_AUDIT_MAX_CANDIDATES },
        () => ({ numbers: firstGame }),
      ),
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
        ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "audit-intersections", "--input", inputPath],
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
        if (!interrupted && stderr.includes('"processedPairs":0')) {
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
    expect(outcome.stderr).toContain("Pairwise portfolio audit cancelled.");
  }, 20_000);
});
