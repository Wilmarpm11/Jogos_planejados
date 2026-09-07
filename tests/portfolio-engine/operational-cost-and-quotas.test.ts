import { describe, expect, it } from "vitest";
import {
  lotofacilCatalogRecordSchema,
  OperationalCostAndQuotasError,
  type LotofacilCatalogRecord,
} from "@boloes/lottery-contracts";
import {
  calculateOperationalCostAndQuotaAllocation,
  calculateOperationalCostAndQuotas,
} from "@boloes/portfolio-engine";
import {
  LOTOFACIL_DEFINITION,
  lotofacilOperationalCostAndQuotasAdapter,
} from "@boloes/lottery-lotofacil";

const prices = [350, 5_600, 47_600, 285_600, 1_356_600, 5_426_400] as const;

function catalog(overrides: {
  readonly price15?: number;
  readonly minShares?: number;
  readonly maxShares?: number;
} = {}): LotofacilCatalogRecord {
  return lotofacilCatalogRecordSchema.parse({
    id: "00000000-0000-4000-8000-000000000410",
    sourceSnapshotId: "00000000-0000-4000-8000-000000000035",
    lotteryId: "lotofacil",
    sourceUrl: "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx",
    parserVersion: "lotofacil-caixa-page/1.0.0",
    validations: ["prices", "bolao-limits", "prize-tiers"],
    persistedAt: "2026-09-06T12:00:00.000Z",
    priceByBetSize: prices.map((priceInCents, index) => ({
      betSize: 15 + index,
      priceInCents: index === 0 ? overrides.price15 ?? priceInCents : priceInCents,
    })),
    bolaoLimits: prices.map((_, index) => ({
      betSize: 15 + index,
      minShares: overrides.minShares ?? 2,
      maxShares: overrides.maxShares ?? 100,
      maxGamesPerReceipt: 10,
    })),
    prizeTiers: [11, 12, 13, 14, 15],
  });
}

function game(size = 15, offset = 0): { numbers: number[] } {
  return { numbers: Array.from({ length: size }, (_, index) => index + 1 + offset) };
}

function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: "1.0",
    lotteryDefinition: LOTOFACIL_DEFINITION,
    contestNumber: 3_500,
    catalog: catalog(),
    purchasedBase: { type: "SOURCE_BETS", bets: [game()] },
    quotaIds: [2, 1],
    ...overrides,
  };
}

function calculate(overrides: Record<string, unknown> = {}) {
  return calculateOperationalCostAndQuotas(
    request(overrides),
    lotofacilOperationalCostAndQuotasAdapter,
  );
}

function expectCode(run: () => unknown, code: string): void {
  try {
    run();
    throw new Error("Expected operational-cost calculation to reject.");
  } catch (error) {
    expect(error).toBeInstanceOf(OperationalCostAndQuotasError);
    expect((error as OperationalCostAndQuotasError).code).toBe(code);
  }
}

