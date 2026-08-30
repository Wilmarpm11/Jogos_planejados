export type CombinationVisitor = (combination: readonly number[]) => void;

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
