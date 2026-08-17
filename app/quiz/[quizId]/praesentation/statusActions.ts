"use server";

import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import {
  requireQuizLiveController,
  requireQuizQuestion,
  requireQuizQuestionSection,
  requireQuizViewer,
} from "../../quizAccess.server";
import { parsePresentationSlideKey } from "@/app/rendering/presentation/presentationLiveState";
import { syncInteractionForPresentation } from "@/app/quiz/interaction/interaction.server";
import {
  parseQuizBlockPreviewSectionId,
  resolveQuizBlockPreviewTransition,
} from "@/app/quiz/quizBlockLiveState";
import {
  logLivePerformance,
  withPrismaQueryDiagnostics,
} from "@/app/lib/prismaQueryDiagnostics.server";

export async function getOrCreatePraesentationStatus(quizId: number) {
  await requireQuizLiveController(quizId);
  return prisma.$transaction(async (tx) => {
    const status = await tx.quiz_praesentation_status.upsert({
      where: { quiz_id: quizId },
      update: {},
      create: {
        quiz_id: quizId,
        slide_index: 0,
        slide_started_at: new Date(),
      },
    });
    if (status.slide_key) {
      await syncInteractionForPresentation(tx, {
        quizId,
        slideKey: status.slide_key,
      });
    }
    return status;
  });
}

export async function getPraesentationStatus(quizId: number) {
  await requireQuizViewer(quizId);
  return prisma.quiz_praesentation_status.findUnique({
    where: { quiz_id: quizId },
  });
}

export async function getPraesentationPunktestand(quizId: number) {
  await requireQuizViewer(quizId);
  const [sessions, totals] = await Promise.all([
    prisma.quiz_team_sessions.findMany({
      where: { quiz_id: quizId },
      select: { quiz_team_session_id: true, teamname: true },
    }),
    prisma.team_antworten.groupBy({
      by: ["quiz_team_session_id"],
      where: { quiz_id: quizId },
      _sum: { vergebene_punkte: true },
    }),
  ]);
  const totalsBySession = new Map(
    totals.map((entry) => [
      entry.quiz_team_session_id,
      entry._sum.vergebene_punkte ?? new Prisma.Decimal(0),
    ]),
  );

  return sessions
    .map((session) => ({
      teamname: session.teamname,
      punkte:
        totalsBySession.get(session.quiz_team_session_id) ??
        new Prisma.Decimal(0),
    }))
    .sort((left, right) => right.punkte.cmp(left.punkte))
    .map((entry) => ({
      teamname: entry.teamname,
      punkte: Number(entry.punkte),
    }));
}

