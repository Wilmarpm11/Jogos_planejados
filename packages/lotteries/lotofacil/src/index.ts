import {
  CANONICAL_BET_EXPANSION_ALGORITHM_VERSION,
  CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
  DEFAULT_RARITY_THRESHOLDS,
  EXACT_COVERAGE_TIERS,
  OPERATIONAL_COST_AND_QUOTAS_ALGORITHM_VERSION,
  OPERATIONAL_COST_AND_QUOTAS_CANDIDATE_ORDERING_VERSION,
  OPERATIONAL_COST_AND_QUOTAS_CONTRACT_VERSION,
  OPERATIONAL_COST_DEFAULT_FEE_BPS,
  OPERATIONAL_COST_FEE_ROUNDING_RULE,
  OPERATIONAL_COST_FEE_SCALE_BPS,
  OPERATIONAL_COST_MAXIMUM_FEE_BPS,
  OPERATIONAL_COST_QUOTA_DIVISION_RULE,
  STRUCTURAL_BAND_ORDER,
  AmbiguousPurchasedCostBaseError,
  HeterogeneousPurchasedCostPortfolioError,
  IncompatibleOperationalCostCatalogError,
  InvalidOperationalCostAndQuotasRequestError,
  InvalidPurchasedCostBetError,
  InvalidQuotaIdsError,
  InvalidServiceFeeBpsError,
  LOTOFACIL_STRUCTURAL_ARTIFACT_SCHEMA_VERSION,
  LOTOFACIL_STRUCTURAL_CANONICAL_SERIALIZATION_VERSION,
  LOTOFACIL_STRUCTURAL_CANCELLATION_BATCH_SIZE,
  LOTOFACIL_STRUCTURAL_CLASSIFIER_V2_VERSION,
  LOTOFACIL_STRUCTURAL_DERIVATION_ALGORITHM,
  LOTOFACIL_STRUCTURAL_DERIVATION_ALGORITHM_VERSION,
  LOTOFACIL_STRUCTURAL_FORMULA_VERSION,
  LOTOFACIL_STRUCTURAL_MASS_V2_ALGORITHM_VERSION,
  LOTOFACIL_STRUCTURAL_MAX_COMBINATION_VISITS,
  LOTOFACIL_STRUCTURAL_POLICY_CONTRACT_VERSION,
  LOTOFACIL_STRUCTURAL_POLICY_SET_ID,
  LOTOFACIL_STRUCTURAL_POLICY_SET_VERSION,
  LOTOFACIL_STRUCTURAL_POLICY_VERSION,
  LOTOFACIL_STRUCTURAL_PROGRESS_INTERVAL,
  StructuralArtifactHashMismatchError,
  StructuralMassReconciliationFailedError,
  StructuralPolicyBuildCancelledError,
  StructuralPolicyDependencyMismatchError,
  StructuralPolicyLimitDerivationFailedError,
  UnsupportedOperationalCostLotteryError,
  type AxisName,
  type AxisOccupancy,
  type AxisOccupancyMetric,
  type AxisRarityAssessment,
  createDeterministicRandom,
  canonicalBetExpansionRequestSchema,
  lotteryDefinitionSchema,
  lotofacilOperationalCostAndQuotasRequestSchema,
  operationalCostCanonicalBetSchema,
  validateCanonicalBetExpansionResult,
  validateLotofacilOperationalCostAndQuotasResult,
  type ExpandedCoverageCompositionExpansionAdapter,
  type CanonicalBetExpansionResult,
  type ExactFraction,
  type ExactCoverageAdapter,
  type RarityClass,
  type RarityThresholds,
  type LotteryDefinition,
  type LotteryMetricEngine,
  type LotofacilOperationalCostAndQuotasRequest,
  type LotofacilOperationalCostAndQuotasResult,
  type OperationalCostAndQuotasAdapter,
  type OperationalCostAndQuotasCalculationResult,
  type PreparedOperationalCostAndQuotasRequest,
  type PortfolioGenerationRequest,
  type PortfolioGenerationResult,
  type PortfolioGenerator,
  type PortfolioDiversityOptimizationAdapter,
  type PortfolioStructuralDistributionAdapter,
  type StructuralClassifier,
  type StructuralBand,
  type StructuralMassProfile,
  type StructuralRuleFlag,
  type StructuralSummary,
  type TheoreticalAxisDistribution,
  type TheoreticalDistributionBucket,
  lotofacilCatalogRecordSchema,
  lotofacilStructuralMassArtifactSchema,
  lotofacilStructuralPolicyProgressSchema,
  lotofacilStructuralPolicySchema,
  lotofacilStructuralPolicySetIndexSchema,
  lotofacilStructuralPolicySetSchema,
  type LotofacilStructuralMassArtifact,
  type LotofacilStructuralPolicy,
  type LotofacilStructuralPolicyProgress,
  type LotofacilStructuralPolicySet,
} from "@boloes/lottery-contracts";
import {
  binomialCoefficient,
  CombinationIterationCancelledError,
  createCombinationRanker,
  forEachCombination,
  forEachCombinationAsync,
} from "@boloes/combinatorics";
import {
  CONTRACT_VERSION,
  HASH_ALGORITHM,
  HASH_VERSION,
} from "@boloes/domain-core";
import { createHash } from "node:crypto";

function deepFreeze<T extends object>(value: T): T {
  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    if (typeof nestedValue === "object" && nestedValue !== null) deepFreeze(nestedValue);
  }
  return Object.freeze(value);
}

function cloneNestedRecord<T extends Readonly<Record<string, Readonly<Record<string, unknown>>>>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, { ...nestedValue }]),
  ) as unknown as T;
}

export const LOTOFACIL_ID = "lotofacil";
export const LOTOFACIL_METRIC_ENGINE_VERSION = "1.0.0";
export const LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION = "1.0.0";
export const LOTOFACIL_STRUCTURAL_MASS_ALGORITHM_VERSION = "1.0.0";
export const LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION = "1.0.0";
export const LOTOFACIL_EXACT_COVERAGE_ADAPTER_VERSION = "lotofacil-exact-coverage/1.0.0";
export const LOTOFACIL_CANONICAL_BET_EXPANSION_ADAPTER_VERSION =
  "lotofacil-canonical-bet-expansion/1.0.0";
export const LOTOFACIL_DIVERSITY_OPTIMIZATION_ADAPTER_VERSION =
  "lotofacil-diversity-optimization/1.0.0";
export const LOTOFACIL_CANONICAL_GAME_ORDER_VERSION =
  "locale-compare-of-comma-joined-canonical-games/1.0.0";
export const LOTOFACIL_OPERATIONAL_COST_CANDIDATE_ORDERING_VERSION =
  OPERATIONAL_COST_AND_QUOTAS_CANDIDATE_ORDERING_VERSION;
export const LOTOFACIL_STRUCTURAL_ALLOCATION_ALGORITHM_VERSION =
  "lotofacil-largest-remainder/1.0.0";
export const LOTOFACIL_CANONICAL_FORMULA_VERSION = "1.0.0";
export const LOTOFACIL_SUPPORTED_BET_SIZES = [15, 16, 17, 18, 19, 20] as const;
const LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE = 3_268_760;
const STRUCTURAL_ALLOCATION_PERCENTAGE = 100;
export const LOTOFACIL_DEFINITION: LotteryDefinition = {
  id: LOTOFACIL_ID,
  version: "1.0.0",
  totalNumbers: 25,
  drawSize: 15,
  minBetSize: 15,
  maxBetSize: 20,
};
export const LOTOFACIL_BORDER_NUMBERS = [
  1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25,
] as const;
export const LOTOFACIL_CENTER_NUMBERS = [7, 8, 9, 12, 13, 14, 17, 18, 19] as const;

export type LotofacilBetSize = (typeof LOTOFACIL_SUPPORTED_BET_SIZES)[number];

export interface LotofacilAxisOccupancyProfile {
  readonly betSize: LotofacilBetSize;
  readonly rows: AxisOccupancy;
  readonly columns: AxisOccupancy;
}

export interface LotofacilTheoreticalAxisProfile {
  readonly betSize: LotofacilBetSize;
  readonly algorithmVersion: string;
  readonly totalOutcomes: number;
  readonly distributions: readonly TheoreticalAxisDistribution[];
}

export type LotofacilExtremeRuleId =
  | "E1"
  | "E2"
  | "E3"
  | "E4"
  | "E5"
  | "E6"
  | "E7"
  | "E8"
  | "E9"
  | "E10";

export type LotofacilAxisAuxiliarySignal =
  | "NONE"
  | "ATTENTION"
  | "RARE"
  | "VERY_RARE";

export interface LotofacilAxisAuxiliaryClassification {
  readonly applicable: boolean;
  readonly signal: LotofacilAxisAuxiliarySignal | null;
}

export interface LotofacilStructuralClassification {
  readonly classifierVersion: string;
  readonly extremeRules: Readonly<Record<LotofacilExtremeRuleId, StructuralRuleFlag>>;
  readonly auxiliaryAxisSignals: Readonly<{
    rows: LotofacilAxisAuxiliaryClassification;
    columns: LotofacilAxisAuxiliaryClassification;
  }>;
}

export interface LotofacilStructuralSummary extends StructuralSummary {
  readonly centralCoreCriteria: Readonly<{
    evenCount: boolean;
    sum: boolean;
    borderCount: boolean;
    lowCount: boolean;
    consecutivePairCount: boolean;
  }> | null;
}

export interface LotofacilStructuralMassProfile extends StructuralMassProfile {
  readonly lotteryId: typeof LOTOFACIL_ID;
  readonly betSize: 15;
}

export interface LotofacilCoreMetrics {
  readonly evenCount: number;
  readonly oddCount: number;
  readonly sum: number;
  readonly lowCount: number;
  readonly highCount: number;
  readonly borderCount: number;
  readonly centerCount: number;
  readonly consecutivePairCount: number;
  readonly maxConsecutiveRun: number;
  readonly sequenceCount: number;
  readonly amplitude: number;
}

export interface LotofacilMetricProfile {
  readonly metricEngineVersion: string;
  readonly lotteryDefinition: LotteryDefinition;
  readonly selectedNumbers: readonly number[];
  readonly betSize: LotofacilBetSize;
  readonly metrics: LotofacilCoreMetrics;
  readonly axisOccupancy: LotofacilAxisOccupancyProfile;
}

export const LOTOFACIL_CANONICAL_METRICS = [
  "evenCount",
  "oddCount",
  "sum",
  "lowCount",
  "highCount",
  "borderCount",
  "centerCount",
  "consecutivePairCount",
  "maxConsecutiveRun",
  "sequenceCount",
  "amplitude",
  "axisOccupancy",
] as const;

/** Special draw membership is explicit data, never inferred by this module. */
export const LOTOFACIL_SPECIAL_DRAW_TYPES = ["LOTOFACIL_INDEPENDENCIA"] as const;
export type LotofacilSpecialDrawType = (typeof LOTOFACIL_SPECIAL_DRAW_TYPES)[number];

export const LOTOFACIL_STRUCTURAL_ALLOCATION_KEYS = ["zeroExtremes", "oneExtreme", "twoExtremes", "threeExtremes", "fourPlusExtremes"] as const;

export function validateLotofacilStructuralAllocation(allocation: Readonly<Record<string, number>>): void {
  const keys = Object.keys(allocation).sort();
  if (keys.join(",") !== [...LOTOFACIL_STRUCTURAL_ALLOCATION_KEYS].sort().join(",")) throw new Error("A alocação Lotofácil deve conter as cinco faixas estruturais.");
  const values = Object.values(allocation);
  if (!values.every((value) => Number.isFinite(value) && value >= 0)) throw new Error("A alocação estrutural não pode conter valores negativos ou não finitos.");
  if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) > 1e-9) throw new Error("A alocação estrutural deve somar 100.");
}

const lotofacilAllocationBand: Readonly<Record<(typeof LOTOFACIL_STRUCTURAL_ALLOCATION_KEYS)[number], StructuralBand>> = {
  zeroExtremes: "ZERO_EXTREMES",
  oneExtreme: "ONE_EXTREME",
  twoExtremes: "TWO_EXTREMES",
  threeExtremes: "THREE_EXTREMES",
  fourPlusExtremes: "FOUR_PLUS_EXTREMES",
};

