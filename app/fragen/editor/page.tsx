import { prisma } from "@/lib/prisma";
import {
  getQuestionEditorCapabilities,
  requireQuestionEditor,
} from "@/app/lib/permissions";
import { QuestionEditor } from "./components/QuestionEditor";
import { getMediaUploadEnvironmentPrefix } from "./mediaUploadEnvironment";
import { getDefaultLocale } from "@/app/i18n/locale";
import { getQuestionEditorMessages } from "@/app/i18n/getMessages";
import { localizeQuestionTemplates } from "./templates/questionTemplates";
import { getAssignableQuestionEventSeries, getQuestionActor } from "./questionAccess.server";

export default async function QuestionEditorPage() {
  const session = await requireQuestionEditor();
  const { locale, messages } = getQuestionEditorMessages(getDefaultLocale());
  const [categories, eventSeries, actor] = await Promise.all([prisma.fragenkategorie.findMany({
    orderBy: { kategorie: "asc" },
    select: {
      fragenkategorie_id: true,
      kategorie: true,
    },
  }), getAssignableQuestionEventSeries(session), getQuestionActor(session)]);
  const baseCapabilities = getQuestionEditorCapabilities(session);
  const canApproveInAnySeries = actor.globalRole === "ADMIN" || [...actor.assignments.values()].includes("EVENT_MANAGER");

  return (
    <QuestionEditor
      capabilities={{
        ...baseCapabilities,
        canSaveDraft: true,
        canApproveQuestion: canApproveInAnySeries,
        canSubmitForReview: actor.globalRole !== "ADMIN",
      }}
      editorContext="create"
      mediaUploadPathnamePrefix={getMediaUploadEnvironmentPrefix()}
      locale={locale}
      messages={messages}
      templates={localizeQuestionTemplates(messages)}
      categories={categories.map((category) => ({
        id: category.fragenkategorie_id,
        name: category.kategorie,
      }))}
      scopeOptions={{
        canSelectGlobal:
          actor.globalRole === "ADMIN" || actor.globalRole === "EDITOR",
        eventSeries: eventSeries.map((series) => ({ id: series.eventreihe_id, name: series.name })),
      }}
    />
  );
}
