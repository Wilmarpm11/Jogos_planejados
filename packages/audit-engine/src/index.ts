import {
  basicPortfolioAuditRequestSchema,
  basicPortfolioAuditResultSchema,
  pairwisePortfolioAuditProgressSchema,
  pairwisePortfolioAuditRequestSchema,
  pairwisePortfolioAuditResultSchema,
  portfolioStructuralDistributionAuditProgressSchema,
  portfolioStructuralDistributionAuditRequestSchema,
  portfolioStructuralDistributionAuditResultSchema,
  PAIRWISE_PORTFOLIO_AUDIT_ALGORITHM_VERSION,
  PAIRWISE_PORTFOLIO_AUDIT_CONTRACT_VERSION,
  PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_ALGORITHM_VERSION,
  PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_CONTRACT_VERSION,
  STRUCTURAL_BAND_ORDER,
  type BasicPortfolioAuditResult,
  type PairwisePortfolioAuditProgress,
  type PairwisePortfolioAuditResult,
  type PairwisePortfolioIntersection,
  type PortfolioStructuralDistributionAdapter,
  type PortfolioStructuralDistributionAuditProgress,
  type PortfolioStructuralDistributionAuditResult,
  type StructuralBand,
} from "@boloes/lottery-contracts";

const PAIRWISE_AUDIT_BATCH_SIZE = 2_048;
const STRUCTURAL_DISTRIBUTION_AUDIT_BATCH_SIZE = 256;

function pairKey(first: number, second: number): string {
  return `${first}:${second}`;
}

function compareGames(left: readonly number[], right: readonly number[]): number {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function validateDefinition(
  definition: { totalNumbers: number; drawSize: number; minBetSize: number; maxBetSize: number },
): void {
  if (definition.drawSize > definition.totalNumbers) {
    throw new Error("Lottery drawSize cannot exceed totalNumbers.");
  }
  if (definition.minBetSize > definition.maxBetSize || definition.maxBetSize > definition.totalNumbers) {
    throw new Error("Lottery bet-size bounds must be ordered and contained in the number universe.");
  }
}

function validateCandidate(
  numbers: readonly number[],
  candidateIndex: number,
  betSize: number,
  totalNumbers: number,
): void {
  if (numbers.length !== betSize) {
    throw new Error(`Candidate ${candidateIndex} must contain exactly ${betSize} numbers.`);
  }
  for (let index = 0; index < numbers.length; index += 1) {
    const number = numbers[index]!;
    if (number < 1 || number > totalNumbers) {
      throw new Error(`Candidate ${candidateIndex} contains number ${number} outside 1-${totalNumbers}.`);
    }
    if (index > 0 && number === numbers[index - 1]) {
      throw new Error(`Candidate ${candidateIndex} contains duplicate number ${number}.`);
    }
    if (index > 0 && number < numbers[index - 1]!) {
      throw new Error(`Candidate ${candidateIndex} numbers must be in canonical ascending order.`);
    }
  }
}

export function validatePortfolioAuditCandidates(
  definition: { totalNumbers: number; drawSize: number; minBetSize: number; maxBetSize: number },
  candidates: readonly { readonly numbers: readonly number[] }[],
): number {
  validateDefinition(definition);
  if (candidates.length === 0) {
    throw new Error("Portfolio audit requires at least one candidate.");
  }
  const betSize = candidates[0]!.numbers.length;
  if (betSize < definition.minBetSize || betSize > definition.maxBetSize) {
    throw new Error(`Candidate bet size ${betSize} is outside ${definition.minBetSize}-${definition.maxBetSize}.`);
  }
  candidates.forEach((candidate, candidateIndex) => {
    validateCandidate(candidate.numbers, candidateIndex, betSize, definition.totalNumbers);
  });
  return betSize;
}

function intersectionSize(left: readonly number[], right: readonly number[]): number {
  let leftIndex = 0;
  let rightIndex = 0;
  let size = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftNumber = left[leftIndex]!;
    const rightNumber = right[rightIndex]!;
    if (leftNumber === rightNumber) {
      size += 1;
      leftIndex += 1;
      rightIndex += 1;
    } else if (leftNumber < rightNumber) {
      leftIndex += 1;
    } else {
      rightIndex += 1;
    }
  }
  return size;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export class PairwisePortfolioAuditCancelledError extends Error {
  readonly code = "PAIRWISE_PORTFOLIO_AUDIT_CANCELLED";

  constructor() {
    super("Pairwise portfolio audit cancelled.");
    this.name = "AbortError";
  }
}

export interface PairwisePortfolioAuditOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: PairwisePortfolioAuditProgress) => void;
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new PairwisePortfolioAuditCancelledError();
}

/**
 * Audits canonical candidates without history, persistence, optimization or
 * coverage. Its cost is O(candidateCount * betSize² + totalNumbers²).
 */
