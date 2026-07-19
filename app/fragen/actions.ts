"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { Buffer } from "buffer";
import { createQuestion } from "@/app/services/questionService";
import {
  canCloneQuestion,
  requireAdmin,
  requireQuestionEditor,
} from "@/app/lib/permissions";
import { requireUser } from "../lib/auth-guard";

function getMedientypIdAusDatei(datei: string) {
  const lower = datei.toLowerCase();

  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".svg")
  ) {
    return 1;
  }

  if (
    lower.endsWith(".mp3") ||
    lower.endsWith(".wav") ||
    lower.endsWith(".m4a") ||
    lower.endsWith(".ogg")
  ) {
    return 2;
  }

  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov")
  ) {
    return 3;
  }

  return 1;
}

type FragenImportZeile = {
  frage: string;
  antworten: string[];
  richtige_antworten: string[];
  kategorie: string;
  quelle: string;
  frage_medien: string[];
  antwort_medien: Record<number, string[]>;
};

export type FrageSuchResult = {
  fragen_id: number;
  frage: string;
  quelle: string | null;
  schwierigkeitslevel: string | null;
  kategorien: string[];
  antworten_anzahl: number;
  medien_anzahl: number;
  medien_frage_anzahl: number;
  medien_antworten_anzahl: number;
  quiz_anzahl: number;
  ist_archiviert: boolean;
  archivierungsgrund: string | null;
  review_status: "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";
  gueltig_bis: string | null;
  can_clone: boolean;
  quizze: {
    quiz_id: number;
    titel: string | null;
    quiz_datum: string | null;
    ist_archiviert: boolean;
  }[];
};

export type FrageDetailsResult = {
  fragen_id: number;
  frage: string;
  quelle: string | null;
  schwierigkeitslevel: string | null;
  erstellungsdatum: string;
  kategorien: string[];
  antworten: {
    antwort_id: number;
    antwort: string;
    ist_richtig: boolean;
    antworttyp: string;
    medien: {
      medien_id: number;
      datei: string;
      sortierung: number;
      bemerkung: string | null;
      medientyp: string;
    }[];
  }[];
  medien: {
    medien_id: number;
    datei: string;
    sortierung: number;
    bemerkung: string | null;
    medientyp: string;
  }[];
  quiz: {
    quiz_id: number;
    titel: string | null;
    quiz_datum: string | null;
    sortierung: number | null;
    richtigeantworten: number | null;
    falscheantworten: number | null;
  }[];
};

export async function searchFragen(data: {
  suchtext: string;
  kategorieId: number | null;
  quelle: string;
  nurOhneMedien: boolean;
  nurOhneAntworten: boolean;
  archivStatus: "alle" | "aktiv" | "archiviert";
  limit?: number;
  offset?: number;
}) {
  const session = await requireQuestionEditor();
  const limit = data.limit ?? 50;
  const offset = data.offset ?? 0;

  const where = {
    frage: data.suchtext.trim()
      ? {
          contains: data.suchtext.trim(),
          mode: "insensitive" as const,
        }
      : undefined,

    quelle: data.quelle.trim()
      ? {
          contains: data.quelle.trim(),
          mode: "insensitive" as const,
        }
      : undefined,

    ist_archiviert:
      data.archivStatus === "aktiv"
        ? false
        : data.archivStatus === "archiviert"
          ? true
          : undefined,

    fragen_kategorien: data.kategorieId
      ? {
          some: {
            fragenkategorie_id: data.kategorieId,
          },
        }
      : undefined,

    medien: data.nurOhneMedien
      ? {
          none: {},
        }
      : undefined,

    antworten: data.nurOhneAntworten
      ? {
          none: {},
        }
      : undefined,
  };

  const fragen = await prisma.fragen.findMany({
    where,
    include: {
      fragen_kategorien: {
        include: {
          fragenkategorie: true,
        },
      },
      antworten: {
        include: {
          medien: true,
        },
      },
      medien: true,
      quiz_fragen: {
        include: {
          quiz: true,
        },
      },
    },
    orderBy: {
      fragen_id: "desc",
    },
    skip: offset,
    take: limit + 1,
  });

  const hasMore = fragen.length > limit;
  const sichtbareFragen = fragen.slice(0, limit);

  const results = sichtbareFragen.map((frage) => {
    const medienAntwortenAnzahl = frage.antworten.reduce(
      (summe, antwort) => summe + antwort.medien.length,
      0,
    );

    return {
      fragen_id: frage.fragen_id,
      frage: frage.frage,
      quelle: frage.quelle,
      schwierigkeitslevel: frage.schwierigkeitslevel?.toString() ?? null,
      ist_archiviert: frage.ist_archiviert,
      archivierungsgrund: frage.archivierungsgrund,
      review_status: frage.review_status,
      gueltig_bis: frage.gueltig_bis?.toISOString().slice(0, 10) ?? null,
      can_clone: canCloneQuestion(session, {
        createdByUserId: frage.created_by_user_id,
        reviewStatus: frage.review_status,
        isArchived: frage.ist_archiviert,
      }),
      kategorien: frage.fragen_kategorien.map(
        (k) => k.fragenkategorie.kategorie,
      ),
      antworten_anzahl: frage.antworten.length,
      medien_frage_anzahl: frage.medien.length,
      medien_antworten_anzahl: medienAntwortenAnzahl,
      medien_anzahl: frage.medien.length + medienAntwortenAnzahl,
      quiz_anzahl: frage.quiz_fragen.length,
      quizze: frage.quiz_fragen.map((qf) => ({
        quiz_id: qf.quiz.quiz_id,
        titel: qf.quiz.titel,
        quiz_datum: qf.quiz.quiz_datum
          ? qf.quiz.quiz_datum.toISOString().split("T")[0]
          : null,
        ist_archiviert: qf.quiz.ist_archiviert,
      })),
    };
  });

  return {
    results,
    hasMore,
    nextOffset: offset + results.length,
  };
}

