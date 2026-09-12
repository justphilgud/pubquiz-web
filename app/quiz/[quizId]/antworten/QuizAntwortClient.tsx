"use client";
import { QUIZ_LIFECYCLE_LABELS, type QuizLifecycle } from "../../quizLifecycle";

/* eslint-disable @next/next/no-img-element -- Pixel stages use dynamic question-media URLs. */

import { useEffect, useRef, useState } from "react";
import {
  searchTeamsForAntworten,
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
  isPixelStageOpenEnded,
  PIXEL_OPEN_STAGE_LABEL,
  pixelRuntimeStageToMediaSlot,
  resolvePixelAnswerActionPolicy,
  type PixelLiveState,
} from "@/app/quiz/interaction/pixelLiveInteraction";
import { TeamProfileEditor } from "@/app/teams/TeamProfileEditor";
import type { TeamProfile } from "@/app/teams/teamProfile";
import { submitLivePollResponse } from "@/app/umfragen/actions";
import { getLivePollPollingDelay } from "@/app/umfragen/livePollRuntime";

import { useAnswerDrafts } from "../../interaction/useAnswerDrafts";
import { EMPTY_TEAM_DRAFT } from "../../interaction/answerDraftController";
import { participantRequest, ParticipantRequestError, boundedParticipantAction } from "../../interaction/participantRequest";
import AnswerSaveStatus from "./AnswerSaveStatus";
import type { saveTeamAntwortDraft, startQuizTeamSession } from "../../actions";
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
  try {
    return await participantRequest<QuizLiveSnapshot & { answerStatus?: AntwortStatus | null }>("/api/quiz/team-live-snapshot", {
      quizId, quizTeamSessionToken, knownLiveRevision, knownActiveQuizFragenId,
    });
  } catch (error) {
    if (error instanceof ParticipantRequestError && error.status === 401) throw new InvalidTeamSessionError();
    throw error;
  }
}

async function fetchQuizAnswerStatus(
  quizId: number,
  quizTeamSessionToken?: string,
) {
  try {
    return await participantRequest<AntwortStatus | null>("/api/quiz/team-live-snapshot", {
      quizId, quizTeamSessionToken, includeAnswerStatus: true,
    });
  } catch (error) {
    if (error instanceof ParticipantRequestError && error.status === 401) throw new InvalidTeamSessionError();
    throw error;
  }
}

