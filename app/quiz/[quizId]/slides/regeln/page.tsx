import { redirect } from "next/navigation";

export default async function RegelnPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  redirect(`/quiz/${quizId}/slides/intro?slide=rules`);
}
