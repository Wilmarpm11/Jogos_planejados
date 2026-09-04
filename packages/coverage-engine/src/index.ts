import { validatePortfolioAuditCandidates } from "@boloes/audit-engine";
import {
  CANONICAL_BET_EXPANSION_ALGORITHM_VERSION,
  CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
  EXACT_COVERAGE_AUDIT_ALGORITHM_VERSION,
  EXACT_COVERAGE_AUDIT_CONTRACT_VERSION,
  EXACT_COVERAGE_AUDIT_MAX_WORK_BATCH_SIZE,
  EXACT_COVERAGE_AUDIT_METHOD,
  EXACT_COVERAGE_AUDIT_TIMEOUT_MS,
  EXPANDED_COVERAGE_COMPOSITION_ALGORITHM_VERSION,
  EXPANDED_COVERAGE_COMPOSITION_CONTRACT_VERSION,
  canonicalBetExpansionRequestSchema,
  exactCoverageAuditProgressSchema,
  exactCoverageAuditRequestSchema,
  exactCoverageAuditResultBaseSchema,
  expandedCoverageCompositionRequestSchema,
  validateCanonicalBetExpansionResult,
  validateExpandedCoverageCompositionBaseResult,
  type ExpandedCoverageCompositionExpansionAdapter,
  type ExactCoverageAdapter,
  type ExactCoverageAuditErrorCode,
  type ExactCoverageAuditProgress,
  type ExactCoverageAuditBaseResult,
  type ExpandedCoverageCompositionBaseResult,
  type ExpandedCoverageCompositionRequest,
  type LotteryDefinition,
} from "@boloes/lottery-contracts";

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function reduceFraction(numerator: number, denominator: number): {
  numerator: number;
  denominator: number;
} {
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export class ExactCoverageAuditCancelledError extends Error {
  readonly code: ExactCoverageAuditErrorCode = "COVERAGE_CANCELLED";

  constructor() {
    super("Exact coverage audit cancelled.");
    this.name = "AbortError";
  }
}

export class ExactCoverageAuditTimeoutError extends Error {
  readonly code: ExactCoverageAuditErrorCode = "COVERAGE_TIMEOUT";
  readonly timeoutMs = EXACT_COVERAGE_AUDIT_TIMEOUT_MS;

  constructor() {
    super(`Exact coverage audit exceeded the ${EXACT_COVERAGE_AUDIT_TIMEOUT_MS} ms timeout.`);
    this.name = "TimeoutError";
  }
}

export interface ExactCoverageAuditOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: ExactCoverageAuditProgress) => void;
  /** Monotonic clock seam used by deterministic timeout tests. */
  readonly now?: () => number;
}

interface ExpandedSourceSummary {
  sourceIndex: number;
  sourceBet: { numbers: number[] };
  sourceBetSize: number;
  expectedCandidateCount: number;
}

interface ExpandedSources {
  sources: ExpandedSourceSummary[];
  candidates: Array<{ numbers: number[] }>;
}

function assertAdapterContract(adapter: ExactCoverageAdapter): void {
  if (adapter.tiers.length === 0) {
    throw new Error("The exact coverage adapter must declare at least one tier.");
  }
  adapter.tiers.forEach((tier, index) => {
    if (!Number.isSafeInteger(tier.minimumHits) || tier.minimumHits <= 0) {
      throw new Error("The exact coverage adapter declares an invalid minimumHits.");
    }
    if (
      !Number.isSafeInteger(tier.grossCoveredOutcomesPerCandidate) ||
      tier.grossCoveredOutcomesPerCandidate <= 0
    ) {
      throw new Error("The exact coverage adapter declares an invalid gross coverage mass.");
    }
    if (index > 0 && tier.minimumHits >= adapter.tiers[index - 1]!.minimumHits) {
      throw new Error("The exact coverage adapter tiers must use strictly descending minimumHits.");
    }
  });
  if (adapter.coveredOutcomeVisitsPerCandidate !== adapter.tiers.at(-1)!.grossCoveredOutcomesPerCandidate) {
    throw new Error("The exact coverage adapter declares an invalid per-candidate work mass.");
  }
}

/**
 * Calculates exact gross, unique and repeated coverage without persistence,
 * history, approximation or portfolio mutation.
 */