/** Pure comparison reference: requested allocation against the neutral mass. */
export function summarizeLotofacilStructuralAllocation(allocation: Readonly<Record<string, number>>) {
  validateLotofacilStructuralAllocation(allocation);
  const mass = LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT;
  return LOTOFACIL_STRUCTURAL_ALLOCATION_KEYS.map((key) => ({
    key,
    requestedPercent: allocation[key],
    theoreticalMass: mass.buckets.find((bucket) => bucket.band === lotofacilAllocationBand[key])!,
  }));
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function combinationCount(totalItems: number, selectionSize: number): number {
  let result = 1;
  for (let index = 1; index <= selectionSize; index += 1) {
    result = (result * (totalItems - selectionSize + index)) / index;
  }
  return result;
}

function unrankLotofacilSimpleBet(rank: number): readonly number[] {
  let remainingRank = rank;
  let remainingNumbers = LOTOFACIL_DEFINITION.drawSize;
  let minimumCandidate = 1;
  const selected: number[] = [];

  while (remainingNumbers > 0) {
    for (let candidate = minimumCandidate; candidate <= LOTOFACIL_DEFINITION.totalNumbers - remainingNumbers + 1; candidate += 1) {
      const combinationsAfterCandidate = combinationCount(
        LOTOFACIL_DEFINITION.totalNumbers - candidate,
        remainingNumbers - 1,
      );
      if (remainingRank < combinationsAfterCandidate) {
        selected.push(candidate);
        minimumCandidate = candidate + 1;
        remainingNumbers -= 1;
        break;
      }
      remainingRank -= combinationsAfterCandidate;
    }
  }
  return selected;
}

export function calculateLotofacilStructuralAllocationCounts(
  allocation: Readonly<Record<string, number>>,
  candidateCount: number,
): Readonly<Record<StructuralBand, number>> {
  validateLotofacilStructuralAllocation(allocation);
  const entries = LOTOFACIL_STRUCTURAL_ALLOCATION_KEYS.map((key, index) => {
    const exact = (allocation[key]! * candidateCount) / STRUCTURAL_ALLOCATION_PERCENTAGE;
    return { band: lotofacilAllocationBand[key], count: Math.floor(exact), remainder: exact % 1, index };
  });
  let unallocated = candidateCount - entries.reduce((sum, entry) => sum + entry.count, 0);
  for (const entry of [...entries].sort((left, right) => right.remainder - left.remainder || left.index - right.index)) {
    if (unallocated === 0) break;
    entry.count += 1;
    unallocated -= 1;
  }
  return Object.fromEntries(entries.map((entry) => [entry.band, entry.count])) as Readonly<Record<StructuralBand, number>>;
}

function isLotofacilDefinition(definition: LotteryDefinition): boolean {
  return definition.id === LOTOFACIL_DEFINITION.id &&
    definition.version === LOTOFACIL_DEFINITION.version &&
    definition.totalNumbers === LOTOFACIL_DEFINITION.totalNumbers &&
    definition.drawSize === LOTOFACIL_DEFINITION.drawSize &&
    definition.minBetSize === LOTOFACIL_DEFINITION.minBetSize &&
    definition.maxBetSize === LOTOFACIL_DEFINITION.maxBetSize;
}

export function compareLotofacilCanonicalGames(
  left: readonly number[],
  right: readonly number[],
): number {
  return left.join(",").localeCompare(right.join(","));
}

/** Story 4.10-only ordinal ordering; the Story 4.9 comparator remains unchanged. */
export function compareLotofacilOperationalCostGames(
  left: readonly number[],
  right: readonly number[],
): number {
  const leftKey = left.join(",");
  const rightKey = right.join(",");
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

interface LotofacilOperationalCostContext {
  readonly request: LotofacilOperationalCostAndQuotasRequest;
  readonly betSize: number;
  readonly bets: readonly { readonly numbers: readonly number[] }[];
  readonly unitPriceCents: number;
  readonly minShares: number;
  readonly maxShares: number;
}

const operationalCostRequestKeys = new Set([
  "contractVersion",
  "lotteryDefinition",
  "contestNumber",
  "catalog",
  "purchasedBase",
  "quotaIds",
  "feeBps",
]);
const operationalCostRequiredRequestKeys = [
  "contractVersion",
  "lotteryDefinition",
  "contestNumber",
  "catalog",
  "purchasedBase",
  "quotaIds",
] as const;

function isOperationalCostRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function prepareLotofacilOperationalCostRequest(
  input: unknown,
): PreparedOperationalCostAndQuotasRequest<LotofacilOperationalCostContext> {
  if (
    !isOperationalCostRecord(input) ||
    Object.keys(input).some((key) => !operationalCostRequestKeys.has(key)) ||
    operationalCostRequiredRequestKeys.some((key) => !(key in input)) ||
    input.contractVersion !== OPERATIONAL_COST_AND_QUOTAS_CONTRACT_VERSION ||
    !Number.isSafeInteger(input.contestNumber) ||
    (input.contestNumber as number) <= 0
  ) {
    throw new InvalidOperationalCostAndQuotasRequestError();
  }

  const definition = lotteryDefinitionSchema.strict().safeParse(input.lotteryDefinition);
  if (!definition.success) {
    throw new InvalidOperationalCostAndQuotasRequestError(definition.error.message);
  }
  if (!isLotofacilDefinition(definition.data)) {
    throw new UnsupportedOperationalCostLotteryError();
  }

  const feeBps = "feeBps" in input ? input.feeBps : OPERATIONAL_COST_DEFAULT_FEE_BPS;
  if (
    typeof feeBps !== "number" ||
    !Number.isInteger(feeBps) ||
    feeBps < 0 ||
    feeBps > OPERATIONAL_COST_MAXIMUM_FEE_BPS
  ) {
    throw new InvalidServiceFeeBpsError();
  }

  const catalog = lotofacilCatalogRecordSchema.safeParse(input.catalog);
  if (!catalog.success) {
    throw new IncompatibleOperationalCostCatalogError(catalog.error.message);
  }

  const purchasedBase = input.purchasedBase;
  if (
    !isOperationalCostRecord(purchasedBase) ||
    (purchasedBase.type !== "SOURCE_BETS" &&
      purchasedBase.type !== "EXPANDED_SIMPLE_BETS") ||
    !Array.isArray(purchasedBase.bets) ||
    Object.keys(purchasedBase).some((key) => key !== "type" && key !== "bets")
  ) {
    throw new AmbiguousPurchasedCostBaseError();
  }
  if (purchasedBase.bets.length === 0) throw new InvalidPurchasedCostBetError();

  const bets = purchasedBase.bets.map((bet) => {
    const parsed = operationalCostCanonicalBetSchema.safeParse(bet);
    if (!parsed.success) throw new InvalidPurchasedCostBetError(parsed.error.message);
    return parsed.data;
  });
  const betSize = bets[0]!.numbers.length;
  if (
    purchasedBase.type === "SOURCE_BETS" &&
    bets.some(({ numbers }) => numbers.length !== betSize)
  ) {
    throw new HeterogeneousPurchasedCostPortfolioError();
  }
  if (
    purchasedBase.type === "EXPANDED_SIMPLE_BETS" &&
    bets.some(({ numbers }) => numbers.length !== LOTOFACIL_DEFINITION.drawSize)
  ) {
    throw new InvalidPurchasedCostBetError(
      "EXPANDED_SIMPLE_BETS accepts only 15-number bets.",
    );
  }

  const price = catalog.data.priceByBetSize.find((entry) => entry.betSize === betSize);
  const limits = catalog.data.bolaoLimits.find((entry) => entry.betSize === betSize);
  if (!price || !limits) {
    throw new IncompatibleOperationalCostCatalogError(
      "The Lotofácil catalog lacks price or quota limits for the purchased bet size.",
    );
  }

  const quotaIds = input.quotaIds;
  if (
    !Array.isArray(quotaIds) ||
    quotaIds.length === 0 ||
    quotaIds.some((quotaId) =>
      typeof quotaId !== "number" ||
      !Number.isSafeInteger(quotaId) ||
      quotaId <= 0
    ) ||
    new Set(quotaIds).size !== quotaIds.length
  ) {
    throw new InvalidQuotaIdsError();
  }

  const request = lotofacilOperationalCostAndQuotasRequestSchema.safeParse(input);
  if (!request.success) {
    throw new InvalidOperationalCostAndQuotasRequestError(request.error.message);
  }
  return {
    calculation: {
      occurrenceCount: bets.length,
      unitPriceCents: price.priceInCents,
      feeBps,
      quotaIds: request.data.quotaIds,
      minShares: limits.minShares,
      maxShares: limits.maxShares,
    },
    context: {
      request: request.data,
      betSize,
      bets: bets
        .map(({ numbers }) => ({ numbers: [...numbers] }))
        .sort((left, right) =>
          compareLotofacilOperationalCostGames(left.numbers, right.numbers)
        ),
      unitPriceCents: price.priceInCents,
      minShares: limits.minShares,
      maxShares: limits.maxShares,
    },
  };
}

function buildLotofacilOperationalCostResult(
  prepared: PreparedOperationalCostAndQuotasRequest<LotofacilOperationalCostContext>,
  calculation: OperationalCostAndQuotasCalculationResult,
): LotofacilOperationalCostAndQuotasResult {
  const { request, betSize, bets, unitPriceCents, minShares, maxShares } = prepared.context;
  return {
    contractVersion: OPERATIONAL_COST_AND_QUOTAS_CONTRACT_VERSION,
    algorithmVersion: OPERATIONAL_COST_AND_QUOTAS_ALGORITHM_VERSION,
    lottery: {
      id: request.lotteryDefinition.id,
      definitionVersion: request.lotteryDefinition.version,
    },
    contestNumber: request.contestNumber,
    catalogProvenance: {
      catalogRecordId: request.catalog.id,
      sourceSnapshotId: request.catalog.sourceSnapshotId,
      sourceUrl: request.catalog.sourceUrl,
      parserVersion: request.catalog.parserVersion,
      validations: [...request.catalog.validations],
      persistedAt: request.catalog.persistedAt,
    },
    purchasedBase: {
      type: request.purchasedBase.type,
      betSize,
      occurrenceCount: prepared.calculation.occurrenceCount,
      unitPriceCents,
      candidateOrderingVersion: LOTOFACIL_OPERATIONAL_COST_CANDIDATE_ORDERING_VERSION,
      bets: bets.map(({ numbers }) => ({ numbers: [...numbers] })),
    },
    officialCostCents: calculation.officialCostCents,
    fee: {
      feeBps: prepared.calculation.feeBps,
      feeScaleBps: OPERATIONAL_COST_FEE_SCALE_BPS,
      base: "OFFICIAL_COST_OF_EFFECTIVELY_PURCHASED_PORTFOLIO",
      roundingRule: OPERATIONAL_COST_FEE_ROUNDING_RULE,
      feeCents: calculation.feeCents,
    },
    totalCents: calculation.totalCents,
    quotaAllocation: {
      quotaCount: prepared.calculation.quotaIds.length,
      baseQuotaCents: calculation.baseQuotaCents,
      remainderCents: calculation.remainderCents,
      distributionRule: OPERATIONAL_COST_QUOTA_DIVISION_RULE,
      appliedCaixaShareLimits: {
        betSize,
        minShares,
        maxShares,
        maxGamesPerReceiptApplied: false,
      },
      quotas: calculation.quotas.map((quota) => ({ ...quota })),
    },
    transient: true,
    persisted: false,
    frozen: false,
    portfolioStateChanged: false,
    paymentPerformed: false,
  };
}

/** Lotofácil normalization/result bridge around the modality-neutral Story 4.10 engine. */
export const lotofacilOperationalCostAndQuotasAdapter:
  OperationalCostAndQuotasAdapter<
    LotofacilOperationalCostContext,
    LotofacilOperationalCostAndQuotasResult
  > = {
  prepare: prepareLotofacilOperationalCostRequest,
  buildResult: buildLotofacilOperationalCostResult,
  validateResult(prepared, result) {
    try {
      return validateLotofacilOperationalCostAndQuotasResult(
        prepared.context.request,
        result,
      );
    } catch (error) {
      throw new InvalidOperationalCostAndQuotasRequestError(
        error instanceof Error
          ? error.message
          : "The calculated result violates its public contract.",
      );
    }
  },
};

/** Expands one canonical Lotofácil source bet into all simple 15-number bets. */
export function expandLotofacilCanonicalBet(
  input: unknown,
): CanonicalBetExpansionResult {
  const request = canonicalBetExpansionRequestSchema.parse(input);
  if (!isLotofacilDefinition(request.lotteryDefinition)) {
    throw new Error("Lotofácil expansion requires the canonical 25/15 definition version 1.0.0.");
  }

  const sourceNumbers = request.sourceBet.numbers;
  if (!isSupportedBetSize(sourceNumbers.length)) {
    throw new Error("Lotofácil expansion supports source bets with 15 to 20 numbers.");
  }

  const candidates: Array<{ numbers: number[] }> = [];
  forEachCombination(sourceNumbers.length, LOTOFACIL_DEFINITION.drawSize, (indexes) => {
    candidates.push({ numbers: indexes.map((index) => sourceNumbers[index]!) });
  });

  return validateCanonicalBetExpansionResult(request, {
    contractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
    algorithmVersion: CANONICAL_BET_EXPANSION_ALGORITHM_VERSION,
    lottery: {
      id: LOTOFACIL_ID,
      definitionVersion: LOTOFACIL_DEFINITION.version,
    },
    sourceBet: { numbers: [...sourceNumbers] },
    sourceBetSize: sourceNumbers.length,
    simpleBetSize: LOTOFACIL_DEFINITION.drawSize,
    expectedCandidateCount: binomialCoefficient(
      sourceNumbers.length,
      LOTOFACIL_DEFINITION.drawSize,
    ),
    candidates,
    transient: true,
    persisted: false,
    frozen: false,
    coverageCalculated: false,
    portfolioStateChanged: false,
  });
}

export const lotofacilCanonicalBetExpansionAdapter:
  ExpandedCoverageCompositionExpansionAdapter = {
  lotteryId: LOTOFACIL_ID,
  adapterVersion: LOTOFACIL_CANONICAL_BET_EXPANSION_ADAPTER_VERSION,
  supportsDefinition: isLotofacilDefinition,
  expand: expandLotofacilCanonicalBet,
};

/**
 * Generates a transient deterministic set of Lotofácil simple bets. Neutral
 * mode walks the seeded permutation without structural filtering; a supplied
 * structural allocation is the only selection constraint applied.
 */
export function generateLotofacilPortfolio(
  input: PortfolioGenerationRequest,
): PortfolioGenerationResult {
  const { lotteryDefinition, strategy, parameters } = input;
  if (!isLotofacilDefinition(lotteryDefinition) || strategy.lotteryId !== LOTOFACIL_ID) {
    throw new Error("The Lotofácil generator requires the canonical Lotofácil definition and strategy.");
  }
  if (strategy.betSize !== LOTOFACIL_DEFINITION.drawSize) {
    throw new Error("The Lotofácil structural generator currently supports only 15-number simple bets.");
  }
  if (parameters.candidateCount > LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE) {
    throw new Error("Requested candidates exceed the Lotofácil simple-bet universe.");
  }

  const targets = strategy.structuralAllocation
    ? calculateLotofacilStructuralAllocationCounts(
      strategy.structuralAllocation,
      parameters.candidateCount,
    )
    : null;
  const random = createDeterministicRandom(parameters.seed);
  const offset = random.nextInt(LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE);
  let step = random.nextInt(LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE - 1) + 1;
  while (greatestCommonDivisor(step, LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE) !== 1) step += 1;
  if (step === LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE) step = 1;

  const candidates: number[][] = [];
  const allocated: Record<StructuralBand, number> = {
    ZERO_EXTREMES: 0, ONE_EXTREME: 0, TWO_EXTREMES: 0, THREE_EXTREMES: 0, FOUR_PLUS_EXTREMES: 0,
  };
  for (let position = 0; position < LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE && candidates.length < parameters.candidateCount; position += 1) {
    const rank = (offset + step * position) % LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE;
    const numbers = unrankLotofacilSimpleBet(rank);
    if (targets) {
      const profile = calculateLotofacilMetricProfile(numbers);
      const summary = summarizeLotofacilStructuralProfile(profile, classifyLotofacilStructuralProfile(profile));
      if (!summary.band || allocated[summary.band] >= targets[summary.band]) continue;
      allocated[summary.band] += 1;
    }
    candidates.push([...numbers]);
  }
  if (candidates.length !== parameters.candidateCount) {
    throw new Error("The requested structural allocation cannot be fulfilled by the Lotofácil universe.");
  }

  return {
    candidates: candidates.sort(compareLotofacilCanonicalGames).map((numbers) => ({ numbers })),
    transient: true,
    persisted: false,
    frozen: false,
    coverageCalculated: false,
    probabilityClaimed: false,
  };
}

export const lotofacilPortfolioGenerator: PortfolioGenerator = {
  generate: generateLotofacilPortfolio,
};

export const LOTOFACIL_EXTREME_RULE_LIMITS = deepFreeze({
  E1: { metric: "evenCount", atMost: 4, atLeast: 11 },
  E2: { metric: "sum", atMost: 149, atLeast: 241 },
  E3: { metric: "borderCount", atMost: 6, atLeast: 14 },
  E4: { metric: "lowCount", atMost: 4, atLeast: 12 },
  E5: { metric: "consecutivePairCount", atMost: 5, atLeast: 12 },
  E6: { metric: "maxConsecutiveRun", atMost: 2, atLeast: 9 },
  E7: { metric: "sequenceCount", atMost: 1, atLeast: 7 },
  E8: { metric: "amplitude", atMost: 18 },
  E9: { axis: "ROWS", deviationAtLeast: 8 },
  E10: { axis: "COLUMNS", deviationAtLeast: 8 },
} as const);

export const LOTOFACIL_CENTRAL_CORE_LIMITS = deepFreeze({
  evenCount: { min: 6, max: 9 },
  sum: { min: 176, max: 214 },
  borderCount: { min: 8, max: 12 },
  lowCount: { min: 7, max: 10 },
  consecutivePairCount: { min: 7, max: 10 },
} as const);

type LotofacilPolicyMetricId =
  | "EVEN_COUNT"
  | "SUM"
  | "BORDER_COUNT"
  | "LOW_01_TO_13_COUNT"
  | "CONSECUTIVE_PAIR_COUNT"
  | "MAX_CONSECUTIVE_RUN"
  | "SEQUENCE_COUNT"
  | "AMPLITUDE"
  | "ROW_DEVIATION_NORMALIZED"
  | "COLUMN_DEVIATION_NORMALIZED";

interface InternalPolicyTail {
  readonly operator: "LESS_THAN" | "LESS_THAN_OR_EQUAL" | "GREATER_THAN" | "GREATER_THAN_OR_EQUAL";
  readonly numerator: number;
  readonly denominator: number;
}

interface InternalRulePolicy {
  readonly ruleId: LotofacilExtremeRuleId;
  readonly metric: LotofacilPolicyMetricId;
  readonly tails: readonly InternalPolicyTail[];
}

interface InternalCentralCorePolicy {
  readonly metric: Exclude<LotofacilPolicyMetricId,
    "MAX_CONSECUTIVE_RUN" | "SEQUENCE_COUNT" | "AMPLITUDE" |
    "ROW_DEVIATION_NORMALIZED" | "COLUMN_DEVIATION_NORMALIZED">;
  readonly minInclusive: number;
  readonly maxInclusive: number;
}

interface InternalStructuralPolicy {
  readonly betSize: LotofacilBetSize;
  readonly classifierVersion: string;
  readonly rules: readonly InternalRulePolicy[];
  readonly centralCore: readonly InternalCentralCorePolicy[];
}

function asInternalTail(
  operator: InternalPolicyTail["operator"],
  value: number,
): InternalPolicyTail {
  return { operator, numerator: value, denominator: 1 };
}

const LOTOFACIL_LEGACY_INTERNAL_POLICY = deepFreeze({
  betSize: 15,
  classifierVersion: LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION,
  rules: [
    { ruleId: "E1", metric: "EVEN_COUNT", tails: [asInternalTail("LESS_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E1.atMost), asInternalTail("GREATER_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E1.atLeast)] },
    { ruleId: "E2", metric: "SUM", tails: [asInternalTail("LESS_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E2.atMost), asInternalTail("GREATER_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E2.atLeast)] },
    { ruleId: "E3", metric: "BORDER_COUNT", tails: [asInternalTail("LESS_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E3.atMost), asInternalTail("GREATER_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E3.atLeast)] },
    { ruleId: "E4", metric: "LOW_01_TO_13_COUNT", tails: [asInternalTail("LESS_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E4.atMost), asInternalTail("GREATER_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E4.atLeast)] },
    { ruleId: "E5", metric: "CONSECUTIVE_PAIR_COUNT", tails: [asInternalTail("LESS_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E5.atMost), asInternalTail("GREATER_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E5.atLeast)] },
    { ruleId: "E6", metric: "MAX_CONSECUTIVE_RUN", tails: [asInternalTail("LESS_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E6.atMost), asInternalTail("GREATER_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E6.atLeast)] },
    { ruleId: "E7", metric: "SEQUENCE_COUNT", tails: [asInternalTail("LESS_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E7.atMost), asInternalTail("GREATER_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E7.atLeast)] },
    { ruleId: "E8", metric: "AMPLITUDE", tails: [asInternalTail("LESS_THAN_OR_EQUAL", LOTOFACIL_EXTREME_RULE_LIMITS.E8.atMost)] },
    { ruleId: "E9", metric: "ROW_DEVIATION_NORMALIZED", tails: [{ operator: "GREATER_THAN_OR_EQUAL", numerator: LOTOFACIL_EXTREME_RULE_LIMITS.E9.deviationAtLeast, denominator: 15 }] },
    { ruleId: "E10", metric: "COLUMN_DEVIATION_NORMALIZED", tails: [{ operator: "GREATER_THAN_OR_EQUAL", numerator: LOTOFACIL_EXTREME_RULE_LIMITS.E10.deviationAtLeast, denominator: 15 }] },
  ],
  centralCore: [
    { metric: "EVEN_COUNT", minInclusive: LOTOFACIL_CENTRAL_CORE_LIMITS.evenCount.min, maxInclusive: LOTOFACIL_CENTRAL_CORE_LIMITS.evenCount.max },
    { metric: "SUM", minInclusive: LOTOFACIL_CENTRAL_CORE_LIMITS.sum.min, maxInclusive: LOTOFACIL_CENTRAL_CORE_LIMITS.sum.max },
    { metric: "BORDER_COUNT", minInclusive: LOTOFACIL_CENTRAL_CORE_LIMITS.borderCount.min, maxInclusive: LOTOFACIL_CENTRAL_CORE_LIMITS.borderCount.max },
    { metric: "LOW_01_TO_13_COUNT", minInclusive: LOTOFACIL_CENTRAL_CORE_LIMITS.lowCount.min, maxInclusive: LOTOFACIL_CENTRAL_CORE_LIMITS.lowCount.max },
    { metric: "CONSECUTIVE_PAIR_COUNT", minInclusive: LOTOFACIL_CENTRAL_CORE_LIMITS.consecutivePairCount.min, maxInclusive: LOTOFACIL_CENTRAL_CORE_LIMITS.consecutivePairCount.max },
  ],
} satisfies InternalStructuralPolicy);

export const LOTOFACIL_AXIS_AUXILIARY_POLICY = deepFreeze({
  applicableBetSize: 15,
  priority: ["VERY_RARE", "RARE", "ATTENTION", "NONE"] as const,
  veryRare: { axesWithZeroAtLeast: 2 },
  rare: { axesWithZeroAtLeast: 1 },
  attention: { axesWithOneAtLeast: 2 },
} as const);

export interface LotofacilCanonicalFormulaManifest {
  readonly formulaVersion: typeof LOTOFACIL_CANONICAL_FORMULA_VERSION;
  readonly lotteryDefinition: LotteryDefinition;
  readonly supportedBetSizes: readonly LotofacilBetSize[];
  readonly metricEngine: Readonly<{
    version: typeof LOTOFACIL_METRIC_ENGINE_VERSION;
    metrics: typeof LOTOFACIL_CANONICAL_METRICS;
  }>;
  readonly axisOccupancy: Readonly<{
    algorithmVersion: typeof LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION;
    expectedPerAxis: "bet_size / 5";
    rarityThresholds: RarityThresholds;
    auxiliaryPolicy: typeof LOTOFACIL_AXIS_AUXILIARY_POLICY;
  }>;
  readonly structuralClassification: Readonly<{
    classifierVersion: typeof LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION;
    applicableBetSize: 15;
    nonApplicableBetSizes: readonly [16, 17, 18, 19, 20];
    extremeRuleLimits: typeof LOTOFACIL_EXTREME_RULE_LIMITS;
    centralCoreLimits: typeof LOTOFACIL_CENTRAL_CORE_LIMITS;
  }>;
  readonly structuralMass: LotofacilStructuralMassProfile;
  readonly canonicalPortfolioIdentity: Readonly<{
    contractVersion: typeof CONTRACT_VERSION;
    hashAlgorithm: typeof HASH_ALGORITHM;
    hashVersion: typeof HASH_VERSION;
    canonicalizeFunction: "canonicalizePortfolio";
    gameNumberOrdering: "ASCENDING_NUMERIC";
    portfolioGameOrdering: "LOCALE_COMPARE_OF_COMMA_JOINED_CANONICAL_GAMES";
  }>;
  readonly exclusions: readonly [
    "HISTORY",
    "RESULTS",
    "STRATEGY",
    "GENERATION",
    "COVERAGE",
    "PERSISTENCE",
  ];
}

const cachedTheoreticalProfiles = new Map<LotofacilBetSize, LotofacilTheoreticalAxisProfile>();
let cachedStructuralMassProfile: LotofacilStructuralMassProfile | undefined;

function isSupportedBetSize(value: number): value is LotofacilBetSize {
  return LOTOFACIL_SUPPORTED_BET_SIZES.includes(value as LotofacilBetSize);
}

function assertValidNumbers(numbers: readonly number[]): asserts numbers is readonly number[] {
  if (!isSupportedBetSize(numbers.length)) {
    throw new Error("Lotofácil axis occupancy only supports 15 to 20 selected numbers.");
  }

  const seen = new Set<number>();
  for (const number of numbers) {
    if (!Number.isInteger(number) || number < 1 || number > 25) {
      throw new Error("Lotofácil numbers must be integers from 1 through 25.");
    }
    if (seen.has(number)) {
      throw new Error("Lotofácil ticket numbers must be unique.");
    }
    seen.add(number);
  }
}

function reduceFraction(numerator: number, denominator: number): ExactFraction {
  let a = Math.abs(numerator);
  let b = Math.abs(denominator);
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  const divisor = a === 0 ? 1 : a;
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function axisDeviationNumerator(counts: readonly number[], betSize: LotofacilBetSize): number {
  let deviationNumerator = 0;
  for (const count of counts) {
    deviationNumerator += Math.abs(count * 5 - betSize);
  }
  return deviationNumerator;
}

function axisOccupancy(counts: readonly number[], betSize: LotofacilBetSize): AxisOccupancy {
  const tuple = [...counts] as [number, number, number, number, number];
  const axesWith = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const count of tuple) {
    axesWith[count as 0 | 1 | 2 | 3 | 4 | 5] += 1;
  }
  const deviationNumerator = axisDeviationNumerator(tuple, betSize);

  return {
    counts: tuple,
    min: Math.min(...tuple),
    max: Math.max(...tuple),
    axesWith,
    expectedPerAxis: reduceFraction(betSize, 5),
    deviation: reduceFraction(deviationNumerator, 5),
    deviationNormalized: reduceFraction(deviationNumerator, 5 * betSize),
  };
}

/**
 * Calculates the complete 5x5 grid occupancy for a valid Lotofácil ticket.
 * This method has no strategy or generator dependency.
 */
export function calculateLotofacilAxisOccupancy(
  numbers: readonly number[],
): LotofacilAxisOccupancyProfile {
  assertValidNumbers(numbers);
  const betSize = numbers.length;
  if (!isSupportedBetSize(betSize)) {
    throw new Error("Unsupported Lotofácil bet size.");
  }

  const rows = [0, 0, 0, 0, 0];
  const columns = [0, 0, 0, 0, 0];
  for (const number of numbers) {
    const rowIndex = Math.floor((number - 1) / 5);
    const columnIndex = (number - 1) % 5;
    rows[rowIndex] = rows[rowIndex]! + 1;
    columns[columnIndex] = columns[columnIndex]! + 1;
  }

  return {
    betSize,
    rows: axisOccupancy(rows, betSize),
    columns: axisOccupancy(columns, betSize),
  };
}

function initializeHistogram(): Map<number, number> {
  return new Map<number, number>();
}

function increment(histogram: Map<number, number>, value: number): void {
  histogram.set(value, (histogram.get(value) ?? 0) + 1);
}

interface LotofacilAxisDistributionAccumulator {
  readonly rowEmpty: Map<number, number>;
  readonly rowSingleton: Map<number, number>;
  readonly rowDeviationNormalized: Map<number, number>;
  readonly columnEmpty: Map<number, number>;
  readonly columnSingleton: Map<number, number>;
  readonly columnDeviationNormalized: Map<number, number>;
  totalOutcomes: number;
}

function createAxisDistributionAccumulator(): LotofacilAxisDistributionAccumulator {
  return {
    rowEmpty: initializeHistogram(),
    rowSingleton: initializeHistogram(),
    rowDeviationNormalized: initializeHistogram(),
    columnEmpty: initializeHistogram(),
    columnSingleton: initializeHistogram(),
    columnDeviationNormalized: initializeHistogram(),
    totalOutcomes: 0,
  };
}

function observeAxisDistribution(
  accumulator: LotofacilAxisDistributionAccumulator,
  occupancy: LotofacilAxisOccupancyProfile,
): void {
  increment(accumulator.rowEmpty, occupancy.rows.axesWith[0]);
  increment(accumulator.rowSingleton, occupancy.rows.axesWith[1]);
  increment(
    accumulator.rowDeviationNormalized,
    axisDeviationNumerator(occupancy.rows.counts, occupancy.betSize),
  );
  increment(accumulator.columnEmpty, occupancy.columns.axesWith[0]);
  increment(accumulator.columnSingleton, occupancy.columns.axesWith[1]);
  increment(
    accumulator.columnDeviationNormalized,
    axisDeviationNumerator(occupancy.columns.counts, occupancy.betSize),
  );
  accumulator.totalOutcomes += 1;
}

function histogramBuckets(
  histogram: ReadonlyMap<number, number>,
  denominator: number,
): readonly TheoreticalDistributionBucket[] {
  return [...histogram.entries()]
    .sort(([left], [right]) => left - right)
    .map(([valueNumerator, occurrences]) => ({
      valueNumerator,
      valueDenominator: denominator,
      occurrences,
    }));
}

function distribution(
  betSize: LotofacilBetSize,
  axis: AxisName,
  metric: AxisOccupancyMetric,
  totalOutcomes: number,
  buckets: readonly TheoreticalDistributionBucket[],
): TheoreticalAxisDistribution {
  return {
    lotteryId: LOTOFACIL_ID,
    algorithmVersion: LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION,
    betSize,
    axis,
    metric,
    tail: "GREATER_THAN_OR_EQUAL",
    totalOutcomes,
    buckets,
  };
}

function finalizeAxisDistributionProfile(
  betSize: LotofacilBetSize,
  accumulator: LotofacilAxisDistributionAccumulator,
): LotofacilTheoreticalAxisProfile {
  const totalOutcomes = accumulator.totalOutcomes;
  const normalizedDenominator = 5 * betSize;
  return {
    betSize,
    algorithmVersion: LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION,
    totalOutcomes,
    distributions: [
      distribution(betSize, "ROWS", "AXES_WITH_0", totalOutcomes, histogramBuckets(accumulator.rowEmpty, 1)),
      distribution(betSize, "ROWS", "AXES_WITH_1", totalOutcomes, histogramBuckets(accumulator.rowSingleton, 1)),
      distribution(
        betSize,
        "ROWS",
        "DEVIATION_NORMALIZED",
        totalOutcomes,
        histogramBuckets(accumulator.rowDeviationNormalized, normalizedDenominator),
      ),
      distribution(betSize, "COLUMNS", "AXES_WITH_0", totalOutcomes, histogramBuckets(accumulator.columnEmpty, 1)),
      distribution(betSize, "COLUMNS", "AXES_WITH_1", totalOutcomes, histogramBuckets(accumulator.columnSingleton, 1)),
      distribution(
        betSize,
        "COLUMNS",
        "DEVIATION_NORMALIZED",
        totalOutcomes,
        histogramBuckets(accumulator.columnDeviationNormalized, normalizedDenominator),
      ),
    ],
  };
}

/**
 * Enumerates C(25, betSize) without sampling. The integer histograms retain
 * exact outcome counts; fractional values are represented as integer ratios.
 */
export function calculateLotofacilTheoreticalAxisProfile(
  betSize: LotofacilBetSize,
): LotofacilTheoreticalAxisProfile {
  const cached = cachedTheoreticalProfiles.get(betSize);
  if (cached) {
    return cached;
  }

  const accumulator = createAxisDistributionAccumulator();
  const selected = Array.from({ length: betSize }, (_, index) => index);
  let totalOutcomes = 0;

  while (true) {
    const rows = [0, 0, 0, 0, 0];
    const columns = [0, 0, 0, 0, 0];
    for (const index of selected) {
      const rowIndex = Math.floor(index / 5);
      const columnIndex = index % 5;
      rows[rowIndex] = rows[rowIndex]! + 1;
      columns[columnIndex] = columns[columnIndex]! + 1;
    }

    observeAxisDistribution(accumulator, {
      betSize,
      rows: axisOccupancy(rows, betSize),
      columns: axisOccupancy(columns, betSize),
    });
    totalOutcomes += 1;

    let position = betSize - 1;
    while (position >= 0 && selected[position] === 25 - betSize + position) {
      position -= 1;
    }
    if (position < 0) {
      break;
    }
    selected[position] = selected[position]! + 1;
    for (let index = position + 1; index < betSize; index += 1) {
      selected[index] = selected[index - 1]! + 1;
    }
  }

  if (totalOutcomes !== accumulator.totalOutcomes) {
    throw new Error("Lotofacil axis distribution accumulator lost outcomes.");
  }
  const profile = finalizeAxisDistributionProfile(betSize, accumulator);
  cachedTheoreticalProfiles.set(betSize, profile);
  return profile;
}

function compareFractions(left: ExactFraction, right: ExactFraction): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}

function rarityForFrequency(
  frequency: ExactFraction,
  thresholds: RarityThresholds,
): RarityClass {
  if (compareFractions(frequency, thresholds.normalMin) >= 0) {
    return "NORMAL";
  }
  if (compareFractions(frequency, thresholds.attentionMin) >= 0) {
    return "ATTENTION";
  }
  if (compareFractions(frequency, thresholds.rareMin) >= 0) {
    return "RARE";
  }
  return "VERY_RARE";
}

/**
 * Classifies an auxiliary occupancy event by its exact upper-tail frequency.
 * A row/column singleton is therefore not inherently a rejection condition.
 */
export function assessLotofacilAxisRarity(
  theoreticalDistribution: TheoreticalAxisDistribution,
  observed: ExactFraction,
  thresholds: RarityThresholds = DEFAULT_RARITY_THRESHOLDS,
): AxisRarityAssessment {
  if (theoreticalDistribution.tail !== "GREATER_THAN_OR_EQUAL") {
    throw new Error("Unsupported theoretical tail.");
  }
  const tailOccurrences = theoreticalDistribution.buckets.reduce(
    (sum, bucket) =>
      sum +
      (bucket.valueNumerator * observed.denominator >=
      observed.numerator * bucket.valueDenominator
        ? bucket.occurrences
        : 0),
    0,
  );
  const theoreticalFrequency = reduceFraction(
    tailOccurrences,
    theoreticalDistribution.totalOutcomes,
  );

  return {
    rarityClass: rarityForFrequency(theoreticalFrequency, thresholds),
    tail: theoreticalDistribution.tail,
    observed,
    tailOccurrences,
    totalOutcomes: theoreticalDistribution.totalOutcomes,
    theoreticalFrequency,
  };
}

export function axisMetricValue(
  occupancy: AxisOccupancy,
  metric: AxisOccupancyMetric,
): ExactFraction {
  switch (metric) {
    case "AXES_WITH_0":
      return { numerator: occupancy.axesWith[0], denominator: 1 };
    case "AXES_WITH_1":
      return { numerator: occupancy.axesWith[1], denominator: 1 };
    case "DEVIATION_NORMALIZED":
      return occupancy.deviationNormalized;
  }
}

const LOTOFACIL_BORDER_SET = new Set<number>(LOTOFACIL_BORDER_NUMBERS);

function canonicalLotofacilNumbers(numbers: readonly number[]): readonly number[] {
  assertValidNumbers(numbers);
  return [...numbers].sort((left, right) => left - right);
}

function calculateCoreMetrics(numbers: readonly number[]): LotofacilCoreMetrics {
  let evenCount = 0;
  let sum = 0;
  let lowCount = 0;
  let borderCount = 0;
  let consecutivePairCount = 0;
  let maxConsecutiveRun = 1;
  let sequenceCount = 0;
  let currentRun = 1;

  for (let index = 0; index < numbers.length; index += 1) {
    const number = numbers[index]!;
    sum += number;
    if (number % 2 === 0) {
      evenCount += 1;
    }
    if (number <= 13) {
      lowCount += 1;
    }
    if (LOTOFACIL_BORDER_SET.has(number)) {
      borderCount += 1;
    }

    if (index === 0) {
      continue;
    }
    if (number === numbers[index - 1]! + 1) {
      consecutivePairCount += 1;
      currentRun += 1;
      maxConsecutiveRun = Math.max(maxConsecutiveRun, currentRun);
    } else {
      if (currentRun >= 2) {
        sequenceCount += 1;
      }
      currentRun = 1;
    }
  }
  if (currentRun >= 2) {
    sequenceCount += 1;
  }

  return {
    evenCount,
    oddCount: numbers.length - evenCount,
    sum,
    lowCount,
    highCount: numbers.length - lowCount,
    borderCount,
    centerCount: numbers.length - borderCount,
    consecutivePairCount,
    maxConsecutiveRun,
    sequenceCount,
    amplitude: numbers[numbers.length - 1]! - numbers[0]!,
  };
}

function nonApplicableRules(): Readonly<Record<LotofacilExtremeRuleId, StructuralRuleFlag>> {
  return {
    E1: { applicable: false, isExtreme: null },
    E2: { applicable: false, isExtreme: null },
    E3: { applicable: false, isExtreme: null },
    E4: { applicable: false, isExtreme: null },
    E5: { applicable: false, isExtreme: null },
    E6: { applicable: false, isExtreme: null },
    E7: { applicable: false, isExtreme: null },
    E8: { applicable: false, isExtreme: null },
    E9: { applicable: false, isExtreme: null },
    E10: { applicable: false, isExtreme: null },
  };
}

function metricValueForPolicy(
  profile: LotofacilMetricProfile,
  metric: LotofacilPolicyMetricId,
): ExactFraction {
  switch (metric) {
    case "EVEN_COUNT": return { numerator: profile.metrics.evenCount, denominator: 1 };
    case "SUM": return { numerator: profile.metrics.sum, denominator: 1 };
    case "BORDER_COUNT": return { numerator: profile.metrics.borderCount, denominator: 1 };
    case "LOW_01_TO_13_COUNT": return { numerator: profile.metrics.lowCount, denominator: 1 };
    case "CONSECUTIVE_PAIR_COUNT": return { numerator: profile.metrics.consecutivePairCount, denominator: 1 };
    case "MAX_CONSECUTIVE_RUN": return { numerator: profile.metrics.maxConsecutiveRun, denominator: 1 };
    case "SEQUENCE_COUNT": return { numerator: profile.metrics.sequenceCount, denominator: 1 };
    case "AMPLITUDE": return { numerator: profile.metrics.amplitude, denominator: 1 };
    case "ROW_DEVIATION_NORMALIZED": return profile.axisOccupancy.rows.deviationNormalized;
    case "COLUMN_DEVIATION_NORMALIZED": return profile.axisOccupancy.columns.deviationNormalized;
  }
}

function matchesPolicyTail(value: ExactFraction, tail: InternalPolicyTail): boolean {
  const comparison =
    BigInt(value.numerator) * BigInt(tail.denominator) -
    BigInt(tail.numerator) * BigInt(value.denominator);
  switch (tail.operator) {
    case "LESS_THAN": return comparison < 0n;
    case "LESS_THAN_OR_EQUAL": return comparison <= 0n;
    case "GREATER_THAN": return comparison > 0n;
    case "GREATER_THAN_OR_EQUAL": return comparison >= 0n;
  }
}

function classifyRulesWithPolicy(
  profile: LotofacilMetricProfile,
  policy: InternalStructuralPolicy,
): Readonly<Record<LotofacilExtremeRuleId, StructuralRuleFlag>> {
  if (profile.betSize !== policy.betSize) {
    throw new StructuralPolicyDependencyMismatchError(
      `Policy betSize ${policy.betSize} cannot classify betSize ${profile.betSize}.`,
    );
  }
  return Object.fromEntries(policy.rules.map((rule) => [
    rule.ruleId,
    {
      applicable: true,
      isExtreme: rule.tails.some((tail) => matchesPolicyTail(
        metricValueForPolicy(profile, rule.metric),
        tail,
      )),
    },
  ])) as Readonly<Record<LotofacilExtremeRuleId, StructuralRuleFlag>>;
}

function extremeRulesForSimpleBet(
  profile: LotofacilMetricProfile,
): Readonly<Record<LotofacilExtremeRuleId, StructuralRuleFlag>> {
  if (profile.betSize !== 15) {
    return nonApplicableRules();
  }
  return classifyRulesWithPolicy(profile, LOTOFACIL_LEGACY_INTERNAL_POLICY);
}

function auxiliaryAxisSignal(
  occupancy: AxisOccupancy,
  betSize: LotofacilBetSize,
): LotofacilAxisAuxiliaryClassification {
  if (betSize !== LOTOFACIL_AXIS_AUXILIARY_POLICY.applicableBetSize) {
    return { applicable: false, signal: null };
  }
  if (occupancy.axesWith[0] >= LOTOFACIL_AXIS_AUXILIARY_POLICY.veryRare.axesWithZeroAtLeast) {
    return { applicable: true, signal: "VERY_RARE" };
  }
  if (occupancy.axesWith[0] >= LOTOFACIL_AXIS_AUXILIARY_POLICY.rare.axesWithZeroAtLeast) {
    return { applicable: true, signal: "RARE" };
  }
  if (occupancy.axesWith[1] >= LOTOFACIL_AXIS_AUXILIARY_POLICY.attention.axesWithOneAtLeast) {
    return { applicable: true, signal: "ATTENTION" };
  }
  return { applicable: true, signal: "NONE" };
}

/**
 * The canonical structural profile for Lotofácil. It is pure: no historical
 * result, strategy or generator input can affect the calculated values.
 */
export function calculateLotofacilMetricProfile(
  numbers: readonly number[],
): LotofacilMetricProfile {
  const selectedNumbers = canonicalLotofacilNumbers(numbers);
  const betSize = selectedNumbers.length as LotofacilBetSize;
  const metrics = calculateCoreMetrics(selectedNumbers);

  return {
    metricEngineVersion: LOTOFACIL_METRIC_ENGINE_VERSION,
    lotteryDefinition: LOTOFACIL_DEFINITION,
    selectedNumbers,
    betSize,
    metrics,
    axisOccupancy: calculateLotofacilAxisOccupancy(selectedNumbers),
  };
}

export const lotofacilMetricEngine: LotteryMetricEngine<LotofacilMetricProfile> = {
  calculate: calculateLotofacilMetricProfile,
};

/**
 * Applies Lotofácil rules only after metrics are known. The classifier neither
 * generates games nor rejects them, and it never reads historical results.
 */
export function classifyLotofacilStructuralProfile(
  profile: LotofacilMetricProfile,
): LotofacilStructuralClassification {
  return {
    classifierVersion: LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION,
    extremeRules: extremeRulesForSimpleBet(profile),
    auxiliaryAxisSignals: {
      rows: auxiliaryAxisSignal(profile.axisOccupancy.rows, profile.betSize),
      columns: auxiliaryAxisSignal(profile.axisOccupancy.columns, profile.betSize),
    },
  };
}

export const lotofacilStructuralClassifier: StructuralClassifier<
  LotofacilMetricProfile,
  LotofacilStructuralClassification
> = {
  classify: classifyLotofacilStructuralProfile,
};

function structuralBand(extremeCount: number): StructuralBand {
  if (extremeCount === 0) {
    return "ZERO_EXTREMES";
  }
  if (extremeCount === 1) {
    return "ONE_EXTREME";
  }
  if (extremeCount === 2) {
    return "TWO_EXTREMES";
  }
  if (extremeCount === 3) {
    return "THREE_EXTREMES";
  }
  return "FOUR_PLUS_EXTREMES";
}

function centralCoreCriteriaWithPolicy(
  profile: LotofacilMetricProfile,
  policy: InternalStructuralPolicy,
): NonNullable<LotofacilStructuralSummary["centralCoreCriteria"]> {
  const entries = policy.centralCore.map((criterion) => {
    const value = metricValueForPolicy(profile, criterion.metric).numerator;
    const key = criterion.metric === "EVEN_COUNT" ? "evenCount"
      : criterion.metric === "SUM" ? "sum"
        : criterion.metric === "BORDER_COUNT" ? "borderCount"
          : criterion.metric === "LOW_01_TO_13_COUNT" ? "lowCount"
            : "consecutivePairCount";
    return [key, value >= criterion.minInclusive && value <= criterion.maxInclusive] as const;
  });
  return Object.fromEntries(entries) as NonNullable<LotofacilStructuralSummary["centralCoreCriteria"]>;
}

function summarizeWithPolicy(
  profile: LotofacilMetricProfile,
  classification: LotofacilStructuralClassification,
  policy: InternalStructuralPolicy,
  requireClassifierVersion = true,
): LotofacilStructuralSummary {
  if (profile.betSize !== policy.betSize ||
    requireClassifierVersion && classification.classifierVersion !== policy.classifierVersion) {
    throw new StructuralPolicyDependencyMismatchError(
      "Structural profile, classification, and policy versions must agree.",
    );
  }
  const rules = policy.rules.map((rule) => classification.extremeRules[rule.ruleId]);
  if (rules.some((rule) => !rule.applicable || rule.isExtreme === null)) {
    throw new StructuralPolicyDependencyMismatchError(
      "An applicable policy requires all E1-E10 rule flags.",
    );
  }
  const extremeCount = rules.filter((rule) => rule.isExtreme).length;
  const centralCoreCriteria = centralCoreCriteriaWithPolicy(profile, policy);
  return {
    applicable: true,
    extremeCount,
    band: structuralBand(extremeCount),
    isCentralCore: Object.values(centralCoreCriteria).every(Boolean),
    centralCoreCriteria,
  };
}

/**
 * Consolidates previously calculated rules. It does not recalculate E1–E10
 * and auxiliary occupancy signals are deliberately excluded.
 */
export function summarizeLotofacilStructuralProfile(
  profile: LotofacilMetricProfile,
  classification: LotofacilStructuralClassification,
): LotofacilStructuralSummary {
  if (profile.betSize !== 15) {
    return {
      applicable: false,
      extremeCount: null,
      band: null,
      isCentralCore: null,
      centralCoreCriteria: null,
    };
  }

  return summarizeWithPolicy(profile, classification, LOTOFACIL_LEGACY_INTERNAL_POLICY, false);
}

/** Lotofácil-only bridge used by the generic structural distribution audit. */
export const lotofacilPortfolioStructuralDistributionAdapter: PortfolioStructuralDistributionAdapter = {
  lotteryId: LOTOFACIL_ID,
  betSize: 15,
  metricEngineVersion: LOTOFACIL_METRIC_ENGINE_VERSION,
  classifierVersion: LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION,
  supportsDefinition: isLotofacilDefinition,
  summarize(numbers: readonly number[]): StructuralSummary {
    const profile = lotofacilMetricEngine.calculate(numbers);
    const classification = lotofacilStructuralClassifier.classify(profile);
    return summarizeLotofacilStructuralProfile(profile, classification);
  },
};

/** Lotofácil 25/15 adapter for the modality-neutral diversity optimizer. */
export const lotofacilPortfolioDiversityOptimizationAdapter:
  PortfolioDiversityOptimizationAdapter = {
  lotteryId: LOTOFACIL_ID,
  adapterVersion: LOTOFACIL_DIVERSITY_OPTIMIZATION_ADAPTER_VERSION,
  betSize: LOTOFACIL_DEFINITION.drawSize,
  candidateOrderingVersion: LOTOFACIL_CANONICAL_GAME_ORDER_VERSION,
  structuralClassifierVersion: LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION,
  structuralAllocationAlgorithmVersion: LOTOFACIL_STRUCTURAL_ALLOCATION_ALGORITHM_VERSION,
  supportsDefinition: isLotofacilDefinition,
  validateCandidate(numbers: readonly number[]): void {
    assertValidNumbers(numbers);
    if (numbers.length !== LOTOFACIL_DEFINITION.drawSize) {
      throw new Error("Lotofácil diversity optimization supports only canonical 15-number bets.");
    }
    for (let index = 1; index < numbers.length; index += 1) {
      if (numbers[index]! <= numbers[index - 1]!) {
        throw new Error("Lotofácil diversity candidates must be in strictly ascending order.");
      }
    }
  },
  canonicalKey(numbers: readonly number[]): string {
    return numbers.join(",");
  },
  compareCandidates: compareLotofacilCanonicalGames,
  classifyStructuralGroup(numbers: readonly number[]): string {
    const profile = calculateLotofacilMetricProfile(numbers);
    const classification = classifyLotofacilStructuralProfile(profile);
    const summary = summarizeLotofacilStructuralProfile(profile, classification);
    if (!summary.applicable || summary.band === null) {
      throw new Error("Lotofácil structural classification is unavailable for this candidate.");
    }
    return summary.band;
  },
  resolveStructuralTargets(
    allocation: Readonly<Record<string, number>>,
    targetCandidateCount: number,
  ) {
    const counts = calculateLotofacilStructuralAllocationCounts(
      allocation,
      targetCandidateCount,
    );
    return LOTOFACIL_STRUCTURAL_ALLOCATION_KEYS.map((key) => ({
      group: lotofacilAllocationBand[key],
      requestedPercent: allocation[key]!,
      targetCount: counts[lotofacilAllocationBand[key]],
    }));
  },
};

const rankLotofacilOutcome = createCombinationRanker(
  LOTOFACIL_DEFINITION.totalNumbers,
  LOTOFACIL_DEFINITION.drawSize,
);

function mergeCoveredOutcome(
  candidateNumbers: readonly number[],
  complementNumbers: readonly number[],
  candidateIndexes: readonly number[],
  complementIndexes: readonly number[],
  outcome: number[],
): void {
  let candidatePosition = 0;
  let complementPosition = 0;
  for (let outcomePosition = 0; outcomePosition < outcome.length; outcomePosition += 1) {
    const candidateValue = candidatePosition < candidateIndexes.length
      ? candidateNumbers[candidateIndexes[candidatePosition]!]!
      : Number.POSITIVE_INFINITY;
    const complementValue = complementPosition < complementIndexes.length
      ? complementNumbers[complementIndexes[complementPosition]!]!
      : Number.POSITIVE_INFINITY;
    if (candidateValue < complementValue) {
      outcome[outcomePosition] = candidateValue;
      candidatePosition += 1;
    } else {
      outcome[outcomePosition] = complementValue;
      complementPosition += 1;
    }
  }
}

/** Lotofácil-only bridge for exact coverage of simple 15-number bets. */
export const lotofacilExactCoverageAdapter: ExactCoverageAdapter = {
  lotteryId: LOTOFACIL_ID,
  adapterVersion: LOTOFACIL_EXACT_COVERAGE_ADAPTER_VERSION,
  betSize: LOTOFACIL_DEFINITION.drawSize,
  universeSize: LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE,
  coveredOutcomeVisitsPerCandidate:
    EXACT_COVERAGE_TIERS[EXACT_COVERAGE_TIERS.length - 1]!.grossCoveredOutcomesPerCandidate,
  tiers: EXACT_COVERAGE_TIERS,
  supportsDefinition: isLotofacilDefinition,
  enumerateCoveredOutcomeRanks(
    numbers: readonly number[],
    visitor: (rank: number, hits: number) => void,
  ): void {
    const candidateNumbers = numbers.map((number) => number - 1);
    const selected = new Uint8Array(LOTOFACIL_DEFINITION.totalNumbers);
    for (const number of candidateNumbers) selected[number] = 1;
    const complementNumbers: number[] = [];
    for (let number = 0; number < selected.length; number += 1) {
      if (selected[number] === 0) complementNumbers.push(number);
    }
    const outcome = Array.from({ length: LOTOFACIL_DEFINITION.drawSize }, () => 0);

    for (let hits = EXACT_COVERAGE_TIERS.at(-1)!.minimumHits; hits <= LOTOFACIL_DEFINITION.drawSize; hits += 1) {
      forEachCombination(candidateNumbers.length, hits, (candidateIndexes) => {
        forEachCombination(complementNumbers.length, LOTOFACIL_DEFINITION.drawSize - hits, (complementIndexes) => {
          mergeCoveredOutcome(
            candidateNumbers,
            complementNumbers,
            candidateIndexes,
            complementIndexes,
            outcome,
          );
          visitor(rankLotofacilOutcome(outcome), hits);
        });
      });
    }
  },
};

/**
 * Versioned output generated by calculateLotofacilStructuralMass for algorithm
 * 1.0.0. Manifest retrieval clones this snapshot instead of enumerating the
 * complete simple-bet universe in the caller's synchronous path.
 */
export const LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT = deepFreeze({
  lotteryId: LOTOFACIL_ID,
  algorithmVersion: LOTOFACIL_STRUCTURAL_MASS_ALGORITHM_VERSION,
  betSize: 15,
  totalOutcomes: LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE,
  buckets: [
    { band: "ZERO_EXTREMES", occurrences: 2_955_715, frequency: { numerator: 591_143, denominator: 653_752 } },
    { band: "ONE_EXTREME", occurrences: 252_024, frequency: { numerator: 31_503, denominator: 408_595 } },
    { band: "TWO_EXTREMES", occurrences: 41_775, frequency: { numerator: 8_355, denominator: 653_752 } },
    { band: "THREE_EXTREMES", occurrences: 12_286, frequency: { numerator: 6_143, denominator: 1_634_380 } },
    { band: "FOUR_PLUS_EXTREMES", occurrences: 6_960, frequency: { numerator: 174, denominator: 81_719 } },
  ],
} satisfies LotofacilStructuralMassProfile);

/**
 * Enumerates the complete C(25, 15) universe and consolidates its canonical
 * structural bands. This is a neutral theoretical reference, not a prediction
 * or a strategy constraint.
 */
export function calculateLotofacilStructuralMass(): LotofacilStructuralMassProfile {
  if (cachedStructuralMassProfile) {
    return cachedStructuralMassProfile;
  }

  const occurrences = new Map<StructuralBand, number>(
    STRUCTURAL_BAND_ORDER.map((band) => [band, 0]),
  );
  let totalOutcomes = 0;

  forEachCombination(LOTOFACIL_DEFINITION.totalNumbers, LOTOFACIL_DEFINITION.drawSize, (indexes) => {
    const numbers = indexes.map((index) => index + 1);
    const profile = lotofacilMetricEngine.calculate(numbers);
    const classification = lotofacilStructuralClassifier.classify(profile);
    const summary = summarizeLotofacilStructuralProfile(profile, classification);
    if (!summary.applicable || summary.band === null) {
      throw new Error("A simple Lotofácil combination requires an applicable structural summary.");
    }
    occurrences.set(summary.band, (occurrences.get(summary.band) ?? 0) + 1);
    totalOutcomes += 1;
  });

  cachedStructuralMassProfile = {
    lotteryId: LOTOFACIL_ID,
    algorithmVersion: LOTOFACIL_STRUCTURAL_MASS_ALGORITHM_VERSION,
    betSize: 15,
    totalOutcomes,
    buckets: STRUCTURAL_BAND_ORDER.map((band) => ({
      band,
      occurrences: occurrences.get(band) ?? 0,
      frequency: reduceFraction(occurrences.get(band) ?? 0, totalOutcomes),
    })),
  };
  return cachedStructuralMassProfile;
}

/**
 * Returns the versioned, serializable Lotofácil formula reference for local
 * audit. It composes existing contracts and never evaluates history, strategy,
 * generation, coverage, persistence, or results.
 */
export function getLotofacilCanonicalFormulaManifest(): LotofacilCanonicalFormulaManifest {
  const structuralMass = LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT;
  return {
    formulaVersion: LOTOFACIL_CANONICAL_FORMULA_VERSION,
    lotteryDefinition: { ...LOTOFACIL_DEFINITION },
    supportedBetSizes: [...LOTOFACIL_SUPPORTED_BET_SIZES],
    metricEngine: {
      version: LOTOFACIL_METRIC_ENGINE_VERSION,
      metrics: [...LOTOFACIL_CANONICAL_METRICS] as unknown as typeof LOTOFACIL_CANONICAL_METRICS,
    },
    axisOccupancy: {
      algorithmVersion: LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION,
      expectedPerAxis: "bet_size / 5",
      rarityThresholds: {
        normalMin: { ...DEFAULT_RARITY_THRESHOLDS.normalMin },
        attentionMin: { ...DEFAULT_RARITY_THRESHOLDS.attentionMin },
        rareMin: { ...DEFAULT_RARITY_THRESHOLDS.rareMin },
      },
      auxiliaryPolicy: {
        ...LOTOFACIL_AXIS_AUXILIARY_POLICY,
        priority: [...LOTOFACIL_AXIS_AUXILIARY_POLICY.priority],
        veryRare: { ...LOTOFACIL_AXIS_AUXILIARY_POLICY.veryRare },
        rare: { ...LOTOFACIL_AXIS_AUXILIARY_POLICY.rare },
        attention: { ...LOTOFACIL_AXIS_AUXILIARY_POLICY.attention },
      } as typeof LOTOFACIL_AXIS_AUXILIARY_POLICY,
    },
    structuralClassification: {
      classifierVersion: LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION,
      applicableBetSize: 15,
      nonApplicableBetSizes: [16, 17, 18, 19, 20],
      extremeRuleLimits: cloneNestedRecord(LOTOFACIL_EXTREME_RULE_LIMITS),
      centralCoreLimits: cloneNestedRecord(LOTOFACIL_CENTRAL_CORE_LIMITS),
    },
    structuralMass: {
      ...structuralMass,
      buckets: structuralMass.buckets.map((bucket) => ({
        ...bucket,
        frequency: { ...bucket.frequency },
      })),
    },
    canonicalPortfolioIdentity: {
      contractVersion: CONTRACT_VERSION,
      hashAlgorithm: HASH_ALGORITHM,
      hashVersion: HASH_VERSION,
      canonicalizeFunction: "canonicalizePortfolio",
      gameNumberOrdering: "ASCENDING_NUMERIC",
      portfolioGameOrdering: "LOCALE_COMPARE_OF_COMMA_JOINED_CANONICAL_GAMES",
    },
    exclusions: ["HISTORY", "RESULTS", "STRATEGY", "GENERATION", "COVERAGE", "PERSISTENCE"],
  };
}

const STRUCTURAL_RULE_IDS = [
  "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10",
] as const;
const STRUCTURAL_CORE_METRICS = [
  "EVEN_COUNT", "SUM", "BORDER_COUNT", "LOW_01_TO_13_COUNT", "CONSECUTIVE_PAIR_COUNT",
] as const;
const STRUCTURAL_RULE_METRICS: readonly LotofacilPolicyMetricId[] = [
  "EVEN_COUNT", "SUM", "BORDER_COUNT", "LOW_01_TO_13_COUNT",
  "CONSECUTIVE_PAIR_COUNT", "MAX_CONSECUTIVE_RUN", "SEQUENCE_COUNT", "AMPLITUDE",
  "ROW_DEVIATION_NORMALIZED", "COLUMN_DEVIATION_NORMALIZED",
];

type ScalarStructuralMetric = Exclude<LotofacilPolicyMetricId,
  "ROW_DEVIATION_NORMALIZED" | "COLUMN_DEVIATION_NORMALIZED">;

interface LotofacilStructuralDistributionSet {
  readonly betSize: LotofacilBetSize;
  readonly scalar: Readonly<Record<ScalarStructuralMetric, Map<number, number>>>;
  readonly axisAccumulator: LotofacilAxisDistributionAccumulator;
  axisProfile?: LotofacilTheoreticalAxisProfile;
  totalOutcomes: number;
}

function createScalarHistograms(): Record<ScalarStructuralMetric, Map<number, number>> {
  return {
    EVEN_COUNT: new Map(),
    SUM: new Map(),
    BORDER_COUNT: new Map(),
    LOW_01_TO_13_COUNT: new Map(),
    CONSECUTIVE_PAIR_COUNT: new Map(),
    MAX_CONSECUTIVE_RUN: new Map(),
    SEQUENCE_COUNT: new Map(),
    AMPLITUDE: new Map(),
  };
}

function createStructuralDistributionSet(
  betSize: LotofacilBetSize,
): LotofacilStructuralDistributionSet {
  return {
    betSize,
    scalar: createScalarHistograms(),
    axisAccumulator: createAxisDistributionAccumulator(),
    totalOutcomes: 0,
  };
}

function scalarMetricValue(
  metrics: LotofacilCoreMetrics,
  metric: ScalarStructuralMetric,
): number {
  switch (metric) {
    case "EVEN_COUNT": return metrics.evenCount;
    case "SUM": return metrics.sum;
    case "BORDER_COUNT": return metrics.borderCount;
    case "LOW_01_TO_13_COUNT": return metrics.lowCount;
    case "CONSECUTIVE_PAIR_COUNT": return metrics.consecutivePairCount;
    case "MAX_CONSECUTIVE_RUN": return metrics.maxConsecutiveRun;
    case "SEQUENCE_COUNT": return metrics.sequenceCount;
    case "AMPLITUDE": return metrics.amplitude;
  }
}

function observeStructuralDistribution(
  distributions: LotofacilStructuralDistributionSet,
  profile: LotofacilMetricProfile,
): void {
  for (const metric of Object.keys(distributions.scalar) as ScalarStructuralMetric[]) {
    increment(distributions.scalar[metric], scalarMetricValue(profile.metrics, metric));
  }
  observeAxisDistribution(distributions.axisAccumulator, profile.axisOccupancy);
  distributions.totalOutcomes += 1;
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function fractionForCount(count: number, universeSize: number): ExactFraction {
  return reduceFraction(count, universeSize);
}

function supportValues(histogram: ReadonlyMap<number, number>): readonly number[] {
  return [...histogram.keys()].sort((left, right) => left - right);
}

function tailCount(
  histogram: ReadonlyMap<number, number>,
  candidate: number,
  operator: "LESS_THAN" | "LESS_THAN_OR_EQUAL" | "GREATER_THAN" | "GREATER_THAN_OR_EQUAL",
): number {
  let count = 0;
  for (const [value, occurrences] of histogram) {
    if (
      (operator === "LESS_THAN" && value < candidate) ||
      (operator === "LESS_THAN_OR_EQUAL" && value <= candidate) ||
      (operator === "GREATER_THAN" && value > candidate) ||
      (operator === "GREATER_THAN_OR_EQUAL" && value >= candidate)
    ) count += occurrences;
  }
  return count;
}

interface SelectedTail {
  readonly limit: number;
  readonly count: number;
  readonly distanceNumerator: number;
}

function selectScalarTail(
  histogram: ReadonlyMap<number, number>,
  universeSize: number,
  referenceCount: number,
  referenceUniverseSize: number,
  operator: "LESS_THAN" | "LESS_THAN_OR_EQUAL" | "GREATER_THAN" | "GREATER_THAN_OR_EQUAL",
  residualTie: "LOWER_LIMIT" | "HIGHER_LIMIT",
  tiePolicy: "EXTREME_MIN_COUNT" | "CORE_NARROW_LIMIT" = "EXTREME_MIN_COUNT",
): SelectedTail {
  let selected: SelectedTail | undefined;
  for (const limit of supportValues(histogram)) {
    const count = tailCount(histogram, limit, operator);
    const distance = absoluteBigInt(
      BigInt(count) * BigInt(referenceUniverseSize) -
      BigInt(referenceCount) * BigInt(universeSize),
    );
    const distanceNumerator = Number(distance);
    if (!Number.isSafeInteger(distanceNumerator)) {
      throw new StructuralPolicyLimitDerivationFailedError("Tail distance exceeds the safe public integer range.");
    }
    if (
      !selected ||
      distanceNumerator < selected.distanceNumerator ||
      (distanceNumerator === selected.distanceNumerator && tiePolicy === "EXTREME_MIN_COUNT" && count < selected.count) ||
      (distanceNumerator === selected.distanceNumerator &&
        (tiePolicy === "CORE_NARROW_LIMIT" || count === selected.count) &&
        (residualTie === "LOWER_LIMIT" ? limit < selected.limit : limit > selected.limit))
    ) selected = { limit, count, distanceNumerator };
  }
  if (!selected) throw new StructuralPolicyLimitDerivationFailedError("No exact support candidate exists.");
  return selected;
}

function scalarTailEvidence(
  selected: SelectedTail,
  universeSize: number,
  referenceLimit: number,
  referenceCount: number,
  referenceUniverseSize: number,
  tail: "LOWER" | "UPPER",
  operator: "LESS_THAN" | "LESS_THAN_OR_EQUAL" | "GREATER_THAN" | "GREATER_THAN_OR_EQUAL",
) {
  return {
    tail,
    operator,
    limit: selected.limit,
    count: selected.count,
    frequency: fractionForCount(selected.count, universeSize),
    referenceBetSize: 15 as const,
    referenceLimit,
    referenceCount,
    referenceFrequency: fractionForCount(referenceCount, referenceUniverseSize),
    distanceNumerator: selected.distanceNumerator,
  };
}

function findAxisDistribution(
  profile: LotofacilTheoreticalAxisProfile,
  axis: AxisName,
  metric: AxisOccupancyMetric,
): TheoreticalAxisDistribution {
  const found = profile.distributions.find(
    (candidate) => candidate.axis === axis && candidate.metric === metric,
  );
  if (!found) throw new StructuralPolicyDependencyMismatchError("Required axis distribution is absent.");
  return found;
}

function compareBucketValue(
  left: TheoreticalDistributionBucket,
  rightNumerator: number,
  rightDenominator: number,
): bigint {
  return BigInt(left.valueNumerator) * BigInt(rightDenominator) -
    BigInt(rightNumerator) * BigInt(left.valueDenominator);
}

function axisUpperTailCount(
  distribution: TheoreticalAxisDistribution,
  numerator: number,
  denominator: number,
): number {
  return distribution.buckets.reduce(
    (count, bucket) => count +
      (compareBucketValue(bucket, numerator, denominator) >= 0n ? bucket.occurrences : 0),
    0,
  );
}

function selectAxisUpperTail(
  distribution: TheoreticalAxisDistribution,
  referenceCount: number,
  referenceUniverseSize: number,
): { limit: ExactFraction; count: number; distanceNumerator: number } {
  let selected: { limit: ExactFraction; count: number; distanceNumerator: number } | undefined;
  for (const bucket of distribution.buckets) {
    const limit = reduceFraction(bucket.valueNumerator, bucket.valueDenominator);
    const count = axisUpperTailCount(distribution, limit.numerator, limit.denominator);
    const distanceNumerator = Number(absoluteBigInt(
      BigInt(count) * BigInt(referenceUniverseSize) -
      BigInt(referenceCount) * BigInt(distribution.totalOutcomes),
    ));
    const isHigherLimit = selected &&
      BigInt(limit.numerator) * BigInt(selected.limit.denominator) >
      BigInt(selected.limit.numerator) * BigInt(limit.denominator);
    if (
      !selected ||
      distanceNumerator < selected.distanceNumerator ||
      (distanceNumerator === selected.distanceNumerator && count < selected.count) ||
      (distanceNumerator === selected.distanceNumerator && count === selected.count && isHigherLimit)
    ) selected = { limit, count, distanceNumerator };
  }
  if (!selected) throw new StructuralPolicyLimitDerivationFailedError("No normalized deviation candidate exists.");
  return selected;
}

const LEGACY_SCALAR_LIMITS = [
  { lower: LOTOFACIL_EXTREME_RULE_LIMITS.E1.atMost, upper: LOTOFACIL_EXTREME_RULE_LIMITS.E1.atLeast },
  { lower: LOTOFACIL_EXTREME_RULE_LIMITS.E2.atMost, upper: LOTOFACIL_EXTREME_RULE_LIMITS.E2.atLeast },
  { lower: LOTOFACIL_EXTREME_RULE_LIMITS.E3.atMost, upper: LOTOFACIL_EXTREME_RULE_LIMITS.E3.atLeast },
  { lower: LOTOFACIL_EXTREME_RULE_LIMITS.E4.atMost, upper: LOTOFACIL_EXTREME_RULE_LIMITS.E4.atLeast },
  { lower: LOTOFACIL_EXTREME_RULE_LIMITS.E5.atMost, upper: LOTOFACIL_EXTREME_RULE_LIMITS.E5.atLeast },
  { lower: LOTOFACIL_EXTREME_RULE_LIMITS.E6.atMost, upper: LOTOFACIL_EXTREME_RULE_LIMITS.E6.atLeast },
  { lower: LOTOFACIL_EXTREME_RULE_LIMITS.E7.atMost, upper: LOTOFACIL_EXTREME_RULE_LIMITS.E7.atLeast },
  { lower: LOTOFACIL_EXTREME_RULE_LIMITS.E8.atMost },
] as const;
const LEGACY_CORE_LIMITS = [
  LOTOFACIL_CENTRAL_CORE_LIMITS.evenCount,
  LOTOFACIL_CENTRAL_CORE_LIMITS.sum,
  LOTOFACIL_CENTRAL_CORE_LIMITS.borderCount,
  LOTOFACIL_CENTRAL_CORE_LIMITS.lowCount,
  LOTOFACIL_CENTRAL_CORE_LIMITS.consecutivePairCount,
] as const;

function deriveLotofacilStructuralPolicy(
  distributions: LotofacilStructuralDistributionSet,
  reference: LotofacilStructuralDistributionSet,
): LotofacilStructuralPolicy {
  const universeSize = distributions.totalOutcomes;
  const referenceUniverseSize = reference.totalOutcomes;
  const scalarRules = STRUCTURAL_RULE_IDS.slice(0, 8).map((ruleId, index) => {
    const metric = STRUCTURAL_RULE_METRICS[index] as ScalarStructuralMetric;
    const histogram = distributions.scalar[metric];
    const referenceHistogram = reference.scalar[metric];
    const limits = LEGACY_SCALAR_LIMITS[index]!;
    const referenceLowerCount = tailCount(referenceHistogram, limits.lower, "LESS_THAN_OR_EQUAL");
    const selectedLower = distributions.betSize === 15
      ? { limit: limits.lower, count: referenceLowerCount, distanceNumerator: 0 }
      : selectScalarTail(histogram, universeSize, referenceLowerCount, referenceUniverseSize, "LESS_THAN_OR_EQUAL", "LOWER_LIMIT");
    const tails = [scalarTailEvidence(
      selectedLower, universeSize, limits.lower, referenceLowerCount,
      referenceUniverseSize, "LOWER", "LESS_THAN_OR_EQUAL",
    )];
    if ("upper" in limits) {
      const referenceUpperCount = tailCount(referenceHistogram, limits.upper, "GREATER_THAN_OR_EQUAL");
      const selectedUpper = distributions.betSize === 15
        ? { limit: limits.upper, count: referenceUpperCount, distanceNumerator: 0 }
        : selectScalarTail(histogram, universeSize, referenceUpperCount, referenceUniverseSize, "GREATER_THAN_OR_EQUAL", "HIGHER_LIMIT");
      tails.push(scalarTailEvidence(
        selectedUpper, universeSize, limits.upper, referenceUpperCount,
        referenceUniverseSize, "UPPER", "GREATER_THAN_OR_EQUAL",
      ));
      if (selectedLower.limit >= selectedUpper.limit) {
        throw new StructuralPolicyLimitDerivationFailedError(`${ruleId} derived overlapping limits.`);
      }
    }
    return { ruleId, metric, tails };
  });

  const referenceAxisProfile = reference.axisProfile!;
  const axisRules = (["ROWS", "COLUMNS"] as const).map((axis, axisIndex) => {
    const distribution = findAxisDistribution(distributions.axisProfile!, axis, "DEVIATION_NORMALIZED");
    const referenceDistribution = findAxisDistribution(referenceAxisProfile, axis, "DEVIATION_NORMALIZED");
    const referenceCount = axisUpperTailCount(referenceDistribution, 8, 15);
    const selected = distributions.betSize === 15
      ? { limit: { numerator: 8, denominator: 15 }, count: referenceCount, distanceNumerator: 0 }
      : selectAxisUpperTail(distribution, referenceCount, referenceUniverseSize);
    return {
      ruleId: STRUCTURAL_RULE_IDS[8 + axisIndex]!,
      metric: STRUCTURAL_RULE_METRICS[8 + axisIndex]!,
      tails: [{
        tail: "UPPER" as const,
        operator: "GREATER_THAN_OR_EQUAL" as const,
        limit: selected.limit,
        count: selected.count,
        frequency: fractionForCount(selected.count, universeSize),
        referenceBetSize: 15 as const,
        referenceLimit: { numerator: 8, denominator: 15 },
        referenceCount,
        referenceFrequency: fractionForCount(referenceCount, referenceUniverseSize),
        distanceNumerator: selected.distanceNumerator,
      }],
    };
  });

  const centralCore = STRUCTURAL_CORE_METRICS.map((metric, index) => {
    const limits = LEGACY_CORE_LIMITS[index]!;
    const histogram = distributions.scalar[metric];
    const referenceHistogram = reference.scalar[metric];
    const lowerReferenceCount = tailCount(referenceHistogram, limits.min, "LESS_THAN");
    const upperReferenceCount = tailCount(referenceHistogram, limits.max, "GREATER_THAN");
    const lower = distributions.betSize === 15
      ? { limit: limits.min, count: lowerReferenceCount, distanceNumerator: 0 }
      : selectScalarTail(
        histogram, universeSize, lowerReferenceCount, referenceUniverseSize,
        "LESS_THAN", "HIGHER_LIMIT", "CORE_NARROW_LIMIT",
      );
    const upper = distributions.betSize === 15
      ? { limit: limits.max, count: upperReferenceCount, distanceNumerator: 0 }
      : selectScalarTail(
        histogram, universeSize, upperReferenceCount, referenceUniverseSize,
        "GREATER_THAN", "LOWER_LIMIT", "CORE_NARROW_LIMIT",
      );
    if (lower.limit > upper.limit) {
      throw new StructuralPolicyLimitDerivationFailedError(`${metric} derived an invalid central interval.`);
    }
    return {
      metric,
      minInclusive: lower.limit,
      maxInclusive: upper.limit,
      lowerTail: scalarTailEvidence(lower, universeSize, limits.min, lowerReferenceCount, referenceUniverseSize, "LOWER", "LESS_THAN"),
      upperTail: scalarTailEvidence(upper, universeSize, limits.max, upperReferenceCount, referenceUniverseSize, "UPPER", "GREATER_THAN"),
    };
  });

  const withoutHash = {
    contractVersion: LOTOFACIL_STRUCTURAL_POLICY_CONTRACT_VERSION,
    artifactSchemaVersion: LOTOFACIL_STRUCTURAL_ARTIFACT_SCHEMA_VERSION,
    canonicalSerializationVersion: LOTOFACIL_STRUCTURAL_CANONICAL_SERIALIZATION_VERSION,
    policySetId: LOTOFACIL_STRUCTURAL_POLICY_SET_ID,
    policySetVersion: LOTOFACIL_STRUCTURAL_POLICY_SET_VERSION,
    policyId: `${LOTOFACIL_STRUCTURAL_POLICY_SET_ID}/${distributions.betSize}`,
    policyVersion: LOTOFACIL_STRUCTURAL_POLICY_VERSION,
    derivationAlgorithm: LOTOFACIL_STRUCTURAL_DERIVATION_ALGORITHM,
    derivationAlgorithmVersion: LOTOFACIL_STRUCTURAL_DERIVATION_ALGORITHM_VERSION,
    classifierVersion: LOTOFACIL_STRUCTURAL_CLASSIFIER_V2_VERSION,
    massAlgorithmVersion: LOTOFACIL_STRUCTURAL_MASS_V2_ALGORITHM_VERSION,
    metricEngineVersion: LOTOFACIL_METRIC_ENGINE_VERSION,
    axisOccupancyAlgorithmVersion: LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION,
    lotteryId: LOTOFACIL_ID,
    lotteryDefinitionVersion: LOTOFACIL_DEFINITION.version,
    betSize: distributions.betSize,
    universeSize,
    descriptiveMeanSum: 13 * distributions.betSize,
    rules: [...scalarRules, ...axisRules],
    centralCore,
    axisDistributions: distributions.axisProfile!.distributions,
    auxiliaryOperationalPolicyApplicable: distributions.betSize === 15,
    historyUsed: false as const,
    samplingUsed: false as const,
    probabilityClaimed: false as const,
  };
  return lotofacilStructuralPolicySchema.parse({
    ...withoutHash,
    artifactHash: calculateLotofacilStructuralArtifactHash(withoutHash),
  });
}

function internalPolicyFromArtifact(policyInput: unknown): InternalStructuralPolicy {
  const policy = lotofacilStructuralPolicySchema.parse(policyInput);
  if (calculateLotofacilStructuralArtifactHash(
    hashableArtifact(policy as unknown as Record<string, unknown>),
  ) !== policy.artifactHash) {
    throw new StructuralArtifactHashMismatchError("Structural policy hash mismatch.");
  }
  const toInternalTail = (tail: LotofacilStructuralPolicy["rules"][number]["tails"][number]): InternalPolicyTail => ({
    operator: tail.operator,
    numerator: typeof tail.limit === "number" ? tail.limit : tail.limit.numerator,
    denominator: typeof tail.limit === "number" ? 1 : tail.limit.denominator,
  });
  return {
    betSize: policy.betSize,
    classifierVersion: policy.classifierVersion,
    rules: policy.rules.map((rule) => ({
      ruleId: rule.ruleId,
      metric: rule.metric,
      tails: rule.tails.map(toInternalTail),
    })),
    centralCore: policy.centralCore.map((criterion) => ({
      metric: criterion.metric,
      minInclusive: criterion.minInclusive,
      maxInclusive: criterion.maxInclusive,
    })),
  };
}

export function classifyLotofacilStructuralProfileV2(
  profile: LotofacilMetricProfile,
  policyInput: unknown,
): LotofacilStructuralClassification {
  return createLotofacilStructuralClassifierV2(policyInput).classify(profile);
}

export function summarizeLotofacilStructuralProfileV2(
  profile: LotofacilMetricProfile,
  classification: LotofacilStructuralClassification,
  policyInput: unknown,
): LotofacilStructuralSummary {
  return createLotofacilStructuralClassifierV2(policyInput).summarize(profile, classification);
}

export interface LotofacilStructuralClassifierV2 {
  readonly policyId: string;
  readonly policyVersion: string;
  classify(profile: LotofacilMetricProfile): LotofacilStructuralClassification;
  summarize(
    profile: LotofacilMetricProfile,
    classification: LotofacilStructuralClassification,
  ): LotofacilStructuralSummary;
}

/** Resolves and verifies a policy once for exhaustive or repeated classification. */
export function createLotofacilStructuralClassifierV2(
  policyInput: unknown,
): LotofacilStructuralClassifierV2 {
  const artifact = lotofacilStructuralPolicySchema.parse(policyInput);
  const policy = internalPolicyFromArtifact(artifact);
  const assertCompatibleProfile = (profile: LotofacilMetricProfile): void => {
    if (
      profile.metricEngineVersion !== artifact.metricEngineVersion ||
      !isLotofacilDefinition(profile.lotteryDefinition) ||
      profile.lotteryDefinition.id !== artifact.lotteryId ||
      profile.lotteryDefinition.version !== artifact.lotteryDefinitionVersion ||
      profile.betSize !== artifact.betSize ||
      profile.axisOccupancy.betSize !== artifact.betSize ||
      profile.selectedNumbers.length !== artifact.betSize
    ) {
      throw new StructuralPolicyDependencyMismatchError(
        "Structural profile identity and policy dependencies must agree.",
      );
    }
  };
  return {
    policyId: artifact.policyId,
    policyVersion: artifact.policyVersion,
    classify(profile) {
      assertCompatibleProfile(profile);
      return {
        classifierVersion: policy.classifierVersion,
        extremeRules: classifyRulesWithPolicy(profile, policy),
        auxiliaryAxisSignals: {
          rows: auxiliaryAxisSignal(profile.axisOccupancy.rows, profile.betSize),
          columns: auxiliaryAxisSignal(profile.axisOccupancy.columns, profile.betSize),
        },
      };
    },
    summarize(profile, classification) {
      assertCompatibleProfile(profile);
      return summarizeWithPolicy(profile, classification, policy);
    },
  };
}

function canonicalString(value: string): string {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
        throw new TypeError("Canonical JSON rejects isolated Unicode surrogates.");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError("Canonical JSON rejects isolated Unicode surrogates.");
    }
  }
  return JSON.stringify(value);
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function serializeLotofacilStructuralCanonicalValue(
  value: unknown,
  ancestors: WeakSet<object>,
): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return canonicalString(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError("Canonical JSON accepts only safe integers and rejects negative zero.");
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new TypeError("Canonical JSON rejects cyclic values.");
    const ownKeys = Reflect.ownKeys(value);
    const expectedKeys = Array.from({ length: value.length }, (_, index) => String(index));
    if (ownKeys.some((key) => typeof key !== "string") ||
      ownKeys.filter((key) => key !== "length").some((key, index) => key !== expectedKeys[index]) ||
      ownKeys.length !== expectedKeys.length + 1) {
      throw new TypeError("Canonical JSON accepts only dense arrays without custom fields.");
    }
    ancestors.add(value);
    try {
      const items = expectedKeys.map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor?.enumerable || !("value" in descriptor)) {
          throw new TypeError("Canonical JSON accepts only dense arrays of data values.");
        }
        return serializeLotofacilStructuralCanonicalValue(descriptor.value, ancestors);
      });
      return `[${items.join(",")}]`;
    } finally {
      ancestors.delete(value);
    }
  }
  if (typeof value === "object") {
    if (ancestors.has(value)) throw new TypeError("Canonical JSON rejects cyclic values.");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON accepts only plain objects with Object or null prototypes.");
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) {
      throw new TypeError("Canonical JSON rejects symbol-keyed fields.");
    }
    const entries = ownKeys.map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key as string);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new TypeError("Canonical JSON accepts only own enumerable data fields.");
      }
      return [key, descriptor.value] as [string, unknown];
    });
    if (entries.some(([, item]) => item === undefined)) {
      throw new TypeError("Canonical JSON rejects explicitly undefined fields.");
    }
    entries.sort(([left], [right]) => compareUtf8(left, right));
    ancestors.add(value);
    try {
      return `{${entries.map(([key, item]) =>
        `${canonicalString(key)}:${serializeLotofacilStructuralCanonicalValue(item, ancestors)}`).join(",")}}`;
    } finally {
      ancestors.delete(value);
    }
  }
  throw new TypeError("Canonical JSON rejects unsupported values.");
}

