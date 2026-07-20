import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/app/lib/permissions";
import { getEventSeriesDetails } from "@/app/eventreihen/actions";
import { getEventSeriesMembershipOptions } from "@/app/eventreihen/membershipActions";
import { EventSeriesMembershipManager } from "@/app/eventreihen/EventSeriesMembershipManager";
import { loadRenderingMessages } from "@/app/i18n/renderingMessages";
import { getDefaultLocale } from "@/app/i18n/locale";
import { getAnswerFormTemplate, getPresentationTemplate } from "@/app/rendering/templateRegistry";

const statusLabels = {
  UPCOMING: "Bevorstehend",
  TODAY: "Heute",
  PAST: "Vergangen",
  ARCHIVED: "Archiviert",
  MISSING_DATE: "Datum fehlt",
} as const;

export default async function EventSeriesDetailPage({
  params,
}: {
  params: Promise<{ eventSeriesId: string }>;
}) {
  const session = await requireSession();
  const { eventSeriesId } = await params;
  const series = await getEventSeriesDetails(Number(eventSeriesId));
  if (!series) notFound();
  const membershipData = session.user?.role === "ADMIN"
    ? await getEventSeriesMembershipOptions()
    : null;
  const messages = loadRenderingMessages(getDefaultLocale());

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link href="/admin/eventreihen" className="text-sm font-semibold underline">← Eventreihen</Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div><h1 className="break-words text-3xl font-bold">{series.name}</h1><p className="mt-1 break-all text-slate-500">/{series.slug}</p></div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold ring-1 ring-slate-200">{series.isArchived ? "Archiviert" : "Aktiv"}</span>
          </div>
        </header>
        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 md:p-6">
          <div><h2 className="font-semibold">Öffentlicher Name</h2><p className="mt-1 break-words text-slate-600">{series.publicName ?? "–"}</p></div>
          <div><h2 className="font-semibold">Sichtbarkeit</h2><p className="mt-1 text-slate-600">{series.isPublic ? "Öffentlich vorbereitet" : messages.fields.internalOnly}</p></div>
          <div><h2 className="font-semibold">{messages.fields.defaultPresentation}</h2><p className="mt-1 text-slate-600">{messages.templates[getPresentationTemplate(series.defaultPresentationTemplateId)?.labelKey ?? "presentationDefault"].label}</p></div>
          <div><h2 className="font-semibold">{messages.fields.defaultAnswerForm}</h2><p className="mt-1 text-slate-600">{messages.templates[getAnswerFormTemplate(series.defaultAnswerFormTemplateId)?.labelKey ?? "answerDefault"].label}</p></div>
          <div className="sm:col-span-2"><h2 className="font-semibold">Beschreibung</h2><p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{series.description ?? "–"}</p></div>
          <div className="sm:col-span-2"><h2 className="font-semibold">Interne Bemerkung</h2><p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{series.internalNote ?? "–"}</p></div>
        </section>
        {membershipData && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-bold">Berechtigte Benutzer</h2>
            <p className="mt-1 text-sm text-slate-600">Eventmanager und Editoren dieser Eventreihe verwalten.</p>
            <div className="mt-5"><EventSeriesMembershipManager data={membershipData} fixedEventSeriesId={series.id} /></div>
          </section>
        )}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-bold">Quizze</h2><p className="mt-1 text-sm text-slate-500">{series.quizCount} Termine in dieser Eventreihe.</p></div>
            {series.canManageQuizzes && !series.isArchived && <Link href={`/quiz?eventreiheId=${series.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white">Neues Quiz anlegen</Link>}
          </div>
          <div className="mt-5 grid gap-3">
            {series.quizzes.map((quiz) => (
              <article key={quiz.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><Link href={`/quiz/${quiz.id}`} className="break-words font-bold underline">{quiz.title}</Link><p className="mt-1 text-sm text-slate-600">{quiz.date ?? "Datum fehlt"}{quiz.venueName ? ` · ${quiz.venueName}` : ""}</p></div>
                <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold sm:self-auto">{statusLabels[quiz.status]}</span>
              </article>
            ))}
          </div>
          {series.quizzes.length === 0 && <p className="mt-5 text-sm text-slate-500">Noch keine Quizze vorhanden.</p>}
        </section>
      </div>
    </main>
  );
}
