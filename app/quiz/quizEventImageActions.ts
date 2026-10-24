"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireQuizEditor } from "./quizAccess.server";
import { verifyEventImage } from "@/app/eventreihen/eventSeriesLogoValidation.server";
import { isAllowedQuizEventImagePath } from "./quizEventImage";

export async function saveQuizEventImage(id: number, url: string | null, expectedUrl: string | null) {
  if (!Number.isSafeInteger(id) || id <= 0 ||
    (url !== null && (typeof url !== "string" || url.length > 2048)) ||
    (expectedUrl !== null && (typeof expectedUrl !== "string" || expectedUrl.length > 2048))) {
    return { ok: false, message: "Ungültige Bildangaben." };
  }
  await requireQuizEditor(id);
  try {
    if (url !== null) await verifyEventImage(url, (path, prefix) => isAllowedQuizEventImagePath(path, prefix, id));
    const result = await prisma.quiz.updateMany({
      where: { quiz_id: id, ist_archiviert: false, veranstaltungsbild_url: expectedUrl },
      data: { veranstaltungsbild_url: url },
    });
    if (result.count !== 1) return { ok: false, message: "Das Bild wurde inzwischen geändert. Bitte Seite neu laden." };
    revalidatePath("/quiz");
    return { ok: true, message: url ? "Veranstaltungsbild gespeichert." : "Eigenes Bild entfernt. Das Reihenlogo wird übernommen." };
  } catch {
    return { ok: false, message: "Bild konnte nicht gespeichert werden. Bitte Dateityp, Größe und Upload prüfen." };
  }
}