export async function setPraesentationSlideIndex(
  quizId: number,
  slideIndex: number,
  slideKey: string,
) {
  const navigationRequestedAt = new Date();
  const requestStartedAt = performance.now();
  const phases: Record<string, number> = {};
  const { result, diagnostics } = await withPrismaQueryDiagnostics(async () => {
    let phaseStartedAt = performance.now();
    await requireQuizLiveController(quizId);
    phases.access = performance.now() - phaseStartedAt;
    const identity = parsePresentationSlideKey(slideKey);
    const previewSectionId = parseQuizBlockPreviewSectionId(slideKey);
    phaseStartedAt = performance.now();
    const question = identity?.kind === "QUESTION"
      ? await requireQuizQuestion(quizId, identity.questionAssignmentId)
      : null;
    if (previewSectionId !== null) {
      await requireQuizQuestionSection(quizId, previewSectionId);
    }
    phases.validation = performance.now() - phaseStartedAt;

    return prisma.$transaction(async (tx) => {
    phaseStartedAt = performance.now();
    const previousStatus = await tx.quiz_praesentation_status.findUnique({
      where: { quiz_id: quizId },
      select: { slide_key: true },
    });
    const status = await tx.quiz_praesentation_status.upsert({
      where: { quiz_id: quizId },
      update: {
        slide_index: slideIndex,
        slide_key: slideKey,
        slide_started_at: new Date(),
        endstand_reveal_count: 1,
        medium_overlay_aktiv: false,
        audio_aktion: "stop",
        audio_aktion_id: { increment: 1 },
        countdown_dauer_sekunden: null,
        countdown_started_at: null,
        countdown_ended_at: null,
        countdown_status: "idle",
      },
      create: {
        quiz_id: quizId,
        slide_index: slideIndex,
        slide_key: slideKey,
        slide_started_at: new Date(),
        endstand_reveal_count: 1,
        medium_overlay_aktiv: false,
        audio_aktion: "stop",
        audio_aktion_id: 1,
        countdown_status: "idle",
      },
    });
    phases.presentationMutation = performance.now() - phaseStartedAt;

    phaseStartedAt = performance.now();
    if (previewSectionId !== null) {
      const releaseWhere = {
        quiz_id_quiz_abschnitt_id: {
          quiz_id: quizId,
          quiz_abschnitt_id: previewSectionId,
        },
      };
      const release = await tx.quiz_block_freigaben.findUnique({
        where: releaseWhere,
        select: {
          ist_freigegeben: true,
          ist_geschlossen: true,
          geschlossen_ab: true,
        },
      });
      const transition = resolveQuizBlockPreviewTransition({
        previousSlideKey: previousStatus?.slide_key ?? null,
        nextSlideKey: slideKey,
        navigationRequestedAt,
        release,
      });
      if (transition === "OPEN") {
        await tx.quiz_block_freigaben.upsert({
          where: releaseWhere,
          update: {
            ist_freigegeben: true,
            ist_geschlossen: false,
            freigegeben_ab: navigationRequestedAt,
            geschlossen_ab: null,
            aktuelle_quiz_fragen_id: null,
          },
          create: {
            quiz_id: quizId,
            quiz_abschnitt_id: previewSectionId,
            ist_freigegeben: true,
            ist_geschlossen: false,
            freigegeben_ab: navigationRequestedAt,
            aktuelle_quiz_fragen_id: null,
          },
        });
      } else if (transition === "KEEP_OPEN") {
        await tx.quiz_block_freigaben.update({
          where: releaseWhere,
          data: { aktuelle_quiz_fragen_id: null },
        });
      }
    } else if (
      identity?.kind === "QUESTION" &&
      identity.phase === "QUESTION" &&
      question?.quiz_abschnitt_id
    ) {
      await tx.quiz_block_freigaben.upsert({
        where: {
          quiz_id_quiz_abschnitt_id: {
            quiz_id: quizId,
            quiz_abschnitt_id: question.quiz_abschnitt_id,
          },
        },
        update: { aktuelle_quiz_fragen_id: question.quiz_fragen_id },
        create: {
          quiz_id: quizId,
          quiz_abschnitt_id: question.quiz_abschnitt_id,
          aktuelle_quiz_fragen_id: question.quiz_fragen_id,
        },
      });
    }
    phases.blockMutation = performance.now() - phaseStartedAt;

    phaseStartedAt = performance.now();
    await syncInteractionForPresentation(tx, { quizId, slideKey });
    phases.interactionMutation = performance.now() - phaseStartedAt;

    return status;
  });
  });
  logLivePerformance("moderator-slide-mutation", {
    ...phases,
    queryCount: diagnostics?.queryCount ?? null,
    queryDurationMs: diagnostics?.queryDurationMs ?? null,
    total: performance.now() - requestStartedAt,
  });
  return result;
}
async function getAntwortStatusData(
  quizId: number,
  quizFragenId: number | null,
) {
  await requireQuizLiveController(quizId);
  if (quizFragenId !== null) {
    await requireQuizQuestion(quizId, quizFragenId);
  }
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

  const currentRun = await prisma.quiz_interaction_runs.findFirst({
    where: { quiz_id: quizId, quiz_fragen_id: quizFragenId, is_current: true },
    select: { interaction_run_id: true },
  });
  let antwortenEingegangen: number;
  let letzteAntwortAt: Date | null;
  if (currentRun) {
    const [submittedTeams, last] = await Promise.all([
        prisma.team_answer_submissions.findMany({
          where: { interaction_run_id: currentRun.interaction_run_id },
          distinct: ["quiz_team_session_id"],
          select: { quiz_team_session_id: true },
        }),
        prisma.team_answer_submissions.findFirst({
          where: { interaction_run_id: currentRun.interaction_run_id },
          orderBy: { submitted_at: "desc" },
          select: { submitted_at: true },
        }),
      ]);
    antwortenEingegangen = submittedTeams.length;
    letzteAntwortAt = last?.submitted_at ?? null;
  } else {
    const [count, last] = await Promise.all([
        prisma.team_antworten.count({
          where: { quiz_id: quizId, quiz_fragen_id: quizFragenId },
        }),
        prisma.team_antworten.findFirst({
          where: { quiz_id: quizId, quiz_fragen_id: quizFragenId },
          orderBy: { aktualisiert_am: "desc" },
          select: { aktualisiert_am: true },
        }),
      ]);
    antwortenEingegangen = count;
    letzteAntwortAt = last?.aktualisiert_am ?? null;
  }

  return {
    teamsAngemeldet,
    antwortenEingegangen,
    prozent:
      teamsAngemeldet > 0
        ? Math.round((antwortenEingegangen / teamsAngemeldet) * 100)
        : 0,
    letzteAntwortAt,
  };
}

