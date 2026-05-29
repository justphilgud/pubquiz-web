import { prisma } from "@/lib/prisma";
import FrageForm from "./FrageForm";
import {
  getFrageVorlagen,
  getOffeneQuizzesForFrageForm,
} from "./actions";

export default async function NeueFragePage() {
  const [kategorien, antworttypen, medientypen, frageVorlagen, offeneQuizzes] =
    await Promise.all([
      prisma.fragenkategorie.findMany({
        orderBy: { kategorie: "asc" },
      }),

      prisma.antworttyp.findMany({
        orderBy: { antworttyp: "asc" },
      }),

      prisma.medientyp.findMany({
        orderBy: { medientyp: "asc" },
      }),

      getFrageVorlagen(),

      getOffeneQuizzesForFrageForm(),
    ]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Neue Frage anlegen
            </h1>

            <p className="mt-2 text-slate-600">
              Erstelle neue Fragen, Antworten und Medien.
            </p>
          </div>

          <a
            href="/fragen/import"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            Massenupload
          </a>
        </div>

        <FrageForm
          kategorien={kategorien}
          antworttypen={antworttypen}
          medientypen={medientypen}
          frageVorlagen={frageVorlagen}
          offeneQuizzes={offeneQuizzes}
        />
      </div>
    </main>
  );
}