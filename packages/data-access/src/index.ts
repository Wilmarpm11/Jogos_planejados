import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  dataImportRecordSchema,
  datasetSnapshotSchema,
  manualDatasetImportSchema,
  type DataImportRecord,
  type DatasetSnapshot,
  type ManualDatasetImport,
  type LotofacilCatalog,
  type LotofacilCatalogRecord,
  type LotofacilHistoryWindowSize,
  type NormalizedLotteryResult,
  type LotteryResultLedgerRecord,
  type HistoricalMetricProfileInput,
  type HistoricalMetricProfileRecord,
  type CohortDefinition,
  type CohortResolution,
  type CohortSelectorRule,
  type StrategyConfigVersion,
  type StrategyConfigVersionInput,
  lotofacilHistoryWindowSizeSchema,
  lotofacilCatalogSchema,
  lotteryResultLedgerRecordSchema,
  normalizedLotteryResultSchema,
  lotofacilCatalogRecordSchema,
  strategyConfigVersionInputSchema,
  strategyConfigVersionSchema,
  historicalMetricProfileInputSchema,
  historicalMetricProfileRecordSchema,
  cohortDefinitionSchema,
  cohortResolutionSchema,
  cohortSelectorRuleSchema,
} from "@boloes/lottery-contracts";
import Database from "better-sqlite3";

export const INITIAL_SCHEMA_VERSION = "1";
export const CURRENT_SCHEMA_VERSION = "7";

export interface DatabaseBootstrapResult {
  readonly path: string;
  readonly schemaVersion: string;
}

export interface PersistedDatasetImport {
  readonly dataImport: DataImportRecord;
  readonly snapshot: DatasetSnapshot | null;
}

interface DataImportRow {
  readonly id: string;
  readonly lottery_id: string;
  readonly source_url: string;
  readonly imported_at: string;
  readonly raw_content: string | null;
  readonly content_hash: string | null;
  readonly parser_version: string;
  readonly validations_json: string;
  readonly status: "VALIDATED" | "INVALID" | "FAILED";
  readonly persisted_at: string;
}

interface DatasetSnapshotRow extends Omit<DataImportRow, "status"> {
  readonly data_import_id: string;
}

interface StrategyConfigVersionRow {
  readonly record_id: string;
  readonly strategy_id: string;
  readonly version: string;
  readonly status: StrategyConfigVersion["status"];
  readonly mode: StrategyConfigVersion["mode"];
  readonly parameters_json: string;
  readonly previous_record_id: string | null;
  readonly created_at: string;
}

interface HistoricalMetricProfileRow {
  readonly id: string;
  readonly source_result_id: string;
  readonly source_snapshot_id: string;
  readonly lottery_id: "lotofacil";
  readonly metric_engine_version: string;
  readonly profile_json: string;
  readonly persisted_at: string;
}

interface CohortDefinitionRow {
  readonly id: string;
  readonly lottery_id: string;
  readonly selector_rule_json: string;
  readonly selector_rule_version: "1";
  readonly created_at: string;
}

function openDatabase(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.pragma("busy_timeout = 5000");
  database.pragma("foreign_keys = ON");
  applyMigrations(database);
  return database;
}

function rollbackIfActive(database: Database.Database): void {
  if (database.inTransaction) database.exec("ROLLBACK");
}

function recordedSchemaVersion(database: Database.Database): string | null {
  const metadataTable = database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_metadata'")
    .get();
  if (!metadataTable) return null;
  const row = database
    .prepare("SELECT value FROM app_metadata WHERE key = ?")
    .get("schema_version") as { value: string } | undefined;
  return row?.value ?? null;
}

