import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadLocalEnvironment } from "../scripts/load-local-environment";

loadLocalEnvironment({ required: true });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function createVorlage(data: {
  code: string;
  name: string;
  slide_typ: string;
  antwortfelder: {
    label: string;
    sortierung: number;
  }[];
}) {
  const vorlage = await prisma.frage_vorlagen.upsert({
    where: {
      code: data.code,
    },
    update: {
      name: data.name,
      slide_typ: data.slide_typ,
    },
    create: {
      code: data.code,
      name: data.name,
      slide_typ: data.slide_typ,
    },
  });

  await prisma.frage_vorlage_antwortfelder.deleteMany({
    where: {
      vorlage_id: vorlage.vorlage_id,
    },
  });

  for (const antwortfeld of data.antwortfelder) {
    await prisma.frage_vorlage_antwortfelder.create({
      data: {
        vorlage_id: vorlage.vorlage_id,
        label: antwortfeld.label,
        sortierung: antwortfeld.sortierung,
        ist_pflicht: true,
      },
    });
  }


}

async function main() {
  await createVorlage({
    code: "face_morph",
    name: "Face Morph",
    slide_typ: "image_dual_guess",
    antwortfelder: [
      {
        label: "Person A",
        sortierung: 1,
      },
      {
        label: "Person B",
        sortierung: 2,
      },
    ],
  });

  await createVorlage({
    code: "musik_rueckwaerts",
    name: "Musik rückwärts",
    slide_typ: "audio_guess",
    antwortfelder: [
      {
        label: "Interpret",
        sortierung: 1,
      },
      {
        label: "Songtitel",
        sortierung: 2,
      },
    ],
  });

  await createVorlage({
    code: "bild_raten",
    name: "Bild raten",
    slide_typ: "image_guess",
    antwortfelder: [
      {
        label: "Kunstwerkname",
        sortierung: 1,
      },
      {
        label: "Interpret",
        sortierung: 2,
      },
    ],
  });

  await createVorlage({
    code: "eight_bit",
    name: "8 Bit Song",
    slide_typ: "audio_guess",
    antwortfelder: [
      {
        label: "Songtitel",
        sortierung: 1,
      },
    ],
  });

  await createVorlage({
    code: "lyrics_translate",
    name: "Lyrics to translate",
    slide_typ: "text_audio_guess",
    antwortfelder: [
      {
        label: "Songtitel",
        sortierung: 1,
      },
    ],
  });

  await createVorlage({
    code: "land_erkennen",
    name: "Land erkennen",
    slide_typ: "image_or_text_guess",
    antwortfelder: [
      {
        label: "Land",
        sortierung: 1,
      },
    ],
  });

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
