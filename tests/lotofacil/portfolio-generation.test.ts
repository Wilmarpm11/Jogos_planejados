import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { portfolioGenerationRequestSchema } from "@boloes/lottery-contracts";
import {
  calculateLotofacilMetricProfile,
  classifyLotofacilStructuralProfile,
  generateLotofacilPortfolio,
  LOTOFACIL_DEFINITION,
  summarizeLotofacilStructuralProfile,
  validateLotofacilStructuralAllocation,
} from "@boloes/lottery-lotofacil";
import { describe, expect, it } from "vitest";

const neutralRequest = {
  lotteryDefinition: LOTOFACIL_DEFINITION,
  strategy: {
    id: "neutral", version: "1.0", lotteryId: "lotofacil", betSize: 15,
    mode: "NEUTRAL" as const, statisticalLabel: "NEUTRAL" as const,
    seed: "strategy-seed", requiresManualAcknowledgement: false,
  },
  parameters: { seed: "execution-seed", candidateCount: 6 },
};

function structuralBand(numbers: readonly number[]): string | null {
  const profile = calculateLotofacilMetricProfile(numbers);
  return summarizeLotofacilStructuralProfile(profile, classifyLotofacilStructuralProfile(profile)).band;
}

describe("Lotofácil deterministic portfolio generation", () => {
  it("reproduces a canonical, valid, non-repeating sequence from the same seed", () => {
    const first = generateLotofacilPortfolio(neutralRequest);
    const second = generateLotofacilPortfolio(neutralRequest);
    const third = generateLotofacilPortfolio({ ...neutralRequest, parameters: { ...neutralRequest.parameters, seed: "other-seed" } });

    expect(first).toEqual(second);
    expect(first.candidates).not.toEqual(third.candidates);
    expect(first.candidates.map((candidate) => candidate.numbers.join(","))).toEqual(
      [...first.candidates.map((candidate) => candidate.numbers.join(","))].sort((left, right) => left.localeCompare(right)),
    );
    expect(new Set(first.candidates.map((candidate) => candidate.numbers.join(","))).size).toBe(6);
    for (const candidate of first.candidates) {
      expect(candidate.numbers).toHaveLength(15);
      expect(candidate.numbers).toEqual([...candidate.numbers].sort((left, right) => left - right));
      expect(new Set(candidate.numbers).size).toBe(15);
      expect(candidate.numbers.every((number) => number >= 1 && number <= 25)).toBe(true);
    }
    expect(first).toMatchObject({ transient: true, persisted: false, frozen: false, coverageCalculated: false, probabilityClaimed: false });
  });

  it("applies the Lotofácil structural allocation only when the resolved strategy provides one", () => {
    const generated = generateLotofacilPortfolio({
      ...neutralRequest,
      strategy: {
        ...neutralRequest.strategy,
        id: "advanced", mode: "ADVANCED", structuralAllocation: {
          zeroExtremes: 80, oneExtreme: 20, twoExtremes: 0, threeExtremes: 0, fourPlusExtremes: 0,
        },
      },
      parameters: { seed: "allocation-seed", candidateCount: 10 },
    });
    const counts = generated.candidates.reduce<Record<string, number>>((all, candidate) => {
      const band = structuralBand(candidate.numbers);
      if (band) all[band] = (all[band] ?? 0) + 1;
      return all;
    }, {});

    expect(counts).toEqual({ ZERO_EXTREMES: 8, ONE_EXTREME: 2 });
  });

  it.each([
    { zeroExtremes: -10, oneExtreme: 110, twoExtremes: 0, threeExtremes: 0, fourPlusExtremes: 0 },
    { zeroExtremes: Number.NaN, oneExtreme: 100, twoExtremes: 0, threeExtremes: 0, fourPlusExtremes: 0 },
  ])("rejects negative and non-finite values at the reusable allocation boundary", (allocation) => {
    expect(() => validateLotofacilStructuralAllocation(allocation)).toThrow("não pode conter valores negativos ou não finitos");
  });

  it("accepts a mathematically complete fractional allocation with floating-point noise", () => {
    expect(() => validateLotofacilStructuralAllocation({
      zeroExtremes: 0.1,
      oneExtreme: 0.2,
      twoExtremes: 0.3,
      threeExtremes: 0.4,
      fourPlusExtremes: 99.00000000000001,
    })).not.toThrow();
  });

  it("keeps history out of the strict generation input and exposes a transient local CLI action", () => {
    expect(() => portfolioGenerationRequestSchema.parse({ ...neutralRequest, history: [] })).toThrow();
    const directory = mkdtempSync(join(tmpdir(), "boloes-portfolio-generation-"));
    const inputPath = join(directory, "request.json");
    writeFileSync(inputPath, JSON.stringify(neutralRequest));
    const result = spawnSync(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", "portfolio", "generate", "--input", inputPath], {
      cwd: process.cwd(), encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ transient: true, persisted: false, frozen: false, coverageCalculated: false, probabilityClaimed: false });
  });
});
