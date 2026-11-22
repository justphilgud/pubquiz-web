import type { AnimationEvent, CSSProperties } from "react";

export type PodiumCelebrationPhase =
  | "dance"
  | "settling"
  | "rank3-reveal"
  | "rank3-hold"
  | "rank2-reveal"
  | "rank2-hold"
  | "winner"
  | "finale";

const CONFETTI_COLORS = ["#f6d47e", "#fff4dd", "#a9462f", "#e98cbe", "#398c7d", "#ed8b43", "#5369a8"];

function Confetti({ rank, burstKey }: { rank: number; burstKey: number }) {
  const count = rank === 1 ? 112 : rank === 2 ? 74 : 56;

  return <div className="podium-confetti" aria-hidden="true" data-rank={rank}>
    {Array.from({ length: count }, (_, index) => {
      const drift = ((index * 17 + burstKey * 11) % 100) - 50;
      const delay = rank === 1
        ? (index % 4) * 1.1 + (index % 7) * 0.07
        : rank === 2
          ? (index % 5) * 0.22 + (index % 7) * 0.04
          : (index % 4) * 0.16;
      const duration = rank === 1 ? 3.2 + (index % 5) * 0.12 : 3.15 + (index % 6) * 0.14;
      const spin = (index % 2 === 0 ? 1 : -1) * (2 + (index % 5));
      return <i
        key={`${burstKey}-${index}`}
        className="podium-confetti-piece"
        data-shape={index % 4 === 0 ? "dot" : index % 4 === 1 ? "triangle" : "sliver"}
        style={{
          left: `${(index * 43 + burstKey * 19) % 100}%`,
          backgroundColor: CONFETTI_COLORS[(index + burstKey) % CONFETTI_COLORS.length],
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          "--confetti-drift": `${drift}cqw`,
          "--confetti-spin": `${spin}turn`,
        } as CSSProperties}
      />;
    })}
  </div>;
}

export function PodiumCelebrationCrowd({
  phase,
  burstKey,
  onRocketEnd,
}: {
  phase: PodiumCelebrationPhase;
  burstKey: number;
  onRocketEnd: (event: AnimationEvent<HTMLSpanElement>) => void;
}) {
  const confettiRank = phase === "rank3-reveal" ? 3 : phase === "rank2-reveal" ? 2 : phase === "winner" ? 1 : null;

  return <>
    <div className="podium-crowd" aria-hidden="true">
      <span className="podium-friend podium-friend--teal" data-podium-friend="teal" />
      <span className="podium-friend podium-friend--yellow" data-podium-friend="yellow" />
      <span
        className="podium-friend podium-friend--gudi"
        data-podium-friend="gudi"
        onAnimationEnd={onRocketEnd}
      >
        <span className="podium-firework-tail" />
        <span className="podium-gudi-art podium-gudi-art--plain" />
        <span className="podium-gudi-art podium-gudi-art--hat" />
      </span>
      <span className="podium-friend podium-friend--orange" data-podium-friend="orange" />
      <span className="podium-friend podium-friend--blue" data-podium-friend="blue" />
    </div>
    {confettiRank !== null && <Confetti rank={confettiRank} burstKey={burstKey} />}
  </>;
}
