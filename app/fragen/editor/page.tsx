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

export default async function QuestionEditorPage() {
  const session = await requireQuestionEditor();
  const { locale, messages } = getQuestionEditorMessages(getDefaultLocale());
  const categories = await prisma.fragenkategorie.findMany({
    orderBy: { kategorie: "asc" },
    select: {
      fragenkategorie_id: true,
      kategorie: true,
    },
  });

  return (
    <QuestionEditor
      capabilities={getQuestionEditorCapabilities(session)}
      editorContext="create"
      mediaUploadPathnamePrefix={getMediaUploadEnvironmentPrefix()}
      locale={locale}
      messages={messages}
      templates={localizeQuestionTemplates(messages)}
      categories={categories.map((category) => ({
        id: category.fragenkategorie_id,
        name: category.kategorie,
      }))}
    />
  );
}
