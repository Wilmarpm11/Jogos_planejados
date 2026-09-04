import { binomialCoefficient } from "@boloes/combinatorics";
import { z } from "zod";

export const lotteryDefinitionSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  totalNumbers: z.number().int().positive(),
  drawSize: z.number().int().positive(),
  minBetSize: z.number().int().positive(),
  maxBetSize: z.number().int().positive(),
});

export type LotteryDefinition = z.infer<typeof lotteryDefinitionSchema>;

export const normalizedLotteryResultSchema = z
  .object({
    lotteryId: z.string().min(1),
    contestNumber: z.number().int().positive(),
    drawDate: z.string().date(),
    drawnNumbers: z.array(z.number().int().positive()).min(1),
    sourceUrl: z.url(),
    parserVersion: z.string().min(1),
    validations: z.array(z.string().min(1)).min(1),
    drawLocation: z.string().min(1).optional(),
    drawMunicipalityUf: z.string().min(1).optional(),
  })
  .strict();

export type NormalizedLotteryResult = z.infer<typeof normalizedLotteryResultSchema>;

export const lotteryResultLedgerRecordSchema = normalizedLotteryResultSchema.extend({
  id: z.string().uuid(),
  sourceSnapshotId: z.string().uuid(),
  persistedAt: z.string().datetime({ offset: true }),
});
export type LotteryResultLedgerRecord = z.infer<typeof lotteryResultLedgerRecordSchema>;

export const historicalMetricProfileInputSchema = z.object({
  sourceResultId: z.string().uuid(),
  sourceSnapshotId: z.string().uuid(),
  lotteryId: z.literal("lotofacil"),
  metricEngineVersion: z.string().min(1),
  profile: z.unknown(),
});
export type HistoricalMetricProfileInput = z.infer<typeof historicalMetricProfileInputSchema>;

export const historicalMetricProfileRecordSchema = historicalMetricProfileInputSchema.extend({
  id: z.string().uuid(),
  persistedAt: z.string().datetime({ offset: true }),
});
export type HistoricalMetricProfileRecord = z.infer<typeof historicalMetricProfileRecordSchema>;

export const cohortSelectorRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ALL_DRAWS") }).strict(),
  z.object({ type: z.literal("LAST_N_DRAWS"), n: z.number().int().positive() }).strict(),
  z.object({
    type: z.literal("CONTEST_RANGE"),
    startContest: z.number().int().positive(),
    endContest: z.number().int().positive(),
  }).strict().refine((rule) => rule.startContest <= rule.endContest, "startContest must be at most endContest."),
  z.object({ type: z.literal("SPECIAL_DRAW_TYPE"), specialType: z.string().min(1) }).strict(),
]);
export type CohortSelectorRule = z.infer<typeof cohortSelectorRuleSchema>;

export const cohortDefinitionSchema = z.object({
  id: z.string().uuid(),
  lotteryId: z.string().min(1),
  selectorRule: cohortSelectorRuleSchema,
  selectorRuleVersion: z.literal("1"),
  createdAt: z.string().datetime({ offset: true }),
});
export type CohortDefinition = z.infer<typeof cohortDefinitionSchema>;

export const cohortResolutionSchema = z.object({
  id: z.string().uuid(),
  cohortId: z.string().uuid(),
  selectorRuleVersion: z.literal("1"),
  resolvedDrawIds: z.array(z.string().uuid()),
  resolvedMinContest: z.number().int().positive().nullable(),
  resolvedMaxContest: z.number().int().positive().nullable(),
  resolvedCount: z.number().int().nonnegative(),
  dataVersionHash: z.string().regex(/^[a-f0-9]{64}$/),
  resolvedAt: z.string().datetime({ offset: true }),
});
export type CohortResolution = z.infer<typeof cohortResolutionSchema>;

/** Allowed laboratory windows. This boundary intentionally excludes analysis. */
export const lotofacilHistoryWindowSizeSchema = z.union([
  z.literal(10),
  z.literal(25),
  z.literal(50),
  z.literal(100),
  z.literal(250),
  z.literal("complete"),
]);
export type LotofacilHistoryWindowSize = z.infer<typeof lotofacilHistoryWindowSizeSchema>;

const LOTOFACIL_SUPPORTED_BET_SIZES = [15, 16, 17, 18, 19, 20] as const;
const LOTOFACIL_PRIZE_TIERS = [11, 12, 13, 14, 15] as const;

function hasEveryLotofacilBetSizeExactlyOnce(entries: readonly { betSize: number }[]): boolean {
  return LOTOFACIL_SUPPORTED_BET_SIZES.every(
    (supportedBetSize) => entries.filter(({ betSize }) => betSize === supportedBetSize).length === 1,
  );
}

function hasEveryLotofacilPrizeTierExactlyOnce(prizeTiers: readonly number[]): boolean {
  return LOTOFACIL_PRIZE_TIERS.every(
    (supportedTier) => prizeTiers.filter((tier) => tier === supportedTier).length === 1,
  );
}

const lotofacilPriceByBetSizeSchema = z
  .array(z.object({ betSize: z.number().int().min(15).max(20), priceInCents: z.number().int().positive() }))
  .length(LOTOFACIL_SUPPORTED_BET_SIZES.length)
  .refine(hasEveryLotofacilBetSizeExactlyOnce, "priceByBetSize must include each bet size from 15 through 20 exactly once.");

const lotofacilBolaoLimitsSchema = z
  .array(z.object({ betSize: z.number().int().min(15).max(20), minShares: z.number().int().min(2), maxShares: z.number().int().positive(), maxGamesPerReceipt: z.number().int().positive() }))
  .length(LOTOFACIL_SUPPORTED_BET_SIZES.length)
  .refine(hasEveryLotofacilBetSizeExactlyOnce, "bolaoLimits must include each bet size from 15 through 20 exactly once.");