export function serializeLotofacilStructuralCanonicalJson(value: unknown): string {
  return serializeLotofacilStructuralCanonicalValue(value, new WeakSet());
}

export function calculateLotofacilStructuralArtifactHash(value: unknown): string {
  const canonicalBytes = Buffer.from(serializeLotofacilStructuralCanonicalJson(value), "utf8");
  return `sha256:${createHash("sha256").update(canonicalBytes).digest("hex")}`;
}

function hashableArtifact(artifact: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const withoutHash = { ...artifact };
  delete withoutHash.artifactHash;
  return withoutHash;
}

interface StructuralMassAccumulator {
  readonly ruleCounts: number[];
  readonly extremeCounts: number[];
  readonly bandCounts: Record<StructuralBand, number>;
  readonly coreCriterionCounts: number[];
  centralCoreCount: number;
  readonly bandCoreCounts: Record<string, number>;
  totalOutcomes: number;
}

function createMassAccumulator(): StructuralMassAccumulator {
  return {
    ruleCounts: Array.from({ length: 10 }, () => 0),
    extremeCounts: Array.from({ length: 11 }, () => 0),
    bandCounts: Object.fromEntries(STRUCTURAL_BAND_ORDER.map((band) => [band, 0])) as Record<StructuralBand, number>,
    coreCriterionCounts: Array.from({ length: 5 }, () => 0),
    centralCoreCount: 0,
    bandCoreCounts: Object.fromEntries(
      STRUCTURAL_BAND_ORDER.flatMap((band) => [[`${band}:false`, 0], [`${band}:true`, 0]]),
    ),
    totalOutcomes: 0,
  };
}

