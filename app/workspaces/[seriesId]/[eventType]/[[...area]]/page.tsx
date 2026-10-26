import GameListPage from "@/app/games/GameListPage";
import WorkspaceSeriesFilter from "@/app/workspaces/WorkspaceSeriesFilter";
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
  if (type.id !== "QUIZ") {
    if (area) notFound();
    return <GameListPage type={type.id} seriesId={series.id} />;
  }
  if (!area) redirect(`/workspaces/${series.id}/quiz/${series.canManageQuiz ? "events" : "content"}`);
  const query = await searchParams;
  const filter = <WorkspaceSeriesFilter options={choices.filter(choice => choice.eventTypes.includes("QUIZ") && (!["events", "teams"].includes(area ?? "") || choice.canManageQuiz))} seriesId={series.id} area={area} />;
  if (area === "new-question") return <><AppHeader /><QuestionEditorPage workspaceSeriesId={series.id} /></>;
  if (area === "new-story") return <><AppHeader /><NewStoryElementPage workspaceSeriesId={series.id} searchParams={Promise.resolve({})} /></>;
  if (area === "new-poll") return <><AppHeader /><NewLivePollPage workspaceSeriesId={series.id} /></>;
  if (area === "content" || area === "questions" || area === "stories" || area === "polls") {
    const initialType = area === "questions" ? "QUESTION" : area === "stories" ? "STORY_ELEMENT" : area === "polls" ? "POLL" : undefined;
    return <><AppHeader />{filter}<ContentLibraryPage key={`${series.id}:${area}`} initialType={initialType} workspaceSeriesId={series.id} /></>;
  }
  if (!series.canManageQuiz) notFound();
  if (area === "events") return <><AppHeader />{filter}<QuizPage hideHeader workspaceSeriesId={series.id} searchParams={Promise.resolve({ ...query, eventreiheId: String(series.id), editQuizId: undefined })} /></>;
  if (area === "teams") return <><AppHeader />{filter}<TeamManagementPage workspaceSeriesId={series.id} searchParams={Promise.resolve({ ...query, eventSeriesId: String(series.id) })} /></>;
  notFound();
}