export const lotofacilCatalogSchema = z
  .object({
    lotteryId: z.literal("lotofacil"),
    sourceUrl: z.url(),
    parserVersion: z.string().min(1),
    priceByBetSize: lotofacilPriceByBetSizeSchema,
    bolaoLimits: lotofacilBolaoLimitsSchema,
    prizeTiers: z
      .array(z.number().int().min(11).max(15))
      .length(LOTOFACIL_PRIZE_TIERS.length)
      .refine(hasEveryLotofacilPrizeTierExactlyOnce, "prizeTiers must include each tier from 11 through 15 exactly once."),
    validations: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type LotofacilCatalog = z.infer<typeof lotofacilCatalogSchema>;

export const lotofacilCatalogRecordSchema = lotofacilCatalogSchema.extend({
  id: z.string().uuid(),
  sourceSnapshotId: z.string().uuid(),
  persistedAt: z.string().datetime({ offset: true }),
});
export type LotofacilCatalogRecord = z.infer<typeof lotofacilCatalogRecordSchema>;

/**
 * Result of the validation boundary between a source-specific parser and the
 * local provenance store. Source acquisition and parsing intentionally live
 * outside this reusable contract.
 */
export const dataImportStatusSchema = z.enum(["VALIDATED", "INVALID", "FAILED"]);
export type DataImportStatus = z.infer<typeof dataImportStatusSchema>;

export const manualDatasetImportSchema = z
  .object({
    lotteryId: z.string().min(1),
    sourceUrl: z.url(),
    importedAt: z
      .string()
      .datetime({ offset: true })
      .refine((value) => value.endsWith("Z"), "importedAt must use UTC (Z)."),
    rawContent: z.string().min(1).optional(),
    contentHash: z.string().min(1).optional(),
    parserVersion: z.string().min(1),
    validations: z.array(z.string().min(1)),
    status: dataImportStatusSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (!input.rawContent && !input.contentHash) {
      context.addIssue({
        code: "custom",
        message: "rawContent or contentHash is required.",
        path: ["rawContent"],
      });
    }
  });

export type ManualDatasetImport = z.infer<typeof manualDatasetImportSchema>;

export const dataImportRecordSchema = manualDatasetImportSchema.safeExtend({
  id: z.string().uuid(),
  persistedAt: z.string().datetime({ offset: true }),
});
export type DataImportRecord = z.infer<typeof dataImportRecordSchema>;

export const datasetSnapshotSchema = z
  .object({
    lotteryId: z.string().min(1),
    sourceUrl: z.url(),
    importedAt: z
      .string()
      .datetime({ offset: true })
      .refine((value) => value.endsWith("Z"), "importedAt must use UTC (Z)."),
    rawContent: z.string().min(1).optional(),
    contentHash: z.string().min(1).optional(),
    parserVersion: z.string().min(1),
    validations: z.array(z.string().min(1)),
    status: z.literal("VALIDATED"),
    id: z.string().uuid(),
    dataImportId: z.string().uuid(),
    persistedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((input, context) => {
    if (!input.rawContent && !input.contentHash) {
      context.addIssue({
        code: "custom",
        message: "rawContent or contentHash is required.",
        path: ["rawContent"],
      });
    }
  });

export type DatasetSnapshot = z.infer<typeof datasetSnapshotSchema>;

export const strategyStatusSchema = z.enum([
  "DRAFT",
  "EXPLORATORY",
  "VALIDATING",
  "HOLDOUT",
  "VALIDATED",
  "PRODUCTION",
  "REJECTED",
]);
export type StrategyStatus = z.infer<typeof strategyStatusSchema>;

export const resolvedStrategyModeSchema = z.enum(["NEUTRAL", "ADVANCED", "MANUAL_EXPERIMENTAL"]);
export type ResolvedStrategyMode = z.infer<typeof resolvedStrategyModeSchema>;

export const resolvedStrategyConfigSchema = z.object({
  id: z.string().min(1), version: z.string().min(1), lotteryId: z.string().min(1),
  betSize: z.number().int().positive(), mode: resolvedStrategyModeSchema,
  structuralAllocation: z.record(z.string(), z.number().min(0).max(100)).optional(),
  cohortId: z.string().uuid().optional(), auxiliaryConstraints: z.record(z.string(), z.unknown()).optional(),
  hypothesisRefs: z.array(z.object({ id: z.string().min(1), version: z.string().min(1), status: strategyStatusSchema })).optional(),
  statisticalLabel: z.enum(["NEUTRAL", "PRODUCTION", "MANUAL_EXPERIMENTAL"]),
  seed: z.string().min(1), requiresManualAcknowledgement: z.boolean(),
}).strict();
export type ResolvedStrategyConfig = z.infer<typeof resolvedStrategyConfigSchema>;

/** Parameters that affect only one transient candidate-generation execution. */
export const portfolioGenerationParametersSchema = z.object({
  seed: z.string().min(1),
  candidateCount: z.number().int().positive(),
}).strict();
export type PortfolioGenerationParameters = z.infer<typeof portfolioGenerationParametersSchema>;

/**
 * Deliberately narrow input boundary for deterministic portfolio generation.
 * It has no history, cohort, coverage, persistence, or freezing fields.
 */
export const portfolioGenerationRequestSchema = z.object({
  lotteryDefinition: lotteryDefinitionSchema,
  strategy: resolvedStrategyConfigSchema,
  parameters: portfolioGenerationParametersSchema,
}).strict();
export type PortfolioGenerationRequest = z.infer<typeof portfolioGenerationRequestSchema>;

export interface PortfolioGenerationCandidate {
  readonly numbers: readonly number[];
}

/** A reusable lottery adapter contract for transient deterministic candidates. */
export interface PortfolioGenerator<Request extends PortfolioGenerationRequest = PortfolioGenerationRequest> {
  generate(request: Request): PortfolioGenerationResult;
}

export interface PortfolioGenerationResult {
  readonly candidates: readonly PortfolioGenerationCandidate[];
  readonly transient: true;
  readonly persisted: false;
  readonly frozen: false;
  readonly coverageCalculated: false;
  readonly probabilityClaimed: false;
}

export const CANONICAL_BET_EXPANSION_CONTRACT_VERSION = "1.0" as const;
export const CANONICAL_BET_EXPANSION_ALGORITHM_VERSION =
  "canonical-subset-enumeration/1.0.0" as const;
export const CANONICAL_BET_EXPANSION_MAX_CANDIDATES = 15_504;

const canonicalBetExpansionBetSchema = z.object({
  numbers: z.array(z.number().int().positive()).min(1),
}).strict();

/** Modality-neutral input boundary for expanding one canonical source bet. */
export const canonicalBetExpansionRequestSchema = z.object({
  contractVersion: z.literal(CANONICAL_BET_EXPANSION_CONTRACT_VERSION),
  lotteryDefinition: lotteryDefinitionSchema.strict(),
  sourceBet: canonicalBetExpansionBetSchema,
}).strict().superRefine((request, context) => {
  const { lotteryDefinition: definition, sourceBet } = request;
  if (
    definition.drawSize > definition.totalNumbers ||
    definition.drawSize > definition.minBetSize ||
    definition.minBetSize > definition.maxBetSize ||
    definition.maxBetSize > definition.totalNumbers
  ) {
    context.addIssue({
      code: "custom",
      path: ["lotteryDefinition"],
      message: "Lottery dimensions and bet-size bounds must be ordered within the number universe.",
    });
  }
  if (
    sourceBet.numbers.length < definition.minBetSize ||
    sourceBet.numbers.length > definition.maxBetSize
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceBet", "numbers"],
      message: `Source bet size must be within ${definition.minBetSize}-${definition.maxBetSize}.`,
    });
  }
  sourceBet.numbers.forEach((number, index) => {
    if (number > definition.totalNumbers) {
      context.addIssue({
        code: "custom",
        path: ["sourceBet", "numbers", index],
        message: `Source bet numbers must be within 1-${definition.totalNumbers}.`,
      });
    }
    if (index > 0 && number <= sourceBet.numbers[index - 1]!) {
      context.addIssue({
        code: "custom",
        path: ["sourceBet", "numbers", index],
        message: "Source bet numbers must be unique and in strictly ascending order.",
      });
    }
  });
  if (
    definition.drawSize <= sourceBet.numbers.length &&
    sourceBet.numbers.length <= definition.totalNumbers
  ) {
    try {
      const expectedCandidateCount = binomialCoefficient(
        sourceBet.numbers.length,
        definition.drawSize,
      );
      if (expectedCandidateCount > CANONICAL_BET_EXPANSION_MAX_CANDIDATES) {
        context.addIssue({
          code: "custom",
          path: ["sourceBet", "numbers"],
          message: `Canonical expansion is limited to ${CANONICAL_BET_EXPANSION_MAX_CANDIDATES} materialized candidates.`,
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        path: ["sourceBet", "numbers"],
        message: "The canonical expansion workload must fit the safe integer range.",
      });
    }
  }
});
export type CanonicalBetExpansionRequest = z.infer<typeof canonicalBetExpansionRequestSchema>;

function compareCanonicalNumberSequences(
  left: readonly number[],
  right: readonly number[],
): number {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

/** Strict result boundary shared by lottery-specific expansion adapters. */
export const canonicalBetExpansionResultSchema = z.object({
  contractVersion: z.literal(CANONICAL_BET_EXPANSION_CONTRACT_VERSION),
  algorithmVersion: z.literal(CANONICAL_BET_EXPANSION_ALGORITHM_VERSION),
  lottery: z.object({
    id: z.string().min(1),
    definitionVersion: z.string().min(1),
  }).strict(),
  sourceBet: canonicalBetExpansionBetSchema,
  sourceBetSize: z.number().int().positive(),
  simpleBetSize: z.number().int().positive(),
  expectedCandidateCount: z.number().int().positive(),
  candidates: z.array(canonicalBetExpansionBetSchema)
    .min(1)
    .max(CANONICAL_BET_EXPANSION_MAX_CANDIDATES),
  transient: z.literal(true),
  persisted: z.literal(false),
  frozen: z.literal(false),
  coverageCalculated: z.literal(false),
  portfolioStateChanged: z.literal(false),
}).strict().superRefine((result, context) => {
  if (result.sourceBet.numbers.length !== result.sourceBetSize) {
    context.addIssue({
      code: "custom",
      path: ["sourceBetSize"],
      message: "Source bet size must match the source numbers.",
    });
  }
  result.sourceBet.numbers.forEach((number, index) => {
    if (index > 0 && number <= result.sourceBet.numbers[index - 1]!) {
      context.addIssue({
        code: "custom",
        path: ["sourceBet", "numbers", index],
        message: "Source bet numbers must be unique and in strictly ascending order.",
      });
    }
  });
  if (result.simpleBetSize > result.sourceBetSize) {
    context.addIssue({
      code: "custom",
      path: ["simpleBetSize"],
      message: "Simple bet size cannot exceed source bet size.",
    });
  }
  if (result.candidates.length !== result.expectedCandidateCount) {
    context.addIssue({
      code: "custom",
      path: ["candidates"],
      message: "Materialized candidates must match the expected count.",
    });
  }
  if (result.simpleBetSize <= result.sourceBetSize) {
    try {
      const derivedCandidateCount = binomialCoefficient(
        result.sourceBetSize,
        result.simpleBetSize,
      );
      if (result.expectedCandidateCount !== derivedCandidateCount) {
        context.addIssue({
          code: "custom",
          path: ["expectedCandidateCount"],
          message: "Expected candidate count must equal C(sourceBetSize, simpleBetSize).",
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        path: ["expectedCandidateCount"],
        message: "The derived candidate count must fit the safe integer range.",
      });
    }
  }

  const sourceNumbers = new Set(result.sourceBet.numbers);
  const identities = new Set<string>();
  result.candidates.forEach((candidate, candidateIndex) => {
    if (candidate.numbers.length !== result.simpleBetSize) {
      context.addIssue({
        code: "custom",
        path: ["candidates", candidateIndex, "numbers"],
        message: "Every candidate must use the declared simple bet size.",
      });
    }
    candidate.numbers.forEach((number, numberIndex) => {
      if (!sourceNumbers.has(number)) {
        context.addIssue({
          code: "custom",
          path: ["candidates", candidateIndex, "numbers", numberIndex],
          message: "Every candidate number must belong to the source bet.",
        });
      }
      if (numberIndex > 0 && number <= candidate.numbers[numberIndex - 1]!) {
        context.addIssue({
          code: "custom",
          path: ["candidates", candidateIndex, "numbers", numberIndex],
          message: "Candidate numbers must be unique and in strictly ascending order.",
        });
      }
    });

    const identity = candidate.numbers.join(",");
    if (identities.has(identity)) {
      context.addIssue({
        code: "custom",
        path: ["candidates", candidateIndex],
        message: "Expanded candidates must be unique.",
      });
    }
    identities.add(identity);

    if (
      candidateIndex > 0 &&
      compareCanonicalNumberSequences(
        result.candidates[candidateIndex - 1]!.numbers,
        candidate.numbers,
      ) >= 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["candidates", candidateIndex],
        message: "Expanded candidates must use stable lexicographic order.",
      });
    }
  });
});
export type CanonicalBetExpansionResult = z.infer<typeof canonicalBetExpansionResultSchema>;

/** Request-scoped boundary that prevents a valid result from being attached to another input. */
export const canonicalBetExpansionExecutionSchema = z.object({
  request: canonicalBetExpansionRequestSchema,
  result: canonicalBetExpansionResultSchema,
}).strict().superRefine(({ request, result }, context) => {
  if (
    result.lottery.id !== request.lotteryDefinition.id ||
    result.lottery.definitionVersion !== request.lotteryDefinition.version
  ) {
    context.addIssue({
      code: "custom",
      path: ["result", "lottery"],
      message: "Expansion result lottery must match the originating request.",
    });
  }
  if (result.simpleBetSize !== request.lotteryDefinition.drawSize) {
    context.addIssue({
      code: "custom",
      path: ["result", "simpleBetSize"],
      message: "Expansion simple bet size must match the lottery draw size.",
    });
  }
  if (
    result.sourceBet.numbers.length !== request.sourceBet.numbers.length ||
    result.sourceBet.numbers.some((number, index) => number !== request.sourceBet.numbers[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["result", "sourceBet"],
      message: "Expansion result source bet must match the originating request.",
    });
  }
});

export function validateCanonicalBetExpansionResult(
  request: CanonicalBetExpansionRequest,
  result: unknown,
): CanonicalBetExpansionResult {
  return canonicalBetExpansionExecutionSchema.parse({ request, result }).result;
}

/** Reusable contract implemented by lottery-owned canonical expansion adapters. */
export interface CanonicalBetExpansionAdapter {
  readonly lotteryId: string;
  supportsDefinition(definition: LotteryDefinition): boolean;
  expand(request: CanonicalBetExpansionRequest): CanonicalBetExpansionResult;
}

/** Composition-only extension that adds the adapter provenance required by Story 4.8. */
export interface ExpandedCoverageCompositionExpansionAdapter
  extends CanonicalBetExpansionAdapter {
  readonly adapterVersion: string;
}

export const basicPortfolioAuditCandidateSchema = z.object({
  numbers: z.array(z.number().int().positive()),
}).strict();

/** Versioned, history-free boundary for transient portfolio diagnostics. */
export const basicPortfolioAuditRequestSchema = z.object({
  contractVersion: z.literal("1.0"),
  lotteryDefinition: lotteryDefinitionSchema,
  candidates: z.array(basicPortfolioAuditCandidateSchema).min(1),
}).strict();
export type BasicPortfolioAuditRequest = z.infer<typeof basicPortfolioAuditRequestSchema>;

const auditNumberFrequencySchema = z.object({
  number: z.number().int().positive(),
  count: z.number().int().nonnegative(),
}).strict();

const auditPairFrequencySchema = z.object({
  numbers: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  count: z.number().int().nonnegative(),
}).strict();

const duplicateAuditGameSchema = z.object({
  numbers: z.array(z.number().int().positive()),
  occurrences: z.number().int().min(2),
}).strict();

export const basicPortfolioAuditResultSchema = z.object({
  contractVersion: z.literal("1.0"),
  lottery: z.object({ id: z.string().min(1), definitionVersion: z.string().min(1) }).strict(),
  betSize: z.number().int().positive(),
  candidateCount: z.number().int().positive(),
  valid: z.literal(true),
  duplicateGames: z.array(duplicateAuditGameSchema),
  numberFrequencies: z.array(auditNumberFrequencySchema),
  pairFrequencies: z.array(auditPairFrequencySchema),
  totals: z.object({
    numberOccurrences: z.number().int().nonnegative(),
    expectedNumberOccurrences: z.number().int().nonnegative(),
    pairOccurrences: z.number().int().nonnegative(),
    expectedPairOccurrences: z.number().int().nonnegative(),
  }).strict(),
  transient: z.literal(true),
  persisted: z.literal(false),
  frozen: z.literal(false),
  coverageCalculated: z.literal(false),
  portfolioStateChanged: z.literal(false),
}).strict();
export type BasicPortfolioAuditResult = z.infer<typeof basicPortfolioAuditResultSchema>;

export const PAIRWISE_PORTFOLIO_AUDIT_CONTRACT_VERSION = "1.0" as const;
export const PAIRWISE_PORTFOLIO_AUDIT_ALGORITHM_VERSION = "pairwise-intersection/1.0.0" as const;
export const PAIRWISE_PORTFOLIO_AUDIT_MIN_CANDIDATES = 2;
export const PAIRWISE_PORTFOLIO_AUDIT_MAX_CANDIDATES = 1_000;

/** Bounded input for the quadratic, transient intersection audit. */
export const pairwisePortfolioAuditRequestSchema = z.object({
  contractVersion: z.literal(PAIRWISE_PORTFOLIO_AUDIT_CONTRACT_VERSION),
  lotteryDefinition: lotteryDefinitionSchema,
  candidates: z.array(basicPortfolioAuditCandidateSchema)
    .min(PAIRWISE_PORTFOLIO_AUDIT_MIN_CANDIDATES)
    .max(PAIRWISE_PORTFOLIO_AUDIT_MAX_CANDIDATES),
}).strict();
export type PairwisePortfolioAuditRequest = z.infer<typeof pairwisePortfolioAuditRequestSchema>;

export const pairwisePortfolioAuditProgressSchema = z.object({
  phase: z.literal("PAIRWISE_INTERSECTIONS"),
  processedPairs: z.number().int().nonnegative(),
  totalPairs: z.number().int().positive(),
  percent: z.number().int().min(0).max(100),
}).strict();
export type PairwisePortfolioAuditProgress = z.infer<typeof pairwisePortfolioAuditProgressSchema>;

const pairwiseIntersectionSchema = z.object({
  candidateIndexes: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  intersectionSize: z.number().int().nonnegative(),
}).strict();
export type PairwisePortfolioIntersection = z.infer<typeof pairwiseIntersectionSchema>;

const pairwiseOverlapHistogramBucketSchema = z.object({
  intersectionSize: z.number().int().nonnegative(),
  pairCount: z.number().int().nonnegative(),
}).strict();

export const pairwisePortfolioAuditResultSchema = z.object({
  contractVersion: z.literal(PAIRWISE_PORTFOLIO_AUDIT_CONTRACT_VERSION),
  algorithmVersion: z.literal(PAIRWISE_PORTFOLIO_AUDIT_ALGORITHM_VERSION),
  lottery: z.object({ id: z.string().min(1), definitionVersion: z.string().min(1) }).strict(),
  betSize: z.number().int().positive(),
  candidateCount: z.number().int().min(PAIRWISE_PORTFOLIO_AUDIT_MIN_CANDIDATES)
    .max(PAIRWISE_PORTFOLIO_AUDIT_MAX_CANDIDATES),
  intersections: z.array(pairwiseIntersectionSchema),
  overlapHistogram: z.array(pairwiseOverlapHistogramBucketSchema),
  totals: z.object({
    expectedPairs: z.number().int().positive(),
    processedPairs: z.number().int().positive(),
  }).strict(),
  transient: z.literal(true),
  persisted: z.literal(false),
  frozen: z.literal(false),
  coverageCalculated: z.literal(false),
  portfolioStateChanged: z.literal(false),
}).strict();
export type PairwisePortfolioAuditResult = z.infer<typeof pairwisePortfolioAuditResultSchema>;

export const EXACT_COVERAGE_AUDIT_CONTRACT_VERSION = "1.0" as const;
export const EXACT_COVERAGE_AUDIT_ALGORITHM_VERSION = "dense-combinatorial-union/1.0.0" as const;
export const EXACT_COVERAGE_AUDIT_METHOD = "EXACT_ENUMERATION" as const;
export const EXACT_COVERAGE_AUDIT_MIN_CANDIDATES = 1;
export const EXACT_COVERAGE_AUDIT_MAX_CANDIDATES = 1_000;
export const EXACT_COVERAGE_AUDIT_TIMEOUT_MS = 30_000;
export const EXACT_COVERAGE_AUDIT_MAX_WORK_BATCH_SIZE = 65_536;
export const EXACT_COVERAGE_LOTOFACIL_ID = "lotofacil" as const;
export const EXACT_COVERAGE_LOTOFACIL_DEFINITION_VERSION = "1.0.0" as const;
export const EXACT_COVERAGE_LOTOFACIL_UNIVERSE_SIZE = 3_268_760;
export const EXACT_COVERAGE_LOTOFACIL_BET_SIZE = 15;
export const EXACT_COVERAGE_TIERS = [
  { minimumHits: 15, grossCoveredOutcomesPerCandidate: 1 },
  { minimumHits: 14, grossCoveredOutcomesPerCandidate: 151 },
  { minimumHits: 13, grossCoveredOutcomesPerCandidate: 4_876 },
  { minimumHits: 12, grossCoveredOutcomesPerCandidate: 59_476 },
] as const;

export const exactCoverageAuditErrorCodeSchema = z.enum([
  "COVERAGE_CANCELLED",
  "COVERAGE_TIMEOUT",
]);
export type ExactCoverageAuditErrorCode = z.infer<typeof exactCoverageAuditErrorCodeSchema>;

/** Bounded, history-free input for the first exact coverage contract. */
export const exactCoverageAuditRequestSchema = z.object({
  contractVersion: z.literal(EXACT_COVERAGE_AUDIT_CONTRACT_VERSION),
  lotteryDefinition: lotteryDefinitionSchema,
  candidates: z.array(basicPortfolioAuditCandidateSchema)
    .min(EXACT_COVERAGE_AUDIT_MIN_CANDIDATES)
    .max(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES),
}).strict();
export type ExactCoverageAuditRequest = z.infer<typeof exactCoverageAuditRequestSchema>;

export const exactCoverageAuditProgressSchema = z.object({
  phase: z.enum(["MARK_COVERED_OUTCOMES", "COUNT_UNIQUE_OUTCOMES"]),
  processedWork: z.number().int().nonnegative(),
  totalWork: z.number().int().positive(),
  percent: z.number().int().min(0).max(100),
}).strict().superRefine((progress, context) => {
  if (progress.processedWork > progress.totalWork) {
    context.addIssue({ code: "custom", path: ["processedWork"], message: "Processed work cannot exceed total work." });
  }
  const expectedPercent = Math.floor((progress.processedWork * 100) / progress.totalWork);
  if (progress.percent !== expectedPercent) {
    context.addIssue({ code: "custom", path: ["percent"], message: "Progress percent must match processedWork/totalWork." });
  }
});
export type ExactCoverageAuditProgress = z.infer<typeof exactCoverageAuditProgressSchema>;

const exactCoverageFractionSchema = z.object({
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().positive(),
}).strict();

const exactCoverageTierResultSchema = z.object({
  minimumHits: z.number().int().min(1),
  grossCoveredOutcomes: z.number().int().positive(),
  uniqueCoveredOutcomes: z.number().int().nonnegative(),
  repeatedCoveredOutcomes: z.number().int().nonnegative(),
  efficiency: exactCoverageFractionSchema,
}).strict();

const exactCoverageAuditResultObjectSchema = z.object({
  contractVersion: z.literal(EXACT_COVERAGE_AUDIT_CONTRACT_VERSION),
  algorithmVersion: z.literal(EXACT_COVERAGE_AUDIT_ALGORITHM_VERSION),
  adapterVersion: z.string().min(1),
  method: z.literal(EXACT_COVERAGE_AUDIT_METHOD),
  exact: z.literal(true),
  absoluteError: z.literal(0),
  relativeError: exactCoverageFractionSchema,
  lottery: z.object({ id: z.string().min(1), definitionVersion: z.string().min(1) }).strict(),
  universeSize: z.number().int().positive(),
  betSize: z.number().int().positive(),
  candidateCount: z.number().int().min(EXACT_COVERAGE_AUDIT_MIN_CANDIDATES)
    .max(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES),
  timeoutMs: z.literal(EXACT_COVERAGE_AUDIT_TIMEOUT_MS),
  totalWork: z.number().int().positive(),
  processedWork: z.number().int().positive(),
  tiers: z.array(exactCoverageTierResultSchema).min(1),
  transient: z.literal(true),
  persisted: z.literal(false),
  frozen: z.literal(false),
  coverageCalculated: z.literal(true),
  portfolioStateChanged: z.literal(false),
}).strict();

/** Modality-neutral result shape used by reusable exact-coverage engines. */
export const exactCoverageAuditResultBaseSchema = exactCoverageAuditResultObjectSchema.superRefine((result, context) => {
  if (result.relativeError.numerator !== 0 || result.relativeError.denominator !== 1) {
    context.addIssue({ code: "custom", path: ["relativeError"], message: "Exact coverage relative error must be 0/1." });
  }
  if (result.processedWork !== result.totalWork) {
    context.addIssue({ code: "custom", path: ["processedWork"], message: "Completed coverage must process all declared work." });
  }
  result.tiers.forEach((tier, index) => {
    if (index > 0 && tier.minimumHits >= result.tiers[index - 1]!.minimumHits) {
      context.addIssue({ code: "custom", path: ["tiers", index, "minimumHits"], message: "Coverage tiers must use strictly descending minimumHits." });
    }
    if (tier.uniqueCoveredOutcomes + tier.repeatedCoveredOutcomes !== tier.grossCoveredOutcomes) {
      context.addIssue({ code: "custom", path: ["tiers", index], message: "Unique and repeated coverage must conserve gross coverage." });
    }
    const divisor = contractGreatestCommonDivisor(tier.uniqueCoveredOutcomes, tier.grossCoveredOutcomes);
    if (
      tier.efficiency.numerator !== tier.uniqueCoveredOutcomes / divisor ||
      tier.efficiency.denominator !== tier.grossCoveredOutcomes / divisor
    ) {
      context.addIssue({ code: "custom", path: ["tiers", index, "efficiency"], message: "Coverage efficiency must be the reduced exact unique/gross fraction." });
    }
    if (tier.uniqueCoveredOutcomes > result.universeSize) {
      context.addIssue({ code: "custom", path: ["tiers", index, "uniqueCoveredOutcomes"], message: "Unique coverage cannot exceed the outcome universe." });
    }
  });
});
export type ExactCoverageAuditBaseResult = z.infer<typeof exactCoverageAuditResultBaseSchema>;

/** Public contract 1.0, frozen to the first Lotofácil 15-number integration. */
export const exactCoverageAuditResultSchema = exactCoverageAuditResultBaseSchema.superRefine((result, context) => {
  if (
    result.lottery.id !== EXACT_COVERAGE_LOTOFACIL_ID ||
    result.lottery.definitionVersion !== EXACT_COVERAGE_LOTOFACIL_DEFINITION_VERSION ||
    result.universeSize !== EXACT_COVERAGE_LOTOFACIL_UNIVERSE_SIZE ||
    result.betSize !== EXACT_COVERAGE_LOTOFACIL_BET_SIZE
  ) {
    context.addIssue({
      code: "custom",
      path: ["lottery"],
      message: "Public coverage results require Lotofácil 25/15 version 1.0.0.",
    });
  }
  if (result.tiers.length !== EXACT_COVERAGE_TIERS.length) {
    context.addIssue({ code: "custom", path: ["tiers"], message: "Lotofácil coverage must contain all four canonical tiers." });
  }
  result.tiers.forEach((tier, index) => {
    const expected = EXACT_COVERAGE_TIERS[index];
    if (!expected) return;
    if (tier.minimumHits !== expected.minimumHits) {
      context.addIssue({ code: "custom", path: ["tiers", index, "minimumHits"], message: "Lotofácil coverage tiers must use canonical order." });
    }
    if (
      tier.grossCoveredOutcomes !==
      result.candidateCount * expected.grossCoveredOutcomesPerCandidate
    ) {
      context.addIssue({ code: "custom", path: ["tiers", index, "grossCoveredOutcomes"], message: "Lotofácil gross coverage must match its canonical tier mass." });
    }
  });
});
export type ExactCoverageAuditResult = z.infer<typeof exactCoverageAuditResultSchema>;

/** Lottery-owned enumeration bridge; the coverage engine owns union semantics. */
export interface ExactCoverageTierDefinition {
  readonly minimumHits: number;
  readonly grossCoveredOutcomesPerCandidate: number;
}

export interface ExactCoverageAdapter {
  readonly lotteryId: string;
  readonly adapterVersion: string;
  readonly betSize: number;
  readonly universeSize: number;
  readonly coveredOutcomeVisitsPerCandidate: number;
  readonly tiers: readonly ExactCoverageTierDefinition[];
  supportsDefinition(definition: LotteryDefinition): boolean;
  enumerateCoveredOutcomeRanks(
    numbers: readonly number[],
    visitor: (rank: number, hits: number) => void,
  ): void;
}

export const EXPANDED_COVERAGE_COMPOSITION_CONTRACT_VERSION = "1.0" as const;
export const EXPANDED_COVERAGE_COMPOSITION_ALGORITHM_VERSION =
  "expand-then-cover/1.0.0" as const;

const expandedCoverageSourceBetSchema = canonicalBetExpansionBetSchema;

/** Bounded, modality-neutral input for composing expansion with exact coverage. */
export const expandedCoverageCompositionRequestSchema = z.object({
  contractVersion: z.literal(EXPANDED_COVERAGE_COMPOSITION_CONTRACT_VERSION),
  lotteryDefinition: lotteryDefinitionSchema.strict(),
  sourceBets: z.array(expandedCoverageSourceBetSchema)
    .min(1)
    .max(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES),
}).strict().superRefine((request, context) => {
  let expandedCandidateCount = 0;

  request.sourceBets.forEach((sourceBet, sourceIndex) => {
    const expansionRequest = {
      contractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
      lotteryDefinition: request.lotteryDefinition,
      sourceBet,
    };
    const parsed = canonicalBetExpansionRequestSchema.safeParse(expansionRequest);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const mappedPath = issue.path[0] === "sourceBet"
          ? ["sourceBets", sourceIndex, ...issue.path.slice(1)]
          : issue.path;
        context.addIssue({
          code: "custom",
          path: mappedPath,
          message: issue.message,
        });
      }
      return;
    }

    const sourceCandidateCount = binomialCoefficient(
      sourceBet.numbers.length,
      request.lotteryDefinition.drawSize,
    );
    if (!Number.isSafeInteger(expandedCandidateCount + sourceCandidateCount)) {
      context.addIssue({
        code: "custom",
        path: ["sourceBets", sourceIndex],
        message: "Expanded candidate count must fit the safe integer range.",
      });
      return;
    }
    expandedCandidateCount += sourceCandidateCount;
  });

  if (expandedCandidateCount > EXACT_COVERAGE_AUDIT_MAX_CANDIDATES) {
    context.addIssue({
      code: "custom",
      path: ["sourceBets"],
      message: `Expanded coverage is limited to ${EXACT_COVERAGE_AUDIT_MAX_CANDIDATES} candidate occurrences.`,
    });
  }
});
export type ExpandedCoverageCompositionRequest = z.infer<
  typeof expandedCoverageCompositionRequestSchema
>;

const expandedCoverageSourceSummarySchema = z.object({
  sourceIndex: z.number().int().nonnegative(),
  sourceBet: expandedCoverageSourceBetSchema,
  sourceBetSize: z.number().int().positive(),
  expectedCandidateCount: z.number().int().positive(),
}).strict();

const expandedCoverageComponentVersionsSchema = z.object({
  expansionContractVersion: z.literal(CANONICAL_BET_EXPANSION_CONTRACT_VERSION),
  expansionAlgorithmVersion: z.literal(CANONICAL_BET_EXPANSION_ALGORITHM_VERSION),
  expansionAdapterVersion: z.string().min(1),
  coverageContractVersion: z.literal(EXACT_COVERAGE_AUDIT_CONTRACT_VERSION),
  coverageAlgorithmVersion: z.literal(EXACT_COVERAGE_AUDIT_ALGORITHM_VERSION),
  coverageAdapterVersion: z.string().min(1),
}).strict();

export const expandedCoverageCompositionResultBaseSchema = z.object({
  contractVersion: z.literal(EXPANDED_COVERAGE_COMPOSITION_CONTRACT_VERSION),
  algorithmVersion: z.literal(EXPANDED_COVERAGE_COMPOSITION_ALGORITHM_VERSION),
  componentVersions: expandedCoverageComponentVersionsSchema,
  lottery: z.object({
    id: z.string().min(1),
    definitionVersion: z.string().min(1),
  }).strict(),
  sourceBetCount: z.number().int().positive()
    .max(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES),
  sources: z.array(expandedCoverageSourceSummarySchema)
    .min(1)
    .max(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES),
  expandedCandidateCount: z.number().int().positive()
    .max(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES),
  distinctCandidateCount: z.number().int().positive()
    .max(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES),
  duplicateCandidateOccurrences: z.number().int().nonnegative()
    .max(EXACT_COVERAGE_AUDIT_MAX_CANDIDATES - 1),
  coverage: exactCoverageAuditResultBaseSchema,
  transient: z.literal(true),
  persisted: z.literal(false),
  frozen: z.literal(false),
  portfolioStateChanged: z.literal(false),
}).strict().superRefine((result, context) => {
  if (result.sourceBetCount !== result.sources.length) {
    context.addIssue({
      code: "custom",
      path: ["sourceBetCount"],
      message: "Source bet count must match source summaries.",
    });
  }

  let summarizedCandidateCount = 0;
  result.sources.forEach((source, index) => {
    if (source.sourceIndex !== index) {
      context.addIssue({
        code: "custom",
        path: ["sources", index, "sourceIndex"],
        message: "Source summaries must preserve zero-based input order.",
      });
    }
    if (source.sourceBet.numbers.length !== source.sourceBetSize) {
      context.addIssue({
        code: "custom",
        path: ["sources", index, "sourceBetSize"],
        message: "Source bet size must match source numbers.",
      });
    }
    source.sourceBet.numbers.forEach((number, numberIndex) => {
      if (
        numberIndex > 0 &&
        number <= source.sourceBet.numbers[numberIndex - 1]!
      ) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "sourceBet", "numbers", numberIndex],
          message: "Source bet numbers must be unique and in strictly ascending order.",
        });
      }
    });
    try {
      const derivedCandidateCount = binomialCoefficient(
        source.sourceBetSize,
        result.coverage.betSize,
      );
      if (source.expectedCandidateCount !== derivedCandidateCount) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "expectedCandidateCount"],
          message: "Source summary candidate count must match its canonical expansion.",
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        path: ["sources", index, "expectedCandidateCount"],
        message: "Source summary candidate count must fit the safe integer range.",
      });
    }
    summarizedCandidateCount += source.expectedCandidateCount;
  });

  if (summarizedCandidateCount !== result.expandedCandidateCount) {
    context.addIssue({
      code: "custom",
      path: ["expandedCandidateCount"],
      message: "Expanded candidate count must match the sum of source summaries.",
    });
  }
  if (
    result.distinctCandidateCount + result.duplicateCandidateOccurrences !==
    result.expandedCandidateCount
  ) {
    context.addIssue({
      code: "custom",
      path: ["duplicateCandidateOccurrences"],
      message: "Distinct and duplicate candidate occurrences must conserve the expanded total.",
    });
  }
  if (result.coverage.candidateCount !== result.expandedCandidateCount) {
    context.addIssue({
      code: "custom",
      path: ["coverage", "candidateCount"],
      message: "Coverage candidate count must match the expanded occurrence total.",
    });
  }
  if (
    result.coverage.lottery.id !== result.lottery.id ||
    result.coverage.lottery.definitionVersion !== result.lottery.definitionVersion
  ) {
    context.addIssue({
      code: "custom",
      path: ["coverage", "lottery"],
      message: "Coverage lottery must match the composition lottery.",
    });
  }
  if (
    result.componentVersions.coverageAdapterVersion !==
    result.coverage.adapterVersion
  ) {
    context.addIssue({
      code: "custom",
      path: ["componentVersions", "coverageAdapterVersion"],
      message: "Coverage adapter version must match the nested coverage result.",
    });
  }
});
export type ExpandedCoverageCompositionBaseResult = z.infer<
  typeof expandedCoverageCompositionResultBaseSchema
