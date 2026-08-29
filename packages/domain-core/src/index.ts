import { createHash } from "node:crypto";
import { z } from "zod";

export const CONTRACT_VERSION = "1.0" as const;
export const HASH_ALGORITHM = "sha256" as const;
export const HASH_VERSION = "1" as const;

export const portfolioStatusSchema = z.enum([
  "RASCUNHO",
  "AUDITADA",
  "APROVADA",
  "CONGELADA",
  "IMPRESSA",
  "CONFERIDA",
]);

export type PortfolioStatus = z.infer<typeof portfolioStatusSchema>;

export const canonicalGameSchema = z
  .array(z.number().int().positive())
  .min(1)
  .superRefine((numbers, context) => {
    if (new Set(numbers).size !== numbers.length) {
      context.addIssue({
        code: "custom",
        message: "Uma cartela canônica não pode ter dezenas repetidas.",
      });
    }
  });

export const portfolioIdentityInputSchema = z.object({
  lotteryId: z.string().min(1),
  lotteryVersion: z.string().min(1),
  strategyVersion: z.string().min(1),
  games: z.array(canonicalGameSchema).min(1),
});

export type PortfolioIdentityInput = z.infer<typeof portfolioIdentityInputSchema>;

const normalizeGame = (game: number[]): number[] => [...game].sort((a, b) => a - b);

export function canonicalizePortfolio(input: PortfolioIdentityInput): string {
  const parsed = portfolioIdentityInputSchema.parse(input);
  const games = parsed.games
    .map(normalizeGame)
    .sort((left, right) => left.join(",").localeCompare(right.join(",")));

  return JSON.stringify({
    hashAlgorithm: HASH_ALGORITHM,
    hashVersion: HASH_VERSION,
    lotteryId: parsed.lotteryId,
    lotteryVersion: parsed.lotteryVersion,
    strategyVersion: parsed.strategyVersion,
    games,
  });
}

export function calculatePortfolioHash(input: PortfolioIdentityInput): string {
  return createHash(HASH_ALGORITHM).update(canonicalizePortfolio(input)).digest("hex");
}

export const frozenPortfolioSchema = portfolioIdentityInputSchema.extend({
  id: z.string().uuid(),
  status: z.literal("CONGELADA"),
  portfolioHash: z.string().regex(/^[a-f0-9]{64}$/),
  frozenAt: z.string().datetime(),
});

export type FrozenPortfolio = z.infer<typeof frozenPortfolioSchema>;
