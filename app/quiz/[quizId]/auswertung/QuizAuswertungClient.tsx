"use client";

import { useMemo, useState } from "react";
import { updateTeamAntwortBewertung } from "../../actions";

type AuswertungsAntwort = {
  quiz_fragen_id: number;
  fragen_id: number;
  frageIndex: number;
  frage: string;
  richtigeAntwort: string;
  punkte_modus?: string;

  team_antwort_id: number | null;
  istUnbeantwortet: boolean;
  teamname: string;
  antwortText: string | null;
  antwortId: number | null;
  ausgewaehlteAntwort: string | null;

  istOffeneFrage: boolean;
  istAutomatischRichtig: boolean;
  istPruefpflichtig: boolean;
  istManuellRichtig: boolean;
  istManuellFalsch: boolean;
  bewerteteAntwort: string | null;
  istSkurril: boolean;
  bewertungFinal: boolean;
  autoBasisPunkte: number;
  autoEndpunkte: number;
  vergebenePunkte: number;
  bewertungsstatus: "UNANSWERED" | "WRONG" | "PARTIAL" | "CORRECT" | "REVIEW_REQUIRED";
  bewertungsquelle: "AUTO" | "MANUAL" | "LEGACY";
};

type PunktestandEintrag = {
  teamname: string;
  punkte: number;
};

type BewertungsAktion =
  | "richtig"
  | "teilweise"
  | "falsch"
  | "skurril"
  | "zuruecksetzen";

