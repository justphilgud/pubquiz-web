# Release2: KI-Formulierungshilfe – Implementierungsstand

Stand16.10.2026: **implementiert und lokal geprüft, noch nicht auf Preview oder
Production abgenommen. Kein KI-Merge/Production-Release.** Der vorherige
[PR116-Release ist erfolgreich abgeschlossen](../operations/pr116-production-release-20261016.md).

## Änderung und Verantwortung

Die optionale Aktion „Frage umformulieren“ hängt am bestehenden Fragefeld.
Original/Vorschlag sind vergleichbar, der Vorschlag editierbar, verwerfbar und
erneut anforderbar. Übernehmen ersetzt ausschließlich den ungespeicherten
Fragetext; normales Speichern bleibt erforderlich. Keine Migration/Abhängigkeit.

Der Editor behält Draft, Vorlagen, Suche/Rückkehr und Speichern. Ein unabhängiger
Controller übernimmt Anfragetickets, Abbruch und Stale-Schutz; Panel nur Anzeige
und explizite Aktionen. Route/Provider prüfen Editorial-Rolle, Flag, Konfiguration,
begrenzte Ein-/Ausgabe, Fehler und Zahlen/Zitate. Lösungen/Medien werden nicht
übertragen. Die exakte API-Route liefert ihre selbst authentifizierten JSON-Fehler,
anstatt eine HTML-Anmeldeseite zurückzugeben; alle anderen Proxyregeln erhalten.

Historische Quellen PR71/d30506cc und5f3786e9 gezielt ausgewertet. Keine Übernahme
alter Editor-, Such-, Musik- oder Runtime-Dateien. Umsetzung auf aktuellem Main
`b6d5388df4dd146a16b507219d50e02ea0bb1e1b`, nach tatsächlicher PR116-Production-QA.

## Lokale Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck | PASS, zusätzlich während finalem Next-Build |
| Changed-file ESLint | PASS, null Warnungen |
| Next16.2.5-Produktionsbuild | PASS im CI-Modus mit synthetischen Konfigurationswerten |
| Gezielte KI-Tests |39/39PASS: Domain, Controller, Endpoint, Provider, SSR, Rate-Limit |
| Zusätzliche Regression |30/30PASS: dynamische Vorlagen/Musik, Environment-Vorrang, CI-Verträge |
| Gesamtes bestehendes `npm test` |1577PASS,0FAIL,2lokal mangels PostgreSQL-Ziel ausgelassen; Linux-CI besitzt den separaten echten PostgreSQL-Job |
| Echte gebaute HTTP-Route |2/2PASS: ohne Cookies/ohne injizierten Actor401, Flag aus404, jeweils JSON/no-store; Editor/ähnlicher Fremdpfad weiterhin307Login |
| Client-Bundle |Keine Provider-URL und keine interne Provideranweisung in `.next/static` |
| Inhaltsschutz |Übernehmen verändert nur `questionText`; keine Speicherung/Statusänderung, Medien/Antworten/Kategorien/Musik unverändert |
| Verspätete Antwort |Geänderte Quelle, A→B→A, Kontext-Unmount, Mehrfachklicks, synchroner letzter Übernahmeabgleich geprüft |
| Statische Vorlagen |Aktuelle Definitionsflags und dynamische FIXED/EXCLUDED/REQUIRED_NEW-Regeln geprüft |

Erster lokaler Build scheiterte an Windows-Sandbox-Pfadzugriff, danach ohne lokale
Entwicklungsdatei; regulärer CI-Modus mit synthetischen Werten erfolgreich.
Erster Gesamttest fand ausschließlich den bekannten Windows-CRLF-Hashunterschied
einer eingefrorenen Importfixture. Mit ihren ursprünglichen LF-Bytes erneut PASS,
lokale ursprüngliche Bytes anschließend exakt wiederhergestellt; Quelldatei im
Git-Diff unverändert. Kein freigegebener Inhalt oder Schutztest abgeschwächt.
HTTP-Test behandelte zunächst relative Login-URLs fälschlich als absolut; nur
Testauswertung korrigiert, anschließend tatsächliche Status-/JSON-Prüfung PASS.

## Provider, Kosten und offene Gates

Aktuelle offizielle Modell-/API-Dokumentation tatsächlich gelesen, siehe
[Betrieb](../operations/openai-question-rewrite.md). GPT5.6Luna dokumentiert
Responses/Structured Outputs und Standardpreise0,20/1,20USD pro Mio.Input/Output.
Die projektbezogene Verfügbarkeit bleibt bis zum echten Zielaufruf ungeprüft.

Vercel besitzt bisher keine OpenAI-Konfiguration. Ein bestehender lokaler
Projektschlüssel ist vorhanden; zwei ausschließlich lesende Modellmetadata-
Versuche aus Windows erhielten HTTP403 ohne OpenAI-JSON-Antwort. Keine Bewertung
als gültiger oder ungültiger Key. **0Generierungen,0Tokens,0USD verbraucht;
1USD Gesamttestbudget verfügbar.** Keine Schlüsselwerte in Dateien/Berichten.

Für den nächsten Schritt fehlt die temporäre Freigabe ausschließlich des neuen
Branches `codex/openai-question-rewrite-release` im bestehenden geschützten
Preview-Prozess (TRUSTED_PREVIEW_BRANCHES + Environment-Branch-Policy). Die
vorherigen Freigaben galten ausdrücklich anderen Branches. Zentrale Nonprod-
Medienkonfiguration unverändert; ihr Guard verbietet branchspezifische Overrides.

Danach vorgesehen: vorhandenen OpenAI-Zugang ausschließlich auf dem Zielserver
geschützt konfigurieren, echten angemeldeten UI-/HTTP-/Providerablauf mit eigenen
synthetischen Fragen prüfen, Usage/Kostenschätzung/Reserve dokumentieren. Bei
fehlender Providerabnahme Funktion deaktiviert lassen; kein KI-Release behaupten.
Allgemeine Merge-/Production-Freigabe besteht bereits und wird nicht erneut erfragt.

## Dateien und Verträge

- Neu: `app/api/question-rewrite/route.ts`, `questionRewrite*`, `questionTextDiff`
  unter `app/fragen/editor`, Panel und Tests, tatsächlicher HTTP-Test unter
  `scripts/question-rewrite`.
- Integrationen: bestehende Editorseiten/-komponenten, Drafthelper,
  Template-Metadaten, de/en-Nachrichten, exakte Proxyroute, Environment-Lader,
  CI/Testscripts und Beispielkonfiguration.
- [Architektur/Living Specification](../architecture/question-rewrite.md)
- [Betrieb, Konfiguration, Budget und Rückfallweg](../operations/openai-question-rewrite.md)
- Erfolgreicher PR116-Bericht/Bildnachweise liegen unabhängig vom noch offenen
  KI-Release im Repository und sind im PR116-Kommentar verlinkt.

Rückfall: Flag deaktivieren und regulär redeployen; manuelles Bearbeiten/Speichern
bleibt bestehen. Keine Datenmigration. Archivrelease erhalten. Neue temporäre
Branchfreigaben nach Abschluss/Abbruch entfernen und nachlesen.