>;

/** Public result boundary frozen to the first Lotofácil exact integration. */
export const expandedCoverageCompositionResultSchema =
  expandedCoverageCompositionResultBaseSchema.superRefine((result, context) => {
    const parsedCoverage = exactCoverageAuditResultSchema.safeParse(result.coverage);
    if (!parsedCoverage.success) {
      context.addIssue({
        code: "custom",
        path: ["coverage"],
        message: "Expanded coverage results require the canonical Lotofácil exact coverage contract.",
      });
    }
    if (
      result.lottery.id !== EXACT_COVERAGE_LOTOFACIL_ID ||
      result.lottery.definitionVersion !== EXACT_COVERAGE_LOTOFACIL_DEFINITION_VERSION
    ) {
      context.addIssue({
        code: "custom",
        path: ["lottery"],
        message: "Expanded coverage results require Lotofácil 25/15 version 1.0.0.",
      });
    }
    result.sources.forEach((source, index) => {
      const parsedSource = canonicalBetExpansionRequestSchema.safeParse({
        contractVersion: CANONICAL_BET_EXPANSION_CONTRACT_VERSION,
        lotteryDefinition: {
          id: EXACT_COVERAGE_LOTOFACIL_ID,
          version: EXACT_COVERAGE_LOTOFACIL_DEFINITION_VERSION,
          totalNumbers: 25,
          drawSize: EXACT_COVERAGE_LOTOFACIL_BET_SIZE,
          minBetSize: 15,
          maxBetSize: 20,
        },
        sourceBet: source.sourceBet,
      });
      if (!parsedSource.success) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "sourceBet"],
          message: "Expanded coverage source summaries require canonical Lotofácil bets.",
        });
      }
    });
  });
