import { getBlobEnvironmentPrefix } from "@/config/environment";
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
  workspaceSeriesId?: number;
  hideHeader?: boolean;
  searchParams: Promise<{
    tab?: string;
    eventreiheId?: string;
    editQuizId?: string;
  }>;
};

export default async function QuizPage({ searchParams, workspaceSeriesId, hideHeader }: Props) {
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
    <>{!hideHeader && <AppHeader />}<QuizWorkspace workspaceSeriesId={workspaceSeriesId} key={workspaceSeriesId ?? "cross-series"}
      workspaceSeriesName={workspaceSeriesId === undefined ? undefined : eventSeries.find(series => series.id === workspaceSeriesId)?.name}
      environmentPrefix={getBlobEnvironmentPrefix()}
      quizze={quizze.filter(quiz => workspaceSeriesId === undefined || quiz.eventreihe_id === workspaceSeriesId)}
      kategorien={kategorien}
      eventSeries={eventSeries.filter(series => workspaceSeriesId === undefined || series.id === workspaceSeriesId)}
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
