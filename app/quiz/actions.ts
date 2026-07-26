"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireSession } from "@/app/lib/permissions";
import {
  getEventSeriesIdsForCapability,
  requireEventSeriesAccess,
} from "@/app/eventreihen/eventSeriesAccess.server";
import { addQuestionToQuiz } from "@/app/services/quizService";
import { getBerlinDate } from "@/app/lib/berlinDate";

import { TEAM_PASSWORT_WOERTER } from "@/app/lib/teamPasswortWoerter";
import {
  requireQuizAdmin,
  requireQuizEditor,
  requireQuizLiveController,
  requireQuizQuestion,
  requireQuizQuestionInSection,
  requireQuizSection,
  requireQuizTeamAnswer,
  requireQuizViewer,
} from "./quizAccess.server";
import {
  issueTeamSessionToken,
  verifyTeamSessionToken,
} from "./teamSessionToken";
import { getTeamSessionSigningSecret } from "./teamSessionSecret.server";
import { assertTeamAnswerAuthorized } from "./teamAnswerPolicy";
import { buildDefaultQuizSections, buildQuickQuizSections } from "./quizStructure";
import {
  isQuestionSection,
  OUTRO_SECTION_TYPE,
} from "./quizSectionPolicy";
import { resolveQuizQuestionAnswerMode } from "./quizQuestionAnswerMode";
import { buildQuestionEligibilityWhere } from "@/app/fragen/editor/questionEligibility.server";
import { requireQuestionAccess } from "@/app/fragen/editor/questionAccess.server";
import {
  buildQuizCopyMasterData,
  getQuizTemporalStatus,
  validateQuizMasterData,
  type QuizTemporalStatus,
} from "./quizMasterData";
import {
  recalculateQuizEvaluation,
  recalculateQuizQuestionEvaluation,
} from "./evaluation/evaluation.server";
import {
  isPartialPointsCapable,
  validateQuestionPointsMode,
} from "./evaluation/questionPointPolicy";
import { questionTemplateIds, resolveCanonicalQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import type { QuestionTemplateConfig } from "@/app/fragen/editor/types";

export type QuizResult = {
  quiz_id: number;
  eventreihe_id: number;
  eventreihe_name: string;
  eventreihe_archiviert: boolean;
  titel: string | null;
  quiz_datum: string | null;
  veranstaltungszeit: string | null;
  veranstaltungsname: string | null;
  karten_url: string | null;
  oeffentliche_url: string | null;
  temporal_status: QuizTemporalStatus;
  team_anzahl: number | null;
  teilnehmer_anzahl: number | null;
  bemerkung: string | null;
  ist_archiviert: boolean;
  archivierungsgrund: string | null;
  fragen_anzahl: number;
  presentation_template_id: string | null;
  answer_form_template_id: string | null;
};

async function getEventSeriesForQuizSave(
  eventSeriesId: number,
  options?: { allowArchivedId?: number },
) {
  const eventSeries = await prisma.eventreihen.findUnique({
    where: { eventreihe_id: eventSeriesId },
    select: { eventreihe_id: true, ist_archiviert: true },
  });
  if (!eventSeries) return { ok: false as const, message: "Eventreihe wurde nicht gefunden." };
  if (
    eventSeries.ist_archiviert &&
    eventSeries.eventreihe_id !== options?.allowArchivedId
  ) {
    return { ok: false as const, message: "Archivierte Eventreihen können nicht ausgewählt werden." };
  }
  return { ok: true as const, eventSeries };
}

function sortQuizResults(quizze: QuizResult[]) {
  const rank: Record<QuizTemporalStatus, number> = {
    TODAY: 0,
    UPCOMING: 1,
    PAST: 2,
    MISSING_DATE: 3,
    ARCHIVED: 4,
  };
  return quizze.sort((a, b) => {
    const statusDifference = rank[a.temporal_status] - rank[b.temporal_status];
    if (statusDifference !== 0) return statusDifference;
    if (a.temporal_status === "UPCOMING" || a.temporal_status === "TODAY") {
      return (a.quiz_datum ?? "").localeCompare(b.quiz_datum ?? "");
    }
    if (a.temporal_status === "PAST") {
      return (b.quiz_datum ?? "").localeCompare(a.quiz_datum ?? "");
    }
    return b.quiz_id - a.quiz_id;
  });
}

export type QuizDetailsResult = QuizResult & {
  intro_begruessungstitel: string | null;
  intro_begruessungstext: string | null;
  intro_regeln: string | null;
  intro_preise: string | null;
  intro_startzeit: string | null;
  intro_startsequenz_text: string | null;
  intro_logo_url: string | null;
  intro_musik_url: string | null;
  intro_wartetext: string | null;
  intro_video_url: string | null;
  outro_bekanntmachungen: string | null;

  abschnitte: {
    quiz_abschnitt_id: number;
    titel: string;
    abschnitt_typ: string;
    sortierung: number;
    dauer_sekunden: number | null;
    qr_code_url: string | null;
    medien_datei: string | null;
    bemerkung: string | null;
  }[];
  fragen: {
    quiz_fragen_id: number;
    sortierung: number | null;
    fragen_id: number;
    frage: string;
    quiz_abschnitt_id: number | null;
    schwierigkeitslevel: string | null;
    praesentationslayout: string | null;
    punkte_basis: number;
    punkte_modus: string;
    freie_antwort_erlaubt: boolean;
    kann_freie_antwort_aktivieren: boolean;
    effektiver_antwortmodus: "OPEN" | "CLOSED" | "UNCLASSIFIED";
    vorlagenname: string;
    templateId: string | null;
    teilpunkte_faehig: boolean;
    kategorien: string[];
  }[];
};

export async function getQuizListe(): Promise<QuizResult[]> {
  const manageableIds = await getEventSeriesIdsForCapability("MANAGE_QUIZZES");
  const quizze = await prisma.quiz.findMany({
    where: manageableIds === null ? undefined : { eventreihe_id: { in: manageableIds } },
    orderBy: {
      quiz_datum: "desc",
    },
    include: {
      eventreihe: true,
      _count: {
        select: {
          quiz_fragen: true,
        },
      },
    },
  });

  return sortQuizResults(quizze.map((quiz) => ({
    quiz_id: quiz.quiz_id,
    eventreihe_id: quiz.eventreihe_id,
    eventreihe_name: quiz.eventreihe.name,
    eventreihe_archiviert: quiz.eventreihe.ist_archiviert,
    titel: quiz.titel,
    quiz_datum: quiz.quiz_datum
      ? quiz.quiz_datum.toISOString().split("T")[0]
      : null,
    veranstaltungszeit: quiz.veranstaltungszeit,
    veranstaltungsname: quiz.veranstaltungsname,
    karten_url: quiz.karten_url,
    oeffentliche_url: quiz.oeffentliche_url,
    temporal_status: getQuizTemporalStatus(quiz.quiz_datum, quiz.ist_archiviert),
    team_anzahl: quiz.team_anzahl,
    teilnehmer_anzahl: quiz.teilnehmer_anzahl,
    bemerkung: quiz.bemerkung,
    ist_archiviert: quiz.ist_archiviert,
    archivierungsgrund: quiz.archivierungsgrund,
    fragen_anzahl: quiz._count.quiz_fragen,
    presentation_template_id: quiz.presentation_template_id,
    answer_form_template_id: quiz.answer_form_template_id,
  })));
}

export async function getAktiveQuizListe(): Promise<QuizResult[]> {
  const manageableIds = await getEventSeriesIdsForCapability("MANAGE_QUIZZES");
  const quizze = await prisma.quiz.findMany({
    where: {
      ist_archiviert: false,
      ...(manageableIds === null ? {} : { eventreihe_id: { in: manageableIds } }),
    },
    orderBy: {
      quiz_datum: "desc",
    },
    include: {
      eventreihe: true,
      _count: {
        select: {
          quiz_fragen: true,
        },
      },
    },
  });

  return quizze.map((quiz) => ({
    quiz_id: quiz.quiz_id,
    eventreihe_id: quiz.eventreihe_id,
    eventreihe_name: quiz.eventreihe.name,
    eventreihe_archiviert: quiz.eventreihe.ist_archiviert,
    titel: quiz.titel,
    quiz_datum: quiz.quiz_datum
      ? quiz.quiz_datum.toISOString().split("T")[0]
      : null,
    veranstaltungszeit: quiz.veranstaltungszeit,
    veranstaltungsname: quiz.veranstaltungsname,
    karten_url: quiz.karten_url,
    oeffentliche_url: quiz.oeffentliche_url,
    temporal_status: getQuizTemporalStatus(quiz.quiz_datum, quiz.ist_archiviert),
    team_anzahl: quiz.team_anzahl,
    teilnehmer_anzahl: quiz.teilnehmer_anzahl,
    bemerkung: quiz.bemerkung,
    ist_archiviert: quiz.ist_archiviert,
    archivierungsgrund: quiz.archivierungsgrund,
    fragen_anzahl: 0,
    presentation_template_id: quiz.presentation_template_id,
    answer_form_template_id: quiz.answer_form_template_id,
  }));
}

export async function createQuiz(data: {
  eventSeriesId: number;
  titel: string;
  quizDatum: string;
  veranstaltungszeit?: string;
  veranstaltungsname?: string;
  kartenUrl?: string;
  oeffentlicheUrl?: string;
  bemerkung: string;
  presentationTemplateId?: string | null;
  answerFormTemplateId?: string | null;
}) {
  const validated = validateQuizMasterData({
    eventSeriesId: data.eventSeriesId,
    title: data.titel,
    date: data.quizDatum,
    time: data.veranstaltungszeit,
    venueName: data.veranstaltungsname,
    mapUrl: data.kartenUrl,
    publicUrl: data.oeffentlicheUrl,
    internalNote: data.bemerkung,
    presentationTemplateId: data.presentationTemplateId,
    answerFormTemplateId: data.answerFormTemplateId,
  });
  if (!validated.ok) return { success: false, message: validated.message, errors: validated.errors };
  await requireEventSeriesAccess(validated.value.eventSeriesId, "MANAGE_QUIZZES");
  const eventSeries = await getEventSeriesForQuizSave(validated.value.eventSeriesId);
  if (!eventSeries.ok) return { success: false, message: eventSeries.message };

  const quiz = await prisma.quiz.create({
    data: {
      eventreihe_id: validated.value.eventSeriesId,
      titel: validated.value.title,
      quiz_datum: validated.value.dateValue,
      veranstaltungszeit: validated.value.time,
      veranstaltungsname: validated.value.venueName,
      karten_url: validated.value.mapUrl,
      oeffentliche_url: validated.value.publicUrl,
      team_anzahl: 0,
      teilnehmer_anzahl: 0,
      bemerkung: validated.value.internalNote,
      presentation_template_id: validated.value.presentationTemplateId,
      answer_form_template_id: validated.value.answerFormTemplateId,
    },
  });

  await createDefaultQuizAbschnitte(quiz.quiz_id);

  revalidatePath("/quiz");

  return {
    success: true,
    message: "Quiz wurde angelegt.",
    quizId: quiz.quiz_id,
  };
}

export async function updateQuiz(data: {
  quizId: number;
  eventSeriesId: number;
  titel: string;
  quizDatum: string;
  veranstaltungszeit?: string;
  veranstaltungsname?: string;
  kartenUrl?: string;
  oeffentlicheUrl?: string;
  bemerkung: string;
  presentationTemplateId?: string | null;
  answerFormTemplateId?: string | null;
}) {
  await requireQuizEditor(data.quizId);
  const existing = await prisma.quiz.findUnique({
    where: { quiz_id: data.quizId },
    select: { eventreihe_id: true },
  });
  if (!existing) return { success: false, message: "Quiz nicht gefunden." };
  const validated = validateQuizMasterData({
    eventSeriesId: data.eventSeriesId,
    title: data.titel,
    date: data.quizDatum,
    time: data.veranstaltungszeit,
    venueName: data.veranstaltungsname,
    mapUrl: data.kartenUrl,
    publicUrl: data.oeffentlicheUrl,
    internalNote: data.bemerkung,
    presentationTemplateId: data.presentationTemplateId,
    answerFormTemplateId: data.answerFormTemplateId,
  });
  if (!validated.ok) return { success: false, message: validated.message, errors: validated.errors };
  await requireEventSeriesAccess(validated.value.eventSeriesId, "MANAGE_QUIZZES");
  const eventSeries = await getEventSeriesForQuizSave(validated.value.eventSeriesId, {
    allowArchivedId: existing.eventreihe_id,
  });
  if (!eventSeries.ok) return { success: false, message: eventSeries.message };

  await prisma.quiz.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      eventreihe_id: validated.value.eventSeriesId,
      titel: validated.value.title,
      quiz_datum: validated.value.dateValue,
      veranstaltungszeit: validated.value.time,
      veranstaltungsname: validated.value.venueName,
      karten_url: validated.value.mapUrl,
      oeffentliche_url: validated.value.publicUrl,
      bemerkung: validated.value.internalNote,
      presentation_template_id: validated.value.presentationTemplateId,
      answer_form_template_id: validated.value.answerFormTemplateId,
    },
  });

  revalidatePath("/quiz");
  revalidatePath(`/quiz/${data.quizId}`);
  return { success: true, message: "Quiz wurde aktualisiert." };
}