export type ExpandedCoverageCompositionResult = z.infer<
  typeof expandedCoverageCompositionResultSchema
>;

function validateExpandedCoverageCompositionExecutionLink(
  { request, result }: {
    request: ExpandedCoverageCompositionRequest;
    result: ExpandedCoverageCompositionBaseResult;
  },
  context: z.RefinementCtx,
): void {
  if (
    result.lottery.id !== request.lotteryDefinition.id ||
    result.lottery.definitionVersion !== request.lotteryDefinition.version
  ) {
    context.addIssue({
      code: "custom",
      path: ["result", "lottery"],
      message: "Composition result lottery must match the originating request.",
    });
  }
  if (result.sources.length !== request.sourceBets.length) {
    context.addIssue({
      code: "custom",
      path: ["result", "sources"],
      message: "Composition result sources must match the originating request count.",
    });
    return;
  }

  result.sources.forEach((source, index) => {
    const requestedSource = request.sourceBets[index]!;
    if (
      source.sourceBet.numbers.length !== requestedSource.numbers.length ||
      source.sourceBet.numbers.some(
        (number, numberIndex) => number !== requestedSource.numbers[numberIndex],
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["result", "sources", index, "sourceBet"],
        message: "Source summary must match its originating request entry.",
      });
    }

    const expectedCandidateCount = binomialCoefficient(
      requestedSource.numbers.length,
      request.lotteryDefinition.drawSize,
    );
    if (source.expectedCandidateCount !== expectedCandidateCount) {
      context.addIssue({
        code: "custom",
        path: ["result", "sources", index, "expectedCandidateCount"],
        message: "Source summary candidate count must match its canonical expansion.",
      });
    }
  });
}

