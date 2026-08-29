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

export const strategyStatusSchema = z.enum([
  "DRAFT",
  "EXPLORATORY",
  "VALIDATING",
  "HOLDOUT",
  "VALIDATED",
  "PRODUCTION",
  "REJECTED",
]);

export const approvedStrategyConfigSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  status: strategyStatusSchema,
  mode: z.enum(["NEUTRAL", "BALANCED", "CONCENTRATED", "EXPERIMENTAL_SPECIAL"]),
  parameters: z.record(z.string(), z.unknown()),
});

export type ApprovedStrategyConfig = z.infer<typeof approvedStrategyConfigSchema>;

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
