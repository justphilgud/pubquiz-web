import { MemeRenderer } from "@/app/rendering/meme/MemeRenderer";
import { getMemeOverviewCandidates } from "@/app/quiz/memeVoting";
import type { MemePresentationSnapshot } from "@/app/quiz/memeVoting.server";

export function MemePresentationStage({
  state,
}: {
  state: MemePresentationSnapshot;
}) {
  const activeCandidate = state.candidates.find(
    (candidate) => candidate.number === state.activeCandidateNumber,
  );
  const overviewCandidates = getMemeOverviewCandidates(
    state.candidates,
    state.overviewPage,
  );
  const overview = state.phase === "PRESENTING"
    ? []
    : overviewCandidates;

  if (!state.imageUrl) {
    return (
      <div className="flex h-full items-center justify-center text-3xl font-bold text-white">
        Das Meme-Basisbild ist nicht verfügbar.
      </div>
    );
  }

  if (state.phase === "PRESENTING" && activeCandidate) {
    return (
      <section
        data-meme-presentation-phase="PRESENTING"
        className="flex h-full min-h-0 flex-col items-center justify-center gap-4 px-10 py-6 text-white"
      >
        <div className="rounded-full border-2 border-white/50 bg-black/70 px-6 py-2 text-2xl font-black">
          Meme {activeCandidate.number}
        </div>
        <MemeRenderer
          imageUrl={state.imageUrl}
          topText={activeCandidate.topText}
          bottomText={activeCandidate.bottomText}
          alt={`Meme ${activeCandidate.number}`}
          className="max-h-[78%] max-w-4xl border-2 border-white/30 shadow-2xl"
        />
      </section>
    );
  }

  const voting = state.phase === "VOTING_OPEN" || state.phase === "VOTING_CLOSED";
  return (
    <section
      data-meme-presentation-phase={state.phase}
      className="flex h-full min-h-0 flex-col gap-3 px-7 py-5 text-white"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-fuchsia-200">
            Meme-Runde
          </p>
          <h1 className="text-3xl font-black">
            {state.phase === "VOTING_OPEN"
              ? "Jetzt abstimmen"
              : state.phase === "VOTING_CLOSED"
                ? "Voting geschlossen"
                : "Alle Kandidaten im Überblick"}
          </h1>
        </div>
        <span className="rounded-full border border-white/40 bg-black/50 px-4 py-2 font-bold">
          Seite {state.overviewPage + 1} / {state.overviewPageCount}
        </span>
      </div>
      <div
        className={`grid min-h-0 flex-1 gap-4 ${overview.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
      >
        {overview.map((candidate) => (
          <article
            key={candidate.candidateId}
            className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-white/25 bg-black/45 p-3"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-fuchsia-500 text-xl font-black text-white">
              {candidate.number}
            </span>
            <MemeRenderer
              imageUrl={state.imageUrl!}
              topText={candidate.topText}
              bottomText={candidate.bottomText}
              alt={`Meme ${candidate.number}`}
              className="max-h-full border border-white/20"
            />
          </article>
        ))}
      </div>
      {voting ? (
        <p className="text-center text-xl font-bold text-cyan-100">
          {state.phase === "VOTING_OPEN"
            ? "Eine Stimme pro Team – das eigene Meme ist gesperrt."
            : "Weitere Stimmen werden nicht mehr angenommen."}
        </p>
      ) : null}
    </section>
  );
}
