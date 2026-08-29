import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bootstrapDatabase, INITIAL_SCHEMA_VERSION } from "@boloes/data-access";

describe("SQLite bootstrap", () => {
  it("creates a local database and applies the initial migration idempotently", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-"));
    const path = join(directory, "app.sqlite");

    expect(bootstrapDatabase(path)).toEqual({ path, schemaVersion: INITIAL_SCHEMA_VERSION });
    expect(bootstrapDatabase(path)).toEqual({ path, schemaVersion: INITIAL_SCHEMA_VERSION });
    expect(existsSync(path)).toBe(true);
  });
});
