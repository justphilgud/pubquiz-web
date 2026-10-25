import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import ContentLibraryPage from "@/app/components/content/ContentLibraryPage";
import QuestionEditorPage from "@/app/fragen/editor/QuestionCreationPage";
import NewStoryElementPage from "@/app/story-elemente/new/StoryCreationPage";
import NewLivePollPage from "@/app/content/polls/new/PollCreationPage";
import QuizPage from "@/app/quiz/QuizManagementPage";
import TeamManagementPage from "@/app/admin/teams/TeamManagementPage";
import EventSeriesDetailPage from "@/app/admin/eventreihen/[eventSeriesId]/page";
import { EVENT_TYPES } from "@/app/roles/eventTypes";
import { loadWorkspaceNavigation } from "@/app/workspaces/workspace.server";
import { workspaceTypePaths } from "@/app/workspaces/workspacePolicy";

type Query = Record<string, string | string[] | undefined>;
export default async function WorkspacePage({ params, searchParams }: {
  params: Promise<{ seriesId: string; eventType: string; area?: string[] }>;
  searchParams: Promise<Query>;
}) {
  const route = await params;
  if (!/^[1-9]\d*$/.test(route.seriesId) || (route.area?.length ?? 0) > 1) notFound();
  const { choices } = await loadWorkspaceNavigation();
  const series = choices.find(choice => choice.id === Number(route.seriesId));
  if (!series) notFound();
  const area = route.area?.[0];
  if (route.eventType === "settings") {
    if (!series.canManage || area) notFound();
    return <><AppHeader /><p className="mx-auto max-w-5xl px-4 pt-3 text-sm text-slate-600">Gemeinsame Stammdaten und Logo. Die vorhandenen Präsentationstemplates gelten derzeit für Quiz.</p><EventSeriesDetailPage params={Promise.resolve({ eventSeriesId: route.seriesId })} /></>;
  }
  const type = EVENT_TYPES.find(item => workspaceTypePaths[item.id] === route.eventType);
  if (!type || !series.eventTypes.includes(type.id)) notFound();
  if (!type.implemented) {
    if (area) notFound();
    return <><AppHeader /><main className="mx-auto max-w-6xl px-4 py-8"><p className="text-sm text-slate-600">{series.name}</p><h1 className="mt-1 text-2xl font-bold">{type.label}</h1><p className="mt-3 font-semibold">Noch nicht verfügbar</p><p className="mt-2 text-sm text-slate-600">Für diese Eventart stehen noch keine Spielfunktionen bereit.</p></main></>;
  }
  if (!area) redirect(`/workspaces/${series.id}/quiz/${series.canManageQuiz ? "events" : "content"}`);
  const query = await searchParams;
  if (area === "new-question") return <><AppHeader /><QuestionEditorPage workspaceSeriesId={series.id} /></>;
  if (area === "new-story") return <><AppHeader /><NewStoryElementPage workspaceSeriesId={series.id} searchParams={Promise.resolve({})} /></>;
  if (area === "new-poll") return <><AppHeader /><NewLivePollPage workspaceSeriesId={series.id} /></>;
  if (area === "content" || area === "questions" || area === "stories" || area === "polls") {
    const initialType = area === "questions" ? "QUESTION" : area === "stories" ? "STORY_ELEMENT" : area === "polls" ? "POLL" : undefined;
    return <><AppHeader /><nav aria-label="Inhaltsbereiche" className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pt-3">{[["content", "Alle Inhalte"], ["questions", "Fragen"], ["stories", "Story-Elemente"], ["polls", "Umfragen"]].map(([path, label]) => <Link key={path} className="flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold" href={`/workspaces/${series.id}/quiz/${path}`}>{label}</Link>)}</nav><ContentLibraryPage key={`${series.id}:${area}`} initialType={initialType} workspaceSeriesId={series.id} /></>;
  }
  if (!series.canManageQuiz) notFound();
  if (area === "events") return <QuizPage workspaceSeriesId={series.id} searchParams={Promise.resolve({ ...query, eventreiheId: String(series.id), editQuizId: undefined })} />;
  if (area === "teams") return <><AppHeader /><TeamManagementPage workspaceSeriesId={series.id} searchParams={Promise.resolve({ ...query, eventSeriesId: String(series.id) })} /></>;
  notFound();
}
