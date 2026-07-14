import { prisma } from "@/lib/prisma";
import {
  getQuestionEditorCapabilities,
  requireQuestionEditor,
} from "@/app/lib/permissions";
import { QuestionEditor } from "./components/QuestionEditor";
import { getMediaUploadPathnamePrefix } from "./mediaUploadEnvironment";

export default async function QuestionEditorPage() {
  const session = await requireQuestionEditor();
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
      mediaUploadPathnamePrefix={getMediaUploadPathnamePrefix()}
      categories={categories.map((category) => ({
        id: category.fragenkategorie_id,
        name: category.kategorie,
      }))}
    />
  );
}
