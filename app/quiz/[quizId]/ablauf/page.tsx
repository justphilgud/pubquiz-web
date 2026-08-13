import { redirect } from "next/navigation";

type Props = { params: Promise<{ quizId: string }> };

export default async function QuizAblaufPage({ params }: Props) {
  const { quizId } = await params;
  redirect(`/quiz/${quizId}`);
}
