"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import QuizForm from "./QuizForm";
import SchnellQuizForm from "./SchnellQuizForm";
import type { QuizResult } from "./actions";

type Kategorie = {
  fragenkategorie_id: number;
  kategorie: string;
};

type Tab = "verwaltung" | "schnellquiz";

export default function QuizWorkspace({
  quizze,
  kategorien,
  passwort,
}: {
  quizze: QuizResult[];
  kategorien: Kategorie[];
  passwort: string;
}) {
  const searchParams = useSearchParams();

  const initialTab: Tab =
    searchParams.get("tab") === "schnellquiz" ? "schnellquiz" : "verwaltung";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Quiz-Verwaltung
            </h1>

            <p className="mt-2 text-slate-600">
              Lege Quiz-Abende an, verwalte bestehende Quizze oder erstelle ein Schnellquiz.
            </p>
          </div>

          <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("verwaltung")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "verwaltung"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-50"
                }`}
            >
              Verwaltung
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("schnellquiz")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "schnellquiz"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-50"
                }`}
            >
              Schnellquiz
            </button>
          </div>
        </div>

        <div className={activeTab === "verwaltung" ? "block" : "hidden"}>
          <QuizForm
            quizze={quizze}
            passwort={passwort}
          />
        </div>

        <div className={activeTab === "schnellquiz" ? "block" : "hidden"}>
          <SchnellQuizForm kategorien={kategorien} />
        </div>
      </div>
    </main>
  );
}