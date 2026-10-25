# Eventartenrechte: Umsetzung, Migration und Abnahme

> **Aktueller fachlicher Vertrag nach Reviewkorrektur:** Rollen werden direkt im
> Benutzerformular je Eventreihe vergeben; Produktfreischaltungen beim Anlegen bzw.
> Bearbeiten der Eventreihe. Keine zusätzliche Eventartrechte-Matrix, keine Rollen
> je Format. Die unten dokumentierte erste Umsetzung/Browserabnahme ist historisch
> und wird durch die neue Reihenrollen-Abnahme ergänzt. Maßgeblich sind die aktuelle
> [Architektur](../architecture/role-assignments.md) und
> [Adminanleitung](../admin-guide/benutzer-und-rollen.md).
> Zusatzmigration `20261025160000_series_roles` erhält alte Formatzeilen/Auditdaten,
> übernimmt eindeutige Reihenrollen und stoppt nur bei tatsächlich widersprüchlichen
> früheren Preview-Zuweisungen. Kein Zurücksetzen einer Historie oder Quizsession.
> Karaoke-Editoren haben keine Formatfunktionen. Gemeinsame Verwaltung bleibt
> unabhängig. Weiterhin ausschließlich PR/Preview, kein Merge/Production-Release.


Stand: 25. Oktober 2026. Ausgangs-Main `5920a568afb6d650d52a9c819e347170b993ed80`
(PR #129). Review-Branch `codex/event-type-permissions`. Dieser Auftrag autorisiert
**keinen Merge und kein Production-Deployment**. Maßgeblich ist der aktuelle
[Berechtigungsvertrag samt Matrix](../architecture/role-assignments.md).

## Umsetzung je Auftragspunkt

| Punkt | Ergebnis | Nachweis / Grenze |
| --- | --- | --- |
| 1 Katalog / Produkte | QUIZ, BINGO, POWERPOINT_KARAOKE mit stabilen IDs; Freischaltung separat pro Reihe, ausschließlich Admin | DB-FKs, Admin-Action, Browserproduktansicht |
| 2 Rollen | Pro Benutzer/Reihe/Eventart Editor oder Eventmanager; fehlende Zeile = kein Zugriff; Produkt UND Rolle erforderlich | Reine Policytests, echte Actions/API und PostgreSQL |
| 3 Gemeinsame Verwaltung | Separate Zuweisung für Stammdaten/Logo/Standardbranding, keine Benutzer-/Produkt-/Spielrechte | Browser: Quizmanager ohne Logoaktion; Bingo-Manager mit Zusatzrecht sieht Logoaktion ohne Quizobjekte |
| 4 Migration | Additiver Quiz-Backfill, bisherige Manager erhalten gemeinsames Recht; globale Rollen und Inhalte unverändert | Reale neue QA-Datenbank, Vorher-/Nachher-Vergleich; Legacy-only-Daten werden kein Rechtefallback |
| 5 Administration | Bestehende Kontoverwaltung mit separater Matrix, Produkte in Reihendetails; globale Quizrollen ausdrücklich beschriftet | Vier getrennte Browserkonten, Änderungen speichern und nachladen |
| 6 Entzug / Deaktivierung | Zuweisungen/Inhalte bleiben erhalten; Reaktivierung stellt wirksame Rechte wieder her; laufendes Quiz blockiert Produktdeaktivierung | Browser plus echte Admin-/Start-Actions, konkurrierender Start/Deaktivierung in PostgreSQL |
| 7 Quizbereiche | Bestehende Objektprüfungen aus #129 bleiben; effektive Quizrechte speisen Fragen, Suche, Medien, Storys, Quiz, Moderation, Teams, Dashboards | 41 echte Action-/API-Regressionen; kein neues globales Kopierrecht |
| 8 Abnahme | Repräsentative Migration, getrennte Rollen, direkte Angriffe und tatsächlicher normaler Liveablauf | Details unten, finale Projektprüfungen/CI im PR |
| 9 Lieferung | Architektur, Adminanleitung, Migrations-/Rückfallplan und Review-PR | Kein Merge, keine Production-Migration, kein Production-Deployment |

## Bewusste Entscheidungen und abgelöste Regeln

- Neue Eventreihen starten ohne Produktfreischaltung. Nur die bei Migration bereits
  vorhandenen Reihen erhalten Quiz automatisch. Das verhindert neue implizite Produkte.
- Neue Benutzer können ohne Rechte angelegt werden; Rollen folgen über die Matrix.
  Konto-/globale Rollenänderungen erhalten alle Format- und gemeinsamen Rechte.
- Nicht freigeschaltete Rollen können gespeichert werden; die Oberfläche erklärt
  ihre Wirkung erst nach Produktaktivierung. Inaktive Benutzer bleiben ohne Zugriff.
- Gemeinsame Verwaltung darf ohne Formatrolle bestehen. Neue Formatmanager bekommen
  sie nicht implizit. Der Backfill erhält ausdrücklich das bisherige Verhalten.
- Die bisherige Ein-Rolle-pro-Reihe-/Dual-Write-Bedienung ist mit unterschiedlichen
  Rollen je Eventart fachlich unvereinbar. Sie wird bewusst abgelöst, nicht parallel
  als zweite Rechtequelle weitergeführt. Alte Actions/Formfelder lehnen Änderungen
  mit Verweis auf die Matrix ab. DB-Trigger sperren alte Reihenschreibvorgänge auch
  während des Codewechsels. Globale Admin-/Editor-Dual-Writes bleiben erhalten.
- Die bisherige Rollentabelle in der Benutzerliste bleibt als ausdrücklich
  bezeichnete Zusammenfassung wirksamer Quizrollen; die Matrix ist für alle
  gespeicherten Eventart-/gemeinsamen Rechte maßgeblich.
- Gemeinsame Eventobjekte, neue Hauptnavigation, neue Designverträge, Subdomains
  und spielbares Bingo/Karaoke sind nicht Bestandteil. Keine Zwangsfestlegung eines
  zukünftigen gemischten Events auf genau eine Eventart.

## Migrations- und Integrationsplan

1. PR-Head und alle Pflichtprüfungen reviewen. Neue Rechteverwaltung und Matrix mit
   den Fachverantwortlichen prüfen. Vor diesem Review keine Production-Integration.
2. Für eine spätere autorisierte Integration administrative Rechteänderungen und
   Produktänderungen für das kurze Migrations-/Codewechsel-Fenster organisatorisch
   pausieren; laufende Quizdaten und Sessions bleiben erhalten. Keine Schutzregel
   oder Migrationshistorie umgehen.
3. Bestehendes reguläres Backupverfahren und geprüfte DB-Identität verwenden. Keine
   Datenbank zurücksetzen, kein `migrate reset`, kein nachträgliches Umschreiben alter
   Migrationen. Neue Migration über den bestehenden geschützten Ablauf genau einmal.
4. Migration läuft als Transaktion: neue Tabellen/Katalog/FKs/Indizes/Check-Constraint,
   alle bisherigen Reihen QUIZ aktiv, aktuelle Scoped-Assignments nur als Quizrechte,
   bisherige Manager zusätzlich gemeinsame Verwaltung mit ursprünglichen Auditzeiten.
   Globale Rollen und sämtliche Inhalte/Laufzeitdaten bleiben unverändert.
5. Trigger sperren ab diesem Zeitpunkt Legacy-Reihenschreibpfade. Alter Code kann
   Konten/globalen Rollen weiter verwalten, erhält bei alten Reihenformularen einen
   Fehler statt eines stillen Rechteverlusts. Keine Fremdrechte aus Legacy-only-Zeilen.
6. Neuen Code deployen. Aktive Quizrollen werden ausschließlich aus neuen Rollen UND
   Produktstatus abgeleitet. `syncLegacyQuizRoles` projiziert nur zur Kompatibilität
   in beide Altstrukturen; ein transaktionslokaler interner Marker erlaubt dies.
7. Vorher-/Nachher-Zahlen und konkrete Stichproben vergleichen: alle alten Reihen
   QUIZ aktiv, alle bisherigen Scoped-Rollen erhalten, gemeinsame Verwalter genau
   bisherige Manager, keine neuen Bingo-/Karaoke-Zuweisungen oder Freischaltungen,
   globale Rollen/Quiz-/Antwort-/Ergebniszahlen unverändert. Release-SHA verifizieren.
8. Administrative Schreibpause beenden; offene Ansichten neu laden, Präsentation
   lokal freigeben. Kein Session-Reset. Neue Produktfreigaben ausschließlich bewusst.

## Rückfallplan und tatsächliche Kompatibilitätsgrenze

Ein nackter Code-Rollback auf Main #129 ist **nach Matrixänderungen nicht sicher**:
Ein Quizmanager ohne gemeinsames Verwaltungsrecht würde durch alten Code wieder
Brandingrechte erhalten. Ein reiner gemeinsamer Verwalter würde Rechte verlieren;
Admin/öffentliche Altpfade kennen keine Produktgates. Die bewusste Trennung lässt
sich nicht verlustfrei in eine alte Ein-Rolle-pro-Reihe-Tabelle kodieren.

Bei Fehlern: betroffene Verwaltungs-/Spielzugriffe in einen geschützten Wartungszustand
versetzen, laufende Daten unangetastet lassen, keine weiteren Rechteänderungen.
Additives Schema und neue Zuweisungen erhalten. Bevorzugt einen geprüften korrigierten
Code ausliefern, der die neuen Produkt-/Objekt-/gemeinsamen Gates weiter respektiert.
Alter Code darf nur unter einer tatsächlichen Sperre seiner Schreib- und sensiblen
Zugriffspfade laufen; keine eingeschränkte Rolle auf alte implizite Rechte zurückführen.
Keine Legacy-Rückkopie, keine automatischen Down-Migrationen, keine Datenbankrestores
oder Löschung neuer Zuweisungen. Ein weitergehender Rückfall benötigt eine eigene
geprüfte Freigabe. Dies ist eine reale Grenze, kein behaupteter verlustfreier Rollback.

Die spätere Contract-Phase (Altspalten/-tabellen entfernen) bleibt separat. Die
bestehende Production bleibt in diesem Auftrag unverändert auf #129.

## Automatische und reale Datenbankprüfungen

- `test:authorization`: 35 bestehende plus sechs neue Tests = 41 echte Server-Action-/
  API-Regressionen mit echten Guards. Nur Auth/Persistenz/Framework-Seiteneffekte sind
  Adapter. Neue Fälle: deaktiviertes Quiz, reine Bingo-/Karaokerollen, getrennte
  Brandingrechte, unveränderter globaler Quiz-Editor.
- `eventTypes.test.ts`: Kombinationen derselben Person in A/B und Quiz/Bingo;
  Produkt ohne Rolle / Rolle ohne Produkt; Admin/globaler Quiz-Editor, Kataloggrenze.
- Reales PostgreSQL: `scripts/testing/event-types.integration.test.ts`. Erzeugt eine
  **neue** Datenbank; Basisschema aus geprüftem Main-Commit, synthetische Bestandsrollen
  und Quizdaten, danach tatsächliche neue SQL-Migration. Alte Quizze und Assignment-
  Zeilen vor/nach Migration unverändert. Neue Rollen/gemeinsame Rechte überprüft;
  absichtlich inkonsistente Legacy-only-Zeilen verleihen keine Rechte. Rollen-Constraint
  und Legacy-DB-Schreibsperren tatsächlich geprüft. Echte Matrix-, Konto-, Produkt-,
  Start- und Guard-Funktionen gegen Prisma/PostgreSQL, keine gemockten DB-Policies.
- Gleichzeitiger echter Start/Deaktivierung muss eine gültige der beiden Reihenfolgen
  liefern und darf nie RUNNING + deaktiviertes Produkt hinterlassen. Idempotente
  Reaktivierung, bestehende Rollenzuweisung, Kontodeaktivierung und gesperrte alte
  Membership-Actions geprüft. CI führt dies im vorhandenen PostgreSQL-Service aus.
- Der neue DB-Test braucht einen expliziten isolierten Testzugang. Er akzeptiert
  ausschließlich Loopback mit benannten CI-Testdatenbanken oder den ausdrücklich
  verifizierten Developmenthost. Es werden keine Zugangsdaten in Dateien kopiert.

Lokaler Developmenthost:
`ep-dry-dust-aljik09f-pooler.c-3.eu-central-1.aws.neon.tech`, eindeutig verschieden von
Production `ep-dawn-paper-alws45vx-pooler.c-3.eu-central-1.aws.neon.tech`.
Keine bestehende Development-/Preview-/Production-Datenbank wurde zurückgesetzt.
Neue QA-Datenbanken bleiben als Nachweis erhalten. Fehlgeschlagene Vorläufe wurden
nicht wiederverwendet oder zurückgesetzt.

## Tatsächliche Browserabnahme

Lokaler Next-Server auf Port 3046, ausschließlich QA-Datenbank
`event_type_qa_1792932658065`, vier Hostnamen mit getrennten Auth-Cookies:
`admin.eventqa.localhost`, `manager.eventqa.localhost`, `editor.eventqa.localhost`,
`global.eventqa.localhost`. Fünfter Host `team.eventqa.localhost` für anonyme signierte
Team-Session; tatsächliche Präsentation zusätzlich zur Moderation geöffnet.

1. Admin öffnet `/admin/users`, wählt Manager A in **Eventartrechte**. Sichtbar:
   Reihe A Quiz-Eventmanager; Reihe B Quiz-Editor und Bingo-Eventmanager; Karaoke
   nicht freigeschaltet. Produkte und gemeinsame Checkbox getrennt.
2. Gemeinsames Recht A entzogen, gespeichert, Manager-Reihendetail neu geladen:
   Logo-Upload verschwindet; Quizverwaltung bleibt verfügbar. Produktcheckboxen für
   Manager deaktiviert. Kein Benutzerverwaltungszugriff.
3. Admin deaktiviert Quiz A vor dem Live-Test. Offener Editor A verliert nach Reload
   seinen Fragezugriff. Globaler Quiz-Editor kann seinen eigenen globalen Entwurf
   weiterhin öffnen. Reaktivierung stellt den ursprünglichen Reihenentwurf wieder her.
4. Admin entzieht Editor A die Quizrolle, gibt nur Bingo-Eventmanager B. Speichern aus
   dem noch offenen Quizentwurf wird abgewiesen. Keine globale oder fremde Quizrechte.
5. Zusätzlich gemeinsames Recht B: Editor-A-Sitzung sieht B-Stammdaten und Logoaktion,
   Produktcheckboxen bleiben gesperrt; keine Quizobjekte/Quizanzahl werden ausgegeben.
6. Synthetischer Manager A startet eigens angelegtes Quiz 13, **Eventarten Live-Abnahme**.
   Admin versucht Produktdeaktivierung: verständliche Ablehnung; Quiz bleibt laufend.
7. Parallel Moderation, echte `/quiz/13/praesentation` mit **Präsentation starten /
   fortsetzen**, und Teamformular `/quiz/13/antworten`. Neues synthetisches Team tritt
   bei. Moderation navigiert regulär zur Frage; Präsentation und Teamformular zeigen
   „Wie viel ist eins plus eins?“. Team speichert „Zwei“, bestätigter Stand wird nach
   Rehydration wiederhergestellt. Moderation zeigt eine Antwort und 100 % Quote.
8. **Weiter** zur Auflösung: Moderation und tatsächliche Präsentation zeigen „Zwei“;
   Teamtext gesperrt mit **Beim Schließen automatisch übernommen**. Reguläres
   **Quiz beenden**, bestehende Bestätigung, Status **Beendet**; kein Reset.
9. Globalen Editor im Admin-Kontoformular deaktiviert. Speichern im noch geöffneten
   globalen Entwurf führt zur Anmeldung statt einer Änderung. Neue Kontospeicherung
   verändert keine Matrixrechte.

Nachkontrolle per SELECT: abgewiesene Entwürfe unverändert; regulärer Stop von Quiz 13,
genau eine finale Submission, Antwort „Zwei“, Bewertung CORRECT und 1,0000 Punkte per SELECT bestätigt.
Screenshot der tatsächlich gespeicherten Matrix als visueller Reviewnachweis vorhanden.

## Grenzen und offene Betriebsnachweise

Bingo-/Karaoke-Runtime existiert noch nicht und wurde nicht als spielbar getestet.
Für spätere Spielfunktionen sind Objektprüfungen und ein tatsächlicher Runtime-
Deaktivierungsblocker Voraussetzung; die neue Rollenfreischaltung ersetzt sie nicht.
Ein neues gemeinsames Event-/Designmodell wird nicht vorweggenommen. Product/Admin-
UI ist lokal abgenommen, kein Production-Migrationstest oder neuer Production-Release.

Bereits gelieferte Inhalte und bekannte öffentliche Medienadressen werden nicht
rückwirkend gelöscht. Es wird kein zentraler Sitzungsabbruch behauptet.
`PRIVATE_READBACK_FAILED` bleibt als historisches Betriebsproblem ungeklärt; kein
Ursachenfix und keine Backupänderung in diesem PR. Echter Wochenplanlauf bleibt ein
separater Betriebsnachweis; keine zusätzlichen manuellen Backups als Ersatz.

Finale Typecheck-/Lint-/Build-/Tests-/CI-Ergebnisse und tatsächlicher PR-Status werden
im PR festgehalten. Verbleibende Blocker dürfen nicht als bestanden dargestellt werden.

## Lokaler finaler Prüfstand

Prisma-Validierung, TypeScript, strikter ESLint aller geänderten eigenen TS-/TSX-
Dateien und optimierter Next-Build (Webpack) erfolgreich. Vollständiger `npm test`:
1680 Tests, 1678 erfolgreich, zwei bestehende bedingte Skips, null Fehler. Zusätzlich
der reale PostgreSQL-Migrations-/Actiontest erfolgreich; CI führt ihn verpflichtend
in seinem eigenen PostgreSQL-Service aus. Der unveränderliche Importplan musste für
die lokale Windows-Hashprüfung mit originalen Git-Bytes (LF) gelesen werden; kein
Inhalt, erwarteter Hash oder Test wurde dafür geändert. Die temporäre lokale
Dev-Origin-Erweiterung ist zurückgenommen, keine neue Cache-/Origin-Konfiguration.

Die erste CI fand eine bestehende Meme-Archiv-Testfixture, die ihre neu angelegte
Reihe ohne explizites Quizprodukt verwendete. Deren Setup wurde um die ausdrückliche
Quizfreischaltung ergänzt; die Teilnehmerprüfung und alle fachlichen Assertions
bleiben unverändert. Dies ist eine erforderliche Anpassung an den bewusst neuen
Fail-closed-Standard, kein Abschwächen der Produktprüfung. Neue Matrix-/Produktänderungen
verwenden außerdem weiterhin das bestehende technische Console-Audit ohne Personendaten.

Der neue Integrationstest wurde zusätzlich mit der tatsächlichen CI-URL-Variante
`schema=pubquiz` rot/grün geprüft: Prisma lässt dann Schemaqualifizierungen teilweise
weg, während node-postgres diesen Prisma-URL-Parameter nicht als Suchpfad anwendet.
Der ausschließlich neue leere Testschemaufbau setzt deshalb `search_path` ausdrücklich.
Frühe Fehler schließen nun ebenfalls ihre Testverbindungen; Phasen und Zeitlimits
verhindern einen hängenden CI-Prozess. Keine Änderung der Produktionsmigration oder
Produkt-/Objektprüfungen für diese Testharnesskorrektur.
## Gehostete fachliche Preview für PR #130 (25.10.2026)

Der manuelle Preview-Workflow erhält `isolated_pr130=true`. Diese Option ist
an `codex/event-type-permissions` gebunden; dieser Branch darf umgekehrt nicht
mit der gemeinsamen Preview-Datenbank deployt werden. Identitätsprüfung,
exakte erfolgreiche Push-CI, Medienprüfung und Git-SHA-Prüfung bleiben aktiv.
Die externe Preview-Freigabeliste und Environment-Branchpolicy werden um genau
diesen Branch ergänzt; bestehende Regeln bleiben erhalten.

Ziel ist die neue Datenbank `pr130_review_20261025` auf dem vorhandenen
Nonproduction-Endpoint `ep-dry-dust-aljik09f-pooler.c-3.eu-central-1.aws.neon.tech`,
mit eigenem Login `pr130_review`. Das ist eine bewusste Ausnahme zur gemeinsamen
Preview-DB auf wispy-bird. Keine Datenkopie aus Production. Nur synthetische
Benutzer und Prüfreihen. `DATABASE_URL` und ein eigener `AUTH_SECRET` sind
Vercel-seitig ausschließlich für diesen Preview-Branch hinterlegt. Der
Workflow verwendet das separate Environment-Secret `PR130_DATABASE_URL`.
Medien werden weiterhin aus der bestehenden Nonprod-Konfiguration geerbt;
die Datenbankisolation bedeutet keine eigene Blob-Store-Isolation.

Beim Neuaufbau zeigte sich ein bestehendes Baselineproblem: `0_init` enthält
ein BOM und bereits die fünf Spalten der folgenden Draft-Migration. Nur in der
neuen leeren Review-Datenbank wurde `0_init` ohne BOM ausgeführt und per
`migrate resolve --applied` dokumentiert. Die bereits vorhandenen fünf Spalten
wurden geprüft und die nachfolgende Draft-Migration entsprechend als angewandt
aufgelöst. Fehlversuche bleiben in der Historie erhalten. Alle übrigen
Migrationen einschließlich Eventartrechten liefen regulär mit `migrate deploy`;
anschließender Status: aktuell. Historische Migrationsdateien, bestehende
Datenbanken und deren Migrationshistorien bleiben unverändert.

Admin-Matrix: `/admin/users`; Produktfreischaltungen: `/admin/eventreihen`.
Zugangsdaten werden ausschließlich direkt an den Auftraggeber übermittelt,
nicht im Repository oder PR veröffentlicht. Kein Merge und kein Production-
Deployment im Rahmen dieser Bereitstellung.


## Korrektur der Schema-Kodierung bei der gehosteten Reihenrollen-Abnahme

Bei der lokalen Schemaerweiterung wurde `schema.prisma` versehentlich in einer
Windows-Kodierung geschrieben. Der native Prisma-Migrationsprozess brach beim
strikten UTF-8-Lesen ab, während die CLI den Rückgabecode null lieferte. Dadurch
wurde die neue Anwendung zunächst ohne `benutzer_reihenrollen` bereitgestellt;
der Startseiten-Smoke-Test erfasste diesen authentifizierten Pfad nicht.
Runtime-Log und lokale Diagnose bestätigten denselben Fehler. Keine SQL-/Datenursache.

Schema wieder als UTF-8 gespeichert und Client regulär regeneriert. Ein rot/grün
geprüfter automatischer Test in `scripts/ci-workflows.test.ts` dekodiert die
Schema-Datei ausdrücklich mit fatalem UTF-8-Decoder. Damit blockiert dieser konkrete
Fehler die erforderliche CI, bevor Preview deployen darf.

Die exakt vorhandene Zusatzmigration wurde danach mit regulärem `prisma migrate
deploy` im kontrollierten Ablauf auf `pr130_review_20261025` angewendet. Status
vorher: Zusatzmigration ausstehend; nachher: 61 Migrationen aktuell. Zusätzlich
Tabellenexistenz und genau einen erfolgreichen Migrationsbeleg direkt geprüft.
Authentifizierte Benutzerseite anschließend im gehosteten Browser erfolgreich.
Kein manuelles Eintragen oder Zurücksetzen von Migrationshistorien, keine
Production-Verbindung und keine bestehende Quizsession zurückgesetzt.