export default function QuizAuswertungClient({
  quizId,
  antworten,
  punktestand,
}: {
  quizId: number;
  antworten: AuswertungsAntwort[];
  punktestand: PunktestandEintrag[];
}) {
  const [aktiverTab, setAktiverTab] = useState<"antworten" | "punktestand">(
    "antworten"
  );

  const [nurOffeneFragen, setNurOffeneFragen] = useState(true);
  const [nurFalscheAntworten, setNurFalscheAntworten] = useState(true);
  const [zeigeUnbeantwortete, setZeigeUnbeantwortete] = useState(false);
  const [teamIndex, setTeamIndex] = useState<number | null>(null);
  const [punkteOverrides, setPunkteOverrides] = useState<Record<number, string>>({});

  const teamnamen = useMemo(
    () =>
      Array.from(new Set(antworten.map((antwort) => antwort.teamname))).sort(),
    [antworten]
  );

  const ausgewaehltesTeam =
    teamIndex === null ? null : teamnamen[teamIndex] ?? null;

  const sichtbareAntworten = antworten.filter((antwort) => {
    if (ausgewaehltesTeam && antwort.teamname !== ausgewaehltesTeam) {
      return false;
    }

    if (nurOffeneFragen && !antwort.istOffeneFrage) return false;
    if (nurFalscheAntworten && antwort.istAutomatischRichtig) return false;
    if (!zeigeUnbeantwortete && antwort.istUnbeantwortet) return false;

    return true;
  });

  async function handleBewertung(
    teamAntwortId: number,
    aktion: BewertungsAktion,
    punkte?: string,
  ) {
    await updateTeamAntwortBewertung({
      quizId,
      teamAntwortId,
      aktion,
      punkte,
    });
  }

  function vorherigesTeam() {
    setTeamIndex((current) => {
      if (teamnamen.length === 0) return null;
      if (current === null) return teamnamen.length - 1;
      return current <= 0 ? teamnamen.length - 1 : current - 1;
    });
  }

  function naechstesTeam() {
    setTeamIndex((current) => {
      if (teamnamen.length === 0) return null;
      if (current === null) return 0;
      return current >= teamnamen.length - 1 ? 0 : current + 1;
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setAktiverTab("antworten")}
            className={`rounded-xl px-5 py-2 text-sm font-bold transition ${
              aktiverTab === "antworten"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Antwortprüfung
          </button>

          <button
            type="button"
            onClick={() => setAktiverTab("punktestand")}
            className={`rounded-xl px-5 py-2 text-sm font-bold transition ${
              aktiverTab === "punktestand"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Punktestand
          </button>
        </div>
      </div>

      {aktiverTab === "punktestand" && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Platz</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Punkte</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {punktestand.map((team, index) => (
                <tr key={team.teamname}>
                  <td className="px-4 py-3 font-black text-slate-700">
                    #{index + 1}
                  </td>

                  <td className="px-4 py-3 font-bold text-slate-900">
                    {team.teamname}
                  </td>

                  <td className="px-4 py-3 text-lg font-black text-blue-700">
                    {team.punkte.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aktiverTab === "antworten" && (
        <>
          <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setTeamIndex(null)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  teamIndex === null
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Alle Teams
              </button>

              <button
                type="button"
                onClick={vorherigesTeam}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
              >
                ←
              </button>

              <button
                type="button"
                onClick={naechstesTeam}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
              >
                →
              </button>

              <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-800">
                {ausgewaehltesTeam ?? "Alle Teams"}
              </div>

              <div className="mx-2 h-8 w-px bg-slate-200" />

              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <span>nur offene Fragen</span>

                <button
                  type="button"
                  onClick={() => setNurOffeneFragen((current) => !current)}
                  className={`relative h-6 w-11 rounded-full transition ${
                    nurOffeneFragen ? "bg-blue-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      nurOffeneFragen ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <span>nur falsche Antwort</span>

                <button
                  type="button"
                  onClick={() =>
                    setNurFalscheAntworten((current) => !current)
                  }
                  className={`relative h-6 w-11 rounded-full transition ${
                    nurFalscheAntworten ? "bg-blue-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      nurFalscheAntworten
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <span>unbeantwortete</span>

                <button
                  type="button"
                  onClick={() =>
                    setZeigeUnbeantwortete((current) => !current)
                  }
                  className={`relative h-6 w-11 rounded-full transition ${
                    zeigeUnbeantwortete ? "bg-blue-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      zeigeUnbeantwortete
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </label>

              <div className="ml-auto text-sm font-semibold text-slate-500">
                {sichtbareAntworten.length} Treffer
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Frage</th>
                  <th className="px-4 py-3">Lösung</th>
                  <th className="px-4 py-3">Antwort</th>
                  <th className="px-4 py-3">Bewertung</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {sichtbareAntworten.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-slate-500">
                      Keine Antworten für diesen Filter.
                    </td>
                  </tr>
                ) : (
                  sichtbareAntworten.map((antwort) => (
                    <tr
                      key={`${antwort.quiz_fragen_id}-${antwort.teamname}-${
                        antwort.team_antwort_id ?? "unbeantwortet"
                      }`}
                      className={`align-top ${
                        antwort.istUnbeantwortet
                          ? "bg-slate-50"
                          : antwort.istManuellRichtig
                            ? "bg-green-50"
                            : antwort.istManuellFalsch
                              ? "bg-red-50"
                              : antwort.istSkurril
                                ? "bg-pink-50"
                                : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">
                        {antwort.teamname}
                      </td>

                      <td className="max-w-sm px-4 py-3 text-slate-700">
                        <div className="mb-1 text-xs font-bold uppercase text-slate-400">
                          Frage {antwort.frageIndex}
                        </div>

                        {antwort.frage}
                      </td>

                      <td className="max-w-xs px-4 py-3 font-semibold text-green-900">
                        {antwort.richtigeAntwort}
                      </td>

                      <td className="max-w-xs px-4 py-3 font-semibold text-slate-900">
                        {antwort.istUnbeantwortet
                          ? "-"
                          : antwort.antwortText ??
                            antwort.ausgewaehlteAntwort ??
                            "-"}
                      </td>

                      <td className="px-4 py-3">
                        {antwort.istUnbeantwortet ? (
                          <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                            unbeantwortet
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <div className="w-full text-xs text-slate-600">
                              Automatisch: <strong>{antwort.autoEndpunkte}</strong> Punkte
                              {" · "}Vergeben: <strong>{antwort.vergebenePunkte}</strong>
                              {" · "}{antwort.bewertungsstatus}
                              {antwort.bewertungsquelle === "MANUAL" ? " (manuell)" : ""}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleBewertung(
                                  antwort.team_antwort_id!,
                                  "skurril"
                                )
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:opacity-80 ${
                                antwort.istSkurril
                                  ? "border-pink-500 bg-pink-500 text-white"
                                  : "border-pink-300 bg-pink-50 text-pink-700"
                              }`}
                            >
                              Skurril
                            </button>

                            <label className="flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  punkteOverrides[antwort.team_antwort_id!] ??
                                  String(antwort.vergebenePunkte)
                                }
                                onChange={(event) =>
                                  setPunkteOverrides((current) => ({
                                    ...current,
                                    [antwort.team_antwort_id!]: event.target.value,
                                  }))
                                }
                                aria-label="Manuelle Punkte"
                                className="w-16 rounded-lg border border-amber-300 px-2 py-1.5 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleBewertung(
                                    antwort.team_antwort_id!,
                                    "teilweise",
                                    punkteOverrides[antwort.team_antwort_id!] ??
                                      String(antwort.vergebenePunkte),
                                  )
                                }
                                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"
                              >
                                Teilweise
                              </button>
                            </label>

                            <button
                              type="button"
                              onClick={() =>
                                handleBewertung(
                                  antwort.team_antwort_id!,
                                  "richtig"
                                )
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:opacity-80 ${
                                antwort.istManuellRichtig
                                  ? "border-green-600 bg-green-600 text-white"
                                  : "border-green-300 bg-green-50 text-green-700"
                              }`}
                            >
                              Richtig
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleBewertung(
                                  antwort.team_antwort_id!,
                                  "falsch"
                                )
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:opacity-80 ${
                                antwort.istManuellFalsch
                                  ? "border-red-600 bg-red-600 text-white"
                                  : "border-red-300 bg-red-50 text-red-700"
                              }`}
                            >
                              Falsch
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleBewertung(
                                  antwort.team_antwort_id!,
                                  "zuruecksetzen"
                                )
                              }
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
