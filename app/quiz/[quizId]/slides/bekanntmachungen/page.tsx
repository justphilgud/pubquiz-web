import { redirect } from "next/navigation";

export default async function BekanntmachungenPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  redirect(`/quiz/${quizId}/slides/outro`);
}