export async function auditExactPortfolioCoverage(
  input: unknown,
  adapter: ExactCoverageAdapter,
  options: ExactCoverageAuditOptions = {},
): Promise<ExactCoverageAuditBaseResult> {
  const request = exactCoverageAuditRequestSchema.parse(input);
  const { lotteryDefinition, candidates } = request;
  const betSize = validatePortfolioAuditCandidates(lotteryDefinition, candidates);
  if (!adapter.supportsDefinition(lotteryDefinition)) {
    throw new Error(`No exact coverage adapter supports lottery definition ${lotteryDefinition.id}@${lotteryDefinition.version}.`);
  }
  if (betSize !== adapter.betSize) {
    throw new Error(`The ${adapter.lotteryId} exact coverage adapter supports only ${adapter.betSize}-number bets.`);
  }
  assertAdapterContract(adapter);

  const now = options.now ?? performance.now.bind(performance);
  const startedAt = now();
  const checkOperationalLimits = (): void => {
    if (options.signal?.aborted) throw new ExactCoverageAuditCancelledError();
    if (now() - startedAt >= EXACT_COVERAGE_AUDIT_TIMEOUT_MS) {
      throw new ExactCoverageAuditTimeoutError();
    }
  };
  checkOperationalLimits();

  const totalWork = candidates.length * adapter.coveredOutcomeVisitsPerCandidate + adapter.universeSize;
  let processedWork = 0;
  let lastPercent = -1;
  const emitProgress = (phase: ExactCoverageAuditProgress["phase"]): void => {
    const percent = Math.floor((processedWork * 100) / totalWork);
    if (percent <= lastPercent) return;
    lastPercent = percent;
    options.onProgress?.(exactCoverageAuditProgressSchema.parse({
      phase,
      processedWork,
      totalWork,
      percent,
    }));
  };

  const maximumHitsByOutcome = new Uint8Array(adapter.universeSize);
  emitProgress("MARK_COVERED_OUTCOMES");
  for (const candidate of candidates) {
    let candidateVisits = 0;
    adapter.enumerateCoveredOutcomeRanks(candidate.numbers, (rank, hits) => {
      if (hits > maximumHitsByOutcome[rank]!) maximumHitsByOutcome[rank] = hits;
      candidateVisits += 1;
      processedWork += 1;
    });
    if (candidateVisits !== adapter.coveredOutcomeVisitsPerCandidate) {
      throw new Error("The exact coverage adapter emitted an unexpected number of outcome visits.");
    }
    emitProgress("MARK_COVERED_OUTCOMES");
    await yieldToEventLoop();
    checkOperationalLimits();
  }

  const uniqueByTier = Array.from({ length: adapter.tiers.length }, () => 0);
  for (let batchStart = 0; batchStart < maximumHitsByOutcome.length; batchStart += EXACT_COVERAGE_AUDIT_MAX_WORK_BATCH_SIZE) {
    const batchEnd = Math.min(
      batchStart + EXACT_COVERAGE_AUDIT_MAX_WORK_BATCH_SIZE,
      maximumHitsByOutcome.length,
    );
    for (let rank = batchStart; rank < batchEnd; rank += 1) {
      const maximumHits = maximumHitsByOutcome[rank]!;
      for (let tierIndex = 0; tierIndex < adapter.tiers.length; tierIndex += 1) {
        if (maximumHits >= adapter.tiers[tierIndex]!.minimumHits) {
          uniqueByTier[tierIndex]! += 1;
        }
      }
    }
    processedWork += batchEnd - batchStart;
    emitProgress("COUNT_UNIQUE_OUTCOMES");
    if (batchEnd < maximumHitsByOutcome.length) {
      await yieldToEventLoop();
      checkOperationalLimits();
    }
  }
  checkOperationalLimits();

  const result = exactCoverageAuditResultBaseSchema.parse({
    contractVersion: EXACT_COVERAGE_AUDIT_CONTRACT_VERSION,
    algorithmVersion: EXACT_COVERAGE_AUDIT_ALGORITHM_VERSION,
    adapterVersion: adapter.adapterVersion,
    method: EXACT_COVERAGE_AUDIT_METHOD,
    exact: true,
    absoluteError: 0,
    relativeError: { numerator: 0, denominator: 1 },
    lottery: { id: lotteryDefinition.id, definitionVersion: lotteryDefinition.version },
    universeSize: adapter.universeSize,
    betSize,
    candidateCount: candidates.length,
    timeoutMs: EXACT_COVERAGE_AUDIT_TIMEOUT_MS,
    totalWork,
    processedWork,
    tiers: adapter.tiers.map((tier, index) => {
      const grossCoveredOutcomes = candidates.length * tier.grossCoveredOutcomesPerCandidate;
      const uniqueCoveredOutcomes = uniqueByTier[index]!;
      return {
        minimumHits: tier.minimumHits,
        grossCoveredOutcomes,
        uniqueCoveredOutcomes,
        repeatedCoveredOutcomes: grossCoveredOutcomes - uniqueCoveredOutcomes,
        efficiency: reduceFraction(uniqueCoveredOutcomes, grossCoveredOutcomes),
      };
    }),
    transient: true,
    persisted: false,
    frozen: false,
    coverageCalculated: true,
    portfolioStateChanged: false,
  });
  emitProgress("COUNT_UNIQUE_OUTCOMES");
  return result;
}