function observeMass(
  accumulator: StructuralMassAccumulator,
  classification: LotofacilStructuralClassification,
  summary: LotofacilStructuralSummary,
): void {
  if (!summary.applicable || summary.extremeCount === null || summary.band === null ||
      summary.isCentralCore === null || summary.centralCoreCriteria === null) {
    throw new StructuralMassReconciliationFailedError("A v2 policy produced a non-applicable summary.");
  }
  STRUCTURAL_RULE_IDS.forEach((ruleId, index) => {
    if (classification.extremeRules[ruleId].isExtreme) accumulator.ruleCounts[index]! += 1;
  });
  accumulator.extremeCounts[summary.extremeCount]! += 1;
  accumulator.bandCounts[summary.band] += 1;
  const criteria = Object.values(summary.centralCoreCriteria);
  criteria.forEach((matches, index) => {
    if (matches) accumulator.coreCriterionCounts[index]! += 1;
  });
  if (summary.isCentralCore) accumulator.centralCoreCount += 1;
  accumulator.bandCoreCounts[`${summary.band}:${summary.isCentralCore}`]! += 1;
  accumulator.totalOutcomes += 1;
}

function massCell(count: number, universeSize: number) {
  return { count, universeSize, frequency: fractionForCount(count, universeSize) };
}

