export type TrueFalsePresentationOption = {
  id: "TRUE" | "FALSE";
  label: "Wahr" | "Falsch";
  isCorrect: boolean;
};

export function buildTrueFalsePresentationOptions(
  correctAnswer: boolean,
): readonly TrueFalsePresentationOption[] {
  return [
    { id: "TRUE", label: "Wahr", isCorrect: correctAnswer },
    { id: "FALSE", label: "Falsch", isCorrect: !correctAnswer },
  ];
}
