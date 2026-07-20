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
import { canEditGlobalQuestions, getActorEventSeriesIds, isAdministrator } from "@/app/roles/roleAssignmentPolicy";

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
  const baseCapabilities = getQuestionEditorCapabilities(actor);
  const canApproveInAnySeries = isAdministrator(actor) || getActorEventSeriesIds(actor, "EVENT_MANAGER").length > 0;

  return (
    <QuestionEditor
      capabilities={{
        ...baseCapabilities,
        canSaveDraft: true,
        canApproveQuestion: canApproveInAnySeries,
        canSubmitForReview: !isAdministrator(actor),
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
        canSelectGlobal: canEditGlobalQuestions(actor),
        eventSeries: eventSeries.map((series) => ({ id: series.eventreihe_id, name: series.name })),
      }}
    />
  );
}
