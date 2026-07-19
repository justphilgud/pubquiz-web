"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { redirect } from "next/navigation";
import { updateIntroVorDemStart } from "@/app/quiz/actions";
import { requireQuizEditor } from "@/app/quiz/quizAccess.server";

export async function saveVorDemStart(formData: FormData) {
  const quizId = Number(formData.get("quizId"));
  await requireQuizEditor(quizId);
  const currentMusikUrl = String(formData.get("currentMusikUrl") ?? "");
  const submitAction = String(formData.get("submitAction") ?? "close");

  const qrCodeFile = formData.get("qrCodeFile");

  if (qrCodeFile instanceof File && qrCodeFile.size > 0) {
    if (qrCodeFile.size > 5 * 1024 * 1024) {
      throw new Error("Die Datei darf maximal 5 MB groß sein.");
    }

    if (!qrCodeFile.name.toLowerCase().endsWith(".png")) {
      throw new Error("Es sind nur PNG-Dateien erlaubt.");
    }

    const bytes = await qrCodeFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "medien",
      "bilder",
      "qr_codes"
    );

    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, `${quizId}.png`);

    await writeFile(filePath, buffer);
  }

  await updateIntroVorDemStart({
    quizId,
    logoUrl: String(formData.get("logoUrl") ?? ""),
    musikUrl: currentMusikUrl,
    wartetext: String(formData.get("wartetext") ?? ""),
    startzeit: String(formData.get("startzeit") ?? ""),
  });

  if (submitAction === "stay") {
    redirect(`/quiz/${quizId}/slides/vor-dem-start`);
  }

  redirect(`/quiz/${quizId}`);
}
