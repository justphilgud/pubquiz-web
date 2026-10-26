import ContentEditorShell from "@/app/components/content/ContentEditorShell";
import { requireActor } from "@/app/lib/permissions";
import { canCreateStoryElement } from "@/app/story-elemente/storyElementPolicy";
import LivePollEditor from "@/app/umfragen/LivePollEditor";
import { getLivePollEditorOptions } from "@/app/umfragen/livePollRepository.server";
import { redirect } from "next/navigation";

export default async function NewLivePollPage({ workspaceSeriesId }: { workspaceSeriesId?: number } = {}) {
  const { actor } = await requireActor();
  if (!canCreateStoryElement(actor)) redirect("/content");
  const options = await getLivePollEditorOptions(actor);
  const scopedOptions = workspaceSeriesId === undefined ? options : { ...options, canUseGlobalScope: false, eventSeries: options.eventSeries.filter(series => series.eventreihe_id === workspaceSeriesId), quizzes: options.quizzes.filter(quiz => quiz.eventreihe_id === workspaceSeriesId) };
  return <ContentEditorShell eyebrow="Content · Umfragen" title="Neue Umfrage" fallbackHref="/content" description="Live-Inhalt ohne Punkte oder Quizlösung." footerSpace><LivePollEditor options={scopedOptions} canEdit canArchive={false} /></ContentEditorShell>;
}
