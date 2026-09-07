/**
 * Test-only independent oracle for Story 4.11. It deliberately imports no
 * production module and never updates fixtures.
 */

interface Fraction { numerator: number; denominator: number }
interface Tail { operator: string; limit: number | Fraction }
interface Rule { metric: string; tails: Tail[] }
interface Criterion { metric: string; minInclusive: number; maxInclusive: number }
export interface OraclePolicy { betSize: number; rules: Rule[]; centralCore: Criterion[] }

interface Metrics {
  EVEN_COUNT: number;
  SUM: number;
  BORDER_COUNT: number;
  LOW_01_TO_13_COUNT: number;
  CONSECUTIVE_PAIR_COUNT: number;
  MAX_CONSECUTIVE_RUN: number;
  SEQUENCE_COUNT: number;
  AMPLITUDE: number;
  ROW_DEVIATION_NORMALIZED: Fraction;
  COLUMN_DEVIATION_NORMALIZED: Fraction;
}

const SCALAR_METRICS = [
  "EVEN_COUNT", "SUM", "BORDER_COUNT", "LOW_01_TO_13_COUNT",
  "CONSECUTIVE_PAIR_COUNT", "MAX_CONSECUTIVE_RUN", "SEQUENCE_COUNT", "AMPLITUDE",
] as const;
const RULE_METRICS = [
  ...SCALAR_METRICS, "ROW_DEVIATION_NORMALIZED", "COLUMN_DEVIATION_NORMALIZED",
] as const;
const CORE_METRICS = [
  "EVEN_COUNT", "SUM", "BORDER_COUNT", "LOW_01_TO_13_COUNT", "CONSECUTIVE_PAIR_COUNT",
] as const;
const LEGACY_RULE_LIMITS = [
  [4, 11], [149, 241], [6, 14], [4, 12], [5, 12], [2, 9], [1, 7], [18],
] as const;
const LEGACY_CORE_LIMITS = [[6, 9], [176, 214], [8, 12], [7, 10], [7, 10]] as const;

const BORDER = new Set([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25]);

function deviation(counts: readonly number[], betSize: number): Fraction {
  const numerator = counts.reduce((sum, count) => sum + Math.abs(count * 5 - betSize), 0);
  return reduce(numerator, 5 * betSize);
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a === 0 ? 1 : a;
}