/** Modality-neutral execution boundary used by the reusable engine. */
export const expandedCoverageCompositionExecutionBaseSchema = z.object({
  request: expandedCoverageCompositionRequestSchema,
  result: expandedCoverageCompositionResultBaseSchema,
}).strict().superRefine(validateExpandedCoverageCompositionExecutionLink);

/** Public Lotofácil execution boundary, including every integration invariant. */
export const expandedCoverageCompositionExecutionSchema = z.object({
  request: expandedCoverageCompositionRequestSchema,
  result: expandedCoverageCompositionResultSchema,
}).strict().superRefine(validateExpandedCoverageCompositionExecutionLink);

export function validateExpandedCoverageCompositionBaseResult(
  request: ExpandedCoverageCompositionRequest,
  result: unknown,
): ExpandedCoverageCompositionBaseResult {
  return expandedCoverageCompositionExecutionBaseSchema.parse({ request, result }).result;
}

export function validateExpandedCoverageCompositionResult(
  request: ExpandedCoverageCompositionRequest,
  result: unknown,
): ExpandedCoverageCompositionResult {
  return expandedCoverageCompositionExecutionSchema.parse({ request, result }).result;
}

export interface DeterministicRandom {
  nextInt(upperExclusive: number): number;
}

/**
 * Small deterministic PRNG used only for repeatable local generation. It is
 * not a source of entropy and must not be used for security-sensitive work.
 */
