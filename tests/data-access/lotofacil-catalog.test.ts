import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getLatestLotofacilCatalog, persistDatasetImport, persistLotofacilCatalog } from "@boloes/data-access";
import { lotofacilCatalogSchema } from "@boloes/lottery-contracts";
import { parseLotofacilCaixaCatalog } from "@boloes/result-ingestion";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const page = `Bolão\n15|1|2|7|R$ 4,50|R$ 14,00|R$ 35,00|10\n16|16|2|35|R$ 4,50|R$ 56,00|R$ 560,00|10\n17|136|2|40|R$ 11,90|R$ 476,00|R$ 4.760,00|10\n18|816|2|50|R$ 57,12|R$ 2.856,00|R$ 28.560,00|10\n19|3876|2|85|R$ 159,60|R$ 13.566,00|R$ 122.094,00|9\n20|15504|2|100|R$ 542,64|R$ 54.264,00|R$ 217.056,00|4\nLoterias Online\nTabela de preços\n15|R$ 3,50\n16|R$ 56,00\n17|R$ 476,00\n18|R$ 2.856,00\n19|R$ 13.566,00\n20|R$ 54.264,00\nProbabilidade\n11 acertos\n12 acertos\n13 acertos\n14 acertos\n15 acertos`;

describe("Lotofácil catalog snapshot", () => {
  it("stores the parsed catalog only when linked to a valid snapshot", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-catalog-")), "app.sqlite");
    const imported = persistDatasetImport(path, { lotteryId: "lotofacil", sourceUrl: "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx", importedAt: "2026-08-30T12:00:00.000Z", rawContent: "page", parserVersion: "page/1", validations: ["ok"], status: "VALIDATED" });
    const record = persistLotofacilCatalog(path, imported.snapshot!.id, parseLotofacilCaixaCatalog(page));
    expect(record.priceByBetSize[0]).toEqual({ betSize: 15, priceInCents: 350 });
    expect(getLatestLotofacilCatalog(path)?.id).toBe(record.id);
    const cli = spawnSync(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", "data", "latest-lotofacil-catalog", "--db", path], { cwd: process.cwd(), encoding: "utf8" });
    expect(cli.status, String(cli.stderr)).toBe(0);
    expect(JSON.parse(String(cli.stdout)).catalog.id).toBe(record.id);
  });

  it("converts decimal prices to exact integer cents", () => {
    const catalog = parseLotofacilCaixaCatalog(page.replace("15|R$ 3,50", "15|R$ 0,07"));
    expect(catalog.priceByBetSize[0]).toEqual({ betSize: 15, priceInCents: 7 });
  });

  it("accepts the official números wording for prize tiers", () => {
    const officialWording = page.replace(/(1[1-5]) acertos/g, "$1 números");
    expect(parseLotofacilCaixaCatalog(officialWording).prizeTiers).toEqual([11, 12, 13, 14, 15]);
  });

  it("validates the catalog before inserting it", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-catalog-validation-")), "app.sqlite");
    const imported = persistDatasetImport(path, { lotteryId: "lotofacil", sourceUrl: "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx", importedAt: "2026-08-30T12:00:00.000Z", rawContent: "page", parserVersion: "page/1", validations: ["ok"], status: "VALIDATED" });
    const catalog = parseLotofacilCaixaCatalog(page);

    expect(() => persistLotofacilCatalog(path, imported.snapshot!.id, {
      ...catalog,
      priceByBetSize: [{ ...catalog.priceByBetSize[0]!, priceInCents: 3.5 }, ...catalog.priceByBetSize.slice(1)],
    } as never)).toThrow();
    const database = new Database(path, { readonly: true });
    expect(database.prepare("SELECT COUNT(*) AS count FROM lottery_catalogs").get()).toEqual({ count: 0 });
    database.close();
  });

  it("rejects duplicate price bet sizes even when the catalog still has six entries", () => {
    const catalog = parseLotofacilCaixaCatalog(page);
    const duplicatedPrices = catalog.priceByBetSize.map((entry, index) =>
      index === catalog.priceByBetSize.length - 1 ? { ...entry, betSize: 15 } : entry,
    );

    expect(lotofacilCatalogSchema.safeParse({ ...catalog, priceByBetSize: duplicatedPrices }).success).toBe(false);
  });

  it("rejects bolão limits when a supported bet size is missing", () => {
    const catalog = parseLotofacilCaixaCatalog(page);
    const limitsWithoutBetSize18 = catalog.bolaoLimits.map((entry) =>
      entry.betSize === 18 ? { ...entry, betSize: 17 } : entry,
    );

    expect(lotofacilCatalogSchema.safeParse({ ...catalog, bolaoLimits: limitsWithoutBetSize18 }).success).toBe(false);
  });

  it("rejects duplicate prize tiers when a supported tier is missing", () => {
    const catalog = parseLotofacilCaixaCatalog(page);

    expect(lotofacilCatalogSchema.safeParse({ ...catalog, prizeTiers: [11, 12, 13, 14, 14] }).success).toBe(false);
  });
});
