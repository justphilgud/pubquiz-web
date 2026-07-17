import { notFound } from "next/navigation";
import { getQuizDetails } from "@/app/quiz/actions";
import { IntroSlideAnkommen } from "../../slides/vor-dem-start/IntroSlideAnkommen";
import { ShowNavigation } from "../ShowNavigation";

type Props = {
  params: Promise<{
    quizId: string;
  }>;
};

export default async function ShowVorDemStartPage({
  params,
}: Props) {
  const resolvedParams = await params;

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));

  if (!quiz) {
    notFound();
  }

  const qrCodePfad = `/medien/bilder/qr_codes/${quiz.quiz_id}.png`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {quiz.intro_video_url && (
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={quiz.intro_video_url} type="video/mp4" />
        </video>
      )}

      <div className="relative z-10">
        <IntroSlideAnkommen
          quizId={quiz.quiz_id}
          startzeit={quiz.intro_startzeit ?? "19:30"}
          videoUrl={quiz.intro_video_url ?? null}
        />

        <ShowNavigation
          href={`/quiz/${quiz.quiz_id}/show/startsequenz`}
        />
      </div>
    </div>
  );
}
