import "server-only";

import { prisma } from "@/app/lib/prisma";
import { loadQuestionEditorMessages } from "@/app/i18n/questionEditorMessages";
import { runQuestionGenerator } from "./generators/service";
import {
  buildFaceMorphPixelQuestionPlan,
  FACE_MORPH_PIXEL_RELATION_TYPE,
  runFaceMorphPixelQuestionGenerators,
  type FaceMorphPixelSource,
} from "./faceMorphPixelQuestionPlan";
import {
  DEFAULT_PIXEL_TEMPLATE_CONFIG,
  normalizeQuestionTemplateConfig,
} from "./pixelTemplateConfig";
import {
  getQuestionTemplatePersistenceIds,
  questionTemplateIds,
  resolveCanonicalQuestionTemplateId,
} from "./templates/questionTemplateRegistry";
import type { FaceMorphPixelQuestionSyncResult } from "./types";

class FaceMorphPixelSyncError extends Error {}

type PreparedChild = {
  answerPosition: 1 | 2;
  questionId: number;
};

const messages = loadQuestionEditorMessages("de");

export async function synchronizeFaceMorphPixelQuestions(
  parentQuestionId: number,
  userId: number,
): Promise<FaceMorphPixelQuestionSyncResult> {
  try {
    const prepared = await prisma.$transaction(async (tx) => {
      const parent = await tx.fragen.findUnique({
        where: { fragen_id: parentQuestionId },
        select: {
          vorlage: { select: { code: true } },
          template_config_json: true,
          geltungsbereich: true,
          eventreihen: { select: { eventreihe_id: true } },
          fragen_kategorien: { select: { fragenkategorie_id: true } },
          antwortfelder: {
            orderBy: [{ sortierung: "asc" }, { antwortfeld_id: "asc" }],
            take: 2,
            select: {
              loesungen: {
                where: { ist_akzeptiert: true },
                orderBy: [{ sortierung: "asc" }, { loesung_id: "asc" }],
                select: { loesung_text: true, zusatzinformation: true },
              },
              medien: {
                orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
                select: { datei: true, medientyp_id: true },
              },
            },
          },
          relationen_als_quelle: {
            where: { typ: FACE_MORPH_PIXEL_RELATION_TYPE },
            orderBy: { antwort_position: "asc" },
            select: {
              fragen_relation_id: true,
              antwort_position: true,
              ziel_fragen_id: true,
              ist_aktiv: true,
              ziel_frage: {
                select: {
                  medien: {
                    where: { slot_key: "pixel_original_image" },
                    orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
                    select: { medien_id: true, datei: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!parent) {
        throw new FaceMorphPixelSyncError("FaceMorph-Frage fehlt.");
      }

      const templateId = resolveCanonicalQuestionTemplateId(
        parent.vorlage?.code ?? null,
      );
      const config = normalizeQuestionTemplateConfig(
        parent.template_config_json,
        templateId,
      );
      const options =
        templateId === questionTemplateIds.faceMorph && config
          ? config.createPixelQuestionByAnswer
          : { answer1: false, answer2: false };

      const sources: Array<
        FaceMorphPixelSource & {
          mediaTypeId: number;
          solutions: Array<{ text: string; additionalInfo: string | null }>;
        }
      > = parent.antwortfelder.flatMap((field, index) => {
        const answerPosition = (index + 1) as 1 | 2;
        const medium = field.medien.length === 1 ? field.medien[0] : null;
        const solutions = field.loesungen
          .map((solution) => ({
            text: solution.loesung_text.trim(),
            additionalInfo: solution.zusatzinformation,
          }))
          .filter((solution) => solution.text.length > 0);
        return medium && solutions.length > 0
          ? [{
              answerPosition,
              imageUrl: medium.datei,
              mediaTypeId: medium.medientyp_id,
              solutions,
            }]
          : [];
      });

      const plan = buildFaceMorphPixelQuestionPlan(
        options,
        sources,
        parent.relationen_als_quelle.flatMap((relation) => {
          if (relation.antwort_position !== 1 && relation.antwort_position !== 2) {
            return [];
          }
          return [{
            answerPosition: relation.antwort_position,
            childQuestionId: relation.ziel_fragen_id,
            active: relation.ist_aktiv,
            inputImageUrl: relation.ziel_frage.medien[0]?.datei ?? null,
          }];
        }),
      );

      const enabledPositions = ([1, 2] as const).filter(
        (position) => options[`answer${position}`],
      );
      if (
        enabledPositions.some(
          (position) => !sources.some((source) => source.answerPosition === position),
        )
      ) {
        throw new FaceMorphPixelSyncError(
          "Eine aktivierte FaceMorph-Antwort besitzt kein eindeutiges Bild oder keine richtige Antwort.",
        );
      }

      const pixelTemplate = plan.some((entry) => entry.action === "CREATE")
        ? await tx.frage_vorlagen.findFirst({
            where: {
              code: {
                in: [
                  ...getQuestionTemplatePersistenceIds(
                    questionTemplateIds.pixelImage,
                  ),
                ],
              },
            },
            orderBy: { vorlage_id: "asc" },
            select: { vorlage_id: true },
          })
        : null;
      if (plan.some((entry) => entry.action === "CREATE") && !pixelTemplate) {
        throw new FaceMorphPixelSyncError("Die Pixelbild-Vorlage fehlt.");
      }

      const preparedChildren: PreparedChild[] = [];
      const detachedQuestionIds: number[] = [];

      for (const entry of plan) {
        if (entry.action === "NONE") continue;

        if (entry.action === "DEACTIVATE") {
          await tx.fragen_relationen.update({
            where: {
              quell_fragen_id_typ_antwort_position: {
                quell_fragen_id: parentQuestionId,
                typ: FACE_MORPH_PIXEL_RELATION_TYPE,
                antwort_position: entry.answerPosition,
              },
            },
            data: { ist_aktiv: false },
          });
          detachedQuestionIds.push(entry.childQuestionId);
          continue;
        }

        const source = sources.find(
          (candidate) => candidate.answerPosition === entry.answerPosition,
        );
        if (!source) {
          throw new FaceMorphPixelSyncError("FaceMorph-Quelldaten fehlen.");
        }

        if (entry.action === "CREATE") {
          const child = await tx.fragen.create({
            data: {
              frage: messages.templates.pixelImage.defaultQuestion,
              geltungsbereich: parent.geltungsbereich,
              vorlage_id: pixelTemplate!.vorlage_id,
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
          await tx.fragen_relationen.create({
            data: {
              quell_fragen_id: parentQuestionId,
              ziel_fragen_id: child.fragen_id,
              antwort_position: entry.answerPosition,
              typ: FACE_MORPH_PIXEL_RELATION_TYPE,
              ist_aktiv: true,
            },
          });
          preparedChildren.push({
            answerPosition: entry.answerPosition,
            questionId: child.fragen_id,
          });
          continue;
        }

        if (entry.reactivate) {
          await tx.fragen_relationen.update({
            where: {
              quell_fragen_id_typ_antwort_position: {
                quell_fragen_id: parentQuestionId,
                typ: FACE_MORPH_PIXEL_RELATION_TYPE,
                antwort_position: entry.answerPosition,
              },
            },
            data: { ist_aktiv: true },
          });
        }
        if (entry.imageChanged) {
          const inputMedia = await tx.medien.findMany({
            where: {
              fragen_id: entry.childQuestionId,
              slot_key: "pixel_original_image",
            },
            orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
            select: { medien_id: true },
          });
          if (inputMedia.length > 1) {
            throw new FaceMorphPixelSyncError(
              "Die gekoppelte Pixelfrage besitzt mehrere Originalbilder.",
            );
          }
          if (inputMedia[0]) {
            await tx.medien.update({
              where: { medien_id: inputMedia[0].medien_id },
              data: {
                datei: source.imageUrl,
                medientyp_id: source.mediaTypeId,
              },
            });
          } else {
            await tx.medien.create({
              data: {
                fragen_id: entry.childQuestionId,
                medientyp_id: source.mediaTypeId,
                datei: source.imageUrl,
                slot_key: "pixel_original_image",
                sortierung: 1,
              },
            });
          }
          await tx.medien_generator_laefe.updateMany({
            where: {
              fragen_id: entry.childQuestionId,
              generator_id: "image_pixelate",
              status: "SUCCEEDED",
            },
            data: { status: "STALE", finished_at: new Date() },
          });
        }
        preparedChildren.push({
          answerPosition: entry.answerPosition,
          questionId: entry.childQuestionId,
        });
      }

      return { preparedChildren, detachedQuestionIds };
    });

    const children = await runFaceMorphPixelQuestionGenerators(
      prepared.preparedChildren,
      (questionId) => runQuestionGenerator(questionId, "image_pixelate"),
    );

    return {
      children,
      detachedQuestionIds: prepared.detachedQuestionIds,
    };
  } catch (error) {
    console.error("FaceMorph-Pixelfragen konnten nicht synchronisiert werden", {
      parentQuestionId,
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      children: [],
      detachedQuestionIds: [],
      errorCode: "FACE_MORPH_PIXEL_SYNC_FAILED",
    };
  }
}
