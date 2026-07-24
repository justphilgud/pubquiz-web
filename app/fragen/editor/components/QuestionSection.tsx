import type { ReactNode, Ref } from "react";
import { CharacterCount } from "./CharacterCount";
import { useQuestionEditorMessages } from "./QuestionEditorMessagesProvider";

type QuestionSectionProps = {
  questionText: string;
  questionTextRef?: Ref<HTMLTextAreaElement>;
  onQuestionTextChange: (questionText: string) => void;
  mediaContent?: ReactNode;
  validationError?: string | null;
  label?: string;
};

export function QuestionSection({
  questionText,
  questionTextRef,
  onQuestionTextChange,
  mediaContent,
  validationError = null,
  label,
}: QuestionSectionProps) {
  const { messages } = useQuestionEditorMessages();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <label htmlFor="questionText" className="font-semibold text-slate-950">
        {label ?? messages.question.label}
      </label>

      <textarea
        ref={questionTextRef}
        id="questionText"
        value={questionText}
        maxLength={300}
        onChange={(event) => onQuestionTextChange(event.target.value)}
        rows={4}
        autoFocus
        placeholder={messages.question.placeholder}
        aria-invalid={validationError ? true : undefined}
        aria-describedby={validationError ? "questionText-error" : undefined}
        className="mt-3 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-950"
      />

      {validationError && (
        <p id="questionText-error" role="alert" className="mt-2 text-sm font-medium text-red-700">
          {validationError}
        </p>
      )}

      <CharacterCount
        current={questionText.length}
        maximum={300}
        warningAt={220}
      />
      {mediaContent}
    </section>
  );
}
