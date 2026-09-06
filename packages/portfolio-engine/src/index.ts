import {
  INTERSECTION_CARDINALITY_ALGORITHM_VERSION,
  intersectionCardinality,
} from "@boloes/combinatorics";
import {
  PORTFOLIO_DIVERSITY_OPTIMIZATION_ALGORITHM,
  PORTFOLIO_DIVERSITY_OPTIMIZATION_ALGORITHM_VERSION,
  PORTFOLIO_DIVERSITY_OPTIMIZATION_CONTRACT_VERSION,
  portfolioDiversityOptimizationProgressSchema,
  portfolioDiversityOptimizationRequestSchema,
  portfolioDiversityOptimizationResultSchema,
  type PortfolioDiversityOptimizationAdapter,
  type PortfolioDiversityOptimizationErrorCode,
  type PortfolioDiversityOptimizationProgress,
  type PortfolioDiversityOptimizationRequest,
  type PortfolioDiversityOptimizationResult,
  type PortfolioDiversityStructuralTarget,
} from "@boloes/lottery-contracts";

const MATRIX_BATCH_SIZE = 2_048;
const SELECTION_BATCH_SIZE = 2_048;

interface CanonicalCandidate {
  readonly numbers: readonly number[];
  readonly inputIndex: number;
  readonly canonicalPoolIndex: number;
  readonly key: string;
}

interface StructuralState {
  readonly targets: readonly PortfolioDiversityStructuralTarget[];
  readonly candidateGroups: readonly string[];
  readonly remaining: Map<string, number>;
  readonly selected: Map<string, number>;
}

export class InvalidPortfolioDiversityRequestError extends Error {
  readonly code = "INVALID_PORTFOLIO_DIVERSITY_REQUEST" as const satisfies
    PortfolioDiversityOptimizationErrorCode;

  constructor(message = "Invalid portfolio diversity optimization request.") {
    super(message);
    this.name = "InvalidPortfolioDiversityRequestError";
  }
}

export class DuplicatePortfolioDiversityCandidateError extends Error {
  readonly code = "DUPLICATE_PORTFOLIO_DIVERSITY_CANDIDATE" as const satisfies
    PortfolioDiversityOptimizationErrorCode;
  readonly canonicalCandidate: readonly number[];
  readonly inputIndexes: readonly [number, number];

  constructor(numbers: readonly number[], inputIndexes: readonly [number, number]) {
    super("Portfolio diversity pool contains a duplicate canonical candidate.");
    this.name = "DuplicatePortfolioDiversityCandidateError";
    this.canonicalCandidate = [...numbers];
    this.inputIndexes = [...inputIndexes];
  }
}

export class InfeasiblePortfolioDiversityAllocationError extends Error {
  readonly code = "INFEASIBLE_PORTFOLIO_DIVERSITY_ALLOCATION" as const satisfies
    PortfolioDiversityOptimizationErrorCode;
  readonly group: string;
  readonly requiredCount: number;
  readonly availableCount: number;

  constructor(group: string, requiredCount: number, availableCount: number) {
    super("Portfolio diversity structural allocation cannot be satisfied by the input pool.");
    this.name = "InfeasiblePortfolioDiversityAllocationError";
    this.group = group;
    this.requiredCount = requiredCount;
    this.availableCount = availableCount;
  }
}

export class PortfolioDiversityOptimizationCancelledError extends Error {
  readonly code = "PORTFOLIO_DIVERSITY_OPTIMIZATION_CANCELLED" as const satisfies
    PortfolioDiversityOptimizationErrorCode;

  constructor() {
    super("Portfolio diversity optimization cancelled.");
    this.name = "PortfolioDiversityOptimizationCancelledError";
  }
}

export interface PortfolioDiversityOptimizationOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: PortfolioDiversityOptimizationProgress) => void;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new PortfolioDiversityOptimizationCancelledError();
}

function parseRequest(input: unknown): PortfolioDiversityOptimizationRequest {
  const parsed = portfolioDiversityOptimizationRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidPortfolioDiversityRequestError(parsed.error.message);
  }
  return parsed.data;
}

