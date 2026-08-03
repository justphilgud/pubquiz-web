import type { Metadata } from "next";
import QuizWorkspace from "./QuizWorkspace";
import { getQuizListe, getSchnellQuizKategorien } from "./actions";
import { isAdmin, requireActor } from "@/app/lib/permissions";
import { getEventSeriesOptions } from "@/app/eventreihen/actions";
import { resolveInitialEventSeriesId } from "./quizMasterData";
import { loadRenderingMessages } from "@/app/i18n/renderingMessages";
import { getDefaultLocale } from "@/app/i18n/locale";
import AppHeader from "@/app/components/AppHeader";
import { listAssignablePresentationTemplates } from "@/app/rendering/presentationTemplates/presentationTemplateRepository.server";

type Props = {
  searchParams: Promise<{
    tab?: string;
    eventreiheId?: string;
    editQuizId?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Alle Quizze | ungegoogelt",
};

export default async function QuizPage({ searchParams }: Props) {
  const { actor } = await requireActor();

  const resolvedSearchParams = await searchParams;
  const [quizze, kategorien, eventSeries, presentationTemplates] = await Promise.all([
    getQuizListe(),
    getSchnellQuizKategorien(),
    getEventSeriesOptions(true),
    listAssignablePresentationTemplates(),
  ]);
  const initialEventSeriesId = resolveInitialEventSeriesId(
    resolvedSearchParams.eventreiheId,
    eventSeries,
  );
  const renderingMessages = loadRenderingMessages(getDefaultLocale());

  return (
    <><AppHeader /><QuizWorkspace
      quizze={quizze}
      kategorien={kategorien}
      eventSeries={eventSeries}
      initialEventSeriesId={initialEventSeriesId}
      renderingMessages={renderingMessages}
      presentationTemplates={presentationTemplates}
      canAssignPresentationTemplates={isAdmin(actor)}
      initialEditingQuizId={
        resolvedSearchParams.editQuizId && /^\d+$/.test(resolvedSearchParams.editQuizId)
          ? Number(resolvedSearchParams.editQuizId)
          : undefined
      }
    /></>
  );
}