export async function archiveQuiz(data: {
  quizId: number;
  archivierungsgrund: string;
}) {
  await requireQuizAdmin(data.quizId);

  await prisma.quiz.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      ist_archiviert: true,
      archivierungsgrund: data.archivierungsgrund.trim() || null,
    },
  });

  revalidatePath("/quiz");
}

export async function restoreQuiz(quizId: number) {
  await requireQuizAdmin(quizId);

  await prisma.quiz.update({
    where: {
      quiz_id: quizId,
    },
    data: {
      ist_archiviert: false,
      archivierungsgrund: null,
    },
  });

  revalidatePath("/quiz");
}

export async function deleteQuiz(quizId: number) {
  await requireQuizAdmin(quizId);

  const fragenAnzahl = await prisma.quiz_fragen.count({
    where: {
      quiz_id: quizId,
    },
  });

  if (fragenAnzahl > 0) {
    return {
      success: false,
      message:
        "Quiz kann nicht gelöscht werden, weil bereits Fragen zugeordnet sind.",
    };
  }

  await prisma.quiz.delete({
    where: {
      quiz_id: quizId,
    },
  });

  revalidatePath("/quiz");

  return {
    success: true,
    message: "Quiz wurde gelöscht.",
  };
}

export async function copyQuiz(data: {
  quizId: number;
  neuerTitel: string;
  quizDatum: string;
}) {
  const { session } = await requireQuizAdmin(data.quizId);

  const original = await prisma.quiz.findUnique({
    where: {
      quiz_id: data.quizId,
    },
    include: {
      eventreihe: true,
      quiz_abschnitte: {
        orderBy: {
          sortierung: "asc",
        },
      },
      quiz_fragen: {
        orderBy: {
          sortierung: "asc",
        },
      },
    },
  });

  if (!original) {
    return {
      success: false,
      message: "Original-Quiz wurde nicht gefunden.",
    };
  }
  const validated = validateQuizMasterData(
    buildQuizCopyMasterData(
      {
        eventSeriesId: original.eventreihe_id,
        time: original.veranstaltungszeit,
        venueName: original.veranstaltungsname,
        mapUrl: original.karten_url,
        internalNote: original.bemerkung,
        presentationTemplateId: original.presentation_template_id,
        answerFormTemplateId: original.answer_form_template_id,
      },
      { title: data.neuerTitel, date: data.quizDatum },
    ),
  );
  if (!validated.ok) return { success: false, message: validated.message, errors: validated.errors };
  if (original.eventreihe.ist_archiviert) {
    return { success: false, message: "Quizze in archivierten Eventreihen können nicht kopiert werden." };
  }

  const kopie = await prisma.$transaction(async (tx) => {
    const neuesQuiz = await tx.quiz.create({
      data: {
        eventreihe_id: original.eventreihe_id,
        titel: validated.value.title,
        quiz_datum: validated.value.dateValue,
        veranstaltungszeit: validated.value.time,
        veranstaltungsname: validated.value.venueName,
        karten_url: validated.value.mapUrl,
        oeffentliche_url: null,
        team_anzahl: 0,
        teilnehmer_anzahl: 0,
        bemerkung: validated.value.internalNote,
        presentation_template_id: validated.value.presentationTemplateId,
        answer_form_template_id: validated.value.answerFormTemplateId,

        intro_logo_url: original.intro_logo_url,
        intro_musik_url: original.intro_musik_url,
        intro_video_url: original.intro_video_url,
        intro_startzeit: original.intro_startzeit,
        intro_wartetext: original.intro_wartetext,
        intro_begruessungstitel: original.intro_begruessungstitel,
        intro_begruessungstext: original.intro_begruessungstext,
        intro_regeln: original.intro_regeln,
        intro_preise: original.intro_preise,
        intro_startsequenz_text: original.intro_startsequenz_text,
        outro_bekanntmachungen: original.outro_bekanntmachungen,
        ist_archiviert: false,
        archivierungsgrund: null,
      },
    });

    const abschnittIdMap = new Map<number, number>();

    for (const abschnitt of original.quiz_abschnitte) {
      const neuerAbschnitt = await tx.quiz_abschnitte.create({
        data: {
          quiz_id: neuesQuiz.quiz_id,
          titel: abschnitt.titel,
          abschnitt_typ: abschnitt.abschnitt_typ,
          sortierung: abschnitt.sortierung,
          dauer_sekunden: abschnitt.dauer_sekunden,
          qr_code_url: abschnitt.qr_code_url,
          medien_datei: abschnitt.medien_datei,
          bemerkung: abschnitt.bemerkung,
        },
      });

      abschnittIdMap.set(
        abschnitt.quiz_abschnitt_id,
        neuerAbschnitt.quiz_abschnitt_id,
      );
    }

    for (const quizFrage of original.quiz_fragen) {
      await addQuestionToQuiz(
        {
          quiz_id: neuesQuiz.quiz_id,
          fragen_id: quizFrage.fragen_id,
          quiz_abschnitt_id: quizFrage.quiz_abschnitt_id
            ? (abschnittIdMap.get(quizFrage.quiz_abschnitt_id) ?? null)
            : null,
          sortierung: quizFrage.sortierung,
          punkte_modus: quizFrage.punkte_modus,
          praesentationslayout: quizFrage.praesentationslayout,
          antwort_reihenfolge: quizFrage.antwort_reihenfolge,
          freie_antwort_erlaubt: quizFrage.freie_antwort_erlaubt,
        },
        session,
        tx,
      );
    }

    return neuesQuiz;
  });

  revalidatePath("/quiz");

  return {
    success: true,
    message: "Quiz wurde kopiert.",
    quizId: kopie.quiz_id,
  };
}