function applyMigrations(database: Database.Database): void {
  if (recordedSchemaVersion(database) === CURRENT_SCHEMA_VERSION) return;
  try {
    database.exec("BEGIN IMMEDIATE");
    database.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    database.exec(
      "CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );
    database
      .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(INITIAL_SCHEMA_VERSION, new Date().toISOString());

    const hasSnapshotMigration = database
      .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
      .get("2");

    if (!hasSnapshotMigration) {
      database.exec(`
        CREATE TABLE data_imports (
          id TEXT PRIMARY KEY,
          lottery_id TEXT NOT NULL,
          source_url TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          raw_content TEXT,
          content_hash TEXT,
          parser_version TEXT NOT NULL,
          validations_json TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('VALIDATED', 'INVALID', 'FAILED')),
          persisted_at TEXT NOT NULL,
          CHECK(raw_content IS NOT NULL OR content_hash IS NOT NULL)
        );
        CREATE TABLE dataset_snapshots (
          id TEXT PRIMARY KEY,
          data_import_id TEXT NOT NULL UNIQUE REFERENCES data_imports(id) ON DELETE RESTRICT,
          lottery_id TEXT NOT NULL,
          source_url TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          raw_content TEXT,
          content_hash TEXT,
          parser_version TEXT NOT NULL,
          validations_json TEXT NOT NULL,
          persisted_at TEXT NOT NULL,
          CHECK(raw_content IS NOT NULL OR content_hash IS NOT NULL)
        );
        CREATE INDEX dataset_snapshots_latest_by_lottery
          ON dataset_snapshots(lottery_id, imported_at DESC, persisted_at DESC);
        CREATE TRIGGER data_imports_are_immutable_update
          BEFORE UPDATE ON data_imports
          BEGIN SELECT RAISE(ABORT, 'data_imports are immutable'); END;
        CREATE TRIGGER data_imports_are_immutable_delete
          BEFORE DELETE ON data_imports
          BEGIN SELECT RAISE(ABORT, 'data_imports are immutable'); END;
        CREATE TRIGGER dataset_snapshots_are_immutable_update
          BEFORE UPDATE ON dataset_snapshots
          BEGIN SELECT RAISE(ABORT, 'dataset_snapshots are immutable'); END;
        CREATE TRIGGER dataset_snapshots_are_immutable_delete
          BEFORE DELETE ON dataset_snapshots
          BEGIN SELECT RAISE(ABORT, 'dataset_snapshots are immutable'); END;
      `);
      database
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run("2", new Date().toISOString());
    }
    const hasCatalogMigration = database.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get("3");
    if (!hasCatalogMigration) {
      database.exec(`
        CREATE TABLE lottery_catalogs (
          id TEXT PRIMARY KEY,
          source_snapshot_id TEXT NOT NULL REFERENCES dataset_snapshots(id) ON DELETE RESTRICT,
          lottery_id TEXT NOT NULL,
          source_url TEXT NOT NULL,
          parser_version TEXT NOT NULL,
          catalog_json TEXT NOT NULL,
          validations_json TEXT NOT NULL,
          persisted_at TEXT NOT NULL
        );
        CREATE INDEX lottery_catalogs_latest_by_lottery ON lottery_catalogs(lottery_id, persisted_at DESC);
        CREATE TRIGGER lottery_catalogs_are_immutable_update BEFORE UPDATE ON lottery_catalogs BEGIN SELECT RAISE(ABORT, 'lottery_catalogs are immutable'); END;
        CREATE TRIGGER lottery_catalogs_are_immutable_delete BEFORE DELETE ON lottery_catalogs BEGIN SELECT RAISE(ABORT, 'lottery_catalogs are immutable'); END;
      `);
      database.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run("3", new Date().toISOString());
    }
    const hasResultLedgerMigration = database.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get("4");
    if (!hasResultLedgerMigration) {
      database.exec(`
        CREATE TABLE lottery_result_ledger (
          id TEXT PRIMARY KEY, source_snapshot_id TEXT NOT NULL REFERENCES dataset_snapshots(id) ON DELETE RESTRICT,
          lottery_id TEXT NOT NULL, contest_number INTEGER NOT NULL, result_json TEXT NOT NULL, persisted_at TEXT NOT NULL,
          UNIQUE(source_snapshot_id, lottery_id, contest_number)
        );
        CREATE INDEX lottery_result_ledger_by_contest ON lottery_result_ledger(lottery_id, contest_number, persisted_at DESC);
        CREATE TRIGGER lottery_result_ledger_immutable_update BEFORE UPDATE ON lottery_result_ledger BEGIN SELECT RAISE(ABORT, 'lottery_result_ledger is immutable'); END;
        CREATE TRIGGER lottery_result_ledger_immutable_delete BEFORE DELETE ON lottery_result_ledger BEGIN SELECT RAISE(ABORT, 'lottery_result_ledger is immutable'); END;
      `);
      database.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run("4", new Date().toISOString());
    }
    const hasStrategyRegistryMigration = database.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get("5");
    if (!hasStrategyRegistryMigration) {
      database.exec(`
        CREATE TABLE strategy_config_versions (
          record_id TEXT PRIMARY KEY,
          strategy_id TEXT NOT NULL,
          version TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('DRAFT', 'EXPLORATORY', 'VALIDATING', 'HOLDOUT', 'VALIDATED', 'PRODUCTION', 'REJECTED')),
          mode TEXT NOT NULL CHECK(mode IN ('NEUTRAL', 'BALANCED', 'CONCENTRATED', 'EXPERIMENTAL_SPECIAL')),
          parameters_json TEXT NOT NULL,
          previous_record_id TEXT REFERENCES strategy_config_versions(record_id) ON DELETE RESTRICT,
          created_at TEXT NOT NULL,
          UNIQUE(strategy_id, version)
        );
        CREATE INDEX strategy_config_versions_by_strategy
          ON strategy_config_versions(strategy_id, created_at DESC);
        CREATE TRIGGER strategy_config_versions_are_immutable_update
          BEFORE UPDATE ON strategy_config_versions
          BEGIN SELECT RAISE(ABORT, 'strategy_config_versions are immutable'); END;
        CREATE TRIGGER strategy_config_versions_are_immutable_delete
          BEFORE DELETE ON strategy_config_versions
          BEGIN SELECT RAISE(ABORT, 'strategy_config_versions are immutable'); END;
      `);
      database.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run("5", new Date().toISOString());
    }
    const hasHistoricalMetricProfileMigration = database.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get("6");
    if (!hasHistoricalMetricProfileMigration) {
      database.exec(`
        CREATE TABLE historical_metric_profiles (
          id TEXT PRIMARY KEY,
          source_result_id TEXT NOT NULL REFERENCES lottery_result_ledger(id) ON DELETE RESTRICT,
          source_snapshot_id TEXT NOT NULL REFERENCES dataset_snapshots(id) ON DELETE RESTRICT,
          lottery_id TEXT NOT NULL CHECK(lottery_id = 'lotofacil'),
          metric_engine_version TEXT NOT NULL,
          profile_json TEXT NOT NULL,
          persisted_at TEXT NOT NULL,
          UNIQUE(source_result_id, metric_engine_version)
        );
        CREATE INDEX historical_metric_profiles_by_result
          ON historical_metric_profiles(source_result_id, metric_engine_version);
        CREATE TRIGGER historical_metric_profiles_are_immutable_update
          BEFORE UPDATE ON historical_metric_profiles
          BEGIN SELECT RAISE(ABORT, 'historical_metric_profiles are immutable'); END;
        CREATE TRIGGER historical_metric_profiles_are_immutable_delete
          BEFORE DELETE ON historical_metric_profiles
          BEGIN SELECT RAISE(ABORT, 'historical_metric_profiles are immutable'); END;
      `);
      database.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run("6", new Date().toISOString());
    }
    const hasCohortMigration = database.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get("7");
    if (!hasCohortMigration) {
      database.exec(`
        CREATE TABLE cohort_definitions (
          id TEXT PRIMARY KEY, lottery_id TEXT NOT NULL, selector_rule_json TEXT NOT NULL,
          selector_rule_version TEXT NOT NULL CHECK(selector_rule_version = '1'), created_at TEXT NOT NULL,
          UNIQUE(lottery_id, selector_rule_json)
        );
        CREATE TABLE draw_special_types (
          result_id TEXT NOT NULL REFERENCES lottery_result_ledger(id) ON DELETE RESTRICT,
          special_type TEXT NOT NULL, classified_at TEXT NOT NULL,
          PRIMARY KEY(result_id, special_type)
        );
        CREATE TABLE cohort_resolutions (
          id TEXT PRIMARY KEY, cohort_id TEXT NOT NULL REFERENCES cohort_definitions(id) ON DELETE RESTRICT,
          selector_rule_version TEXT NOT NULL CHECK(selector_rule_version = '1'), resolved_draw_ids_json TEXT NOT NULL,
          resolved_min_contest INTEGER, resolved_max_contest INTEGER, resolved_count INTEGER NOT NULL,
          data_version_hash TEXT NOT NULL, resolved_at TEXT NOT NULL
        );
        CREATE INDEX cohort_resolutions_by_cohort ON cohort_resolutions(cohort_id, resolved_at DESC);
        CREATE TRIGGER cohort_definitions_are_immutable_update BEFORE UPDATE ON cohort_definitions BEGIN SELECT RAISE(ABORT, 'cohort_definitions are immutable'); END;
        CREATE TRIGGER cohort_definitions_are_immutable_delete BEFORE DELETE ON cohort_definitions BEGIN SELECT RAISE(ABORT, 'cohort_definitions are immutable'); END;
        CREATE TRIGGER cohort_resolutions_are_immutable_update BEFORE UPDATE ON cohort_resolutions BEGIN SELECT RAISE(ABORT, 'cohort_resolutions are immutable'); END;
        CREATE TRIGGER cohort_resolutions_are_immutable_delete BEFORE DELETE ON cohort_resolutions BEGIN SELECT RAISE(ABORT, 'cohort_resolutions are immutable'); END;
      `);
      database.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run("7", new Date().toISOString());
    }

    database
      .prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)")
      .run("schema_version", CURRENT_SCHEMA_VERSION);
    database.exec("COMMIT");
  } catch (error) {
    rollbackIfActive(database);
    throw error;
  }
}

