import { describe, expect, it } from "vitest";
import {
  calculatePortfolioHash,
  canonicalizePortfolio,
  portfolioIdentityInputSchema,
} from "@boloes/domain-core";
import {
  generationRequestSchema,
  lotteryDefinitionSchema,
  approvedStrategyConfigSchema,
} from "@boloes/lottery-contracts";

const lottery = lotteryDefinitionSchema.parse({
  id: "future-lottery",
  version: "1.0",
  totalNumbers: 25,
  drawSize: 15,
  minBetSize: 15,
  maxBetSize: 20,
});

const strategy = approvedStrategyConfigSchema.parse({
  id: "neutral",
  version: "1.0",
  status: "PRODUCTION",
  mode: "NEUTRAL",
  parameters: {},
});

describe("domain contracts", () => {
  it("creates deterministic identity independently of game ordering", () => {
    const first = {
      lotteryId: "future-lottery",
      lotteryVersion: "1.0",
      strategyVersion: "1.0",
      games: [
        [3, 1, 2],
        [7, 6, 5],
      ],
    };
    const second = {
      ...first,
      games: [
        [5, 7, 6],
        [2, 3, 1],
      ],
    };

    expect(canonicalizePortfolio(first)).toBe(canonicalizePortfolio(second));
    expect(calculatePortfolioHash(first)).toBe(calculatePortfolioHash(second));
    expect(calculatePortfolioHash(first)).toHaveLength(64);
  });

  it("rejects duplicate numbers in a canonical game", () => {
    expect(() =>
      portfolioIdentityInputSchema.parse({
        lotteryId: "future-lottery",
        lotteryVersion: "1.0",
        strategyVersion: "1.0",
        games: [[1, 1]],
      }),
    ).toThrow();
  });

  it("keeps raw history outside the generation contract", () => {
    const request = generationRequestSchema.parse({
      contractVersion: "1.0",
      lotteryDefinition: lottery,
      approvedStrategy: strategy,
      parameters: { seed: "seed", gameCount: 2, stakeSize: 15 },
    });

    expect(Object.keys(request)).not.toContain("history");
    expect(Object.keys(request)).toEqual([
      "contractVersion",
      "lotteryDefinition",
      "approvedStrategy",
      "parameters",
    ]);

    expect(() =>
      generationRequestSchema.parse({
        contractVersion: "1.0",
        lotteryDefinition: lottery,
        approvedStrategy: strategy,
        parameters: { seed: "seed", gameCount: 2, stakeSize: 15 },
        history: [{ contest: 1 }],
      }),
    ).toThrow();
  });
});
