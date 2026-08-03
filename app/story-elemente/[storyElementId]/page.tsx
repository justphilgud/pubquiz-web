import { notFound } from "next/navigation";
import ContentEditorHeader from "@/app/components/content/ContentEditorHeader";
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
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 md:px-8"><div className="mx-auto max-w-7xl space-y-6"><ContentEditorHeader eyebrow="Content · Story-Elemente" title={story.title} fallbackHref="/content" description={canEdit ? "Bearbeitungen erzeugen eine neue Revision; bestehende Quizverwendungen bleiben unverändert." : "Schreibgeschützte Ansicht aufgrund von Status oder Berechtigung."} /><StoryElementEditor options={options} initialStory={story} canEdit={canEdit} canArchive={canArchiveStoryElement(actor, story.access)} /><StoryQuestionLinksPanel storyElementId={story.id} links={questionLinks.links} options={questionLinks.options} canEditStory={canEdit} /></div></main>;
}
