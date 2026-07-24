"use client";

import { useEffect, useMemo, useState } from "react";

export type BrowserSpeechVoice = {
  id: string;
  name: string;
  language: string;
  label: string;
};

const languageNames: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
  fr: "Französisch",
  es: "Spanisch",
  it: "Italienisch",
  nl: "Niederländisch",
};

export function useSpeechVoices(languageCode: string) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    queueMicrotask(load);
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);

  return useMemo<{
    matching: BrowserSpeechVoice[];
    others: BrowserSpeechVoice[];
  }>(() => {
    const mapped = voices.map((voice) => {
      const code = voice.lang.slice(0, 2).toLocaleLowerCase();
      return {
        id: voice.voiceURI || voice.name,
        name: voice.name,
        language: voice.lang,
        label: `${voice.name} – ${languageNames[code] ?? code} (${voice.lang})`,
      };
    });
    const matchesTarget = (voice: BrowserSpeechVoice) =>
      voice.language.toLocaleLowerCase().startsWith(
        languageCode.toLocaleLowerCase(),
      );
    const byLocaleAndName = (
      left: BrowserSpeechVoice,
      right: BrowserSpeechVoice,
    ) => left.language.localeCompare(right.language) ||
      left.name.localeCompare(right.name);
    return {
      matching: mapped.filter(matchesTarget).sort(byLocaleAndName),
      others: mapped.filter((voice) => !matchesTarget(voice)).sort(byLocaleAndName),
    };
  }, [languageCode, voices]);
}

export function resolveSpeechVoice(voiceId: string) {
  if (!("speechSynthesis" in window) || voiceId === "default") return null;
  return window.speechSynthesis.getVoices().find(
    (voice) => (voice.voiceURI || voice.name) === voiceId,
  ) ?? null;
}
