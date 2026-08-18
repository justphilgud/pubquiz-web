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
import { loadDynamicQuestionTemplates } from "./templates/dynamicQuestionTemplates.server";
import { getAssignableQuestionEventSeries, getQuestionActor } from "./questionAccess.server";
import { canEditGlobalQuestions, getActorEventSeriesIds, isAdministrator } from "@/app/roles/roleAssignmentPolicy";
import { resolveGooglePlacesFeature } from "./googlePlacesFeature";
import { getStoryElementEditorOptions, listSelectableStoryElementsForQuestionCreation } from "@/app/story-elemente/storyElementRepository.server";

export default async function QuestionEditorPage() {
  const session = await requireQuestionEditor();
  const { locale, messages } = getQuestionEditorMessages(getDefaultLocale());
  const [categories, eventSeries, actor] = await Promise.all([
    prisma.fragenkategorie.findMany({
      where: { status: "ACTIVE" },
      orderBy: { kategorie: "asc" },
      select: {
        fragenkategorie_id: true,
        kategorie: true,
        status: true,
      },
    }),
    getAssignableQuestionEventSeries(session),
    getQuestionActor(session),
  ]);
  const baseCapabilities = getQuestionEditorCapabilities(actor);
  const [storyElements, storyEditorOptions] = await Promise.all([
    listSelectableStoryElementsForQuestionCreation(actor),
    getStoryElementEditorOptions(actor),
  ]);
  const canApproveInAnySeries = isAdministrator(actor) || getActorEventSeriesIds(actor, "EVENT_MANAGER").length > 0;
  const baseTemplates = localizeQuestionTemplates(messages);
  const dynamicTemplates = await loadDynamicQuestionTemplates(baseTemplates);

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
      templates={[...baseTemplates, ...dynamicTemplates]}
      categories={categories.map((category) => ({
        id: category.fragenkategorie_id,
        name: category.kategorie,
        status: category.status,
      }))}
      scopeOptions={{
        canSelectGlobal: canEditGlobalQuestions(actor),
        eventSeries: eventSeries.map((series) => ({ id: series.eventreihe_id, name: series.name })),
      }}
      googlePlacesFeature={resolveGooglePlacesFeature({
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
        explicitlyEnabled: process.env.GOOGLE_PLACES_FEATURE_ENABLED,
      })}
      storyElementOptions={storyElements.map((story) => ({ id: story.id, title: story.title, description: story.description, type: story.type, status: story.status, scope: story.scope, eventSeriesId: story.eventSeriesId, eventSeriesName: story.eventSeriesName }))}
      storyEditorOptions={storyEditorOptions}
    />
  );
}
