import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getLotofacilResultByContest,
  getLotofacilResultWindow,
  persistDatasetImport,
  persistLotteryResult,
} from "@boloes/data-access";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const input = (content: string) => ({ lotteryId: "lotofacil" as const, sourceUrl: "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx", importedAt: "2026-08-30T12:00:00.000Z", rawContent: content, parserVersion: "page/1", validations: ["ok"], status: "VALIDATED" as const });
const result = { lotteryId: "lotofacil", contestNumber: 3716, drawDate: "2026-06-20", drawnNumbers: [1, 2, 4, 5, 7, 11, 12, 15, 17, 18, 21, 22, 23, 24, 25], sourceUrl: "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx", parserVersion: "page/1", validations: ["ok"] };

describe("Lotofácil result ledger", () => {
  it("keeps versions by snapshot and rejects duplicate contest in the same snapshot", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-ledger-")), "app.sqlite");
    const first = persistDatasetImport(path, input("first")).snapshot!;
    const record = persistLotteryResult(path, first.id, result);
    expect(getLotofacilResultByContest(path, 3716)?.id).toBe(record.id);
    expect(() => persistLotteryResult(path, first.id, result)).toThrow();
    const corrected = persistDatasetImport(path, input("corrected")).snapshot!;
    const correctedRecord = persistLotteryResult(path, corrected.id, { ...result, drawnNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] });
    expect(correctedRecord.sourceSnapshotId).toBe(corrected.id);
    expect(getLotofacilResultWindow(path, "complete").map((entry) => entry.id)).toEqual([correctedRecord.id]);

    expect(() => persistLotteryResult(path, corrected.id, { ...result, contestNumber: 0 } as never)).toThrow();
    const database = new Database(path, { readonly: true });
    expect(database.prepare("SELECT COUNT(*) AS count FROM lottery_result_ledger").get()).toEqual({ count: 2 });
    database.close();
  });

  it("returns only permitted deterministic historical windows with snapshot provenance", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-history-window-")), "app.sqlite");
    const snapshot = persistDatasetImport(path, input("window")).snapshot!;
    for (let contestNumber = 3701; contestNumber <= 3712; contestNumber += 1) {
      persistLotteryResult(path, snapshot.id, { ...result, contestNumber });
    }

    const ten = getLotofacilResultWindow(path, 10);
    expect(ten).toHaveLength(10);
    expect(ten.map((entry) => entry.contestNumber)).toEqual([3712, 3711, 3710, 3709, 3708, 3707, 3706, 3705, 3704, 3703]);
    expect(ten.every((entry) => entry.sourceSnapshotId === snapshot.id)).toBe(true);
    expect(getLotofacilResultWindow(path, 25)).toHaveLength(12);
    expect(getLotofacilResultWindow(path, "complete")).toHaveLength(12);
    expect(() => getLotofacilResultWindow(path, 15 as never)).toThrow();

    const cli = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "data", "lotofacil-window", "--size", "10", "--db", path],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(cli.status, cli.stderr).toBe(0);
    const cliOutput = JSON.parse(cli.stdout);
    expect(cliOutput.window).toEqual({ size: 10, resultCount: 10 });
    expect(cliOutput.results[0]).toMatchObject({ contestNumber: 3712, sourceSnapshotId: snapshot.id });

    const invalidCli = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "data", "lotofacil-window", "--size", "15", "--db", path],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(invalidCli.status).toBe(1);
    expect(invalidCli.stderr).toContain("Informe --size");
  });
});
