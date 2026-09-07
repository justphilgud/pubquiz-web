"use server";

import { getQuizAnswerProgress } from "../../interaction/answerProgress.server";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { assertLifecycleRevision, resolveQuizLifecycle } from "../../quizLifecycle";
import { lockQuizLifecycle, requireQuizNotStopped, RESET_PRESENTATION_DATA } from "../../quizLifecycle.server";
import { getQuizPraesentation } from "../../actions";
import { buildPraesentationSlides, getPresentationSlideKey } from "./buildPraesentationSlides";
import {
  requireQuizLiveController,
  requireQuizQuestion,
  requireQuizQuestionSection,
  requireQuizViewer,
} from "../../quizAccess.server";
import { parsePresentationSlideKey } from "@/app/rendering/presentation/presentationLiveState";
import {
  closeBlockInteractions,
  closeCurrentInteraction,
  syncInteractionForPresentation,
} from "@/app/quiz/interaction/interaction.server";
import { getEffectiveQuizSolutionStrategy } from "@/app/quiz/flow/quizFlow";
import {
  parseQuizBlockPreviewSectionId,
  resolveQuizBlockPreviewTransition,
} from "@/app/quiz/quizBlockLiveState";
import {
  logLivePerformance,
  withPrismaQueryDiagnostics,
} from "@/app/lib/prismaQueryDiagnostics.server";
import { mapTeamProfile } from "@/app/teams/teamProfile";
import { loadYearlyRanking } from "@/app/quiz/yearlyRanking.server";
import { resolveIntermediateStandingsAudience } from "@/app/rendering/presentation/presentationRankingPolicy";

export async function getOrCreatePraesentationStatus(quizId: number) {
  await requireQuizLiveController(quizId);
  return prisma.$transaction(async (tx) => {
    return lockQuizLifecycle(tx, quizId);
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
      select: {
        quiz_team_session_id: true,
        teamname: true,
        team: { select: { team_id: true, avatar_code: true, foto_url: true, foto_upload_gesperrt: true } },
      },
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
      teamId: session.team.team_id,
      teamname: session.teamname,
      avatarCode: mapTeamProfile(session.team).avatarCode,
      photoUrl: session.team.foto_url,
      punkte:
        totalsBySession.get(session.quiz_team_session_id) ??
        new Prisma.Decimal(0),
    }))
    .sort((left, right) => right.punkte.cmp(left.punkte))
    .map((entry) => ({
      teamId: entry.teamId,
      teamname: entry.teamname,
      avatarCode: entry.avatarCode,
      photoUrl: entry.photoUrl,
      punkte: Number(entry.punkte),
    }));
}

