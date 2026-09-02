export type CombinationVisitor = (combination: readonly number[]) => void;

export type CombinationRanker = (combination: readonly number[]) => number;

/** Returns C(n, k) exactly while the result remains a safe integer. */
export function binomialCoefficient(totalItems: number, selectionSize: number): number {
  if (!Number.isInteger(totalItems) || totalItems < 0) {
    throw new Error("The combination universe size must be a non-negative integer.");
  }
  if (!Number.isInteger(selectionSize) || selectionSize < 0 || selectionSize > totalItems) {
    throw new Error("The combination selection size must be an integer within the universe.");
  }

  const reducedSelectionSize = Math.min(selectionSize, totalItems - selectionSize);
  let result = 1;
  for (let index = 1; index <= reducedSelectionSize; index += 1) {
    result = (result * (totalItems - reducedSelectionSize + index)) / index;
    if (!Number.isSafeInteger(result)) {
      throw new Error("The binomial coefficient exceeds the safe integer range.");
    }
  }
  return result;
}

/**
 * Creates a zero-based colexicographic ranker backed by a precomputed Pascal
 * table. Every increasing k-combination maps uniquely into [0, C(n,k)).
 */
export function createCombinationRanker(
  totalItems: number,
  selectionSize: number,
): CombinationRanker {
  const totalCombinations = binomialCoefficient(totalItems, selectionSize);
  const choose = Array.from(
    { length: totalItems + 1 },
    () => new Float64Array(selectionSize + 1),
  );
  for (let total = 0; total <= totalItems; total += 1) {
    choose[total]![0] = 1;
    for (let selected = 1; selected <= Math.min(total, selectionSize); selected += 1) {
      choose[total]![selected] = selected === total
        ? 1
        : choose[total - 1]![selected - 1]! + choose[total - 1]![selected]!;
    }
  }

  return (combination: readonly number[]): number => {
    if (combination.length !== selectionSize) {
      throw new Error(`The combination must contain exactly ${selectionSize} indexes.`);
    }
    let rank = 0;
    for (let index = 0; index < selectionSize; index += 1) {
      const value = combination[index]!;
      if (!Number.isInteger(value) || value < 0 || value >= totalItems) {
        throw new Error(`Combination index ${value} is outside 0-${totalItems - 1}.`);
      }
      if (index > 0 && value <= combination[index - 1]!) {
        throw new Error("Combination indexes must be in strictly increasing order.");
      }
      rank += choose[value]![index + 1]!;
    }
    if (!Number.isSafeInteger(rank) || rank < 0 || rank >= totalCombinations) {
      throw new Error("The combination rank is outside the dense universe.");
    }
    return rank;
  };
}

/** Ranks one combination; reuse createCombinationRanker on hot paths. */
export function combinationRank(
  totalItems: number,
  combination: readonly number[],
): number {
  return createCombinationRanker(totalItems, combination.length)(combination);
}

/**
 * Visits each increasing combination of `selectionSize` indexes from a
 * zero-based universe of `totalItems`. The array is reused between visits and
 * must not be retained or mutated by the visitor.
 */
export function forEachCombination(
  totalItems: number,
  selectionSize: number,
  visitor: CombinationVisitor,
): void {
  if (!Number.isInteger(totalItems) || totalItems < 0) {
    throw new Error("The combination universe size must be a non-negative integer.");
  }
  if (!Number.isInteger(selectionSize) || selectionSize < 0 || selectionSize > totalItems) {
    throw new Error("The combination selection size must be an integer within the universe.");
  }

  const combination = Array.from({ length: selectionSize }, (_, index) => index);
  while (true) {
    visitor(combination);

    let position = selectionSize - 1;
    while (position >= 0 && combination[position] === totalItems - selectionSize + position) {
      position -= 1;
    }
    if (position < 0) {
      return;
    }

    combination[position] = combination[position]! + 1;
    for (let index = position + 1; index < selectionSize; index += 1) {
      combination[index] = combination[index - 1]! + 1;
    }
  }
}