export function createDeterministicRandom(seed: string): DeterministicRandom {
  let state = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index)!, 16_777_619);
  }

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };

  return {
    nextInt(upperExclusive: number): number {
      if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0) {
        throw new Error("The random upper bound must be a positive safe integer.");
      }
      return Math.floor((nextUint32() / 0x1_0000_0000) * upperExclusive);
    },
  };
}

export const approvedStrategyConfigSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  status: strategyStatusSchema,
  mode: z.enum(["NEUTRAL", "BALANCED", "CONCENTRATED", "EXPERIMENTAL_SPECIAL"]),
  parameters: z.record(z.string(), z.unknown()),
});

export type ApprovedStrategyConfig = z.infer<typeof approvedStrategyConfigSchema>;

export const strategyConfigVersionInputSchema = approvedStrategyConfigSchema.extend({
  previousRecordId: z.string().uuid().optional(),
});
export type StrategyConfigVersionInput = z.infer<typeof strategyConfigVersionInputSchema>;

export const strategyConfigVersionSchema = strategyConfigVersionInputSchema.extend({
  recordId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
});
export type StrategyConfigVersion = z.infer<typeof strategyConfigVersionSchema>;

export const generationParametersSchema = z.object({
  seed: z.string().min(1),
  gameCount: z.number().int().positive(),
  stakeSize: z.number().int().positive(),
});

