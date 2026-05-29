"use client";

import { useEffect, useState } from "react";
import {
  searchTeamsForAntworten,
  saveTeamAntwort,
  startQuizTeamSession,
  getQuizAntwortStatusLive,
} from "../../actions";

type TeamAntwortState = {
  antwortText: string | null;
  antwortId: number | null;
  antwortfelder: Record<number, string>;
};

type AntwortStatus = {
  quiz_id: number;
  titel: string | null;

  offenerBlock:
  | {
    quiz_abschnitt_id: number;
    titel: string;
    abschnitt_typ: string;
    ist_freigegeben: boolean;
    ist_geschlossen: boolean;
  }
  | undefined;

  aktuellerBlock:
  | {
    quiz_abschnitt_id: number;
    titel: string;
    abschnitt_typ: string;
    ist_freigegeben: boolean;
    ist_geschlossen: boolean;
  }
  | undefined;

  blockIstGesperrt: boolean;

  fragen: {
    quiz_fragen_id: number;
    fragen_id: number;
    frage: string;
    istFreigegeben: boolean;
    punkte_modus: string;

    bildMedien: {
      medien_id: number;
      datei: string;
      medientyp: string;
    }[];

    antwortfelder: {
      antwortfeld_id: number;
      label: string;
      sortierung: number;
      ist_pflicht: boolean;
    }[];

    gespeicherteAntwort: {
      antwortId: number | null;
      antwortText: string | null;
      antwortfelder?: {
        antwortfeldId: number;
        antwortText: string | null;
      }[];
    } | null;

    antworten: {
      antwort_id: number;
      antwort: string;
    }[];
  }[];
};

type TeamSession = {
  quiz_team_session_id: number;
  teamname: string;
};