function toDatasetSnapshot(row: DatasetSnapshotRow): DatasetSnapshot {
  return datasetSnapshotSchema.parse({
    id: row.id,
    dataImportId: row.data_import_id,
    lotteryId: row.lottery_id,
    sourceUrl: row.source_url,
    importedAt: row.imported_at,
    rawContent: row.raw_content ?? undefined,
    contentHash: row.content_hash ?? undefined,
    parserVersion: row.parser_version,
    validations: JSON.parse(row.validations_json),
    status: "VALIDATED",
    persistedAt: row.persisted_at,
  });
}

function toStrategyConfigVersion(row: StrategyConfigVersionRow): StrategyConfigVersion {
  return strategyConfigVersionSchema.parse({
    recordId: row.record_id,
    id: row.strategy_id,
    version: row.version,
    status: row.status,
    mode: row.mode,
    parameters: JSON.parse(row.parameters_json),
    previousRecordId: row.previous_record_id ?? undefined,
    createdAt: row.created_at,
  });
}

function toHistoricalMetricProfile(row: HistoricalMetricProfileRow): HistoricalMetricProfileRecord {
  return historicalMetricProfileRecordSchema.parse({
    id: row.id,
    sourceResultId: row.source_result_id,
    sourceSnapshotId: row.source_snapshot_id,
    lotteryId: row.lottery_id,
    metricEngineVersion: row.metric_engine_version,
    profile: JSON.parse(row.profile_json),
    persistedAt: row.persisted_at,
  });
}