export async function getAntwortStatus(
  quizId: number,
  quizFragenId: number | null,
) {
  const requestStartedAt = performance.now();
  const { result, diagnostics } = await withPrismaQueryDiagnostics(() =>
    getAntwortStatusData(quizId, quizFragenId)
  );
  logLivePerformance("moderator-answer-status", {
    queryCount: diagnostics?.queryCount ?? null,
    queryDurationMs: diagnostics?.queryDurationMs ?? null,
    total: performance.now() - requestStartedAt,
  });
  return result;
}
export async function starteQuiz(quizId: number) {
  await requireQuizLiveController(quizId);
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
  quizId: number;
  quizFragenId: number;
  dauerSekunden: number;
}) {
  const requestStartedAt = performance.now();
  const phases: Record<string, number> = {};
  const { result, diagnostics } = await withPrismaQueryDiagnostics(async () => {
    let phaseStartedAt = performance.now();
    await requireQuizLiveController(data.quizId);
    phases.access = performance.now() - phaseStartedAt;
    phaseStartedAt = performance.now();
    await requireQuizQuestion(data.quizId, data.quizFragenId);
    phases.validation = performance.now() - phaseStartedAt;
    if (!Number.isFinite(data.dauerSekunden) || data.dauerSekunden <= 0) {
      return { success: false };
    }

    phaseStartedAt = performance.now();
    const frage = await prisma.quiz_fragen.findUnique({
      where: {
        quiz_fragen_id: data.quizFragenId,
      },
      select: {
        praesentationsdauer_sekunden: true,
        praesentationsdauer_messungen: true,
      },
    });
    phases.durationRead = performance.now() - phaseStartedAt;

    const bisherigerDurchschnitt = frage?.praesentationsdauer_sekunden ?? 0;
    const bisherigeMessungen = frage?.praesentationsdauer_messungen ?? 0;
    const neuerDurchschnitt = Math.round(
      (bisherigerDurchschnitt * bisherigeMessungen + data.dauerSekunden) /
        (bisherigeMessungen + 1),
    );

    phaseStartedAt = performance.now();
    await prisma.quiz_fragen.update({
      where: {
        quiz_fragen_id: data.quizFragenId,
      },
      data: {
        praesentationsdauer_sekunden: neuerDurchschnitt,
        praesentationsdauer_messungen: bisherigeMessungen + 1,
      },
    });
    phases.durationWrite = performance.now() - phaseStartedAt;
    return { success: true };
  });
  logLivePerformance("moderator-duration-write", {
    ...phases,
    queryCount: diagnostics?.queryCount ?? null,
    queryDurationMs: diagnostics?.queryDurationMs ?? null,
    total: performance.now() - requestStartedAt,
  });
  return result;
}
export async function setMediumOverlayAktiv(data: {
  quizId: number;
  aktiv: boolean;
}) {
  await requireQuizLiveController(data.quizId);
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
  await requireQuizLiveController(data.quizId);
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
  await requireQuizLiveController(data.quizId);
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

export async function resetCountdown(data: { quizId: number }) {
  await requireQuizLiveController(data.quizId);
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

export async function beendeCountdown(data: { quizId: number }) {
  await requireQuizLiveController(data.quizId);
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
export async function setEndstandRevealCount(data: {
  quizId: number;
  revealCount: number;
}) {
  await requireQuizLiveController(data.quizId);
  await prisma.quiz_praesentation_status.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      endstand_reveal_count: data.revealCount,
    },
  });

  return { success: true };
}
export async function setSchaetzfrageStatus(data: {
  quizId: number;
  showSchaetzfrage: boolean;
  zeigeSchaetzantwort?: boolean;
  schaetzfrageId?: number | null;
}) {
  await requireQuizLiveController(data.quizId);
  await prisma.quiz_praesentation_status.update({
    where: { quiz_id: data.quizId },
    data: {
      show_schaetzfrage: data.showSchaetzfrage,
      zeige_schaetzantwort: data.zeigeSchaetzantwort ?? false,
      schaetzfrage_id: data.schaetzfrageId ?? null,
    },
  });

  return { success: true };
}
