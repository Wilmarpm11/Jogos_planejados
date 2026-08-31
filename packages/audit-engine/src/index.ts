import {
  basicPortfolioAuditRequestSchema,
  basicPortfolioAuditResultSchema,
  type BasicPortfolioAuditResult,
} from "@boloes/lottery-contracts";

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

/**
 * Audits canonical candidates without history, persistence, optimization or
 * coverage. Its cost is O(candidateCount * betSize² + totalNumbers²).
 */
export function auditBasicPortfolio(input: unknown): BasicPortfolioAuditResult {
  const request = basicPortfolioAuditRequestSchema.parse(input);
  const { lotteryDefinition, candidates } = request;
  validateDefinition(lotteryDefinition);

  const betSize = candidates[0]!.numbers.length;
  if (betSize < lotteryDefinition.minBetSize || betSize > lotteryDefinition.maxBetSize) {
    throw new Error(
      `Candidate bet size ${betSize} is outside ${lotteryDefinition.minBetSize}-${lotteryDefinition.maxBetSize}.`,
    );
  }

  const numberCounts = Array.from({ length: lotteryDefinition.totalNumbers + 1 }, () => 0);
  const pairCounts = new Map<string, number>();
  for (let first = 1; first <= lotteryDefinition.totalNumbers; first += 1) {
    for (let second = first + 1; second <= lotteryDefinition.totalNumbers; second += 1) {
      pairCounts.set(pairKey(first, second), 0);
    }
  }

  const gameOccurrences = new Map<string, { numbers: number[]; occurrences: number }>();
  candidates.forEach((candidate, candidateIndex) => {
    validateCandidate(candidate.numbers, candidateIndex, betSize, lotteryDefinition.totalNumbers);
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