export const generationRequestSchema = z.object({
  contractVersion: z.literal("1.0"),
  lotteryDefinition: lotteryDefinitionSchema,
  approvedStrategy: approvedStrategyConfigSchema,
  parameters: generationParametersSchema,
}).strict();

export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export const mathEngineRequestSchema = z.object({
  contractVersion: z.literal("1.0"),
  operation: z.enum(["generate", "optimize", "coverage"]),
  request: generationRequestSchema,
}).strict();

export type MathEngineRequest = z.infer<typeof mathEngineRequestSchema>;

/**
 * A fraction represented by integers. Consumers must compare its numerator and
 * denominator instead of converting it to a floating point number.
 */
export const exactFractionSchema = z.object({
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().positive(),
});

export type ExactFraction = z.infer<typeof exactFractionSchema>;

export const axisNameSchema = z.enum(["ROWS", "COLUMNS"]);
export type AxisName = z.infer<typeof axisNameSchema>;

export const theoreticalTailSchema = z.enum(["GREATER_THAN_OR_EQUAL"]);
export type TheoreticalTail = z.infer<typeof theoreticalTailSchema>;

export const axisOccupancyMetricSchema = z.enum([
  "AXES_WITH_0",
  "AXES_WITH_1",
  "DEVIATION_NORMALIZED",
]);
export type AxisOccupancyMetric = z.infer<typeof axisOccupancyMetricSchema>;

export const rarityClassSchema = z.enum([
  "NORMAL",
  "ATTENTION",
  "RARE",
  "VERY_RARE",
]);
export type RarityClass = z.infer<typeof rarityClassSchema>;

export const rarityThresholdsSchema = z
  .object({
    normalMin: exactFractionSchema,
    attentionMin: exactFractionSchema,
    rareMin: exactFractionSchema,
  })
  .superRefine((thresholds, context) => {
    const isDescending = (
      first: ExactFraction,
      second: ExactFraction,
    ): boolean => first.numerator * second.denominator >= second.numerator * first.denominator;

    if (
      !isDescending(thresholds.normalMin, thresholds.attentionMin) ||
      !isDescending(thresholds.attentionMin, thresholds.rareMin)
    ) {
      context.addIssue({
        code: "custom",
        message: "Rarity thresholds must descend from NORMAL to RARE.",
      });
    }
  });

