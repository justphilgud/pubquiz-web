"use server";

import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import {
  buildMediaUploadPathname,
  getBlobUploadAuthentication,
} from "@/app/fragen/editor/mediaUploadEnvironment";
import { requireQuizEditor } from "@/app/quiz/quizAccess.server";

export async function saveVorDemStart(formData: FormData) {
  const quizId = Number(formData.get("quizId"));
  await requireQuizEditor(quizId);
  const submitAction = formData.get("submitAction")?.toString() ?? "stay";

  const startzeit = formData.get("startzeit")?.toString() ?? "19:30";

  const videoFile = formData.get("introVideoFile");

  let introVideoUrl =
    formData.get("currentIntroVideoUrl")?.toString() ?? "";

  if (videoFile instanceof File && videoFile.size > 0) {
    const originalName = videoFile.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9._-]/g, "");

    const blobPath = buildMediaUploadPathname("media", [
      "video",
      "intro",
      `${quizId}-${Date.now()}-${originalName}`,
    ]);
    const blobAuthentication = getBlobUploadAuthentication();

    const blob = await put(blobPath, videoFile, {
      ...blobAuthentication,
      access: "public",
      addRandomSuffix: false,
    });

    introVideoUrl = blob.url;
  }

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
    redirect(`/quiz/${quizId}`);
  }

  redirect(`/quiz/${quizId}/slides/vor-dem-start`);
}