function canonicalizePool(
  request: PortfolioDiversityOptimizationRequest,
  adapter: PortfolioDiversityOptimizationAdapter,
): readonly CanonicalCandidate[] {
  if (
    adapter.lotteryId !== request.lotteryDefinition.id ||
    adapter.betSize !== request.lotteryDefinition.drawSize ||
    !adapter.supportsDefinition(request.lotteryDefinition)
  ) {
    throw new InvalidPortfolioDiversityRequestError(
      `The ${adapter.lotteryId} diversity adapter does not support this lottery definition.`,
    );
  }

  const candidates = request.candidates.map((candidate, inputIndex) => {
    try {
      adapter.validateCandidate(candidate.numbers);
    } catch (error) {
      throw new InvalidPortfolioDiversityRequestError(
        error instanceof Error ? error.message : `Candidate ${inputIndex} is invalid.`,
      );
    }
    return {
      numbers: [...candidate.numbers],
      inputIndex,
      canonicalPoolIndex: -1,
      key: adapter.canonicalKey(candidate.numbers),
    };
  });

  candidates.sort((left, right) => adapter.compareCandidates(left.numbers, right.numbers));
  for (let index = 1; index < candidates.length; index += 1) {
    const previous = candidates[index - 1]!;
    const current = candidates[index]!;
    const comparison = adapter.compareCandidates(previous.numbers, current.numbers);
    if (comparison === 0 && previous.key !== current.key) {
      throw new InvalidPortfolioDiversityRequestError(
        "The adapter candidate comparator is not a total canonical ordering.",
      );
    }
    if (previous.key === current.key) {
      throw new DuplicatePortfolioDiversityCandidateError(
        previous.numbers,
        [previous.inputIndex, current.inputIndex],
      );
    }
  }

  return candidates.map((candidate, canonicalPoolIndex) => ({
    ...candidate,
    canonicalPoolIndex,
  }));
}

function structuralState(
  request: PortfolioDiversityOptimizationRequest,
  candidates: readonly CanonicalCandidate[],
  adapter: PortfolioDiversityOptimizationAdapter,
): StructuralState | null {
  if (request.structuralConstraint.mode === "NEUTRAL") return null;

  let targets: readonly PortfolioDiversityStructuralTarget[];
  try {
    targets = adapter.resolveStructuralTargets(
      request.structuralConstraint.allocation,
      request.targetCandidateCount,
    );
  } catch (error) {
    throw new InvalidPortfolioDiversityRequestError(
      error instanceof Error ? error.message : "Invalid explicit structural allocation.",
    );
  }

  const targetGroups = new Set<string>();
  let targetTotal = 0;
  let requestedPercentTotal = 0;
  for (const target of targets) {
    if (
      target.group.length === 0 ||
      targetGroups.has(target.group) ||
      !Number.isFinite(target.requestedPercent) ||
      target.requestedPercent < 0 ||
      target.requestedPercent > 100 ||
      !Number.isInteger(target.targetCount) ||
      target.targetCount < 0
    ) {
      throw new InvalidPortfolioDiversityRequestError(
        "The adapter returned invalid structural targets.",
      );
    }
    targetGroups.add(target.group);
    targetTotal += target.targetCount;
    requestedPercentTotal += target.requestedPercent;
  }
  if (
    targets.length === 0 ||
    targetTotal !== request.targetCandidateCount ||
    Math.abs(requestedPercentTotal - 100) > 1e-9
  ) {
    throw new InvalidPortfolioDiversityRequestError(
      "Structural target counts and percentages must conserve the explicit allocation.",
    );
  }

  const candidateGroups = candidates.map((candidate) => {
    try {
      return adapter.classifyStructuralGroup(candidate.numbers);
    } catch (error) {
      throw new InvalidPortfolioDiversityRequestError(
        error instanceof Error ? error.message : "Candidate structural classification failed.",
      );
    }
  });
  const available = new Map<string, number>();
  candidateGroups.forEach((group) => available.set(group, (available.get(group) ?? 0) + 1));
  for (const target of targets) {
    const availableCount = available.get(target.group) ?? 0;
    const identityRequiresExactDistribution =
      request.targetCandidateCount === candidates.length &&
      availableCount !== target.targetCount;
    if (availableCount < target.targetCount || identityRequiresExactDistribution) {
      throw new InfeasiblePortfolioDiversityAllocationError(
        target.group,
        target.targetCount,
        availableCount,
      );
    }
  }

  return {
    targets,
    candidateGroups,
    remaining: new Map(targets.map((target) => [target.group, target.targetCount])),
    selected: new Map(targets.map((target) => [target.group, 0])),
  };
}

