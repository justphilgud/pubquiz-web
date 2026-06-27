import QuizWorkspace from "./QuizWorkspace";
import { getQuizListe, getSchnellQuizKategorien } from "./actions";
import { requireAdmin } from "@/app/lib/permissions";

type Props = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

export default async function QuizPage({ searchParams }: Props) {
  await requireAdmin();

  const resolvedSearchParams = await searchParams;
  const _tab = resolvedSearchParams.tab;

  const quizze = await getQuizListe();
  const kategorien = await getSchnellQuizKategorien();

  return <QuizWorkspace quizze={quizze} kategorien={kategorien} passwort="" />;
}
