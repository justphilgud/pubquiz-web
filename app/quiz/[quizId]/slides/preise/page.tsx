import { notFound, redirect } from "next/navigation";
import { getQuizDetails, updateIntroPreise } from "@/app/quiz/actions";
import { SlideNavigation } from "../SlideNavigation";
import { ConfigSlideNavigation } from "../ConfigSlideNavigation";


type Props = {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ passwort?: string }>;
};

export default async function PreisePage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const passwort = resolvedSearchParams.passwort ?? "";

  if (passwort !== process.env.AUSWERTUNG_PASSWORT) {
    notFound();
  }

  const quiz = await getQuizDetails(Number(resolvedParams.quizId));

  if (!quiz) {
    notFound();
  }
  const quizIdValue = quiz.quiz_id;

  async function save(formData: FormData) {
    "use server";

    const preise = [
      String(formData.get("platz1") ?? ""),
      String(formData.get("platz2") ?? ""),
      String(formData.get("platz3") ?? ""),
    ].join("\n");

    await updateIntroPreise({
      quizId: quizIdValue,
      preise,
    });

    redirect(
      `/quiz/${quizIdValue}/slides/preise?passwort=${encodeURIComponent(
        passwort
      )}`
    );
  }

  const gespeichertePreise = ((quiz as any).intro_preise ?? "")
    .split("\n")
    .map((preis: string) => preis.trim());

  const platz1 = gespeichertePreise[0] ?? "";
  const platz2 = gespeichertePreise[1] ?? "";
  const platz3 = gespeichertePreise[2] ?? "";

  const preise = [
    { platz: "1", titel: "Platz 1", preis: platz1 || "50 € Gutschein" },
    { platz: "2", titel: "Platz 2", preis: platz2 || "Getränkerunde" },
    { platz: "3", titel: "Platz 3", preis: platz3 || "Ruhm und Ehre" },
  ];

  const naechsteSlideUrl = `/quiz/${quizIdValue
    }/slides/fragerunde-1?passwort=${encodeURIComponent(passwort)}`;

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1fr_1.2fr]">
        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-8">
            <div className="text-sm font-black uppercase tracking-[0.3em] text-cyan-600">
              Intro Slide
            </div>

            <h1 className="mt-2 text-4xl font-black text-slate-900">
              Preise
            </h1>

            <p className="mt-2 text-slate-500">
              Konfiguriere die Preise. Mit Enter oder Leertaste geht es später
              zur ersten Fragerunde.
            </p>
          </div>

          <form action={save}>
            <div className="grid gap-5">
              <label className="grid gap-2">
                <div className="text-sm font-bold text-slate-700">Platz 1</div>
                <input
                  name="platz1"
                  defaultValue={platz1}
                  className="rounded-2xl border border-slate-300 px-5 py-4 text-lg"
                  placeholder="z. B. 50 € Gutschein"
                />
              </label>

              <label className="grid gap-2">
                <div className="text-sm font-bold text-slate-700">Platz 2</div>
                <input
                  name="platz2"
                  defaultValue={platz2}
                  className="rounded-2xl border border-slate-300 px-5 py-4 text-lg"
                  placeholder="z. B. Getränkerunde"
                />
              </label>

              <label className="grid gap-2">
                <div className="text-sm font-bold text-slate-700">Platz 3</div>
                <input
                  name="platz3"
                  defaultValue={platz3}
                  className="rounded-2xl border border-slate-300 px-5 py-4 text-lg"
                  placeholder="z. B. Ruhm und Ehre"
                />
              </label>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white"
              >
                Speichern & Vorschau aktualisieren
              </button>

              <a
                href={`/quiz/${quizIdValue}?passwort=${encodeURIComponent(
                  passwort
                )}`}
                className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900"
              >
                Abbrechen und zurück
              </a>

              <ConfigSlideNavigation
                previous={{
                  href: `/quiz/${quizIdValue}/slides/regeln?passwort=${encodeURIComponent(passwort)}`,
                  label: "Regeln",
                }}
                next={{
                  href: `/quiz/${quizIdValue}/slides/vor-dem-start?passwort=${encodeURIComponent(passwort)}`,
                  label: "Warteslide",
                }}
              />
            </div>
          </form>
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-black shadow-sm">
          <div className="relative h-[680px] overflow-hidden bg-[#050510] text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,140,0.2),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(0,245,255,0.18),transparent_40%)]" />

            <div className="absolute inset-8 flex flex-col justify-center rounded-[2rem] border-4 border-pink-500/80 bg-black/45 p-12 shadow-[0_0_35px_rgba(255,0,150,0.9)]">
              <div className="mb-6 text-sm font-black uppercase tracking-[0.35em] text-cyan-300 drop-shadow-[0_0_12px_rgba(0,240,255,1)]">
                Es geht um alles
              </div>

              <h2 className="text-7xl font-black leading-tight text-pink-300 drop-shadow-[0_0_18px_rgba(255,0,150,1)]">
                Preise
              </h2>

              <div className="mt-10 grid gap-5">
                {preise.map((preis) => (
                  <div
                    key={preis.platz}
                    className="grid grid-cols-[5rem_1fr] items-center gap-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-5"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-cyan-400 text-4xl font-black text-cyan-300 shadow-[0_0_22px_rgba(0,240,255,0.85)]">
                      {preis.platz}
                    </div>

                    <div>
                      <div className="text-xl font-black uppercase tracking-[0.2em] text-cyan-200">
                        {preis.titel}
                      </div>
                      <div className="mt-1 text-4xl font-black leading-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.55)]">
                        {preis.preis}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 w-fit rounded-2xl border border-cyan-400/70 px-6 py-3 text-xl font-bold text-cyan-200 shadow-[0_0_22px_rgba(0,240,255,0.45)]">
                Verlieren ist keine Option. Außer für fast alle.
              </div>

              <SlideNavigation href={naechsteSlideUrl} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}