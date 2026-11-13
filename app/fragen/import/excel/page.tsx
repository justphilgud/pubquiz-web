import Link from "next/link";
import { requireQuestionEditor } from "@/app/lib/permissions";
import { canEditEventSeriesQuestions, canEditGlobalQuestions, isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { getAssignableQuestionEventSeries } from "../../editor/questionAccess.server";
import { ExcelQuestionImport } from "./ExcelQuestionImport";

export default async function ExcelImportPage({ searchParams }: { searchParams: Promise<{ reihe?: string }> }) {
  const session = await requireQuestionEditor();
  const series = await getAssignableQuestionEventSeries(session);
  const actor = session.actor;
  const canUseGlobal = canEditGlobalQuestions(actor);
  const options = series.filter(row => canEditEventSeriesQuestions(actor, row.eventreihe_id))
    .map(row => ({ id: row.eventreihe_id, name: row.name }));
  const requestedSeries = Number((await searchParams).reihe);
  const initialSeries = options.find(option => option.id === requestedSeries)?.id;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-slate-900 md:px-8">
      <nav aria-label="Fragen" className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link className="underline" href="/fragen/editor">Neue Frage</Link>
        <Link className="underline" href="/fragen">Fragensuche</Link>
        {isAdministrator(actor) && <Link className="underline" href="/fragen/import">Bisheriger Dateiimport</Link>}
      </nav>
      <h1 className="mb-2 text-3xl font-bold">Excel-Fragenimport</h1>
      <p className="mb-6 text-slate-600">Offene Fragen, Einfachauswahl und „Paare bilden“ als Entwürfe anlegen.</p>
      <ExcelQuestionImport canUseGlobal={canUseGlobal} series={options} initialSeries={initialSeries} />
    </main>
  );
}