export async function getQuizDetails(
  quizId: number,
): Promise<QuizDetailsResult | null> {
  await requireQuizViewer(quizId);
  const quiz = await prisma.quiz.findUnique({
    where: {
      quiz_id: quizId,
    },
    include: {
      eventreihe: true,
      quiz_abschnitte: {
        orderBy: {
          sortierung: "asc",
        },
      },
      quiz_fragen: {
        orderBy: {
          sortierung: "asc",
        },
        include: {
          fragen: {
            include: {
              antworten: {
                select: {
                  ist_richtig: true,
                },
              },
              antwortfelder: { select: { antwortfeld_id: true } },
              vorlage: {
                select: {
                  code: true,
                  name: true,
                },
              },
              fragen_kategorien: {
                include: {
                  fragenkategorie: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    return null;
  }

  return {
    quiz_id: quiz.quiz_id,
    eventreihe_id: quiz.eventreihe_id,
    eventreihe_name: quiz.eventreihe.name,
    eventreihe_archiviert: quiz.eventreihe.ist_archiviert,
    titel: quiz.titel,
    quiz_datum: quiz.quiz_datum
      ? quiz.quiz_datum.toISOString().split("T")[0]
      : null,
    veranstaltungszeit: quiz.veranstaltungszeit,
    veranstaltungsname: quiz.veranstaltungsname,
    karten_url: quiz.karten_url,
    oeffentliche_url: quiz.oeffentliche_url,
    temporal_status: getQuizTemporalStatus(quiz.quiz_datum, quiz.ist_archiviert),
    team_anzahl: quiz.team_anzahl,
    teilnehmer_anzahl: quiz.teilnehmer_anzahl,
    bemerkung: quiz.bemerkung,
    ist_archiviert: quiz.ist_archiviert,
    archivierungsgrund: quiz.archivierungsgrund,
    fragen_anzahl: quiz.quiz_fragen.length,
    presentation_template_id: quiz.presentation_template_id,
    answer_form_template_id: quiz.answer_form_template_id,

    intro_begruessungstitel: quiz.intro_begruessungstitel,
    intro_begruessungstext: quiz.intro_begruessungstext,
    intro_regeln: quiz.intro_regeln,
    intro_preise: quiz.intro_preise,
    intro_logo_url: quiz.intro_logo_url,
    intro_musik_url: quiz.intro_musik_url,
    intro_wartetext: quiz.intro_wartetext,
    intro_startsequenz_text: quiz.intro_startsequenz_text,
    intro_startzeit: quiz.intro_startzeit,
    intro_video_url: quiz.intro_video_url,

    outro_bekanntmachungen: quiz.outro_bekanntmachungen,

    abschnitte: quiz.quiz_abschnitte.map((abschnitt) => ({
      quiz_abschnitt_id: abschnitt.quiz_abschnitt_id,
      titel: abschnitt.titel,
      abschnitt_typ: abschnitt.abschnitt_typ,
      sortierung: abschnitt.sortierung,
      dauer_sekunden: abschnitt.dauer_sekunden,
      qr_code_url: abschnitt.qr_code_url,
      medien_datei: abschnitt.medien_datei,
      bemerkung: abschnitt.bemerkung,
    })),
    fragen: quiz.quiz_fragen.map((eintrag) => {
      const answerMode = resolveQuizQuestionAnswerMode({
        templateId: eintrag.fragen.vorlage?.code ?? null,
        answers: eintrag.fragen.antworten.map((antwort) => ({
          isCorrect: antwort.ist_richtig,
        })),
        allowFreeAnswer: eintrag.freie_antwort_erlaubt,
      });
      const config = eintrag.fragen.template_config_json as
        | QuestionTemplateConfig
        | null;
      const partialPointsCapable = isPartialPointsCapable({
        templateId: eintrag.fragen.vorlage?.code ?? null,
        correctAnswerCount: eintrag.fragen.antworten.filter(
          (answer) => answer.ist_richtig,
        ).length,
        structuredFieldCount: eintrag.fragen.antwortfelder.length,
        orderingItemCount:
          config?.templateData?.kind === "ORDERING"
            ? config.templateData.items.length
            : 0,
      });

      return {
        quiz_fragen_id: eintrag.quiz_fragen_id,
        sortierung: eintrag.sortierung,
        quiz_abschnitt_id: eintrag.quiz_abschnitt_id,
        fragen_id: eintrag.fragen.fragen_id,
        frage: eintrag.fragen.frage,
        punkte_basis: Number(eintrag.punkte_basis),
        punkte_modus: eintrag.punkte_modus ?? "standard",
        freie_antwort_erlaubt: eintrag.freie_antwort_erlaubt,
        kann_freie_antwort_aktivieren: answerMode.canEnableFreeAnswer,
        effektiver_antwortmodus: answerMode.effectiveMode,
        vorlagenname: eintrag.fragen.vorlage?.name ?? "Standard",
        templateId: eintrag.fragen.vorlage?.code ?? null,
        teilpunkte_faehig: partialPointsCapable,
        schwierigkeitslevel:
          eintrag.fragen.schwierigkeitslevel?.toString() ?? null,
        praesentationslayout: eintrag.praesentationslayout ?? "standard",
        kategorien: eintrag.fragen.fragen_kategorien.map(
          (k) => k.fragenkategorie.kategorie,
        ),
      };
    }),
  };
}

export type QuizFrageSuchResult = {
  fragen_id: number;
  frage: string;
  quelle: string | null;
  schwierigkeitslevel: string | null;
  kategorien: string[];
  ist_bereits_im_quiz: boolean;
};

export async function searchFragenForQuiz(data: {
  quizId: number;
  suchtext: string;
}): Promise<QuizFrageSuchResult[]> {
  const quizAccess = await requireQuizEditor(data.quizId);
  const eventSeriesId = quizAccess.ownership.eventSeriesId!;
  const fragen = await prisma.fragen.findMany({
    where: {
      ...buildQuestionEligibilityWhere(eventSeriesId, getBerlinDate()),
      frage: data.suchtext.trim()
        ? {
            contains: data.suchtext.trim(),
            mode: "insensitive",
          }
        : undefined,
    },
    orderBy: {
      fragen_id: "desc",
    },
    take: 25,
    include: {
      fragen_kategorien: {
        include: {
          fragenkategorie: true,
        },
      },
      quiz_fragen: {
        where: {
          quiz_id: data.quizId,
        },
      },
    },
  });

  return fragen.map((frage) => ({
    fragen_id: frage.fragen_id,
    frage: frage.frage,
    quelle: frage.quelle,
    schwierigkeitslevel: frage.schwierigkeitslevel?.toString() ?? null,
    kategorien: frage.fragen_kategorien.map((k) => k.fragenkategorie.kategorie),
    ist_bereits_im_quiz: frage.quiz_fragen.length > 0,
  }));
}

export async function addFrageToQuiz(data: {
  quizId: number;
  fragenId: number;
}) {
  const { session } = await requireQuizEditor(data.quizId);

  const letzterEintrag = await prisma.quiz_fragen.findFirst({
    where: {
      quiz_id: data.quizId,
    },
    orderBy: {
      sortierung: "desc",
    },
  });

  const frage = await prisma.fragen.findUnique({
    where: {
      fragen_id: data.fragenId,
    },
    include: {
      antworten: {
        orderBy: {
          antwort_id: "asc",
        },
      },
    },
  });

  if (!frage) {
    throw new Error("Frage nicht gefunden.");
  }

  const antwortIds = frage.antworten.map((antwort) => antwort.antwort_id);

  const gemischteAntwortIds = [...antwortIds].sort(() => Math.random() - 0.5);

  const naechsteSortierung = (letzterEintrag?.sortierung ?? 0) + 1;

  const assignment = await addQuestionToQuiz(
    {
      quiz_id: data.quizId,
      fragen_id: data.fragenId,
      sortierung: naechsteSortierung,
      antwort_reihenfolge: gemischteAntwortIds,
    },
    session,
  );

  revalidatePath(`/quiz/${data.quizId}`);
  revalidatePath("/fragen");
  return { coupledQuestionAlreadyInQuiz: assignment.coupledQuestionAlreadyInQuiz };
}

export async function removeFrageFromQuiz(data: {
  quizId: number;
  quizFragenId: number;
}) {
  await requireQuizEditor(data.quizId);
  await requireQuizQuestion(data.quizId, data.quizFragenId);

  await prisma.quiz_fragen.delete({
    where: {
      quiz_fragen_id: data.quizFragenId,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);
}

export async function moveQuizFrage(data: {
  quizId: number;
  quizFragenId: number;
  direction: "up" | "down";
}) {
  await requireQuizEditor(data.quizId);
  await requireQuizQuestion(data.quizId, data.quizFragenId);

  const aktuelleFrage = await prisma.quiz_fragen.findUnique({
    where: {
      quiz_fragen_id: data.quizFragenId,
    },
  });

  if (!aktuelleFrage || aktuelleFrage.sortierung === null) {
    return;
  }

  const zielSortierung =
    data.direction === "up"
      ? aktuelleFrage.sortierung - 1
      : aktuelleFrage.sortierung + 1;

  if (zielSortierung < 1) {
    return;
  }

  const tauschFrage = await prisma.quiz_fragen.findFirst({
    where: {
      quiz_id: data.quizId,
      sortierung: zielSortierung,
    },
  });

  if (!tauschFrage) {
    return;
  }

  await prisma.$transaction([
    prisma.quiz_fragen.update({
      where: {
        quiz_fragen_id: aktuelleFrage.quiz_fragen_id,
      },
      data: {
        sortierung: -999999,
      },
    }),

    prisma.quiz_fragen.update({
      where: {
        quiz_fragen_id: tauschFrage.quiz_fragen_id,
      },
      data: {
        sortierung: aktuelleFrage.sortierung,
      },
    }),

    prisma.quiz_fragen.update({
      where: {
        quiz_fragen_id: aktuelleFrage.quiz_fragen_id,
      },
      data: {
        sortierung: zielSortierung,
      },
    }),
  ]);

  revalidatePath(`/quiz/${data.quizId}`);
}

export async function updateQuizFragenSortierung(data: {
  quizId: number;
  items: {
    quizFragenId: number;
    sortierung: number;
  }[];
}) {
  await requireQuizEditor(data.quizId);

  await Promise.all(
    data.items.map((item) => requireQuizQuestion(data.quizId, item.quizFragenId)),
  );

  const temporaereBasis = -1000000;

  await prisma.$transaction(
    data.items.map((item, index) =>
      prisma.quiz_fragen.update({
        where: {
          quiz_fragen_id: item.quizFragenId,
        },
        data: {
          sortierung: temporaereBasis - index,
        },
      }),
    ),
  );

  await prisma.$transaction(
    data.items.map((item) =>
      prisma.quiz_fragen.update({
        where: {
          quiz_fragen_id: item.quizFragenId,
        },
        data: {
          sortierung: item.sortierung,
        },
      }),
    ),
  );

  revalidatePath(`/quiz/${data.quizId}`);
}

export type FrageVorschauResult = {
  fragen_id: number;
  frage: string;
  quelle: string | null;
  schwierigkeitslevel: string | null;
  kategorien: string[];
  medien: {
    medien_id: number;
    datei: string;
    medientyp: string;
    sortierung: number;
    bemerkung: string | null;
  }[];
  antworten: {
    antwort_id: number;
    antwort: string;
    ist_richtig: boolean;
    antworttyp: string;
    medien: {
      medien_id: number;
      datei: string;
      medientyp: string;
      sortierung: number;
      bemerkung: string | null;
    }[];
  }[];
};

export async function getFrageVorschau(
  fragenId: number,
): Promise<FrageVorschauResult | null> {
  await requireQuestionAccess(fragenId, "VIEW");
  const frage = await prisma.fragen.findUnique({
    where: {
      fragen_id: fragenId,
    },
    include: {
      fragen_kategorien: {
        include: {
          fragenkategorie: true,
        },
      },
      medien: {
        include: {
          medientyp: true,
        },
        orderBy: {
          sortierung: "asc",
        },
      },
      antworten: {
        include: {
          antworttyp: true,
          medien: {
            include: {
              medientyp: true,
            },
            orderBy: {
              sortierung: "asc",
            },
          },
        },
        orderBy: {
          antwort_id: "asc",
        },
      },
    },
  });

  if (!frage) {
    return null;
  }

  return {
    fragen_id: frage.fragen_id,
    frage: frage.frage,
    quelle: frage.quelle,
    schwierigkeitslevel: frage.schwierigkeitslevel?.toString() ?? null,
    kategorien: frage.fragen_kategorien.map((k) => k.fragenkategorie.kategorie),
    medien: frage.medien.map((medium) => ({
      medien_id: medium.medien_id,
      datei: medium.datei,
      medientyp: medium.medientyp.medientyp,
      sortierung: medium.sortierung,
      bemerkung: medium.bemerkung,
    })),
    antworten: frage.antworten.map((antwort) => ({
      antwort_id: antwort.antwort_id,
      antwort: antwort.antwort,
      ist_richtig: antwort.ist_richtig,
      antworttyp: antwort.antworttyp.antworttyp,
      medien: antwort.medien.map((medium) => ({
        medien_id: medium.medien_id,
        datei: medium.datei,
        medientyp: medium.medientyp.medientyp,
        sortierung: medium.sortierung,
        bemerkung: medium.bemerkung,
      })),
    })),
  };
}
export async function removeFrageFromQuizByFrageId(data: {
  quizId: number;
  fragenId: number;
}) {
  await requireQuizEditor(data.quizId);

  await prisma.quiz_fragen.deleteMany({
    where: {
      quiz_id: data.quizId,
      fragen_id: data.fragenId,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);
  revalidatePath("/fragen");
}
export type QuizPraesentationResult = {
  quiz_id: number;
  intro_begruessungstitel: string | null;
  intro_begruessungstext: string | null;
  intro_regeln: string | null;
  intro_preise: string | null;
  intro_logo_url: string | null;
  intro_musik_url: string | null;
  intro_wartetext: string | null;
  intro_video_url: string | null;
  intro_startzeit: string | null;
  titel: string | null;
  quiz_datum: string | null;

  fragen: {
    quiz_fragen_id: number;
    quiz_abschnitt_id: number | null;
    sortierung: number | null;

    fragen_id: number;
    frage: string;
    templateId: string | null;
    templateConfig: import("@/app/fragen/editor/types").QuestionTemplateConfig | null;

    punkte_modus: string;
    freie_antwort_erlaubt: boolean;
    urspruenglicher_antwortmodus: import("@/app/fragen/questionAnswerMode").DerivedQuestionAnswerMode;
    effektiver_antwortmodus: import("@/app/fragen/questionAnswerMode").DerivedQuestionAnswerMode;

    quelle: string | null;
    kategorien: string[];
    praesentationslayout: string | null;
    antwort_reihenfolge: number[];

    medien: {
      medien_id: number;
      datei: string;
      medientyp: string;
      sortierung: number;
      bemerkung: string | null;
    }[];

    antwortfelder: {
      antwortfeld_id: number;
      label: string;
      sortierung: number;
      ist_pflicht: boolean;
      loesungen: {
        loesung_text: string;
        sortierung: number;
        ist_akzeptiert: boolean;
      }[];
    }[];

    antworten: {
      antwort_id: number;
      antwort: string;
      ist_richtig: boolean;
      antworttyp: string;
      medien: {
        medien_id: number;
        datei: string;
        medientyp: string;
        sortierung: number;
        bemerkung: string | null;
      }[];
    }[];

    bildMedien: {
      medien_id: number;
      datei: string;
      medientyp: string;
    }[];
  }[];

  abschnitte: {
    quiz_abschnitt_id: number;
    titel: string;
    abschnitt_typ: string;
    sortierung: number;
    dauer_sekunden: number | null;
    qr_code_url: string | null;
    medien_datei: string | null;
    bemerkung: string | null;
  }[];
};

export async function getQuizPraesentation(
  quizId: number,
): Promise<QuizPraesentationResult | null> {
  await requireQuizViewer(quizId);
  const quiz = await prisma.quiz.findUnique({
    where: {
      quiz_id: quizId,
    },
    include: {
      quiz_abschnitte: {
        orderBy: {
          sortierung: "asc",
        },
      },

      quiz_fragen: {
        orderBy: {
          sortierung: "asc",
        },
        include: {
          fragen: {
            include: {
              fragen_kategorien: {
                include: {
                  fragenkategorie: true,
                },
              },
              medien: {
                include: {
                  medientyp: true,
                },
                orderBy: {
                  sortierung: "asc",
                },
              },
              antwortfelder: {
                orderBy: {
                  sortierung: "asc",
                },
                include: {
                  medien: {
                    include: {
                      medientyp: true,
                    },
                    orderBy: {
                      sortierung: "asc",
                    },
                  },
                  loesungen: {
                    orderBy: {
                      sortierung: "asc",
                    },
                  },
                },
              },
              antworten: {
                include: {
                  antworttyp: true,
                  medien: {
                    include: {
                      medientyp: true,
                    },
                    orderBy: {
                      sortierung: "asc",
                    },
                  },
                },
                orderBy: {
                  antwort_id: "asc",
                },
              },
              vorlage: { select: { code: true } },
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    return null;
  }

  return {
    quiz_id: quiz.quiz_id,
    intro_begruessungstitel: quiz.intro_begruessungstitel,
    intro_begruessungstext: quiz.intro_begruessungstext,
    intro_regeln: quiz.intro_regeln,
    intro_preise: quiz.intro_preise,
    intro_logo_url: quiz.intro_logo_url,
    intro_musik_url: quiz.intro_musik_url,
    intro_wartetext: quiz.intro_wartetext,
    intro_video_url: quiz.intro_video_url,
    intro_startzeit: quiz.intro_startzeit,
    titel: quiz.titel,
    quiz_datum: quiz.quiz_datum
      ? quiz.quiz_datum.toISOString().split("T")[0]
      : null,
    abschnitte: quiz.quiz_abschnitte.map((abschnitt) => ({
      quiz_abschnitt_id: abschnitt.quiz_abschnitt_id,
      titel: abschnitt.titel,
      abschnitt_typ: abschnitt.abschnitt_typ,
      sortierung: abschnitt.sortierung,
      dauer_sekunden: abschnitt.dauer_sekunden,
      qr_code_url: abschnitt.qr_code_url,
      medien_datei: abschnitt.medien_datei,
      bemerkung: abschnitt.bemerkung,
    })),
    fragen: quiz.quiz_fragen.map((eintrag) => {
      const answerMode = resolveQuizQuestionAnswerMode({
        templateId: eintrag.fragen.vorlage?.code ?? null,
        answers: eintrag.fragen.antworten.map((antwort) => ({
          isCorrect: antwort.ist_richtig,
        })),
        allowFreeAnswer: eintrag.freie_antwort_erlaubt,
      });

      return {
      quiz_fragen_id: eintrag.quiz_fragen_id,
      quiz_abschnitt_id: eintrag.quiz_abschnitt_id,
      sortierung: eintrag.sortierung,

      fragen_id: eintrag.fragen.fragen_id,
      frage: eintrag.fragen.frage,
      templateId: eintrag.fragen.vorlage?.code ?? null,
      templateConfig: eintrag.fragen.template_config_json as
        | import("@/app/fragen/editor/types").QuestionTemplateConfig
        | null,

      punkte_modus: eintrag.punkte_modus ?? "standard",
      freie_antwort_erlaubt: eintrag.freie_antwort_erlaubt,
      urspruenglicher_antwortmodus: answerMode.originalMode,
      effektiver_antwortmodus: answerMode.effectiveMode,

      praesentationslayout: eintrag.praesentationslayout ?? "standard",
      antwort_reihenfolge: eintrag.antwort_reihenfolge,
      quelle: eintrag.fragen.quelle,
      kategorien: eintrag.fragen.fragen_kategorien.map(
        (k) => k.fragenkategorie.kategorie,
      ),
      medien: eintrag.fragen.medien.map((medium) => ({
        medien_id: medium.medien_id,
        datei: medium.datei,
        medientyp: medium.medientyp.medientyp,
        sortierung: medium.sortierung,
        bemerkung: medium.bemerkung,
      })),
      antworten: eintrag.fragen.antworten.map((antwort) => ({
        antwort_id: antwort.antwort_id,
        antwort: antwort.antwort,
        ist_richtig: antwort.ist_richtig,
        antworttyp: antwort.antworttyp.antworttyp,
        medien: antwort.medien.map((medium) => ({
          medien_id: medium.medien_id,
          datei: medium.datei,
          medientyp: medium.medientyp.medientyp,
          sortierung: medium.sortierung,
          bemerkung: medium.bemerkung,
        })),
      })),
      bildMedien: eintrag.fragen.medien
        .filter((medium) =>
          medium.medientyp.medientyp.toLowerCase().includes("bild"),
        )
        .map((medium) => ({
          medien_id: medium.medien_id,
          datei: medium.datei,
          medientyp: medium.medientyp.medientyp,
        })),

      antwortfelder: (eintrag.fragen.antwortfelder ?? []).map((feld) => ({
        antwortfeld_id: feld.antwortfeld_id,
        label: feld.label,
        sortierung: feld.sortierung,
        ist_pflicht: feld.ist_pflicht,
        medien: feld.medien.map((medium) => ({
          medien_id: medium.medien_id,
          datei: medium.datei,
          medientyp: medium.medientyp.medientyp,
          sortierung: medium.sortierung,
          bemerkung: medium.bemerkung,
        })),
        loesungen: feld.loesungen.map((loesung) => ({
          loesung_text: loesung.loesung_text,
          sortierung: loesung.sortierung,
          ist_akzeptiert: loesung.ist_akzeptiert,
        })),
      })),
      };
    }),
  };
}
export async function updatePraesentationslayout(data: {
  quizFragenId: number;
  praesentationslayout: string;
  quizId: number;
}) {
  await requireQuizEditor(data.quizId);
  await requireQuizQuestion(data.quizId, data.quizFragenId);

  await prisma.quiz_fragen.update({
    where: {
      quiz_fragen_id: data.quizFragenId,
    },
    data: {
      praesentationslayout: data.praesentationslayout,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);
}

export async function updateQuizQuestionFreeAnswerMode(data: {
  quizId: number;
  quizFragenId: number;
  freieAntwortErlaubt: boolean;
}) {
  if (typeof data.freieAntwortErlaubt !== "boolean") {
    throw new Error("Ung\u00fcltiger Wert f\u00fcr den freien Antwortmodus.");
  }

  await requireQuizEditor(data.quizId);
  await requireQuizQuestion(data.quizId, data.quizFragenId);

  await prisma.quiz_fragen.update({
    where: {
      quiz_fragen_id: data.quizFragenId,
    },
    data: {
      freie_antwort_erlaubt: data.freieAntwortErlaubt,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);
  revalidatePath(`/quiz/${data.quizId}/antworten`);
  revalidatePath(`/quiz/${data.quizId}/praesentation`);
  revalidatePath(`/quiz/${data.quizId}/moderation`);
  revalidatePath(`/quiz/${data.quizId}/auswertung`);
}

export async function updateQuizAbschnitteSortierung(data: {
  quizId: number;
  items: {
    quizAbschnittId: number;
    sortierung: number;
  }[];
}) {
  await requireQuizEditor(data.quizId);
  await Promise.all(
    data.items.map((item) =>
      requireQuizSection(data.quizId, item.quizAbschnittId),
    ),
  );

  const temporaereBasis = -1000000;

  await prisma.$transaction(
    data.items.map((item, index) =>
      prisma.quiz_abschnitte.update({
        where: {
          quiz_abschnitt_id: item.quizAbschnittId,
        },
        data: {
          sortierung: temporaereBasis - index,
        },
      }),
    ),
  );

  await prisma.$transaction(
    data.items.map((item) =>
      prisma.quiz_abschnitte.update({
        where: {
          quiz_abschnitt_id: item.quizAbschnittId,
        },
        data: {
          sortierung: item.sortierung,
        },
      }),
    ),
  );

  revalidatePath(`/quiz/${data.quizId}`);
}
export async function updateQuizFrageAbschnitt(data: {
  quizId: number;
  quizFragenId: number;
  quizAbschnittId: number | null;
}) {
  await requireQuizEditor(data.quizId);
  await requireQuizQuestion(data.quizId, data.quizFragenId);
  if (data.quizAbschnittId !== null) {
    await requireQuizSection(data.quizId, data.quizAbschnittId);
  }

  await prisma.quiz_fragen.update({
    where: {
      quiz_fragen_id: data.quizFragenId,
    },
    data: {
      quiz_abschnitt_id: data.quizAbschnittId,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);
}
export async function updateQuizFragenBlockSortierung(data: {
  quizId: number;
  items: {
    quizFragenId: number;
    quizAbschnittId: number | null;
    sortierung: number;
  }[];
}) {
  await requireQuizEditor(data.quizId);
  await Promise.all(
    data.items.flatMap((item) => [
      requireQuizQuestion(data.quizId, item.quizFragenId),
      ...(item.quizAbschnittId === null
        ? []
        : [requireQuizSection(data.quizId, item.quizAbschnittId)]),
    ]),
  );

  const vorhandeneEintraege = await prisma.quiz_fragen.findMany({
    where: {
      quiz_id: data.quizId,
      quiz_fragen_id: {
        in: data.items.map((item) => item.quizFragenId),
      },
    },
    select: {
      quiz_fragen_id: true,
    },
  });

  const vorhandeneIds = new Set(
    vorhandeneEintraege.map((eintrag) => eintrag.quiz_fragen_id),
  );

  const gueltigeItems = data.items.filter((item) =>
    vorhandeneIds.has(item.quizFragenId),
  );

  const temporaereBasis = -1000000;

  await prisma.$transaction(
    gueltigeItems.map((item, index) =>
      prisma.quiz_fragen.update({
        where: {
          quiz_fragen_id: item.quizFragenId,
        },
        data: {
          sortierung: temporaereBasis - index,
        },
      }),
    ),
  );

  await prisma.$transaction(
    gueltigeItems.map((item) =>
      prisma.quiz_fragen.update({
        where: {
          quiz_fragen_id: item.quizFragenId,
        },
        data: {
          quiz_abschnitt_id: item.quizAbschnittId,
          sortierung: item.sortierung,
        },
      }),
    ),
  );

  revalidatePath(`/quiz/${data.quizId}`);
}
export async function getQuizAntwortStatus(
  quizId: number,
  quizTeamSessionToken?: string,
) {
  const quiz = await prisma.quiz.findUnique({
    where: {
      quiz_id: quizId,
    },
    include: {
      quiz_abschnitte: {
        orderBy: {
          sortierung: "asc",
        },
        include: {
          quiz_block_freigaben: true,
        },
      },
      quiz_fragen: {
        orderBy: {
          sortierung: "asc",
        },
        include: {
          fragen: {
            include: {
              antworten: {
                include: {
                  antworttyp: true,
                },
                orderBy: {
                  antwort_id: "asc",
                },
              },
              medien: {
                include: {
                  medientyp: true,
                },
                orderBy: {
                  sortierung: "asc",
                },
              },
              antwortfelder: {
                orderBy: {
                  sortierung: "asc",
                },
              },
              vorlage: { select: { code: true } },
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    return null;
  }

  if (quiz.ist_archiviert) {
    return null;
  }

  const abschnitte = quiz.quiz_abschnitte.map((abschnitt) => ({
    quiz_abschnitt_id: abschnitt.quiz_abschnitt_id,
    titel: abschnitt.titel,
    abschnitt_typ: abschnitt.abschnitt_typ,
    ist_freigegeben:
      abschnitt.quiz_block_freigaben[0]?.ist_freigegeben ?? false,
    ist_geschlossen:
      abschnitt.quiz_block_freigaben[0]?.ist_geschlossen ?? false,
  }));

  const aktuellerBlock =
    abschnitte.find(
      (abschnitt) =>
        isQuestionSection(abschnitt) &&
        abschnitt.ist_freigegeben &&
        !abschnitt.ist_geschlossen,
    ) ??
    abschnitte.find(
      (abschnitt) =>
        isQuestionSection(abschnitt) &&
        abschnitt.ist_geschlossen,
    );

  const blockIstGesperrt = aktuellerBlock?.ist_geschlossen ?? false;

  const blockFreigabe = quiz.quiz_abschnitte.find(
    (abschnitt) =>
      abschnitt.quiz_abschnitt_id === aktuellerBlock?.quiz_abschnitt_id,
  )?.quiz_block_freigaben[0];

  const aktuelleQuizFragenId = blockFreigabe?.aktuelle_quiz_fragen_id ?? null;

  const tokenPayload = quizTeamSessionToken
    ? verifyTeamSessionToken(
        quizTeamSessionToken,
        getTeamSessionSigningSecret(),
      )
    : null;
  const teamSession = tokenPayload
    ? await prisma.quiz_team_sessions.findFirst({
        where: {
          quiz_team_session_id: tokenPayload.sessionId,
          quiz_id: quizId,
        },
      })
    : null;

  const gespeicherteAntworten =
    tokenPayload?.quizId === quizId && teamSession
      ? await prisma.team_antworten.findMany({
        where: {
          quiz_team_session_id: tokenPayload.sessionId,
          quiz_id: quizId,
        },
        include: {
          antwortauswahlen: true,
          antwortfelder: {
            include: {
              antwortfeld: true,
            },
          },
        },
        })
      : [];

  const fragenImAktuellenBlock = aktuellerBlock
    ? quiz.quiz_fragen
        .filter(
          (eintrag) =>
            Number(eintrag.quiz_abschnitt_id) ===
            Number(aktuellerBlock.quiz_abschnitt_id),
        )
        .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0))
    : [];

  const aktuelleFrageIndex = fragenImAktuellenBlock.findIndex(
    (eintrag) => eintrag.quiz_fragen_id === aktuelleQuizFragenId,
  );

  const fragen =
    aktuellerBlock && !blockIstGesperrt
      ? fragenImAktuellenBlock
          .filter((_, index) => aktuelleFrageIndex >= 0 && index <= aktuelleFrageIndex)
          .map((eintrag) => {
          const antworten = [...eintrag.fragen.antworten].sort((a, b) => {
            const indexA = eintrag.antwort_reihenfolge.indexOf(a.antwort_id);
            const indexB = eintrag.antwort_reihenfolge.indexOf(b.antwort_id);

            if (indexA === -1 && indexB === -1) {
              return a.antwort_id - b.antwort_id;
            }

            if (indexA === -1) return 1;
            if (indexB === -1) return -1;

            return indexA - indexB;
          });

          const gespeicherteAntwort = gespeicherteAntworten.find(
            (antwort) => antwort.quiz_fragen_id === eintrag.quiz_fragen_id,
          );
          const answerMode = resolveQuizQuestionAnswerMode({
            templateId: eintrag.fragen.vorlage?.code ?? null,
            answers: eintrag.fragen.antworten.map((antwort) => ({
              isCorrect: antwort.ist_richtig,
            })),
            allowFreeAnswer: eintrag.freie_antwort_erlaubt,
          });

          return {
            quiz_fragen_id: eintrag.quiz_fragen_id,
            fragen_id: eintrag.fragen.fragen_id,
            frage: eintrag.fragen.frage,
            templateId: eintrag.fragen.vorlage?.code ?? null,
            templateConfig: eintrag.fragen.template_config_json as
              | import("@/app/fragen/editor/types").QuestionTemplateConfig
              | null,
            istFreigegeben: true,
            punkte_modus: eintrag.punkte_modus ?? "standard",
            urspruenglicher_antwortmodus: answerMode.originalMode,
            effektiver_antwortmodus: answerMode.effectiveMode,
            freie_antwort_erlaubt: eintrag.freie_antwort_erlaubt,

            bildMedien: (eintrag.fragen.medien ?? [])
              .filter((medium) =>
                medium.medientyp.medientyp.toLowerCase().includes("bild"),
              )
              .map((medium) => ({
                medien_id: medium.medien_id,
                datei: medium.datei,
                medientyp: medium.medientyp.medientyp,
              })),

            antwortfelder: (eintrag.fragen.antwortfelder ?? []).map((feld) => ({
              antwortfeld_id: feld.antwortfeld_id,
              label: feld.label,
              sortierung: feld.sortierung,
              ist_pflicht: feld.ist_pflicht,
            })),

            gespeicherteAntwort: gespeicherteAntwort
              ? {
                  antwortId: gespeicherteAntwort.antwort_id,
                  antwortIds:
                    gespeicherteAntwort.antwortauswahlen.length > 0
                      ? gespeicherteAntwort.antwortauswahlen.map(
                          (selection) => selection.antwort_id,
                        )
                      : gespeicherteAntwort.antwort_id === null
                        ? []
                        : [gespeicherteAntwort.antwort_id],
                  antwortText: gespeicherteAntwort.antwort_text,
                  antwortfelder: (gespeicherteAntwort.antwortfelder ?? []).map(
                    (feld) => ({
                      antwortfeldId: feld.antwortfeld_id,
                      antwortText: feld.antwort_text,
                    }),
                  ),
                }
              : null,

            antworten: (answerMode.effectiveMode === "OPEN" ? [] : antworten)
              .filter((antwort) => antwort.antworttyp.antworttyp !== "Freitext")
              .map((antwort) => ({
                antwort_id: antwort.antwort_id,
                antwort: antwort.antwort,
              })),
          };
        })
      : [];

  return {
    quiz_id: quiz.quiz_id,
    titel: quiz.titel,
    abschnitte,
    offenerBlock:
      aktuellerBlock && !blockIstGesperrt ? aktuellerBlock : undefined,
    aktuellerBlock,
    blockIstGesperrt,
    fragen,
  };
}
export async function searchTeamsForAntworten(query: string) {
  const suchtext = query.trim();

  if (suchtext.length < 2) {
    return [];
  }

  const teams = await prisma.teams.findMany({
    where: {
      teamname: {
        contains: suchtext,
        mode: "insensitive",
      },
    },
    orderBy: {
      teamname: "asc",
    },
    take: 10,
  });

  return teams.map((team) => ({
    team_id: team.team_id,
    teamname: team.teamname,
  }));
}
export async function startQuizTeamSession(data: {
  quizId: number;
  teamname: string;
  spielerAnzahl?: number | null;
  passwort?: string;
}) {
  const quiz = await prisma.quiz.findFirst({
    where: { quiz_id: data.quizId, ist_archiviert: false },
    select: { quiz_id: true },
  });
  if (!quiz) {
    return { success: false, message: "Quiz nicht gefunden." };
  }

  const teamname = data.teamname.trim();

  if (!teamname) {
    return {
      success: false,
      message: "Bitte einen Teamnamen eingeben.",
    };
  }

  const spielerAnzahl =
    typeof data.spielerAnzahl === "number" && data.spielerAnzahl > 0
      ? data.spielerAnzahl
      : 1;

  let team = await prisma.teams.findUnique({
    where: {
      teamname,
    },
  });

  let generiertesPasswort: string | null = null;

  if (!team) {
    generiertesPasswort =
      TEAM_PASSWORT_WOERTER[
        Math.floor(Math.random() * TEAM_PASSWORT_WOERTER.length)
      ];

    team = await prisma.teams.create({
      data: {
        teamname,
        team_passwort: generiertesPasswort,
      },
    });
  } else {
    if (team.team_passwort && team.team_passwort !== data.passwort) {
      return {
        success: false,
        message: "Falsches Team-Passwort.",
      };
    }
  }

  const session = await prisma.quiz_team_sessions.upsert({
    where: {
      quiz_id_teamname: {
        quiz_id: data.quizId,
        teamname,
      },
    },
    update: {
      spieler_anzahl: spielerAnzahl,
    },
    create: {
      quiz_id: data.quizId,
      teamname,
      spieler_anzahl: spielerAnzahl,
    },
  });

  const statistik = await prisma.quiz_team_sessions.aggregate({
    where: {
      quiz_id: data.quizId,
    },
    _count: {
      quiz_team_session_id: true,
    },
    _sum: {
      spieler_anzahl: true,
    },
  });

  await prisma.quiz.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      team_anzahl: statistik._count.quiz_team_session_id,
      teilnehmer_anzahl: statistik._sum.spieler_anzahl ?? 0,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);
  revalidatePath("/quiz");

  return {
    success: true,
    generiertesPasswort,
    session: {
      quiz_team_session_id: session.quiz_team_session_id,
      teamname: session.teamname,
      teamPasswort: generiertesPasswort,
      sessionToken: issueTeamSessionToken(
        { quizId: data.quizId, sessionId: session.quiz_team_session_id },
        getTeamSessionSigningSecret(),
      ),
    },
  };
}
export async function freigabeQuizBlock(data: {
  quizId: number;
  quizAbschnittId: number;
}) {
  await requireQuizLiveController(data.quizId);
  await requireQuizSection(data.quizId, data.quizAbschnittId);

  await prisma.quiz_block_freigaben.updateMany({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      ist_freigegeben: false,
    },
  });

  await prisma.quiz_block_freigaben.upsert({
    where: {
      quiz_id_quiz_abschnitt_id: {
        quiz_id: data.quizId,
        quiz_abschnitt_id: data.quizAbschnittId,
      },
    },
    update: {
      ist_freigegeben: true,
      ist_geschlossen: false,
      freigegeben_ab: new Date(),
      geschlossen_ab: null,
    },
    create: {
      quiz_id: data.quizId,
      quiz_abschnitt_id: data.quizAbschnittId,
      ist_freigegeben: true,
      ist_geschlossen: false,
      freigegeben_ab: new Date(),
    },
  });

  return {
    success: true,
    message: "Block wurde freigegeben.",
  };
}

export async function schliesseQuizBlock(data: {
  quizId: number;
  quizAbschnittId: number;
}) {
  await requireQuizLiveController(data.quizId);
  await requireQuizSection(data.quizId, data.quizAbschnittId);

  await prisma.quiz_block_freigaben.upsert({
    where: {
      quiz_id_quiz_abschnitt_id: {
        quiz_id: data.quizId,
        quiz_abschnitt_id: data.quizAbschnittId,
      },
    },
    update: {
      ist_freigegeben: false,
      ist_geschlossen: true,
      geschlossen_ab: new Date(),
    },
    create: {
      quiz_id: data.quizId,
      quiz_abschnitt_id: data.quizAbschnittId,
      ist_freigegeben: false,
      ist_geschlossen: true,
      geschlossen_ab: new Date(),
    },
  });

  return {
    success: true,
    message: "Block wurde geschlossen.",
  };
}
export async function setAktuelleQuizFrage(data: {
  quizId: number;
  quizAbschnittId: number;
  quizFragenId: number;
}) {
  await requireQuizLiveController(data.quizId);
  await requireQuizQuestionInSection(
    data.quizId,
    data.quizAbschnittId,
    data.quizFragenId,
  );

  await prisma.quiz_block_freigaben.upsert({
    where: {
      quiz_id_quiz_abschnitt_id: {
        quiz_id: data.quizId,
        quiz_abschnitt_id: data.quizAbschnittId,
      },
    },
    update: {
      aktuelle_quiz_fragen_id: data.quizFragenId,
    },
    create: {
      quiz_id: data.quizId,
      quiz_abschnitt_id: data.quizAbschnittId,
      aktuelle_quiz_fragen_id: data.quizFragenId,
    },
  });

  revalidatePath(`/quiz/${data.quizId}/antworten`);
}
export async function getQuizAntwortStatusLive(
  quizId: number,
  quizTeamSessionToken?: string,
) {
  return getQuizAntwortStatus(quizId, quizTeamSessionToken);
}
export async function saveTeamAntwort(data: {
  quizId: number;
  quizAbschnittId: number;
  quizFragenId: number;
  quizTeamSessionToken: string;
  antwortText: string | null;
  antwortId: number | null;
  antwortIds?: number[];
  antwortfelder?: {
    antwortfeldId: number;
    antwortText: string | null;
  }[];
}) {
  const tokenPayload = verifyTeamSessionToken(
    data.quizTeamSessionToken,
    getTeamSessionSigningSecret(),
  );
  if (!tokenPayload || tokenPayload.quizId !== data.quizId) {
    throw new Error("Ungültige oder abgelaufene Team-Sitzung.");
  }

  const [teamSession, quizFrage, blockFragen] = await Promise.all([
    prisma.quiz_team_sessions.findUnique({
      where: { quiz_team_session_id: tokenPayload.sessionId },
    }),
    prisma.quiz_fragen.findUnique({
      where: { quiz_fragen_id: data.quizFragenId },
      include: {
        fragen: {
          select: {
            antworten: {
              select: {
                antwort_id: true,
                ist_richtig: true,
              },
            },
            antwortfelder: { select: { antwortfeld_id: true } },
            vorlage: { select: { code: true } },
            template_config_json: true,
          },
        },
        quiz: { select: { ist_archiviert: true } },
      },
    }),
    prisma.quiz_fragen.findMany({
      where: {
        quiz_id: data.quizId,
        quiz_abschnitt_id: data.quizAbschnittId,
      },
      orderBy: { sortierung: "asc" },
      select: { quiz_fragen_id: true },
    }),
  ]);
  const blockFreigabe = await prisma.quiz_block_freigaben.findFirst({
    where: {
      quiz_id: data.quizId,
      quiz_abschnitt_id: data.quizAbschnittId,
    },
  });

  if (!teamSession || !quizFrage || quizFrage.quiz.ist_archiviert) {
    throw new Error("Teamantwort kann nicht gespeichert werden.");
  }

  const answerMode = resolveQuizQuestionAnswerMode({
    templateId: quizFrage.fragen.vorlage?.code ?? null,
    answers: quizFrage.fragen.antworten.map((antwort) => ({
      isCorrect: antwort.ist_richtig,
    })),
    allowFreeAnswer: quizFrage.freie_antwort_erlaubt,
  });

  const requestedAnswerIds = data.antwortIds ?? (
    data.antwortId === null ? [] : [data.antwortId]
  );
  if (
    answerMode.effectiveMode === "OPEN" &&
    (data.antwortId !== null || requestedAnswerIds.length > 0)
  ) {
    throw new Error(
      "F\u00fcr diese Quizfrage ist nur eine freie Textantwort zul\u00e4ssig.",
    );
  }

  const currentIndex = blockFragen.findIndex(
    (entry) => entry.quiz_fragen_id === blockFreigabe?.aktuelle_quiz_fragen_id,
  );
  assertTeamAnswerAuthorized({
    requestedQuizId: data.quizId,
    requestedSectionId: data.quizAbschnittId,
    requestedQuizQuestionId: data.quizFragenId,
    sessionQuizId: teamSession.quiz_id,
    assignmentQuizId: quizFrage.quiz_id,
    assignmentSectionId: quizFrage.quiz_abschnitt_id,
    releasedSectionId: blockFreigabe?.quiz_abschnitt_id ?? null,
    blockIsReleased: blockFreigabe?.ist_freigegeben ?? false,
    blockIsClosed: blockFreigabe?.ist_geschlossen ?? true,
    visibleQuizQuestionIds:
      currentIndex >= 0
        ? blockFragen.slice(0, currentIndex + 1).map((entry) => entry.quiz_fragen_id)
        : [],
    requestedAnswerId: data.antwortId,
    allowedAnswerIds: quizFrage.fragen.antworten.map((entry) => entry.antwort_id),
    requestedAnswerFieldIds: (data.antwortfelder ?? []).map(
      (entry) => entry.antwortfeldId,
    ),
    allowedAnswerFieldIds: quizFrage.fragen.antwortfelder.map(
      (entry) => entry.antwortfeld_id,
    ),
  });

  const allowedAnswerIds = new Set(
    quizFrage.fragen.antworten.map((entry) => entry.antwort_id),
  );
  if (
    new Set(requestedAnswerIds).size !== requestedAnswerIds.length ||
    requestedAnswerIds.some((id) => !allowedAnswerIds.has(id))
  ) {
    throw new Error("Die übermittelten Antwortoptionen sind ungültig.");
  }

  const templateId = resolveCanonicalQuestionTemplateId(
    quizFrage.fragen.vorlage?.code ?? null,
  );
  const templateConfig = quizFrage.fragen.template_config_json as
    | QuestionTemplateConfig
    | null;
  if (templateId === questionTemplateIds.ordering && data.antwortText !== null) {
    const expected =
      templateConfig?.templateData?.kind === "ORDERING"
        ? templateConfig.templateData.items.map((item) => item.id)
        : [];
    let submitted: unknown;
    try {
      submitted = JSON.parse(data.antwortText);
    } catch {
      throw new Error("Die Reihenfolge ist kein gültiges JSON.");
    }
    if (
      !Array.isArray(submitted) ||
      !submitted.every((entry) => typeof entry === "string") ||
      submitted.length !== expected.length ||
      new Set(submitted).size !== submitted.length ||
      submitted.some((entry) => !expected.includes(entry))
    ) {
      throw new Error("Die übermittelte Reihenfolge ist ungültig.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const teamAntwort = await tx.team_antworten.upsert({
      where: {
        quiz_fragen_id_quiz_team_session_id: {
          quiz_fragen_id: data.quizFragenId,
          quiz_team_session_id: tokenPayload.sessionId,
        },
      },
      update: {
        quiz_id: data.quizId,
        quiz_abschnitt_id: data.quizAbschnittId,
        antwort_text: data.antwortText,
        antwort_id: requestedAnswerIds[0] ?? null,
        aktualisiert_am: new Date(),
        manuelle_punkte: null,
        bewertet_am: null,
        bewertet_von_user_id: null,
        bewertungsquelle: "AUTO",
        ist_manuell_falsch: false,
        ist_manuell_richtig: false,
        bewertung_final: false,
      },
      create: {
        quiz_id: data.quizId,
        quiz_abschnitt_id: data.quizAbschnittId,
        quiz_fragen_id: data.quizFragenId,
        quiz_team_session_id: tokenPayload.sessionId,
        antwort_text: data.antwortText,
        antwort_id: requestedAnswerIds[0] ?? null,
        aktualisiert_am: new Date(),
        bewertungsquelle: "AUTO",
      },
    });

    await tx.team_antwort_auswahlen.deleteMany({
      where: { team_antwort_id: teamAntwort.team_antwort_id },
    });
    if (requestedAnswerIds.length > 0) {
      await tx.team_antwort_auswahlen.createMany({
        data: requestedAnswerIds.map((antwortId) => ({
          team_antwort_id: teamAntwort.team_antwort_id,
          antwort_id: antwortId,
        })),
      });
    }

    if (data.antwortfelder) {
      await tx.team_antwortfelder.deleteMany({
        where: { team_antwort_id: teamAntwort.team_antwort_id },
      });
      const gefuellteFelder = data.antwortfelder.filter((feld) =>
        feld.antwortText?.trim(),
      );
      if (gefuellteFelder.length > 0) {
        await tx.team_antwortfelder.createMany({
          data: gefuellteFelder.map((feld) => ({
            team_antwort_id: teamAntwort.team_antwort_id,
            antwortfeld_id: feld.antwortfeldId,
            antwort_text: feld.antwortText?.trim() ?? null,
          })),
        });
      }
    }
    await recalculateQuizQuestionEvaluation(data.quizFragenId, tx);
  });

  return {
    success: true,
  };
}
export async function getQuizFrageAuswertung(
  quizId: number,
  quizFragenId: number,
) {
  await requireQuizViewer(quizId);
  await recalculateQuizQuestionEvaluation(quizFragenId);
  const quizFrage = await prisma.quiz_fragen.findFirst({
    where: {
      quiz_fragen_id: quizFragenId,
      quiz_id: quizId,
    },
    include: {
      fragen: {
        include: {
          antworten: {
            include: {
              antworttyp: true,
            },
            orderBy: {
              antwort_id: "asc",
            },
          },
          vorlage: { select: { code: true } },
        },
      },
      team_antworten: {
        include: {
          quiz_team_sessions: true,
          antworten: true,
          antwortauswahlen: { include: { antwort: true } },
        },
        orderBy: {
          quiz_team_sessions: {
            teamname: "asc",
          },
        },
      },
    },
  });

  if (!quizFrage) {
    return null;
  }

  const auswertbareAntwortoptionen = quizFrage.fragen.antworten.filter(
    (antwort) => antwort.antworttyp?.antworttyp !== "Freitext",
  );
  const answerMode = resolveQuizQuestionAnswerMode({
    templateId: quizFrage.fragen.vorlage?.code ?? null,
    answers: quizFrage.fragen.antworten.map((antwort) => ({
      isCorrect: antwort.ist_richtig,
    })),
    allowFreeAnswer: quizFrage.freie_antwort_erlaubt,
  });
  const istOffeneFrage =
    answerMode.effectiveMode === "OPEN" ||
    (answerMode.effectiveMode === "UNCLASSIFIED" &&
      auswertbareAntwortoptionen.length === 0);

  return {
    quiz_fragen_id: quizFrage.quiz_fragen_id,
    fragen_id: quizFrage.fragen.fragen_id,
    frage: quizFrage.fragen.frage,
    istOffeneFrage,

    richtigeAntworten: quizFrage.fragen.antworten
      .filter((antwort) => antwort.ist_richtig)
      .map((antwort) => ({
        antwort_id: antwort.antwort_id,
        antwort: antwort.antwort,
      })),

    teamAntworten: quizFrage.team_antworten.map((antwort) => {
      return {
        team_antwort_id: antwort.team_antwort_id,
        teamname: antwort.quiz_team_sessions.teamname,
        antwortText: antwort.antwort_text,
        antwortId: antwort.antwort_id,
        ausgewaehlteAntwort: antwort.antworten?.antwort ?? null,
        istAutomatischRichtig:
          antwort.bewertungsquelle !== "MANUAL" &&
          antwort.bewertungsstatus === "CORRECT",
        istPruefpflichtig:
          antwort.bewertungsstatus === "REVIEW_REQUIRED" &&
          antwort.bewertungsquelle !== "MANUAL",
        istManuellRichtig: antwort.ist_manuell_richtig,
        istManuellFalsch: antwort.ist_manuell_falsch,
        bewerteteAntwort: antwort.bewertete_antwort,
        istSkurril: antwort.ist_skurril,
        bewertungFinal: antwort.bewertung_final,
        autoBasisPunkte: Number(antwort.auto_basis_punkte),
        autoEndpunkte: Number(antwort.auto_endpunkte),
        vergebenePunkte: Number(antwort.vergebene_punkte),
        bewertungsstatus: antwort.bewertungsstatus,
        bewertungsquelle: antwort.bewertungsquelle,
      };
    }),
  };
}
export async function updateTeamAntwortBewertung(data: {
  quizId: number;
  teamAntwortId: number;
  aktion: "richtig" | "teilweise" | "falsch" | "skurril" | "zuruecksetzen";
  punkte?: string;
}) {
  const access = await requireQuizAdmin(data.quizId);
  const existing = await requireQuizTeamAnswer(data.quizId, data.teamAntwortId);

  if (data.aktion === "skurril") {
    await prisma.team_antworten.update({
      where: { team_antwort_id: data.teamAntwortId },
      data: {
        ist_skurril: !existing.ist_skurril,
      },
    });
  }

  if (data.aktion === "zuruecksetzen") {
    await prisma.team_antworten.update({
      where: { team_antwort_id: data.teamAntwortId },
      data: {
        ist_manuell_richtig: false,
        ist_manuell_falsch: false,
        ist_skurril: false,
        bewertete_antwort: null,
        bewertung_final: false,
        manuelle_punkte: null,
        vergebene_punkte: existing.auto_endpunkte,
        bewertungsstatus: "UNANSWERED",
        bewertungsquelle: "AUTO",
        bewertet_am: null,
        bewertet_von_user_id: null,
      },
    });
  }

  if (["richtig", "teilweise", "falsch"].includes(data.aktion)) {
    const question = await prisma.quiz_fragen.findUniqueOrThrow({
      where: { quiz_fragen_id: existing.quiz_fragen_id },
      select: { punkte_basis: true, punkte_modus: true },
    });
    const maximum = question.punkte_modus === "expertenbonus"
      ? question.punkte_basis.mul(2)
      : question.punkte_basis;
    let points: Prisma.Decimal;
    try {
      points =
        data.punkte !== undefined
          ? new Prisma.Decimal(data.punkte.replace(",", "."))
          : data.aktion === "richtig"
            ? maximum
            : new Prisma.Decimal(0);
    } catch {
      throw new Error("Die Punktzahl ist ungültig.");
    }
    if (
      points.lt(0) ||
      points.gt(maximum) ||
      (data.aktion === "falsch" && !points.eq(0)) ||
      (data.aktion === "richtig" && !points.eq(maximum)) ||
      (data.aktion === "teilweise" && (points.lte(0) || points.gte(maximum)))
    ) {
      throw new Error("Die Punktzahl passt nicht zum gewählten Bewertungsstatus.");
    }
    await prisma.team_antworten.update({
      where: { team_antwort_id: data.teamAntwortId },
      data: {
        ist_manuell_richtig: data.aktion === "richtig",
        ist_manuell_falsch: data.aktion === "falsch",
        bewertung_final: true,
        manuelle_punkte: points,
        vergebene_punkte: points,
        bewertungsstatus:
          data.aktion === "richtig"
            ? "CORRECT"
            : data.aktion === "teilweise"
              ? "PARTIAL"
              : "WRONG",
        bewertungsquelle: "MANUAL",
        bewertet_am: new Date(),
        bewertet_von_user_id: Number(access.session.user.id),
      },
    });
  }
  await recalculateQuizQuestionEvaluation(existing.quiz_fragen_id);
  await updateQuizFragenStatistiken();
  revalidatePath(`/quiz/${data.quizId}/auswertung`);
}

export async function updateQuizFragenStatistiken() {
  await requireAdmin();

  const quizFragen = await prisma.quiz_fragen.findMany({
    include: {
      team_antworten: true,
    },
  });

  for (const quizFrage of quizFragen) {
    const beantworteteAntworten = quizFrage.team_antworten;
    const richtigeantworten = beantworteteAntworten.filter(
      (antwort) => antwort.bewertungsstatus === "CORRECT",
    ).length;

    const falscheantworten = beantworteteAntworten.length - richtigeantworten;

    await prisma.quiz_fragen.update({
      where: {
        quiz_fragen_id: quizFrage.quiz_fragen_id,
      },
      data: {
        richtigeantworten,
        falscheantworten,
      },
    });
  }

  const fragen = await prisma.fragen.findMany({
    include: {
      quiz_fragen: true,
    },
  });

  for (const frage of fragen) {
    const richtigGesamt = frage.quiz_fragen.reduce(
      (summe, quizFrage) => summe + (quizFrage.richtigeantworten ?? 0),
      0,
    );

    const falschGesamt = frage.quiz_fragen.reduce(
      (summe, quizFrage) => summe + (quizFrage.falscheantworten ?? 0),
      0,
    );

    const gesamt = richtigGesamt + falschGesamt;

    const schwierigkeitslevel =
      gesamt > 0 ? Math.round((falschGesamt / gesamt) * 100) : null;

    await prisma.fragen.update({
      where: {
        fragen_id: frage.fragen_id,
      },
      data: {
        schwierigkeitslevel,
      },
    });
  }
  const quizIds = await prisma.quiz.findMany({
    select: {
      quiz_id: true,
    },
  });

  for (const quiz of quizIds) {
    const manuelleBewertungen = await prisma.team_antworten.count({
      where: {
        quiz_id: quiz.quiz_id,
        OR: [{ ist_manuell_richtig: true }, { ist_manuell_falsch: true }],
      },
    });

    await prisma.quiz.update({
      where: {
        quiz_id: quiz.quiz_id,
      },
      data: {
        manuelle_bewertungen: manuelleBewertungen,
      },
    });
  }

  revalidatePath("/fragen");
}
export async function getQuizAuswertungUebersicht(quizId: number) {
  await requireQuizViewer(quizId);
  await recalculateQuizEvaluation(quizId);
  const quizFragen = await prisma.quiz_fragen.findMany({
    where: {
      quiz_id: quizId,
    },
    orderBy: {
      sortierung: "asc",
    },
    include: {
      fragen: {
        include: {
          antworten: true,
          vorlage: { select: { code: true } },
        },
      },
      team_antworten: true,
    },
  });

  return quizFragen.map((quizFrage) => {
    const answerMode = resolveQuizQuestionAnswerMode({
      templateId: quizFrage.fragen.vorlage?.code ?? null,
      answers: quizFrage.fragen.antworten.map((antwort) => ({
        isCorrect: antwort.ist_richtig,
      })),
      allowFreeAnswer: quizFrage.freie_antwort_erlaubt,
    });
    const istOffeneFrage =
      answerMode.effectiveMode === "OPEN" ||
      (answerMode.effectiveMode === "UNCLASSIFIED" &&
        quizFrage.fragen.antworten.length <= 1);

    const offenePruefungen = quizFrage.team_antworten.filter(
      (antwort) =>
        antwort.bewertungsstatus === "REVIEW_REQUIRED" &&
        antwort.bewertungsquelle !== "MANUAL",
    ).length;

    const skurrileAntworten = quizFrage.team_antworten.filter(
      (antwort) => antwort.ist_skurril,
    ).length;

    return {
      quiz_fragen_id: quizFrage.quiz_fragen_id,
      offenePruefungen,
      skurrileAntworten,
      istOffeneFrage,
    };
  });
}
export async function getQuizAuswertungAlleAntworten(quizId: number) {
  await requireQuizViewer(quizId);
  await recalculateQuizEvaluation(quizId);
  const quizFragen = await prisma.quiz_fragen.findMany({
    where: {
      quiz_id: quizId,
    },
    orderBy: {
      sortierung: "asc",
    },
    include: {
      fragen: {
        include: {
          antwortfelder: {
            orderBy: {
              sortierung: "asc",
            },
            include: {
              loesungen: {
                orderBy: {
                  sortierung: "asc",
                },
              },
            },
          },
          antworten: {
            include: {
              antworttyp: true,
            },
            orderBy: {
              antwort_id: "asc",
            },
          },
          vorlage: { select: { code: true } },
        },
      },
      team_antworten: {
        include: {
          quiz_team_sessions: true,
          antworten: true,
          antwortauswahlen: { include: { antwort: true } },
        },
      },
    },
  });

  const sessions = await prisma.quiz_team_sessions.findMany({
    where: {
      quiz_id: quizId,
    },
    orderBy: {
      teamname: "asc",
    },
  });

  const teamAntwortIds = quizFragen.flatMap((quizFrage) =>
    quizFrage.team_antworten.map((antwort) => antwort.team_antwort_id),
  );

  const offeneAntworten =
    teamAntwortIds.length > 0
      ? await prisma.team_antwortfelder.findMany({
          where: {
            team_antwort_id: {
              in: teamAntwortIds,
            },
          },
          orderBy: {
            antwortfeld_id: "asc",
          },
        })
      : [];

  const antwortfeldIds = Array.from(
    new Set(offeneAntworten.map((feld) => feld.antwortfeld_id)),
  );

  const antwortfelder =
    antwortfeldIds.length > 0
      ? await prisma.frage_antwortfelder.findMany({
          where: {
            antwortfeld_id: {
              in: antwortfeldIds,
            },
          },
        })
      : [];

  const antwortfeldLabelMap = new Map(
    antwortfelder.map((feld) => [feld.antwortfeld_id, feld.label]),
  );

  return quizFragen.flatMap((quizFrage, frageIndex) => {
    const richtigeAntworten = quizFrage.fragen.antworten
      .filter((antwort) => antwort.ist_richtig)
      .map((antwort) => antwort.antwort)
      .join(", ");

    const offeneMusterloesung = quizFrage.fragen.antwortfelder
      .map((feld) => {
        const loesungen = feld.loesungen
          .filter((loesung) => loesung.ist_akzeptiert)
          .map((loesung) => loesung.loesung_text)
          .join(" / ");

        if (!loesungen) {
          return null;
        }

        return `${feld.label}: ${loesungen}`;
      })
      .filter(Boolean)
      .join(" | ");

    const auswertbareAntwortoptionen = quizFrage.fragen.antworten.filter(
      (antwort) => antwort.antworttyp?.antworttyp !== "Freitext",
    );

    const answerMode = resolveQuizQuestionAnswerMode({
      templateId: quizFrage.fragen.vorlage?.code ?? null,
      answers: quizFrage.fragen.antworten.map((antwort) => ({
        isCorrect: antwort.ist_richtig,
      })),
      allowFreeAnswer: quizFrage.freie_antwort_erlaubt,
    });
    const istOffeneFrage =
      answerMode.effectiveMode === "OPEN" ||
      (answerMode.effectiveMode === "UNCLASSIFIED" &&
        (auswertbareAntwortoptionen.length === 0 ||
          quizFrage.fragen.antwortfelder.length > 0));

    return sessions.map((session) => {
      const antwort = quizFrage.team_antworten.find(
        (eintrag) =>
          eintrag.quiz_team_session_id === session.quiz_team_session_id,
      );

      const offeneAntwortfelderText = antwort
        ? offeneAntworten
            .filter((feld) => feld.team_antwort_id === antwort.team_antwort_id)
            .map((feld) => {
              const label =
                antwortfeldLabelMap.get(feld.antwortfeld_id) ?? "Antwort";
              const text = feld.antwort_text?.trim();

              if (!text) {
                return null;
              }

              return `${label}: ${text}`;
            })
            .filter(Boolean)
            .join(" | ")
        : null;

      const istUnbeantwortet =
        !antwort || antwort.bewertungsstatus === "UNANSWERED";

      const istAutomatischRichtig =
        antwort?.bewertungsquelle !== "MANUAL" &&
        antwort?.bewertungsstatus === "CORRECT";
      const istPruefpflichtig =
        istUnbeantwortet ||
        (antwort?.bewertungsstatus === "REVIEW_REQUIRED" &&
          antwort.bewertungsquelle !== "MANUAL");

      return {
        quiz_fragen_id: quizFrage.quiz_fragen_id,
        fragen_id: quizFrage.fragen.fragen_id,
        frageIndex: frageIndex + 1,
        frage: quizFrage.fragen.frage,
        richtigeAntwort: richtigeAntworten || offeneMusterloesung || "-",

        team_antwort_id: antwort?.team_antwort_id ?? null,
        teamname: session.teamname,
        antwortText: offeneAntwortfelderText || antwort?.antwort_text || null,
        antwortId: antwort?.antwort_id ?? null,
        ausgewaehlteAntwort:
          antwort?.antwortauswahlen
            .map((selection) => selection.antwort.antwort)
            .join(", ") ||
          antwort?.antworten?.antwort ||
          null,
        punkte_modus: quizFrage.punkte_modus ?? "standard",

        istOffeneFrage,
        istUnbeantwortet,
        istAutomatischRichtig,
        istPruefpflichtig,
        istManuellRichtig: antwort?.ist_manuell_richtig ?? false,
        istManuellFalsch: antwort?.ist_manuell_falsch ?? false,
        bewerteteAntwort: antwort?.bewertete_antwort ?? null,
        istSkurril: antwort?.ist_skurril ?? false,
        bewertungFinal: antwort?.bewertung_final ?? false,
        autoBasisPunkte: Number(antwort?.auto_basis_punkte ?? 0),
        autoEndpunkte: Number(antwort?.auto_endpunkte ?? 0),
        vergebenePunkte: Number(antwort?.vergebene_punkte ?? 0),
        bewertungsstatus: antwort?.bewertungsstatus ?? "UNANSWERED",
        bewertungsquelle: antwort?.bewertungsquelle ?? "AUTO",
      };
    });
  });
}
export async function updateQuizFragePunkteModus(data: {
  quizId: number;
  quizFragenId: number;
  punkteModus: string;
}) {
  await requireQuizAdmin(data.quizId);
  await requireQuizQuestion(data.quizId, data.quizFragenId);
  if (!["standard", "expertenbonus", "risikofrage"].includes(data.punkteModus)) {
    throw new Error("Unbekannter Punktemodus.");
  }
  const question = await prisma.quiz_fragen.findUniqueOrThrow({
    where: { quiz_fragen_id: data.quizFragenId },
    include: {
      fragen: {
        include: {
          vorlage: { select: { code: true } },
          antworten: { select: { ist_richtig: true } },
          antwortfelder: { select: { antwortfeld_id: true } },
        },
      },
    },
  });
  const config = question.fragen.template_config_json as QuestionTemplateConfig | null;
  validateQuestionPointsMode({
    templateId: question.fragen.vorlage?.code ?? null,
    pointsMode: data.punkteModus,
    correctAnswerCount: question.fragen.antworten.filter((answer) => answer.ist_richtig).length,
    structuredFieldCount: question.fragen.antwortfelder.length,
    orderingItemCount:
      config?.templateData?.kind === "ORDERING"
        ? config.templateData.items.length
        : 0,
  });

  await prisma.quiz_fragen.update({
    where: {
      quiz_fragen_id: data.quizFragenId,
    },
    data: {
      punkte_modus: data.punkteModus,
    },
  });
  await recalculateQuizQuestionEvaluation(data.quizFragenId);

  revalidatePath(`/quiz/${data.quizId}`);
  revalidatePath(`/quiz/${data.quizId}/auswertung`);

  return {
    success: true,
  };
}
export async function getQuizPunktestand(quizId: number) {
  await requireQuizViewer(quizId);
  await recalculateQuizEvaluation(quizId);
  const [sessions, totals, answers] = await Promise.all([
    prisma.quiz_team_sessions.findMany({
      where: { quiz_id: quizId },
      select: { quiz_team_session_id: true, teamname: true },
    }),
    prisma.team_antworten.groupBy({
      by: ["quiz_team_session_id"],
      where: { quiz_id: quizId },
      _sum: { vergebene_punkte: true },
    }),
    prisma.team_antworten.findMany({
      where: { quiz_id: quizId, vergebene_punkte: { not: 0 } },
      select: {
        quiz_team_session_id: true,
        quiz_fragen_id: true,
        vergebene_punkte: true,
        quiz_fragen: { select: { sortierung: true, punkte_modus: true } },
      },
    }),
  ]);
  const totalsBySession = new Map(
    totals.map((entry) => [
      entry.quiz_team_session_id,
      entry._sum.vergebene_punkte ?? new Prisma.Decimal(0),
    ]),
  );
  return sessions
    .map((session) => {
      const total =
        totalsBySession.get(session.quiz_team_session_id) ?? new Prisma.Decimal(0);
      return {
        teamname: session.teamname,
        punkte: Number(total),
        details: answers
          .filter((answer) => answer.quiz_team_session_id === session.quiz_team_session_id)
          .map((answer) => ({
            quizFragenId: answer.quiz_fragen_id,
            frageIndex: answer.quiz_fragen.sortierung ?? 0,
            punkte: Number(answer.vergebene_punkte),
            punkteModus: answer.quiz_fragen.punkte_modus,
          })),
        _decimal: total,
      };
    })
    .sort((left, right) => right._decimal.cmp(left._decimal))
    .map((entry) => ({
      teamname: entry.teamname,
      punkte: entry.punkte,
      details: entry.details,
    }));
}

export async function getZufaelligeSchaetzfrage(quizId: number) {
  const access = await requireQuizLiveController(quizId);
  const fragen = await prisma.fragen.findMany({
    where: {
      ...buildQuestionEligibilityWhere(access.ownership.eventSeriesId!, getBerlinDate()),
      fragen_kategorien: {
        some: {
          fragenkategorie: {
            kategorie: "Schätzfrage",
          },
        },
      },
    },
    include: {
      antworten: {
        where: {
          ist_richtig: true,
        },
        orderBy: {
          antwort_id: "asc",
        },
      },
    },
  });

  if (fragen.length === 0) {
    return null;
  }

  const frage = fragen[Math.floor(Math.random() * fragen.length)];

  return {
    fragen_id: frage.fragen_id,
    frage: frage.frage,
    richtigeAntwort:
      frage.antworten.map((antwort) => antwort.antwort).join(", ") || null,
  };
}

export async function getSchaetzfrageById(quizId: number, fragenId: number) {
  const access = await requireQuizLiveController(quizId);
  const frage = await prisma.fragen.findFirst({
    where: {
      fragen_id: fragenId,
      ...buildQuestionEligibilityWhere(access.ownership.eventSeriesId!, getBerlinDate()),
    },
    include: {
      antworten: {
        where: {
          ist_richtig: true,
        },
        orderBy: {
          antwort_id: "asc",
        },
      },
    },
  });

  if (!frage) {
    return null;
  }

  return {
    fragen_id: frage.fragen_id,
    frage: frage.frage,
    richtigeAntwort:
      frage.antworten.map((antwort) => antwort.antwort).join(", ") || null,
  };
}

export async function getSchnellQuizKategorien() {
  await requireSession();
  return prisma.fragenkategorie.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: {
      kategorie: "asc",
    },
  });
}

export async function createSchnellQuiz(data: {
  eventSeriesId: number;
  titel: string;
  quizDatum: string;
  veranstaltungszeit?: string;
  veranstaltungsname?: string;
  kartenUrl?: string;
  oeffentlicheUrl?: string;
  bemerkung?: string;
  anzahlBloecke: number;
  fragenProBlock: number;
  kategorieIds: number[];
  medienFilter: "alle" | "nurMitMedien" | "nurOhneMedien";
  nurBereitsVerwendete: boolean;
  preisPlatz1: string;
  preisPlatz2: string;
  preisPlatz3: string;
}) {
  const validated = validateQuizMasterData({
    eventSeriesId: data.eventSeriesId,
    title: data.titel,
    date: data.quizDatum,
    time: data.veranstaltungszeit,
    venueName: data.veranstaltungsname,
    mapUrl: data.kartenUrl,
    publicUrl: data.oeffentlicheUrl,
    internalNote: data.bemerkung,
  });
  if (!validated.ok) {
    return { success: false, message: validated.message, errors: validated.errors, quizId: null };
  }
  const { session } = await requireEventSeriesAccess(validated.value.eventSeriesId, "MANAGE_QUIZZES");
  const eventSeries = await getEventSeriesForQuizSave(validated.value.eventSeriesId);
  if (!eventSeries.ok) {
    return { success: false, message: eventSeries.message, quizId: null };
  }

  const gesamtAnzahlFragen = data.anzahlBloecke * data.fragenProBlock;

  if (gesamtAnzahlFragen <= 0) {
    return {
      success: false,
      message: "Bitte mindestens eine Frage konfigurieren.",
      quizId: null,
    };
  }

  const fragenPool = await prisma.fragen.findMany({
    where: {
      ...buildQuestionEligibilityWhere(validated.value.eventSeriesId, getBerlinDate()),

      fragen_kategorien:
        data.kategorieIds.length > 0
          ? {
              some: {
                fragenkategorie_id: {
                  in: data.kategorieIds,
                },
              },
            }
          : undefined,

      medien:
        data.medienFilter === "nurMitMedien"
          ? {
              some: {},
            }
          : data.medienFilter === "nurOhneMedien"
            ? {
                none: {},
              }
            : undefined,

      quiz_fragen: data.nurBereitsVerwendete
        ? {
            some: {},
          }
        : undefined,
    },

    include: {
      antworten: true,
    },
  });

  const gemischteFragen = [...fragenPool].sort(() => Math.random() - 0.5);
  const ausgewaehlteFragen = gemischteFragen.slice(0, gesamtAnzahlFragen);

  if (ausgewaehlteFragen.length < gesamtAnzahlFragen) {
    return {
      success: false,
      message: `Es wurden nur ${ausgewaehlteFragen.length} passende Fragen gefunden. Benötigt werden ${gesamtAnzahlFragen}.`,
      quizId: null,
    };
  }

  const quiz = await prisma.quiz.create({
    data: {
      eventreihe_id: validated.value.eventSeriesId,
      titel: validated.value.title,
      quiz_datum: validated.value.dateValue,
      veranstaltungszeit: validated.value.time,
      veranstaltungsname: validated.value.venueName,
      karten_url: validated.value.mapUrl,
      oeffentliche_url: validated.value.publicUrl,
      bemerkung: validated.value.internalNote ?? "Automatisch erstelltes Schnellquiz",
      intro_startzeit: "19:30",
      intro_video_url: "/medien/video/intro/intro.mp4",
    },
  });

  await createSchnellquizAbschnitte(quiz.quiz_id, data.anzahlBloecke);

  const fragenbloecke = await prisma.quiz_abschnitte.findMany({
    where: {
      quiz_id: quiz.quiz_id,
      abschnitt_typ: "fragenblock",
    },
    orderBy: {
      sortierung: "asc",
    },
  });

  for (let blockIndex = 0; blockIndex < data.anzahlBloecke; blockIndex++) {
    const fragenrunde = fragenbloecke[blockIndex];

    if (!fragenrunde) {
      continue;
    }

    const blockFragen = ausgewaehlteFragen.slice(
      blockIndex * data.fragenProBlock,
      (blockIndex + 1) * data.fragenProBlock,
    );

    for (const [frageIndex, frage] of blockFragen.entries()) {
      const antwortReihenfolge = frage.antworten
        .map((antwort) => antwort.antwort_id)
        .sort(() => Math.random() - 0.5);

      await addQuestionToQuiz(
        {
          quiz_id: quiz.quiz_id,
          fragen_id: frage.fragen_id,
          quiz_abschnitt_id: fragenrunde.quiz_abschnitt_id,
          sortierung: blockIndex * data.fragenProBlock + frageIndex + 1,
          antwort_reihenfolge: antwortReihenfolge,
        },
        session,
      );
    }
  }

  revalidatePath("/quiz");
  revalidatePath(`/quiz/${quiz.quiz_id}`);

  return {
    success: true,
    message: "Schnellquiz wurde erstellt.",
    quizId: quiz.quiz_id,
  };
}
export async function createQuizAbschnitt(data: {
  quizId: number;
  titel: string;
  abschnittTyp: string;
  bemerkung?: string;
  qrCodeUrl?: string;
  medienDatei?: string;
}): Promise<
  | {
      success: true;
      abschnitt: Awaited<ReturnType<typeof prisma.quiz_abschnitte.create>>;
    }
  | {
      success: false;
      message: string;
    }
> {
  await requireQuizEditor(data.quizId);

  const titel = data.titel.trim();

  if (!titel) {
    return {
      success: false,
      message: "Bitte einen Titel für den Abschnitt eingeben.",
    };
  }

  const ersterOutroAbschnitt = await prisma.quiz_abschnitte.findFirst({
    where: {
      quiz_id: data.quizId,
      abschnitt_typ: {
        startsWith: OUTRO_SECTION_TYPE,
      },
    },
    orderBy: {
      sortierung: "asc",
    },
  });

  const letzteSortierung = await prisma.quiz_abschnitte.findFirst({
    where: {
      quiz_id: data.quizId,
    },
    orderBy: {
      sortierung: "desc",
    },
  });

  const neueSortierung =
    ersterOutroAbschnitt?.sortierung ?? (letzteSortierung?.sortierung ?? 0) + 1;

  const abschnitt = await prisma.$transaction(async (tx) => {
    if (ersterOutroAbschnitt) {
      await tx.quiz_abschnitte.updateMany({
        where: {
          quiz_id: data.quizId,
          sortierung: {
            gte: neueSortierung,
          },
        },
        data: {
          sortierung: {
            increment: 1,
          },
        },
      });
    }

    return tx.quiz_abschnitte.create({
      data: {
        quiz_id: data.quizId,
        titel,
        abschnitt_typ: data.abschnittTyp,
        sortierung: neueSortierung,
        bemerkung: data.bemerkung?.trim() || null,
        qr_code_url: data.qrCodeUrl?.trim() || null,
        medien_datei: data.medienDatei?.trim() || null,
      },
    });
  });

  revalidatePath(`/quiz/${data.quizId}`);
  revalidatePath(`/quiz/${data.quizId}/praesentation`);

  return {
    success: true,
    abschnitt,
  };
}

export async function updateQuizAbschnitt(data: {
  quizId: number;
  quizAbschnittId: number;
  titel: string;
  abschnittTyp: string;
  bemerkung: string;
  qrCodeUrl: string;
  medienDatei: string;
}) {
  await requireQuizEditor(data.quizId);
  await requireQuizSection(data.quizId, data.quizAbschnittId);

  await prisma.quiz_abschnitte.update({
    where: {
      quiz_abschnitt_id: data.quizAbschnittId,
    },
    data: {
      titel: data.titel.trim(),
      abschnitt_typ: data.abschnittTyp,
      bemerkung: data.bemerkung.trim() || null,
      qr_code_url: data.qrCodeUrl.trim() || null,
      medien_datei: data.medienDatei.trim() || null,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);

  return {
    success: true,
  };
}

export async function deleteQuizAbschnitt(data: {
  quizId: number;
  quizAbschnittId: number;
}) {
  await requireQuizEditor(data.quizId);
  await requireQuizSection(data.quizId, data.quizAbschnittId);

  await prisma.quiz_abschnitte.delete({
    where: {
      quiz_abschnitt_id: data.quizAbschnittId,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);

  return {
    success: true,
  };
}
export async function updateIntroBegruessung(data: {
  quizId: number;
  titel: string;
  text: string;
}) {
  await requireQuizEditor(data.quizId);

  await prisma.quiz.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      intro_begruessungstitel: data.titel.trim() || null,
      intro_begruessungstext: data.text.trim() || null,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);
  revalidatePath(`/quiz/${data.quizId}/slides/begruessung`);

  return {
    success: true,
  };
}
export async function updateIntroRegeln(data: {
  quizId: number;
  regeln: string;
}) {
  await requireQuizEditor(data.quizId);

  await prisma.quiz.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      intro_regeln: data.regeln.trim() || null,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);

  return {
    success: true,
  };
}
export async function updateIntroPreise(data: {
  quizId: number;
  preise: string;
}) {
  await requireQuizEditor(data.quizId);

  await prisma.quiz.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      intro_preise: data.preise.trim() || null,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);

  return {
    success: true,
  };
}
export async function updateIntroVorDemStart(data: {
  quizId: number;
  logoUrl: string;
  musikUrl: string;
  wartetext: string;
  startzeit: string;
}) {
  await requireQuizEditor(data.quizId);

  await prisma.quiz.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      intro_logo_url: data.logoUrl,
      intro_musik_url: data.musikUrl,
      intro_wartetext: data.wartetext,
      intro_startzeit: data.startzeit,
    },
  });
}
async function createDefaultQuizAbschnitte(quizId: number) {
  await prisma.quiz_abschnitte.createMany({
    data: buildDefaultQuizSections(quizId),
  });
}
async function createSchnellquizAbschnitte(
  quizId: number,
  anzahlBloecke: number,
) {
  await prisma.quiz_abschnitte.createMany({
    data: buildQuickQuizSections(quizId, anzahlBloecke),
  });
}
export async function updateIntroStartsequenz(data: {
  quizId: number;
  audioUrl: string;
  text: string;
}) {
  await requireQuizEditor(data.quizId);

  await prisma.quiz.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      intro_musik_url: data.audioUrl,
      intro_startsequenz_text: data.text,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);
}

export async function updateAlleSchwierigkeitslevel() {
  await requireAdmin();

  const fragen = await prisma.fragen.findMany({
    where: {
      ist_archiviert: false,
    },
    include: {
      quiz_fragen: {
        include: {
          team_antworten: true,
        },
      },
    },
  });

  for (const frage of fragen) {
    const alleFinalenAntworten = frage.quiz_fragen.flatMap((quizFrage) =>
      quizFrage.team_antworten
        .filter(
          (antwort) =>
            antwort.bewertungsstatus !== "UNANSWERED" &&
            antwort.bewertungsstatus !== "REVIEW_REQUIRED",
        )
        .map((antwort) => ({ antwort, quizFrage })),
    );

    const teamsGesamt = alleFinalenAntworten.length;

    if (teamsGesamt === 0) {
      continue;
    }

    const erfuellungsgrad = alleFinalenAntworten.reduce(
      (sum, { antwort, quizFrage }) => {
        const maximum =
          quizFrage.punkte_modus === "expertenbonus"
            ? quizFrage.punkte_basis.mul(2)
            : quizFrage.punkte_basis;
        return maximum.eq(0)
          ? sum
          : sum.add(
              Prisma.Decimal.min(1, antwort.vergebene_punkte.div(maximum)),
            );
      },
      new Prisma.Decimal(0),
    );

    const schwierigkeitslevel = Math.round(
      100 - Number(erfuellungsgrad.div(teamsGesamt).mul(100)),
    );

    await prisma.fragen.update({
      where: {
        fragen_id: frage.fragen_id,
      },
      data: {
        schwierigkeitslevel,
      },
    });
  }

  revalidatePath("/fragen");
}
