import ContentEditorShell from "@/app/components/content/ContentEditorShell";
import { requireActor } from "@/app/lib/permissions";
import { canCreateStoryElement } from "@/app/story-elemente/storyElementPolicy";
import LivePollEditor from "@/app/umfragen/LivePollEditor";
import { getLivePollEditorOptions } from "@/app/umfragen/livePollRepository.server";
import { redirect } from "next/navigation";

export default async function NewLivePollPage() {
  const { actor } = await requireActor();
  if (!canCreateStoryElement(actor)) redirect("/content");
  const options = await getLivePollEditorOptions(actor);
  return <ContentEditorShell eyebrow="Content · Umfragen" title="Neue Umfrage" fallbackHref="/content" description="Live-Inhalt ohne Punkte oder Quizlösung." footerSpace><LivePollEditor options={options} canEdit canArchive={false} /></ContentEditorShell>;
}
