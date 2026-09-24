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
      className="flex h-full min-h-0 flex-col gap-3 px-7 py-5 text-[var(--quiz-text)]"
    >
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[var(--quiz-primary)]">
            Meme-Ergebnis
          </p>
          <h1 className="text-3xl font-black">
            {hasWinner ? "Das Publikum hat entschieden" : "Keine gültigen Stimmen"}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-[var(--quiz-secondary)]">{result.totalVotes} Stimmen</p>
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
                ? "border-[var(--quiz-accent)] bg-[var(--quiz-surface-strong)] shadow-[5px_5px_0_var(--quiz-primary)]"
                : "border-[var(--quiz-border)] bg-[var(--quiz-surface)]"
            }`}
          >
            {imageUrl ? (
              <MemeRenderer
                imageUrl={imageUrl}
                topText={entry.topText}
                bottomText={entry.bottomText}
                captions={entry.captions}
                layout={entry.layout}
                alt={`Meme ${entry.number} von Team ${entry.teamName}`}
                className="max-h-full border border-[var(--quiz-border)]"
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl bg-black/60 font-bold text-white/60">
                Bild nicht verfügbar
              </div>
            )}
            <div className="flex min-w-0 flex-col justify-center gap-2 min-[1600px]:gap-3">
              <div className="flex items-center gap-2 min-[1600px]:gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--quiz-primary)] text-base font-black text-[var(--quiz-background)] min-[1600px]:h-12 min-[1600px]:w-12 min-[1600px]:text-lg">
                  {entry.number}
                </span>
                <TeamIdentityVisual
                  name={entry.teamName}
                  photoUrl={entry.photoUrl}
                  avatarCode={entry.avatarCode}
                  className="h-10 w-10 shrink-0 min-[1600px]:h-12 min-[1600px]:w-12"
                />
              </div>
              <p className="truncate text-lg font-black min-[1600px]:text-xl">{entry.teamName}</p>
              <p className="text-xl font-black tabular-nums min-[1600px]:text-2xl">
                {entry.voteCount} {entry.voteCount === 1 ? "Stimme" : "Stimmen"}
              </p>
              <p className="text-sm font-bold text-[var(--quiz-secondary)] min-[1600px]:text-base">{entry.share.toFixed(1).replace(".0", "")} %</p>
              {entry.isWinner ? (
                <p
                  data-meme-result-winner
                  className="rounded-xl bg-[var(--quiz-accent)] px-3 py-1.5 text-center text-sm font-black text-[var(--quiz-background)] min-[1600px]:py-2 min-[1600px]:text-base"
                >
                  Gewinner · +{entry.awardedPoints} Punkt
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {!hasWinner ? (
        <p className="shrink-0 rounded-xl border border-[var(--quiz-border)] bg-[var(--quiz-surface)] px-4 py-2 text-center text-lg font-bold text-[var(--quiz-text-muted)]">
          Ohne abgegebene Stimme wird kein Punkt vergeben.
        </p>
      ) : null}
    </section>
  );
}
