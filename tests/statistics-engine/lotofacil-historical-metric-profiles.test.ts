import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getLotofacilHistoricalMetricProfiles,
  persistDatasetImport,
  persistHistoricalMetricProfile,
  persistHistoricalMetricProfiles,
  persistLotteryResult,
} from "@boloes/data-access";
import { deriveLotofacilHistoricalMetricProfile } from "@boloes/statistics-engine";
import { describe, expect, it } from "vitest";

const sourceUrl = "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx";
const result = {
  lotteryId: "lotofacil",
  contestNumber: 3716,
  drawDate: "2026-06-20",
  drawnNumbers: [1, 2, 4, 5, 7, 11, 12, 15, 17, 18, 21, 22, 23, 24, 25],
  sourceUrl,
  parserVersion: "page/1",
  validations: ["ok"],
};

describe("Lotofácil historical metric profiles", () => {
  it("preserves snapshot provenance and reuses the same result and algorithm version", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-metric-profiles-")), "app.sqlite");
    const snapshot = persistDatasetImport(path, { lotteryId: "lotofacil", sourceUrl, importedAt: "2026-08-30T12:00:00.000Z", rawContent: "source", parserVersion: "page/1", validations: ["ok"], status: "VALIDATED" }).snapshot!;
    const ledger = persistLotteryResult(path, snapshot.id, result);
    const derived = deriveLotofacilHistoricalMetricProfile(ledger);
    const first = persistHistoricalMetricProfile(path, derived);
    const repeated = persistHistoricalMetricProfile(path, derived);
    const revised = persistHistoricalMetricProfile(path, { ...derived, metricEngineVersion: "lotofacil-metric-engine/2" });

    expect(repeated.id).toBe(first.id);
    expect(revised.id).not.toBe(first.id);
    expect(first).toMatchObject({ sourceResultId: ledger.id, sourceSnapshotId: snapshot.id, lotteryId: "lotofacil" });
    expect(first.profile).toMatchObject({ selectedNumbers: result.drawnNumbers, metrics: { sum: 207 } });
    expect(getLotofacilHistoricalMetricProfiles(path, 25)).toHaveLength(2);
    expect(() => persistHistoricalMetricProfile(path, { ...derived, sourceResultId: "7f5deedb-b558-4535-8869-b592c4d05ec4" })).toThrow("Resultado de origem inválido");
  });

  it("derives and queries an incomplete local window through the CLI", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-metric-cli-")), "app.sqlite");
    const snapshot = persistDatasetImport(path, { lotteryId: "lotofacil", sourceUrl, importedAt: "2026-08-30T12:00:00.000Z", rawContent: "source", parserVersion: "page/1", validations: ["ok"], status: "VALIDATED" }).snapshot!;
    persistLotteryResult(path, snapshot.id, result);
    const command = (args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", ...args], { cwd: process.cwd(), encoding: "utf8" });
    const derived = command(["data", "derive-lotofacil-profiles", "--size", "10", "--db", path]);
    expect(derived.status, derived.stderr).toBe(0);
    expect(JSON.parse(derived.stdout)).toMatchObject({ window: { size: 10, profileCount: 1 }, profiles: [{ sourceSnapshotId: snapshot.id }] });
    const queried = command(["data", "lotofacil-metric-profiles", "--size", "complete", "--db", path]);
    expect(queried.status, queried.stderr).toBe(0);
    expect(JSON.parse(queried.stdout)).toMatchObject({ window: { size: "complete", profileCount: 1 } });
  });

  it("does not persist a partial batch when any source result is invalid", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-metric-atomic-")), "app.sqlite");
    const snapshot = persistDatasetImport(path, { lotteryId: "lotofacil", sourceUrl, importedAt: "2026-08-30T12:00:00.000Z", rawContent: "source", parserVersion: "page/1", validations: ["ok"], status: "VALIDATED" }).snapshot!;
    const ledger = persistLotteryResult(path, snapshot.id, result);
    const derived = deriveLotofacilHistoricalMetricProfile(ledger);
    expect(() => persistHistoricalMetricProfiles(path, [derived, { ...derived, sourceResultId: "7f5deedb-b558-4535-8869-b592c4d05ec4" }])).toThrow("Resultado de origem inválido");
    expect(getLotofacilHistoricalMetricProfiles(path, "complete")).toEqual([]);
  });
});
