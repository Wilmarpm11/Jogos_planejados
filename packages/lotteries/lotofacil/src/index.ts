import {
  DEFAULT_RARITY_THRESHOLDS,
  type AxisName,
  type AxisOccupancy,
  type AxisOccupancyMetric,
  type AxisRarityAssessment,
  type ExactFraction,
  type RarityClass,
  type RarityThresholds,
  type TheoreticalAxisDistribution,
  type TheoreticalDistributionBucket,
} from "@boloes/lottery-contracts";

export const LOTOFACIL_ID = "lotofacil";
export const LOTOFACIL_AXIS_OCCUPANCY_ALGORITHM_VERSION = "1.0.0";
export const LOTOFACIL_SUPPORTED_BET_SIZES = [15, 16, 17, 18, 19, 20] as const;

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

const cachedTheoreticalProfiles = new Map<LotofacilBetSize, LotofacilTheoreticalAxisProfile>();

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
