"use client";

import { resolvePodiumReveal } from "./presentationRankingPolicy";
import { formatQuizPoints } from "@/app/quiz/formatQuizPoints";

export const PODIUM_REVEAL_DURATION_MS = 3_600;

/** Stable keyed rank groups: only a newly mounted group performs the reveal. */
export function PodiumCeremony({ scores, revealCount, showPoints = true }: {
  scores: readonly { teamname: string; punkte: number; tieBreakPlace?: number; photoUrl?: string | null }[];
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
        <div className="podium-identities">{group.entries.map((team, index) => <div className="podium-identity" key={index}>
          {team.photoUrl && /* Trusted team profile media; preserve the full image. */
            // eslint-disable-next-line @next/next/no-img-element
            <img className="podium-team-photo" src={team.photoUrl} alt={`Team ${team.teamname}`} />}
          <strong>{team.teamname}</strong>
        </div>)}</div>
        {showPoints && <span>{formatQuizPoints(group.entries[0].punkte)} Punkte</span>}
      </div>
    </article>)}
  </div>;
}