describe("operational cost and quotas engine", () => {
  it("keeps the integer primitive modality-neutral", () => {
    expect(calculateOperationalCostAndQuotaAllocation({
      occurrenceCount: 2,
      unitPriceCents: 350,
      feeBps: 100,
      quotaIds: [20, 10, 30],
      minShares: 2,
      maxShares: 100,
    })).toEqual({
      officialCostCents: 700,
      feeCents: 7,
      totalCents: 707,
      baseQuotaCents: 235,
      remainderCents: 2,
      quotas: [
        { quotaId: 10, valueCents: 236, receivedRemainderCent: true },
        { quotaId: 20, valueCents: 236, receivedRemainderCent: true },
        { quotaId: 30, valueCents: 235, receivedRemainderCent: false },
      ],
    });
  });

  it.each([
    [0, 0, 350],
    [99, 3, 353],
    [100, 4, 354],
    [101, 4, 354],
    [10_000, 350, 700],
  ])("applies fee %i bps with exact HALF_UP", (feeBps, feeCents, totalCents) => {
    const result = calculate({ feeBps });
    expect(result.fee.feeCents).toBe(feeCents);
    expect(result.totalCents).toBe(totalCents);
  });

  it("normalizes omitted feeBps to zero", () => {
    const result = calculate();
    expect(result.fee.feeBps).toBe(0);
    expect(result.fee.feeCents).toBe(0);
    expect(result.totalCents).toBe(result.officialCostCents);
  });

  it("allocates floor values and ascending-ID remainder exactly", () => {
    const result = calculate({ quotaIds: [30, 10, 20] });
    expect(result.quotaAllocation).toMatchObject({
      quotaCount: 3,
      baseQuotaCents: 116,
      remainderCents: 2,
      quotas: [
        { quotaId: 10, valueCents: 117, receivedRemainderCent: true },
        { quotaId: 20, valueCents: 117, receivedRemainderCent: true },
        { quotaId: 30, valueCents: 116, receivedRemainderCent: false },
      ],
    });
    expect(result.quotaAllocation.quotas.reduce(
      (sum, quota) => sum + quota.valueCents,
      0,
    )).toBe(result.totalCents);
  });

  it("preserves duplicate occurrences and prices every occurrence once", () => {
    const duplicate = game();
    const result = calculate({
      purchasedBase: { type: "SOURCE_BETS", bets: [duplicate, duplicate] },
    });
    expect(result.purchasedBase.bets).toHaveLength(2);
    expect(result.officialCostCents).toBe(700);
  });

  it("satisfies fee and quota conservation properties over representative ranges", () => {
    for (const feeBps of [0, 1, 49, 50, 99, 100, 101, 999, 5_000, 10_000]) {
      for (const quotaCount of [2, 3, 7, 17, 100]) {
        const quotaIds = Array.from({ length: quotaCount }, (_, index) => quotaCount - index);
        const result = calculate({ feeBps, quotaIds });
        const expectedFee = Number(
          (350n * BigInt(feeBps) + 5_000n) / 10_000n,
        );
        expect(result.fee.feeCents).toBe(expectedFee);
        expect(result.quotaAllocation.quotas.reduce(
          (sum, quota) => sum + quota.valueCents,
          0,
        )).toBe(result.totalCents);
        expect(Math.max(...result.quotaAllocation.quotas.map(({ valueCents }) => valueCents)) -
          Math.min(...result.quotaAllocation.quotas.map(({ valueCents }) => valueCents))).toBeLessThanOrEqual(1);
      }
    }
  });

  it("rejects all stable public error classes at their preflight boundaries", () => {
    expectCode(() => calculate({ unexpected: true }), "INVALID_OPERATIONAL_COST_AND_QUOTAS_REQUEST");
    expectCode(() => calculate({
      lotteryDefinition: { ...LOTOFACIL_DEFINITION, id: "other" },
    }), "UNSUPPORTED_OPERATIONAL_COST_LOTTERY");
    expectCode(() => calculate({
      catalog: { ...catalog(), lotteryId: "other" },
    }), "INCOMPATIBLE_OPERATIONAL_COST_CATALOG");
    expectCode(() => calculate({
      purchasedBase: { type: "SOURCE_BETS", bets: [game()], expandedBets: [game()] },
    }), "AMBIGUOUS_PURCHASED_COST_BASE");
    expectCode(() => calculate({
      purchasedBase: { type: "SOURCE_BETS", bets: [{ numbers: [1, 1, ...game(13, 2).numbers] }] },
    }), "INVALID_PURCHASED_COST_BET");
    expectCode(() => calculate({
      purchasedBase: { type: "SOURCE_BETS", bets: [game(15), game(16)] },
    }), "HETEROGENEOUS_PURCHASED_COST_PORTFOLIO");
    expectCode(() => calculate({ feeBps: 1.5 }), "INVALID_SERVICE_FEE_BPS");
    expectCode(() => calculate({ quotaIds: [1, 1] }), "INVALID_QUOTA_IDS");
    expectCode(() => calculate({ quotaIds: [1] }), "QUOTA_COUNT_OUTSIDE_CAIXA_LIMITS");
    expectCode(() => calculate({
      catalog: catalog({ price15: 1 }),
      quotaIds: [1, 2],
    }), "ZERO_VALUE_QUOTA");
    expectCode(() => calculate({
      catalog: catalog({ price15: Number.MAX_SAFE_INTEGER }),
      purchasedBase: { type: "SOURCE_BETS", bets: [game(), game(15, 1)] },
    }), "OPERATIONAL_COST_MONETARY_OVERFLOW");
  });

  it("uses the normative error precedence when a request has multiple faults", () => {
    expectCode(() => calculate({
      unexpected: true,
      quotaIds: [1, 1],
    }), "INVALID_OPERATIONAL_COST_AND_QUOTAS_REQUEST");
    expectCode(() => calculate({
      feeBps: -1,
      catalog: { ...catalog(), lotteryId: "other" },
    }), "INVALID_SERVICE_FEE_BPS");
    expectCode(() => calculate({
      catalog: { ...catalog(), lotteryId: "other" },
      purchasedBase: { type: "SOURCE_BETS", bets: [game()], expandedBets: [game()] },
    }), "INCOMPATIBLE_OPERATIONAL_COST_CATALOG");
    expectCode(() => calculate({
      purchasedBase: { type: "SOURCE_BETS", bets: [game()], expandedBets: [game()] },
      quotaIds: [1, 1],
    }), "AMBIGUOUS_PURCHASED_COST_BASE");
  });
});
