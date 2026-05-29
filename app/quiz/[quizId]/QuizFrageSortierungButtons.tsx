"use client";

import { moveQuizFrage } from "../actions";

type Props = {
  quizId: number;
  quizFragenId: number;
  isFirst: boolean;
  isLast: boolean;
  onMove?: (direction: "up" | "down") => void | Promise<void>;
};

const arrowButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 active:scale-95";

export default function QuizFrageSortierungButtons({
  quizId,
  quizFragenId,
  isFirst,
  isLast,
  onMove,
}: Props) {
  async function move(direction: "up" | "down") {
    if (onMove) {
      await onMove(direction);
      return;
    }

    await moveQuizFrage({
      quizId,
      quizFragenId,
      direction,
    });
  }

  return (
    <div className="flex w-20 items-center justify-between">
      {isFirst ? (
        <span className="h-8 w-8" />
      ) : (
        <button
          type="button"
          onClick={() => move("up")}
          title="Nach oben"
          aria-label="Nach oben"
          className={arrowButtonClass}
        >
          ↑
        </button>
      )}

      {isLast ? (
        <span className="h-8 w-8" />
      ) : (
        <button
          type="button"
          onClick={() => move("down")}
          title="Nach unten"
          aria-label="Nach unten"
          className={arrowButtonClass}
        >
          ↓
        </button>
      )}
    </div>
  );
}