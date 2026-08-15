"use client";

/* eslint-disable @next/next/no-img-element -- Pixel stages use dynamic question-media URLs. */

import { useEffect, useState } from "react";
import {
  searchTeamsForAntworten,
  saveTeamAntwortDraft,
  startQuizTeamSession,
  getQuizAntwortStatusLive,
  getQuizLiveSnapshot,
  submitTeamAntwort,
  stopPixelbildAntwort,
} from "../../actions";
import type { ResolvedQuizTheme } from "@/app/rendering/theme/quizTheme";
import { QuizThemeScope } from "@/app/rendering/theme/QuizThemeScope";
import type { ResolvedQuizAnswerInteraction } from "@/app/quiz/answerInteraction";
import GenericAnswerRenderer, {
  type TeamAnswerDraft,
} from "./GenericAnswerRenderer";
import {
  interactionPayloadToDraft,
  type QuizInteractionPayload,
} from "@/app/quiz/interaction/interactionPayload";
import {
  isDraftChangedSinceSubmission,
  resolveInteractionSubmissionPolicy,
} from "@/app/quiz/interaction/interactionSubmissionPolicy";
import {
  pixelRuntimeStageToMediaSlot,
  type PixelLiveState,
} from "@/app/quiz/interaction/pixelLiveInteraction";