type AntwortStatus = {
  lifecycle: QuizLifecycle;
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
  answerPhase: "QUESTION" | "FUNNY" | "SOLUTION" | "NON_QUESTION" | "LEGACY" | "UNKNOWN";
  presentationStatusText: string | null;
  teamProfile: TeamProfile | null;
  answerConfirmations?: NonNullable<Awaited<ReturnType<typeof import("../../actions").getQuizAntwortStatus>>>["answerConfirmations"];

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

export default function QuizAntwortClient({
  daten,
  theme,
  calendarSubscriptionUrl,
  teamPhotoUploadEnvironment,
}: {
  daten: AntwortStatus;
  theme: ResolvedQuizTheme;
  calendarSubscriptionUrl: string;
  teamPhotoUploadEnvironment: "dev" | "preview" | "prod";
}) {
  const [teamname, setTeamname] = useState("");
  const [spielerAnzahl, setSpielerAnzahl] = useState("1");
  const [session, setSession] = useState<TeamSession | null>(null);
  const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(daten.teamProfile);
  const [teamProfileInitiallyOpen, setTeamProfileInitiallyOpen] = useState(false);
  const [teamVorschlaege, setTeamVorschlaege] = useState<
    { team_id: number; teamname: string }[]
  >([]);

  const [liveDaten, setLiveDaten] = useState(daten);
  const [teamPasswort, setTeamPasswort] = useState("");
  const [generiertesPasswort, setGeneriertesPasswort] = useState<string | null>(
    null
  );

  const [submissionStatuses, setSubmissionStatuses] = useState<
    Record<number, "SUBMITTED" | "AUTO_FINALIZED" | undefined>
  >({});
  const [submissionDraftRevisions, setSubmissionDraftRevisions] = useState<
    Record<number, number | undefined>
  >({});
  const [locallyEditedSinceSubmission, setLocallyEditedSinceSubmission] =
    useState<Record<number, boolean | undefined>>({});
  const hydratedSessionTokenRef = useRef<string | null>(null);
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
  const [livePollState, setLivePollState] = useState<QuizLiveSnapshot["livePollState"]>(null);
  const livePollStateRef = useRef<QuizLiveSnapshot["livePollState"]>(null);
  const [livePollResponse, setLivePollResponse] = useState<{ selectedOptionId: string | null; text: string | null } | null>(null);
  const [livePollText, setLivePollText] = useState("");

  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [bildModalUrl, setBildModalUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pixelClockOffset = useRef(0);

  const aktuellerBlock = liveDaten.aktuellerBlock;
  const blockIstGesperrt = liveDaten.blockIstGesperrt;

  const speicherBlockId =
    liveDaten.offenerBlock?.quiz_abschnitt_id ??
    liveDaten.aktuellerBlock?.quiz_abschnitt_id ??
    null;
  const teamExistiert = teamVorschlaege.some(
    (team) => team.teamname.toLowerCase() === teamname.trim().toLowerCase()
  );

  const { controller, entries, storageError } = useAnswerDrafts(
    session ? `${liveDaten.quiz_id}:${session.quiz_team_session_id}` : null,
    async (questionId, runId, revision, draft) => {
      const question = liveDaten.fragen.find(q => q.quiz_fragen_id === questionId);
      if (!session || !question || !speicherBlockId) return { success: false, reason: "LIVE_STATE_CHANGED" };
      const result = await participantRequest<Awaited<ReturnType<typeof saveTeamAntwortDraft>>>("/api/quiz/team-answer-draft", {
        quizId: liveDaten.quiz_id, quizAbschnittId: speicherBlockId, quizFragenId: questionId,
        quizTeamSessionToken: session.sessionToken, interactionRunId: runId, expectedDraftRevision: revision,
        antwortText: draft.antwortText, antwortId: draft.antwortId, antwortIds: draft.antwortIds,
        antwortfelder: Object.entries(draft.antwortfelder).map(([id, text]) => ({ antwortfeldId: Number(id), antwortText: text })),
      });
      if (!result.success) return result;
      return { ...result, confirmedValue: {
        antwortText: result.confirmedDraft.answerText,
        antwortId: result.confirmedDraft.selectedAnswerIds[0] ?? null,
        antwortIds: [...result.confirmedDraft.selectedAnswerIds],
        antwortfelder: Object.fromEntries(result.confirmedDraft.structuredAnswers.map(field => [field.fieldId, field.answerText ?? ""])),
      } };
    },
  );
  const antworten = Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, entry.value]));
  const draftRevisions = Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, entry.baseRevision]));

  useEffect(() => {
    if (!liveDaten.teamProfile) return;
    const timeout = window.setTimeout(() => setTeamProfile(liveDaten.teamProfile), 0);
    return () => window.clearTimeout(timeout);
  }, [liveDaten.teamProfile]);

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
    try {
      const gespeicherteSession = localStorage.getItem(`quiz-session-${liveDaten.quiz_id}`);
      if (!gespeicherteSession) {
        const raw = localStorage.getItem(`quiz-join-attempt-${liveDaten.quiz_id}`);
        if (raw) {
          const prior = JSON.parse(raw);
          // Synchronize the persisted join attempt from external browser storage.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          if (typeof prior.name === "string") setTeamname(prior.name);
        }
        return;
      }
      const parsedSession = JSON.parse(gespeicherteSession) as TeamSession;
      if (!parsedSession.sessionToken) {
        localStorage.removeItem(`quiz-session-${liveDaten.quiz_id}`);
        return;
      }
      // Restore the external localStorage session into the client state.
      setSession(parsedSession);
      setTeamname(parsedSession.teamname);
    } catch {
      setMeldung("Der Browserspeicher ist nicht verfügbar oder enthält ungültige Daten. Bitte den Teambeitritt erneut versuchen.");
    }
  }, [liveDaten.quiz_id]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(async () => {
      const suchtext = teamname.trim();

      if (session || suchtext.length < 2) {
        setTeamVorschlaege([]);
        return;
      }

      setIsLoadingTeams(true);
      try {
        const result = await boundedParticipantAction(searchTeamsForAntworten(suchtext));
        if (active) setTeamVorschlaege(result);
      } catch { if (active) setTeamVorschlaege([]); }
      finally { if (active) setIsLoadingTeams(false); }
    }, 250);

    return () => { active = false; window.clearTimeout(timeout); };
  }, [teamname, session]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now() + pixelClockOffset.current), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!session) return;

    let active = true;
    let refreshing = false;
    let pollTimeout: number | null = null;
    let consecutiveFailures = 0;
    function schedule() {
      if (!active) return;
      const delay = livePollStateRef.current
        ? getLivePollPollingDelay({ hidden: document.hidden, consecutiveFailures })
        : Math.min(8000, 500 * 2 ** Math.min(consecutiveFailures, 4));
      pollTimeout = window.setTimeout(() => void refresh(), delay);
    }
    async function refresh() {
      if (refreshing) return schedule();
      refreshing = true;
      try {
        const snapshot = await fetchQuizLiveSnapshot(
          liveDaten.quiz_id,
          session?.sessionToken,
          liveDaten.liveRevision,
          liveDaten.activeQuizFragenId,
        );
        if (!active) return;
        consecutiveFailures = 0;
        livePollStateRef.current = snapshot.livePollState;
        setLivePollState(snapshot.livePollState);
        if (snapshot.teamSpecificState?.livePollResponse) {
          const response = snapshot.teamSpecificState.livePollResponse;
          setLivePollResponse({ selectedOptionId: response.selectedOptionId, text: response.text });
          setLivePollText((current) => current || response.text || "");
        }
        setPixelState(snapshot.pixelState);
        pixelClockOffset.current = new Date(snapshot.serverNow).getTime() - Date.now();
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
        if (question?.interactionRun && teamState?.draft) {
          controller.hydrate(question.quiz_fragen_id, question.interactionRun.id,
            interactionPayloadToDraft(question.interaction, teamState.draft.payload as QuizInteractionPayload),
            teamState.draft.revision, teamState.canEdit);
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
        consecutiveFailures += 1;
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
        schedule();
      }
    }
    void refresh();
    return () => {
      active = false;
      if (pollTimeout !== null) window.clearTimeout(pollTimeout);
    };
  }, [
    liveDaten.activeQuizFragenId,
    liveDaten.fragen,
    liveDaten.liveRevision,
    liveDaten.quiz_id,
    session,
    session?.sessionToken,
    daten,
    controller,
  ]);

  function saveLivePoll(input: { selectedOptionId?: string; text?: string }) {
    if (!session || !livePollState || livePollState.state !== "OPEN") return;
    setIsSubmitting(true);
    setMeldung("");
    void boundedParticipantAction(submitLivePollResponse({ quizId: liveDaten.quiz_id, quizTeamSessionToken: session.sessionToken, ...input })).then((result) => {
      setMeldung(result.message);
      if (result.success) {
        setLivePollResponse({ selectedOptionId: input.selectedOptionId ?? null, text: input.text?.trim() ?? null });
      }
    }).catch(() => setMeldung("Die Umfrageantwort konnte nicht gespeichert werden.")).finally(() => setIsSubmitting(false));
  }

  useEffect(() => {
    if (!session || hydratedSessionTokenRef.current !== session.sessionToken) return;
    const visible = new Set<number>();
    const statuses: Record<number, "SUBMITTED" | "AUTO_FINALIZED"> = {};
    const submittedRevisions: Record<number, number> = {};
    for (const question of liveDaten.fragen) {
      if (!question.interactionRun) continue;
      visible.add(question.quiz_fragen_id);
      const saved = question.gespeicherteAntwort;
      const value: TeamAnswerDraft = saved ? {
        antwortText: saved.antwortText, antwortId: saved.antwortId, antwortIds: saved.antwortIds,
        antwortfelder: Object.fromEntries((saved.antwortfelder ?? []).map(f => [f.antwortfeldId, f.antwortText ?? ""])),
      } : EMPTY_TEAM_DRAFT;
      controller.hydrate(question.quiz_fragen_id, question.interactionRun.id, value, saved?.draftRevision ?? 0,
        !liveDaten.blockIstGesperrt && question.istFreigegeben && ["OPEN", "COUNTDOWN"].includes(question.interactionRun.state));
      if (saved?.submissionStatus) statuses[question.quiz_fragen_id] = saved.submissionStatus;
      if (saved?.submissionDraftRevision != null) submittedRevisions[question.quiz_fragen_id] = saved.submissionDraftRevision;
    }
    controller.reconcileMissing(visible, liveDaten.answerConfirmations ?? []);
    setSubmissionStatuses(statuses);
    setSubmissionDraftRevisions(submittedRevisions);
  }, [controller, liveDaten.fragen, liveDaten.answerConfirmations, liveDaten.blockIstGesperrt, session]);

  async function handleStartSession() {
    const name = teamname.trim();
    if (!name) { setMeldung("Bitte einen Teamnamen eingeben."); return; }
    setIsStartingSession(true);
    setMeldung("");
    try {
      const key = `quiz-join-attempt-${liveDaten.quiz_id}`;
      const raw = localStorage.getItem(key);
      const prior = raw ? JSON.parse(raw) : null;
      const joinRequestId = prior?.name === name && typeof prior.id === "string"
        ? prior.id : crypto.randomUUID();
      // Protect the proof BEFORE sending so a reload can retry a lost response.
      localStorage.setItem(key, JSON.stringify({ name, id: joinRequestId }));
      const result = await participantRequest<Awaited<ReturnType<typeof startQuizTeamSession>>>("/api/quiz/team-session", {
        quizId: liveDaten.quiz_id, teamname: name, passwort: teamPasswort.trim() || undefined,
        spielerAnzahl: Math.max(1, Number(spielerAnzahl) || 1), joinRequestId,
      });
      if (!result.success) { setMeldung(result.message ?? "Team konnte nicht gestartet werden."); return; }
      localStorage.setItem(`quiz-session-${liveDaten.quiz_id}`, JSON.stringify(result.session));
      localStorage.removeItem(key);
      setSession(result.session);
      setTeamProfile(result.profile);
      setTeamProfileInitiallyOpen(result.profileOnboarding);
      setTeamname(result.session.teamname);
      setGeneriertesPasswort(result.generiertesPasswort ?? null);
      setTeamVorschlaege([]);
      setSubmissionStatuses({});
      setSubmissionDraftRevisions({});
      setLocallyEditedSinceSubmission({});
      setCurrentSubmissionStatus(null);
      // The polling loop hydrates the authenticated session, retrying after network loss.
    } catch {
      setMeldung("Teambeitritt nicht bestätigt. Bitte Verbindung prüfen und mit demselben Teamnamen erneut versuchen. Auch nach Neuladen ist der Versuch wiederaufnehmbar. Dafür muss der Browserspeicher verfügbar sein.");
    } finally { setIsStartingSession(false); }
  }

  function handleTeamWechseln() {
    localStorage.removeItem(`quiz-session-${liveDaten.quiz_id}`);
    setSession(null);
    setTeamProfile(null);
    setTeamProfileInitiallyOpen(false);
    setTeamname("");
    setTeamPasswort("");
    setGeneriertesPasswort(null);
    setSpielerAnzahl("1");
    setTeamVorschlaege([]);
    setMeldung("");
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
      if (!await controller.flush(quizFragenId)) {
        setMeldung("Die aktuelle Antwort ist noch nicht bestätigt. Bitte den Speicherhinweis an der Frage prüfen.");
        return;
      }
      if (pixelState?.mode === "STAGED" && liveDaten.activeQuizFragenId === quizFragenId) {
        setMeldung("Antwort gespeichert. Der Stand am Stufenende zählt; Änderungen bleiben möglich.");
        return;
      }
      const submitted = await boundedParticipantAction(submitTeamAntwort({
        quizId: liveDaten.quiz_id,
        quizFragenId,
        interactionRunId: run.id,
        quizTeamSessionToken: session.sessionToken,
      }));
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
      setMeldung("Abgabe nicht bestätigt. Bitte den aktuellen Stand prüfen; die Anfrage kann bereits angekommen sein.");
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
      if (!await controller.flush(quizFragenId)) {
        setMeldung("Die aktuelle Antwort ist noch nicht bestätigt. Bitte den Speicherhinweis an der Frage prüfen.");
        return;
      }
      const stopped = await boundedParticipantAction(stopPixelbildAntwort({
        quizId: liveDaten.quiz_id,
        quizFragenId,
        interactionRunId: run.id,
        quizTeamSessionToken: session.sessionToken,
      }));
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
      setMeldung("Stoppen nicht bestätigt. Bitte den aktuellen Stand prüfen; die Anfrage kann bereits angekommen sein.");
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
        <section className="answer-surface answer-brand-header rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {theme.design.stylePreset === "EDITORIAL" && theme.identity.logoUrl && (
            <img src={theme.identity.logoUrl} alt="LOVD STELP" className="answer-editorial-logo" />
          )}
          <div className="answer-brand-copy">
            <h1 className="break-words text-3xl font-bold">
              {liveDaten.titel ?? `Quiz ${liveDaten.quiz_id}`}
            </h1>

            <p className="mt-2 text-slate-600">Antwortformular für Teams</p>
            <p className="mt-1 text-sm font-medium text-slate-600" role="status">
              {QUIZ_LIFECYCLE_LABELS[liveDaten.lifecycle]}
            </p>
          </div>
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
                disabled={liveDaten.lifecycle === "STOPPED" || isLoadingTeams || isStartingSession || !teamname.trim()}
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

        {session && teamProfile && (
          <TeamProfileEditor
            key={session.quiz_team_session_id}
            quizId={liveDaten.quiz_id}
            sessionToken={session.sessionToken}
            teamName={session.teamname}
            initialProfile={teamProfile}
            initiallyOpen={teamProfileInitiallyOpen}
            calendarSubscriptionUrl={calendarSubscriptionUrl}
            uploadEnvironmentPrefix={teamPhotoUploadEnvironment}
          />
        )}

        {session && (
        <section className="answer-surface rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {livePollState ? <div className="space-y-5">
            <div><div className="answer-kicker text-sm font-semibold uppercase tracking-wide text-cyan-700">Live-Umfrage</div><h2 className="mt-2 text-2xl font-bold">{livePollState.prompt}</h2><p className="mt-2 text-sm text-slate-600">{livePollState.state === "OPEN" ? "Antwort offen – Änderungen sind bis zum Schließen möglich." : "Die Umfrage ist geschlossen."}</p></div>
            {livePollState.type === "SINGLE_CHOICE" ? <div className="grid gap-3">{livePollState.options.map((option) => <button key={option.id} type="button" disabled={isSubmitting || livePollState.state !== "OPEN"} onClick={() => saveLivePoll({ selectedOptionId: option.id })} className={`min-h-12 rounded-xl border px-4 py-3 text-left font-semibold transition disabled:opacity-60 ${livePollResponse?.selectedOptionId === option.id ? "border-cyan-700 bg-cyan-50 text-cyan-950 ring-2 ring-cyan-100" : "border-slate-300 bg-white text-slate-900 hover:border-cyan-500"}`}><span aria-hidden className="mr-2">{livePollResponse?.selectedOptionId === option.id ? "●" : "○"}</span>{option.label}</button>)}</div> : <div className="space-y-3"><textarea className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100" maxLength={500} value={livePollText} disabled={isSubmitting || livePollState.state !== "OPEN"} onChange={(event) => setLivePollText(event.target.value)} placeholder="Kurzen Beitrag eingeben …" /><button type="button" className="answer-primary-button min-h-11 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={isSubmitting || livePollState.state !== "OPEN" || !livePollText.trim()} onClick={() => saveLivePoll({ text: livePollText })}>Beitrag senden</button>{livePollResponse?.text ? <p className="text-sm text-slate-600">Gespeichert: {livePollResponse.text}</p> : null}</div>}
          </div> : !blockIstGesperrt && (liveDaten.answerPhase === "QUESTION" ||
            (liveDaten.answerPhase === "LEGACY" &&
              aktuellerBlock &&
              !liveDaten.presentationStatusText)) ? (
            <>
              <div className="answer-kicker text-sm font-semibold uppercase tracking-wide text-green-600">
                {liveDaten.answerPhase === "QUESTION"
                  ? "Aktuelle Frage"
                  : "Aktuell freigegeben"}
              </div>

              <h2 className="mt-2 text-2xl font-bold">
                {aktuellerBlock?.titel ?? "Aktuelle Frage"}
              </h2>

              <p
                role="status"
                className="answer-status mt-3 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700"
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
                  <p className="answer-empty-state rounded-2xl border border-slate-200 bg-slate-50 p-5 font-semibold text-slate-700">
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
                  const pixelCountdownRemaining = questionPixelState?.stageDeadlineAt
                    ? Math.max(
                        0,
                        Math.ceil(
                          (new Date(questionPixelState.stageDeadlineAt).getTime() - now) /
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
                      (entries[frage.quiz_fragen_id]?.status !== "saved" || locallyEditedSinceSubmission[frage.quiz_fragen_id] ||
                        isDraftChangedSinceSubmission(
                          draftRevisions[frage.quiz_fragen_id] ?? 0,
                          submissionDraftRevisions[
                            frage.quiz_fragen_id
                          ] ?? null,
                        )),
                  );
                  const pixelActionPolicy = questionPixelState
                    ? resolvePixelAnswerActionPolicy({
                        mode: questionPixelState.mode,
                        state: questionPixelState.state,
                        stage: questionPixelState.effectivePixelStage,
                        stopped: questionPixelState.stopped,
                        isStopper: questionPixelTeamState?.isStopper ?? false,
                        canSubmit: questionPixelTeamState?.canSubmit ?? false,
                      })
                    : null;

                  return (
                    <div
                      key={frage.quiz_fragen_id}
                      className="answer-question rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="answer-question-meta mb-3 text-sm font-semibold text-slate-500">
                        Frage {frageIndex + 1}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">
                        {frage.frage}
                      </h3>

                      {frage.templateId === "pixelbild" && questionPixelState && (
                        <div className="answer-special-panel mt-4 space-y-3 rounded-2xl border-2 border-fuchsia-300 bg-fuchsia-50 p-4 text-slate-900">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong>
                              {questionPixelState.state === "REVEALED"
                                ? "Auflösung"
                                : `${questionPixelState.mode === "STAGED" ? "Stufenwertung" : "Challenge"} · Stufe ${4 - questionPixelState.effectivePixelStage}`}
                            </strong>
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                              {4 - questionPixelState.effectivePixelStage} {4 - questionPixelState.effectivePixelStage === 1 ? "Punkt" : "Punkte"}
                            </span>
                          </div>
                          <p className="text-xl font-bold tabular-nums">{pixelCountdownRemaining === null ? (isPixelStageOpenEnded(questionPixelState) ? PIXEL_OPEN_STAGE_LABEL : "Antwortphase beendet") : `${pixelCountdownRemaining} Sekunden`}</p>
                          {questionPixelState.mode === "STAGED" ? <p>Antwort bleibt erhalten. Eine spätere Änderung zählt für die spätere Stufe. Beim Abschluss durch die Moderation wird automatisch abgegeben.</p> : questionPixelState.stopped ? (
                            questionPixelTeamState?.isStopper ? (
                              <p className="font-semibold text-fuchsia-900">
                                Ihr habt in Stufe {4 - (questionPixelState.stoppedAtStage ?? 1)} gestoppt. Eure Antwort ist abgegeben und gesperrt.
                              </p>
                            ) : (
                              <p className="font-semibold text-fuchsia-900">
                                {questionPixelState.stoppedByTeamName ?? "Ein anderes Team"} hat gestoppt. Ihr könnt bis zum Ende des 20-Sekunden-Countdowns weiter bearbeiten und absenden.
                                {pixelCountdownRemaining !== null && ` Noch ${pixelCountdownRemaining} Sekunden.`}
                              </p>
                            )
                          ) : pixelActionPolicy?.showStopAndSubmit ? (
                            <p className="text-sm font-semibold text-fuchsia-900">
                              Falscher Stop: -1 Punkt. Als einziges richtiges Team sind bis zu {questionPixelState.effectivePixelStage === 1 ? 6 : 4} Punkte möglich.
                            </p>
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
                            alt={`Pixelbild in Stufe ${4 - (questionPixelState?.effectivePixelStage ?? 1)}`}
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
                          className="answer-media-button mt-4 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
                        >
                          Bild anzeigen
                        </button>
                      )}

                      <GenericAnswerRenderer
                        questionAssignmentId={frage.quiz_fragen_id}
                        interaction={frage.interaction}
                        value={antworten[frage.quiz_fragen_id]}
                        disabled={
                          !entries[frage.quiz_fragen_id] || isSubmitting ||
                          blockIstGesperrt ||
                          !questionIsWritable ||
                          submissionLocksEditing ||
                          !session
                        }
                        onChange={(value) => controller.edit(frage.quiz_fragen_id, value)}
                      />

                      <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                        {submissionStatus && entries[frage.quiz_fragen_id]?.status === "saved" ? (
                          <p className="answer-submission-status rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
                            {submissionStatus === "SUBMITTED"
                              ? changedSinceSubmission
                                ? "Ge\u00e4ndert seit letzter Abgabe"
                                : "Antwort abgegeben"
                              : "Beim Schlie\u00dfen automatisch \u00fcbernommen"}
                          </p>
                        ) : null}
                        {entries[frage.quiz_fragen_id] && <AnswerSaveStatus interaction={frage.interaction} entry={entries[frage.quiz_fragen_id]}
                          onRetry={() => void controller.retry(frage.quiz_fragen_id)}
                          onResolve={(choice) => controller.resolve(frage.quiz_fragen_id, choice)} />}
                        {frage.templateId === "pixelbild" &&
                          pixelActionPolicy?.showStopAndSubmit === true && (
                          <button
                            type="button"
                            onClick={() => void handlePixelStop(frage.quiz_fragen_id)}
                            disabled={isSubmitting || !session}
                            className="answer-primary-button pixel-answer-action min-h-11 w-full rounded-xl px-5 py-3 font-bold transition disabled:cursor-not-allowed"
                          >
                            {isSubmitting
                              ? "Stop wird geprüft..."
                              : "Verpixelung für alle stoppen & Antwort abgeben"}
                          </button>
                        )}
                        {frage.templateId === "pixelbild" &&
                          frageIstAktivePixelFrage &&
                          session &&
                          !blockIstGesperrt &&
                          questionIsWritable &&
                          !submissionLocksEditing &&
                          pixelActionPolicy?.showNormalSubmit === true && (
                          <button
                            type="button"
                            onClick={() => void handleSubmit(frage.quiz_fragen_id)}
                            disabled={
                              isSubmitting ||
                              (submissionStatus === "SUBMITTED" &&
                                !changedSinceSubmission)
                            }
                            className="answer-primary-button pixel-answer-action min-h-11 w-full rounded-xl px-5 py-3 font-semibold transition disabled:cursor-not-allowed"
                          >
                            {isSubmitting
                              ? "Wird gespeichert..."
                              : questionPixelState?.mode === "STAGED" ? "Antwort speichern"
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
                <p className="answer-submission-status mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
                  {currentSubmissionStatus === "SUBMITTED"
                    ? "Antwort abgegeben"
                    : "Beim Schließen automatisch übernommen"}
                </p>
              )}
            </>
          )}
        </section>
        )}

        {storageError && <p role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-amber-950">Dieser Browser kann Änderungen nicht auf dem Gerät sichern. Bitte diese Seite bis zur bestätigten Speicherung geöffnet lassen.</p>}
        {Object.entries(entries).filter(([id, entry]) => (entry.status !== "saved" || entry.version > 0) && !liveDaten.fragen.some(q => q.quiz_fragen_id === Number(id) && q.istFreigegeben)).map(([id, entry]) => (
          <section key={id} className={`rounded-xl border p-4 text-slate-950 ${entry.status === "saved" ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
            <p className="font-semibold">{entry.status === "saved" ? "Bestätigte Antwort" : "Noch nicht bestätigte Antwort"}</p>
            <AnswerSaveStatus entry={entry} showConfirmed onRetry={() => void controller.retry(Number(id))} onResolve={choice => controller.resolve(Number(id), choice)} />
          </section>
        ))}
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