export function auditBasicPortfolio(input: unknown): BasicPortfolioAuditResult {
  const request = basicPortfolioAuditRequestSchema.parse(input);
  const { lotteryDefinition, candidates } = request;
  const betSize = validatePortfolioAuditCandidates(lotteryDefinition, candidates);

  const numberCounts = Array.from({ length: lotteryDefinition.totalNumbers + 1 }, () => 0);
  const pairCounts = new Map<string, number>();
  for (let first = 1; first <= lotteryDefinition.totalNumbers; first += 1) {
    for (let second = first + 1; second <= lotteryDefinition.totalNumbers; second += 1) {
      pairCounts.set(pairKey(first, second), 0);
    }
  }

  const gameOccurrences = new Map<string, { numbers: number[]; occurrences: number }>();
  candidates.forEach((candidate) => {
    for (const number of candidate.numbers) numberCounts[number]! += 1;
    for (let firstIndex = 0; firstIndex < betSize; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < betSize; secondIndex += 1) {
        const key = pairKey(candidate.numbers[firstIndex]!, candidate.numbers[secondIndex]!);
        pairCounts.set(key, pairCounts.get(key)! + 1);
      }
    }
    const identity = candidate.numbers.join(",");
    const previous = gameOccurrences.get(identity);
    if (previous) previous.occurrences += 1;
    else gameOccurrences.set(identity, { numbers: [...candidate.numbers], occurrences: 1 });
  });

  const numberFrequencies = numberCounts.slice(1).map((count, index) => ({ number: index + 1, count }));
  const pairFrequencies: Array<{ numbers: [number, number]; count: number }> = [];
  for (let first = 1; first <= lotteryDefinition.totalNumbers; first += 1) {
    for (let second = first + 1; second <= lotteryDefinition.totalNumbers; second += 1) {
      pairFrequencies.push({ numbers: [first, second], count: pairCounts.get(pairKey(first, second))! });
    }
  }

  const duplicateGames = [...gameOccurrences.values()]
    .filter((game) => game.occurrences > 1)
    .sort((left, right) => compareGames(left.numbers, right.numbers));
  const numberOccurrences = numberFrequencies.reduce((sum, item) => sum + item.count, 0);
  const pairOccurrences = pairFrequencies.reduce((sum, item) => sum + item.count, 0);

  return basicPortfolioAuditResultSchema.parse({
    contractVersion: "1.0",
    lottery: { id: lotteryDefinition.id, definitionVersion: lotteryDefinition.version },
    betSize,
    candidateCount: candidates.length,
    valid: true,
    duplicateGames,
    numberFrequencies,
    pairFrequencies,
    totals: {
      numberOccurrences,
      expectedNumberOccurrences: candidates.length * betSize,
      pairOccurrences,
      expectedPairOccurrences: candidates.length * ((betSize * (betSize - 1)) / 2),
    },
    transient: true,
    persisted: false,
    frozen: false,
    coverageCalculated: false,
    portfolioStateChanged: false,
  });
}

/**
 * Calculates every unordered candidate intersection in deterministic index
 * order. Work is yielded in bounded batches so callers can cancel it.
 */
export async function auditPortfolioIntersections(
  input: unknown,
  options: PairwisePortfolioAuditOptions = {},
): Promise<PairwisePortfolioAuditResult> {
  const request = pairwisePortfolioAuditRequestSchema.parse(input);
  const { lotteryDefinition, candidates } = request;
  const betSize = validatePortfolioAuditCandidates(lotteryDefinition, candidates);
  throwIfCancelled(options.signal);

  const totalPairs = (candidates.length * (candidates.length - 1)) / 2;
  const intersections: PairwisePortfolioIntersection[] = [];
  const histogramCounts = Array.from({ length: betSize + 1 }, () => 0);
  let processedPairs = 0;
  let lastPercent = -1;

  const emitProgress = (): void => {
    const percent = Math.floor((processedPairs * 100) / totalPairs);
    if (percent <= lastPercent) return;
    lastPercent = percent;
    options.onProgress?.(pairwisePortfolioAuditProgressSchema.parse({
      phase: "PAIRWISE_INTERSECTIONS",
      processedPairs,
      totalPairs,
      percent,
    }));
    throwIfCancelled(options.signal);
  };

  emitProgress();
  for (let leftIndex = 0; leftIndex < candidates.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const size = intersectionSize(candidates[leftIndex]!.numbers, candidates[rightIndex]!.numbers);
      intersections.push({ candidateIndexes: [leftIndex, rightIndex], intersectionSize: size });
      histogramCounts[size]! += 1;
      processedPairs += 1;
      emitProgress();

      if (processedPairs % PAIRWISE_AUDIT_BATCH_SIZE === 0 && processedPairs < totalPairs) {
        await yieldToEventLoop();
        throwIfCancelled(options.signal);
      }
    }
  }

  return pairwisePortfolioAuditResultSchema.parse({
    contractVersion: PAIRWISE_PORTFOLIO_AUDIT_CONTRACT_VERSION,
    algorithmVersion: PAIRWISE_PORTFOLIO_AUDIT_ALGORITHM_VERSION,
    lottery: { id: lotteryDefinition.id, definitionVersion: lotteryDefinition.version },
    betSize,
    candidateCount: candidates.length,
    intersections,
    overlapHistogram: histogramCounts.map((pairCount, size) => ({ intersectionSize: size, pairCount })),
    totals: { expectedPairs: totalPairs, processedPairs },
    transient: true,
    persisted: false,
    frozen: false,
    coverageCalculated: false,
    portfolioStateChanged: false,
  });
}

