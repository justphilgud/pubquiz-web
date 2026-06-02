"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

import { TEAM_PASSWORT_WOERTER } from "@/app/lib/teamPasswortWoerter";

export type QuizResult = {
  quiz_id: number;
  titel: string | null;
  quiz_datum: string | null;
  team_anzahl: number | null;
  teilnehmer_anzahl: number | null;
  bemerkung: string | null;
  ist_archiviert: boolean;
  archivierungsgrund: string | null;
  fragen_anzahl: number;
};

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
    punkte_modus: string;
    kategorien: string[];
  }[];
};

export async function getQuizListe(): Promise<QuizResult[]> {
  const quizze = await prisma.quiz.findMany({
    orderBy: {
      quiz_datum: "desc",
    },
    include: {
      _count: {
        select: {
          quiz_fragen: true,
        },
      },
    },
  });

  return quizze.map((quiz) => ({
    quiz_id: quiz.quiz_id,
    titel: quiz.titel,
    quiz_datum: quiz.quiz_datum
      ? quiz.quiz_datum.toISOString().split("T")[0]
      : null,
    team_anzahl: quiz.team_anzahl,
    teilnehmer_anzahl: quiz.teilnehmer_anzahl,
    bemerkung: quiz.bemerkung,
    ist_archiviert: quiz.ist_archiviert,
    archivierungsgrund: quiz.archivierungsgrund,
    fragen_anzahl: quiz._count.quiz_fragen,
  }));
}

export async function getAktiveQuizListe(): Promise<QuizResult[]> {
  const quizze = await prisma.quiz.findMany({
    where: {
      ist_archiviert: false,
    },
    orderBy: {
      quiz_datum: "desc",
    },
    include: {
      _count: {
        select: {
          quiz_fragen: true,
        },
      },
    },
  });

  return quizze.map((quiz) => ({
    quiz_id: quiz.quiz_id,
    titel: quiz.titel,
    quiz_datum: quiz.quiz_datum
      ? quiz.quiz_datum.toISOString().split("T")[0]
      : null,
    team_anzahl: quiz.team_anzahl,
    teilnehmer_anzahl: quiz.teilnehmer_anzahl,
    bemerkung: quiz.bemerkung,
    ist_archiviert: quiz.ist_archiviert,
    archivierungsgrund: quiz.archivierungsgrund,
    fragen_anzahl: 0,
  }));
}

export async function createQuiz(data: {
  titel: string;
  quizDatum: string;
  bemerkung: string;
}) {
  if (!data.titel.trim()) {
    return {
      success: false,
      message: "Bitte einen Quiznamen eingeben.",
    };
  }

  const quiz = await prisma.quiz.create({
    data: {
      titel: data.titel.trim(),
      quiz_datum: data.quizDatum ? new Date(data.quizDatum) : null,
      team_anzahl: 0,
      teilnehmer_anzahl: 0,
      bemerkung: data.bemerkung.trim() || null,
    },
  });

  await createDefaultQuizAbschnitte(quiz.quiz_id);

  revalidatePath("/quiz");

  return {
    success: true,
    message: "Quiz wurde angelegt.",
  };
}

export async function updateQuiz(data: {
  quizId: number;
  titel: string;
  quizDatum: string;
  bemerkung: string;
}) {
  await prisma.quiz.update({
    where: {
      quiz_id: data.quizId,
    },
    data: {
      titel: data.titel.trim() || null,
      quiz_datum: data.quizDatum ? new Date(data.quizDatum) : null,
      bemerkung: data.bemerkung.trim() || null,
    },
  });

  revalidatePath("/quiz");
}

