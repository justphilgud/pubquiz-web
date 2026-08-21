import { notFound } from "next/navigation";
import { getQuizAntwortStatus } from "../../actions";
import QuizAntwortClient from "./QuizAntwortClient";
import { resolveQuizTemplates } from "@/app/rendering/resolveQuizTemplates.server";
import { getCalendarRequestOrigin } from "@/app/calendar/calendarOrigin.server";
import { buildPublicCalendarSubscriptionUrl } from "@/app/calendar/publicCalendar";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function QuizAntwortPage({ params }: Props) {
  const resolvedParams = await params;
  const quizId = Number(resolvedParams.quizId);

  if (Number.isNaN(quizId)) {
    notFound();
  }

  const [daten, templates, calendarOrigin] = await Promise.all([
    getQuizAntwortStatus(quizId),
    resolveQuizTemplates(quizId),
    getCalendarRequestOrigin(),
  ]);

  if (!daten || !templates) {
    notFound();
  }

  return (
    <QuizAntwortClient
      daten={daten}
      theme={templates.theme}
      calendarSubscriptionUrl={buildPublicCalendarSubscriptionUrl(calendarOrigin)}
    />
  );
}