function finalizeStructuralMass(
  policy: LotofacilStructuralPolicy,
  accumulator: StructuralMassAccumulator,
): LotofacilStructuralMassArtifact {
  const universeSize = policy.universeSize;
  const extremeTotal = accumulator.extremeCounts.reduce((sum, count) => sum + count, 0);
  const bandTotal = STRUCTURAL_BAND_ORDER.reduce((sum, band) => sum + accumulator.bandCounts[band], 0);
  const fourPlus = accumulator.extremeCounts.slice(4).reduce((sum, count) => sum + count, 0);
  const crossTotal = Object.values(accumulator.bandCoreCounts).reduce((sum, count) => sum + count, 0);
  const crossCore = STRUCTURAL_BAND_ORDER.reduce(
    (sum, band) => sum + accumulator.bandCoreCounts[`${band}:true`]!, 0,
  );
  if (
    accumulator.totalOutcomes !== universeSize || extremeTotal !== universeSize ||
    bandTotal !== universeSize || fourPlus !== accumulator.bandCounts.FOUR_PLUS_EXTREMES ||
    crossTotal !== universeSize || crossCore !== accumulator.centralCoreCount
  ) throw new StructuralMassReconciliationFailedError();

  const withoutHash = {
    contractVersion: LOTOFACIL_STRUCTURAL_POLICY_CONTRACT_VERSION,
    artifactSchemaVersion: LOTOFACIL_STRUCTURAL_ARTIFACT_SCHEMA_VERSION,
    canonicalSerializationVersion: LOTOFACIL_STRUCTURAL_CANONICAL_SERIALIZATION_VERSION,
    policySetId: LOTOFACIL_STRUCTURAL_POLICY_SET_ID,
    policySetVersion: LOTOFACIL_STRUCTURAL_POLICY_SET_VERSION,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    classifierVersion: policy.classifierVersion,
    massAlgorithmVersion: LOTOFACIL_STRUCTURAL_MASS_V2_ALGORITHM_VERSION,
    metricEngineVersion: LOTOFACIL_METRIC_ENGINE_VERSION,
    axisOccupancyAlgorithmVersion: LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION,
    lotteryId: LOTOFACIL_ID,
    lotteryDefinitionVersion: LOTOFACIL_DEFINITION.version,
    betSize: policy.betSize,
    universeSize,
    enumeration: "INTEGRAL" as const,
    ruleMasses: STRUCTURAL_RULE_IDS.map((ruleId, index) => ({ ruleId, ...massCell(accumulator.ruleCounts[index]!, universeSize) })),
    extremeCountMasses: accumulator.extremeCounts.map((count, extremeCount) => ({ extremeCount, ...massCell(count, universeSize) })),
    bandMasses: STRUCTURAL_BAND_ORDER.map((band) => ({ band, ...massCell(accumulator.bandCounts[band], universeSize) })),
    centralCoreCriterionMasses: STRUCTURAL_CORE_METRICS.map((metric, index) => ({ metric, ...massCell(accumulator.coreCriterionCounts[index]!, universeSize) })),
    centralCoreMass: massCell(accumulator.centralCoreCount, universeSize),
    bandByCentralCoreMasses: STRUCTURAL_BAND_ORDER.flatMap((band) => [false, true].map((isCentralCore) => ({
      band,
      isCentralCore,
      ...massCell(accumulator.bandCoreCounts[`${band}:${isCentralCore}`]!, universeSize),
    }))),
    historyUsed: false as const,
    samplingUsed: false as const,
    probabilityClaimed: false as const,
    reconciled: true as const,
  };
  return lotofacilStructuralMassArtifactSchema.parse({
    ...withoutHash,
    artifactHash: calculateLotofacilStructuralArtifactHash(withoutHash),
  });
}

export interface BuildLotofacilStructuralPolicySetOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: LotofacilStructuralPolicyProgress) => void;
}

function emitStructuralProgress(
  options: BuildLotofacilStructuralPolicySetOptions,
  phase: LotofacilStructuralPolicyProgress["phase"],
  betSize: LotofacilBetSize | null,
  processedWork: number,
  totalWork: number,
  overallProcessedWork: number,
): void {
  options.onProgress?.(lotofacilStructuralPolicyProgressSchema.parse({
    type: "progress",
    phase,
    betSize,
    processedWork,
    totalWork,
    overallProcessedWork,
    overallTotalWork: LOTOFACIL_STRUCTURAL_MAX_COMBINATION_VISITS,
    percent: totalWork === 0 ? 100 : Math.floor(processedWork * 100 / totalWork),
    overallPercent: Math.floor(overallProcessedWork * 100 / LOTOFACIL_STRUCTURAL_MAX_COMBINATION_VISITS),
  }));
}

function throwIfStructuralBuildCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new StructuralPolicyBuildCancelledError();
}

function preflightStructuralPolicyDependencies(): void {
  const legacyManifest = getLotofacilCanonicalFormulaManifest();
  const snapshotTotal = LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT.buckets.reduce(
    (sum, bucket) => sum + bucket.occurrences,
    0,
  );
  if (
    LOTOFACIL_DEFINITION.id !== "lotofacil" || LOTOFACIL_DEFINITION.version !== "1.0.0" ||
    LOTOFACIL_METRIC_ENGINE_VERSION !== "1.0.0" ||
    LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION !== "1.0.0" ||
    LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION !== "1.0.0" ||
    LOTOFACIL_STRUCTURAL_MASS_ALGORITHM_VERSION !== "1.0.0" ||
    LOTOFACIL_CANONICAL_FORMULA_VERSION !== "1.0.0" ||
    LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT.algorithmVersion !== LOTOFACIL_STRUCTURAL_MASS_ALGORITHM_VERSION ||
    LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT.betSize !== 15 ||
    LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT.totalOutcomes !== LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE ||
    snapshotTotal !== LOTOFACIL_SIMPLE_BET_UNIVERSE_SIZE ||
    legacyManifest.formulaVersion !== LOTOFACIL_CANONICAL_FORMULA_VERSION ||
    legacyManifest.structuralClassification.classifierVersion !== LOTOFACIL_STRUCTURAL_CLASSIFIER_VERSION ||
    legacyManifest.structuralMass.algorithmVersion !== LOTOFACIL_STRUCTURAL_MASS_ALGORITHM_VERSION
  ) {
    throw new StructuralPolicyDependencyMismatchError(
      "Stories 2.1-2.5 structural dependencies are unavailable or incompatible.",
    );
  }
}