function matrixIndex(left: number, right: number, poolSize: number): number {
  const first = Math.min(left, right);
  const second = Math.max(left, right);
  return first * poolSize - (first * (first + 1)) / 2 + second - first - 1;
}

function phasePercent(processedWork: number, totalWork: number): number {
  return totalWork === 0 ? 100 : Math.floor((processedWork * 100) / totalWork);
}

function overallPercent(
  phase: PortfolioDiversityOptimizationProgress["phase"],
  processedWork: number,
  totalWork: number,
): number {
  if (totalWork === 0) return phase === "SELECT_CANDIDATES" ? 100 : 0;
  return Math.floor((processedWork * 100) / totalWork);
}

function createProgressEmitter(
  options: PortfolioDiversityOptimizationOptions,
  overallTotalWork: number,
): (
  phase: PortfolioDiversityOptimizationProgress["phase"],
  processedWork: number,
  totalWork: number,
  overallProcessedWork: number,
) => void {
  const lastPercent = new Map<PortfolioDiversityOptimizationProgress["phase"], number>();
  return (phase, processedWork, totalWork, overallProcessedWork): void => {
    const percent = phasePercent(processedWork, totalWork);
    if (lastPercent.get(phase) === percent) return;
    lastPercent.set(phase, percent);
    options.onProgress?.(portfolioDiversityOptimizationProgressSchema.parse({
      phase,
      processedWork,
      totalWork,
      percent,
      overallProcessedWork,
      overallTotalWork,
      overallPercent: overallPercent(phase, overallProcessedWork, overallTotalWork),
    }));
    throwIfCancelled(options.signal);
  };
}

function isEligible(index: number, structural: StructuralState | null): boolean {
  if (!structural) return true;
  const group = structural.candidateGroups[index]!;
  return (structural.remaining.get(group) ?? 0) > 0;
}

function recordStructuralSelection(index: number, structural: StructuralState | null): void {
  if (!structural) return;
  const group = structural.candidateGroups[index]!;
  structural.remaining.set(group, (structural.remaining.get(group) ?? 0) - 1);
  structural.selected.set(group, (structural.selected.get(group) ?? 0) + 1);
}

function compareHistograms(left: Uint16Array, right: Uint16Array): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

function histogramResult(histogram: Uint16Array, betSize: number) {
  return Array.from(histogram, (count, index) => ({
    intersectionSize: betSize - 1 - index,
    count,
  }));
}

