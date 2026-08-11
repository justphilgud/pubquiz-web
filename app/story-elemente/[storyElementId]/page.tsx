import { notFound } from "next/navigation";
import ContentEditorShell from "@/app/components/content/ContentEditorShell";
import { requireActor } from "@/app/lib/permissions";
import StoryElementEditor from "../StoryElementEditor";
import {
  canArchiveStoryElement,
  canEditStoryElement,
} from "../storyElementPolicy";
import {
  getStoryElementEditorOptions,
  loadStoryElement,
} from "../storyElementRepository.server";
import { loadStoryQuestionLinksPanel } from "../storyQuestionLinks.server";
import StoryQuestionLinksPanel from "../StoryQuestionLinksPanel";

export default async function StoryElementPage({
  params,
}: {
  params: Promise<{ storyElementId: string }>;
}) {
  const { storyElementId: rawId } = await params;
  const storyElementId = Number(rawId);
  if (!Number.isSafeInteger(storyElementId) || storyElementId <= 0) notFound();
  const { actor } = await requireActor();
  const [story, options] = await Promise.all([
    loadStoryElement(actor, storyElementId),
    getStoryElementEditorOptions(actor),
  ]);
  if (!story) notFound();
  const canEdit = canEditStoryElement(actor, story.access);
  const questionLinks = await loadStoryQuestionLinksPanel(actor, story);
  return <ContentEditorShell maxWidth="max-w-7xl" eyebrow="Content · Story-Elemente" title={story.title} fallbackHref="/content" description={canEdit ? "Bearbeitungen erzeugen eine neue Revision; bestehende Quizverwendungen bleiben unverändert." : "Schreibgeschützte Ansicht aufgrund von Status oder Berechtigung."} footerSpace={canEdit}><StoryElementEditor options={options} initialStory={story} canEdit={canEdit} canArchive={canArchiveStoryElement(actor, story.access)} /><StoryQuestionLinksPanel storyElementId={story.id} links={questionLinks.links} options={questionLinks.options} canEditStory={canEdit} /></ContentEditorShell>;
}
