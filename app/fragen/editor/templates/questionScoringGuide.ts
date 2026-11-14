import { questionTemplateIds as ids, resolveCanonicalQuestionTemplateId } from "./questionTemplateRegistry";
import type { QuestionTemplate } from "../types";

type TemplateId = typeof ids[keyof typeof ids];
export type QuestionScoringRule = { name: string; maximum: string; rule: string };
const binary = "Richtige Antwort: 1 Punkt. Falsche oder fehlende Antwort: 0 Punkte. Akzeptierte Schreibvarianten sind alternative Lösungen, keine zusätzlichen Punkte.";
const music = "0,5 Punkte pro richtigem Antwortfeld. Interpret und Titel zusammen: 1 Punkt. Bei einer Vorlage mit nur einem Antwortfeld: maximal 0,5 Punkte.";
const poll = "Keine Quizpunkte und keine Richtig/Falsch-Bewertung.";

/** Shared explanatory content for the picker and the central help topic. */
export const questionScoringRules: Record<TemplateId, QuestionScoringRule> = {
  [ids.standard]: { name: "Standardfrage", maximum: "1 Punkt; strukturierte Felder: 0,5 je Feld", rule: `${binary} Bei strukturierten Antwortfeldern gelten stattdessen 0,5 Punkte je richtigem Feld.` },
  [ids.factsPerson]: { name: "Fakten → Person", maximum: "1 Punkt", rule: binary },
  [ids.factsYear]: { name: "Fakten → Jahr", maximum: "1 Punkt", rule: binary },
  [ids.factsCountry]: { name: "Fakten → Land", maximum: "1 Punkt", rule: binary },
  [ids.factsText]: { name: "Fakten → Freitext", maximum: "1 Punkt", rule: binary },
  [ids.trueFalse]: { name: "Wahr / Falsch", maximum: "1 Punkt", rule: binary },
  [ids.music]: { name: "Musik", maximum: "1 Punkt bei zwei Feldern", rule: music },
  [ids.musicReverse]: { name: "Musik rückwärts", maximum: "1 Punkt bei zwei Feldern", rule: music },
  [ids.musicEightBit]: { name: "8-Bit-Musik", maximum: "1 Punkt", rule: "Richtiger Songtitel: 1 Punkt. Falsche oder fehlende Antwort: 0 Punkte. Bei älteren Vorlagen mit mehreren Antwortfeldern wird der eine Punkt gleichmäßig auf die Felder verteilt." },
  [ids.faceMorph]: { name: "FaceMorph", maximum: "1 Punkt bei zwei Personen", rule: "0,5 Punkte pro richtig erkannter Person. Beide Personen richtig: 1 Punkt." },
  [ids.artwork]: { name: "Kunstwerk", maximum: "1 Punkt bei zwei Feldern", rule: "Künstler: 0,5 Punkte. Titel: 0,5 Punkte. Beide richtig: 1 Punkt. Akzeptierte Titelvarianten zählen als dieselbe Lösung." },
  [ids.translationReadAloud]: { name: "Übersetzt vorgelesen", maximum: "1 Punkt", rule: binary },
  [ids.anagram]: { name: "Anagramm", maximum: "1 Punkt", rule: binary },
  [ids.googleReviews]: { name: "Google-Rezensionen", maximum: "1 Punkt", rule: binary },
  [ids.pairs]: { name: "Paare bilden", maximum: "0,25 × Paaranzahl", rule: "0,25 Punkte je richtigem Paar; falsche oder fehlende Zuordnungen: 0 Punkte. Bei 2–10 Paaren sind 0,5–2,5 Punkte möglich. Beispiel: 3 richtige Paare ergeben 0,75 Punkte, unabhängig von der Gesamtzahl." },
  [ids.ordering]: { name: "Reihenfolge", maximum: "0,25 × Elementanzahl", rule: "0,25 Punkte je Element an der exakt richtigen Position. Vier richtige Positionen ergeben 1 Punkt; sieben ergeben 1,75 Punkte." },
  [ids.multipleChoice]: { name: "Mehrfachauswahl", maximum: "0,5 × Anzahl richtiger Optionen", rule: "+0,5 Punkte je richtig ausgewählter Option, −0,5 je falsch ausgewählter Option; insgesamt mindestens 0 Punkte. Alle Optionen anzukreuzen ergibt bei mehreren Optionen nie die volle Punktzahl. Bei Altfragen mit ausschließlich richtigen Optionen werden dafür 0,5 Punkte abgezogen." },
  [ids.estimate]: { name: "Schätzfrage", maximum: "1 Punkt als Basismaximum", rule: "Die Antwort wird manuell bewertet. Die normale Basisbewertung vergibt nicht automatisch Punkte nach der Nähe zur Lösung. Eine Stichfrage zur Auflösung eines Gleichstands ist davon getrennt." },
  [ids.pixelImage]: { name: "Pixelbild", maximum: "3 Punkte; Challenge bis 6 Punkte", rule: "Stufenwertung: richtige Antwort je nach maßgeblicher Bildstufe 3/2/1 Punkte, falsch 0. Challenge: regulär 3/2/1; exklusiv richtiger Stop in einer frühen Stufe 6/4; falscher Stop −1. Kein Expertenbonus oder Risikomodus." },
  [ids.pollSingle]: { name: "Umfrage – Einfachauswahl", maximum: "0 Punkte", rule: poll },
  [ids.pollMulti]: { name: "Umfrage – Mehrfachauswahl", maximum: "0 Punkte", rule: poll },
  [ids.pollScale]: { name: "Umfrage – Skala", maximum: "0 Punkte", rule: poll },
  [ids.memeCaption]: { name: "Meme beschriften", maximum: "1 Punkt", rule: "Nach finalisierter Abstimmung erhält jedes Gewinnerteam 1 Punkt. Bei Gleichstand auf Platz 1 erhalten alle Gewinnerteams je 1 Punkt. Ohne gültige Stimmen gibt es keine Punkte. Keine normale Richtig/Falsch-Bewertung." },
};

export function getQuestionScoringRule(templateId: string | null): QuestionScoringRule | null {
  const id = resolveCanonicalQuestionTemplateId(templateId) ?? ids.standard;
  return Object.hasOwn(questionScoringRules, id) ? questionScoringRules[id as TemplateId] : null;
}

export function getTemplateScoringHint(template: QuestionTemplate | null): string {
  const baseId = template?.baseTemplateId !== undefined ? template.baseTemplateId : template?.id ?? null;
  const id = template?.scoringTemplateId ?? baseId;
  return getQuestionScoringRule(id)?.rule ?? "Die Bewertung richtet sich nach dem Basistemplate und den konfigurierten Antwortfeldern.";
}
