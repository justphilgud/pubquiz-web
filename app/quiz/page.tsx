import type { Metadata } from "next";
import QuizWorkspace from "./QuizWorkspace";
import { getQuizListe, getSchnellQuizKategorien } from "./actions";
import { requireSession } from "@/app/lib/permissions";
import { getEventSeriesOptions } from "@/app/eventreihen/actions";
import { resolveInitialEventSeriesId } from "./quizMasterData";
import { loadRenderingMessages } from "@/app/i18n/renderingMessages";
import { getDefaultLocale } from "@/app/i18n/locale";
import AppHeader from "@/app/components/AppHeader";

type Props = {
  searchParams: Promise<{
    tab?: string;
    eventreiheId?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Alle Quizze | ungegoogelt",
};

export default async function QuizPage({ searchParams }: Props) {
  await requireSession();

  const resolvedSearchParams = await searchParams;
  const [quizze, kategorien, eventSeries] = await Promise.all([
    getQuizListe(),
    getSchnellQuizKategorien(),
    getEventSeriesOptions(true),
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
    /></>
  );
}
