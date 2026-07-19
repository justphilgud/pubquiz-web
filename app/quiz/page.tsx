import QuizWorkspace from "./QuizWorkspace";
import { getQuizListe, getSchnellQuizKategorien } from "./actions";
import { requireAdmin } from "@/app/lib/permissions";
import { getEventSeriesOptions } from "@/app/eventreihen/actions";

type Props = {
  searchParams: Promise<{
    tab?: string;
    eventreiheId?: string;
  }>;
};

export default async function QuizPage({ searchParams }: Props) {
  await requireAdmin();

  const resolvedSearchParams = await searchParams;
  const [quizze, kategorien, eventSeries] = await Promise.all([
    getQuizListe(),
    getSchnellQuizKategorien(),
    getEventSeriesOptions(true),
  ]);
  const requestedEventSeriesId = Number(resolvedSearchParams.eventreiheId);
  const initialEventSeriesId = eventSeries.some(
    (entry) => entry.id === requestedEventSeriesId && !entry.isArchived,
  )
    ? requestedEventSeriesId
    : undefined;

  return (
    <QuizWorkspace
      quizze={quizze}
      kategorien={kategorien}
      eventSeries={eventSeries}
      initialEventSeriesId={initialEventSeriesId}
    />
  );
}
