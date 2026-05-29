"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function saveVorDemStart(formData: FormData) {
  const quizId = Number(formData.get("quizId"));
  const passwort = formData.get("passwort")?.toString() ?? "";
  const submitAction = formData.get("submitAction")?.toString() ?? "stay";

  const introVideoUrl = formData.get("introVideoUrl")?.toString() ?? "";
  const startzeit = formData.get("startzeit")?.toString() ?? "19:30";

  await prisma.quiz.update({
    where: {
      quiz_id: quizId,
    },
    data: {
      intro_video_url:
        introVideoUrl.trim() === "" ? null : introVideoUrl.trim(),
      intro_startzeit: startzeit.trim() === "" ? "19:30" : startzeit.trim(),
    },
  });

  if (submitAction === "close") {
    redirect(`/quiz/${quizId}?passwort=${encodeURIComponent(passwort)}`);
  }

  redirect(
    `/quiz/${quizId}/slides/vor-dem-start?passwort=${encodeURIComponent(
      passwort
    )}`
  );
}