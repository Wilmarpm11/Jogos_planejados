import {
  DEFAULT_RARITY_THRESHOLDS,
  STRUCTURAL_BAND_ORDER,
  type AxisName,
  type AxisOccupancy,
  type AxisOccupancyMetric,
  type AxisRarityAssessment,
  createDeterministicRandom,
  type ExactFraction,
  type RarityClass,
  type RarityThresholds,
  type LotteryDefinition,
  type LotteryMetricEngine,
  type PortfolioGenerationRequest,
  type PortfolioGenerationResult,
  type PortfolioGenerator,
  type PortfolioStructuralDistributionAdapter,
  type StructuralClassifier,
  type StructuralBand,
  type StructuralMassProfile,
  type StructuralRuleFlag,
  type StructuralSummary,
  type TheoreticalAxisDistribution,
  type TheoreticalDistributionBucket,
} from "@boloes/lottery-contracts";
import { forEachCombination } from "@boloes/combinatorics";
import {
  CONTRACT_VERSION,
  HASH_ALGORITHM,
  HASH_VERSION,
} from "@boloes/domain-core";

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
  const mass = calculateLotofacilStructuralMass();
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

function structuralAllocationCounts(
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

function canonicalGameOrder(left: readonly number[], right: readonly number[]): number {
  return left.join(",").localeCompare(right.join(","));
}

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
    ? structuralAllocationCounts(strategy.structuralAllocation, parameters.candidateCount)
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
    candidates: candidates.sort(canonicalGameOrder).map((numbers) => ({ numbers })),
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

  const rowEmpty = initializeHistogram();
  const rowSingleton = initializeHistogram();
  const rowDeviationNormalized = initializeHistogram();
  const columnEmpty = initializeHistogram();
  const columnSingleton = initializeHistogram();
  const columnDeviationNormalized = initializeHistogram();
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

    const row = axisOccupancy(rows, betSize);
    const column = axisOccupancy(columns, betSize);
    increment(rowEmpty, row.axesWith[0]);
    increment(rowSingleton, row.axesWith[1]);
    increment(rowDeviationNormalized, axisDeviationNumerator(rows, betSize));
    increment(columnEmpty, column.axesWith[0]);
    increment(columnSingleton, column.axesWith[1]);
    increment(columnDeviationNormalized, axisDeviationNumerator(columns, betSize));
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

  const normalizedDenominator = 5 * betSize;
  const profile: LotofacilTheoreticalAxisProfile = {
    betSize,
    algorithmVersion: LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION,
    totalOutcomes,
    distributions: [
      distribution(betSize, "ROWS", "AXES_WITH_0", totalOutcomes, histogramBuckets(rowEmpty, 1)),
      distribution(betSize, "ROWS", "AXES_WITH_1", totalOutcomes, histogramBuckets(rowSingleton, 1)),
      distribution(
        betSize,
        "ROWS",
        "DEVIATION_NORMALIZED",
        totalOutcomes,
        histogramBuckets(rowDeviationNormalized, normalizedDenominator),
      ),
      distribution(betSize, "COLUMNS", "AXES_WITH_0", totalOutcomes, histogramBuckets(columnEmpty, 1)),
      distribution(betSize, "COLUMNS", "AXES_WITH_1", totalOutcomes, histogramBuckets(columnSingleton, 1)),
      distribution(
        betSize,
        "COLUMNS",
        "DEVIATION_NORMALIZED",
        totalOutcomes,
        histogramBuckets(columnDeviationNormalized, normalizedDenominator),
      ),
    ],
  };
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

function extremeRulesForSimpleBet(
  metrics: LotofacilCoreMetrics,
  axisOccupancy: LotofacilAxisOccupancyProfile,
): Readonly<Record<LotofacilExtremeRuleId, StructuralRuleFlag>> {
  if (axisOccupancy.betSize !== 15) {
    return nonApplicableRules();
  }

  const rule = (isExtreme: boolean): StructuralRuleFlag => ({
    applicable: true,
    isExtreme,
  });
  return {
    E1: rule(
      metrics.evenCount <= LOTOFACIL_EXTREME_RULE_LIMITS.E1.atMost ||
        metrics.evenCount >= LOTOFACIL_EXTREME_RULE_LIMITS.E1.atLeast,
    ),
    E2: rule(
      metrics.sum <= LOTOFACIL_EXTREME_RULE_LIMITS.E2.atMost ||
        metrics.sum >= LOTOFACIL_EXTREME_RULE_LIMITS.E2.atLeast,
    ),
    E3: rule(
      metrics.borderCount <= LOTOFACIL_EXTREME_RULE_LIMITS.E3.atMost ||
        metrics.borderCount >= LOTOFACIL_EXTREME_RULE_LIMITS.E3.atLeast,
    ),
    E4: rule(
      metrics.lowCount <= LOTOFACIL_EXTREME_RULE_LIMITS.E4.atMost ||
        metrics.lowCount >= LOTOFACIL_EXTREME_RULE_LIMITS.E4.atLeast,
    ),
    E5: rule(
      metrics.consecutivePairCount <= LOTOFACIL_EXTREME_RULE_LIMITS.E5.atMost ||
        metrics.consecutivePairCount >= LOTOFACIL_EXTREME_RULE_LIMITS.E5.atLeast,
    ),
    E6: rule(
      metrics.maxConsecutiveRun <= LOTOFACIL_EXTREME_RULE_LIMITS.E6.atMost ||
        metrics.maxConsecutiveRun >= LOTOFACIL_EXTREME_RULE_LIMITS.E6.atLeast,
    ),
    E7: rule(
      metrics.sequenceCount <= LOTOFACIL_EXTREME_RULE_LIMITS.E7.atMost ||
        metrics.sequenceCount >= LOTOFACIL_EXTREME_RULE_LIMITS.E7.atLeast,
    ),
    E8: rule(metrics.amplitude <= LOTOFACIL_EXTREME_RULE_LIMITS.E8.atMost),
    E9: rule(
      axisOccupancy.rows.deviation.numerator >=
        LOTOFACIL_EXTREME_RULE_LIMITS.E9.deviationAtLeast *
          axisOccupancy.rows.deviation.denominator,
    ),
    E10: rule(
      axisOccupancy.columns.deviation.numerator >=
        LOTOFACIL_EXTREME_RULE_LIMITS.E10.deviationAtLeast *
          axisOccupancy.columns.deviation.denominator,
    ),
  };
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
    extremeRules: extremeRulesForSimpleBet(profile.metrics, profile.axisOccupancy),
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

  const rules = Object.values(classification.extremeRules);
  if (rules.some((rule) => !rule.applicable || rule.isExtreme === null)) {
    throw new Error("A simple Lotofácil bet requires all E1–E10 rules to be applicable.");
  }
  const extremeCount = rules.filter((rule) => rule.isExtreme).length;
  const metrics = profile.metrics;
  const centralCoreCriteria = {
    evenCount:
      metrics.evenCount >= LOTOFACIL_CENTRAL_CORE_LIMITS.evenCount.min &&
      metrics.evenCount <= LOTOFACIL_CENTRAL_CORE_LIMITS.evenCount.max,
    sum:
      metrics.sum >= LOTOFACIL_CENTRAL_CORE_LIMITS.sum.min &&
      metrics.sum <= LOTOFACIL_CENTRAL_CORE_LIMITS.sum.max,
    borderCount:
      metrics.borderCount >= LOTOFACIL_CENTRAL_CORE_LIMITS.borderCount.min &&
      metrics.borderCount <= LOTOFACIL_CENTRAL_CORE_LIMITS.borderCount.max,
    lowCount:
      metrics.lowCount >= LOTOFACIL_CENTRAL_CORE_LIMITS.lowCount.min &&
      metrics.lowCount <= LOTOFACIL_CENTRAL_CORE_LIMITS.lowCount.max,
    consecutivePairCount:
      metrics.consecutivePairCount >= LOTOFACIL_CENTRAL_CORE_LIMITS.consecutivePairCount.min &&
      metrics.consecutivePairCount <= LOTOFACIL_CENTRAL_CORE_LIMITS.consecutivePairCount.max,
  };

  return {
    applicable: true,
    extremeCount,
    band: structuralBand(extremeCount),
    isCentralCore: Object.values(centralCoreCriteria).every(Boolean),
    centralCoreCriteria,
  };
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
