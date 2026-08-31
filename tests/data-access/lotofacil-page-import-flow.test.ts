import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapDatabase, getLatestValidDatasetSnapshot } from "@boloes/data-access";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const validPage = `<h2>Resultado Concurso 3716 (20/06/2026)</h2><ul><li>01</li><li>02</li><li>04</li><li>05</li><li>07</li><li>11</li><li>12</li><li>15</li><li>17</li><li>18</li><li>21</li><li>22</li><li>23</li><li>24</li><li>25</li></ul><p>Estimativa de prêmio</p>`;

interface CliResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runImport(page: string, path: string): CliResult {
  const input = `${path}.html`;
  writeFileSync(input, page);
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "apps/cli/src/index.ts", "data", "import-lotofacil-page", "--input", input, "--db", path],
    { cwd: process.cwd(), encoding: "utf8" },
  ) as CliResult;
}

describe("Lotofácil page import flow", () => {
  it("creates a snapshot only for a valid local page", () => {
    const path = join(mkdtempSync(join(tmpdir(), "boloes-page-import-")), "app.sqlite");
    const imported = runImport(validPage, path);
    expect(imported.status, imported.stderr).toBe(0);
    expect(JSON.parse(imported.stdout)).toMatchObject({ result: { contestNumber: 3716 }, snapshot: { status: "VALIDATED" } });

    const invalid = runImport("<h2>Resultado Concurso {{resultado.numero}}</h2>", path);
    expect(invalid.status, invalid.stderr).toBe(0);
    expect(JSON.parse(invalid.stdout)).toMatchObject({ result: null, snapshot: null, dataImport: { status: "INVALID" } });
    expect(getLatestValidDatasetSnapshot(path, "lotofacil")?.dataImportId).toBe(JSON.parse(imported.stdout).dataImport.id);
  });

  it("reports an unreadable input as a controlled CLI failure", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-page-import-missing-"));
    const missingInput = join(directory, "missing.html");
    const path = join(directory, "app.sqlite");
    const imported = spawnSync(
      process.execPath,
      ["--import", "tsx", "apps/cli/src/index.ts", "data", "import-lotofacil-page", "--input", missingInput, "--db", path],
      { cwd: process.cwd(), encoding: "utf8" },
    ) as CliResult;

    expect(imported.status).toBe(1);
    expect(imported.stdout).toBe("");
    expect(imported.stderr).toContain("Não foi possível ler --input");
  });

  it("does not classify a persistence failure as an invalid page", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-page-import-persistence-"));
    const path = join(directory, "app.sqlite");
    bootstrapDatabase(path);
    const database = new Database(path);
    database.exec(`
      CREATE TRIGGER block_snapshot_insert BEFORE INSERT ON dataset_snapshots
      BEGIN SELECT RAISE(ABORT, 'forced persistence failure'); END;
    `);
    database.close();

    const imported = runImport(validPage, path);
    expect(imported.status).toBe(1);
    expect(imported.stdout).toBe("");
    expect(imported.stderr).toContain("forced persistence failure");
    const inspection = new Database(path, { readonly: true });
    expect(inspection.prepare("SELECT COUNT(*) AS count FROM data_imports").get()).toEqual({ count: 0 });
    inspection.close();
  });
});
