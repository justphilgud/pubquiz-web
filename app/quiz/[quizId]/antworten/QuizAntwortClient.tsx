"use client";

/* eslint-disable @next/next/no-img-element -- Pixel stages use dynamic question-media URLs. */

import { useEffect, useRef, useState } from "react";
import {
  searchTeamsForAntworten,
  saveTeamAntwortDraft,
  startQuizTeamSession,
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
type QuizLiveSnapshot = Awaited<
  ReturnType<typeof import("../../actions").getQuizLiveSnapshot>
>;

class InvalidTeamSessionError extends Error {}

async function fetchQuizLiveSnapshot(
  quizId: number,
  quizTeamSessionToken?: string,
  knownLiveRevision?: string,
  knownActiveQuizFragenId?: number | null,
) {
  const response = await fetch("/api/quiz/team-live-snapshot", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quizId,
      quizTeamSessionToken,
      knownLiveRevision,
      knownActiveQuizFragenId,
    }),
  });
  if (response.status === 401) throw new InvalidTeamSessionError();
  if (!response.ok) throw new Error("Live-Status konnte nicht geladen werden.");
  return await response.json() as QuizLiveSnapshot & {
    answerStatus?: AntwortStatus | null;
  };
}

async function fetchQuizAnswerStatus(
  quizId: number,
  quizTeamSessionToken?: string,
) {
  const response = await fetch("/api/quiz/team-live-snapshot", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quizId,
      quizTeamSessionToken,
      includeAnswerStatus: true,
    }),
  });
  if (response.status === 401) throw new InvalidTeamSessionError();
  if (!response.ok) throw new Error("Antwortstatus konnte nicht geladen werden.");
  return await response.json() as AntwortStatus | null;
}