function assertCompositionAdapters(
  lotteryDefinition: LotteryDefinition,
  expansionAdapter: ExpandedCoverageCompositionExpansionAdapter,
  coverageAdapter: ExactCoverageAdapter,
): void {
  if (
    expansionAdapter.lotteryId !== lotteryDefinition.id ||
    !expansionAdapter.supportsDefinition(lotteryDefinition)
  ) {
    throw new Error(
      `No canonical expansion adapter supports lottery definition ${lotteryDefinition.id}@${lotteryDefinition.version}.`,
    );
  }
  if (expansionAdapter.adapterVersion.trim().length === 0) {
    throw new Error("The canonical expansion adapter must declare a version.");
  }
  if (
    coverageAdapter.lotteryId !== lotteryDefinition.id ||
    !coverageAdapter.supportsDefinition(lotteryDefinition)
  ) {
    throw new Error(
      `No exact coverage adapter supports lottery definition ${lotteryDefinition.id}@${lotteryDefinition.version}.`,
    );
  }
  if (coverageAdapter.betSize !== lotteryDefinition.drawSize) {
    throw new Error(
      `The ${coverageAdapter.lotteryId} exact coverage adapter supports only ${coverageAdapter.betSize}-number bets.`,
    );
  }
  assertAdapterContract(coverageAdapter);
}

function throwIfCompositionCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ExactCoverageAuditCancelledError();
}

function materializeExpandedSources(
  request: ExpandedCoverageCompositionRequest,
  expansionAdapter: ExpandedCoverageCompositionExpansionAdapter,
  signal?: AbortSignal,
): ExpandedSources {
  const sources: ExpandedSourceSummary[] = [];
  const candidates: Array<{ numbers: number[] }> = [];

  request.sourceBets.forEach((sourceBet, sourceIndex) => {
    throwIfCompositionCancelled(signal);
    const expansionRequest = canonicalBetExpansionRequestSchema.parse({
      contractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
      lotteryDefinition: request.lotteryDefinition,
      sourceBet,
    });
    const expansion = validateCanonicalBetExpansionResult(
      expansionRequest,
      expansionAdapter.expand(expansionRequest),
    );
    sources.push({
      sourceIndex,
      sourceBet: { numbers: [...sourceBet.numbers] },
      sourceBetSize: sourceBet.numbers.length,
      expectedCandidateCount: expansion.expectedCandidateCount,
    });
    for (const candidate of expansion.candidates) {
      candidates.push({ numbers: [...candidate.numbers] });
    }
  });

  return { sources, candidates };
}

/**
 * Composes canonical expansion and exact coverage while preserving every
 * expanded occurrence. All boundaries are checked before materialization.
 */
export async function auditExpandedPortfolioCoverage(
  input: unknown,
  expansionAdapter: ExpandedCoverageCompositionExpansionAdapter,
  coverageAdapter: ExactCoverageAdapter,
  options: ExactCoverageAuditOptions = {},
): Promise<ExpandedCoverageCompositionBaseResult> {
  const request = expandedCoverageCompositionRequestSchema.parse(input);
  const { lotteryDefinition, sourceBets } = request;
  assertCompositionAdapters(lotteryDefinition, expansionAdapter, coverageAdapter);
  throwIfCompositionCancelled(options.signal);
  const { sources, candidates } = materializeExpandedSources(
    request,
    expansionAdapter,
    options.signal,
  );

  throwIfCompositionCancelled(options.signal);
  const distinctCandidateCount = new Set(
    candidates.map((candidate) => candidate.numbers.join(",")),
  ).size;
  const coverage = await auditExactPortfolioCoverage(
    {
      contractVersion: EXACT_COVERAGE_AUDIT_CONTRACT_VERSION,
      lotteryDefinition,
      candidates,
    },
    coverageAdapter,
    options,
  );

  return validateExpandedCoverageCompositionBaseResult(request, {
    contractVersion: EXPANDED_COVERAGE_COMPOSITION_CONTRACT_VERSION,
    algorithmVersion: EXPANDED_COVERAGE_COMPOSITION_ALGORITHM_VERSION,
    componentVersions: {
      expansionContractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
      expansionAlgorithmVersion: CANONICAL_BET_EXPANSION_ALGORITHM_VERSION,
      expansionAdapterVersion: expansionAdapter.adapterVersion,
      coverageContractVersion: EXACT_COVERAGE_AUDIT_CONTRACT_VERSION,
      coverageAlgorithmVersion: EXACT_COVERAGE_AUDIT_ALGORITHM_VERSION,
      coverageAdapterVersion: coverageAdapter.adapterVersion,
    },
    lottery: {
      id: lotteryDefinition.id,
      definitionVersion: lotteryDefinition.version,
    },
    sourceBetCount: sourceBets.length,
    sources,
    expandedCandidateCount: candidates.length,
    distinctCandidateCount,
    duplicateCandidateOccurrences: candidates.length - distinctCandidateCount,
    coverage,
    transient: true,
    persisted: false,
    frozen: false,
    portfolioStateChanged: false,
  });
}