export class PortfolioStructuralDistributionAuditCancelledError extends Error {
  readonly code = "PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_CANCELLED";

  constructor() {
    super("Portfolio structural distribution audit cancelled.");
    this.name = "AbortError";
  }
}

export interface PortfolioStructuralDistributionAuditOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: PortfolioStructuralDistributionAuditProgress) => void;
}

function throwIfStructuralDistributionCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new PortfolioStructuralDistributionAuditCancelledError();
}

function reducedFrequency(count: number, candidateCount: number): { numerator: number; denominator: number } {
  let left = count;
  let right = candidateCount;
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return { numerator: count / left, denominator: candidateCount / left };
}

/**
 * Aggregates lottery-owned structural summaries in fixed space. Candidate
 * validation remains generic and no lottery classification rule enters Core.
 */
export async function auditPortfolioStructuralDistribution(
  input: unknown,
  adapter: PortfolioStructuralDistributionAdapter,
  options: PortfolioStructuralDistributionAuditOptions = {},
): Promise<PortfolioStructuralDistributionAuditResult> {
  const request = portfolioStructuralDistributionAuditRequestSchema.parse(input);
  const { lotteryDefinition, candidates } = request;
  const betSize = validatePortfolioAuditCandidates(lotteryDefinition, candidates);

  if (lotteryDefinition.id !== adapter.lotteryId) {
    throw new Error(`No structural distribution adapter is available for lottery ${lotteryDefinition.id}.`);
  }
  if (!adapter.supportsDefinition(lotteryDefinition)) {
    throw new Error(`The ${adapter.lotteryId} structural distribution adapter does not support this lottery definition.`);
  }
  if (betSize !== adapter.betSize) {
    throw new Error(`The ${adapter.lotteryId} structural distribution adapter supports only ${adapter.betSize}-number bets.`);
  }
  throwIfStructuralDistributionCancelled(options.signal);

  const counts: Record<StructuralBand, number> = {
    ZERO_EXTREMES: 0,
    ONE_EXTREME: 0,
    TWO_EXTREMES: 0,
    THREE_EXTREMES: 0,
    FOUR_PLUS_EXTREMES: 0,
  };
  const totalCandidates = candidates.length;
  let processedCandidates = 0;
  let lastPercent = -1;

  const emitProgress = (): void => {
    const percent = Math.floor((processedCandidates * 100) / totalCandidates);
    if (percent <= lastPercent) return;
    lastPercent = percent;
    options.onProgress?.(portfolioStructuralDistributionAuditProgressSchema.parse({
      phase: "STRUCTURAL_DISTRIBUTION",
      processedCandidates,
      totalCandidates,
      percent,
    }));
    throwIfStructuralDistributionCancelled(options.signal);
  };

  emitProgress();
  for (const candidate of candidates) {
    const summary = adapter.summarize(candidate.numbers);
    if (!summary.applicable || summary.band === null || summary.extremeCount === null) {
      throw new Error(`The ${adapter.lotteryId} structural summary is not applicable to ${betSize}-number bets.`);
    }
    counts[summary.band] += 1;
    processedCandidates += 1;
    emitProgress();

    if (
      processedCandidates % STRUCTURAL_DISTRIBUTION_AUDIT_BATCH_SIZE === 0 &&
      processedCandidates < totalCandidates
    ) {
      await yieldToEventLoop();
      throwIfStructuralDistributionCancelled(options.signal);
    }
  }

  return portfolioStructuralDistributionAuditResultSchema.parse({
    contractVersion: PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_CONTRACT_VERSION,
    algorithmVersion: PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_ALGORITHM_VERSION,
    metricEngineVersion: adapter.metricEngineVersion,
    classifierVersion: adapter.classifierVersion,
    lottery: { id: lotteryDefinition.id, definitionVersion: lotteryDefinition.version },
    betSize,
    candidateCount: totalCandidates,
    buckets: STRUCTURAL_BAND_ORDER.map((band) => ({
      band,
      count: counts[band],
      frequency: reducedFrequency(counts[band], totalCandidates),
    })),
    transient: true,
    persisted: false,
    frozen: false,
    coverageCalculated: false,
    portfolioStateChanged: false,
  });
}