type AntwortStatus = {
  quiz_id: number;
  titel: string | null;
  liveRevision: string;
  activeQuizFragenId: number | null;

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
    interactionRun: {
      id: number;
      type: string;
      state: "LOCKED" | "OPEN" | "COUNTDOWN" | "CLOSED" | "REVEALED";
      deadlineAt: string | null;
      revision: number;
    } | null;
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
  const draftRevisionsRef = useRef(draftRevisions);
  const [submissionStatuses, setSubmissionStatuses] = useState<
    Record<number, "SUBMITTED" | "AUTO_FINALIZED" | undefined>
  >({});
  const [submissionDraftRevisions, setSubmissionDraftRevisions] = useState<
    Record<number, number | undefined>
  >({});
  const [locallyEditedSinceSubmission, setLocallyEditedSinceSubmission] =
    useState<Record<number, boolean | undefined>>({});
  const [draftEditVersions, setDraftEditVersions] = useState<
    Record<number, number | undefined>
  >({});
  const draftEditVersionsRef = useRef(draftEditVersions);
  const hydratedSessionTokenRef = useRef<string | null>(null);
  const questionRunIdsRef = useRef<Record<number, number | null>>({});
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

  useEffect(() => {
    draftRevisionsRef.current = draftRevisions;
  }, [draftRevisions]);

  useEffect(() => {
    draftEditVersionsRef.current = draftEditVersions;
  }, [draftEditVersions]);

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
    if (!session) return;

    let active = true;
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const snapshot = await fetchQuizLiveSnapshot(
          liveDaten.quiz_id,
          session?.sessionToken,
          liveDaten.liveRevision,
          liveDaten.activeQuizFragenId,
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
        const nextQuestionId =
          snapshot.activeQuestionReference?.quizFragenId ?? null;
        const needsFullRefresh =
          liveDaten.liveRevision !== snapshot.liveRevision ||
          liveDaten.activeQuizFragenId !== nextQuestionId ||
          (session?.sessionToken !== undefined &&
            hydratedSessionTokenRef.current !== session.sessionToken);
        if (needsFullRefresh) {
          const aktuelleDaten = snapshot.answerStatus ??
            await fetchQuizAnswerStatus(
              liveDaten.quiz_id,
              session?.sessionToken,
            );
          if (active && aktuelleDaten) {
            const nextLiveData = aktuelleDaten as AntwortStatus;
            hydratedSessionTokenRef.current = session?.sessionToken ?? null;
            setLiveDaten(nextLiveData);
          }
          return;
        }
        const teamState = snapshot.teamSpecificState;
        const question = liveDaten.fragen.find(
          (entry) => entry.quiz_fragen_id === nextQuestionId,
        );
        if (
          question &&
          teamState?.draft &&
          teamState.draft.revision >
            (draftRevisionsRef.current[question.quiz_fragen_id] ?? 0)
        ) {
          const serverDraft = interactionPayloadToDraft(
            question.interaction,
            teamState.draft.payload as QuizInteractionPayload,
          );
          if (
            (draftEditVersionsRef.current[question.quiz_fragen_id] ?? 0) === 0
          ) {
            setAntworten((current) => ({
              ...current,
              [question.quiz_fragen_id]: serverDraft,
            }));
          }
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
      } catch (error) {
        if (error instanceof InvalidTeamSessionError && active) {
          localStorage.removeItem(`quiz-session-${liveDaten.quiz_id}`);
          hydratedSessionTokenRef.current = null;
          setSession(null);
          setLiveDaten(daten);
          setPixelState(null);
          setPixelTeamState(null);
          setCurrentSubmissionStatus(null);
          setMeldung("Die Team-Sitzung ist nicht mehr g\u00fcltig. Bitte erneut anmelden.");
        }
        // A transient polling failure is retried by the next interval.
      } finally {
        refreshing = false;
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [
    liveDaten.activeQuizFragenId,
    liveDaten.fragen,
    liveDaten.liveRevision,
    liveDaten.quiz_id,
    session,
    session?.sessionToken,
    daten,
  ]);

  useEffect(() => {
    if (
      !session ||
      !speicherBlockId ||
      blockIstGesperrt ||
      isSubmitting
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
              const question = liveDaten.fragen.find(
                (entry) => entry.quiz_fragen_id === id,
              );
              return (
                visibleQuestionIds.has(id) &&
                (draftEditVersions[id] ?? 0) > 0 &&
                Boolean(
                  question?.interactionRun &&
                  ["OPEN", "COUNTDOWN"].includes(question.interactionRun.state),
                )
              );
            })
            .map(async ([quizFragenId, antwort]) => {
              const questionId = Number(quizFragenId);
              const question = liveDaten.fragen.find(
                (entry) => entry.quiz_fragen_id === questionId,
              )!;
              const editVersion = draftEditVersions[questionId] ?? 0;
              const result = await saveTeamAntwortDraft({
                quizId: liveDaten.quiz_id,
                quizAbschnittId: speicherBlockId,
                quizFragenId: questionId,
                quizTeamSessionToken: session.sessionToken,
                interactionRunId: question.interactionRun!.id,
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
              return { questionId, editVersion, result };
            }),
        );
        for (const { questionId, editVersion, result } of results) {
          if (result.success) {
            setDraftRevisions((current) => ({
              ...current,
              [questionId]: result.draftRevision,
            }));
            setDraftEditVersions((current) => ({
              ...current,
              [questionId]: current[questionId] === editVersion
                ? 0
                : current[questionId],
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
          const snapshot = await fetchQuizLiveSnapshot(
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
          const aktuelleDaten = await fetchQuizAnswerStatus(
            liveDaten.quiz_id,
            session.sessionToken,
          );
          if (aktuelleDaten) setLiveDaten(aktuelleDaten as AntwortStatus);
          setMeldung(
            "Die Frage hat inzwischen gewechselt. Der aktuelle Stand wurde neu geladen.",
          );
        }
      } catch {
        const aktuelleDaten = await fetchQuizAnswerStatus(
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
    blockIstGesperrt,
    draftRevisions,
    draftEditVersions,
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
    const changedRunQuestionIds = new Set<number>();

    liveDaten.fragen.forEach((frage) => {
      const nextRunId = frage.interactionRun?.id ?? null;
      const previousRunId = questionRunIdsRef.current[frage.quiz_fragen_id];
      if (previousRunId !== undefined && previousRunId !== nextRunId) {
        changedRunQuestionIds.add(frage.quiz_fragen_id);
      }
      questionRunIdsRef.current[frage.quiz_fragen_id] = nextRunId;
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
    setAntworten((current) => {
      const next = { ...current };
      for (const questionId of changedRunQuestionIds) {
        delete next[questionId];
      }
      for (const [questionId, answer] of Object.entries(geladeneAntworten)) {
        if ((draftEditVersionsRef.current[Number(questionId)] ?? 0) === 0) {
          next[Number(questionId)] = answer;
        }
      }
      return next;
    });
    setDraftRevisions((current) => {
      const next = { ...current };
      for (const frage of liveDaten.fragen) {
        if (!(frage.quiz_fragen_id in geladeneRevisionen)) {
          delete next[frage.quiz_fragen_id];
        }
      }
      return { ...next, ...geladeneRevisionen };
    });
    setSubmissionStatuses((current) => {
      const next = { ...current };
      for (const frage of liveDaten.fragen) {
        if (!(frage.quiz_fragen_id in geladeneStatus)) {
          delete next[frage.quiz_fragen_id];
        }
      }
      return { ...next, ...geladeneStatus };
    });
    setSubmissionDraftRevisions((current) => {
      const next = { ...current };
      for (const frage of liveDaten.fragen) {
        if (!(frage.quiz_fragen_id in geladeneSubmissionRevisionen)) {
          delete next[frage.quiz_fragen_id];
        }
      }
      return { ...next, ...geladeneSubmissionRevisionen };
    });
    setLocallyEditedSinceSubmission((current) => {
      const next = { ...current };
      for (const frage of liveDaten.fragen) {
        if (!(frage.quiz_fragen_id in geaenderteEntwuerfe)) {
          delete next[frage.quiz_fragen_id];
        }
      }
      return { ...next, ...geaenderteEntwuerfe };
    });
    setDraftEditVersions((current) => {
      const next = { ...current };
      for (const questionId of changedRunQuestionIds) delete next[questionId];
      return next;
    });
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
    setDraftEditVersions({});
    setCurrentSubmissionStatus(null);

    localStorage.setItem(
      `quiz-session-${liveDaten.quiz_id}`,
      JSON.stringify(result.session)
    );

    const aktuelleDaten = await fetchQuizAnswerStatus(
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
    setDraftEditVersions({});
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
          const snapshot = await fetchQuizLiveSnapshot(
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
      const snapshot = await fetchQuizLiveSnapshot(
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

        {session && (
        <section className="answer-surface rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {!blockIstGesperrt && (liveDaten.answerPhase === "QUESTION" ||
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
                {liveDaten.fragen.length === 0 && (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-5 font-semibold text-slate-700">
                    Der Fragenblock ist geöffnet. Die erste Frage folgt gleich.
                  </p>
                )}
                {liveDaten.fragen
                .filter((frage) => frage.istFreigegeben)
                .map((frage, frageIndex) => {
                  const frageIstAktivePixelFrage =
                    frage.templateId === "pixelbild" &&
                    liveDaten.activeQuizFragenId === frage.quiz_fragen_id;
                  const questionPixelState = frageIstAktivePixelFrage
                    ? pixelState
                    : null;
                  const questionPixelTeamState = frageIstAktivePixelFrage
                    ? pixelTeamState
                    : null;
                  const bildMedien = frage.bildMedien ?? [];
                  const pixelMedium = frage.templateId === "pixelbild" && questionPixelState
                    ? bildMedien.find(
                        (medium) => medium.slotKey === (
                          questionPixelState.state === "REVEALED"
                            ? "pixel_original_image"
                            : pixelRuntimeStageToMediaSlot(
                                questionPixelState.effectivePixelStage,
                              )
                        ),
                      ) ?? null
                    : null;
                  const sichtbaresBild = pixelMedium ?? bildMedien[0] ?? null;
                  const hatBild = sichtbaresBild !== null;
                  const pixelCountdownRemaining = questionPixelState?.submissionDeadlineAt
                    ? Math.max(
                        0,
                        Math.ceil(
                          (new Date(questionPixelState.submissionDeadlineAt).getTime() - now) /
                            1_000,
                        ),
                      )
                    : null;
                  const submissionStatus =
                    submissionStatuses[frage.quiz_fragen_id];
                  const submissionPolicy = resolveInteractionSubmissionPolicy(
                    frage.interaction.type,
                  );
                  const questionIsWritable = Boolean(
                    frage.interactionRun &&
                    ["OPEN", "COUNTDOWN"].includes(frage.interactionRun.state),
                  );
                  const submissionLocksEditing = Boolean(
                    submissionStatus &&
                      !submissionPolicy.resubmissionAllowedWhileOpen,
                  ) || Boolean(
                    questionPixelState && questionPixelTeamState?.canEdit === false,
                  );
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

                      {frage.templateId === "pixelbild" && questionPixelState && (
                        <div className="mt-4 space-y-3 rounded-2xl border-2 border-fuchsia-300 bg-fuchsia-50 p-4 text-slate-900">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong>
                              {questionPixelState.state === "REVEALED"
                                ? "Auflösung"
                                : `Pixel-Stufe ${questionPixelState.effectivePixelStage} von 3`}
                            </strong>
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                              {4 - questionPixelState.effectivePixelStage} {4 - questionPixelState.effectivePixelStage === 1 ? "Punkt" : "Punkte"}
                            </span>
                          </div>
                          {questionPixelState.stopped ? (
                            questionPixelTeamState?.isStopper ? (
                              <p className="font-semibold text-fuchsia-900">
                                Ihr habt in Stufe {questionPixelState.stoppedAtStage} gestoppt. Eure Antwort ist abgegeben und gesperrt.
                              </p>
                            ) : (
                              <p className="font-semibold text-fuchsia-900">
                                {questionPixelState.stoppedByTeamName ?? "Ein anderes Team"} hat gestoppt. Ihr könnt bis zum Ende des 20-Sekunden-Countdowns weiter bearbeiten und absenden.
                                {pixelCountdownRemaining !== null && ` Noch ${pixelCountdownRemaining} Sekunden.`}
                              </p>
                            )
                          ) : questionPixelState.effectivePixelStage < 3 ? (
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
                                Falscher Stop: -1 Punkt. Als einziges richtiges Team sind bis zu {questionPixelState.effectivePixelStage === 1 ? 6 : 4} Punkte möglich.
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
                            alt={`Pixelbild in Stufe ${questionPixelState?.effectivePixelStage ?? 1}`}
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
                          blockIstGesperrt ||
                          !questionIsWritable ||
                          submissionLocksEditing ||
                          !session
                        }
                        onChange={(value) => {
                          setAntworten((current) => ({
                            ...current,
                            [frage.quiz_fragen_id]: value,
                          }));
                          setDraftEditVersions((current) => ({
                            ...current,
                            [frage.quiz_fragen_id]:
                              (current[frage.quiz_fragen_id] ?? 0) + 1,
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
                            Entwurf automatisch gespeichert – beim Schließen des Blocks wird der aktuelle Stand übernommen.
                          </p>
                        ) : null}
                        {frage.templateId === "pixelbild" &&
                          frageIstAktivePixelFrage &&
                          session &&
                          !blockIstGesperrt &&
                          questionIsWritable &&
                          !submissionLocksEditing &&
                          (!questionPixelState || questionPixelTeamState?.canSubmit !== false) && (
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
        )}
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