export async function getFrageDetails(
  fragenId: number,
): Promise<FrageDetailsResult | null> {
  await requireQuestionEditor();
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
      quiz_fragen: {
        include: {
          quiz: true,
        },
        orderBy: {
          quiz_id: "desc",
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
    erstellungsdatum: frage.erstellungsdatum.toISOString().slice(0, 10),
    kategorien: frage.fragen_kategorien.map((k) => k.fragenkategorie.kategorie),
    medien: frage.medien.map((medium) => ({
      medien_id: medium.medien_id,
      datei: medium.datei,
      sortierung: medium.sortierung,
      bemerkung: medium.bemerkung,
      medientyp: medium.medientyp.medientyp,
    })),
    antworten: frage.antworten.map((antwort) => ({
      antwort_id: antwort.antwort_id,
      antwort: antwort.antwort,
      ist_richtig: antwort.ist_richtig,
      antworttyp: antwort.antworttyp.antworttyp,
      medien: antwort.medien.map((medium) => ({
        medien_id: medium.medien_id,
        datei: medium.datei,
        sortierung: medium.sortierung,
        bemerkung: medium.bemerkung,
        medientyp: medium.medientyp.medientyp,
      })),
    })),
    quiz: frage.quiz_fragen.map((quizFrage) => ({
      quiz_id: quizFrage.quiz_id,
      titel: quizFrage.quiz.titel,
      quiz_datum: quizFrage.quiz.quiz_datum
        ? quizFrage.quiz.quiz_datum.toISOString().slice(0, 10)
        : null,
      sortierung: quizFrage.sortierung,
      richtigeantworten: quizFrage.richtigeantworten,
      falscheantworten: quizFrage.falscheantworten,
    })),
  };
}

export async function getFrageForEdit(fragenId: number) {
  await requireQuestionEditor();
  const frage = await prisma.fragen.findUnique({
    where: {
      fragen_id: fragenId,
    },
    include: {
      fragen_kategorien: true,
      medien: {
        orderBy: {
          sortierung: "asc",
        },
      },
      antworten: {
        include: {
          medien: {
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

  return frage;
}

export async function updateFrage(data: {
  fragenId: number;
  frage: string;
  quelle: string | null;
  schwierigkeitslevel: number | null;
  kategorieIds: number[];
  neueKategorien: string[];
  medienZurFrage: {
    datei: string;
    medientyp_id: number;
    sortierung: number;
  }[];
  antworten: {
    antwort: string;
    ist_richtig: boolean;
    antworttyp_id: number;
    medien: {
      datei: string;
      medientyp_id: number;
      sortierung: number;
    }[];
  }[];
}) {
  await requireQuestionEditor();
  await prisma.fragen.update({
    where: {
      fragen_id: data.fragenId,
    },
    data: {
      frage: data.frage.trim(),
      quelle: data.quelle?.trim() || null,
    },
  });

  await prisma.fragen_kategorien.deleteMany({
    where: {
      fragen_id: data.fragenId,
    },
  });

  const kategorieIds = [...data.kategorieIds];

  for (const neueKategorieName of data.neueKategorien) {
    const name = neueKategorieName.trim();

    if (!name) continue;

    const neueKategorie = await prisma.fragenkategorie.upsert({
      where: {
        kategorie: name,
      },
      update: {},
      create: {
        kategorie: name,
      },
    });

    if (!kategorieIds.includes(neueKategorie.fragenkategorie_id)) {
      kategorieIds.push(neueKategorie.fragenkategorie_id);
    }
  }

  if (kategorieIds.length > 0) {
    await prisma.fragen_kategorien.createMany({
      data: kategorieIds.map((kategorieId) => ({
        fragen_id: data.fragenId,
        fragenkategorie_id: kategorieId,
      })),
    });
  }

  await prisma.medien.deleteMany({
    where: {
      fragen_id: data.fragenId,
    },
  });

  const medienZurFrage = data.medienZurFrage.filter((medium) =>
    medium.datei.trim(),
  );

  if (medienZurFrage.length > 0) {
    await prisma.medien.createMany({
      data: medienZurFrage.map((medium, index) => ({
        fragen_id: data.fragenId,
        datei: medium.datei.trim(),
        medientyp_id: medium.medientyp_id,
        sortierung: medium.sortierung || index + 1,
      })),
    });
  }

  await prisma.antworten.deleteMany({
    where: {
      fragen_id: data.fragenId,
    },
  });

  const gueltigeAntworten = data.antworten.filter((antwort) =>
    antwort.antwort.trim(),
  );

  for (const antwort of gueltigeAntworten) {
    const gespeicherteAntwort = await prisma.antworten.create({
      data: {
        fragen_id: data.fragenId,
        antwort: antwort.antwort.trim(),
        ist_richtig: antwort.ist_richtig,
        antworttyp_id: antwort.antworttyp_id,
      },
    });

    const medienZurAntwort = antwort.medien.filter((medium) =>
      medium.datei.trim(),
    );

    if (medienZurAntwort.length > 0) {
      await prisma.medien.createMany({
        data: medienZurAntwort.map((medium, index) => ({
          antwort_id: gespeicherteAntwort.antwort_id,
          datei: medium.datei.trim(),
          medientyp_id: medium.medientyp_id,
          sortierung: medium.sortierung || index + 1,
        })),
      });
    }
  }

  revalidatePath("/fragen");

  return {
    success: true,
    message: "Frage wurde aktualisiert.",
  };
}

export async function archiveFrage(data: {
  fragenId: number;
  archivierungsgrund: string;
}) {
  await requireAdmin();
  await prisma.fragen.update({
    where: {
      fragen_id: data.fragenId,
    },
    data: {
      ist_archiviert: true,
      archivierungsgrund: data.archivierungsgrund.trim() || null,
    },
  });

  return {
    success: true,
  };
}

export async function restoreFrage(fragenId: number) {
  await requireAdmin();
  await prisma.fragen.update({
    where: {
      fragen_id: fragenId,
    },
    data: {
      ist_archiviert: false,
      archivierungsgrund: null,
    },
  });

  return {
    success: true,
  };
}

export async function uploadMediumDatei(formData: FormData): Promise<{
  success: boolean;
  datei?: string;
  message: string;
}> {
  await requireQuestionEditor();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return {
      success: false,
      message: "Keine Datei empfangen.",
    };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const originalName = file.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");

  const timestamp = Date.now();
  const fileName = `${timestamp}-${originalName}`;
  const mimeType = file.type.toLowerCase();

  let zielOrdner = "sonstige/uploads";

  if (mimeType.startsWith("image/")) {
    zielOrdner = "bilder/uploads";
  } else if (mimeType.startsWith("audio/")) {
    zielOrdner = "audio/uploads";
  } else if (mimeType.startsWith("video/")) {
    zielOrdner = "video/uploads";
  }

  const uploadDir = path.join(process.cwd(), "public", "medien", zielOrdner);

  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, fileName);

  await writeFile(filePath, buffer);

  return {
    success: true,
    datei: `${zielOrdner}/${fileName}`,
    message: "Datei wurde hochgeladen.",
  };
}

export async function pruefeFragenImport(zeilen: FragenImportZeile[]) {
  await requireAdmin();
  let importiert = 0;
  let uebersprungen = 0;

  const duplikate: {
    zeile: number;
    frage: string;
    grund: string;
  }[] = [];

  for (const [index, zeile] of zeilen.entries()) {
    const frageText = zeile.frage.trim();

    if (!frageText) {
      uebersprungen++;
      continue;
    }

    const vorhandeneFrage = await prisma.fragen.findFirst({
      where: {
        frage: {
          equals: frageText,
          mode: "insensitive",
        },
      },
      include: {
        antworten: true,
      },
    });

    if (vorhandeneFrage) {
      duplikate.push({
        zeile: index + 2,
        frage: frageText,
        grund: "Frage existiert bereits.",
      });

      uebersprungen++;
      continue;
    }

    importiert++;
  }

  return {
    importiert,
    uebersprungen,
    duplikate,
  };
}

export async function importFragenAusDatei(zeilen: FragenImportZeile[]) {
  await requireAdmin();
  let importiert = 0;
  let uebersprungen = 0;

  const duplikate: {
    zeile: number;
    frage: string;
    grund: string;
  }[] = [];

  const session = await requireUser();

  if (!session?.user) {
    throw new Error("Nicht eingeloggt.");
  }

  for (const [index, zeile] of zeilen.entries()) {
    const frageText = zeile.frage.trim();

    if (!frageText) {
      uebersprungen++;
      continue;
    }

    const vorhandeneFrage = await prisma.fragen.findFirst({
      where: {
        frage: {
          equals: frageText,
          mode: "insensitive",
        },
      },
      include: {
        antworten: true,
      },
    });

    if (vorhandeneFrage) {
      duplikate.push({
        zeile: index + 2,
        frage: frageText,
        grund: "Frage existiert bereits.",
      });

      uebersprungen++;
      continue;
    }

    const frage = await createQuestion(
      {
        frage: frageText,
        quelle: zeile.quelle.trim() || null,
        ist_archiviert: false,
      },
      session,
      false,
    );

    if (zeile.kategorie.trim()) {
      const kategorie = await prisma.fragenkategorie.upsert({
        where: {
          kategorie: zeile.kategorie.trim(),
        },
        update: {},
        create: {
          kategorie: zeile.kategorie.trim(),
        },
      });

      await prisma.fragen_kategorien.create({
        data: {
          fragen_id: frage.fragen_id,
          fragenkategorie_id: kategorie.fragenkategorie_id,
        },
      });
    }

    for (const [mediumIndex, datei] of zeile.frage_medien.entries()) {
      const trimmedDatei = datei.trim();

      if (!trimmedDatei) continue;

      await prisma.medien.create({
        data: {
          fragen_id: frage.fragen_id,
          datei: trimmedDatei,
          medientyp_id: getMedientypIdAusDatei(trimmedDatei),
          sortierung: mediumIndex + 1,
        },
      });
    }

    const richtigeAntworten = zeile.richtige_antworten
      .map((wert) => Number(wert))
      .filter((wert) => Number.isFinite(wert));

    const hatAntworten = zeile.antworten.length > 0;

    let antworttypId = 1;

    if (zeile.kategorie.trim().toLowerCase() === "schätzfrage") {
      antworttypId = 4;
    } else if (!hatAntworten) {
      antworttypId = 3;
    } else if (richtigeAntworten.length > 1) {
      antworttypId = 2;
    }

    for (const [antwortIndex, antwortText] of zeile.antworten.entries()) {
      const antwortNummer = antwortIndex + 1;
      const trimmedAntwort = antwortText.trim();

      if (!trimmedAntwort) continue;

      const gespeicherteAntwort = await prisma.antworten.create({
        data: {
          fragen_id: frage.fragen_id,
          antwort: trimmedAntwort,
          ist_richtig: richtigeAntworten.includes(antwortNummer),
          antworttyp_id: antworttypId,
        },
      });

      const medienZurAntwort = zeile.antwort_medien[antwortNummer] ?? [];

      for (const [mediumIndex, datei] of medienZurAntwort.entries()) {
        const trimmedDatei = datei.trim();

        if (!trimmedDatei) continue;

        await prisma.medien.create({
          data: {
            antwort_id: gespeicherteAntwort.antwort_id,
            datei: trimmedDatei,
            medientyp_id: getMedientypIdAusDatei(trimmedDatei),
            sortierung: mediumIndex + 1,
          },
        });
      }
    }

    importiert++;
  }

  revalidatePath("/fragen");

  return {
    success: true,
    importiert,
    uebersprungen,
    duplikate,
  };
}
