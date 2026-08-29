import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export const INITIAL_SCHEMA_VERSION = "1";

export interface DatabaseBootstrapResult {
  readonly path: string;
  readonly schemaVersion: string;
}

export function bootstrapDatabase(path: string): DatabaseBootstrapResult {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);

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
    database
      .prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)")
      .run("schema_version", INITIAL_SCHEMA_VERSION);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }

  return { path, schemaVersion: INITIAL_SCHEMA_VERSION };
}
