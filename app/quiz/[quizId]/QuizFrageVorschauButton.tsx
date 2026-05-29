"use client";

import { useState } from "react";
import { getFrageVorschau } from "../actions";
import type { FrageVorschauResult } from "../actions";

type Props = {
  fragenId: number;
};

const buttonClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]";

export default function QuizFrageVorschauButton({ fragenId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [frage, setFrage] = useState<FrageVorschauResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function openPreview() {
    setIsOpen(true);
    setIsLoading(true);

    const result = await getFrageVorschau(fragenId);

    setFrage(result);
    setIsLoading(false);
  }

  return (
    <>
      <button type="button" onClick={openPreview} className={buttonClass}>
        Vorschau
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Fragenvorschau</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Frage, Antworten und hinterlegte Medien.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={buttonClass}
              >
                Schließen
              </button>
            </div>

            {isLoading && (
              <p className="text-sm text-slate-500">Vorschau wird geladen...</p>
            )}

            {!isLoading && !frage && (
              <p className="text-sm text-red-600">
                Die Frage konnte nicht geladen werden.
              </p>
            )}

            {!isLoading && frage && (
              <div className="space-y-5 text-slate-900">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Frage
                  </div>

                  <div className="whitespace-pre-wrap text-lg font-medium">
                    {frage.frage}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Quelle: {frage.quelle ?? "-"}</span>
                    <span>
                      Schwierigkeit: {frage.schwierigkeitslevel ?? "-"}
                    </span>
                    <span>
                      Kategorien:{" "}
                      {frage.kategorien.length > 0
                        ? frage.kategorien.join(", ")
                        : "-"}
                    </span>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 font-semibold">Medien zur Frage</h3>

                  {frage.medien.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Keine Medien zur Frage hinterlegt.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {frage.medien.map((medium) => (
                        <div
                          key={medium.medien_id}
                          className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
                        >
                          <div className="font-medium">{medium.datei}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {medium.medientyp} · Sortierung{" "}
                            {medium.sortierung}
                          </div>
                          {medium.bemerkung && (
                            <div className="mt-1 text-xs text-slate-500">
                              {medium.bemerkung}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="mb-3 font-semibold">Antworten</h3>

                  <div className="space-y-3">
                    {frage.antworten.map((antwort, index) => (
                      <div
                        key={antwort.antwort_id}
                        className={`rounded-2xl border p-4 ${
                          antwort.ist_richtig
                            ? "border-green-200 bg-green-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-4">
                          <div className="font-medium">
                            Antwort {index + 1}
                          </div>

                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {antwort.antworttyp}
                            {antwort.ist_richtig ? " · richtig" : ""}
                          </div>
                        </div>

                        <div className="whitespace-pre-wrap text-sm">
                          {antwort.antwort}
                        </div>

                        {antwort.medien.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {antwort.medien.map((medium) => (
                              <div
                                key={medium.medien_id}
                                className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600"
                              >
                                <div className="font-medium">
                                  {medium.datei}
                                </div>
                                <div>
                                  {medium.medientyp} · Sortierung{" "}
                                  {medium.sortierung}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}