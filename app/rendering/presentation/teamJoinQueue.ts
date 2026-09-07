import type { TeamAvatarCode } from "@/app/teams/teamProfile";
import type { QuizLifecycle } from "@/app/quiz/quizLifecycle";

export const TEAM_JOIN_DISPLAY_MS = 4_000;
export const TEAM_JOIN_BURST_THRESHOLD = 4;

export type JoinedTeam = {
  participationId: number;
  teamId: number;
  teamName: string;
  avatarCode: TeamAvatarCode;
  photoUrl: string | null;
};

export type TeamJoinObservation = {
  lifecycleRevision: number;
  lifecycle: QuizLifecycle;
  teams: JoinedTeam[];
};

export type TeamJoinQueue = {
  revision: number | null;
  stopped: boolean;
  seen: ReadonlySet<number>;
  active: readonly JoinedTeam[];
  pending: readonly JoinedTeam[];
};

export function emptyTeamJoinQueue(): TeamJoinQueue {
  return { revision: null, stopped: false, seen: new Set(), active: [], pending: [] };
}

function nextBatch(teams: readonly JoinedTeam[]) {
  const count = teams.length >= TEAM_JOIN_BURST_THRESHOLD ? teams.length : 1;
  return { active: teams.slice(0, count), pending: teams.slice(count) };
}

// Pure display projection. Never writes, navigates, starts a quiz or requests data.
export function observeTeamJoins(state: TeamJoinQueue, observation: TeamJoinObservation): TeamJoinQueue {
  if (state.revision !== null && observation.lifecycleRevision < state.revision) return state;
  if (state.revision === observation.lifecycleRevision && state.stopped) return state;
  if (state.revision !== observation.lifecycleRevision || observation.lifecycle === "STOPPED") {
    if (observation.lifecycle === "STOPPED" && state.revision === observation.lifecycleRevision && !state.active.length && !state.pending.length) return state;
    return { revision: observation.lifecycleRevision, stopped: observation.lifecycle === "STOPPED", seen: new Set(observation.teams.map((team) => team.participationId)), active: [], pending: [] };
  }
  const seen = new Set(state.seen);
  const arrivals = observation.teams.filter((team) => {
    if (seen.has(team.participationId)) return false;
    seen.add(team.participationId);
    return true;
  });
  if (!arrivals.length) return state;
  const pending = [...state.pending, ...arrivals];
  return { ...state, seen, ...(state.active.length ? { pending } : nextBatch(pending)) };
}

export function finishTeamJoin(state: TeamJoinQueue, activeKey: string): TeamJoinQueue {
  if (teamJoinBatchKey(state) !== activeKey || !state.active.length) return state;
  return { ...state, ...nextBatch(state.pending) };
}

export function teamJoinBatchKey(state: TeamJoinQueue) {
  return `${state.revision}:${state.active.map((team) => team.participationId).join(",")}`;
}
