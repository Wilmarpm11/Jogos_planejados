import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getLatestValidDatasetSnapshot,
  persistDatasetImport,
} from "@boloes/data-access";
import { manualDatasetImportSchema, type ManualDatasetImport } from "@boloes/lottery-contracts";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

function fixture(overrides: Partial<ManualDatasetImport> = {}): ManualDatasetImport {
  return manualDatasetImportSchema.parse({
    lotteryId: "lotofacil",
    sourceUrl: "https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx",
    importedAt: "2026-08-30T12:00:00.000Z",
    contentHash: "sha256:fixture",
    parserVersion: "manual-envelope/1",
    validations: ["source-recorded"],
    status: "VALIDATED",
    ...overrides,
  });
}

function databasePath(): string {
  return join(mkdtempSync(join(tmpdir(), "boloes-snapshot-")), "app.sqlite");
}

describe("CAIXA provenance snapshots", () => {
  it("requires all provenance fields and a UTC content reference", () => {
    expect(() => fixture({ sourceUrl: "not-a-url" })).toThrow();
    expect(() => fixture({ importedAt: "2026-08-30T12:00:00.000+03:00" })).toThrow();
    expect(() => fixture({ rawContent: undefined, contentHash: undefined })).toThrow(
      "rawContent or contentHash is required",
    );
  });

  it("persists a validated import and snapshot atomically", () => {
    const path = databasePath();
    const database = new Database(path);
    database.exec(`
      CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO schema_migrations (version, applied_at) VALUES ('1', '2026-08-30T00:00:00.000Z');
    `);
    database.close();

    persistDatasetImport(path, fixture({ status: "INVALID" }));
    const triggerDatabase = new Database(path);
    triggerDatabase.exec(`
      CREATE TRIGGER block_snapshot_insert BEFORE INSERT ON dataset_snapshots
        BEGIN SELECT RAISE(ABORT, 'forced snapshot failure'); END;
    `);
    triggerDatabase.close();

    expect(() => persistDatasetImport(path, fixture())).toThrow("forced snapshot failure");

    const inspection = new Database(path, { readonly: true });
    expect(inspection.prepare("SELECT COUNT(*) AS count FROM data_imports").get()).toEqual({ count: 1 });
    inspection.close();
  });

  it("preserves the latest valid snapshot after invalid and failed imports", () => {
    const path = databasePath();
    const valid = persistDatasetImport(path, fixture());
    const invalid = persistDatasetImport(
      path,
      fixture({
        importedAt: "2026-08-30T13:00:00.000Z",
        status: "INVALID",
        validations: ["draw-count-mismatch"],
      }),
    );
    const failed = persistDatasetImport(
      path,
      fixture({
        importedAt: "2026-08-30T14:00:00.000Z",
        status: "FAILED",
        validations: ["source-unavailable"],
      }),
    );

    expect(valid.snapshot).not.toBeNull();
    expect(invalid.snapshot).toBeNull();
    expect(failed.snapshot).toBeNull();
    expect(getLatestValidDatasetSnapshot(path, "lotofacil")?.id).toBe(valid.snapshot?.id);
  });

  it("does not rewrite schema metadata during read-only operations", () => {
    const path = databasePath();
    const persisted = persistDatasetImport(path, fixture());
    const database = new Database(path);
    database.exec(`
      CREATE TRIGGER block_schema_metadata_rewrite BEFORE INSERT ON app_metadata
      WHEN NEW.key = 'schema_version'
      BEGIN SELECT RAISE(ABORT, 'schema metadata write during read'); END;
    `);
    database.close();

    expect(getLatestValidDatasetSnapshot(path, "lotofacil")?.id).toBe(persisted.snapshot?.id);
  });

  it("blocks updates and deletion of persisted provenance and snapshots", () => {
    const path = databasePath();
    const persisted = persistDatasetImport(path, fixture());
    const database = new Database(path);

    expect(() =>
      database
        .prepare("UPDATE data_imports SET parser_version = ? WHERE id = ?")
        .run("changed", persisted.dataImport.id),
    ).toThrow("data_imports are immutable");
    expect(() =>
      database
        .prepare("DELETE FROM dataset_snapshots WHERE id = ?")
        .run(persisted.snapshot?.id),
    ).toThrow("dataset_snapshots are immutable");
    database.close();
  });

  it("registers and reads the normalized envelope through the offline CLI", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-cli-"));
    const path = join(directory, "app.sqlite");
    const inputPath = join(directory, "envelope.json");
    writeFileSync(inputPath, JSON.stringify(fixture()));
    const imported = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "apps/cli/src/index.ts",
        "data",
        "import",
        "--input",
        inputPath,
        "--db",
        path,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(imported.status, imported.stderr).toBe(0);
    expect(JSON.parse(imported.stdout).dataImport.status).toBe("VALIDATED");

    const latest = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "apps/cli/src/index.ts",
        "data",
        "latest",
        "--lottery",
        "lotofacil",
        "--db",
        path,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(latest.status, latest.stderr).toBe(0);
    expect(JSON.parse(latest.stdout).snapshot).toMatchObject({
      lotteryId: "lotofacil",
      parserVersion: "manual-envelope/1",
      status: "VALIDATED",
      contentReference: "sha256:fixture",
    });
  });
});
