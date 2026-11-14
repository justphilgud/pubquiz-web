import "server-only";
import { revalidatePath } from "next/cache";

export function revalidateQuizPlanning(quizId: number) {
  revalidatePath(`/quiz/${quizId}`);
  revalidatePath("/quiz");
  revalidatePath("/workspaces/[seriesId]/[eventType]/[[...area]]", "page");
}
