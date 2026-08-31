import {
  type ApprovedStrategyConfig,
  type StrategyConfigVersion,
  type StrategyStatus,
  resolvedStrategyConfigSchema,
  type ResolvedStrategyConfig,
} from "@boloes/lottery-contracts";

const allowedTransitions: Readonly<Record<StrategyStatus, readonly StrategyStatus[]>> = {
  DRAFT: ["EXPLORATORY"],
  EXPLORATORY: ["VALIDATING"],
  VALIDATING: ["HOLDOUT"],
  HOLDOUT: ["VALIDATED"],
  VALIDATED: ["PRODUCTION", "REJECTED"],
  PRODUCTION: [],
  REJECTED: [],
};

export function canTransitionStrategy(
  from: StrategyStatus,
  to: StrategyStatus,
): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function createStrategyTransition(
  previous: StrategyConfigVersion,
  version: string,
  status: StrategyStatus,
): ApprovedStrategyConfig & { readonly previousRecordId: string } {
  if (!canTransitionStrategy(previous.status, status)) {
    throw new Error(`Transição de estratégia inválida: ${previous.status} → ${status}.`);
  }
  return {
    id: previous.id,
    version,
    status,
    mode: previous.mode,
    parameters: previous.parameters,
    previousRecordId: previous.recordId,
  };
}

export function isEligibleForAutomaticGeneration(
  strategy: Pick<ApprovedStrategyConfig, "status">,
): boolean {
  return strategy.status === "PRODUCTION";
}

export interface StrategyValidationResult {
  readonly strategy: ResolvedStrategyConfig;
  readonly diagnostics: readonly string[];
  readonly eligibleForAutomaticGeneration: boolean;
}

/** A manually selected experimental rule is never an automatic recommendation. */
export function isResolvedStrategyEligibleForAutomaticGeneration(
  strategy: Pick<ResolvedStrategyConfig, "mode" | "hypothesisRefs">,
): boolean {
  return strategy.mode !== "MANUAL_EXPERIMENTAL"
    && !(strategy.hypothesisRefs?.some((reference) => reference.status !== "PRODUCTION") ?? false);
}

export function validateResolvedStrategyConfig(input: ResolvedStrategyConfig): StrategyValidationResult {
  const strategy = resolvedStrategyConfigSchema.parse(input);
  const diagnostics: string[] = [];
  if (strategy.mode === "NEUTRAL" && strategy.structuralAllocation) {
    throw new Error("NEUTRAL não aceita alocação estrutural manual.");
  }
  if (strategy.mode === "ADVANCED" && !strategy.structuralAllocation) {
    throw new Error("ADVANCED exige alocação estrutural explícita.");
  }
  const nonProduction = strategy.hypothesisRefs?.some((reference) => reference.status !== "PRODUCTION") ?? false;
  if (nonProduction && strategy.mode !== "MANUAL_EXPERIMENTAL") throw new Error("Hipótese não PRODUCTION exige MANUAL_EXPERIMENTAL.");
  if (strategy.mode === "MANUAL_EXPERIMENTAL") {
    if (!strategy.requiresManualAcknowledgement) throw new Error("MANUAL_EXPERIMENTAL exige reconhecimento manual.");
    if (strategy.statisticalLabel !== "MANUAL_EXPERIMENTAL") throw new Error("MANUAL_EXPERIMENTAL exige rótulo experimental.");
    diagnostics.push("ESTRATÉGIA MANUAL EXPERIMENTAL: não representa vantagem preditiva.");
  }
  return { strategy, diagnostics, eligibleForAutomaticGeneration: isResolvedStrategyEligibleForAutomaticGeneration(strategy) };
}