export type RarityThresholds = z.infer<typeof rarityThresholdsSchema>;

export const DEFAULT_RARITY_THRESHOLDS: RarityThresholds = {
  normalMin: { numerator: 10, denominator: 100 },
  attentionMin: { numerator: 2, denominator: 100 },
  rareMin: { numerator: 5, denominator: 1000 },
};

export interface AxisOccupancy {
  readonly counts: readonly [number, number, number, number, number];
  readonly min: number;
  readonly max: number;
  readonly axesWith: Readonly<Record<0 | 1 | 2 | 3 | 4 | 5, number>>;
  readonly expectedPerAxis: ExactFraction;
  readonly deviation: ExactFraction;
  readonly deviationNormalized: ExactFraction;
}

export interface TheoreticalDistributionBucket {
  /**
   * Exact value represented by valueNumerator / valueDenominator. For
   * AXES_WITH_0 and AXES_WITH_1, denominator is always 1.
   */
  readonly valueNumerator: number;
  readonly valueDenominator: number;
  readonly occurrences: number;
}

export interface TheoreticalAxisDistribution {
  readonly lotteryId: string;
  readonly algorithmVersion: string;
  readonly betSize: number;
  readonly axis: AxisName;
  readonly metric: AxisOccupancyMetric;
  readonly tail: TheoreticalTail;
  readonly totalOutcomes: number;
  readonly buckets: readonly TheoreticalDistributionBucket[];
}

export interface AxisRarityAssessment {
  readonly rarityClass: RarityClass;
  readonly tail: TheoreticalTail;
  readonly observed: ExactFraction;
  readonly tailOccurrences: number;
  readonly totalOutcomes: number;
  readonly theoreticalFrequency: ExactFraction;
}

/**
 * Stable boundary used by audit and statistics. Individual lotteries own their
 * profile shape and rule semantics; the Core only relies on this operation.
 */
export interface LotteryMetricEngine<Profile> {
  calculate(numbers: readonly number[]): Profile;
}

export interface StructuralRuleFlag {
  readonly applicable: boolean;
  readonly isExtreme: boolean | null;
}

/**
 * Applies only the structural rules valid for a metric profile. It must not
 * query history, strategy configuration, generation state, or persistence.
 */
export interface StructuralClassifier<Profile, Classification> {
  classify(profile: Profile): Classification;
}

export const STRUCTURAL_BAND_ORDER = [
  "ZERO_EXTREMES",
  "ONE_EXTREME",
  "TWO_EXTREMES",
  "THREE_EXTREMES",
  "FOUR_PLUS_EXTREMES",
] as const;

export const structuralBandSchema = z.enum(STRUCTURAL_BAND_ORDER);
export type StructuralBand = z.infer<typeof structuralBandSchema>;

export interface StructuralSummary {
  readonly applicable: boolean;
  readonly extremeCount: number | null;
  readonly band: StructuralBand | null;
  readonly isCentralCore: boolean | null;
}

export const PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_CONTRACT_VERSION = "1.0" as const;
export const PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_ALGORITHM_VERSION =
  "structural-distribution/1.0.0" as const;

/** Linear, history-free input for aggregating canonical structural summaries. */
export const portfolioStructuralDistributionAuditRequestSchema = z.object({
  contractVersion: z.literal(PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_CONTRACT_VERSION),
  lotteryDefinition: lotteryDefinitionSchema,
  candidates: z.array(basicPortfolioAuditCandidateSchema).min(1),
}).strict();
export type PortfolioStructuralDistributionAuditRequest = z.infer<
  typeof portfolioStructuralDistributionAuditRequestSchema
>;

export const portfolioStructuralDistributionAuditProgressSchema = z.object({
  phase: z.literal("STRUCTURAL_DISTRIBUTION"),
  processedCandidates: z.number().int().nonnegative(),
  totalCandidates: z.number().int().positive(),
  percent: z.number().int().min(0).max(100),
}).strict();
export type PortfolioStructuralDistributionAuditProgress = z.infer<
  typeof portfolioStructuralDistributionAuditProgressSchema
>;

const portfolioStructuralDistributionBucketSchema = z.object({
  band: structuralBandSchema,
  count: z.number().int().nonnegative(),
  frequency: exactFractionSchema.strict(),
}).strict();

function contractGreatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

export const portfolioStructuralDistributionAuditResultSchema = z.object({
  contractVersion: z.literal(PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_CONTRACT_VERSION),
  algorithmVersion: z.literal(PORTFOLIO_STRUCTURAL_DISTRIBUTION_AUDIT_ALGORITHM_VERSION),
  metricEngineVersion: z.string().min(1),
  classifierVersion: z.string().min(1),
  lottery: z.object({ id: z.string().min(1), definitionVersion: z.string().min(1) }).strict(),
  betSize: z.number().int().positive(),
  candidateCount: z.number().int().positive(),
  buckets: z.array(portfolioStructuralDistributionBucketSchema).length(STRUCTURAL_BAND_ORDER.length),
  transient: z.literal(true),
  persisted: z.literal(false),
  frozen: z.literal(false),
  coverageCalculated: z.literal(false),
  portfolioStateChanged: z.literal(false),
}).strict().superRefine((result, context) => {
  const totalCount = result.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (totalCount !== result.candidateCount) {
    context.addIssue({ code: "custom", path: ["buckets"], message: "Bucket counts must equal candidateCount." });
  }

  result.buckets.forEach((bucket, index) => {
    if (bucket.band !== STRUCTURAL_BAND_ORDER[index]) {
      context.addIssue({ code: "custom", path: ["buckets", index, "band"], message: "Buckets must use canonical structural-band order." });
    }
    const divisor = contractGreatestCommonDivisor(bucket.count, result.candidateCount);
    const expectedNumerator = bucket.count / divisor;
    const expectedDenominator = result.candidateCount / divisor;
    if (
      bucket.frequency.numerator !== expectedNumerator ||
      bucket.frequency.denominator !== expectedDenominator
    ) {
      context.addIssue({ code: "custom", path: ["buckets", index, "frequency"], message: "Bucket frequency must be the reduced exact count over candidateCount." });
    }
  });
});
export type PortfolioStructuralDistributionAuditResult = z.infer<
  typeof portfolioStructuralDistributionAuditResultSchema
>;

/** Lottery-owned bridge; the generic audit engine never owns rule semantics. */
export interface PortfolioStructuralDistributionAdapter {
  readonly lotteryId: string;
  readonly betSize: number;
  readonly metricEngineVersion: string;
  readonly classifierVersion: string;
  supportsDefinition(definition: LotteryDefinition): boolean;
  summarize(numbers: readonly number[]): StructuralSummary;
}

/** A single structural band in a completely enumerated lottery universe. */
export interface StructuralMassBucket {
  readonly band: StructuralBand;
  readonly occurrences: number;
  readonly frequency: ExactFraction;
}

/**
 * Versioned theoretical distribution of structural bands. It intentionally
 * contains no historical, strategy, or generated-portfolio information.
 */
export interface StructuralMassProfile {
  readonly lotteryId: string;
  readonly algorithmVersion: string;
  readonly betSize: number;
  readonly totalOutcomes: number;
  readonly buckets: readonly StructuralMassBucket[];
}
