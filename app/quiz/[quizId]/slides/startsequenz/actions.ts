"use server";

import { redirect } from "next/navigation";
import { updateIntroStartsequenz } from "@/app/quiz/actions";

const STANDARD_AUDIO_URL = "/medien/audio/intro/mexico.mp3";

export async function saveStartsequenz(formData: FormData) {
  const quizId = Number(formData.get("quizId"));
  const submitAction = String(formData.get("submitAction") ?? "close");

  const introMusikUrl =
    formData.get("currentIntroMusikUrl")?.toString().trim() ?? "";

  const text = String(formData.get("text") ?? "");

  await updateIntroStartsequenz({
    quizId,
    audioUrl: introMusikUrl || STANDARD_AUDIO_URL,
    text,
  });

  if (submitAction === "close") {
    redirect(`/quiz/${quizId}`);
  }

  redirect(`/quiz/${quizId}/slides/startsequenz`);
}
