import { notFound } from "next/navigation";
import { getQuizDetails } from "@/app/quiz/actions";
import { IntroSlideStartsequenz } from "../../slides/startsequenz/IntroSlideStartsequenz";

type Props = {
  params: Promise<{ quizId: string }>;
};

export default async function ShowStartsequenzPage({
  params,
}: Props) {
  const resolvedParams = await params;

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));

  if (!quiz) {
    notFound();
  }

  const audioUrl =
    quiz.intro_musik_url || "/medien/audio/intro/mexico.mp3";

  return (
    <IntroSlideStartsequenz
      quizId={quiz.quiz_id}
      audioUrl={audioUrl}
    />
  );
}
