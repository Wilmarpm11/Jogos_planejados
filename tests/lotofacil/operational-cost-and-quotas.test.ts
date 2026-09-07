import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  lotofacilCatalogRecordSchema,
  lotofacilOperationalCostAndQuotasResultSchema,
  validateLotofacilOperationalCostAndQuotasResult,
} from "@boloes/lottery-contracts";
import { calculateOperationalCostAndQuotas } from "@boloes/portfolio-engine";
import {
  LOTOFACIL_CANONICAL_GAME_ORDER_VERSION,
  LOTOFACIL_DEFINITION,
  LOTOFACIL_OPERATIONAL_COST_CANDIDATE_ORDERING_VERSION,
  compareLotofacilOperationalCostGames,
  lotofacilOperationalCostAndQuotasAdapter,
} from "@boloes/lottery-lotofacil";

const prices = [350, 5_600, 47_600, 285_600, 1_356_600, 5_426_400] as const;

const catalog = lotofacilCatalogRecordSchema.parse({
  id: "00000000-0000-4000-8000-000000000410",
  sourceSnapshotId: "00000000-0000-4000-8000-000000000035",
  lotteryId: "lotofacil",
  sourceUrl: "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx",
  parserVersion: "lotofacil-caixa-page/1.0.0",
  validations: ["prices", "bolao-limits", "prize-tiers"],
  persistedAt: "2026-09-06T12:00:00.000Z",
  priceByBetSize: prices.map((priceInCents, index) => ({
    betSize: 15 + index,
    priceInCents,
  })),
  bolaoLimits: prices.map((_, index) => ({
    betSize: 15 + index,
    minShares: 2,
    maxShares: 100,
    maxGamesPerReceipt: 10,
  })),
  prizeTiers: [11, 12, 13, 14, 15],
});

function game(size = 15, offset = 0): { numbers: number[] } {
  return { numbers: Array.from({ length: size }, (_, index) => index + 1 + offset) };
}

function request(purchasedBase: Record<string, unknown> = {
  type: "SOURCE_BETS",
  bets: [game()],
}) {
  return {
    contractVersion: "1.0",
    lotteryDefinition: LOTOFACIL_DEFINITION,
    contestNumber: 3_500,
    catalog,
    purchasedBase,
    quotaIds: [2, 1],
  };
}

function runCli(args: readonly string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "apps/cli/src/index.ts", ...args],
    { cwd: process.cwd(), encoding: "utf8" },
  );
}

