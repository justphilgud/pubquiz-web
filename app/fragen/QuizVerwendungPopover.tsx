"use client";

import Link from "next/link";
import { useState } from "react";

type QuizInfo = {
  quiz_id: number;
  titel: string | null;
  quiz_datum: string | null;
  ist_archiviert: boolean;
};

export default function QuizVerwendungPopover({
  quizze,
}: {
  quizze: QuizInfo[];
}) {
  const [open, setOpen] = useState(false);

  if (quizze.length === 0) {
    return <span>0</span>;
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="font-semibold underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
      >
        {quizze.length}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm shadow-xl">
          <div className="mb-2 font-semibold text-slate-900">
            Verwendet in:
          </div>

          <div className="space-y-2">
            {quizze.map((quiz) => (
              <Link
                key={quiz.quiz_id}
                href={`/quiz/${quiz.quiz_id}`}
                className="block rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">
                  {quiz.titel ?? `Quiz ${quiz.quiz_id}`}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {quiz.quiz_datum ?? "-"}
                  {quiz.ist_archiviert ? " · archiviert" : ""}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}