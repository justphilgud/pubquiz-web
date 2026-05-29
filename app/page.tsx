import Link from "next/link";

const pubquizLinks = [
  {
    titel: "Fragen verwalten",
    beschreibung:
      "Fragen anlegen, bearbeiten, suchen, archivieren und Medien pflegen.",
    href: "/fragen",
  },
  {
    titel: "Quiz verwalten",
    beschreibung:
      "Quiz-Abende anlegen, Blöcke strukturieren und Fragen zuordnen.",
    href: "/quiz",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section>
          <h1 className="text-4xl font-bold tracking-tight">
            Spielzentrale
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Wähle einen Bereich aus und springe direkt zu den wichtigsten
            Funktionen.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-2xl font-bold">PubQuiz</h2>

            <p className="mt-1 text-sm text-slate-500">
              Fragen, Quiz-Abende, Medien und Präsentation verwalten.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {pubquizLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md"
              >
                <h3 className="text-lg font-semibold">{link.titel}</h3>

                <p className="mt-2 text-sm text-slate-600">
                  {link.beschreibung}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-6">
          <h2 className="text-2xl font-bold text-slate-500">Bingo</h2>

          <p className="mt-1 text-sm text-slate-400">
            Kommt später.
          </p>
        </section>
      </div>
    </main>
  );
}