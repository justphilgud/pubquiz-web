/* eslint-disable @next/next/no-img-element -- Saved quiz media uses dynamic URLs. */

type Portrait = { src: string | null; name: string };

export function FaceMorphSolutionSlide({ personA, morphSrc, personB }: {
  personA: Portrait; morphSrc: string | null; personB: Portrait;
}) {
  const columns = [
    { key: "person-a", label: "Person A", ...personA },
    { key: "morph", label: "FaceMorph", src: morphSrc, name: "FaceMorph" },
    { key: "person-b", label: "Person B", ...personB },
  ];
  return <section data-presentation-layout="SOLUTION_FOCUS" data-question-template="face_morph"
    data-facemorph-solution className="grid h-full min-h-0 grid-cols-3 gap-2 sm:gap-5"
    style={{ containerType: "inline-size" }}>
    {columns.map(column => <figure key={column.key} data-facemorph-role={column.key}
      className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-2 overflow-hidden rounded-xl border-2 border-[var(--quiz-border)] bg-[var(--quiz-surface)] p-2 sm:p-3">
      <div className="flex min-h-0 items-center justify-center overflow-hidden">
        {column.src ? <img src={column.src} alt={column.key === "morph" ? "FaceMorph" : `${column.label}: ${column.name}`}
          className="h-full min-h-0 w-full object-contain" /> :
          <p data-facemorph-missing={column.key} className="text-center text-xs text-[var(--quiz-text-muted)] sm:text-base">
            {column.key === "morph" ? "Morph-Bild fehlt" : `Originalbild ${column.label} fehlt`}
          </p>}
      </div>
      <figcaption className="min-w-0 text-center font-bold leading-tight text-[var(--quiz-text)] [overflow-wrap:anywhere]"
        style={{ fontSize: "clamp(0.55rem, 1.8cqw, 2rem)" }}>
        {column.name || column.label}
      </figcaption>
    </figure>)}
  </section>;
}
