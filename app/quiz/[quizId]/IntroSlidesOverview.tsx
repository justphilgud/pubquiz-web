type Props = {
  quizId: number;
  passwort: string;
};

const introSlides = [
  {
    key: "vor-dem-start",
    titel: "Vor dem Start",
    beschreibung: "Logo, Musik und Wartescreen vor Quizbeginn",
  },
  {
    key: "begruessung",
    titel: "Begrüßung",
    beschreibung: "Quizname und Willkommensgruß",
  },
  {
    key: "regeln",
    titel: "Regeln",
    beschreibung: "Statische Regeln für den Quizabend",
  },
  {
    key: "preise",
    titel: "Preise",
    beschreibung: "Hinweis auf Preise für Platz 1 bis 3",
  },
];

export default function IntroSlidesOverview({
  quizId,
  passwort,
}: Props) {
  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-slate-100 px-6 py-4">
        <div className="text-lg font-black uppercase tracking-wide text-slate-700">
          Intro · 4 Slides
        </div>

        <div className="rounded-full border border-slate-300 bg-white px-4 py-1 text-sm font-bold uppercase text-slate-500">
          Fixiert
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {introSlides.map((slide, index) => (
          <div
            key={slide.key}
            className="grid gap-4 px-6 py-5 md:grid-cols-[80px_1fr_180px] md:items-center"
          >
            <div className="text-sm font-black uppercase text-slate-400">
              Slide {index + 1}
            </div>

            <div>
              <div className="text-lg font-bold text-slate-900">
                {slide.titel}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {slide.beschreibung}
              </div>
            </div>

            <a
              href={`/quiz/${quizId}/slides/${slide.key}?passwort=${passwort}`}
              className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              Konfigurieren
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}