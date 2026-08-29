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