export async function buildLotofacilStructuralPolicySet(
  options: BuildLotofacilStructuralPolicySetOptions = {},
): Promise<LotofacilStructuralPolicySet> {
  throwIfStructuralBuildCancelled(options.signal);
  preflightStructuralPolicyDependencies();

  const distributionSets = new Map<LotofacilBetSize, LotofacilStructuralDistributionSet>();
  let overallProcessedWork = 0;
  try {
    for (const betSize of LOTOFACIL_SUPPORTED_BET_SIZES) {
      const set = createStructuralDistributionSet(betSize);
      const universeSize = binomialCoefficient(25, betSize);
      let lastProgress = 0;
      emitStructuralProgress(options, "BUILD_EXACT_DISTRIBUTIONS", betSize, 0, universeSize, overallProcessedWork);
      await forEachCombinationAsync(25, betSize, (indexes) => {
        const profile = calculateLotofacilMetricProfile(indexes.map((index) => index + 1));
        observeStructuralDistribution(set, profile);
        if (set.totalOutcomes - lastProgress >= LOTOFACIL_STRUCTURAL_PROGRESS_INTERVAL) {
          lastProgress = set.totalOutcomes;
          emitStructuralProgress(options, "BUILD_EXACT_DISTRIBUTIONS", betSize, set.totalOutcomes, universeSize, overallProcessedWork + set.totalOutcomes);
        }
      }, { signal: options.signal, batchSize: LOTOFACIL_STRUCTURAL_CANCELLATION_BATCH_SIZE });
      overallProcessedWork += universeSize;
      set.axisProfile = finalizeAxisDistributionProfile(betSize, set.axisAccumulator);
      emitStructuralProgress(options, "BUILD_EXACT_DISTRIBUTIONS", betSize, universeSize, universeSize, overallProcessedWork);
      distributionSets.set(betSize, set);
    }

    const reference = distributionSets.get(15)!;
    const policies = LOTOFACIL_SUPPORTED_BET_SIZES.map((betSize) =>
      deriveLotofacilStructuralPolicy(distributionSets.get(betSize)!, reference));
    const masses: LotofacilStructuralMassArtifact[] = [];
    for (const policy of policies) {
      const internalPolicy = internalPolicyFromArtifact(policy);
      const accumulator = createMassAccumulator();
      const universeSize = policy.universeSize;
      let lastProgress = 0;
      emitStructuralProgress(options, "BUILD_CLASSIFIED_MASSES", policy.betSize, 0, universeSize, overallProcessedWork);
      await forEachCombinationAsync(25, policy.betSize, (indexes) => {
        const profile = calculateLotofacilMetricProfile(indexes.map((index) => index + 1));
        const classification: LotofacilStructuralClassification = {
          classifierVersion: internalPolicy.classifierVersion,
          extremeRules: classifyRulesWithPolicy(profile, internalPolicy),
          auxiliaryAxisSignals: {
            rows: auxiliaryAxisSignal(profile.axisOccupancy.rows, profile.betSize),
            columns: auxiliaryAxisSignal(profile.axisOccupancy.columns, profile.betSize),
          },
        };
        const summary = summarizeWithPolicy(profile, classification, internalPolicy);
        observeMass(accumulator, classification, summary);
        if (accumulator.totalOutcomes - lastProgress >= LOTOFACIL_STRUCTURAL_PROGRESS_INTERVAL) {
          lastProgress = accumulator.totalOutcomes;
          emitStructuralProgress(options, "BUILD_CLASSIFIED_MASSES", policy.betSize, accumulator.totalOutcomes, universeSize, overallProcessedWork + accumulator.totalOutcomes);
        }
      }, { signal: options.signal, batchSize: LOTOFACIL_STRUCTURAL_CANCELLATION_BATCH_SIZE });
      overallProcessedWork += universeSize;
      emitStructuralProgress(options, "BUILD_CLASSIFIED_MASSES", policy.betSize, universeSize, universeSize, overallProcessedWork);
      masses.push(finalizeStructuralMass(policy, accumulator));
    }

    if (overallProcessedWork !== LOTOFACIL_STRUCTURAL_MAX_COMBINATION_VISITS) {
      throw new StructuralMassReconciliationFailedError("Combination visit ceiling was not met exactly.");
    }
    emitStructuralProgress(options, "FINALIZE_ARTIFACTS", null, 0, 13, overallProcessedWork);
    const references = policies.map((policy, index) => ({
      betSize: policy.betSize,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      policyHash: policy.artifactHash,
      massHash: masses[index]!.artifactHash,
    }));
    const indexWithoutHash = {
      contractVersion: LOTOFACIL_STRUCTURAL_POLICY_CONTRACT_VERSION,
      artifactSchemaVersion: LOTOFACIL_STRUCTURAL_ARTIFACT_SCHEMA_VERSION,
      canonicalSerializationVersion: LOTOFACIL_STRUCTURAL_CANONICAL_SERIALIZATION_VERSION,
      policySetId: LOTOFACIL_STRUCTURAL_POLICY_SET_ID,
      policySetVersion: LOTOFACIL_STRUCTURAL_POLICY_SET_VERSION,
      formulaVersion: LOTOFACIL_STRUCTURAL_FORMULA_VERSION,
      classifierVersion: LOTOFACIL_STRUCTURAL_CLASSIFIER_V2_VERSION,
      massAlgorithmVersion: LOTOFACIL_STRUCTURAL_MASS_V2_ALGORITHM_VERSION,
      references,
      historyUsed: false as const,
      samplingUsed: false as const,
      probabilityClaimed: false as const,
    };
    const index = lotofacilStructuralPolicySetIndexSchema.parse({
      ...indexWithoutHash,
      artifactHash: calculateLotofacilStructuralArtifactHash(indexWithoutHash),
    });
    const result = lotofacilStructuralPolicySetSchema.parse({
      contractVersion: LOTOFACIL_STRUCTURAL_POLICY_CONTRACT_VERSION,
      formulaVersion: LOTOFACIL_STRUCTURAL_FORMULA_VERSION,
      combinationVisits: LOTOFACIL_STRUCTURAL_MAX_COMBINATION_VISITS,
      policies,
      masses,
      index,
      transient: true,
      persisted: false,
      partial: false,
    });
    const verifiedResult = verifyLotofacilStructuralPolicySet(result);
    emitStructuralProgress(options, "FINALIZE_ARTIFACTS", null, 13, 13, overallProcessedWork);
    return verifiedResult;
  } catch (error) {
    if (error instanceof CombinationIterationCancelledError || options.signal?.aborted) {
      throw new StructuralPolicyBuildCancelledError();
    }
    throw error;
  }
}

