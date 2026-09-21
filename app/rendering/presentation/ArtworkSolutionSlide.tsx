/* eslint-disable @next/next/no-img-element -- Artwork media URLs and dimensions are editorial runtime data. */

type ArtworkSolutionSlideProps = {
  questionText: string;
  source: string | null;
  image: {
    src: string;
    alt: string;
  } | null;
  artistSolutions: readonly string[];
  titleSolutions: readonly string[];
};

function uniqueSolutions(solutions: readonly string[]) {
  return [...new Set(solutions.map((solution) => solution.trim()).filter(Boolean))];
}

export function formatArtworkAlternatives(solutions: readonly string[]) {
  const values = uniqueSolutions(solutions);
  if (values.length === 0) return "Keine Lösung hinterlegt";
  if (values.length === 1) return values[0];
  return `${values[0]} (${values.slice(1).join(" / ")})`;
}

export function ArtworkSolutionSlide({
  questionText,
  source,
  image,
  artistSolutions,
  titleSolutions,
}: ArtworkSolutionSlideProps) {
  return (
    <div
      data-artwork-solution
      className="grid h-full min-h-0 gap-5 lg:grid-cols-[1.35fr_0.65fr]"
    >
      <div className="min-h-0 overflow-hidden rounded-[1.5rem] border-4 border-yellow-300 bg-black/60 p-5 shadow-[8px_8px_0_#ff00aa]">
        {image ? (
          <img
            src={image.src}
            alt={image.alt}
            className="h-full max-h-full w-full rounded-2xl object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border-4 border-dashed border-cyan-300 text-3xl font-black uppercase text-white/40">
            Kein Bild hinterlegt
          </div>
        )}
      </div>

      <div className="presentation-solution-result flex min-h-0 flex-col rounded-[1.5rem] border-4 border-emerald-300 bg-gradient-to-br from-emerald-950 to-slate-950 p-6 shadow-[8px_8px_0_#facc15]">
        <div className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
          Auflösung
        </div>
        <h2 className="mt-3 text-2xl font-black leading-tight text-white/75">
          {questionText}
        </h2>

        <div className="mt-7 grid content-center gap-5">
          <section className="rounded-2xl border-2 border-cyan-300 bg-black/35 p-5">
            <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
              Künstler
            </div>
            <div className="mt-2 text-3xl font-black leading-tight text-white xl:text-4xl">
              {formatArtworkAlternatives(artistSolutions)}
            </div>
          </section>

          <section className="rounded-2xl border-2 border-yellow-300 bg-black/35 p-5">
            <div className="text-xs font-black uppercase tracking-[0.25em] text-yellow-200">
              Titel
            </div>
            <div className="mt-2 text-3xl font-black leading-tight text-white xl:text-4xl">
              {formatArtworkAlternatives(titleSolutions)}
            </div>
          </section>
        </div>

        {source && (
          <div className="mt-auto pt-5 text-sm font-bold text-white/55">
            Quelle: {source}
          </div>
        )}
      </div>
    </div>
  );
}