function buildResult(
  request: PortfolioDiversityOptimizationRequest,
  adapter: PortfolioDiversityOptimizationAdapter,
  candidates: readonly CanonicalCandidate[],
  selectedIndexes: readonly number[],
  selectionMode: PortfolioDiversityOptimizationResult["selectionMode"],
  histograms: readonly (readonly { intersectionSize: number; count: number }[] | null)[],
  structural: StructuralState | null,
  matrixWork: number,
  selectionWork: number,
): PortfolioDiversityOptimizationResult {
  const finalIndexes = [...selectedIndexes].sort((left, right) => left - right);
  const reasonFor = (index: number) => selectionMode === "IDENTITY"
    ? "IDENTITY_SHORTCUT" as const
    : selectionMode === "LEXICOGRAPHIC_SINGLETON"
      ? "SINGLE_TARGET" as const
      : index === 0
        ? "FIRST_CANONICAL" as const
        : "MIN_INCREMENTAL_OVERLAP" as const;

  return portfolioDiversityOptimizationResultSchema.parse({
    contractVersion: PORTFOLIO_DIVERSITY_OPTIMIZATION_CONTRACT_VERSION,
    algorithm: PORTFOLIO_DIVERSITY_OPTIMIZATION_ALGORITHM,
    componentVersions: {
      algorithmVersion: PORTFOLIO_DIVERSITY_OPTIMIZATION_ALGORITHM_VERSION,
      intersectionAlgorithmVersion: INTERSECTION_CARDINALITY_ALGORITHM_VERSION,
      adapterVersion: adapter.adapterVersion,
      candidateOrderingVersion: adapter.candidateOrderingVersion,
      structuralClassifierVersion: structural ? adapter.structuralClassifierVersion : null,
      structuralAllocationAlgorithmVersion:
        structural ? adapter.structuralAllocationAlgorithmVersion : null,
    },
    lottery: {
      id: request.lotteryDefinition.id,
      definitionVersion: request.lotteryDefinition.version,
      totalNumbers: request.lotteryDefinition.totalNumbers,
    },
    betSize: adapter.betSize,
    poolSize: candidates.length,
    targetCandidateCount: request.targetCandidateCount,
    changed: selectionMode !== "IDENTITY",
    selectionMode,
    globallyOptimal: false,
    probabilityClaimed: false,
    timeoutApplied: false,
    candidates: finalIndexes.map((index) => ({ numbers: [...candidates[index]!.numbers] })),
    selectionOrder: selectedIndexes.map((index, selectionIndex) => ({
      candidate: { numbers: [...candidates[index]!.numbers] },
      provenance: {
        inputIndex: candidates[index]!.inputIndex,
        canonicalPoolIndex: candidates[index]!.canonicalPoolIndex,
      },
      reason: reasonFor(selectionIndex),
      winningIncrementalHistogram: histograms[selectionIndex],
    })),
    structuralConstraint: structural
      ? {
          mode: "PRESERVE_EXPLICIT_ALLOCATION",
          groups: structural.targets.map((target) => ({
            ...target,
            selectedCount: structural.selected.get(target.group) ?? 0,
          })),
        }
      : { mode: "NEUTRAL" },
    work: {
      phases: [
        { phase: "BUILD_OVERLAP_MATRIX", processedWork: matrixWork, totalWork: matrixWork },
        { phase: "SELECT_CANDIDATES", processedWork: selectionWork, totalWork: selectionWork },
      ],
      overallProcessedWork: matrixWork + selectionWork,
      overallTotalWork: matrixWork + selectionWork,
    },
    transient: true,
    persisted: false,
    frozen: false,
    coverageCalculated: false,
    portfolioStateChanged: false,
  });
}

/**
 * Selects a deterministic subset from a ready canonical pool. It never
 * generates candidates, reads history, computes coverage or changes state.
 */
