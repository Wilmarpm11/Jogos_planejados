import { describe, expect, it } from "vitest";
import {
  calculatePortfolioHash,
  canonicalizePortfolio,
  portfolioIdentityInputSchema,
} from "@boloes/domain-core";
import {
  OPERATIONAL_COST_AND_QUOTAS_ALGORITHM_VERSION,
  OPERATIONAL_COST_AND_QUOTAS_CANDIDATE_ORDERING_VERSION,
  OPERATIONAL_COST_AND_QUOTAS_CONTRACT_VERSION,
  generationRequestSchema,
  lotteryDefinitionSchema,
  approvedStrategyConfigSchema,
  lotofacilOperationalCostAndQuotasRequestSchema,
  operationalCostAndQuotasErrorCodeSchema,
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

  it("publishes the strict and versioned Story 4.10 request contract", () => {
    const catalog = {
      id: "00000000-0000-4000-8000-000000000410",
      sourceSnapshotId: "00000000-0000-4000-8000-000000000035",
      lotteryId: "lotofacil",
      sourceUrl: "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx",
      parserVersion: "lotofacil-caixa-page/1.0.0",
      validations: ["prices", "limits"],
      persistedAt: "2026-09-06T12:00:00.000Z",
      priceByBetSize: Array.from({ length: 6 }, (_, index) => ({
        betSize: 15 + index,
        priceInCents: 350 * (index + 1),
      })),
      bolaoLimits: Array.from({ length: 6 }, (_, index) => ({
        betSize: 15 + index,
        minShares: 2,
        maxShares: 100,
        maxGamesPerReceipt: 10,
      })),
      prizeTiers: [11, 12, 13, 14, 15],
    };
    const request = {
      contractVersion: OPERATIONAL_COST_AND_QUOTAS_CONTRACT_VERSION,
      lotteryDefinition: {
        id: "lotofacil",
        version: "1.0.0",
        totalNumbers: 25,
        drawSize: 15,
        minBetSize: 15,
        maxBetSize: 20,
      },
      contestNumber: 3_500,
      catalog,
      purchasedBase: {
        type: "SOURCE_BETS",
        bets: [{ numbers: Array.from({ length: 15 }, (_, index) => index + 1) }],
      },
      quotaIds: [1, 2],
    };

    expect(lotofacilOperationalCostAndQuotasRequestSchema.parse(request).feeBps).toBe(0);
    expect(OPERATIONAL_COST_AND_QUOTAS_ALGORITHM_VERSION).toBe(
      "operational-cost-and-quotas/1.0.0",
    );
    expect(OPERATIONAL_COST_AND_QUOTAS_CANDIDATE_ORDERING_VERSION).toBe(
      "ascii-bytewise-of-comma-joined-canonical-games/1.0.0",
    );
    expect(operationalCostAndQuotasErrorCodeSchema.options).toHaveLength(11);
    expect(() => lotofacilOperationalCostAndQuotasRequestSchema.parse({
      ...request,
      purchasedBase: {
        ...request.purchasedBase,
        bets: [{ ...request.purchasedBase.bets[0], unknown: true }],
      },
    })).toThrow();
    expect(() => lotofacilOperationalCostAndQuotasRequestSchema.parse({
      ...request,
      catalog: {
        ...catalog,
        priceByBetSize: [
          { ...catalog.priceByBetSize[0], unknown: true },
          ...catalog.priceByBetSize.slice(1),
        ],
      },
    })).toThrow();
  });
});
