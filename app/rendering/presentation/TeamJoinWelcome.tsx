"use client";

import { useEffect, useReducer, type CSSProperties } from "react";
import { TeamIdentityVisual } from "@/app/teams/TeamIdentityVisual";
import {
  emptyTeamJoinQueue, finishTeamJoin, observeTeamJoins, teamJoinBatchKey,
  TEAM_JOIN_DISPLAY_MS, type TeamJoinObservation, type TeamJoinQueue,
} from "./teamJoinQueue";

type Action = { observation: TeamJoinObservation } | { finished: string };
function reducer(state: TeamJoinQueue, action: Action) {
  return "observation" in action ? observeTeamJoins(state, action.observation) : finishTeamJoin(state, action.finished);
}

export function TeamJoinWelcome({ observation }: { observation: TeamJoinObservation }) {
  const [queue, dispatch] = useReducer(reducer, undefined, emptyTeamJoinQueue);
  // Primitive content identity; new transport objects alone do not restart effects.
  const signature = JSON.stringify(observation);
  useEffect(() => { dispatch({ observation: JSON.parse(signature) as TeamJoinObservation }); }, [signature]);
  const activeKey = queue.active.length ? teamJoinBatchKey(queue) : null;
  useEffect(() => {
    if (!activeKey) return;
    const timer = window.setTimeout(() => dispatch({ finished: activeKey }), TEAM_JOIN_DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeKey]);

  if (!queue.active.length || observation.lifecycle === "STOPPED" || queue.revision !== observation.lifecycleRevision) return null;
  const batch = queue.active;
  return (
    <aside key={activeKey} className="presentation-team-welcome" role="status" aria-live="polite"
      style={{ "--team-join-duration": `${TEAM_JOIN_DISPLAY_MS}ms` } as CSSProperties}>
      <div className="presentation-team-welcome-avatars">
        {batch.slice(0, 6).map((team) => <TeamIdentityVisual key={team.participationId} name={team.teamName}
          avatarCode={team.avatarCode} photoUrl={team.photoUrl} className="presentation-team-welcome-avatar" />)}
      </div>
      <h2>{batch.length === 1 ? batch[0].teamName : `${batch.length} neue Teams`}</h2>
      <p>{batch.length === 1 ? "ist dabei!" : "sind dabei!"}</p>
      {batch.length > 1 && <p className="presentation-team-welcome-names">{batch.slice(0, 6).map((team) => team.teamName).join(" · ")}{batch.length > 6 ? ` · + ${batch.length - 6} weitere` : ""}</p>}
    </aside>
  );
}