export function verifyLotofacilStructuralPolicySet(input: unknown): LotofacilStructuralPolicySet {
  const result = lotofacilStructuralPolicySetSchema.parse(input);
  for (const artifact of [...result.policies, ...result.masses, result.index]) {
    const actual = calculateLotofacilStructuralArtifactHash(
      hashableArtifact(artifact as unknown as Record<string, unknown>),
    );
    if (actual !== artifact.artifactHash) throw new StructuralArtifactHashMismatchError();
  }
  result.policies.forEach((policy, index) => {
    const mass = result.masses[index]!;
    const reference = result.index.references[index]!;
    if (
      policy.betSize !== LOTOFACIL_SUPPORTED_BET_SIZES[index] || mass.betSize !== policy.betSize ||
      reference.betSize !== policy.betSize || reference.policyHash !== policy.artifactHash ||
      reference.massHash !== mass.artifactHash || mass.policyId !== policy.policyId
    ) throw new StructuralPolicyDependencyMismatchError();
  });
  const legacyMasses = result.masses[0]!.bandMasses.map((bucket) => bucket.count);
  const legacySnapshot = LOTOFACIL_STRUCTURAL_MASS_SNAPSHOT.buckets.map((bucket) => bucket.occurrences);
  if (legacyMasses.some((count, index) => count !== legacySnapshot[index])) {
    throw new StructuralMassReconciliationFailedError("The 15-number legacy mass changed.");
  }
  return result;
}

export interface LotofacilCanonicalFormulaManifestV1_1 {
  readonly formulaVersion: typeof LOTOFACIL_STRUCTURAL_FORMULA_VERSION;
  readonly legacyManifest: LotofacilCanonicalFormulaManifest;
  readonly structuralPolicySet: Readonly<{
    policySetId: typeof LOTOFACIL_STRUCTURAL_POLICY_SET_ID;
    policySetVersion: typeof LOTOFACIL_STRUCTURAL_POLICY_SET_VERSION;
    indexHash: string;
    references: LotofacilStructuralPolicySet["index"]["references"];
  }>;
}

export function getLotofacilCanonicalFormulaManifestV1_1(
  input: unknown,
): LotofacilCanonicalFormulaManifestV1_1 {
  const policySet = verifyLotofacilStructuralPolicySet(input);
  return {
    formulaVersion: LOTOFACIL_STRUCTURAL_FORMULA_VERSION,
    legacyManifest: getLotofacilCanonicalFormulaManifest(),
    structuralPolicySet: {
      policySetId: LOTOFACIL_STRUCTURAL_POLICY_SET_ID,
      policySetVersion: LOTOFACIL_STRUCTURAL_POLICY_SET_VERSION,
      indexHash: policySet.index.artifactHash,
      references: policySet.index.references.map((reference) => ({ ...reference })),
    },
  };
}