describe("Lotofácil operational cost and quotas integration", () => {
  it.each(prices.map((price, index) => [15 + index, price] as const))(
    "prices a SOURCE_BETS occurrence of size %i from its own catalog entry",
    (betSize, expectedPrice) => {
      const result = calculateOperationalCostAndQuotas(
        request({ type: "SOURCE_BETS", bets: [game(betSize)] }),
        lotofacilOperationalCostAndQuotasAdapter,
      );
      expect(result.purchasedBase).toMatchObject({
        type: "SOURCE_BETS",
        betSize,
        unitPriceCents: expectedPrice,
      });
      expect(result.officialCostCents).toBe(expectedPrice);
    },
  );

  it("prices only the expanded 15-number occurrences and preserves duplicates", () => {
    const first = game();
    const second = { numbers: [...first.numbers.slice(0, 14), 16] };
    const result = calculateOperationalCostAndQuotas(
      request({ type: "EXPANDED_SIMPLE_BETS", bets: [second, first, first] }),
      lotofacilOperationalCostAndQuotasAdapter,
    );
    expect(result.purchasedBase.type).toBe("EXPANDED_SIMPLE_BETS");
    expect(result.purchasedBase.betSize).toBe(15);
    expect(result.purchasedBase.bets).toEqual([first, first, second]);
    expect(result.officialCostCents).toBe(3 * prices[0]);
  });

  it("uses the Story 4.10 bytewise order without changing the Story 4.9 version", () => {
    const source = readFileSync("packages/lotteries/lotofacil/src/index.ts", "utf8");
    const comparatorStart = source.indexOf("export function compareLotofacilOperationalCostGames");
    const comparatorEnd = source.indexOf("/** Lotofácil pricing", comparatorStart);
    const implementation = source.slice(comparatorStart, comparatorEnd);
    expect(implementation).not.toContain("localeCompare");
    expect(implementation).not.toContain("Intl.Collator");
    expect(LOTOFACIL_OPERATIONAL_COST_CANDIDATE_ORDERING_VERSION).toBe(
      "ascii-bytewise-of-comma-joined-canonical-games/1.0.0",
    );
    expect(LOTOFACIL_CANONICAL_GAME_ORDER_VERSION).toBe(
      "locale-compare-of-comma-joined-canonical-games/1.0.0",
    );

    const first = game().numbers;
    const second = [...first.slice(0, 14), 16];
    expect(compareLotofacilOperationalCostGames(first, second)).toBeLessThan(0);
    expect(compareLotofacilOperationalCostGames(second, first)).toBeGreaterThan(0);
    expect(compareLotofacilOperationalCostGames(first, [...first])).toBe(0);
  });

  it("is deterministic across input orders and keeps complete catalog provenance", () => {
    const first = game();
    const second = { numbers: [...first.numbers.slice(0, 14), 16] };
    const left = calculateOperationalCostAndQuotas(
      { ...request({ type: "SOURCE_BETS", bets: [second, first] }), quotaIds: [9, 2] },
      lotofacilOperationalCostAndQuotasAdapter,
    );
    const right = calculateOperationalCostAndQuotas(
      { ...request({ type: "SOURCE_BETS", bets: [first, second] }), quotaIds: [2, 9] },
      lotofacilOperationalCostAndQuotasAdapter,
    );
    expect(right).toEqual(left);
    expect(left.catalogProvenance).toEqual({
      catalogRecordId: catalog.id,
      sourceSnapshotId: catalog.sourceSnapshotId,
      sourceUrl: catalog.sourceUrl,
      parserVersion: catalog.parserVersion,
      validations: catalog.validations,
      persistedAt: catalog.persistedAt,
    });
  });

  it("rejects unknown nested result fields and request/result mismatches", () => {
    const parsedRequest = request();
    const result = calculateOperationalCostAndQuotas(
      parsedRequest,
      lotofacilOperationalCostAndQuotasAdapter,
    );
    expect(lotofacilOperationalCostAndQuotasResultSchema.safeParse({
      ...result,
      fee: { ...result.fee, unknown: true },
    }).success).toBe(false);
    expect(() => validateLotofacilOperationalCostAndQuotasResult(
      parsedRequest as never,
      { ...result, officialCostCents: result.officialCostCents + 1 },
    )).toThrow();
  });

  it("emits one JSON result on stdout and nothing on stderr", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-cost-cli-"));
    const inputPath = join(directory, "request.json");
    writeFileSync(inputPath, JSON.stringify(request()));
    const cli = runCli(["portfolio", "calculate-cost-and-quotas", "--input", inputPath]);
    expect(cli.status, cli.stderr).toBe(0);
    expect(cli.stderr).toBe("");
    expect(String(cli.stdout).trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(String(cli.stdout))).toMatchObject({
      contractVersion: "1.0",
      officialCostCents: 350,
      persisted: false,
      paymentPerformed: false,
    });
  });

  it.each([
    ["missing --input", ["portfolio", "calculate-cost-and-quotas"]],
    ["unreadable input", ["portfolio", "calculate-cost-and-quotas", "--input", "/not/found.json"]],
  ])("keeps stdout empty and emits one JSONL error for %s", (_, args) => {
    const cli = runCli(args);
    expect(cli.status).toBe(1);
    expect(cli.stdout).toBe("");
    expect(String(cli.stderr).trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(String(cli.stderr))).toMatchObject({
      type: "error",
      code: "INVALID_OPERATIONAL_COST_AND_QUOTAS_REQUEST",
    });
  });

  it("reports malformed JSON only on stderr", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-cost-cli-invalid-"));
    const inputPath = join(directory, "request.json");
    writeFileSync(inputPath, "{");
    const cli = runCli(["portfolio", "calculate-cost-and-quotas", "--input", inputPath]);
    expect(cli.status).toBe(1);
    expect(cli.stdout).toBe("");
    expect(String(cli.stderr).trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(String(cli.stderr))).toMatchObject({
      type: "error",
      code: "INVALID_OPERATIONAL_COST_AND_QUOTAS_REQUEST",
    });
  });

  it("preserves a typed domain error in the CLI JSONL envelope", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-cost-cli-fee-"));
    const inputPath = join(directory, "request.json");
    writeFileSync(inputPath, JSON.stringify({ ...request(), feeBps: 10_001 }));
    const cli = runCli(["portfolio", "calculate-cost-and-quotas", "--input", inputPath]);
    expect(cli.status).toBe(1);
    expect(cli.stdout).toBe("");
    expect(JSON.parse(String(cli.stderr))).toMatchObject({
      type: "error",
      code: "INVALID_SERVICE_FEE_BPS",
    });
  });
});
