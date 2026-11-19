"use client";

import { resolvePodiumReveal } from "./presentationRankingPolicy";
import { formatQuizPoints } from "@/app/quiz/formatQuizPoints";

export const PODIUM_REVEAL_DURATION_MS = 3_600;

/** Stable keyed rank groups: only a newly mounted group performs the reveal. */
export function PodiumCeremony({ scores, revealCount, showPoints = true }: {
  scores: readonly { teamname: string; punkte: number; tieBreakPlace?: number }[];
  revealCount: number;
  showPoints?: boolean;
}) {
  const { visiblePodiumGroups } = resolvePodiumReveal(scores, revealCount);
  return <div className="podium-ceremony" data-podium-ceremony aria-label="Podium Platz eins bis drei">
    {[2, 1, 3].map(place => <div key={place} className="podium-step" data-place={place} aria-label={`Platz ${place}`}>
      <b>{place}</b>
    </div>)}
    {visiblePodiumGroups.map(group => <article className="podium-team" key={group.place} data-place={group.place}>
      <div className="podium-team-content">
        <b>Platz {group.place}</b>
        <strong>{group.entries.map(team => team.teamname).join(" · ")}</strong>
        {showPoints && <span>{formatQuizPoints(group.entries[0].punkte)} Punkte</span>}
      </div>
    </article>)}
  </div>;
}