function toCohortDefinition(row: CohortDefinitionRow): CohortDefinition {
  return cohortDefinitionSchema.parse({ id: row.id, lotteryId: row.lottery_id, selectorRule: JSON.parse(row.selector_rule_json), selectorRuleVersion: row.selector_rule_version, createdAt: row.created_at });
}

export function bootstrapDatabase(path: string): DatabaseBootstrapResult {
  const database = openDatabase(path);
  database.close();
  return { path, schemaVersion: CURRENT_SCHEMA_VERSION };
}

export function persistDatasetImport(path: string, input: ManualDatasetImport): PersistedDatasetImport {
  const normalizedInput = manualDatasetImportSchema.parse(input);
  const database = openDatabase(path);
  const id = randomUUID();
  const persistedAt = new Date().toISOString();
  const snapshotId = normalizedInput.status === "VALIDATED" ? randomUUID() : null;

  try {
    database.exec("BEGIN IMMEDIATE");
    database
      .prepare(
        `INSERT INTO data_imports (
          id, lottery_id, source_url, imported_at, raw_content, content_hash,
          parser_version, validations_json, status, persisted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        normalizedInput.lotteryId,
        normalizedInput.sourceUrl,
        normalizedInput.importedAt,
        normalizedInput.rawContent ?? null,
        normalizedInput.contentHash ?? null,
        normalizedInput.parserVersion,
        JSON.stringify(normalizedInput.validations),
        normalizedInput.status,
        persistedAt,
      );

    if (snapshotId) {
      database
        .prepare(
          `INSERT INTO dataset_snapshots (
            id, data_import_id, lottery_id, source_url, imported_at, raw_content,
            content_hash, parser_version, validations_json, persisted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          snapshotId,
          id,
          normalizedInput.lotteryId,
          normalizedInput.sourceUrl,
          normalizedInput.importedAt,
          normalizedInput.rawContent ?? null,
          normalizedInput.contentHash ?? null,
          normalizedInput.parserVersion,
          JSON.stringify(normalizedInput.validations),
          persistedAt,
        );
    }
    database.exec("COMMIT");
  } catch (error) {
    rollbackIfActive(database);
    throw error;
  } finally {
    database.close();
  }

  const dataImport = dataImportRecordSchema.parse({ ...normalizedInput, id, persistedAt });
  const snapshot = snapshotId
    ? datasetSnapshotSchema.parse({
        id: snapshotId,
        dataImportId: id,
        lotteryId: normalizedInput.lotteryId,
        sourceUrl: normalizedInput.sourceUrl,
        importedAt: normalizedInput.importedAt,
        rawContent: normalizedInput.rawContent,
        contentHash: normalizedInput.contentHash,
        parserVersion: normalizedInput.parserVersion,
        validations: normalizedInput.validations,
        status: "VALIDATED",
        persistedAt,
      })
    : null;
  return { dataImport, snapshot };
}

