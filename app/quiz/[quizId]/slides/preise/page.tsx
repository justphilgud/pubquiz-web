import { redirect } from "next/navigation";

export default async function PreisePage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  redirect(`/quiz/${quizId}/slides/intro?slide=prizes`);
}
