"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AnimationEvent } from "react";
import { TeamIdentityVisual } from "@/app/teams/TeamIdentityVisual";
import { resolveTeamAvatarCode, type TeamAvatarCode } from "@/app/teams/teamProfile";
import { formatQuizPoints } from "@/app/quiz/formatQuizPoints";
import { resolvePodiumReveal } from "./presentationRankingPolicy";
import { PodiumCelebrationCrowd, type PodiumCelebrationPhase } from "./PodiumCelebrationCrowd";

export const PODIUM_REVEAL_DURATION_MS = 7_800;

type PodiumScore = {
  teamId?: number;
  teamname: string;
  punkte: number;
  tieBreakPlace?: number;
  avatarCode?: TeamAvatarCode;
  photoUrl?: string | null;
};

function stablePhase(revealCount: number, latestPlace: number | null): PodiumCelebrationPhase {
  if (revealCount <= 0) return "dance";
  if (latestPlace === 1) return "finale";
  if (latestPlace === 2) return "rank2-hold";
  return "rank3-hold";
}

function revealPhase(place: number): PodiumCelebrationPhase {
  if (place === 1) return "winner";
  if (place === 2) return "rank2-reveal";
  return "rank3-reveal";
}

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Rank identity and persisted reveal order stay here; the crowd adds only local presentation motion. */
export function PodiumCeremony({ scores, revealCount, showPoints = true }: {
  scores: readonly PodiumScore[];
  revealCount: number;
  showPoints?: boolean;
}) {
  const { visiblePodiumGroups } = resolvePodiumReveal(scores, revealCount);
  const latestGroup = visiblePodiumGroups[visiblePodiumGroups.length - 1];
  const latestPlace = latestGroup?.place ?? null;
  const stageRef = useRef<HTMLDivElement>(null);
  const previousRevealCount = useRef(revealCount);
  const phaseTimer = useRef<number | null>(null);
  const enteringTimer = useRef<number | null>(null);
  const settlingNodes = useRef<HTMLElement[]>([]);
  const settlingAnimations = useRef<Animation[]>([]);
  const [phase, setPhase] = useState<PodiumCelebrationPhase>(() => stablePhase(revealCount, latestPlace));
  const [enteringPlace, setEnteringPlace] = useState<number | null>(null);

  function clearTimer(timer: { current: number | null }) {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }

  function clearSettling(settleToRest: boolean) {
    settlingAnimations.current.forEach((animation) => animation.cancel());
    settlingAnimations.current = [];
    settlingNodes.current.forEach((node) => {
      node.style.animation = "";
      node.style.transform = settleToRest ? "none" : "";
    });
    settlingNodes.current = [];
  }

  function finishFirstSettle(place: number) {
    clearTimer(phaseTimer);
    clearSettling(true);
    setPhase(revealPhase(place));
  }

  useBrowserLayoutEffect(() => {
    const previous = previousRevealCount.current;
    if (previous === revealCount) return;
    previousRevealCount.current = revealCount;
    clearTimer(phaseTimer);
    clearTimer(enteringTimer);

    if (revealCount < previous) {
      clearSettling(false);
      setEnteringPlace(null);
      setPhase(stablePhase(revealCount, latestPlace));
      return;
    }

    if (!latestPlace) {
      setPhase(stablePhase(revealCount, latestPlace));
      return;
    }

    setEnteringPlace(latestPlace);
    if (previous === 0 && revealCount === 1) {
      const friends = Array.from(stageRef.current?.querySelectorAll<HTMLElement>("[data-podium-friend]") ?? []);
      const transforms = friends.map((friend) => getComputedStyle(friend).transform);
      settlingNodes.current = friends;
      friends.forEach((friend, index) => {
        friend.style.animation = "none";
        friend.style.transform = transforms[index] ?? "none";
      });
      setPhase("settling");

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reducedMotion) {
        settlingAnimations.current = friends.map((friend, index) => friend.animate(
          [{ transform: transforms[index] ?? "none" }, { transform: "none" }],
          { duration: 1_350, easing: "cubic-bezier(.18,.8,.25,1)", fill: "none" },
        ));
      }
      phaseTimer.current = window.setTimeout(() => finishFirstSettle(latestPlace), reducedMotion ? 500 : 2_200);
      return;
    }

    clearSettling(true);
    setPhase(revealPhase(latestPlace));
  }, [latestPlace, revealCount]);

  useEffect(() => () => {
    clearTimer(phaseTimer);
    clearTimer(enteringTimer);
    settlingAnimations.current.forEach((animation) => animation.cancel());
  }, []);

  useEffect(() => {
    if (phase === "settling") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion
      ? 180
      : phase === "rank3-reveal"
        ? 4_200
        : phase === "rank2-reveal"
          ? 5_300
          : phase === "winner"
            ? PODIUM_REVEAL_DURATION_MS
            : null;
    if (duration === null) return;
    const nextPhase = phase === "rank3-reveal"
      ? "rank3-hold"
      : phase === "rank2-reveal"
        ? "rank2-hold"
        : "finale";
    const timer = window.setTimeout(() => setPhase(nextPhase), duration);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (enteringPlace === null || phase === "settling") return;
    const timer = window.setTimeout(() => setEnteringPlace((current) => current === enteringPlace ? null : current), 1_300);
    enteringTimer.current = timer;
    return () => window.clearTimeout(timer);
  }, [enteringPlace, phase]);

  function handleRocketEnd(event: AnimationEvent<HTMLSpanElement>) {
    if (phase === "winner" && event.animationName === "podium-gudi-firework-flight") {
      clearTimer(phaseTimer);
      setPhase("finale");
    }
  }

  return <div
    ref={stageRef}
    className="podium-ceremony"
    data-podium-ceremony
    data-phase={phase}
    data-reveal-count={revealCount}
    aria-label="Siegerehrung: Platz drei, Platz zwei und Platz eins"
  >
    <div className="podium-stands" aria-hidden="true">
      {[2, 1, 3].map((place) => <div key={place} className="podium-step" data-place={place}><b>{place}</b></div>)}
    </div>
    <PodiumCelebrationCrowd phase={phase} burstKey={revealCount} onRocketEnd={handleRocketEnd} />
    {visiblePodiumGroups.map((group) => <article
      className="podium-team"
      key={group.place}
      data-place={group.place}
      data-entering={enteringPlace === group.place ? "true" : undefined}
    >
      <div className="podium-team-content">
        <b className="podium-rank-label">Platz {group.place}</b>
        <div className="podium-identities" data-count={group.entries.length}>
          {group.entries.map((team, index) => <div
            className="podium-identity"
            key={team.teamId ?? `${team.teamname}-${index}`}
          >
            <div className="podium-team-photo-frame">
              <TeamIdentityVisual
                name={team.teamname}
                photoUrl={team.photoUrl}
                avatarCode={team.avatarCode ?? resolveTeamAvatarCode(team.teamId ?? 0, null)}
                className="podium-team-photo"
              />
            </div>
            <div className="podium-nameplate"><strong>{team.teamname}</strong></div>
          </div>)}
        </div>
        {showPoints && <span className="podium-points">{formatQuizPoints(group.entries[0].punkte)} Punkte</span>}
      </div>
    </article>)}
  </div>;
}