export function getLatestValidDatasetSnapshot(
  path: string,
  lotteryId: string,
): DatasetSnapshot | null {
  const database = openDatabase(path);
  try {
    const row = database
      .prepare(
        `SELECT id, data_import_id, lottery_id, source_url, imported_at, raw_content,
                content_hash, parser_version, validations_json, persisted_at
         FROM dataset_snapshots
         WHERE lottery_id = ?
         ORDER BY imported_at DESC, persisted_at DESC
         LIMIT 1`,
      )
      .get(lotteryId) as DatasetSnapshotRow | undefined;
    return row ? toDatasetSnapshot(row) : null;
  } finally {
    database.close();
  }
}

export function persistLotofacilCatalog(
  path: string,
  sourceSnapshotId: string,
  catalog: LotofacilCatalog,
): LotofacilCatalogRecord {
  const normalizedCatalog = lotofacilCatalogSchema.parse(catalog);
  const database = openDatabase(path);
  const id = randomUUID();
  const persistedAt = new Date().toISOString();
  try {
    database.exec("BEGIN IMMEDIATE");
    const source = database.prepare("SELECT 1 FROM dataset_snapshots WHERE id = ? AND lottery_id = ?").get(sourceSnapshotId, "lotofacil");
    if (!source) throw new Error("Snapshot válido Lotofácil não encontrado.");
    database.prepare(`INSERT INTO lottery_catalogs (id, source_snapshot_id, lottery_id, source_url, parser_version, catalog_json, validations_json, persisted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, sourceSnapshotId, normalizedCatalog.lotteryId, normalizedCatalog.sourceUrl, normalizedCatalog.parserVersion, JSON.stringify(normalizedCatalog), JSON.stringify(normalizedCatalog.validations), persistedAt);
    database.exec("COMMIT");
  } catch (error) {
    rollbackIfActive(database);
    throw error;
  } finally { database.close(); }
  return lotofacilCatalogRecordSchema.parse({ ...normalizedCatalog, id, sourceSnapshotId, persistedAt });
}

export function getLatestLotofacilCatalog(path: string): LotofacilCatalogRecord | null {
  const database = openDatabase(path);
  try {
    const row = database.prepare("SELECT id, source_snapshot_id, catalog_json, persisted_at FROM lottery_catalogs WHERE lottery_id = ? ORDER BY persisted_at DESC LIMIT 1").get("lotofacil") as { id: string; source_snapshot_id: string; catalog_json: string; persisted_at: string } | undefined;
    return row ? lotofacilCatalogRecordSchema.parse({ ...JSON.parse(row.catalog_json), id: row.id, sourceSnapshotId: row.source_snapshot_id, persistedAt: row.persisted_at }) : null;
  } finally { database.close(); }
}

export function persistLotteryResult(
  path: string, sourceSnapshotId: string, result: NormalizedLotteryResult,
): LotteryResultLedgerRecord {
  const normalizedResult = normalizedLotteryResultSchema.parse(result);
  const database = openDatabase(path); const id = randomUUID(); const persistedAt = new Date().toISOString();
  try {
    database.exec("BEGIN IMMEDIATE");
    const source = database.prepare("SELECT 1 FROM dataset_snapshots WHERE id = ? AND lottery_id = ?").get(sourceSnapshotId, normalizedResult.lotteryId);
    if (!source) throw new Error("Snapshot válido da modalidade não encontrado.");
    database.prepare("INSERT INTO lottery_result_ledger (id, source_snapshot_id, lottery_id, contest_number, result_json, persisted_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, sourceSnapshotId, normalizedResult.lotteryId, normalizedResult.contestNumber, JSON.stringify(normalizedResult), persistedAt);
    database.exec("COMMIT");
  } catch (error) {
    rollbackIfActive(database);
    throw error;
  } finally { database.close(); }
  return lotteryResultLedgerRecordSchema.parse({ ...normalizedResult, id, sourceSnapshotId, persistedAt });
}

export function getLotofacilResultByContest(path: string, contestNumber: number): LotteryResultLedgerRecord | null {
  const database = openDatabase(path);
  try {
    const row = database.prepare("SELECT id, source_snapshot_id, result_json, persisted_at FROM lottery_result_ledger WHERE lottery_id = ? AND contest_number = ? ORDER BY persisted_at DESC, rowid DESC LIMIT 1").get("lotofacil", contestNumber) as { id: string; source_snapshot_id: string; result_json: string; persisted_at: string } | undefined;
    return row ? lotteryResultLedgerRecordSchema.parse({ ...JSON.parse(row.result_json), id: row.id, sourceSnapshotId: row.source_snapshot_id, persistedAt: row.persisted_at }) : null;
  } finally { database.close(); }
}

export function getLotofacilResultWindow(
  path: string,
  size: LotofacilHistoryWindowSize,
): readonly LotteryResultLedgerRecord[] {
  const validatedSize = lotofacilHistoryWindowSizeSchema.parse(size);
  const database = openDatabase(path);
  try {
    const latestContestVersions = `
      SELECT id, source_snapshot_id, result_json, persisted_at, contest_number
      FROM (
        SELECT id, source_snapshot_id, result_json, persisted_at, contest_number,
               ROW_NUMBER() OVER (
                 PARTITION BY contest_number
                 ORDER BY persisted_at DESC, rowid DESC
               ) AS version_rank
        FROM lottery_result_ledger
        WHERE lottery_id = ?
      )
      WHERE version_rank = 1
      ORDER BY contest_number DESC`;
    const query = validatedSize === "complete"
      ? latestContestVersions
      : `${latestContestVersions} LIMIT ?`;
    const rows = (validatedSize === "complete" ? database.prepare(query).all("lotofacil") : database.prepare(query).all("lotofacil", validatedSize)) as readonly { id: string; source_snapshot_id: string; result_json: string; persisted_at: string }[];
    return rows.map((row) => lotteryResultLedgerRecordSchema.parse({ ...JSON.parse(row.result_json), id: row.id, sourceSnapshotId: row.source_snapshot_id, persistedAt: row.persisted_at }));
  } finally { database.close(); }
}

export function persistHistoricalMetricProfile(
  path: string,
  input: HistoricalMetricProfileInput,
): HistoricalMetricProfileRecord {
  return persistHistoricalMetricProfiles(path, [input])[0]!;
}

export function persistHistoricalMetricProfiles(
  path: string,
  inputs: readonly HistoricalMetricProfileInput[],
): readonly HistoricalMetricProfileRecord[] {
  const normalizedInputs = inputs.map((input) => historicalMetricProfileInputSchema.parse(input));
  const database = openDatabase(path);
  try {
    database.exec("BEGIN IMMEDIATE");
    const sourceStatement = database.prepare("SELECT source_snapshot_id, lottery_id FROM lottery_result_ledger WHERE id = ?");
    const insertStatement = database.prepare("INSERT OR IGNORE INTO historical_metric_profiles (id, source_result_id, source_snapshot_id, lottery_id, metric_engine_version, profile_json, persisted_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const existingStatement = database.prepare("SELECT id, source_result_id, source_snapshot_id, lottery_id, metric_engine_version, profile_json, persisted_at FROM historical_metric_profiles WHERE source_result_id = ? AND metric_engine_version = ?");
    const records = normalizedInputs.map((normalizedInput) => {
      const source = sourceStatement.get(normalizedInput.sourceResultId) as { source_snapshot_id: string; lottery_id: string } | undefined;
      if (!source || source.source_snapshot_id !== normalizedInput.sourceSnapshotId || source.lottery_id !== normalizedInput.lotteryId) {
        throw new Error("Resultado de origem inválido para o perfil métrico.");
      }
      const id = randomUUID();
      const persistedAt = new Date().toISOString();
      const inserted = insertStatement.run(id, normalizedInput.sourceResultId, normalizedInput.sourceSnapshotId, normalizedInput.lotteryId, normalizedInput.metricEngineVersion, JSON.stringify(normalizedInput.profile), persistedAt);
      if (inserted.changes === 0) {
        const existing = existingStatement.get(normalizedInput.sourceResultId, normalizedInput.metricEngineVersion) as HistoricalMetricProfileRow | undefined;
        if (!existing) throw new Error("Perfil métrico existente não encontrado.");
        return toHistoricalMetricProfile(existing);
      }
      return historicalMetricProfileRecordSchema.parse({ ...normalizedInput, id, persistedAt });
    });
    database.exec("COMMIT");
    return records;
  } catch (error) {
    rollbackIfActive(database);
    throw error;
  } finally {
    database.close();
  }
}

export function getLotofacilHistoricalMetricProfiles(
  path: string,
  size: LotofacilHistoryWindowSize,
): readonly HistoricalMetricProfileRecord[] {
  const validatedSize = lotofacilHistoryWindowSizeSchema.parse(size);
  const database = openDatabase(path);
  try {
    const query = validatedSize === "complete"
      ? "SELECT p.id, p.source_result_id, p.source_snapshot_id, p.lottery_id, p.metric_engine_version, p.profile_json, p.persisted_at FROM historical_metric_profiles p JOIN lottery_result_ledger r ON r.id = p.source_result_id WHERE p.lottery_id = ? ORDER BY r.contest_number DESC, p.persisted_at DESC"
      : "SELECT p.id, p.source_result_id, p.source_snapshot_id, p.lottery_id, p.metric_engine_version, p.profile_json, p.persisted_at FROM historical_metric_profiles p JOIN lottery_result_ledger r ON r.id = p.source_result_id WHERE p.lottery_id = ? ORDER BY r.contest_number DESC, p.persisted_at DESC LIMIT ?";
    const rows = (validatedSize === "complete" ? database.prepare(query).all("lotofacil") : database.prepare(query).all("lotofacil", validatedSize)) as readonly HistoricalMetricProfileRow[];
    return rows.map(toHistoricalMetricProfile);
  } finally { database.close(); }
}

export function createCohortDefinition(
  path: string,
  lotteryId: string,
  selectorRule: CohortSelectorRule,
): CohortDefinition {
  const normalizedRule = cohortSelectorRuleSchema.parse(selectorRule);
  const selectorRuleJson = JSON.stringify(normalizedRule);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const database = openDatabase(path);
  try {
    const inserted = database.prepare("INSERT OR IGNORE INTO cohort_definitions (id, lottery_id, selector_rule_json, selector_rule_version, created_at) VALUES (?, ?, ?, ?, ?)").run(id, lotteryId, selectorRuleJson, "1", createdAt);
    if (inserted.changes === 0) {
      const existing = database.prepare("SELECT id, lottery_id, selector_rule_json, selector_rule_version, created_at FROM cohort_definitions WHERE lottery_id = ? AND selector_rule_json = ?").get(lotteryId, selectorRuleJson) as CohortDefinitionRow | undefined;
      if (!existing) throw new Error("Coorte existente não encontrada.");
      return toCohortDefinition(existing);
    }
  } finally { database.close(); }
  return cohortDefinitionSchema.parse({ id, lotteryId, selectorRule: normalizedRule, selectorRuleVersion: "1", createdAt });
}

export function classifyLotofacilResultSpecialType(path: string, resultId: string, specialType: string): void {
  const database = openDatabase(path);
  try {
    const result = database.prepare("SELECT 1 FROM lottery_result_ledger WHERE id = ? AND lottery_id = ?").get(resultId, "lotofacil");
    if (!result) throw new Error("Resultado Lotofácil não encontrado para classificação especial.");
    database.prepare("INSERT OR IGNORE INTO draw_special_types (result_id, special_type, classified_at) VALUES (?, ?, ?)").run(resultId, specialType, new Date().toISOString());
  } finally { database.close(); }
}

export function materializeCohort(path: string, cohortId: string): CohortResolution {
  const database = openDatabase(path);
  const id = randomUUID();
  const resolvedAt = new Date().toISOString();
  try {
    database.exec("BEGIN IMMEDIATE");
    const definitionRow = database.prepare("SELECT id, lottery_id, selector_rule_json, selector_rule_version, created_at FROM cohort_definitions WHERE id = ?").get(cohortId) as CohortDefinitionRow | undefined;
    if (!definitionRow) throw new Error("Coorte não encontrada.");
    const definition = toCohortDefinition(definitionRow);
    const rule = definition.selectorRule;
    const base = `SELECT r.id, r.contest_number
      FROM lottery_result_ledger r
      WHERE r.lottery_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM lottery_result_ledger newer
          WHERE newer.lottery_id = r.lottery_id
            AND newer.contest_number = r.contest_number
            AND (
              newer.persisted_at > r.persisted_at
              OR (newer.persisted_at = r.persisted_at AND newer.rowid > r.rowid)
            )
        )`;
    let sql = base;
    const parameters: (string | number)[] = [definition.lotteryId];
    if (rule.type === "LAST_N_DRAWS") { sql += " ORDER BY r.contest_number DESC, r.persisted_at DESC LIMIT ?"; parameters.push(rule.n); }
    else if (rule.type === "CONTEST_RANGE") { sql += " AND r.contest_number BETWEEN ? AND ? ORDER BY r.contest_number DESC, r.persisted_at DESC"; parameters.push(rule.startContest, rule.endContest); }
    else if (rule.type === "SPECIAL_DRAW_TYPE") { sql += " AND EXISTS (SELECT 1 FROM draw_special_types t WHERE t.result_id = r.id AND t.special_type = ?) ORDER BY r.contest_number DESC, r.persisted_at DESC"; parameters.push(rule.specialType); }
    else { sql += " ORDER BY r.contest_number DESC, r.persisted_at DESC"; }
    const rows = database.prepare(sql).all(...parameters) as readonly { id: string; contest_number: number }[];
    const resolvedDrawIds = rows.map((row) => row.id);
    const contests = rows.map((row) => row.contest_number);
    const resolution = cohortResolutionSchema.parse({
      id, cohortId, selectorRuleVersion: "1", resolvedDrawIds,
      resolvedMinContest: contests.length ? Math.min(...contests) : null,
      resolvedMaxContest: contests.length ? Math.max(...contests) : null,
      resolvedCount: resolvedDrawIds.length,
      dataVersionHash: createHash("sha256").update(JSON.stringify(resolvedDrawIds)).digest("hex"), resolvedAt,
    });
    database.prepare("INSERT INTO cohort_resolutions (id, cohort_id, selector_rule_version, resolved_draw_ids_json, resolved_min_contest, resolved_max_contest, resolved_count, data_version_hash, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(resolution.id, resolution.cohortId, resolution.selectorRuleVersion, JSON.stringify(resolution.resolvedDrawIds), resolution.resolvedMinContest, resolution.resolvedMaxContest, resolution.resolvedCount, resolution.dataVersionHash, resolution.resolvedAt);
    database.exec("COMMIT");
    return resolution;
  } catch (error) {
    rollbackIfActive(database);
    throw error;
  } finally { database.close(); }
}

export function persistStrategyConfigVersion(
  path: string,
  input: StrategyConfigVersionInput,
): StrategyConfigVersion {
  const normalizedInput = strategyConfigVersionInputSchema.parse(input);
  const recordId = randomUUID();
  const createdAt = new Date().toISOString();
  const database = openDatabase(path);
  try {
    database.exec("BEGIN IMMEDIATE");
    if (normalizedInput.previousRecordId) {
      const previous = database
        .prepare("SELECT strategy_id FROM strategy_config_versions WHERE record_id = ?")
        .get(normalizedInput.previousRecordId) as { strategy_id: string } | undefined;
      if (!previous || previous.strategy_id !== normalizedInput.id) {
        throw new Error("Versão anterior da estratégia não encontrada para o mesmo identificador.");
      }
    }
    database
      .prepare(
        `INSERT INTO strategy_config_versions (
          record_id, strategy_id, version, status, mode, parameters_json,
          previous_record_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        recordId,
        normalizedInput.id,
        normalizedInput.version,
        normalizedInput.status,
        normalizedInput.mode,
        JSON.stringify(normalizedInput.parameters),
        normalizedInput.previousRecordId ?? null,
        createdAt,
      );
    database.exec("COMMIT");
  } catch (error) {
    rollbackIfActive(database);
    throw error;
  } finally {
    database.close();
  }
  return strategyConfigVersionSchema.parse({ ...normalizedInput, recordId, createdAt });
}

export function getStrategyConfigVersion(
  path: string,
  strategyId: string,
  version: string,
): StrategyConfigVersion | null {
  const database = openDatabase(path);
  try {
    const row = database
      .prepare(
        `SELECT record_id, strategy_id, version, status, mode, parameters_json,
                previous_record_id, created_at
         FROM strategy_config_versions
         WHERE strategy_id = ? AND version = ?`,
      )
      .get(strategyId, version) as StrategyConfigVersionRow | undefined;
    return row ? toStrategyConfigVersion(row) : null;
  } finally {
    database.close();
  }
}

export function getLatestStrategyConfigVersion(
  path: string,
  strategyId: string,
): StrategyConfigVersion | null {
  const database = openDatabase(path);
  try {
    const row = database
      .prepare(
        `SELECT record_id, strategy_id, version, status, mode, parameters_json,
                previous_record_id, created_at
         FROM strategy_config_versions
         WHERE strategy_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .get(strategyId) as StrategyConfigVersionRow | undefined;
    return row ? toStrategyConfigVersion(row) : null;
  } finally {
    database.close();
  }
}