function reduce(numerator: number, denominator: number): Fraction {
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function calculateMetrics(numbers: readonly number[]): Metrics {
  let even = 0;
  let sum = 0;
  let border = 0;
  let low = 0;
  let pairs = 0;
  let maxRun = 1;
  let sequences = 0;
  let run = 1;
  const rows = [0, 0, 0, 0, 0];
  const columns = [0, 0, 0, 0, 0];
  numbers.forEach((number, index) => {
    if (number % 2 === 0) even += 1;
    sum += number;
    if (BORDER.has(number)) border += 1;
    if (number <= 13) low += 1;
    rows[Math.floor((number - 1) / 5)]! += 1;
    columns[(number - 1) % 5]! += 1;
    if (index > 0 && number === numbers[index - 1]! + 1) {
      pairs += 1;
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else if (index > 0) {
      if (run >= 2) sequences += 1;
      run = 1;
    }
  });
  if (run >= 2) sequences += 1;
  return {
    EVEN_COUNT: even,
    SUM: sum,
    BORDER_COUNT: border,
    LOW_01_TO_13_COUNT: low,
    CONSECUTIVE_PAIR_COUNT: pairs,
    MAX_CONSECUTIVE_RUN: maxRun,
    SEQUENCE_COUNT: sequences,
    AMPLITUDE: numbers.at(-1)! - numbers[0]!,
    ROW_DEVIATION_NORMALIZED: deviation(rows, numbers.length),
    COLUMN_DEVIATION_NORMALIZED: deviation(columns, numbers.length),
  };
}

function asFraction(value: number | Fraction): Fraction {
  return typeof value === "number" ? { numerator: value, denominator: 1 } : value;
}

function matches(value: number | Fraction, tail: Tail): boolean {
  const left = asFraction(value);
  const right = asFraction(tail.limit);
  const difference = BigInt(left.numerator) * BigInt(right.denominator) -
    BigInt(right.numerator) * BigInt(left.denominator);
  if (tail.operator === "LESS_THAN") return difference < 0n;
  if (tail.operator === "LESS_THAN_OR_EQUAL") return difference <= 0n;
  if (tail.operator === "GREATER_THAN") return difference > 0n;
  return difference >= 0n;
}

function band(extremeCount: number): string {
  return extremeCount === 0 ? "ZERO_EXTREMES"
    : extremeCount === 1 ? "ONE_EXTREME"
      : extremeCount === 2 ? "TWO_EXTREMES"
        : extremeCount === 3 ? "THREE_EXTREMES"
          : "FOUR_PLUS_EXTREMES";
}

export interface OracleMassCounts {
  readonly ruleCounts: number[];
  readonly extremeCounts: number[];
  readonly bandCounts: Record<string, number>;
  readonly coreCriterionCounts: number[];
  readonly centralCoreCount: number;
  readonly bandCoreCounts: Record<string, number>;
  readonly totalOutcomes: number;
}

function forEachOracleCombination(
  betSize: number,
  visitor: (combination: readonly number[]) => void,
): number {
  const combination = Array.from({ length: betSize }, () => 0);
  let visits = 0;
  const visitDepthFirst = (depth: number, minimum: number): void => {
    if (depth === betSize) {
      visitor(combination);
      visits += 1;
      return;
    }
    const remainingAfterChoice = betSize - depth - 1;
    for (let value = minimum; value <= 25 - remainingAfterChoice; value += 1) {
      combination[depth] = value;
      visitDepthFirst(depth + 1, value + 1);
    }
  };
  visitDepthFirst(0, 1);
  return visits;
}

export function enumerateOracleMass(policy: OraclePolicy): OracleMassCounts {
  const ruleCounts = Array.from({ length: 10 }, () => 0);
  const extremeCounts = Array.from({ length: 11 }, () => 0);
  const bandCounts: Record<string, number> = {
    ZERO_EXTREMES: 0, ONE_EXTREME: 0, TWO_EXTREMES: 0,
    THREE_EXTREMES: 0, FOUR_PLUS_EXTREMES: 0,
  };
  const coreCriterionCounts = Array.from({ length: 5 }, () => 0);
  const bandCoreCounts: Record<string, number> = {};
  for (const name of Object.keys(bandCounts)) {
    bandCoreCounts[`${name}:false`] = 0;
    bandCoreCounts[`${name}:true`] = 0;
  }
  let centralCoreCount = 0;
  let totalOutcomes = 0;
  forEachOracleCombination(policy.betSize, (combination) => {
    const metrics = calculateMetrics(combination);
    const flags = policy.rules.map((rule) => rule.tails.some((tail) =>
      matches(metrics[rule.metric as keyof Metrics], tail)));
    flags.forEach((flag, index) => { if (flag) ruleCounts[index]! += 1; });
    const count = flags.filter(Boolean).length;
    extremeCounts[count]! += 1;
    const bandName = band(count);
    bandCounts[bandName]! += 1;
    const coreFlags = policy.centralCore.map((criterion) => {
      const value = metrics[criterion.metric as keyof Metrics] as number;
      return value >= criterion.minInclusive && value <= criterion.maxInclusive;
    });
    coreFlags.forEach((flag, index) => { if (flag) coreCriterionCounts[index]! += 1; });
    const isCore = coreFlags.every(Boolean);
    if (isCore) centralCoreCount += 1;
    bandCoreCounts[`${bandName}:${isCore}`]! += 1;
    totalOutcomes += 1;
  });
  return {
    ruleCounts, extremeCounts, bandCounts, coreCriterionCounts,
    centralCoreCount, bandCoreCounts, totalOutcomes,
  };
}

interface OracleDistributionSet {
  readonly betSize: number;
  readonly totalOutcomes: number;
  readonly scalar: Record<(typeof SCALAR_METRICS)[number], Map<number, number>>;
  readonly scalarWitnesses: Record<(typeof SCALAR_METRICS)[number], Map<number, readonly number[]>>;
  readonly normalizedAxis: Record<"ROWS" | "COLUMNS", Map<string, {
    fraction: Fraction;
    count: number;
    witness: readonly number[];
  }>>;
}

export function enumerateOracleDistributions(betSize: number): OracleDistributionSet {
  const scalar = Object.fromEntries(SCALAR_METRICS.map((metric) => [metric, new Map<number, number>()])) as
    OracleDistributionSet["scalar"];
  const scalarWitnesses = Object.fromEntries(
    SCALAR_METRICS.map((metric) => [metric, new Map<number, readonly number[]>()]),
  ) as OracleDistributionSet["scalarWitnesses"];
  const normalizedAxis: OracleDistributionSet["normalizedAxis"] = { ROWS: new Map(), COLUMNS: new Map() };
  const totalOutcomes = forEachOracleCombination(betSize, (combination) => {
    const metrics = calculateMetrics(combination);
    for (const metric of SCALAR_METRICS) {
      const histogram = scalar[metric];
      const value = metrics[metric];
      histogram.set(value, (histogram.get(value) ?? 0) + 1);
      if (!scalarWitnesses[metric].has(value)) scalarWitnesses[metric].set(value, [...combination]);
    }
    for (const [axis, value] of [
      ["ROWS", metrics.ROW_DEVIATION_NORMALIZED],
      ["COLUMNS", metrics.COLUMN_DEVIATION_NORMALIZED],
    ] as const) {
      const key = `${value.numerator}/${value.denominator}`;
      const current = normalizedAxis[axis].get(key);
      normalizedAxis[axis].set(key, {
        fraction: value,
        count: (current?.count ?? 0) + 1,
        witness: current?.witness ?? [...combination],
      });
    }
  });
  return { betSize, totalOutcomes, scalar, scalarWitnesses, normalizedAxis };
}

function tailCountFromHistogram(
  histogram: ReadonlyMap<number, number>,
  limit: number,
  operator: Tail["operator"],
): number {
  let count = 0;
  for (const [value, occurrences] of histogram) {
    if (matches(value, { limit, operator })) count += occurrences;
  }
  return count;
}

interface OracleSelectedTail<T extends number | Fraction> {
  readonly limit: T;
  readonly count: number;
  readonly distanceNumerator: number;
}

function selectOracleScalarTail(
  histogram: ReadonlyMap<number, number>,
  universeSize: number,
  referenceCount: number,
  referenceUniverseSize: number,
  operator: Tail["operator"],
  preferHigherLimit: boolean,
  tiePolicy: "EXTREME_MIN_COUNT" | "CORE_NARROW_LIMIT" = "EXTREME_MIN_COUNT",
): OracleSelectedTail<number> {
  let best: OracleSelectedTail<number> | undefined;
  const values = [...histogram.keys()].sort((left, right) => left - right);
  for (const limit of values) {
    const count = tailCountFromHistogram(histogram, limit, operator);
    const raw = BigInt(count) * BigInt(referenceUniverseSize) -
      BigInt(referenceCount) * BigInt(universeSize);
    const distanceNumerator = Number(raw < 0n ? -raw : raw);
    if (!best || distanceNumerator < best.distanceNumerator ||
      distanceNumerator === best.distanceNumerator && tiePolicy === "EXTREME_MIN_COUNT" && count < best.count ||
      distanceNumerator === best.distanceNumerator &&
        (tiePolicy === "CORE_NARROW_LIMIT" || count === best.count) &&
        (preferHigherLimit ? limit > best.limit : limit < best.limit)) {
      best = { limit, count, distanceNumerator };
    }
  }
  if (!best) throw new Error("Oracle received empty scalar support.");
  return best;
}

function compareFraction(left: Fraction, right: Fraction): bigint {
  return BigInt(left.numerator) * BigInt(right.denominator) -
    BigInt(right.numerator) * BigInt(left.denominator);
}

function axisUpperCount(
  histogram: OracleDistributionSet["normalizedAxis"]["ROWS"],
  limit: Fraction,
): number {
  let count = 0;
  for (const cell of histogram.values()) {
    if (compareFraction(cell.fraction, limit) >= 0n) count += cell.count;
  }
  return count;
}

function selectOracleAxisTail(
  histogram: OracleDistributionSet["normalizedAxis"]["ROWS"],
  universeSize: number,
  referenceCount: number,
  referenceUniverseSize: number,
): OracleSelectedTail<Fraction> {
  let best: OracleSelectedTail<Fraction> | undefined;
  for (const cell of histogram.values()) {
    const limit = cell.fraction;
    const count = axisUpperCount(histogram, limit);
    const raw = BigInt(count) * BigInt(referenceUniverseSize) -
      BigInt(referenceCount) * BigInt(universeSize);
    const distanceNumerator = Number(raw < 0n ? -raw : raw);
    if (!best || distanceNumerator < best.distanceNumerator ||
      distanceNumerator === best.distanceNumerator && count < best.count ||
      distanceNumerator === best.distanceNumerator && count === best.count &&
        compareFraction(limit, best.limit) > 0n) {
      best = { limit, count, distanceNumerator };
    }
  }
  if (!best) throw new Error("Oracle received empty normalized-axis support.");
  return best;
}

export interface OracleDerivedPolicy {
  readonly betSize: number;
  readonly enumerationVisits: number;
  readonly rules: readonly {
    readonly metric: string;
    readonly tails: readonly (OracleSelectedTail<number | Fraction> & OracleBoundaryWitnesses)[];
  }[];
  readonly centralCore: readonly {
    readonly metric: string;
    readonly minInclusive: number;
    readonly maxInclusive: number;
    readonly lowerTail: OracleSelectedTail<number> & OracleBoundaryWitnesses;
    readonly upperTail: OracleSelectedTail<number> & OracleBoundaryWitnesses;
  }[];
}

interface OracleBoundaryWitnesses {
  readonly atLimit: readonly number[];
  readonly below?: readonly number[];
  readonly above?: readonly number[];
}

function scalarBoundaryWitnesses(
  selected: OracleSelectedTail<number>,
  distribution: OracleDistributionSet,
  metric: (typeof SCALAR_METRICS)[number],
): OracleSelectedTail<number> & OracleBoundaryWitnesses {
  const support = [...distribution.scalar[metric].keys()].sort((left, right) => left - right);
  const index = support.indexOf(selected.limit);
  if (index < 0) throw new Error("Selected scalar limit is outside oracle support.");
  return {
    ...selected,
    atLimit: distribution.scalarWitnesses[metric].get(selected.limit)!,
    ...(index > 0 ? { below: distribution.scalarWitnesses[metric].get(support[index - 1]!)! } : {}),
    ...(index + 1 < support.length ? { above: distribution.scalarWitnesses[metric].get(support[index + 1]!)! } : {}),
  };
}

function axisBoundaryWitnesses(
  selected: OracleSelectedTail<Fraction>,
  distribution: OracleDistributionSet,
  axis: "ROWS" | "COLUMNS",
): OracleSelectedTail<Fraction> & OracleBoundaryWitnesses {
  const support = [...distribution.normalizedAxis[axis].values()]
    .sort((left, right) => Number(compareFraction(left.fraction, right.fraction)));
  const index = support.findIndex((cell) => compareFraction(cell.fraction, selected.limit) === 0n);
  if (index < 0) throw new Error("Selected normalized-axis limit is outside oracle support.");
  return {
    ...selected,
    atLimit: support[index]!.witness,
    ...(index > 0 ? { below: support[index - 1]!.witness } : {}),
    ...(index + 1 < support.length ? { above: support[index + 1]!.witness } : {}),
  };
}

/** Independent first pass and exact rational selection used only by tests. */
export function deriveOraclePolicies(): readonly OracleDerivedPolicy[] {
  const distributions = [15, 16, 17, 18, 19, 20].map(enumerateOracleDistributions);
  const reference = distributions[0]!;
  return distributions.map((distribution) => {
    const scalarRules = SCALAR_METRICS.map((metric, index) => {
      const limits = LEGACY_RULE_LIMITS[index]!;
      const referenceLowerCount = tailCountFromHistogram(
        reference.scalar[metric], limits[0], "LESS_THAN_OR_EQUAL",
      );
      const lower = distribution.betSize === 15
        ? { limit: limits[0], count: referenceLowerCount, distanceNumerator: 0 }
        : selectOracleScalarTail(
          distribution.scalar[metric], distribution.totalOutcomes,
          referenceLowerCount, reference.totalOutcomes, "LESS_THAN_OR_EQUAL", false,
        );
      const tails: Array<OracleSelectedTail<number | Fraction> & OracleBoundaryWitnesses> = [
        scalarBoundaryWitnesses(lower, distribution, metric),
      ];
      if (limits.length === 2) {
        const referenceUpperCount = tailCountFromHistogram(
          reference.scalar[metric], limits[1], "GREATER_THAN_OR_EQUAL",
        );
        const upper = distribution.betSize === 15
          ? { limit: limits[1], count: referenceUpperCount, distanceNumerator: 0 }
          : selectOracleScalarTail(
            distribution.scalar[metric], distribution.totalOutcomes,
            referenceUpperCount, reference.totalOutcomes, "GREATER_THAN_OR_EQUAL", true,
          );
        tails.push(scalarBoundaryWitnesses(upper, distribution, metric));
      }
      return { metric, tails };
    });
    const axisRules = (["ROWS", "COLUMNS"] as const).map((axis, index) => {
      const referenceCount = axisUpperCount(reference.normalizedAxis[axis], { numerator: 8, denominator: 15 });
      const selected = distribution.betSize === 15
        ? { limit: { numerator: 8, denominator: 15 }, count: referenceCount, distanceNumerator: 0 }
        : selectOracleAxisTail(
          distribution.normalizedAxis[axis], distribution.totalOutcomes,
          referenceCount, reference.totalOutcomes,
        );
      return { metric: RULE_METRICS[8 + index]!, tails: [axisBoundaryWitnesses(selected, distribution, axis)] };
    });
    const centralCore = CORE_METRICS.map((metric, index) => {
      const [minimum, maximum] = LEGACY_CORE_LIMITS[index]!;
      const referenceLowerCount = tailCountFromHistogram(reference.scalar[metric], minimum, "LESS_THAN");
      const referenceUpperCount = tailCountFromHistogram(reference.scalar[metric], maximum, "GREATER_THAN");
      const lowerTail = distribution.betSize === 15
        ? { limit: minimum, count: referenceLowerCount, distanceNumerator: 0 }
        : selectOracleScalarTail(
          distribution.scalar[metric], distribution.totalOutcomes,
          referenceLowerCount, reference.totalOutcomes, "LESS_THAN", true, "CORE_NARROW_LIMIT",
        );
      const upperTail = distribution.betSize === 15
        ? { limit: maximum, count: referenceUpperCount, distanceNumerator: 0 }
        : selectOracleScalarTail(
          distribution.scalar[metric], distribution.totalOutcomes,
          referenceUpperCount, reference.totalOutcomes, "GREATER_THAN", false, "CORE_NARROW_LIMIT",
        );
      return {
        metric,
        minInclusive: lowerTail.limit,
        maxInclusive: upperTail.limit,
        lowerTail: scalarBoundaryWitnesses(lowerTail, distribution, metric),
        upperTail: scalarBoundaryWitnesses(upperTail, distribution, metric),
      };
    });
    return {
      betSize: distribution.betSize,
      enumerationVisits: distribution.totalOutcomes,
      rules: [...scalarRules, ...axisRules],
      centralCore,
    };
  });
}

export function selectOracleTail(
  histogram: ReadonlyMap<number, number>,
  universeSize: number,
  referenceCount: number,
  referenceUniverseSize: number,
  operator: Tail["operator"],
  preferHigherLimit: boolean,
): number {
  return selectOracleScalarTail(
    histogram, universeSize, referenceCount, referenceUniverseSize,
    operator, preferHigherLimit,
  ).limit;
}
