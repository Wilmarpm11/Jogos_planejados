import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyLotofacilResultSpecialType,
  createCohortDefinition,
  materializeCohort,
  persistDatasetImport,
  persistLotteryResult,
} from "@boloes/data-access";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const sourceUrl = "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx";
const numbers = [1, 2, 4, 5, 7, 11, 12, 15, 17, 18, 21, 22, 23, 24, 25];

function setup(path: string) {
  const snapshot = persistDatasetImport(path, { lotteryId: "lotofacil", sourceUrl, importedAt: "2026-08-30T12:00:00.000Z", rawContent: "source", parserVersion: "page/1", validations: ["ok"], status: "VALIDATED" }).snapshot!;
  return [3701, 3702, 3703].map((contestNumber) => persistLotteryResult(path, snapshot.id, { lotteryId: "lotofacil", contestNumber, drawDate: "2026-06-20", drawnNumbers: numbers, sourceUrl, parserVersion: "page/1", validations: ["ok"] }));
}

describe("cohort selection", () => {
  it("resolves all approved selectors by explicit draw identity", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-cohort-")), "app.sqlite");
    const draws = setup(path);
    const all = materializeCohort(path, createCohortDefinition(path, "lotofacil", { type: "ALL_DRAWS" }).id);
    const last = materializeCohort(path, createCohortDefinition(path, "lotofacil", { type: "LAST_N_DRAWS", n: 2 }).id);
    const range = materializeCohort(path, createCohortDefinition(path, "lotofacil", { type: "CONTEST_RANGE", startContest: 3702, endContest: 3703 }).id);
    classifyLotofacilResultSpecialType(path, draws[0]!.id, "LOTOFACIL_INDEPENDENCIA");
    const special = materializeCohort(path, createCohortDefinition(path, "lotofacil", { type: "SPECIAL_DRAW_TYPE", specialType: "LOTOFACIL_INDEPENDENCIA" }).id);

    expect(all.resolvedDrawIds).toEqual([draws[2]!.id, draws[1]!.id, draws[0]!.id]);
    expect(last.resolvedDrawIds).toEqual([draws[2]!.id, draws[1]!.id]);
    expect(range).toMatchObject({ resolvedMinContest: 3702, resolvedMaxContest: 3703, resolvedCount: 2 });
    expect(special.resolvedDrawIds).toEqual([draws[0]!.id]);
    expect(() => createCohortDefinition(path, "lotofacil", { type: "CONTEST_RANGE", startContest: 2, endContest: 1 })).toThrow();
    expect(() => createCohortDefinition(path, "lotofacil", { type: "LAST_N_DRAWS", n: 0 })).toThrow();
  });

  it("accepts decision-format selector files in the local CLI", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-cohort-cli-")); const path = join(directory, "app.sqlite"); setup(path);
    const selector = join(directory, "range.json"); writeFileSync(selector, JSON.stringify({ type: "CONTEST_RANGE", start_contest: 3701, end_contest: 3702 }));
    const created = spawnSync(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", "cohort", "create", "--lottery", "lotofacil", "--selector", selector, "--db", path], { cwd: process.cwd(), encoding: "utf8" });
    expect(created.status, created.stderr).toBe(0);
    const cohort = JSON.parse(created.stdout).cohort;
    const resolved = spawnSync(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", "cohort", "resolve", "--id", cohort.id, "--db", path], { cwd: process.cwd(), encoding: "utf8" });
    expect(resolved.status, resolved.stderr).toBe(0);
    expect(JSON.parse(resolved.stdout)).toMatchObject({ resolution: { resolvedCount: 2, resolvedMinContest: 3701, resolvedMaxContest: 3702 } });
  });

  it("rolls back a failed resolution insert without masking the database error", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-cohort-rollback-")), "app.sqlite");
    setup(path);
    const cohort = createCohortDefinition(path, "lotofacil", { type: "ALL_DRAWS" });
    const database = new Database(path);
    database.exec(`
      CREATE TRIGGER block_cohort_resolution_insert BEFORE INSERT ON cohort_resolutions
      BEGIN SELECT RAISE(ABORT, 'forced cohort resolution failure'); END;
    `);
    database.close();

    expect(() => materializeCohort(path, cohort.id)).toThrow("forced cohort resolution failure");
  });

  it("materializes only the newest version of each corrected contest", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-cohort-correction-")), "app.sqlite");
    const draws = setup(path);
    const correctedSnapshot = persistDatasetImport(path, {
      lotteryId: "lotofacil",
      sourceUrl,
      importedAt: "2026-08-30T13:00:00.000Z",
      rawContent: "corrected source",
      parserVersion: "page/1",
      validations: ["ok"],
      status: "VALIDATED",
    }).snapshot!;
    const corrected = persistLotteryResult(path, correctedSnapshot.id, {
      lotteryId: "lotofacil",
      contestNumber: 3703,
      drawDate: "2026-06-21",
      drawnNumbers: numbers,
      sourceUrl,
      parserVersion: "page/1",
      validations: ["corrected"],
    });
    const cohort = createCohortDefinition(path, "lotofacil", { type: "ALL_DRAWS" });

    expect(materializeCohort(path, cohort.id).resolvedDrawIds).toEqual([
      corrected.id,
      draws[1]!.id,
      draws[0]!.id,
    ]);
  });
});
