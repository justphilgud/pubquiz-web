import { notFound } from "next/navigation";
import ContentEditorShell from "@/app/components/content/ContentEditorShell";
import { requireActor } from "@/app/lib/permissions";
import { canArchiveStoryElement, canEditStoryElement } from "@/app/story-elemente/storyElementPolicy";
import LivePollEditor from "@/app/umfragen/LivePollEditor";
import { getLivePollEditorOptions, loadLivePoll } from "@/app/umfragen/livePollRepository.server";

export default async function LivePollPage({ params }: { params: Promise<{ pollId: string }> }) {
  const { actor } = await requireActor();
  const pollId = Number((await params).pollId);
  if (!Number.isSafeInteger(pollId) || pollId < 1) notFound();
  const [poll, options] = await Promise.all([loadLivePoll(actor, pollId), getLivePollEditorOptions(actor)]);
  if (!poll) notFound();
  return <ContentEditorShell eyebrow="Content · Umfragen" title={poll.prompt} fallbackHref="/content/polls" description={`Revision ${poll.revisionNumber} · ${poll.usageCount} Platzierung(en)`} footerSpace><LivePollEditor options={options} initialPoll={poll} canEdit={canEditStoryElement(actor, poll.access)} canArchive={canArchiveStoryElement(actor, poll.access)} /></ContentEditorShell>;
}
