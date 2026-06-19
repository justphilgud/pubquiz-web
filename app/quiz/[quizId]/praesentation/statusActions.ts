"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getOrCreatePraesentationStatus(quizId: number) {
  return prisma.quiz_praesentation_status.upsert({
    where: { quiz_id: quizId },
    update: {},
    create: {
      quiz_id: quizId,
      slide_index: 0,
      slide_started_at: new Date(),
    },
  });
}

export async function getPraesentationStatus(quizId: number) {
  return prisma.quiz_praesentation_status.findUnique({
    where: { quiz_id: quizId },
  });
}

export async function setPraesentationSlideIndex(
  quizId: number,
  slideIndex: number
) {
  const status = await prisma.quiz_praesentation_status.upsert({
    where: { quiz_id: quizId },
    update: {
      slide_index: slideIndex,
      slide_started_at: new Date(),
    },
    create: {
      quiz_id: quizId,
      slide_index: slideIndex,
      slide_started_at: new Date(),
    },
  });

  revalidatePath(`/quiz/${quizId}/praesentation`);
  revalidatePath(`/quiz/${quizId}/moderation`);

  return status;
}
export async function getAntwortStatus(
  quizId: number,
  quizFragenId: number | null
) {
  const teamsAngemeldet = await prisma.quiz_team_sessions.count({
    where: {
      quiz_id: quizId,
    },
  });

  if (!quizFragenId) {
    return {
      teamsAngemeldet,
      antwortenEingegangen: 0,
      prozent: 0,
      letzteAntwortAt: null,
    };
  }

  const antwortenEingegangen = await prisma.team_antworten.count({
    where: {
      quiz_id: quizId,
      quiz_fragen_id: quizFragenId,
    },
  });

  const letzteAntwort = await prisma.team_antworten.findFirst({
    where: {
      quiz_id: quizId,
      quiz_fragen_id: quizFragenId,
    },
    orderBy: {
      aktualisiert_am: "desc",
    },
    select: {
      aktualisiert_am: true,
    },
  });

  return {
    teamsAngemeldet,
    antwortenEingegangen,
    prozent:
      teamsAngemeldet > 0
        ? Math.round((antwortenEingegangen / teamsAngemeldet) * 100)
        : 0,
    letzteAntwortAt: letzteAntwort?.aktualisiert_am ?? null,
  };
}
export async function starteQuiz(quizId: number) {
  return prisma.quiz_praesentation_status.upsert({
    where: { quiz_id: quizId },
    update: {
      quiz_started_at: new Date(),
    },
    create: {
      quiz_id: quizId,
      slide_index: 0,
      slide_started_at: new Date(),
      quiz_started_at: new Date(),
    },
  });
}
export async function speicherePraesentationsdauer(data: {
  quizFragenId: number;
  dauerSekunden: number;
}) {
  if (!Number.isFinite(data.dauerSekunden) || data.dauerSekunden <= 0) {
    return { success: false };
  }

  const frage = await prisma.quiz_fragen.findUnique({
    where: {
      quiz_fragen_id: data.quizFragenId,
    },
    select: {
      praesentationsdauer_sekunden: true,
      praesentationsdauer_messungen: true,
    },
  });

  const bisherigerDurchschnitt =
    frage?.praesentationsdauer_sekunden ?? 0;

  const bisherigeMessungen =
    frage?.praesentationsdauer_messungen ?? 0;

  const neuerDurchschnitt = Math.round(
    (
      bisherigerDurchschnitt * bisherigeMessungen +
      data.dauerSekunden
    ) /
    (bisherigeMessungen + 1)
  );

  await prisma.quiz_fragen.update({
    where: {
      quiz_fragen_id: data.quizFragenId,
    },
    data: {
      praesentationsdauer_sekunden: neuerDurchschnitt,
      praesentationsdauer_messungen: bisherigeMessungen + 1,
    },
  });

  return { success: true };
}
export async function setMediumOverlayAktiv(data: {
  quizId: number;
  aktiv: boolean;
}) {
  await prisma.quiz_praesentation_status.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      medium_overlay_aktiv: data.aktiv,
    },
  });

  return { success: true };
}

export async function setAudioAktion(data: {
  quizId: number;
  aktion: "play" | "pause" | "stop";
}) {
  await prisma.quiz_praesentation_status.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      audio_aktion: data.aktion,
      audio_aktion_id: {
        increment: 1,
      },
    },
  });

  return { success: true };
}
export async function starteCountdown(data: {
  quizId: number;
  dauerSekunden: number;
}) {
  await prisma.quiz_praesentation_status.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      countdown_dauer_sekunden: data.dauerSekunden,
      countdown_started_at: new Date(),
      countdown_ended_at: null,
      countdown_status: "running",
    },
  });

  return { success: true };
}

export async function resetCountdown(data: {
  quizId: number;
}) {
  await prisma.quiz_praesentation_status.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      countdown_started_at: null,
      countdown_ended_at: null,
      countdown_status: "idle",
    },
  });

  return { success: true };
}

export async function beendeCountdown(data: {
  quizId: number;
}) {
  await prisma.quiz_praesentation_status.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      countdown_ended_at: new Date(),
      countdown_status: "finished",
    },
  });

  return { success: true };
}