type TeamAntwortState = TeamAnswerDraft;

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
  interactionRun: {
    id: number;
    type: string;
    state: "LOCKED" | "OPEN" | "COUNTDOWN" | "CLOSED" | "REVEALED";
    deadlineAt: string | null;
    revision: number;
  } | null;
  interactionState: "LOCKED" | "OPEN" | "COUNTDOWN" | "CLOSED" | "REVEALED";
  answerPhase: "QUESTION" | "SOLUTION" | "NON_QUESTION" | "LEGACY" | "UNKNOWN";
  presentationStatusText: string | null;

  fragen: {
    quiz_fragen_id: number;
    fragen_id: number;
    frage: string;
    templateId: string | null;
    interaction: ResolvedQuizAnswerInteraction;
    istFreigegeben: boolean;
    punkte_modus: string;
    urspruenglicher_antwortmodus: "OPEN" | "CLOSED" | "UNCLASSIFIED";
    effektiver_antwortmodus: "OPEN" | "CLOSED" | "UNCLASSIFIED";
    freie_antwort_erlaubt: boolean;

    bildMedien: {
      medien_id: number;
      datei: string;
      medientyp: string;
      slotKey: string | null;
    }[];

    antwortfelder: {
      antwortfeld_id: number;
      label: string;
      sortierung: number;
      ist_pflicht: boolean;
    }[];

    gespeicherteAntwort: {
      antwortId: number | null;
      antwortIds?: number[];
      antwortText: string | null;
      draftRevision: number;
      draftUpdatedAt: string;
      submissionStatus: "SUBMITTED" | "AUTO_FINALIZED" | null;
      submissionDraftRevision: number | null;
      submissionVersion: number | null;
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
  teamPasswort: string | null;
  sessionToken: string;
};

export default function QuizAntwortClient({ daten, theme }: { daten: AntwortStatus; theme: ResolvedQuizTheme }) {
  const [teamname, setTeamname] = useState("");
  const [spielerAnzahl, setSpielerAnzahl] = useState("1");
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
  const [draftRevisions, setDraftRevisions] = useState<Record<number, number>>(
    {},
  );
  const [submissionStatuses, setSubmissionStatuses] = useState<
    Record<number, "SUBMITTED" | "AUTO_FINALIZED" | undefined>
  >({});
  const [submissionDraftRevisions, setSubmissionDraftRevisions] = useState<
    Record<number, number | undefined>
  >({});
  const [locallyEditedSinceSubmission, setLocallyEditedSinceSubmission] =
    useState<Record<number, boolean | undefined>>({});
  const [currentSubmissionStatus, setCurrentSubmissionStatus] = useState<
    "SUBMITTED" | "AUTO_FINALIZED" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pixelState, setPixelState] = useState<PixelLiveState | null>(null);
  const [pixelTeamState, setPixelTeamState] = useState<{
    isStopper: boolean;
    canStop: boolean;
    canEdit: boolean;
    canSubmit: boolean;
  } | null>(null);

  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [bildModalUrl, setBildModalUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const aktuellerBlock = liveDaten.aktuellerBlock;
  const blockIstGesperrt = liveDaten.blockIstGesperrt;

  const speicherBlockId =
    liveDaten.offenerBlock?.quiz_abschnitt_id ??
    liveDaten.aktuellerBlock?.quiz_abschnitt_id ??
    null;
  const teamExistiert = teamVorschlaege.some(
    (team) => team.teamname.toLowerCase() === teamname.trim().toLowerCase()
  );

  function getBildUrl(datei: string) {
    if (/^https?:\/\//.test(datei)) {
      return datei;
    }

    if (datei.startsWith("/")) {
      return datei;
    }

    return `/medien/${datei}`;
  }

  useEffect(() => {
    const gespeicherteSession = localStorage.getItem(
      `quiz-session-${liveDaten.quiz_id}`
    );

    if (!gespeicherteSession) return;

    try {
      const parsedSession = JSON.parse(gespeicherteSession) as TeamSession;
      if (!parsedSession.sessionToken) {
        localStorage.removeItem(`quiz-session-${liveDaten.quiz_id}`);
        return;
      }
      // Restore the external localStorage session into the client state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
      const snapshot = await getQuizLiveSnapshot(
        liveDaten.quiz_id,
        session?.sessionToken,
      );
      if (!active) return;
      setPixelState(snapshot.pixelState);
      setPixelTeamState(snapshot.pixelState && snapshot.teamSpecificState
        ? {
            isStopper: snapshot.teamSpecificState.isStopper,
            canStop: snapshot.teamSpecificState.canStop,
            canEdit: snapshot.teamSpecificState.canEdit,
            canSubmit: snapshot.teamSpecificState.canSubmit,
          }
        : null);
      setCurrentSubmissionStatus(
        snapshot.teamSpecificState?.submission?.status ?? null,
      );
      const currentQuestionId = liveDaten.fragen[0]?.quiz_fragen_id ?? null;
      const nextQuestionId = snapshot.activeQuestionReference?.quizFragenId ?? null;
      const needsFullRefresh =
        currentQuestionId !== nextQuestionId ||
        liveDaten.interactionState !== snapshot.publicState ||
        liveDaten.interactionRun?.revision !== snapshot.interactionRun?.revision;
      if (needsFullRefresh) {
        const aktuelleDaten = await getQuizAntwortStatusLive(
          liveDaten.quiz_id,
          session?.sessionToken,
        );
        if (active && aktuelleDaten) {
          const nextLiveData = aktuelleDaten as AntwortStatus;
          if (liveDaten.interactionRun?.id !== nextLiveData.interactionRun?.id) {
            setAntworten({});
            setDraftRevisions({});
            setSubmissionStatuses({});
            setSubmissionDraftRevisions({});
            setLocallyEditedSinceSubmission({});
          }
          setLiveDaten(nextLiveData);
        }
        return;
      }
      const teamState = snapshot.teamSpecificState;
      const question = liveDaten.fragen[0];
      if (
        question &&
        teamState?.draft &&
        teamState.draft.revision >
          (draftRevisions[question.quiz_fragen_id] ?? 0)
      ) {
        const serverDraft = interactionPayloadToDraft(
          question.interaction,
          teamState.draft.payload as QuizInteractionPayload,
        );
        setAntworten((current) => ({
          ...current,
          [question.quiz_fragen_id]:
            (draftRevisions[question.quiz_fragen_id] ?? 0) >
            teamState.draft!.revision
              ? current[question.quiz_fragen_id]
              : serverDraft,
        }));
        setDraftRevisions((current) => ({
          ...current,
          [question.quiz_fragen_id]: teamState.draft!.revision,
        }));
      }
      if (question && teamState?.submission?.status) {
        setSubmissionStatuses((current) => ({
          ...current,
          [question.quiz_fragen_id]: teamState.submission!.status,
        }));
        setSubmissionDraftRevisions((current) => ({
          ...current,
          [question.quiz_fragen_id]: teamState.submission!.draftRevision,
        }));
        if (
          teamState.draft &&
          teamState.draft.revision > teamState.submission.draftRevision
        ) {
          setLocallyEditedSinceSubmission((current) => ({
            ...current,
            [question.quiz_fragen_id]: true,
          }));
        }
      }
      } finally {
        refreshing = false;
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 1500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [
    draftRevisions,
    liveDaten.fragen,
    liveDaten.interactionRun?.id,
    liveDaten.interactionRun?.revision,
    liveDaten.interactionState,
    liveDaten.quiz_id,
    session?.sessionToken,
  ]);

  useEffect(() => {
    if (
      !session ||
      !speicherBlockId ||
      blockIstGesperrt ||
      isSubmitting ||
      !liveDaten.interactionRun
    ) {
      return;
    }
    const timeout = window.setTimeout(async () => {
      const visibleQuestionIds = new Set(
        liveDaten.fragen.map((frage) => frage.quiz_fragen_id),
      );
      try {
        const results = await Promise.all(
          Object.entries(antworten)
            .filter(([quizFragenId]) => {
              const id = Number(quizFragenId);
              return visibleQuestionIds.has(id);
            })
            .map(async ([quizFragenId, antwort]) => {
              const questionId = Number(quizFragenId);
              const result = await saveTeamAntwortDraft({
                quizId: liveDaten.quiz_id,
                quizAbschnittId: speicherBlockId,
                quizFragenId: questionId,
                quizTeamSessionToken: session.sessionToken,
                interactionRunId: liveDaten.interactionRun!.id,
                expectedDraftRevision: draftRevisions[questionId] ?? 0,
                antwortText: antwort.antwortText,
                antwortId: antwort.antwortId,
                antwortIds: antwort.antwortIds,
                antwortfelder: Object.entries(antwort.antwortfelder).map(
                  ([antwortfeldId, antwortText]) => ({
                    antwortfeldId: Number(antwortfeldId),
                    antwortText,
                  }),
                ),
              });
              return { questionId, result };
            }),
        );
        for (const { questionId, result } of results) {
          if (result.success) {
            setDraftRevisions((current) => ({
              ...current,
              [questionId]: result.draftRevision,
            }));
          } else if (result.reason === "FINALIZED") {
            setSubmissionStatuses((current) => ({
              ...current,
              [questionId]: "SUBMITTED",
            }));
          }
        }
        const conflict = results.find(
          ({ result }) => !result.success && result.reason === "REVISION_CONFLICT",
        );
        if (conflict) {
          const snapshot = await getQuizLiveSnapshot(
            liveDaten.quiz_id,
            session.sessionToken,
          );
          const question = liveDaten.fragen.find(
            (entry) => entry.quiz_fragen_id === conflict.questionId,
          );
          if (question && snapshot.teamSpecificState?.draft) {
            setAntworten((current) => ({
              ...current,
              [conflict.questionId]: interactionPayloadToDraft(
                question.interaction,
                snapshot.teamSpecificState!.draft!.payload as QuizInteractionPayload,
              ),
            }));
            setDraftRevisions((current) => ({
              ...current,
              [conflict.questionId]: snapshot.teamSpecificState!.draft!.revision,
            }));
          }
          setMeldung(
            "Die Antwort wurde in einem anderen Tab ge\u00e4ndert. Der aktuelle Serverstand wurde geladen.",
          );
          return;
        }
        if (
          results.some(
            ({ result }) => !result.success && result.reason !== "FINALIZED",
          )
        ) {
          const aktuelleDaten = await getQuizAntwortStatusLive(
            liveDaten.quiz_id,
            session.sessionToken,
          );
          if (aktuelleDaten) setLiveDaten(aktuelleDaten as AntwortStatus);
          setMeldung(
            "Die Frage hat inzwischen gewechselt. Der aktuelle Stand wurde neu geladen.",
          );
        }
      } catch {
        const aktuelleDaten = await getQuizAntwortStatusLive(
          liveDaten.quiz_id,
          session.sessionToken,
        );
        if (aktuelleDaten) setLiveDaten(aktuelleDaten as AntwortStatus);
        setMeldung(
          "Die Frage hat inzwischen gewechselt. Der aktuelle Stand wurde neu geladen.",
        );
      }
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [
    antworten,
    session,
    speicherBlockId,
    liveDaten.offenerBlock,
    liveDaten.quiz_id,
    liveDaten.fragen,
    liveDaten.interactionRun,
    blockIstGesperrt,
    draftRevisions,
    isSubmitting,
  ]);

  useEffect(() => {
    const geladeneAntworten: Record<number, TeamAntwortState> = {};
    const geladeneRevisionen: Record<number, number> = {};
    const geladeneStatus: Record<
      number,
      "SUBMITTED" | "AUTO_FINALIZED"
    > = {};
    const geladeneSubmissionRevisionen: Record<number, number> = {};
    const geaenderteEntwuerfe: Record<number, boolean> = {};

    liveDaten.fragen.forEach((frage) => {
      if (!frage.gespeicherteAntwort) {
        if (frage.interaction.type === "ORDER") {
          const original = frage.interaction.items.map(
            (item) => item.id,
          );
          const randomized = [...original].sort(() => Math.random() - 0.5);
          if (
            randomized.length > 1 &&
            randomized.every((id, index) => id === original[index])
          ) {
            randomized.push(randomized.shift()!);
          }
          geladeneAntworten[frage.quiz_fragen_id] = {
            antwortText: JSON.stringify(randomized),
            antwortId: null,
            antwortfelder: {},
          };
        }
        return;
      }

      const feldAntworten: Record<number, string> = {};
      geladeneRevisionen[frage.quiz_fragen_id] =
        frage.gespeicherteAntwort.draftRevision;
      if (frage.gespeicherteAntwort.submissionStatus) {
        geladeneStatus[frage.quiz_fragen_id] =
          frage.gespeicherteAntwort.submissionStatus;
      }
      if (frage.gespeicherteAntwort.submissionDraftRevision !== null) {
        geladeneSubmissionRevisionen[frage.quiz_fragen_id] =
          frage.gespeicherteAntwort.submissionDraftRevision;
        geaenderteEntwuerfe[frage.quiz_fragen_id] =
          isDraftChangedSinceSubmission(
            frage.gespeicherteAntwort.draftRevision,
            frage.gespeicherteAntwort.submissionDraftRevision,
          );
      }

      frage.gespeicherteAntwort.antwortfelder?.forEach((feld) => {
        feldAntworten[feld.antwortfeldId] = feld.antwortText ?? "";
      });

      geladeneAntworten[frage.quiz_fragen_id] = {
        antwortText: frage.gespeicherteAntwort.antwortText,
        antwortId: frage.gespeicherteAntwort.antwortId,
        antwortIds: frage.gespeicherteAntwort.antwortIds,
        antwortfelder: feldAntworten,
      };
    });

    // Synchronize newly released server answers without overwriting local edits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAntworten((current) => ({
      ...geladeneAntworten,
      ...current,
    }));
    setDraftRevisions((current) => ({ ...current, ...geladeneRevisionen }));
    setSubmissionStatuses((current) => ({ ...current, ...geladeneStatus }));
    setSubmissionDraftRevisions((current) => ({
      ...current,
      ...geladeneSubmissionRevisionen,
    }));
    setLocallyEditedSinceSubmission((current) => ({
      ...geaenderteEntwuerfe,
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
      teamname: teamname.trim(),
      passwort: teamPasswort.trim() || undefined,
      spielerAnzahl: Math.max(1, Number(spielerAnzahl) || 1),
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
    setAntworten({});
    setDraftRevisions({});
    setSubmissionStatuses({});
    setSubmissionDraftRevisions({});
    setLocallyEditedSinceSubmission({});
    setCurrentSubmissionStatus(null);

    localStorage.setItem(
      `quiz-session-${liveDaten.quiz_id}`,
      JSON.stringify(result.session)
    );

    const aktuelleDaten = await getQuizAntwortStatusLive(
      liveDaten.quiz_id,
      result.session.sessionToken
    );

    if (aktuelleDaten) {
      setLiveDaten(aktuelleDaten as AntwortStatus);
    }
  }

  function handleTeamWechseln() {
    localStorage.removeItem(`quiz-session-${liveDaten.quiz_id}`);
    setSession(null);
    setTeamname("");
    setTeamPasswort("");
    setGeneriertesPasswort(null);
    setSpielerAnzahl("1");
    setTeamVorschlaege([]);
    setMeldung("");
    setAntworten({});
    setDraftRevisions({});
    setSubmissionStatuses({});
    setSubmissionDraftRevisions({});
    setLocallyEditedSinceSubmission({});
    setCurrentSubmissionStatus(null);
  }

  async function handleSubmit(quizFragenId: number) {
    const draft = antworten[quizFragenId];
    const run = liveDaten.interactionRun;
    if (!session || !draft || !run || !speicherBlockId) {
      setMeldung("Bitte zuerst eine Antwort eintragen.");
      return;
    }
    setIsSubmitting(true);
    setMeldung("");
    try {
      const saved = await saveTeamAntwortDraft({
        quizId: liveDaten.quiz_id,
        quizAbschnittId: speicherBlockId,
        quizFragenId,
        quizTeamSessionToken: session.sessionToken,
        interactionRunId: run.id,
        expectedDraftRevision: draftRevisions[quizFragenId] ?? 0,
        antwortText: draft.antwortText,
        antwortId: draft.antwortId,
        antwortIds: draft.antwortIds,
        antwortfelder: Object.entries(draft.antwortfelder).map(
          ([antwortfeldId, antwortText]) => ({
            antwortfeldId: Number(antwortfeldId),
            antwortText,
          }),
        ),
      });
      if (!saved.success) {
        if (saved.reason === "REVISION_CONFLICT") {
          const snapshot = await getQuizLiveSnapshot(
            liveDaten.quiz_id,
            session.sessionToken,
          );
          const question = liveDaten.fragen.find(
            (entry) => entry.quiz_fragen_id === quizFragenId,
          );
          if (question && snapshot.teamSpecificState?.draft) {
            setAntworten((current) => ({
              ...current,
              [quizFragenId]: interactionPayloadToDraft(
                question.interaction,
                snapshot.teamSpecificState!.draft!.payload as QuizInteractionPayload,
              ),
            }));
            setDraftRevisions((current) => ({
              ...current,
              [quizFragenId]: snapshot.teamSpecificState!.draft!.revision,
            }));
          }
        }
        setMeldung(
          saved.reason === "REVISION_CONFLICT"
            ? "Die Antwort wurde in einem anderen Tab ge\u00e4ndert. Der aktuelle Serverstand wurde geladen; bitte pr\u00fcfen und erneut absenden."
            : "Die Antwortzeit ist inzwischen beendet.",
        );
        return;
      }
      setDraftRevisions((current) => ({
        ...current,
        [quizFragenId]: saved.draftRevision,
      }));
      const submitted = await submitTeamAntwort({
        quizId: liveDaten.quiz_id,
        quizFragenId,
        interactionRunId: run.id,
        quizTeamSessionToken: session.sessionToken,
      });
      if (!submitted.success) {
        setMeldung(
          submitted.reason === "EMPTY_DRAFT"
            ? "Bitte zuerst eine Antwort eintragen."
            : "Die Antwortzeit ist inzwischen beendet.",
        );
        return;
      }
      setSubmissionStatuses((current) => ({
        ...current,
        [quizFragenId]: "SUBMITTED",
      }));
      setSubmissionDraftRevisions((current) => ({
        ...current,
        [quizFragenId]: submitted.draftRevision,
      }));
      setLocallyEditedSinceSubmission((current) => ({
        ...current,
        [quizFragenId]: false,
      }));
      setCurrentSubmissionStatus("SUBMITTED");
      setMeldung("Antwort abgegeben.");
    } catch {
      setMeldung("Die Antwort konnte nicht verbindlich abgegeben werden.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePixelStop(quizFragenId: number) {
    const draft = antworten[quizFragenId];
    const run = liveDaten.interactionRun;
    if (!session || !draft || !run || !speicherBlockId) {
      setMeldung("Bitte zuerst eine Antwort eintragen.");
      return;
    }
    setIsSubmitting(true);
    setMeldung("");
    try {
      const saved = await saveTeamAntwortDraft({
        quizId: liveDaten.quiz_id,
        quizAbschnittId: speicherBlockId,
        quizFragenId,
        quizTeamSessionToken: session.sessionToken,
        interactionRunId: run.id,
        expectedDraftRevision: draftRevisions[quizFragenId] ?? 0,
        antwortText: draft.antwortText,
        antwortId: draft.antwortId,
        antwortIds: draft.antwortIds,
        antwortfelder: Object.entries(draft.antwortfelder).map(
          ([antwortfeldId, antwortText]) => ({
            antwortfeldId: Number(antwortfeldId),
            antwortText,
          }),
        ),
      });
      if (!saved.success) {
        setMeldung("Die Antwort konnte vor dem Stoppen nicht gespeichert werden.");
        return;
      }
      setDraftRevisions((current) => ({
        ...current,
        [quizFragenId]: saved.draftRevision,
      }));
      const stopped = await stopPixelbildAntwort({
        quizId: liveDaten.quiz_id,
        quizFragenId,
        interactionRunId: run.id,
        quizTeamSessionToken: session.sessionToken,
      });
      if (!stopped.success) {
        setMeldung(
          stopped.reason === "ALREADY_STOPPED"
            ? "Ein anderes Team war beim Stoppen schneller."
            : stopped.reason === "STOP_NOT_AVAILABLE"
              ? "In dieser Stufe kann nicht mehr gestoppt werden."
              : "Stoppen ist für den aktuellen Stand nicht möglich.",
        );
        return;
      }
      setSubmissionStatuses((current) => ({
        ...current,
        [quizFragenId]: "SUBMITTED",
      }));
      setCurrentSubmissionStatus("SUBMITTED");
      const snapshot = await getQuizLiveSnapshot(
        liveDaten.quiz_id,
        session.sessionToken,
      );
      setPixelState(snapshot.pixelState);
      if (snapshot.teamSpecificState) {
        setPixelTeamState({
          isStopper: snapshot.teamSpecificState.isStopper,
          canStop: snapshot.teamSpecificState.canStop,
          canEdit: snapshot.teamSpecificState.canEdit,
          canSubmit: snapshot.teamSpecificState.canSubmit,
        });
      }
      setMeldung(`In Stufe ${stopped.stage} gestoppt. Eure Antwort ist verbindlich abgegeben.`);
    } catch {
      setMeldung("Die Pixelbild-Frage konnte nicht gestoppt werden.");
    } finally {
      setIsSubmitting(false);
    }
  }


  return (
    <QuizThemeScope
      as="main"
      theme={theme}
      className="answer-template min-h-dvh px-4 py-6 text-slate-900 sm:py-8"
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="answer-surface rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="break-words text-3xl font-bold">
            {liveDaten.titel ?? `Quiz ${liveDaten.quiz_id}`}
          </h1>

          <p className="mt-2 text-slate-600">Antwortformular für Teams</p>
        </section>

        {meldung && (
          <p role="alert" aria-live="assertive" className="answer-message rounded-xl border border-current bg-white p-4 font-semibold">
            {meldung}
          </p>
        )}

        <section className="answer-surface rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {!session ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Teamname
                </span>

                <input
                  type="text"
                  value={teamname}
                  onChange={(e) => setTeamname(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  placeholder="z. B. Quiztopher Columbus"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Anzahl Spieler
                </span>

                <input
                  type="number"
                  min={1}
                  value={spielerAnzahl}
                  onChange={(e) => setSpielerAnzahl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  placeholder="z. B. 4"
                />
              </label>

              {teamExistiert && (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Team-Passwort
                  </span>

                  <input
                    type="password"
                    value={teamPasswort}
                    onChange={(e) => setTeamPasswort(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    placeholder="Passwort eingeben"
                  />
                </label>
              )}

              <button
                type="button"
                onClick={handleStartSession}
                disabled={isLoadingTeams || isStartingSession || !teamname.trim()}
                className="answer-primary-button min-h-11 w-full rounded-xl bg-slate-900 px-5 py-4 text-lg font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isLoadingTeams
                  ? "Suche Team..."
                  : isStartingSession
                    ? "Verbinde..."
                    : "Team starten"}
              </button>
            </div>
          ) : (
            <div className="answer-success flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
              <div>
                <div className="text-sm font-bold text-emerald-700">
                  Team angemeldet
                </div>

                <div className="mt-1 text-xl font-black text-slate-900">
                  {session.teamname}
                </div>

                {session.teamPasswort && (
                  <div className="mt-2 text-sm text-slate-700">
                    Team-Passwort:{" "}
                    <span className="font-black text-slate-900">
                      {session.teamPasswort}
                    </span>
                  </div>
                )}

                {generiertesPasswort && (
                  <div className="mt-1 text-xs text-emerald-800">
                    Dieses Passwort wurde für das neue Team erzeugt.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleTeamWechseln}
                className="shrink-0 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800"
              >
                Team wechseln
              </button>
            </div>
          )}
        </section>

        <section className="answer-surface rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {(liveDaten.answerPhase === "QUESTION" ||
            (liveDaten.answerPhase === "LEGACY" &&
              aktuellerBlock &&
              !liveDaten.presentationStatusText)) ? (
            <>
              <div className="text-sm font-semibold uppercase tracking-wide text-green-600">
                {liveDaten.answerPhase === "QUESTION"
                  ? "Aktuelle Frage"
                  : "Aktuell freigegeben"}
              </div>

              <h2 className="mt-2 text-2xl font-bold">
                {aktuellerBlock?.titel ?? "Aktuelle Frage"}
              </h2>

              <p
                role="status"
                className="mt-3 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700"
              >
                {liveDaten.interactionState === "OPEN"
                  ? "Antwort offen"
                  : liveDaten.interactionState === "COUNTDOWN"
                    ? "Countdown l\u00e4uft"
                    : liveDaten.interactionState === "CLOSED"
                      ? "Antwortzeit beendet"
                      : "Gesperrt"}
              </p>

              <div className="mt-6 space-y-5">
                {liveDaten.fragen
                .filter((frage) => frage.istFreigegeben)
                .map((frage, frageIndex) => {
                  const bildMedien = frage.bildMedien ?? [];
                  const pixelMedium = frage.templateId === "pixelbild" && pixelState
                    ? bildMedien.find(
                        (medium) => medium.slotKey === pixelRuntimeStageToMediaSlot(
                          pixelState.effectivePixelStage,
                        ),
                      ) ?? null
                    : null;
                  const sichtbaresBild = pixelMedium ?? bildMedien[0] ?? null;
                  const hatBild = sichtbaresBild !== null;
                  const pixelCountdownRemaining = pixelState?.submissionDeadlineAt
                    ? Math.max(
                        0,
                        Math.ceil(
                          (new Date(pixelState.submissionDeadlineAt).getTime() - now) /
                            1_000,
                        ),
                      )
                    : null;
                  const submissionStatus =
                    submissionStatuses[frage.quiz_fragen_id];
                  const submissionPolicy = resolveInteractionSubmissionPolicy(
                    frage.interaction.type,
                  );
                  const submissionLocksEditing = Boolean(
                    submissionStatus &&
                      !submissionPolicy.resubmissionAllowedWhileOpen,
                  ) || Boolean(pixelState && pixelTeamState?.canEdit === false);
                  const changedSinceSubmission = Boolean(
                    submissionStatus === "SUBMITTED" &&
                      (locallyEditedSinceSubmission[frage.quiz_fragen_id] ||
                        isDraftChangedSinceSubmission(
                          draftRevisions[frage.quiz_fragen_id] ?? 0,
                          submissionDraftRevisions[
                            frage.quiz_fragen_id
                          ] ?? null,
                        )),
                  );

                  return (
                    <div
                      key={frage.quiz_fragen_id}
                      className="answer-question rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-3 text-sm font-semibold text-slate-500">
                        Frage {frageIndex + 1}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">
                        {frage.frage}
                      </h3>

                      {frage.templateId === "pixelbild" && pixelState && (
                        <div className="mt-4 space-y-3 rounded-2xl border-2 border-fuchsia-300 bg-fuchsia-50 p-4 text-slate-900">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong>Pixel-Stufe {pixelState.effectivePixelStage} von 3</strong>
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                              {4 - pixelState.effectivePixelStage} {4 - pixelState.effectivePixelStage === 1 ? "Punkt" : "Punkte"}
                            </span>
                          </div>
                          {pixelState.stopped ? (
                            pixelTeamState?.isStopper ? (
                              <p className="font-semibold text-fuchsia-900">
                                Ihr habt in Stufe {pixelState.stoppedAtStage} gestoppt. Eure Antwort ist abgegeben und gesperrt.
                              </p>
                            ) : (
                              <p className="font-semibold text-fuchsia-900">
                                {pixelState.stoppedByTeamName ?? "Ein anderes Team"} hat gestoppt. Ihr könnt bis zum Ende des 20-Sekunden-Countdowns weiter bearbeiten und absenden.
                                {pixelCountdownRemaining !== null && ` Noch ${pixelCountdownRemaining} Sekunden.`}
                              </p>
                            )
                          ) : pixelState.effectivePixelStage < 3 ? (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => void handlePixelStop(frage.quiz_fragen_id)}
                                disabled={isSubmitting || !session}
                                className="min-h-11 w-full rounded-xl bg-fuchsia-700 px-5 py-3 font-black text-white hover:bg-fuchsia-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                              >
                                {isSubmitting ? "Stop wird geprüft..." : "Stop – Antwort jetzt verbindlich abgeben"}
                              </button>
                              <p className="text-sm font-semibold text-fuchsia-900">
                                Falscher Stop: -1 Punkt. Als einziges richtiges Team sind bis zu {pixelState.effectivePixelStage === 1 ? 6 : 4} Punkte möglich.
                              </p>
                            </div>
                          ) : (
                            <p className="font-semibold text-slate-700">
                              Letzte Stufe: normal antworten und verbindlich absenden. Stoppen ist nicht mehr möglich.
                            </p>
                          )}
                        </div>
                      )}

                      {frage.punkte_modus !== "standard" && (
                        <div className="answer-warning mt-3 rounded-xl bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-900">
                          {frage.punkte_modus === "expertenbonus"
                            ? "Expertenbonus: Wenn nur ein Team diese Frage richtig beantwortet, gibt es doppelte Punkte."
                            : "Risikofrage: Je weniger Teams richtig liegen, desto mehr Punkte gibt es für eine richtige Antwort."}
                        </div>
                      )}

                      {hatBild && frage.templateId === "pixelbild" && (
                        <button
                          type="button"
                          onClick={() => setBildModalUrl(getBildUrl(sichtbaresBild!.datei))}
                          className="mt-4 block w-full overflow-hidden rounded-2xl border-2 border-slate-300 bg-slate-950"
                          aria-label="Pixelbild vergrößern"
                        >
                          <img
                            src={getBildUrl(sichtbaresBild!.datei)}
                            alt={`Pixelbild in Stufe ${pixelState?.effectivePixelStage ?? 1}`}
                            className="aspect-video w-full object-contain"
                          />
                        </button>
                      )}

                      {hatBild && frage.templateId !== "pixelbild" && (
                        <button
                          type="button"
                          onClick={() =>
                            setBildModalUrl(
                              getBildUrl(sichtbaresBild!.datei)
                            )
                          }
                          className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
                        >
                          Bild anzeigen
                        </button>
                      )}

                      <GenericAnswerRenderer
                        questionAssignmentId={frage.quiz_fragen_id}
                        interaction={frage.interaction}
                        value={antworten[frage.quiz_fragen_id]}
                        disabled={
                          blockIstGesperrt || submissionLocksEditing || !session
                        }
                        onChange={(value) => {
                          setAntworten((current) => ({
                            ...current,
                            [frage.quiz_fragen_id]: value,
                          }));
                          if (submissionStatus === "SUBMITTED") {
                            setLocallyEditedSinceSubmission((current) => ({
                              ...current,
                              [frage.quiz_fragen_id]: true,
                            }));
                          }
                        }}
                      />

                      <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                        {submissionStatus ? (
                          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
                            {submissionStatus === "SUBMITTED"
                              ? changedSinceSubmission
                                ? "Ge\u00e4ndert seit letzter Abgabe"
                                : "Antwort abgegeben"
                              : "Beim Schlie\u00dfen automatisch \u00fcbernommen"}
                          </p>
                        ) : (draftRevisions[frage.quiz_fragen_id] ?? 0) > 0 ? (
                          <p className="text-sm font-semibold text-slate-600">
                            Entwurf automatisch gespeichert
                          </p>
                        ) : null}
                        {session &&
                          !blockIstGesperrt &&
                          !submissionLocksEditing &&
                          (!pixelState || pixelTeamState?.canSubmit !== false) && (
                          <button
                            type="button"
                            onClick={() => void handleSubmit(frage.quiz_fragen_id)}
                            disabled={
                              isSubmitting ||
                              (submissionStatus === "SUBMITTED" &&
                                !changedSinceSubmission)
                            }
                            className="answer-primary-button min-h-11 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                          >
                            {isSubmitting
                              ? "Wird verbindlich abgegeben..."
                              : submissionStatus === "SUBMITTED"
                                ? "Erneut absenden"
                                : "Verbindlich absenden"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {liveDaten.presentationStatusText ? "Aktueller Quizstatus" : "Noch kein Block freigegeben"}
              </div>

              <p className="mt-2 text-lg font-semibold text-slate-700">
                {liveDaten.presentationStatusText ?? "Bitte warte, bis der Moderator die nächste Fragenrunde freigibt."}
              </p>

              {currentSubmissionStatus && (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
                  {currentSubmissionStatus === "SUBMITTED"
                    ? "Antwort abgegeben"
                    : "Beim Schließen automatisch übernommen"}
                </p>
              )}
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

            {/* Arbitrary repository and managed-Blob media must remain directly renderable. */}
            <img
              src={bildModalUrl}
              alt="Bild zur Frage"
              className="max-h-[75vh] max-w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </QuizThemeScope>
  );
}
