export type QuestionTextDiffPart = {
  kind: "same" | "added" | "removed";
  text: string;
};

function tokenize(value: string) {
  return value.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [];
}

export function diffQuestionText(
  original: string,
  proposal: string,
): QuestionTextDiffPart[] {
  const left = tokenize(original);
  const right = tokenize(proposal);
  const lengths = Array.from(
    { length: left.length + 1 },
    () => Array<number>(right.length + 1).fill(0),
  );
  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      lengths[leftIndex][rightIndex] = left[leftIndex] === right[rightIndex]
        ? lengths[leftIndex + 1][rightIndex + 1] + 1
        : Math.max(
            lengths[leftIndex + 1][rightIndex],
            lengths[leftIndex][rightIndex + 1],
          );
    }
  }

  const parts: QuestionTextDiffPart[] = [];
  const append = (kind: QuestionTextDiffPart["kind"], text: string) => {
    const previous = parts.at(-1);
    if (previous?.kind === kind) previous.text += text;
    else parts.push({ kind, text });
  };
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length || rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      append("same", left[leftIndex]);
      leftIndex += 1;
      rightIndex += 1;
    } else if (
      rightIndex < right.length &&
      (leftIndex >= left.length ||
        lengths[leftIndex][rightIndex + 1] >=
          lengths[leftIndex + 1][rightIndex])
    ) {
      append("added", right[rightIndex]);
      rightIndex += 1;
    } else {
      append("removed", left[leftIndex]);
      leftIndex += 1;
    }
  }
  return parts;
}
