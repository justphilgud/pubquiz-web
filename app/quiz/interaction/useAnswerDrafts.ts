"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnswerDraftController, type DraftEntry, type DraftSaveResult } from "./answerDraftController";
import { createDraftJournal } from "./draftJournal";
import type { TeamAnswerDraft } from "../[quizId]/antworten/GenericAnswerRenderer";

export function useAnswerDrafts(scope: string | null, save: (id: number, runId: number, revision: number, value: TeamAnswerDraft) => Promise<DraftSaveResult>) {
  const saveRef = useRef(save);
  const journalRef = useRef<ReturnType<typeof createDraftJournal> | null>(null);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => { saveRef.current = save; }, [save]);
  // Callbacks are stored by the controller; no ref is read during its constructor.
  // eslint-disable-next-line react-hooks/refs
  const controller = useMemo(() => new AnswerDraftController({
    save: (id, runId, revision, value) => saveRef.current(id, runId, revision, value),
    persist: entries => { try { journalRef.current?.save(entries); } catch { setStorageError(true); } },
    schedule: (callback, delay) => setTimeout(callback, delay),
    cancel: timer => clearTimeout(timer),
  // Scope is the authenticated quiz/team session boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scope]);
  const entries = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    if (scope) {
      try {
        journalRef.current = createDraftJournal(scope, localStorage, crypto.randomUUID());
        const recovered = journalRef.current.load();
        controller.restore(recovered);
      } catch {
        // Reflect an external browser storage failure.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStorageError(true);
      }
    } else journalRef.current = null;
    const pending = () => Object.values(controller.getSnapshot()).some(entry => entry.status !== "saved");
    const flush = () => { for (const id of Object.keys(controller.getSnapshot())) void controller.flush(Number(id)); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending()) { event.preventDefault(); event.returnValue = ""; }
    };
    const hidden = () => { if (document.hidden) flush(); };
    const online = () => { for (const id of Object.keys(controller.getSnapshot())) void controller.retry(Number(id)); };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", hidden);
      controller.dispose();
    };
  }, [controller, scope]);
  return { controller, entries, storageError };
}

export function draftStatusText(entry: DraftEntry) {
  switch (entry.status) {
    case "saved": return entry.baseRevision > 0 ? "Aktuelle Antwort gespeichert." : "Noch keine Antwort gespeichert.";
    case "dirty": return "Geändert – noch nicht gespeichert.";
    case "saving": return "Antwort wird gespeichert …";
    case "error": return "Speichern nicht bestätigt. Deine Änderung bleibt auf diesem Gerät erhalten. Bitte Verbindung prüfen.";
    case "conflict": return "Euer Team hat auf einem anderen Gerät eine andere Antwort gespeichert. Bitte wählt, mit welcher Antwort ihr weiterarbeitet.";
    case "recovered": return "Ungespeicherte Änderung auf diesem Gerät gefunden. Bitte prüfen und bewusst übernehmen.";
    case "closed": return "Diese Änderung wurde nicht als gespeichert bestätigt. Die Antwort ist gerade gesperrt. Es zählt ausschließlich der rechtzeitig gespeicherte Stand.";
  }
}
