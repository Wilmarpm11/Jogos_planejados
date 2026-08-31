import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getLatestStrategyConfigVersion,
  persistStrategyConfigVersion,
} from "@boloes/data-access";
import {
  canTransitionStrategy,
  createStrategyTransition,
  isEligibleForAutomaticGeneration,
  isResolvedStrategyEligibleForAutomaticGeneration,
  validateResolvedStrategyConfig,
} from "@boloes/strategy-registry";
import { validateLotofacilStructuralAllocation } from "@boloes/lottery-lotofacil";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const draft = {
  recordId: "51bb6f75-a33a-4f5a-b7d2-a737b801c4b5",
  id: "neutral-hypothesis",
  version: "1.0",
  status: "DRAFT" as const,
  mode: "NEUTRAL" as const,
  parameters: {},
  createdAt: "2026-08-30T12:00:00.000Z",
};

interface CliResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runCli(args: string[]): CliResult {
  return spawnSync(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  }) as CliResult;
}

describe("strategy lifecycle registry", () => {
  it("allows only the lifecycle from the PRD and marks only production eligible", () => {
    expect(canTransitionStrategy("DRAFT", "EXPLORATORY")).toBe(true);
    expect(canTransitionStrategy("VALIDATED", "REJECTED")).toBe(true);
    expect(canTransitionStrategy("DRAFT", "PRODUCTION")).toBe(false);
    expect(canTransitionStrategy("PRODUCTION", "VALIDATED")).toBe(false);
    expect(createStrategyTransition(draft, "1.1", "EXPLORATORY")).toMatchObject({
      status: "EXPLORATORY",
      previousRecordId: draft.recordId,
      mode: "NEUTRAL",
    });
    expect(() => createStrategyTransition(draft, "1.1", "PRODUCTION")).toThrow();
    expect(isEligibleForAutomaticGeneration({ status: "PRODUCTION" })).toBe(true);
    expect(isEligibleForAutomaticGeneration({ status: "VALIDATED" })).toBe(false);
  });

  it("persists immutable versions and exposes their lifecycle through the local CLI", () => {
    const directory = mkdtempSync(join(tmpdir(), "boloes-strategy-registry-"));
    const path = join(directory, "app.sqlite");
    const parametersPath = join(directory, "parameters.json");
    writeFileSync(parametersPath, JSON.stringify({}));

    const created = runCli([
      "strategy", "create", "--id", "neutral-hypothesis", "--version", "1.0",
      "--mode", "NEUTRAL", "--parameters", parametersPath, "--db", path,
    ]);
    expect(created.status, created.stderr).toBe(0);
    const first = JSON.parse(created.stdout).strategy;
    expect(first).toMatchObject({ id: "neutral-hypothesis", version: "1.0", status: "DRAFT" });

    const transitioned = runCli([
      "strategy", "transition", "--id", "neutral-hypothesis", "--from-version", "1.0",
      "--version", "1.1", "--to", "EXPLORATORY", "--db", path,
    ]);
    expect(transitioned.status, transitioned.stderr).toBe(0);
    const second = JSON.parse(transitioned.stdout).strategy;
    expect(second).toMatchObject({ version: "1.1", status: "EXPLORATORY", previousRecordId: first.recordId });
    expect(getLatestStrategyConfigVersion(path, "neutral-hypothesis")?.recordId).toBe(second.recordId);

    const invalid = runCli([
      "strategy", "transition", "--id", "neutral-hypothesis", "--from-version", "1.0",
      "--version", "2.0", "--to", "PRODUCTION", "--db", path,
    ]);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("Transição de estratégia inválida");
    const directInput = {
      id: "direct-hypothesis",
      version: "1.0",
      status: "DRAFT" as const,
      mode: "NEUTRAL" as const,
      parameters: {},
    };
    const direct = persistStrategyConfigVersion(path, directInput);
    expect(direct).toMatchObject(directInput);
    expect(() => persistStrategyConfigVersion(path, directInput)).toThrow();

    const database = new Database(path);
    expect(() => database.prepare("UPDATE strategy_config_versions SET status = ? WHERE record_id = ?").run("PRODUCTION", direct.recordId)).toThrow("immutable");
    expect(() => database.prepare("DELETE FROM strategy_config_versions WHERE record_id = ?").run(direct.recordId)).toThrow("immutable");
    database.close();
  });

  it("validates advanced and manual experimental configurations without generation", () => {
    const advanced = {
      id: "advanced", version: "1", lotteryId: "lotofacil", betSize: 15, mode: "ADVANCED" as const,
      structuralAllocation: { zeroExtremes: 80, oneExtreme: 20, twoExtremes: 0, threeExtremes: 0, fourPlusExtremes: 0 },
      statisticalLabel: "NEUTRAL" as const, seed: "seed", requiresManualAcknowledgement: false,
    };
    expect(validateResolvedStrategyConfig(advanced)).toMatchObject({ diagnostics: [], eligibleForAutomaticGeneration: true });
    expect(() => validateLotofacilStructuralAllocation(advanced.structuralAllocation)).not.toThrow();
    expect(() => validateLotofacilStructuralAllocation({ ...advanced.structuralAllocation, oneExtreme: 19 })).toThrow("somar 100");
    expect(() => validateResolvedStrategyConfig({ ...advanced, structuralAllocation: undefined })).toThrow("ADVANCED exige");
    expect(() => validateResolvedStrategyConfig({ ...advanced, mode: "NEUTRAL", structuralAllocation: advanced.structuralAllocation })).toThrow("NEUTRAL não aceita");
    const directory = mkdtempSync(join(tmpdir(), "boloes-strategy-validation-"));
    const inputPath = join(directory, "advanced.json");
    writeFileSync(inputPath, JSON.stringify(advanced));
    const cliValidation = runCli(["strategy", "validate", "--input", inputPath]);
    expect(cliValidation.status, cliValidation.stderr).toBe(0);
    expect(JSON.parse(cliValidation.stdout)).toMatchObject({
      strategy: { mode: "ADVANCED", lotteryId: "lotofacil" },
      diagnostics: [],
      theoreticalStructuralMass: { lotteryId: "lotofacil" },
    });
    const comparisonPath = join(directory, "strategies.json");
    writeFileSync(comparisonPath, JSON.stringify([advanced, { ...advanced, id: "neutral", mode: "NEUTRAL", structuralAllocation: undefined }]));
    const cliComparison = runCli(["strategy", "compare", "--input", comparisonPath]);
    expect(cliComparison.status, cliComparison.stderr).toBe(0);
    const comparison = JSON.parse(cliComparison.stdout);
    expect(comparison).toMatchObject({ persisted: false, portfolioGenerated: false });
    expect(comparison.comparison[0]).toMatchObject({ id: "advanced" });
    expect(comparison.comparison[0].structuralAllocation[0]).toMatchObject({ key: "zeroExtremes", requestedPercent: 80 });
    expect(comparison.comparison[1]).toMatchObject({ id: "neutral", mode: "NEUTRAL", structuralAllocation: null });
    expect(() => validateResolvedStrategyConfig({ ...advanced, hypothesisRefs: [{ id: "h", version: "1", status: "DRAFT" }] })).toThrow("MANUAL_EXPERIMENTAL");
    const experimental = validateResolvedStrategyConfig({ ...advanced, mode: "MANUAL_EXPERIMENTAL", statisticalLabel: "MANUAL_EXPERIMENTAL", requiresManualAcknowledgement: true, hypothesisRefs: [{ id: "h", version: "1", status: "DRAFT" }] });
    expect(experimental.diagnostics[0]).toContain("EXPERIMENTAL");
    expect(experimental.eligibleForAutomaticGeneration).toBe(false);
    expect(isResolvedStrategyEligibleForAutomaticGeneration(experimental.strategy)).toBe(false);
  }, 15_000);
});
