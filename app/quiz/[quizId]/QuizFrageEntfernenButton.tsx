"use client";

import { useRouter } from "next/navigation";
import { removeFrageFromQuiz } from "../actions";

type Props = {
  quizId: number;
  quizFragenId: number;
  onRemoved?: (quizFragenId: number) => void;
};

const trashButtonClass =
  "rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-700 shadow-sm transition hover:bg-red-100 active:scale-[0.99]";

export default function QuizFrageEntfernenButton({
  quizId,
  quizFragenId,
  onRemoved,
}: Props) {
  const router = useRouter();

  async function handleRemove() {
    const confirmed = window.confirm(
      "Möchtest du diese Frage wirklich aus dem Quiz entfernen?"
    );

    if (!confirmed) return;

    await removeFrageFromQuiz({
      quizId,
      quizFragenId,
    });

    onRemoved?.(quizFragenId);

    router.refresh();
  }

  return (
    <button type="button" onClick={handleRemove} className={trashButtonClass}>
      Entfernen
    </button>
  );
}