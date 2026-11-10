import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { loadQuestionEditorMessages } from "@/app/i18n/questionEditorMessages";
import { DEFAULT_PIXEL_TEMPLATE_CONFIG } from "./pixelTemplateConfig";

export async function createDerivedPixelQuestion(
  tx: Prisma.TransactionClient,
  templateId: number,
  userId: number,
  parent: {
    geltungsbereich: "GLOBAL" | "EVENT_SERIES";
    eventreihen: { eventreihe_id: number }[];
    fragen_kategorien: { fragenkategorie_id: number }[];
  },
  source: {
    imageUrl: string;
    mediaTypeId: number;
    solutions: { text: string; additionalInfo: string | null }[];
  },
) {
  const messages = loadQuestionEditorMessages("de");
  const child = await tx.fragen.create({
    data: {
      frage: messages.templates.pixelImage.defaultQuestion,
      geltungsbereich: parent.geltungsbereich,
      vorlage_id: templateId,
      template_config_json: DEFAULT_PIXEL_TEMPLATE_CONFIG,
      ist_archiviert: false,
      ist_unfertig: true,
      freigegeben: false,
      review_status: "DRAFT",
      created_by_user_id: userId,
      last_modified_by_user_id: userId,
      fragen_kategorien: {
        create: parent.fragen_kategorien.map((category) => ({
          fragenkategorie: {
            connect: {
              fragenkategorie_id: category.fragenkategorie_id,
            },
          },
        })),
      },
      eventreihen: parent.geltungsbereich === "EVENT_SERIES"
        ? { create: parent.eventreihen.map((entry) => ({ eventreihe_id: entry.eventreihe_id })) }
        : undefined,
      antwortfelder: {
        create: {
          label: messages.templateFields.solution,
          sortierung: 1,
          ist_pflicht: true,
          loesungen: {
            create: source.solutions.map((solution, index) => ({
              loesung_text: solution.text,
              sortierung: index + 1,
              ist_akzeptiert: true,
              zusatzinformation: solution.additionalInfo,
            })),
          },
        },
      },
      medien: {
        create: {
          medientyp_id: source.mediaTypeId,
          datei: source.imageUrl,
          slot_key: "pixel_original_image",
          sortierung: 1,
        },
      },
    },
    select: { fragen_id: true },
  });
  return child;
}
