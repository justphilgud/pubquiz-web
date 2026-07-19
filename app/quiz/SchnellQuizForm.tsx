"use client";

import { useState } from "react";
import { createSchnellQuiz } from "./actions";
import type { EventSeriesOption } from "@/app/eventreihen/actions";

type Kategorie = {
  fragenkategorie_id: number;
  kategorie: string;
};

type MedienFilter = "alle" | "nurMitMedien" | "nurOhneMedien";

export default function SchnellQuizForm({
  kategorien,
  eventSeries,
  initialEventSeriesId,
}: {
  kategorien: Kategorie[];
  eventSeries: EventSeriesOption[];
  initialEventSeriesId?: number;
}) {
  const [eventSeriesId, setEventSeriesId] = useState(
    initialEventSeriesId ? String(initialEventSeriesId) : "",
  );
  const [titel, setTitel] = useState("Schnellquiz");
  const [quizDatum, setQuizDatum] = useState("");
  const [veranstaltungszeit, setVeranstaltungszeit] = useState("");
  const [veranstaltungsname, setVeranstaltungsname] = useState("");
  const [kartenUrl, setKartenUrl] = useState("");
  const [oeffentlicheUrl, setOeffentlicheUrl] = useState("");
  const [bemerkung, setBemerkung] = useState("");
  const [anzahlBloecke, setAnzahlBloecke] = useState(2);
  const [fragenProBlock, setFragenProBlock] = useState(5);
  const [kategorieIds, setKategorieIds] = useState<number[]>([]);
  const [medienFilter, setMedienFilter] = useState<MedienFilter>("alle");
  const [nurBereitsVerwendete, setNurBereitsVerwendete] = useState(true);
  const [preisPlatz1, setPreisPlatz1] = useState("");
  const [preisPlatz2, setPreisPlatz2] = useState("");
  const [preisPlatz3, setPreisPlatz3] = useState("");
  const [meldung, setMeldung] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function toggleKategorie(kategorieId: number) {
    setKategorieIds((current) =>
      current.includes(kategorieId)
        ? current.filter((id) => id !== kategorieId)
        : [...current, kategorieId]
    );
  }

  async function handleCreate() {
    setIsLoading(true);
    setMeldung("");

    const result = await createSchnellQuiz({
      eventSeriesId: Number(eventSeriesId),
      titel,
      quizDatum,
      veranstaltungszeit,
      veranstaltungsname,
      kartenUrl,
      oeffentlicheUrl,
      bemerkung,
      anzahlBloecke,
      fragenProBlock,
      kategorieIds,
      medienFilter,
      nurBereitsVerwendete,
      preisPlatz1,
      preisPlatz2,
      preisPlatz3,
    });

    setIsLoading(false);
    setMeldung(result.message);

    if (result.success && result.quizId) {
      window.location.href = `/quiz/${result.quizId}`;
    }
  }

  return (
    <div className="space-y-6 rounded-3xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Schnellquiz</h2>
        <p className="mt-1 text-sm text-slate-500">
          Erstelle automatisch ein Quiz aus deiner bestehenden Fragensammlung.
        </p>
      </div>

      <div className="grid gap-5">
        <label className="block">
          <div className="mb-1 text-sm font-semibold text-slate-700">Eventreihe *</div>
          <select
            required
            value={eventSeriesId}
            onChange={(event) => setEventSeriesId(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3"
          >
            <option value="">Bitte auswählen</option>
            {eventSeries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <label className="block">
          <div className="mb-1 text-sm font-semibold text-slate-700">Titel *</div>
          <input
            required
            maxLength={200}
            value={titel}
            onChange={(event) => setTitel(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-[220px_150px_170px]">
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Quizdatum *
            </div>
            <input
              type="date"
              required
              value={quizDatum}
              onChange={(event) => setQuizDatum(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Blöcke
            </div>
            <input
              type="number"
              min={1}
              max={20}
              value={anzahlBloecke}
              onChange={(event) => setAnzahlBloecke(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm font-semibold text-slate-700">
              Fragen je Block
            </div>
            <input
              type="number"
              min={1}
              max={50}
              value={fragenProBlock}
              onChange={(event) => setFragenProBlock(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </label>
        </div>

        <details className="rounded-2xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-semibold">Optionale Veranstaltungsdaten</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block"><div className="mb-1 text-sm font-semibold">Uhrzeit</div><input type="time" value={veranstaltungszeit} onChange={(event) => setVeranstaltungszeit(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="block"><div className="mb-1 text-sm font-semibold">Veranstaltungsname</div><input maxLength={200} value={veranstaltungsname} onChange={(event) => setVeranstaltungsname(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="block"><div className="mb-1 text-sm font-semibold">Kartenlink</div><input type="url" maxLength={2048} value={kartenUrl} onChange={(event) => setKartenUrl(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="block"><div className="mb-1 text-sm font-semibold">Veranstaltungs-URL</div><input type="url" maxLength={2048} value={oeffentlicheUrl} onChange={(event) => setOeffentlicheUrl(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <label className="block md:col-span-2"><div className="mb-1 text-sm font-semibold">Interne Bemerkung</div><textarea maxLength={2000} value={bemerkung} onChange={(event) => setBemerkung(event.target.value)} className="min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
          </div>
        </details>

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-700">
            Kategorien
          </div>

          <div className="flex flex-wrap gap-2">
            {kategorien.map((kategorie) => {
              const istAusgewaehlt = kategorieIds.includes(
                kategorie.fragenkategorie_id
              );

              return (
                <button
                  key={kategorie.fragenkategorie_id}
                  type="button"
                  onClick={() => toggleKategorie(kategorie.fragenkategorie_id)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${istAusgewaehlt
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {kategorie.kategorie}
                </button>
              );
            })}
          </div>

          {kategorieIds.length === 0 && (
            <div className="mt-2 text-xs text-slate-500">
              Keine Kategorie ausgewählt: Es werden alle Kategorien berücksichtigt.
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-700">
            Medienfilter
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {[
              {
                value: "alle",
                label: "Mit und ohne Medien",
                description: "Alle passenden Fragen zulassen.",
              },
              {
                value: "nurMitMedien",
                label: "Nur Medienfragen",
                description: "Nur Fragen mit Bild, Audio oder Video.",
              },
              {
                value: "nurOhneMedien",
                label: "Nur Textfragen",
                description: "Nur Fragen ohne Medien.",
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMedienFilter(option.value as MedienFilter)}
                className={`rounded-2xl border p-4 text-left transition ${medienFilter === option.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
              >
                <div className="font-bold">{option.label}</div>
                <div
                  className={`mt-1 text-xs ${medienFilter === option.value
                    ? "text-slate-200"
                    : "text-slate-500"
                    }`}
                >
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={nurBereitsVerwendete}
            onChange={(event) =>
              setNurBereitsVerwendete(event.target.checked)
            }
            className="mt-1"
          />

          <div>
            <div className="font-semibold text-slate-900">
              Nur bewährte Fragen verwenden
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Es werden nur Fragen verwendet, die bereits in mindestens einem
              Quiz eingesetzt wurden.
            </div>
          </div>
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                Preise
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Diese Inhalte werden automatisch im Begrüßungs-Slide angezeigt.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label>
                <div className="mb-1 text-sm font-semibold text-slate-700">
                  Platz 1
                </div>

                <input
                  value={preisPlatz1}
                  onChange={(event) => setPreisPlatz1(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  placeholder="z. B. 50 € Gutschein"
                />
              </label>

              <label>
                <div className="mb-1 text-sm font-semibold text-slate-700">
                  Platz 2
                </div>

                <input
                  value={preisPlatz2}
                  onChange={(event) => setPreisPlatz2(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  placeholder="z. B. Getränkerunde"
                />
              </label>

              <label>
                <div className="mb-1 text-sm font-semibold text-slate-700">
                  Platz 3
                </div>

                <input
                  value={preisPlatz3}
                  onChange={(event) => setPreisPlatz3(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  placeholder="z. B. Ruhm und Ehre"
                />
              </label>
            </div>
          </div>
        </label>
      </div>

      {meldung && (
        <div className="rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-700">
          {meldung}
        </div>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={isLoading}
        className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white disabled:bg-slate-400"
      >
        {isLoading ? "Erstelle..." : "Schnellquiz erstellen"}
      </button>
    </div>
  );
}
