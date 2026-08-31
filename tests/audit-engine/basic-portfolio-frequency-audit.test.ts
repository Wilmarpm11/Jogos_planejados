import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditBasicPortfolio } from "@boloes/audit-engine";
import { basicPortfolioAuditRequestSchema } from "@boloes/lottery-contracts";
import { LOTOFACIL_DEFINITION } from "@boloes/lottery-lotofacil";
import { describe, expect, it } from "vitest";

const firstGame = Array.from({ length: 15 }, (_, index) => index + 1);
const secondGame = [...Array.from({ length: 14 }, (_, index) => index + 1), 16];
const request = {
  contractVersion: "1.0" as const,
  lotteryDefinition: LOTOFACIL_DEFINITION,
  candidates: [{ numbers: firstGame }, { numbers: secondGame }, { numbers: firstGame }],
};

describe("basic portfolio frequency audit", () => {
  it("reports all canonical Lotofácil number and pair frequencies deterministically", () => {
    const first = auditBasicPortfolio(request);
    const second = auditBasicPortfolio(request);

    expect(first).toEqual(second);
    expect(first.numberFrequencies).toHaveLength(25);
    expect(first.pairFrequencies).toHaveLength(300);
    expect(first.numberFrequencies.slice(0, 16)).toEqual([
      ...Array.from({ length: 14 }, (_, index) => ({ number: index + 1, count: 3 })),
      { number: 15, count: 2 },
      { number: 16, count: 1 },
    ]);
    expect(first.numberFrequencies.slice(16).every((item) => item.count === 0)).toBe(true);
    expect(first.pairFrequencies[0]).toEqual({ numbers: [1, 2], count: 3 });
    expect(first.pairFrequencies.find((item) => item.numbers[0] === 1 && item.numbers[1] === 15)).toEqual({ numbers: [1, 15], count: 2 });
    expect(first.pairFrequencies.find((item) => item.numbers[0] === 1 && item.numbers[1] === 16)).toEqual({ numbers: [1, 16], count: 1 });
    expect(first.pairFrequencies.at(-1)).toEqual({ numbers: [24, 25], count: 0 });
  });

  it("reports duplicate games without removing them and verifies combinatorial totals", () => {
    const result = auditBasicPortfolio(request);

    expect(result.duplicateGames).toEqual([{ numbers: firstGame, occurrences: 2 }]);
    expect(result).toMatchObject({
      betSize: 15,
      candidateCount: 3,
      valid: true,
      totals: {
        numberOccurrences: 45,
        expectedNumberOccurrences: 45,
        pairOccurrences: 315,
        expectedPairOccurrences: 315,
      },
      transient: true,
      persisted: false,
      frozen: false,
      coverageCalculated: false,
      portfolioStateChanged: false,
    });
  });

  it.each([
    { name: "internal duplicate", numbers: [...Array.from({ length: 14 }, (_, index) => index + 1), 14], message: "duplicate number" },
    { name: "outside universe", numbers: [...Array.from({ length: 14 }, (_, index) => index + 1), 26], message: "outside 1-25" },
    { name: "non-canonical order", numbers: [2, 1, ...Array.from({ length: 13 }, (_, index) => index + 3)], message: "canonical ascending order" },
    { name: "inconsistent size", numbers: Array.from({ length: 16 }, (_, index) => index + 1), message: "exactly 15 numbers" },
  ])("rejects $name with an explicit error", ({ numbers, message }) => {
    expect(() => auditBasicPortfolio({ ...request, candidates: [{ numbers: firstGame }, { numbers }] })).toThrow(message);
  });

  it("keeps history and unrelated workflow fields outside the strict input contract", () => {
    expect(() => basicPortfolioAuditRequestSchema.parse({ ...request, history: [] })).toThrow();
    expect(() => basicPortfolioAuditRequestSchema.parse({ ...request, coverage: {} })).toThrow();
  });

  it.each([0, -1])("rejects non-positive candidate number %i at the public schema boundary", (number) => {
    const numbers = [number, ...firstGame.slice(1)];

    expect(basicPortfolioAuditRequestSchema.safeParse({ ...request, candidates: [{ numbers }] }).success).toBe(false);
  });

  it("exposes the same transient diagnostic through the local CLI", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-basic-audit-"));
    const inputPath = join(directory, "request.json");
    writeFileSync(inputPath, JSON.stringify(request));

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "audit-basic", "--input", inputPath],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(output).toMatchObject({ candidateCount: 3, valid: true, transient: true, persisted: false });
    expect(output).not.toHaveProperty("intersections");
    expect(output).not.toHaveProperty("coverage");
    expect(output).not.toHaveProperty("optimization");
    expect(output).not.toHaveProperty("cost");
    expect(output).not.toHaveProperty("probability");
  });
});
