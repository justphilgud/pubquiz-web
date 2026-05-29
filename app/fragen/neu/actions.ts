"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type MediumInput = {
  datei: string;
  medientyp_id: number;
  sortierung: number;
};

type AntwortInput = {
  antwort: string;
  ist_richtig: boolean;
  antworttyp_id: number;
  medien: MediumInput[];
};

type AntwortfeldInput = {
  label: string;
  sortierung: number;
  ist_pflicht: boolean;
  loesungen: {
    loesung_text: string;
    sortierung: number;
    ist_akzeptiert: boolean;
  }[];
};

export async function getFrageVorlagen() {
  return prisma.frage_vorlagen.findMany({
    where: {
      ist_aktiv: true,
    },
    orderBy: {
      name: "asc",
    },
    include: {
      antwortfelder: {
        orderBy: {
          sortierung: "asc",
        },
      },
    },
  });
}

export async function getOffeneQuizzesForFrageForm() {
  return prisma.quiz.findMany({
    where: {
      ist_archiviert: false,
    },
    orderBy: [
      {
        quiz_datum: "asc",
      },
      {
        quiz_id: "asc",
      },
    ],
    select: {
      quiz_id: true,
      titel: true,
      quiz_datum: true,
    },
  });
}

export async function saveFrage(data: {
  frage: string;
  quelle: string;
  kategorien: number[];
  neueKategorie: string;
  medienZurFrage: MediumInput[];
  antworten: AntwortInput[];

  vorlageId?: number | null;
  antwortfelder?: AntwortfeldInput[];
  quizIds?: number[];
}) {
  const frageText = data.frage.trim();

  if (!frageText) {
    return {
      success: false,
      message: "Bitte eine Frage eingeben.",
    };
  }

  const gefuellteAntworten = data.antworten.filter(
    (a) => a.antwort.trim() !== ""
  );

  const gefuellteAntwortfelder = (data.antwortfelder ?? [])
    .map((feld, index) => ({
      label: feld.label.trim(),
      sortierung: feld.sortierung || index + 1,
      ist_pflicht: feld.ist_pflicht,
      loesungen: feld.loesungen
        .filter((loesung) => loesung.loesung_text.trim() !== "")
        .map((loesung, loesungIndex) => ({
          loesung_text: loesung.loesung_text.trim(),
          sortierung: loesung.sortierung || loesungIndex + 1,
          ist_akzeptiert: loesung.ist_akzeptiert,
        })),
    }))
    .filter((feld) => feld.label !== "");

  const nutztAntwortfelder = gefuellteAntwortfelder.length > 0;

  if (!nutztAntwortfelder && gefuellteAntworten.length === 0) {
    return {
      success: false,
      message: "Bitte mindestens eine Antwort oder ein Antwortfeld eingeben.",
    };
  }

  if (!nutztAntwortfelder && !gefuellteAntworten.some((a) => a.ist_richtig)) {
    return {
      success: false,
      message: "Bitte mindestens eine Antwort als richtig markieren.",
    };
  }

  if (
    nutztAntwortfelder &&
    gefuellteAntwortfelder.some((feld) => feld.loesungen.length === 0)
  ) {
    return {
      success: false,
      message:
        "Bitte für jedes Antwortfeld mindestens eine richtige Lösung eingeben.",
    };
  }

  const gefuellteMedienZurFrage = data.medienZurFrage.filter(
    (m) => m.datei.trim() !== ""
  );

  const neueKategorieText = data.neueKategorie.trim();

  const neueKategorie = neueKategorieText
    ? await prisma.fragenkategorie.upsert({
        where: { kategorie: neueKategorieText },
        update: {},
        create: { kategorie: neueKategorieText },
      })
    : null;

  const kategorieIds = [
    ...data.kategorien,
    ...(neueKategorie ? [neueKategorie.fragenkategorie_id] : []),
  ];

  const neueFrage = await prisma.$transaction(async (tx) => {
    const createdFrage = await tx.fragen.create({
      data: {
        frage: frageText,
        quelle: data.quelle.trim() || null,
        vorlage_id: data.vorlageId || null,

        fragen_kategorien: {
          create: kategorieIds.map((id) => ({
            fragenkategorie: {
              connect: {
                fragenkategorie_id: id,
              },
            },
          })),
        },

        medien: {
          create: gefuellteMedienZurFrage.map((medium, index) => ({
            datei: medium.datei.trim().replaceAll('"', ""),
            sortierung: medium.sortierung || index + 1,
            medientyp: {
              connect: {
                medientyp_id: medium.medientyp_id,
              },
            },
          })),
        },

        antworten: {
          create: gefuellteAntworten.map((antwort) => ({
            antwort: antwort.antwort.trim(),
            ist_richtig: antwort.ist_richtig,

            antworttyp: {
              connect: {
                antworttyp_id: antwort.antworttyp_id,
              },
            },

            medien: {
              create: antwort.medien
                .filter((medium) => medium.datei.trim() !== "")
                .map((medium, index) => ({
                  datei: medium.datei.trim().replaceAll('"', ""),
                  sortierung: medium.sortierung || index + 1,
                  medientyp: {
                    connect: {
                      medientyp_id: medium.medientyp_id,
                    },
                  },
                })),
            },
          })),
        },

        antwortfelder: {
          create: gefuellteAntwortfelder.map((feld) => ({
            label: feld.label,
            sortierung: feld.sortierung,
            ist_pflicht: feld.ist_pflicht,
            loesungen: {
              create: feld.loesungen.map((loesung) => ({
                loesung_text: loesung.loesung_text,
                sortierung: loesung.sortierung,
                ist_akzeptiert: loesung.ist_akzeptiert,
              })),
            },
          })),
        },
      },
    });

    for (const quizId of data.quizIds ?? []) {
      const letzterEintrag = await tx.quiz_fragen.findFirst({
        where: {
          quiz_id: quizId,
        },
        orderBy: {
          sortierung: "desc",
        },
        select: {
          sortierung: true,
        },
      });

      await tx.quiz_fragen.create({
        data: {
          quiz_id: quizId,
          fragen_id: createdFrage.fragen_id,
          sortierung: (letzterEintrag?.sortierung ?? 0) + 1,
        },
      });
    }

    return createdFrage;
  });

  revalidatePath("/");
  revalidatePath("/fragen/neu");

  for (const quizId of data.quizIds ?? []) {
    revalidatePath(`/quiz/${quizId}`);
  }

  return {
    success: true,
    message: `Frage wurde gespeichert. ID: ${neueFrage.fragen_id}`,
  };
}