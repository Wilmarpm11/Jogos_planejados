import {
  DEFAULT_RARITY_THRESHOLDS,
  type AxisName,
  type AxisOccupancy,
  type AxisOccupancyMetric,
  type AxisRarityAssessment,
  type ExactFraction,
  type RarityClass,
  type RarityThresholds,
  type LotteryDefinition,
  type LotteryMetricEngine,
  type StructuralClassifier,
  type StructuralBand,
  type StructuralMassProfile,
  type StructuralRuleFlag,
  type StructuralSummary,
  type TheoreticalAxisDistribution,
  type TheoreticalDistributionBucket,
} from "@boloes/lottery-contracts";
import { forEachCombination } from "@boloes/combinatorics";

export const LOTOFACIL_ID = "lotofacil";
export const LOTOFACIL_METRIC_ENGINE_VERSION = "1.0.0";
export const LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION = "1.0.0";
export const LOTOFACIL_STRUCTURAL_MASS_ALGORITHM_VERSION = "1.0.0";
export const LOTOFACIL_SUPPORTED_BET_SIZES = [15, 16, 17, 18, 19, 20] as const;
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
    E1: rule(metrics.evenCount <= 4 || metrics.evenCount >= 11),
    E2: rule(metrics.sum <= 149 || metrics.sum >= 241),
    E3: rule(metrics.borderCount <= 6 || metrics.borderCount >= 14),
    E4: rule(metrics.lowCount <= 4 || metrics.lowCount >= 12),
    E5: rule(metrics.consecutivePairCount <= 5 || metrics.consecutivePairCount >= 12),
    E6: rule(metrics.maxConsecutiveRun <= 2 || metrics.maxConsecutiveRun >= 9),
    E7: rule(metrics.sequenceCount <= 1 || metrics.sequenceCount >= 7),
    E8: rule(metrics.amplitude <= 18),
    E9: rule(axisOccupancy.rows.deviation.numerator >= 8 * axisOccupancy.rows.deviation.denominator),
    E10: rule(
      axisOccupancy.columns.deviation.numerator >=
        8 * axisOccupancy.columns.deviation.denominator,
    ),
  };
}

function auxiliaryAxisSignal(
  occupancy: AxisOccupancy,
  betSize: LotofacilBetSize,
): LotofacilAxisAuxiliaryClassification {
  if (betSize !== 15) {
    return { applicable: false, signal: null };
  }
  if (occupancy.axesWith[0] >= 2) {
    return { applicable: true, signal: "VERY_RARE" };
  }
  if (occupancy.axesWith[0] >= 1) {
    return { applicable: true, signal: "RARE" };
  }
  if (occupancy.axesWith[1] >= 2) {
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
    classifierVersion: "1.0.0",
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
    evenCount: metrics.evenCount >= 6 && metrics.evenCount <= 9,
    sum: metrics.sum >= 176 && metrics.sum <= 214,
    borderCount: metrics.borderCount >= 8 && metrics.borderCount <= 12,
    lowCount: metrics.lowCount >= 7 && metrics.lowCount <= 10,
    consecutivePairCount:
      metrics.consecutivePairCount >= 7 && metrics.consecutivePairCount <= 10,
  };

  return {
    applicable: true,
    extremeCount,
    band: structuralBand(extremeCount),
    isCentralCore: Object.values(centralCoreCriteria).every(Boolean),
    centralCoreCriteria,
  };
}

const STRUCTURAL_BAND_ORDER: readonly StructuralBand[] = [
  "ZERO_EXTREMES",
  "ONE_EXTREME",
  "TWO_EXTREMES",
  "THREE_EXTREMES",
  "FOUR_PLUS_EXTREMES",
];

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
