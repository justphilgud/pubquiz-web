# Release2: KI-Formulierungshilfe – Implementierungsstand

Stand16.10.2026: **implementiert, CI grün, Preview mit echtem Provider und
Editorablauf abgenommen. Production noch ausstehend. Kein KI-Merge/Production-Release.** Der vorherige
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

Der vorhandene lokale Projektschlüssel wurde nach ausdrücklicher direkter Freigabe
geschützt für ausschließlich diesen Preview-Branch hinterlegt. Zwei ausschließlich lesende Modellmetadata-
Versuche aus Windows erhielten HTTP403 ohne OpenAI-JSON-Antwort. Keine Bewertung
als gültiger oder ungültiger Key. Die später erfolgreichen Zielaufrufe beweisen
den nutzbaren Zugang im Preview. Keine Schlüsselwerte in Dateien/Berichten.

Die direkte Freigabe für `codex/openai-question-rewrite-release` wurde umgesetzt:
temporärer Eintrag in TRUSTED_PREVIEW_BRANCHES und zusätzliche Environment-
Branch-Policy63303195. Die drei bestehenden Einträge/Policies blieben erhalten.
Alle fünf dokumentierten OpenAI-Variablen sind als sensitive Werte ausschließlich
für `preview:codex/openai-question-rewrite-release` gesetzt und anhand ihrer
Metadaten geprüft. Schlüssel nur im Prozessspeicher und über stdin übertragen;
keine neuen Zugangsdaten, keine Production-Konfiguration. Zentrale Nonprod-
Medienkonfiguration unverändert; ihr Guard verbietet branchspezifische Overrides.

## CI und tatsächliches Preview

