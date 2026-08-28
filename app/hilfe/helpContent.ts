import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import {
  getActorEventSeriesIds,
  hasGlobalRole,
} from "@/app/roles/roleAssignmentPolicy";

export type HelpAudience = "ALL" | "EDITOR" | "EVENT_MANAGER" | "ADMIN";

export type HelpTopic = {
  slug: string;
  title: string;
  description: string;
  source: string;
  audiences: readonly HelpAudience[];
  screenshots?: readonly HelpScreenshot[];
};

export type HelpScreenshot = {
  fileName: string;
  alt: string;
  caption: string;
};

export const helpTopics: readonly HelpTopic[] = [
  { slug: "start", title: "Schnellstart", description: "Anmelden und die wichtigsten Bereiche finden.", source: "user-guide/anmeldung-und-passwort.md", audiences: ["ALL"] },
  { slug: "content", title: "Content und Umfragen", description: "Fragen, Story-Elemente und Umfragen erstellen und finden.", source: "user-guide/content-und-umfragen.md", audiences: ["EDITOR", "EVENT_MANAGER", "ADMIN"], screenshots: [{ fileName: "content-overview-eventmanager.jpg", alt: "Content-Übersicht aus Sicht eines Eventmanagers", caption: "Content-Suche mit Fragen, Story-Elementen und Umfragen." }] },
  { slug: "fragen", title: "Fragen verwalten", description: "Fragetypen, Lösungen, Medien und Aktualität pflegen.", source: "user-guide/fragen-verwalten.md", audiences: ["EDITOR", "EVENT_MANAGER", "ADMIN"] },
  { slug: "quiz", title: "Quiz aufbauen", description: "Quizblöcke und gemischte Inhalte zusammenstellen.", source: "user-guide/quiz-verwalten.md", audiences: ["EVENT_MANAGER", "ADMIN"], screenshots: [{ fileName: "quiz-mixed-content-eventmanager.jpg", alt: "Quiz-Editor mit gemischten Inhalten", caption: "Fragen und Story-Elemente im gemeinsamen Quiz-Ablauf." }] },
  { slug: "moderation", title: "Quiz moderieren", description: "LIVE-Antworten, Umfragen und Präsentation steuern.", source: "user-guide/quiz-moderieren.md", audiences: ["EVENT_MANAGER", "ADMIN"], screenshots: [{ fileName: "live-drafts-moderation-eventmanager.jpg", alt: "LIVE-Drafts in der Moderationsansicht", caption: "Gespeicherte Entwürfe werden intern mit ihrem Status angezeigt." }] },
  { slug: "praesentation", title: "Präsentation", description: "Publikumsansicht, Auflösungen und Ergebnisfolien.", source: "user-guide/praesentation.md", audiences: ["EVENT_MANAGER", "ADMIN"] },
  { slug: "teams", title: "Teams und Teilnahme", description: "Teilnahme, Teamprofil und globale Teamidentität.", source: "user-guide/teams-und-teilnahme.md", audiences: ["EVENT_MANAGER", "ADMIN"], screenshots: [{ fileName: "team-avatar-picker.jpg", alt: "Kompakte Avatar-Auswahl im Teamprofil", caption: "Teamprofil mit den freigegebenen Standard-Avataren." }] },
  { slug: "auswertung", title: "Ergebnisse auswerten", description: "Antworten prüfen und Quizresultate nachvollziehen.", source: "user-guide/ergebnisse-auswerten.md", audiences: ["EVENT_MANAGER", "ADMIN"] },
  { slug: "faq", title: "Häufige Fragen", description: "Kurze Antworten auf typische Bedienungsfragen.", source: "user-guide/faq.md", audiences: ["ALL"] },
  { slug: "benutzer", title: "Benutzer und Rollen", description: "Konten, Rollen und Zugriffsbereiche verwalten.", source: "admin-guide/benutzer-und-rollen.md", audiences: ["ADMIN"] },
  { slug: "teamverwaltung", title: "Globale Teamverwaltung", description: "Zugangswörter, Archivierung und Löschung verwalten.", source: "admin-guide/teamverwaltung.md", audiences: ["ADMIN"] },
  { slug: "kategorien", title: "Kategorien und Freigaben", description: "Kategorien prüfen und Content freigeben.", source: "admin-guide/freigaben-und-kategorien.md", audiences: ["ADMIN"] },
];

export function getHelpAudiences(actor: AuthorizationActor): HelpAudience[] {
  const audiences: HelpAudience[] = ["ALL"];
  if (hasGlobalRole(actor, "ADMIN")) audiences.push("ADMIN", "EDITOR", "EVENT_MANAGER");
  if (hasGlobalRole(actor, "EDITOR") || getActorEventSeriesIds(actor, "EDITOR").length > 0) audiences.push("EDITOR");
  if (getActorEventSeriesIds(actor, "EVENT_MANAGER").length > 0) audiences.push("EVENT_MANAGER");
  return [...new Set(audiences)];
}

export function getVisibleHelpTopics(actor: AuthorizationActor) {
  const audiences = new Set(getHelpAudiences(actor));
  return helpTopics.filter((topic) => topic.audiences.some((audience) => audiences.has(audience)));
}
