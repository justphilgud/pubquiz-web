import type { Metadata } from "next";
import QuizWorkspace from "./QuizWorkspace";
import { getQuizListe, getSchnellQuizKategorien } from "./actions";
import { requireAdmin } from "@/app/lib/permissions";
import { getEventSeriesOptions } from "@/app/eventreihen/actions";
import { resolveInitialEventSeriesId } from "./quizMasterData";

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
  await requireAdmin();

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

  return (
    <QuizWorkspace
      quizze={quizze}
      kategorien={kategorien}
      eventSeries={eventSeries}
      initialEventSeriesId={initialEventSeriesId}
    />
  );
}
