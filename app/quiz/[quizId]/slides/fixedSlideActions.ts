"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireQuizEditor } from "@/app/quiz/quizAccess.server";
import {
  FIXED_SLIDE_FLOW_TYPES,
  isIntroSlideId,
  isOutroSlideId,
  serializePrizeSlots,
} from "@/app/quiz/fixedSlidesPolicy";
import { materializeDefaultQuizFlow } from "@/app/quiz/flow/quizFlowRepository.server";

export type FixedSlideActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function saveSlideVisibility(
  quizId: number,
  slideId: keyof typeof FIXED_SLIDE_FLOW_TYPES,
  enabled: boolean,
) {
  const flow = await materializeDefaultQuizFlow(quizId);
  const item = flow.find(
    (candidate) =>
      candidate.isStandard &&
      candidate.type === FIXED_SLIDE_FLOW_TYPES[slideId],
  );
  if (!item?.persistentId) return;
  await prisma.quiz_ablauf_elemente.update({
    where: { quiz_ablauf_element_id: item.persistentId },
    data: { ist_sichtbar: enabled },
  });
}

export async function saveIntroSlide(
  _previousState: FixedSlideActionState,
  formData: FormData,
): Promise<FixedSlideActionState> {
  try {
    const quizId = Number(formData.get("quizId"));
    const slideIdValue = String(formData.get("slideId") ?? "");

    if (!Number.isInteger(quizId) || !isIntroSlideId(slideIdValue)) {
      return { status: "error", message: "Ungültige Slide-Daten." };
    }

    await requireQuizEditor(quizId);

    switch (slideIdValue) {
      case "waiting":
        await prisma.quiz.update({
          where: { quiz_id: quizId },
          data: {
            intro_video_url: text(formData, "introVideoUrl") || null,
            intro_startzeit: text(formData, "startzeit") || "19:30",
            intro_wartetext: text(formData, "wartetext") || null,
          },
        });
        break;
      case "countdown":
        await prisma.quiz.update({
          where: { quiz_id: quizId },
          data: {
            intro_musik_url: text(formData, "introMusikUrl") || null,
            intro_startsequenz_text: text(formData, "countdownText") || null,
          },
        });
        break;
      case "welcome":
        await prisma.quiz.update({
          where: { quiz_id: quizId },
          data: {
            intro_begruessungstitel: text(formData, "titel") || null,
            intro_begruessungstext: text(formData, "begruessung") || null,
          },
        });
        break;
      case "rules":
        await prisma.quiz.update({
          where: { quiz_id: quizId },
          data: { intro_regeln: text(formData, "regeln") || null },
        });
        break;
      case "prizes": {
        const preise = serializePrizeSlots([
          text(formData, "platz1"),
          text(formData, "platz2"),
          text(formData, "platz3"),
        ]);
        await prisma.quiz.update({
          where: { quiz_id: quizId },
          data: { intro_preise: preise || null },
        });
        break;
      }
    }

    await saveSlideVisibility(
      quizId,
      slideIdValue,
      formData.get("enabled") === "on",
    );

    revalidatePath(`/quiz/${quizId}`);
    revalidatePath(`/quiz/${quizId}/slides/intro`);
    return { status: "success", message: "Änderungen wurden gespeichert." };
  } catch {
    return {
      status: "error",
      message: "Speichern fehlgeschlagen. Bitte versuche es erneut.",
    };
  }
}

export async function saveOutroSlide(
  _previousState: FixedSlideActionState,
  formData: FormData,
): Promise<FixedSlideActionState> {
  try {
    const quizId = Number(formData.get("quizId"));
    const slideIdValue = String(formData.get("slideId") ?? "");

    if (!Number.isInteger(quizId) || !isOutroSlideId(slideIdValue)) {
      return { status: "error", message: "Ungültige Quiz-ID." };
    }

    await requireQuizEditor(quizId);
    if (slideIdValue === "announcements") {
      await prisma.quiz.update({
        where: { quiz_id: quizId },
        data: {
          outro_bekanntmachungen:
            text(formData, "bekanntmachungen") || null,
          outro_musik_url: text(formData, "outroMusikUrl") || null,
        },
      });
    }
    await saveSlideVisibility(
      quizId,
      slideIdValue,
      formData.get("enabled") === "on",
    );

    revalidatePath(`/quiz/${quizId}`);
    revalidatePath(`/quiz/${quizId}/slides/outro`);
    return { status: "success", message: "Änderungen wurden gespeichert." };
  } catch {
    return {
      status: "error",
      message: "Speichern fehlgeschlagen. Bitte versuche es erneut.",
    };
  }
}
