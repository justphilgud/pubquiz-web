"use client";

import { useState } from "react";
import { moveQuizFrage } from "../actions";

type Props = {
  quizId: number;
  quizFragenId: number;
  isFirst: boolean;
  isLast: boolean;
  onMove?: (direction: "up" | "down") => void | Promise<void>;
};

const arrowButtonClass =
  "flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

export default function QuizFrageSortierungButtons({
  quizId,
  quizFragenId,
  isFirst,
  isLast,
  onMove,
}: Props) {
  const [isMoving, setIsMoving] = useState(false);

  async function move(direction: "up" | "down") {
    if (isMoving) return;
    setIsMoving(true);
    try {
      if (onMove) {
        await onMove(direction);
        return;
      }

      await moveQuizFrage({
        quizId,
        quizFragenId,
        direction,
      });
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <div className="flex items-center gap-2" aria-label="Frage verschieben">
      {isFirst ? (
        <span className="h-11 w-11" aria-hidden="true" />
      ) : (
        <button
          type="button"
          disabled={isMoving}
          onClick={() => move("up")}
          title="Nach oben"
          aria-label="Nach oben"
          className={arrowButtonClass}
        >
          ↑
        </button>
      )}

      {isLast ? (
        <span className="h-11 w-11" aria-hidden="true" />
      ) : (
        <button
          type="button"
          disabled={isMoving}
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
