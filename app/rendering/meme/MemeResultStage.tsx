import { getMemeResultPage } from "@/app/quiz/memeResults";
import type { MemeResultSnapshot } from "@/app/quiz/memeResults.server";
import { MemeRenderer } from "@/app/rendering/meme/MemeRenderer";
import { TeamIdentityVisual } from "@/app/teams/TeamIdentityVisual";

export function MemeResultStage({
  result,
  imageUrl,
  revealCount,
}: {
  result: MemeResultSnapshot;
  imageUrl: string | null;
  revealCount: number;
}) {
  const page = getMemeResultPage(result.entries, revealCount);
  const hasWinner = result.entries.some((entry) => entry.isWinner);

  return (
    <section
      data-meme-result-stage
      data-result-page={page.page}
      className="flex h-full min-h-0 flex-col gap-3 px-7 py-5 text-white"
    >
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-fuchsia-200">
            Meme-Ergebnis
          </p>
          <h1 className="text-3xl font-black">
            {hasWinner ? "Das Publikum hat entschieden" : "Keine gültigen Stimmen"}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-cyan-100">{result.totalVotes} Stimmen</p>
          {page.pageCount > 1 ? (
            <p className="text-sm font-bold text-white/70">Seite {page.page} / {page.pageCount}</p>
          ) : null}
        </div>
      </header>

      <div className={`grid min-h-0 flex-1 gap-3 ${page.entries.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {page.entries.map((entry) => (
          <article
            key={entry.candidateId}
            data-meme-result-entry
            data-winner={entry.isWinner ? "true" : "false"}
            className={`grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(12rem,0.58fr)] gap-3 overflow-hidden rounded-2xl border-2 p-3 ${
              entry.isWinner
                ? "border-yellow-300 bg-yellow-300/15 shadow-[5px_5px_0_#f0abfc]"
                : "border-white/25 bg-black/45"
            }`}
          >
            {imageUrl ? (
              <MemeRenderer
                imageUrl={imageUrl}
                topText={entry.topText}
                bottomText={entry.bottomText}
                alt={`Meme ${entry.number} von Team ${entry.teamName}`}
                className="max-h-full border border-white/20"
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl bg-black/60 font-bold text-white/60">
                Bild nicht verfügbar
              </div>
            )}
            <div className="flex min-w-0 flex-col justify-center gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fuchsia-500 text-lg font-black">
                  {entry.number}
                </span>
                <TeamIdentityVisual
                  name={entry.teamName}
                  photoUrl={entry.photoUrl}
                  avatarCode={entry.avatarCode}
                  className="h-12 w-12 shrink-0"
                />
              </div>
              <p className="truncate text-xl font-black">{entry.teamName}</p>
              <p className="text-2xl font-black tabular-nums">
                {entry.voteCount} {entry.voteCount === 1 ? "Stimme" : "Stimmen"}
              </p>
              <p className="text-base font-bold text-cyan-100">{entry.share.toFixed(1).replace(".0", "")} %</p>
              {entry.isWinner ? (
                <p className="rounded-xl bg-yellow-300 px-3 py-2 text-center text-base font-black text-slate-950">
                  Gewinner · +{entry.awardedPoints} Punkt
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {!hasWinner ? (
        <p className="shrink-0 rounded-xl border border-white/30 bg-black/50 px-4 py-2 text-center text-lg font-bold text-white/80">
          Ohne abgegebene Stimme wird kein Punkt vergeben.
        </p>
      ) : null}
    </section>
  );
}
