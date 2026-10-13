"use client";

import { useEffect, useRef, useState } from "react";
import { resolveSpeechVoice } from "@/app/fragen/editor/components/useSpeechVoices";
import type { PresentationPlaybackCommand } from "./presentationLiveState";

/** The editor's browser speech output, driven by the existing presentation commands. */
export function SynchronizedSpeech({ text, language, voiceId, speed, command, commandId, onPlaybackBlocked }: {
  text: string;
  language: string;
  voiceId: string;
  speed: number;
  command: PresentationPlaybackCommand;
  commandId: number;
  onPlaybackBlocked?: () => void;
}) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [status, setStatus] = useState("Bereit zum Vorlesen");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  useEffect(() => {
    let active = true;
    const supported = typeof window.speechSynthesis?.speak === "function" && typeof window.SpeechSynthesisUtterance === "function";
    queueMicrotask(() => {
      if (!active) return;
      setPosition(0);
      if (!supported) setError("Dieser Browser unterstützt keine Sprachausgabe. Verwende eine vorbereitete Audiodatei oder einen Browser mit Sprachausgabe.");
    });
    if (!supported) return () => { active = false; };
    const synthesis = window.speechSynthesis;
    const cancel = () => {
      if (utteranceRef.current) {
        utteranceRef.current.onstart = null;
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
        utteranceRef.current.onboundary = null;
        synthesis.cancel();
        utteranceRef.current = null;
      }
    };
    cancel();
    return () => { active = false; cancel(); };
  }, [text, language, voiceId, speed]);

  useEffect(() => {
    if (typeof window.speechSynthesis?.speak !== "function" || typeof window.SpeechSynthesisUtterance !== "function") return;
    const synthesis = window.speechSynthesis;
    if (command === "pause") {
      if (utteranceRef.current) synthesis.pause();
      setStatus(utteranceRef.current ? "Vorlesen pausiert" : "Bereit zum Vorlesen");
      return;
    }
    if (command !== "play") {
      if (utteranceRef.current) {
        utteranceRef.current.onerror = null;
        utteranceRef.current.onend = null;
        utteranceRef.current.onstart = null;
        utteranceRef.current.onboundary = null;
        synthesis.cancel();
        utteranceRef.current = null;
      }
      setStatus("Bereit zum Vorlesen");
      return;
    }
    if (utteranceRef.current) {
      synthesis.resume();
      setStatus("Text wird vorgelesen");
      return;
    }
    if (!text.trim()) {
      setError("Für diese Frage ist kein übersetzter Text zum Vorlesen hinterlegt.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = speed;
    utterance.voice = resolveSpeechVoice(voiceId);
    utteranceRef.current = utterance;
    setError(null);
    setStatus("Vorlesen wird gestartet …");
    utterance.onstart = () => { if (utteranceRef.current === utterance) setStatus("Text wird vorgelesen"); };
    utterance.onboundary = (event) => { if (utteranceRef.current === utterance) setPosition(event.charIndex); };
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      setStatus("Vorlesen beendet");
    };
    utterance.onerror = (event) => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      setError(`Sprachausgabe konnte nicht starten (${event.error}). Aktiviere dieses Präsentationsfenster und starte das Audio erneut in der Moderation.`);
      if (event.error === "not-allowed") onPlaybackBlocked?.();
    };
    try {
      synthesis.resume();
      synthesis.speak(utterance);
    } catch {
      utteranceRef.current = null;
      setError("Sprachausgabe konnte nicht starten. Aktiviere das Präsentationsfenster und starte das Audio erneut in der Moderation.");
      onPlaybackBlocked?.();
    }
  }, [command, commandId, text, language, voiceId, speed, onPlaybackBlocked]);

  return error ? <p role="alert" className="mt-4 text-lg">{error}</p>
    : <p role="status" data-speech-position={position} className="mt-4 text-lg">{status}</p>;
}