export default function QuizAntwortClient({ daten }: { daten: AntwortStatus }) {
  const [teamname, setTeamname] = useState("");
  const [session, setSession] = useState<TeamSession | null>(null);
  const [teamVorschlaege, setTeamVorschlaege] = useState<
    { team_id: number; teamname: string }[]
  >([]);

  const [liveDaten, setLiveDaten] = useState(daten);
  const [teamPasswort, setTeamPasswort] = useState("");
  const [generiertesPasswort, setGeneriertesPasswort] = useState<string | null>(
    null
  );

  const [antworten, setAntworten] = useState<Record<number, TeamAntwortState>>(
    {}
  );

  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [bildModalUrl, setBildModalUrl] = useState<string | null>(null);

  const aktuellerBlock = liveDaten.aktuellerBlock;
  const blockIstGesperrt = liveDaten.blockIstGesperrt;

  const teamExistiert = teamVorschlaege.some(
    (team) => team.teamname.toLowerCase() === teamname.trim().toLowerCase()
  );

  function getBildUrl(datei: string) {
    if (datei.startsWith("/")) return datei;
    return `/medien/${datei}`;
  }

  useEffect(() => {
    const gespeicherteSession = localStorage.getItem(
      `quiz-session-${liveDaten.quiz_id}`
    );

    if (!gespeicherteSession) return;

    try {
      const parsedSession = JSON.parse(gespeicherteSession) as TeamSession;
      setSession(parsedSession);
      setTeamname(parsedSession.teamname);
    } catch {
      localStorage.removeItem(`quiz-session-${liveDaten.quiz_id}`);
    }
  }, [liveDaten.quiz_id]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const suchtext = teamname.trim();

      if (session || suchtext.length < 2) {
        setTeamVorschlaege([]);
        return;
      }

      setIsLoadingTeams(true);
      const result = await searchTeamsForAntworten(suchtext);
      setTeamVorschlaege(result);
      setIsLoadingTeams(false);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [teamname, session]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const aktuelleDaten = await getQuizAntwortStatusLive(
        liveDaten.quiz_id,
        session?.quiz_team_session_id
      );

      if (aktuelleDaten) {
        setLiveDaten(aktuelleDaten as AntwortStatus);
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [liveDaten.quiz_id, session?.quiz_team_session_id]);

  useEffect(() => {
    if (!session || !liveDaten.offenerBlock || blockIstGesperrt) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      await Promise.all(
        Object.entries(antworten).map(([quizFragenId, antwort]) =>
          saveTeamAntwort({
            quizId: liveDaten.quiz_id,
            quizAbschnittId: liveDaten.offenerBlock!.quiz_abschnitt_id,
            quizFragenId: Number(quizFragenId),
            quizTeamSessionId: session.quiz_team_session_id,
            antwortText: antwort.antwortText,
            antwortId: antwort.antwortId,
            antwortfelder: Object.entries(antwort.antwortfelder).map(
              ([antwortfeldId, antwortText]) => ({
                antwortfeldId: Number(antwortfeldId),
                antwortText,
              })
            ),
          })
        )
      );
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [
    antworten,
    session,
    liveDaten.offenerBlock,
    liveDaten.quiz_id,
    blockIstGesperrt,
  ]);

  useEffect(() => {
    const geladeneAntworten: Record<number, TeamAntwortState> = {};

    liveDaten.fragen.forEach((frage) => {
      if (!frage.gespeicherteAntwort) return;

      const feldAntworten: Record<number, string> = {};

      frage.gespeicherteAntwort.antwortfelder?.forEach((feld) => {
        feldAntworten[feld.antwortfeldId] = feld.antwortText ?? "";
      });

      geladeneAntworten[frage.quiz_fragen_id] = {
        antwortText: frage.gespeicherteAntwort.antwortText,
        antwortId: frage.gespeicherteAntwort.antwortId,
        antwortfelder: feldAntworten,
      };
    });

    setAntworten((current) => ({
      ...geladeneAntworten,
      ...current,
    }));
  }, [liveDaten.fragen]);

  async function handleStartSession() {
    const name = teamname.trim();

    if (!name) {
      setMeldung("Bitte einen Teamnamen eingeben.");
      return;
    }

    setIsStartingSession(true);
    setMeldung("");

    const result = await startQuizTeamSession({
      quizId: liveDaten.quiz_id,
      teamname: name,
      passwort: teamPasswort.trim() || undefined,
    });

    setIsStartingSession(false);

    if (!result.success || !result.session) {
      setMeldung(result.message ?? "Team konnte nicht gestartet werden.");
      return;
    }

    setSession(result.session);
    setTeamname(result.session.teamname);
    setGeneriertesPasswort(result.generiertesPasswort ?? null);
    setTeamVorschlaege([]);

    localStorage.setItem(
      `quiz-session-${liveDaten.quiz_id}`,
      JSON.stringify(result.session)
    );

    const aktuelleDaten = await getQuizAntwortStatusLive(
      liveDaten.quiz_id,
      result.session.quiz_team_session_id
    );

    if (aktuelleDaten) {
      setLiveDaten(aktuelleDaten as AntwortStatus);
    }
  }

  function handleTeamWechseln() {
    localStorage.removeItem(`quiz-session-${liveDaten.quiz_id}`);
    setSession(null);
    setTeamname("");
    setTeamVorschlaege([]);
    setMeldung("");
  }

  function updateAntwortfeld(
    quizFragenId: number,
    antwortfeldId: number,
    value: string
  ) {
    setAntworten((current) => ({
      ...current,
      [quizFragenId]: {
        antwortText: null,
        antwortId: null,
        antwortfelder: {
          ...(current[quizFragenId]?.antwortfelder ?? {}),
          [antwortfeldId]: value,
        },
      },
    }));
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold">
            {liveDaten.titel ?? `Quiz ${liveDaten.quiz_id}`}
          </h1>

          <p className="mt-2 text-slate-600">Antwortformular für Teams</p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Teamname
            </span>

            <input
              value={teamname}
              disabled={!!session}
              onChange={(e) => setTeamname(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="z. B. Die Ratlosen"
            />
          </label>

          {teamExistiert && (
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Team-Passwort
              </span>

              <input
                value={teamPasswort}
                disabled={!!session}
                onChange={(e) => setTeamPasswort(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="Nur nötig, wenn das Team schon existiert"
              />
            </label>
          )}

          {isLoadingTeams && (
            <div className="mt-2 text-sm text-slate-500">
              Teams werden gesucht...
            </div>
          )}

          {teamVorschlaege.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {teamVorschlaege.map((team) => (
                <button
                  key={team.team_id}
                  type="button"
                  onClick={() => {
                    setTeamname(team.teamname);
                    setTeamVorschlaege([]);
                  }}
                  className="block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  {team.teamname}
                </button>
              ))}
            </div>
          )}

          {meldung && (
            <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {meldung}
            </div>
          )}

          <div className="mt-4">
            {session ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-green-50 p-4">
                  <div>
                    <div className="text-sm font-semibold text-green-700">
                      Team angemeldet
                    </div>
                    <div className="text-lg font-bold text-green-900">
                      {session.teamname}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTeamWechseln}
                    className="rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700"
                  >
                    Team wechseln
                  </button>
                </div>

                {generiertesPasswort && (
                  <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-yellow-900">
                    <div className="text-sm font-semibold uppercase tracking-wide">
                      Euer Team-Passwort:
                    </div>

                    <div className="mt-2 text-3xl font-black">
                      {generiertesPasswort}
                    </div>

                    <p className="mt-2 text-sm">
                      Merkt euch dieses Passwort. Damit könnt ihr euch später
                      mit demselben Teamnamen wieder anmelden.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartSession}
                disabled={!teamname.trim() || isStartingSession}
                className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isStartingSession ? "Wird gestartet..." : "Quiz beitreten"}
              </button>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {aktuellerBlock ? (
            <>
              <div className="text-sm font-semibold uppercase tracking-wide text-green-600">
                Aktuell freigegeben
              </div>

              <h2 className="mt-2 text-2xl font-bold">
                {aktuellerBlock.titel}
              </h2>

              <div className="mt-6 space-y-5">
                {(!aktuellerBlock || blockIstGesperrt
                  ? []
                  : liveDaten.fragen.filter((frage) => frage.istFreigegeben)
                ).map((frage, frageIndex) => {
                  const antwortfelder = frage.antwortfelder ?? [];
                  const bildMedien = frage.bildMedien ?? [];

                  const hatAntwortfelder = antwortfelder.length > 0;
                  const hatBild = bildMedien.length > 0;

                  return (
                    <div
                      key={frage.quiz_fragen_id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-3 text-sm font-semibold text-slate-500">
                        Frage {frageIndex + 1}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">
                        {frage.frage}
                      </h3>

                      {frage.punkte_modus !== "standard" && (
                        <div className="mt-3 rounded-xl bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-900">
                          {frage.punkte_modus === "expertenbonus"
                            ? "Expertenbonus: Wenn nur ein Team diese Frage richtig beantwortet, gibt es doppelte Punkte."
                            : "Risikofrage: Je weniger Teams richtig liegen, desto mehr Punkte gibt es für eine richtige Antwort."}
                        </div>
                      )}

                      {hatBild && (
                        <button
                          type="button"
                          onClick={() =>
                            setBildModalUrl(
                              getBildUrl(bildMedien[0].datei)
                            )
                          }
                          className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
                        >
                          Bild anzeigen
                        </button>
                      )}

                      {hatAntwortfelder ? (
                        <div className="mt-4 space-y-3">
                          {antwortfelder.map((feld) => (
                            <label
                              key={feld.antwortfeld_id}
                              className="block"
                            >
                              <span className="mb-2 block text-sm font-semibold text-slate-700">
                                {feld.label}
                                {feld.ist_pflicht ? " *" : ""}
                              </span>

                              <input
                                disabled={blockIstGesperrt}
                                value={
                                  antworten[frage.quiz_fragen_id]
                                    ?.antwortfelder?.[
                                  feld.antwortfeld_id
                                  ] ?? ""
                                }
                                onChange={(e) =>
                                  updateAntwortfeld(
                                    frage.quiz_fragen_id,
                                    feld.antwortfeld_id,
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                                placeholder={`${feld.label} eintragen...`}
                              />
                            </label>
                          ))}
                        </div>
                      ) : frage.antworten.length > 1 ? (
                        <div className="mt-4 space-y-2">
                          {frage.antworten.map((antwort, antwortIndex) => (
                            <label
                              key={antwort.antwort_id}
                              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
                            >
                              <input
                                type="radio"
                                name={`frage-${frage.quiz_fragen_id}`}
                                checked={
                                  antworten[frage.quiz_fragen_id]
                                    ?.antwortId === antwort.antwort_id
                                }
                                disabled={blockIstGesperrt}
                                onChange={() =>
                                  setAntworten((current) => ({
                                    ...current,
                                    [frage.quiz_fragen_id]: {
                                      antwortText: null,
                                      antwortId: antwort.antwort_id,
                                      antwortfelder: {},
                                    },
                                  }))
                                }
                                className="mt-1"
                              />

                              <span>
                                <span className="mr-2 font-bold">
                                  {String.fromCharCode(65 + antwortIndex)}.
                                </span>
                                {antwort.antwort}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          disabled={blockIstGesperrt}
                          value={
                            antworten[frage.quiz_fragen_id]?.antwortText ?? ""
                          }
                          onChange={(e) =>
                            setAntworten((current) => ({
                              ...current,
                              [frage.quiz_fragen_id]: {
                                antwortText: e.target.value,
                                antwortId: null,
                                antwortfelder: {},
                              },
                            }))
                          }
                          className="mt-4 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                          placeholder="Antwort eintragen..."
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Noch kein Block freigegeben
              </div>

              <p className="mt-2 text-slate-600">
                Bitte warte, bis der Moderator die nächste Fragenrunde freigibt.
              </p>
            </>
          )}
        </section>
      </div>

      {bildModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-full max-w-full rounded-2xl bg-white p-3">
            <button
              type="button"
              onClick={() => setBildModalUrl(null)}
              className="mb-3 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
            >
              Bild schließen
            </button>

            <img
              src={bildModalUrl}
              alt="Bild zur Frage"
              className="max-h-[75vh] max-w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </main>
  );
}