export async function optimizePortfolioDiversity(
  input: unknown,
  adapter: PortfolioDiversityOptimizationAdapter,
  options: PortfolioDiversityOptimizationOptions = {},
): Promise<PortfolioDiversityOptimizationResult> {
  const request = parseRequest(input);
  const candidates = canonicalizePool(request, adapter);
  const structural = structuralState(request, candidates, adapter);
  throwIfCancelled(options.signal);

  const poolSize = candidates.length;
  const target = request.targetCandidateCount;
  const selectionMode = target === poolSize
    ? "IDENTITY" as const
    : target === 1
      ? "LEXICOGRAPHIC_SINGLETON" as const
      : "GREEDY_SUBSET" as const;
  const matrixWork = selectionMode === "GREEDY_SUBSET" ? (poolSize * (poolSize - 1)) / 2 : 0;
  const selectionWork = selectionMode === "GREEDY_SUBSET"
    ? ((target - 1) * (2 * poolSize - target)) / 2
    : 0;
  const emitProgress = createProgressEmitter(options, matrixWork + selectionWork);

  if (selectionMode !== "GREEDY_SUBSET") {
    emitProgress("BUILD_OVERLAP_MATRIX", 0, 0, 0);
    const selectedIndexes = selectionMode === "IDENTITY"
      ? candidates.map((_, index) => index)
      : [candidates.findIndex((_, index) => isEligible(index, structural))];
    if (selectedIndexes.some((index) => index < 0)) {
      throw new InvalidPortfolioDiversityRequestError("No canonical candidate is eligible.");
    }
    selectedIndexes.forEach((index) => recordStructuralSelection(index, structural));
    emitProgress("SELECT_CANDIDATES", 0, 0, 0);
    return buildResult(
      request,
      adapter,
      candidates,
      selectedIndexes,
      selectionMode,
      selectedIndexes.map(() => null),
      structural,
      0,
      0,
    );
  }

  const matrix = new Uint8Array(matrixWork);
  let processedMatrixWork = 0;
  emitProgress("BUILD_OVERLAP_MATRIX", 0, matrixWork, 0);
  for (let left = 0; left < poolSize - 1; left += 1) {
    for (let right = left + 1; right < poolSize; right += 1) {
      matrix[matrixIndex(left, right, poolSize)] = intersectionCardinality(
        candidates[left]!.numbers,
        candidates[right]!.numbers,
      );
      processedMatrixWork += 1;
      emitProgress(
        "BUILD_OVERLAP_MATRIX",
        processedMatrixWork,
        matrixWork,
        processedMatrixWork,
      );
      if (processedMatrixWork % MATRIX_BATCH_SIZE === 0 && processedMatrixWork < matrixWork) {
        await yieldToEventLoop();
        throwIfCancelled(options.signal);
      }
    }
  }

  const firstIndex = candidates.findIndex((_, index) => isEligible(index, structural));
  if (firstIndex < 0) {
    throw new InvalidPortfolioDiversityRequestError("No canonical candidate is eligible.");
  }
  const selectedIndexes = [firstIndex];
  const selectedSet = new Set(selectedIndexes);
  const winningHistograms: Array<readonly { intersectionSize: number; count: number }[] | null> = [null];
  const candidateHistograms = Array.from(
    { length: poolSize },
    () => new Uint16Array(adapter.betSize),
  );
  recordStructuralSelection(firstIndex, structural);

  let processedSelectionWork = 0;
  emitProgress("SELECT_CANDIDATES", 0, selectionWork, matrixWork);
  while (selectedIndexes.length < target) {
    const latestSelected = selectedIndexes.at(-1)!;
    let bestIndex = -1;
    for (let candidateIndex = 0; candidateIndex < poolSize; candidateIndex += 1) {
      if (selectedSet.has(candidateIndex)) continue;
      processedSelectionWork += 1;

      if (isEligible(candidateIndex, structural)) {
        const overlap = matrix[matrixIndex(latestSelected, candidateIndex, poolSize)]!;
        const bucketIndex = adapter.betSize - 1 - overlap;
        if (bucketIndex < 0 || bucketIndex >= adapter.betSize) {
          throw new InvalidPortfolioDiversityRequestError(
            "Distinct candidates produced an invalid overlap cardinality.",
          );
        }
        candidateHistograms[candidateIndex]![bucketIndex]! += 1;
        if (
          bestIndex < 0 ||
          compareHistograms(
            candidateHistograms[candidateIndex]!,
            candidateHistograms[bestIndex]!,
          ) < 0
        ) {
          bestIndex = candidateIndex;
        }
      }

      emitProgress(
        "SELECT_CANDIDATES",
        processedSelectionWork,
        selectionWork,
        matrixWork + processedSelectionWork,
      );
      if (
        processedSelectionWork % SELECTION_BATCH_SIZE === 0 &&
        processedSelectionWork < selectionWork
      ) {
        await yieldToEventLoop();
        throwIfCancelled(options.signal);
      }
    }
    if (bestIndex < 0) {
      throw new InvalidPortfolioDiversityRequestError(
        "No eligible candidate remains before reaching targetCandidateCount.",
      );
    }
    selectedIndexes.push(bestIndex);
    selectedSet.add(bestIndex);
    recordStructuralSelection(bestIndex, structural);
    winningHistograms.push(histogramResult(candidateHistograms[bestIndex]!, adapter.betSize));
  }

  return buildResult(
    request,
    adapter,
    candidates,
    selectedIndexes,
    selectionMode,
    winningHistograms,
    structural,
    matrixWork,
    selectionWork,
  );
}