- [PR121](https://github.com/justphilgud/pubquiz-web/pull/121), Anwendungscode
  `906882899242c22aa8983ebf837ec0a56ff4fce6`.
- [Push-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/38942561004)
  und [PR-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/38942568153):
  beide SUCCESS, einschließlich Typecheck, Tests, Changed-file ESLint, Build,
  tatsächlicher HTTP-Authentifizierung und echtem PostgreSQL-Job.
- [Reguläres Preview-Deployment](https://github.com/justphilgud/pubquiz-web/actions/runs/38943133545):
  SUCCESS. Vertrauens-/CI-, Datenbankidentitäts-, zentrale Medien- und
  Migrationsstatusprüfungen sowie Smoke-Test erfolgreich.
- Deployment `dpl_3qZAyoGGWUN2QjVKEJPqPb4c4fp6`:
  [unveränderliches Preview](https://pubquiz-khcq9z809-just-phil-gud.vercel.app/).
  Vercel-Alias:
  [Branch-Preview](https://pubquiz-web-git-codex-openai-question-rewr-0cc965-just-phil-gud.vercel.app/).
- Nach Anmeldung zehn echte Providerantworten über den tatsächlichen Editor.
- Gefundene kleine UI-Korrektur: Nach erfolgreichem normalen Speichern blieb der
  Hinweis auf die ungespeicherte Übernahme stehen. Panel erhält nun ausschließlich
  den bestehenden Änderungsstatus des Editors; keine neue Speicherlogik.
- Finaler Anwendungscode `13c7aea0cc58be0997603d96cdeb4b1d2dae6764`:
  [Push-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/38944084074)
  und [PR-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/38944093909)
  SUCCESS. Typecheck und striktes ESLint der drei betroffenen TSX-Dateien lokal
  nochmals PASS;39/39KI-Tests PASS. Vollständige CI einschließlich Build,
  Repositoryregressionen und echtem PostgreSQL nochmals grün.
- [Finales reguläres Preview-Deployment](https://github.com/justphilgud/pubquiz-web/actions/runs/38944602066):
  SUCCESS, `dpl_26hvt9MaqFTaqkBc1tLq4pqeHJxo`,
  [Deployment](https://pubquiz-g9rnazzkl-just-phil-gud.vercel.app/).
  Angemeldetes Monitoring am Branch-Alias liefert tatsächlich den vollständigen
  Commit13c7aea0cc58be0997603d96cdeb4b1d2dae6764.

## Tatsächliche Browser-/Provider-Abnahme

Nur eigene synthetische Daten: neue Preview-Frage253, Eventreihe
TEST-PR88-INHALTE-20261004, StatusEntwurf, keine Quizzuordnung. Weitere Fälle
blieben ungespeicherte Entwürfe. Keine realen Quizze/Bestandsfragen geändert.

| Fall | Providerergebnis / redaktionelle Bewertung |
| --- | --- |
| Kurzer Text | „heisst“ zu „heißt“ korrigiert; Bedeutung/Antwort erhalten |
| Eigennamen | Ada Lovelace unverändert; keine Antwort ergänzt |
| Zitat/Jahr | `Wer hat den Roman „1984“ geschrieben?`; genaue Zeichen/Zahl erhalten |
| Dezimalzahl/Einheit | `Wie viele Meter entsprechen 2,5 km?`;2,5/km erhalten, keine Lösung ergänzt |
| Umlaut/Fachkürzel | Elementfrage mitAu unverändert, keine Lösung ergänzt |
| Langer Satz | Kürzer, beide Fachinformationen sowie1990/16 erhalten |
| Erneute Anfrage | Tatsächlich „Erneut formulieren“ bedient, Verlauf2, reale Usage kumuliert |
| Musik | Nach bearbeiteter Übernahme nur Frage geändert; QA-Interpret, QA-Titel und Antwortumfang „Interpret und Titel“ unverändert |

Unveränderte gute Vorschläge sind zulässig, keine garantierte Verbesserung oder
automatische Faktenprüfung. Ein zweiter kurzer Vorschlag behielt sogar „heisst“;
die menschliche redaktionelle Prüfung bleibt notwendig.

- Anfordern → vergleichen → Vorschlag bearbeiten → übernehmen an Frage253.
  Separat geöffneter Editor zeigte vor dem normalen Speichern weiterhin das
  ursprüngliche „Wie heisst…“: Übernahme persistiert nicht automatisch.
- Normales Entwurf-Speichern und echter Reload erfolgreich. AntwortParis,
  KategorieGeografie, Quelle, Kontrollnotiz, Testreihenscope, Entwurfsstatus und
  fehlende Quizzuordnung erhalten. Im finalen Preview Speicherhinweis vor Save
  sichtbar, nach erfolgreichem Save verschwunden. Finaler Text „Wie heißt die
  Hauptstadt von Frankreich?“.
- Verwerfen ließ den Ausgangstext erhalten. Während einer sichtbar ausstehenden
  Anfrage A→B→A geändert: später kein Vorschlag/Overwrite. Usage dieses
  abgebrochenen Transports unbekannt und konservativ reserviert.
- Zu schnelle zweite Anfrage verständlich durch App-Cooldown abgewiesen; kein
  Provideraufruf dieses Requests, Text unverändert.
- Tatsächlich statischer FaceMorph-Fragetext im finalen Preview ohne KI-Button.
  Der Meme-Fragetext ist laut aktueller Definition dagegen editierbar und wird
  bewusst nicht als statischer Testfall ausgegeben.
- Suche q=253, Template=standard, Status=DRAFT: Editorlink trägt vollständiges
  returnTo, Rückkehr liefert exakt dieselbe URL und Suchtext253.
- Browsergrenze: Die bestehende native Bestätigung beim Wechsel bereits
  befüllter Templates war mit der Browserautomation nicht bedienbar. Frische
  FaceMorph-Auswahl im finalen Preview erfolgreich; Controller-Kontextwechsel
  zusätzlich deterministisch getestet. Keine vorgetäuschte Bestätigung.
- Berechtigungen: echte angemeldete UI geprüft; echte gebaute HTTP-Kette ohne
  Sitzung401 und Flag aus404 separat geprüft. Pure Eventmanagerrolle und andere
  Rollen serverseitig automatisiert getestet; kein behaupteter Live-Rollentausch.

### Testbudget vor Production

Modellgpt-5.6-luna und begrenzte Parameter sind durch zehn tatsächliche erfolgreiche
Preview-Responses bestätigt.12UI-Versuche:10Erfolge,1App-Cooldown ohne Provider,
1clientseitiger Abbruch ohne Usage. Dazu2lesende Modell-Metadaten-GETs.
2269Input-/248Outputtokens:0,0007514USD konfigurierte Schätzung bei0,20/1,20USD
je Mio.Tokens. Zusätzliche Reserve0,01USD für den Abbruch; konservativ noch
0,9892486USD vom gesamten1USD-Budget. Production ebenfalls hier einrechnen.

Öffentliche synthetische Nachweise ohne Secrets:
[vollständiges Preview-Ledger](question-rewrite-assets/preview-provider-budget.json),
[erster echter Vergleich](question-rewrite-assets/preview-first-provider.png),
[Musikfelder nach Übernahme](question-rewrite-assets/preview-music-preserved.png).

Nächster Release-Schritt: bewusste gültige Production-Konfiguration, regulärer
Merge/Main-CI/Deployment und eigener Production-Ablauf einschließlich Reload.
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
