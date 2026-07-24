"use client";

import Link from "next/link";
import FrageSuche from "./FrageSuche";

type Kategorie = {
  fragenkategorie_id: number;
  kategorie: string;
  status: "ACTIVE" | "PENDING" | "ARCHIVED";
};

export type QuizOption = {
  quiz_id: number;
  titel: string | null;
  quiz_datum: string | Date | null;
  ist_archiviert: boolean;
};

export default function FragenWorkspace({
  kategorien,
  quizze,
  embedded = false,
  templates,
  statusCounts,
}: {
  kategorien: Kategorie[];
  quizze: QuizOption[];
  embedded?: boolean;
  templates: Array<{ id: string; name: string }>;
  statusCounts: Partial<
    Record<
      "MY_DRAFTS" | "MY_SUBMITTED" | "REVIEW_QUEUE" | "CHANGES_REQUESTED",
      number
    >
  >;
}) {
  const Wrapper = embedded ? "div" : "main";

  return (
    <Wrapper className={embedded ? "" : "min-h-screen p-4 md:p-8"}>
      <div className={embedded ? "" : "mx-auto max-w-5xl"}>
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {!embedded && (
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Fragen</h1>
              <p className="mt-1 text-sm text-slate-500">
                Fragen anlegen, suchen und bearbeiten.
              </p>
            </div>
          )}

          <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <Link
              href="/fragen/editor"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Neue Frage
            </Link>

            <span className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              Suche
            </span>

            <Link
              href="/fragen/import"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Massenupload
            </Link>
          </div>
        </div>

        <div>
          <FrageSuche
            kategorien={kategorien}
            quizze={quizze}
            templates={templates}
            statusCounts={statusCounts}
          />
        </div>

      </div>
    </Wrapper>
  );
}
