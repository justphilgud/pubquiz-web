import { isAdmin, requireActor } from "@/app/lib/permissions";
import { getEventSeriesList } from "@/app/eventreihen/actions";
import { EventSeriesManager } from "./EventSeriesManager";
import { loadRenderingMessages } from "@/app/i18n/renderingMessages";
import { getDefaultLocale } from "@/app/i18n/locale";
import { listAssignablePresentationTemplates } from "@/app/rendering/presentationTemplates/presentationTemplateRepository.server";

export default async function EventSeriesPage() {
  const { actor } = await requireActor();
  const [series, presentationTemplates] = await Promise.all([
    getEventSeriesList(),
    listAssignablePresentationTemplates(),
  ]);
  const messages = loadRenderingMessages(getDefaultLocale());
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="text-3xl font-bold">Eventreihen</h1><p className="mt-2 text-slate-600">Dauerhafte organisatorische Rahmen für konkrete Quiztermine.</p></div>
        </header>
        <EventSeriesManager series={series} canCreate={isAdmin(actor)} messages={messages} presentationTemplates={presentationTemplates} canAssignPresentationTemplates={isAdmin(actor)} />
      </div>
    </main>
  );
}