export async function getPraesentationAudienceZwischenstand(quizId: number) {
  await requireQuizViewer(quizId);
  const [sessions, totals] = await Promise.all([
    prisma.quiz_team_sessions.findMany({
      where: { quiz_id: quizId },
      select: { quiz_team_session_id: true },
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
      Number(entry._sum.vergebene_punkte ?? new Prisma.Decimal(0)),
    ]),
  );

  return resolveIntermediateStandingsAudience(
    sessions.map((session) => ({
      punkte: totalsBySession.get(session.quiz_team_session_id) ?? 0,
    })),
  );
}

export async function getPraesentationJahreswertung(quizId: number) {
  await requireQuizViewer(quizId);
  return loadYearlyRanking(quizId);
}

export async function setPraesentationSlideIndex(
  quizId: number,
  slideIndex: number,
  slideKey: string,
  expectedLifecycleRevision?: number,
) {
  const navigationRequestedAt = new Date();
  const requestStartedAt = performance.now();
  const phases: Record<string, number> = {};
  const { result, diagnostics } = await withPrismaQueryDiagnostics(async () => {
    let phaseStartedAt = performance.now();
    await requireQuizLiveController(quizId);
    phases.access = performance.now() - phaseStartedAt;
    const quiz = await getQuizPraesentation(quizId);
    if (!quiz) throw new Error("Quiz nicht gefunden.");
    const slides = buildPraesentationSlides(quiz);
    if (!Number.isSafeInteger(slideIndex) || !slides[slideIndex] ||
        getPresentationSlideKey(slides[slideIndex]) !== slideKey) {
      throw new Error("Ungültige Präsentationsposition.");
    }
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
    const previousStatus = await requireQuizNotStopped(tx, quizId);
    if (expectedLifecycleRevision !== undefined) {
      assertLifecycleRevision(previousStatus.lifecycle_revision, expectedLifecycleRevision);
    }
    if (previousStatus.slide_key === slideKey) return previousStatus;
    if (slideIndex < previousStatus.slide_index) {
      const followingQuestionIds = slides.slice(slideIndex + 1).flatMap((slide) =>
        slide.typ === "frage" ? [slide.frage.quiz_fragen_id] : [],
      );
      await tx.quiz_interaction_runs.updateMany({
        where: { quiz_id: quizId, quiz_fragen_id: { in: followingQuestionIds } },
        data: { is_hidden: true, revision: { increment: 1 } },
      });
    }
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
        await tx.quiz_block_freigaben.updateMany({
          where: { quiz_id: quizId, quiz_abschnitt_id: { not: previewSectionId } },
          data: { ist_freigegeben: false },
        });
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
    if (
      identity?.kind === "QUESTION" &&
      (identity.phase === "SOLUTION" || identity.phase === "FUNNY") &&
      question?.quiz_abschnitt_id
    ) {
      const strategySource = await tx.quiz.findUniqueOrThrow({
        where: { quiz_id: quizId },
        select: {
          aufloesungsstrategie: true,
          quiz_abschnitte: {
            where: { quiz_abschnitt_id: question.quiz_abschnitt_id },
            select: { aufloesungsstrategie: true },
          },
        },
      });
      if (
        getEffectiveQuizSolutionStrategy(
          strategySource.aufloesungsstrategie,
          strategySource.quiz_abschnitte[0]?.aufloesungsstrategie,
        ) === "END_OF_BLOCK"
      ) {
        await closeBlockInteractions(
          tx,
          quizId,
          question.quiz_abschnitt_id,
          "BLOCK_SOLUTION_REVEALED",
        );
      }
    }
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
  return getQuizAnswerProgress(quizId, quizFragenId);
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
export async function starteQuiz(quizId: number, expectedRevision: number) {
  await requireQuizLiveController(quizId);
  return prisma.$transaction(async (tx) => {
    const status = await requireQuizNotStopped(tx, quizId);
    assertLifecycleRevision(status.lifecycle_revision, expectedRevision);
    if (resolveQuizLifecycle(status) === "RUNNING") return status;
    return tx.quiz_praesentation_status.update({
      where: { quiz_id: quizId },
      data: { quiz_started_at: new Date() },
    });
  });
}

export async function stoppeQuiz(quizId: number, expectedRevision: number) {
  await requireQuizLiveController(quizId);
  return prisma.$transaction(async (tx) => {
    const status = await lockQuizLifecycle(tx, quizId);
    assertLifecycleRevision(status.lifecycle_revision, expectedRevision);
    if (resolveQuizLifecycle(status) === "STOPPED") return status;
    const sections = await tx.quiz_abschnitte.findMany({ where: { quiz_id: quizId } });
    for (const section of sections) {
      await closeBlockInteractions(tx, quizId, section.quiz_abschnitt_id, "QUIZ_STOPPED");
    }
    await closeCurrentInteraction(tx, quizId, "QUIZ_STOPPED");
    await tx.quiz_block_freigaben.updateMany({
      where: { quiz_id: quizId },
      data: { ist_freigegeben: false, ist_geschlossen: true, geschlossen_ab: new Date(), aktuelle_quiz_fragen_id: null },
    });
    return tx.quiz_praesentation_status.update({
      where: { quiz_id: quizId },
      data: { quiz_stopped_at: new Date(), countdown_status: "finished", countdown_ended_at: new Date(), audio_aktion: "stop", audio_aktion_id: { increment: 1 } },
    });
  }, { timeout: 30_000 });
}

export async function resetQuizDurchlauf(quizId: number, expectedRevision: number, confirmed: boolean) {
  await requireQuizLiveController(quizId);
  if (confirmed !== true) throw new Error("Bitte das Zurücksetzen bestätigen.");
  return prisma.$transaction(async (tx) => {
    const status = await lockQuizLifecycle(tx, quizId);
    assertLifecycleRevision(status.lifecycle_revision, expectedRevision);
    // Session cascades remove drafts, field values, choices and submission snapshots.
    await tx.quiz_team_sessions.deleteMany({ where: { quiz_id: quizId } });
    await tx.quiz_interaction_runs.deleteMany({ where: { quiz_id: quizId } });
    await tx.quiz_block_freigaben.deleteMany({ where: { quiz_id: quizId } });
    await tx.quiz_teams.deleteMany({ where: { quiz_id: quizId } });
    await tx.quiz.update({ where: { quiz_id: quizId }, data: { team_anzahl: 0, teilnehmer_anzahl: 0, manuelle_bewertungen: 0 } });
    return tx.quiz_praesentation_status.update({
      where: { quiz_id: quizId },
      data: { ...RESET_PRESENTATION_DATA, slide_started_at: new Date(), audio_aktion_id: { increment: 1 }, lifecycle_revision: { increment: 1 } },
    });
  }, { timeout: 30_000 });
}

export async function setQuizQuestionHidden(quizId: number, quizFragenId: number, hidden: boolean, expectedRevision: number) {
  await requireQuizLiveController(quizId);
  await requireQuizQuestion(quizId, quizFragenId);
  return prisma.$transaction(async (tx) => {
    const status = await requireQuizNotStopped(tx, quizId);
    assertLifecycleRevision(status.lifecycle_revision, expectedRevision);
    const run = await tx.quiz_interaction_runs.findFirst({
      where: { quiz_id: quizId, quiz_fragen_id: quizFragenId },
      orderBy: { interaction_run_id: "desc" },
    });
    if (!run) throw new Error("Diese Frage wurde noch nicht geöffnet.");
    await tx.quiz_interaction_runs.update({
      where: { interaction_run_id: run.interaction_run_id },
      data: { is_hidden: hidden, revision: { increment: 1 } },
    });
    // Visibility changes must invalidate participant snapshots even for a noncurrent run.
    await tx.quiz_praesentation_status.update({ where: { quiz_id: quizId }, data: { updated_at: new Date() } });
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
async function mutatePresentationStatus(quizId: number, expectedRevision: number | undefined, args: Prisma.quiz_praesentation_statusUpdateArgs) {
  return prisma.$transaction(async (tx) => {
    const status = await requireQuizNotStopped(tx, quizId);
    if (expectedRevision !== undefined) assertLifecycleRevision(status.lifecycle_revision, expectedRevision);
    return tx.quiz_praesentation_status.update(args);
  });
}

export async function setMediumOverlayAktiv(data: {
  quizId: number;
  lifecycleRevision?: number;
  aktiv: boolean;
}) {
  await requireQuizLiveController(data.quizId);
  await mutatePresentationStatus(data.quizId, data.lifecycleRevision, {
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
  lifecycleRevision?: number;
  aktion: "play" | "pause" | "stop";
}) {
  await requireQuizLiveController(data.quizId);
  await mutatePresentationStatus(data.quizId, data.lifecycleRevision, {
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
  lifecycleRevision?: number;
  dauerSekunden: number;
}) {
  await requireQuizLiveController(data.quizId);
  await mutatePresentationStatus(data.quizId, data.lifecycleRevision, {
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

export async function resetCountdown(data: { quizId: number; lifecycleRevision?: number }) {
  await requireQuizLiveController(data.quizId);
  await mutatePresentationStatus(data.quizId, data.lifecycleRevision, {
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

export async function beendeCountdown(data: { quizId: number; lifecycleRevision?: number }) {
  await requireQuizLiveController(data.quizId);
  await mutatePresentationStatus(data.quizId, data.lifecycleRevision, {
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
  lifecycleRevision?: number;
  revealCount: number;
}) {
  await requireQuizLiveController(data.quizId);
  await mutatePresentationStatus(data.quizId, data.lifecycleRevision, {
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
  lifecycleRevision?: number;
  showSchaetzfrage: boolean;
  zeigeSchaetzantwort?: boolean;
  schaetzfrageId?: number | null;
}) {
  await requireQuizLiveController(data.quizId);
  await mutatePresentationStatus(data.quizId, data.lifecycleRevision, {
    where: { quiz_id: data.quizId },
    data: {
      show_schaetzfrage: data.showSchaetzfrage,
      zeige_schaetzantwort: data.zeigeSchaetzantwort ?? false,
      schaetzfrage_id: data.schaetzfrageId ?? null,
    },
  });

  return { success: true };
}
