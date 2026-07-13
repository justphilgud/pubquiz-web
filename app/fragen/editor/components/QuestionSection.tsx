import type { Ref } from "react";
import { CharacterCount } from "./CharacterCount";

type QuestionSectionProps = {
  questionText: string;
  questionTextRef?: Ref<HTMLTextAreaElement>;
  onQuestionTextChange: (questionText: string) => void;
};

export function QuestionSection({
  questionText,
  questionTextRef,
  onQuestionTextChange,
}: QuestionSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <label htmlFor="questionText" className="font-semibold text-slate-950">
        Frage
      </label>

      <textarea
        ref={questionTextRef}
        id="questionText"
        value={questionText}
        maxLength={300}
        onChange={(event) => onQuestionTextChange(event.target.value)}
        rows={4}
        autoFocus
        placeholder="Was möchtest du wissen?"
        className="mt-3 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-950"
      />

      <CharacterCount
        current={questionText.length}
        maximum={300}
        warningAt={220}
      />
    </section>
  );
}