export async function archiveQuiz(data: {
  quizId: number;
  archivierungsgrund: string;
}) {
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
  const fragenAnzahl = await prisma.quiz_fragen.count({
    where: {
      quiz_id: quizId,
    },
  });

  if (fragenAnzahl > 0) {
    return {
      success: false,
      message: "Quiz kann nicht gelöscht werden, weil bereits Fragen zugeordnet sind.",
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
}) {
  const neuerTitel = data.neuerTitel.trim();

  if (!neuerTitel) {
    return {
      success: false,
      message: "Bitte einen Namen für die Kopie eingeben.",
    };
  }

  const original = await prisma.quiz.findUnique({
    where: {
      quiz_id: data.quizId,
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
      },
    },
  });

  if (!original) {
    return {
      success: false,
      message: "Original-Quiz wurde nicht gefunden.",
    };
  }

  const kopie = await prisma.$transaction(async (tx) => {
    const neuesQuiz = await tx.quiz.create({
      data: {
        titel: neuerTitel,
        quiz_datum: null,
        team_anzahl: 0,
        teilnehmer_anzahl: 0,
        bemerkung: original.bemerkung,

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
        neuerAbschnitt.quiz_abschnitt_id
      );
    }

    for (const quizFrage of original.quiz_fragen) {
      await tx.quiz_fragen.create({
        data: {
          quiz_id: neuesQuiz.quiz_id,
          fragen_id: quizFrage.fragen_id,
          quiz_abschnitt_id: quizFrage.quiz_abschnitt_id
            ? abschnittIdMap.get(quizFrage.quiz_abschnitt_id) ?? null
            : null,
          sortierung: quizFrage.sortierung,
          punkte_modus: quizFrage.punkte_modus,
          praesentationslayout: quizFrage.praesentationslayout,
          antwort_reihenfolge: quizFrage.antwort_reihenfolge,
        },
      });
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
  quizId: number
): Promise<QuizDetailsResult | null> {
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
    titel: quiz.titel,
    quiz_datum: quiz.quiz_datum
      ? quiz.quiz_datum.toISOString().split("T")[0]
      : null,
    team_anzahl: quiz.team_anzahl,
    teilnehmer_anzahl: quiz.teilnehmer_anzahl,
    bemerkung: quiz.bemerkung,
    ist_archiviert: quiz.ist_archiviert,
    archivierungsgrund: quiz.archivierungsgrund,
    fragen_anzahl: quiz.quiz_fragen.length,

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
    fragen: quiz.quiz_fragen.map((eintrag) => ({
      quiz_fragen_id: eintrag.quiz_fragen_id,
      sortierung: eintrag.sortierung,
      quiz_abschnitt_id: eintrag.quiz_abschnitt_id,
      fragen_id: eintrag.fragen.fragen_id,
      frage: eintrag.fragen.frage,

      punkte_modus: eintrag.punkte_modus ?? "standard",

      schwierigkeitslevel:
        eintrag.fragen.schwierigkeitslevel?.toString() ?? null,
      praesentationslayout: eintrag.praesentationslayout ?? "standard",
      kategorien: eintrag.fragen.fragen_kategorien.map(
        (k) => k.fragenkategorie.kategorie
      ),
    })),
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
  const fragen = await prisma.fragen.findMany({
    where: {
      ist_archiviert: false,
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
    kategorien: frage.fragen_kategorien.map(
      (k) => k.fragenkategorie.kategorie
    ),
    ist_bereits_im_quiz: frage.quiz_fragen.length > 0,
  }));
}

export async function addFrageToQuiz(data: {
  quizId: number;
  fragenId: number;
}) {
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

  const antwortIds = frage.antworten.map(
    (antwort) => antwort.antwort_id
  );

  const gemischteAntwortIds = [...antwortIds].sort(
    () => Math.random() - 0.5
  );

  const naechsteSortierung = (letzterEintrag?.sortierung ?? 0) + 1;

  await prisma.quiz_fragen.create({
    data: {
      quiz_id: data.quizId,
      fragen_id: data.fragenId,
      sortierung: naechsteSortierung,
      antwort_reihenfolge: gemischteAntwortIds,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);
  revalidatePath("/fragen");
}

export async function removeFrageFromQuiz(data: {
  quizId: number;
  quizFragenId: number;
}) {
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
      })
    )
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
      })
    )
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
  fragenId: number
): Promise<FrageVorschauResult | null> {
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
    kategorien: frage.fragen_kategorien.map(
      (k) => k.fragenkategorie.kategorie
    ),
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

    punkte_modus: string;

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
  quizId: number
): Promise<QuizPraesentationResult | null> {
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
    fragen: quiz.quiz_fragen.map((eintrag) => ({
      quiz_fragen_id: eintrag.quiz_fragen_id,
      quiz_abschnitt_id: eintrag.quiz_abschnitt_id,
      sortierung: eintrag.sortierung,

      fragen_id: eintrag.fragen.fragen_id,
      frage: eintrag.fragen.frage,

      punkte_modus: eintrag.punkte_modus ?? "standard",

      praesentationslayout: eintrag.praesentationslayout ?? "standard",
      antwort_reihenfolge: eintrag.antwort_reihenfolge,
      quelle: eintrag.fragen.quelle,
      kategorien: eintrag.fragen.fragen_kategorien.map(
        (k) => k.fragenkategorie.kategorie
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
          medium.medientyp.medientyp.toLowerCase().includes("bild")
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
        loesungen: feld.loesungen.map((loesung) => ({
          loesung_text: loesung.loesung_text,
          sortierung: loesung.sortierung,
          ist_akzeptiert: loesung.ist_akzeptiert,
        })),
      })),
    })),
  };
}
export async function updatePraesentationslayout(data: {
  quizFragenId: number;
  praesentationslayout: string;
  quizId: number;
}) {
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

export async function updateQuizAbschnitteSortierung(data: {
  quizId: number;
  items: {
    quizAbschnittId: number;
    sortierung: number;
  }[];
}) {
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
      })
    )
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
      })
    )
  );

  revalidatePath(`/quiz/${data.quizId}`);
}
export async function updateQuizFrageAbschnitt(data: {
  quizId: number;
  quizFragenId: number;
  quizAbschnittId: number | null;
}) {
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
      })
    )
  );

  await prisma.$transaction(
    data.items.map((item) =>
      prisma.quiz_fragen.update({
        where: {
          quiz_fragen_id: item.quizFragenId,
        },
        data: {
          quiz_abschnitt_id: item.quizAbschnittId,
          sortierung: item.sortierung,
        },
      })
    )
  );

  revalidatePath(`/quiz/${data.quizId}`);
}
export async function getQuizAntwortStatus(
  quizId: number,
  quizTeamSessionId?: number
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
            },
          },
        },
      },
    },
  });

  if (!quiz) {
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
        ["fragenrunde", "fragenblock"].includes(
          abschnitt.abschnitt_typ
        ) &&
        abschnitt.ist_freigegeben &&
        !abschnitt.ist_geschlossen
    ) ??
    abschnitte.find(
      (abschnitt) =>
        ["fragenrunde", "fragenblock"].includes(
          abschnitt.abschnitt_typ
        ) &&
        abschnitt.ist_geschlossen
    );

  const blockIstGesperrt = aktuellerBlock?.ist_geschlossen ?? false;

  const blockFreigabe = quiz.quiz_abschnitte.find(
    (abschnitt) =>
      abschnitt.quiz_abschnitt_id === aktuellerBlock?.quiz_abschnitt_id
  )?.quiz_block_freigaben[0];

  const aktuelleQuizFragenId =
    blockFreigabe?.aktuelle_quiz_fragen_id ?? null;

  const gespeicherteAntworten = quizTeamSessionId
    ? await prisma.team_antworten.findMany({
      where: {
        quiz_team_session_id: quizTeamSessionId,
      },
      include: {
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
          Number(aktuellerBlock.quiz_abschnitt_id)
      )
      .sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0))
    : [];

  const aktuelleFrageIndex = fragenImAktuellenBlock.findIndex(
    (eintrag) => eintrag.quiz_fragen_id === aktuelleQuizFragenId
  );

  const fragen =
    aktuellerBlock && !blockIstGesperrt
      ? fragenImAktuellenBlock.map((eintrag, index) => {
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

        const istFreigegeben =
          aktuelleFrageIndex >= 0 && index <= aktuelleFrageIndex;

        const gespeicherteAntwort = gespeicherteAntworten.find(
          (antwort) => antwort.quiz_fragen_id === eintrag.quiz_fragen_id
        );

        return {
          quiz_fragen_id: eintrag.quiz_fragen_id,
          fragen_id: eintrag.fragen.fragen_id,
          frage: eintrag.fragen.frage,
          istFreigegeben,
          punkte_modus: eintrag.punkte_modus ?? "standard",

          bildMedien: (eintrag.fragen.medien ?? [])
            .filter((medium) =>
              medium.medientyp.medientyp.toLowerCase().includes("bild")
            )
            .map((medium) => ({
              medien_id: medium.medien_id,
              datei: medium.datei,
              medientyp: medium.medientyp.medientyp,
            })),

          antwortfelder: (eintrag.fragen.antwortfelder ?? []).map(
            (feld) => ({
              antwortfeld_id: feld.antwortfeld_id,
              label: feld.label,
              sortierung: feld.sortierung,
              ist_pflicht: feld.ist_pflicht,
            })
          ),

          gespeicherteAntwort: gespeicherteAntwort
            ? {
              antwortId: gespeicherteAntwort.antwort_id,
              antwortText: gespeicherteAntwort.antwort_text,
              antwortfelder: (
                gespeicherteAntwort.antwortfelder ?? []
              ).map((feld) => ({
                antwortfeldId: feld.antwortfeld_id,
                antwortText: feld.antwort_text,
              })),
            }
            : null,

          antworten: antworten
            .filter(
              (antwort) => antwort.antworttyp.antworttyp !== "Freitext"
            )
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
    if (
      team.team_passwort &&
      team.team_passwort !== data.passwort
    ) {
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
      teamPasswort: team.team_passwort,
    },
  };
}
export async function freigabeQuizBlock(data: {
  quizId: number;
  quizAbschnittId: number;
}) {
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
  quizTeamSessionId?: number
) {
  return getQuizAntwortStatus(quizId, quizTeamSessionId);
}
export async function saveTeamAntwort(data: {
  quizId: number;
  quizAbschnittId: number;
  quizFragenId: number;
  quizTeamSessionId: number;
  antwortText: string | null;
  antwortId: number | null;
  antwortfelder?: {
    antwortfeldId: number;
    antwortText: string | null;
  }[];
}) {
  const teamAntwort = await prisma.team_antworten.upsert({
    where: {
      quiz_fragen_id_quiz_team_session_id: {
        quiz_fragen_id: data.quizFragenId,
        quiz_team_session_id: data.quizTeamSessionId,
      },
    },
    update: {
      quiz_id: data.quizId,
      quiz_abschnitt_id: data.quizAbschnittId,
      antwort_text: data.antwortText,
      antwort_id: data.antwortId,
      aktualisiert_am: new Date(),
    },
    create: {
      quiz_id: data.quizId,
      quiz_abschnitt_id: data.quizAbschnittId,
      quiz_fragen_id: data.quizFragenId,
      quiz_team_session_id: data.quizTeamSessionId,
      antwort_text: data.antwortText,
      antwort_id: data.antwortId,
      aktualisiert_am: new Date(),
    },
  });

  if (data.antwortfelder) {
    await prisma.team_antwortfelder.deleteMany({
      where: {
        team_antwort_id: teamAntwort.team_antwort_id,
      },
    });

    const gefuellteFelder = data.antwortfelder.filter(
      (feld) => feld.antwortText?.trim()
    );

    if (gefuellteFelder.length > 0) {
      await prisma.team_antwortfelder.createMany({
        data: gefuellteFelder.map((feld) => ({
          team_antwort_id: teamAntwort.team_antwort_id,
          antwortfeld_id: feld.antwortfeldId,
          antwort_text: feld.antwortText?.trim() ?? null,
        })),
      });
    }
  }

  return {
    success: true,
  };
}
export async function getQuizFrageAuswertung(quizFragenId: number) {
  const quizFrage = await prisma.quiz_fragen.findUnique({
    where: {
      quiz_fragen_id: quizFragenId,
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
        },
      },
      team_antworten: {
        include: {
          quiz_team_sessions: true,
          antworten: true,
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
    (antwort) => antwort.antworttyp?.antworttyp !== "Freitext"
  );

  const istOffeneFrage = auswertbareAntwortoptionen.length === 0;

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
      const richtigeAntwortIds = quizFrage.fragen.antworten
        .filter((antwortOption) => antwortOption.ist_richtig)
        .map((antwortOption) => antwortOption.antwort_id);

      const istAutomatischRichtig =
        antwort.antwort_id !== null &&
        richtigeAntwortIds.includes(antwort.antwort_id);

      const istPruefpflichtig =
        istOffeneFrage || !istAutomatischRichtig;

      return {
        team_antwort_id: antwort.team_antwort_id,
        teamname: antwort.quiz_team_sessions.teamname,
        antwortText: antwort.antwort_text,
        antwortId: antwort.antwort_id,
        ausgewaehlteAntwort: antwort.antworten?.antwort ?? null,
        istAutomatischRichtig,
        istPruefpflichtig,
        istManuellRichtig: antwort.ist_manuell_richtig,
        istManuellFalsch: antwort.ist_manuell_falsch,
        bewerteteAntwort: antwort.bewertete_antwort,
        istSkurril: antwort.ist_skurril,
        bewertungFinal: antwort.bewertung_final,
      };
    }),
  };
}
export async function updateTeamAntwortBewertung(data: {
  quizId: number;
  teamAntwortId: number;
  aktion: "richtig" | "falsch" | "skurril" | "zuruecksetzen";
}) {
  if (data.aktion === "richtig") {
    await prisma.team_antworten.update({
      where: { team_antwort_id: data.teamAntwortId },
      data: {
        ist_manuell_richtig: true,
        ist_manuell_falsch: false,
      },
    });
  }

  if (data.aktion === "falsch") {
    await prisma.team_antworten.update({
      where: { team_antwort_id: data.teamAntwortId },
      data: {
        ist_manuell_richtig: false,
        ist_manuell_falsch: true,
      },
    });
  }

  if (data.aktion === "skurril") {
    const antwort = await prisma.team_antworten.findUnique({
      where: { team_antwort_id: data.teamAntwortId },
    });

    await prisma.team_antworten.update({
      where: { team_antwort_id: data.teamAntwortId },
      data: {
        ist_skurril: !(antwort?.ist_skurril ?? false),
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
      },
    });
  }

  revalidatePath(`/quiz/${data.quizId}/auswertung`);
}
export async function getQuizAuswertungUebersicht(quizId: number) {
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
        },
      },
      team_antworten: true,
    },
  });

  return quizFragen.map((quizFrage) => {
    const richtigeAntwortIds = quizFrage.fragen.antworten
      .filter((antwort) => antwort.ist_richtig)
      .map((antwort) => antwort.antwort_id);

    const istOffeneFrage = quizFrage.fragen.antworten.length <= 1;

    const pruefpflichtigeAntworten = quizFrage.team_antworten.filter(
      (antwort) => {
        const istAutomatischRichtig =
          antwort.antwort_id !== null &&
          richtigeAntwortIds.includes(antwort.antwort_id);

        return istOffeneFrage || !istAutomatischRichtig;
      }
    );

    const offenePruefungen = pruefpflichtigeAntworten.filter(
      (antwort) =>
        !antwort.ist_manuell_richtig &&
        !antwort.ist_manuell_falsch &&
        !antwort.bewertung_final
    ).length;

    const skurrileAntworten = quizFrage.team_antworten.filter(
      (antwort) => antwort.ist_skurril
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
          antworten: {
            include: {
              antworttyp: true,
            },
            orderBy: {
              antwort_id: "asc",
            },
          },
        },
      },
      team_antworten: {
        include: {
          quiz_team_sessions: true,
          antworten: true,
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

  return quizFragen.flatMap((quizFrage, frageIndex) => {
    const richtigeAntwortIds = quizFrage.fragen.antworten
      .filter((antwort) => antwort.ist_richtig)
      .map((antwort) => antwort.antwort_id);

    const richtigeAntworten = quizFrage.fragen.antworten
      .filter((antwort) => antwort.ist_richtig)
      .map((antwort) => antwort.antwort)
      .join(", ");

    const auswertbareAntwortoptionen = quizFrage.fragen.antworten.filter(
      (antwort) => antwort.antworttyp?.antworttyp !== "Freitext"
    );

    const istOffeneFrage = auswertbareAntwortoptionen.length === 0;

    return sessions.map((session) => {
      const antwort = quizFrage.team_antworten.find(
        (eintrag) =>
          eintrag.quiz_team_session_id === session.quiz_team_session_id
      );

      const istUnbeantwortet = !antwort;

      const istAutomatischRichtig =
        !!antwort &&
        antwort.antwort_id !== null &&
        richtigeAntwortIds.includes(antwort.antwort_id);

      const istPruefpflichtig =
        istUnbeantwortet || istOffeneFrage || !istAutomatischRichtig;

      return {
        quiz_fragen_id: quizFrage.quiz_fragen_id,
        fragen_id: quizFrage.fragen.fragen_id,
        frageIndex: frageIndex + 1,
        frage: quizFrage.fragen.frage,
        richtigeAntwort: richtigeAntworten || "-",

        team_antwort_id: antwort?.team_antwort_id ?? null,
        teamname: session.teamname,
        antwortText: antwort?.antwort_text ?? null,
        antwortId: antwort?.antwort_id ?? null,
        ausgewaehlteAntwort: antwort?.antworten?.antwort ?? null,
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
      };
    });
  });
}
export async function updateQuizFragePunkteModus(data: {
  quizId: number;
  quizFragenId: number;
  punkteModus: string;
}) {
  await prisma.quiz_fragen.update({
    where: {
      quiz_fragen_id: data.quizFragenId,
    },
    data: {
      punkte_modus: data.punkteModus,
    },
  });

  revalidatePath(`/quiz/${data.quizId}`);
  revalidatePath(`/quiz/${data.quizId}/auswertung`);

  return {
    success: true,
  };
}
export async function getQuizPunktestand(quizId: number) {
  const antworten = await getQuizAuswertungAlleAntworten(quizId);

  const teams = Array.from(new Set(antworten.map((antwort) => antwort.teamname)));

  const fragen = Array.from(
    new Map(
      antworten.map((antwort) => [
        antwort.quiz_fragen_id,
        {
          quiz_fragen_id: antwort.quiz_fragen_id,
          frageIndex: antwort.frageIndex,
          punkteModus: antwort.punkte_modus ?? "standard",
        },
      ])
    ).values()
  );

  const punkteJeTeam = teams.map((teamname) => ({
    teamname,
    punkte: 0,
    details: [] as {
      quizFragenId: number;
      frageIndex: number;
      punkte: number;
      punkteModus: string;
    }[],
  }));

  for (const frage of fragen) {
    const antwortenZurFrage = antworten.filter(
      (antwort) => antwort.quiz_fragen_id === frage.quiz_fragen_id
    );

    const richtigeAntworten = antwortenZurFrage.filter((antwort) => {
      if (antwort.istUnbeantwortet) return false;
      if (antwort.istManuellFalsch) return false;
      if (antwort.istManuellRichtig) return true;
      return antwort.istAutomatischRichtig;
    });

    const anzahlTeams = teams.length;
    const anzahlRichtig = richtigeAntworten.length;

    for (const antwort of antwortenZurFrage) {
      const istRichtig = richtigeAntworten.some(
        (richtigeAntwort) =>
          richtigeAntwort.teamname === antwort.teamname &&
          richtigeAntwort.quiz_fragen_id === antwort.quiz_fragen_id
      );

      if (!istRichtig) continue;

      let punkte = 1;

      if (frage.punkteModus === "expertenbonus") {
        punkte = anzahlRichtig === 1 ? 2 : 1;
      }

      if (frage.punkteModus === "risikofrage") {
        punkte =
          anzahlRichtig > 0
            ? Math.max(1, anzahlTeams / anzahlRichtig)
            : 0;
      }

      const team = punkteJeTeam.find(
        (eintrag) => eintrag.teamname === antwort.teamname
      );

      if (team) {
        team.punkte += punkte;
        team.details.push({
          quizFragenId: frage.quiz_fragen_id,
          frageIndex: frage.frageIndex,
          punkte,
          punkteModus: frage.punkteModus,
        });
      }
    }
  }

  return punkteJeTeam.sort((a, b) => b.punkte - a.punkte);
}

export async function getZufaelligeSchaetzfrage() {
  const fragen = await prisma.fragen.findMany({
    where: {
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
export async function getSchnellQuizKategorien() {
  return prisma.fragenkategorie.findMany({
    orderBy: {
      kategorie: "asc",
    },
  });
}

export async function createSchnellQuiz(data: {
  titel: string;
  quizDatum: string;
  anzahlBloecke: number;
  fragenProBlock: number;
  kategorieIds: number[];
  medienFilter: "alle" | "nurMitMedien" | "nurOhneMedien";
  nurBereitsVerwendete: boolean;
  preisPlatz1: string;
  preisPlatz2: string;
  preisPlatz3: string;
}) {
  if (!data.titel.trim()) {
    return {
      success: false,
      message: "Bitte einen Titel eingeben.",
      quizId: null,
    };
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
      ist_archiviert: false,

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
      titel: data.titel.trim(),
      quiz_datum: data.quizDatum ? new Date(data.quizDatum) : null,
      bemerkung: "Automatisch erstelltes Schnellquiz",
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
      (blockIndex + 1) * data.fragenProBlock
    );

    for (const [frageIndex, frage] of blockFragen.entries()) {
      const antwortReihenfolge = frage.antworten
        .map((antwort) => antwort.antwort_id)
        .sort(() => Math.random() - 0.5);

      await prisma.quiz_fragen.create({
        data: {
          quiz_id: quiz.quiz_id,
          fragen_id: frage.fragen_id,
          quiz_abschnitt_id: fragenrunde.quiz_abschnitt_id,
          sortierung: blockIndex * data.fragenProBlock + frageIndex + 1,
          antwort_reihenfolge: antwortReihenfolge,
        },
      });
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
        startsWith: "outro",
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
    ersterOutroAbschnitt?.sortierung ??
    (letzteSortierung?.sortierung ?? 0) + 1;

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
    data: [
      {
        quiz_id: quizId,
        titel: "Intro",
        abschnitt_typ: "intro",
        sortierung: 1,
      },
      {
        quiz_id: quizId,
        titel: "Fragenblock 1",
        abschnitt_typ: "fragenblock",
        sortierung: 2,
      },
      {
        quiz_id: quizId,
        titel: "Outro",
        abschnitt_typ: "outro",
        sortierung: 3,
      },
    ],
  });
}
async function createSchnellquizAbschnitte(
  quizId: number,
  anzahlBloecke: number
) {
  await prisma.quiz_abschnitte.createMany({
    data: [
      {
        quiz_id: quizId,
        titel: "Intro",
        abschnitt_typ: "intro",
        sortierung: 1,
      },
      ...Array.from({ length: anzahlBloecke }, (_, index) => ({
        quiz_id: quizId,
        titel: `Fragenblock ${index + 1}`,
        abschnitt_typ: "fragenblock",
        sortierung: index + 2,
      })),
      {
        quiz_id: quizId,
        titel: "Outro",
        abschnitt_typ: "outro",
        sortierung: anzahlBloecke + 2,
      },
    ],
  });
}
export async function updateIntroStartsequenz(data: {
  quizId: number;
  audioUrl: string;
  text: string;
}) {
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