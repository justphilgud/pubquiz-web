"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FrageSuche from "./FrageSuche";
import FrageForm from "./neu/FrageForm";
import { getFrageForEdit } from "./actions";

type Kategorie = {
  fragenkategorie_id: number;
  kategorie: string;
};

type Antworttyp = {
  antworttyp_id: number;
  antworttyp: string;
};

type Medientyp = {
  medientyp_id: number;
  medientyp: string;
};


export type QuizOption = {
  quiz_id: number;
  titel: string | null;
  quiz_datum: string | Date | null;
  ist_archiviert: boolean;
};

type EditFrage = Awaited<ReturnType<typeof getFrageForEdit>>;

export default function FragenWorkspace({
  kategorien,
  antworttypen,
  medientypen,
  quizze,
}: {
  kategorien: Kategorie[];
  antworttypen: Antworttyp[];
  medientypen: Medientyp[];
  quizze: QuizOption[];
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "suche" ? "suche" : "neu";

  const [activeTab, setActiveTab] = useState<"neu" | "suche">(initialTab);
  const [editFrage, setEditFrage] = useState<EditFrage>(null);
  const handleCancelEdit = () => {
    setEditFrage(null);
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Fragen</h1>
            <p className="mt-1 text-sm text-slate-500">
              Fragen anlegen, suchen und bearbeiten.
            </p>
          </div>

          <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setEditFrage(null);
                setActiveTab("neu");
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "neu"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-50"
                }`}
            >
              Neue Frage
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("suche")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === "suche"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-50"
                }`}
            >
              Suche
            </button>

            <Link
              href="/fragen/import"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Massenupload
            </Link>
          </div>
        </div>

        <div className={activeTab === "neu" ? "block" : "hidden"}>
          <FrageForm
            kategorien={kategorien}
            antworttypen={antworttypen}
            medientypen={medientypen}
            frageVorlagen={[]}
            offeneQuizzes={[]}
            editFrage={editFrage}
            onCancelEdit={handleCancelEdit}
          />
        </div>
        <div className={activeTab === "suche" ? "block" : "hidden"}>
          <FrageSuche
            kategorien={kategorien}
            quizze={quizze}
            onEditFrage={(frage) => {
              setEditFrage(frage);
              setActiveTab("neu");
            }}
          />
        </div>

      </div>
    </main>
  );
}