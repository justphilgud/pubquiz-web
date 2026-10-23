# Zehn Verbesserungen – Umsetzung und Abnahme vom 23.10.2026

Arbeitsstand auf `codex/ten-improvements-20261023`, Basis
`a4c3dd8bce44dfe9a16d4e8138635df92780b05e`. Dieser Bericht unterscheidet
Implementierung, lokale Abnahme und Betriebsnachweis. Keine Migration, neue
Abhängigkeit oder Änderung bestehender Production-Quizdaten. Insbesondere Quiz 31
und seine Teams, Antworten und Laufzeit wurden nicht verändert.

## Architektur

Die bestehenden Renderer, Serveraktionen, Livezustände und Bewertungsregeln bleiben
zuständig. Kleine reine Hilfsfunktionen übernehmen Zeitkategorien/Farbgrenzen und
die Einordnung des Abstimmungsschritts. Editorlösungen werden ausschließlich im
berechtigten Editor-Datenweg ergänzt. Die vorhandene Operations-Infrastruktur
bleibt für Backups zuständig; es entsteht kein Backupdienst in der Anwendung.

## Ergebnisse je Punkt

| Punkt | Bestätigter Ausgangszustand und Umsetzung | Abnahme und Grenzen |
| --- | --- | --- |
| 1 | Antwortschrift war bis 2,25rem begrenzt; eine Laptopregel verkleinerte Fragen zusätzlich. Größere containerabhängige Antwortschrift, bestehende Fragevariable, geringere Innenabstände ausschließlich bei Bildantworten. | Gerenderter Chrome-Test: fünf Designs, kurze/lange Antworten, Bildfrage und Bildauflösung, Größenfolge 1280/1920/1600/1280; 160 Geometrieprüfungen. Tatsächliche lokale Präsentation zusätzlich geprüft. Physischer Bildschirmwechsel und echtes Betriebssystem-Vollbild sind im verfügbaren In-App-Browser nicht verifiziert. |
| 2 | Der Livebuilder hängte unzugeordnete Fragen ausdrücklich an; ein alter Lauf konnte sie erneut publizieren. Livebuilder und serverseitige Publikations-/Schreibprüfung schließen sie aus. Editor und Diagnose behalten die Fragen. | Fixture mit zwei Blöcken, vier zugeordneten und fünf unzugeordneten Fragen; Liveumfang 27 statt Diagnoseumfang 39 Folien. Builder- und veralteter-Lauf-Regressionen. Vollständiger Abschlussablauf siehe Browserprotokoll. |
| 3 | Standard und Aktivierungswert waren 90 Sekunden. Beide sind 120; explizite Werte bleiben erhalten, ebenso ausgeschalteter Timer. | Tests mit fehlendem Wert sowie 60/90/120/180 Sekunden. Tatsächliche Meme-Erstellung startet bei 2:00. Bestehende gespeicherte 90 Sekunden bleiben 90. |
| 4 | Materialisierte Flowkonfiguration konnte gespeicherte Intro-/Outrofelder verdrängen; der reguläre Wartebildschirm ignorierte seinen Text. Kanonische Werte werden geladen und beim Speichern synchronisiert; Wartehinweis wird gerendert. | Alle neun konfigurierbaren Folienarten mit erkennbaren QA-Werten gespeichert, Editor erneut geöffnet, tatsächliche Präsentation neu geladen und Ausgabe geprüft. Begrüßung zeigt „im LOVD“ und beide Absätze. Gewollt leere QR-/Hinweisfelder und Standardfallbacks durch Tests abgesichert. |
| 5 | Abstimmung wurde vor der Fragenliste gerendert. Sie wird einmal anhand des persistierten Aktivierungszeitpunkts in die bestehende Reihenfolge eingesetzt. | Drei echte getrennte Teamsitzungen, Smartphone-Rahmen 390×844, eigene Beiträge gesperrt, Stimmwechsel überschreibt statt zu verdoppeln, erneutes Öffnen, Abschluss und Folgefrage geprüft. **Bewusste Einschränkung:** Nutzerentscheidung erhält die vorhandene Sperre vor finalisiertem Meme-Voting. Normale Zwischenfragen vor späterem Voting sind damit weiterhin nicht im Livebetrieb möglich; nur der reine Zeitstempeltest deckt diese Einordnung ab. |
| 6 | Die vorhandene Folienzeituhr hatte keine Farbstufen. Nur ihre Schriftfarbe wird ergänzt; letzte Warnschwelle vorläufig 3:00 gemäß Nutzerentscheidung. | Grenzen 0/59/60/89/90/150/151/179/180 Sekunden und ungültiger Wert getestet. Bestehender Timer und Rücksetzung beim realen Folienwechsel im Browser erhalten. Keine zusätzliche Messung oder Einstellung eingeführt; gleiche Grenzen für alle Folien. |
| 7 | Bisheriger globaler Durchschnitt vermischte Vorlauf, Fragen und Lösungen. Jetzt Summe der verbleibenden Folien mit Mittelwert je Fragetyp und Frage-/Lösungsphase; Wartefolie ausgeschlossen. | Reine Vergleichstests gleicher Restfolien bei kurzem/langem Vorlauf; getrennte Phasen und konfigurierte Pausen. Browser zeigt laufende Prognose. Fallbacks: Frage 120s, Lösung 30s, andere Folie 20s; Pause konfiguriert. Letzte 20 Beobachtungen lokal pro Quizstart; keine zugesicherte Endzeit. Ein zehnminütiger realer Warteversuch wurde nicht zusätzlich durchgeführt. |
| 8 | Editorübersicht zeigte keine Lösung. Bestehender Vorschauhelfer liest kanonische typabhängige Lösungen und liefert eine sichtbare Zusammenfassung ausschließlich an den Editor. | Tatsächlich Musik- und Pixelkarten, Reihenfolge und kreative Frage in isolierter Übersicht geprüft; automatische Tests zusätzlich mehrere richtige Antworten, Musikvarianten 8-Bit/rückwärts und zwei unterschiedliche gespeicherte Songs bei gleichem Prompt. Anagramm nutzt die Lösung statt des Rätseltexts; kanonische Reihenfolgen werden nicht verdoppelt. Die exakte Gleichtext-Musikpaar-Abnahme ist automatisch, nicht zusätzlich im Editor nachgestellt. |
| 9 | Annahme einer Deaktivierung widerlegt: bestehender täglicher Schedule und Flag waren aktiv. Wöchentlich Montag 02:30 UTC eingerichtet; veraltete Releasevariable durch verifizierte Production-Deploymentmetadaten ersetzt. Jobbudget 45→90 Minuten nach nachgewiesenem Timeout. Monitoring verlinkt aktuelle Scheduleläufe. | Letzter belegter erfolgreicher Schedule: [39743653050](https://github.com/justphilgud/pubquiz-web/actions/runs/39743653050), 22.10.2026. Frischer manueller Lauf [39919171978](https://github.com/justphilgud/pubquiz-web/actions/runs/39919171978) bei 45 Minuten abgebrochen; heutiger Schedule [39920641414](https://github.com/justphilgud/pubquiz-web/actions/runs/39920641414) mit `PRIVATE_READBACK_FAILED`. Kein Erfolg behauptet. Isolierter Restore-Preflight [39924682983](https://github.com/justphilgud/pubquiz-web/actions/runs/39924682983) ist erfolgreich: Manifest/Medien sowie Identität, Rechte und leeres Ziel PASS; `restoreExecuted=false`. Die tatsächliche Wiederherstellung in [39932475893](https://github.com/justphilgud/pubquiz-web/actions/runs/39932475893) ist nach separater menschlicher Freigabe PASS: `restoreExecuted=true`, Datenbankintegrität PASS und Medienintegrität PASS für 834 Medienobjekte. Neuer Wochenplan erst nach Integration und einem echten Schedulelauf betrieblich belegt. |
| 10 | Vorhandene Spezifikationen erweitert statt Parallelregelwerk. Alle 21 registrierten Templates erhalten eine verbindliche Phasen-/Ansichtenmatrix; AGENTS verweist darauf. | Gerenderte Regressionen für geschlossene Bildfragen, Zusatzinformationen und offene Fragen ohne bedeutungslosen Platzhalter in fünf Designs. Automatischer Abgleich Registry↔Dokumentation. Interaktive Sonderverträge bleiben verlinkt; vollständige Geräte-/Medienabdeckung wird nicht behauptet. |

## Browserprotokoll und Bedienung der Meme-Abstimmung

Isoliertes Quiz 103 „CODEX Abnahme 10 Punkte 2026-10-23“ in Preview-Datenbank,
lokale Anwendung. Wegen fehlender aktueller Tabellen in der lokalen Development-DB
wurde ausschließlich der ausdrücklich freigegebene Preview-Zugang verwendet.
Keine Migration und kein Production-Zugang. Testdaten bleiben zur Nachvollziehbarkeit
erhalten. Drei Origins/Ports sorgen für voneinander getrennte Teamidentitäten;
im normalen Browser alternativ drei getrennte Browserprofile verwenden.

Tatsächlich erprobte Anleitung:

1. Quizverwaltung und **Moderation** öffnen; Präsentation in einem zweiten Fenster
   öffnen. Dort gegebenenfalls **Präsentation starten / fortsetzen** betätigen.
   Drei getrennte Teamformulare `/quiz/<id>/antworten` öffnen und mit **Team starten**
   drei verschiedene Teams anmelden. Drei Tabs desselben Profils/Origins reichen
   nicht zur Trennung der gespeicherten Teamidentität.
2. In der Moderation **Zur ersten Slide**, dann **Quiz starten**; mit **Weiter** bis
   zur Meme-Erstellung. Die Präsentation zeigt die Aufgabe, die Teamformulare die
   Eingaben für das Meme. Je Team unterschiedliche Texte eingeben und **Meme
   verbindlich abgeben** betätigen. Auf **Antwort abgegeben.** beziehungsweise
   **Aktuelle Antwort gespeichert.** warten, bevor weitergeschaltet wird.
3. In der Moderation **Weiter** beendet die Einreichung. Die Moderation zeigt jetzt
   die eingegangenen Beiträge zur Auswahl; das Teamformular bleibt bei seiner
   Abgabe. Noch erscheint keine Abstimmung.
4. Gewünschte Beiträge jeweils mit **Freigeben** markieren und **Auswahl bestätigen /
   Review abschließen** betätigen. **Memes vorstellen**, dann je Beitrag **Nächstes
   Meme / Übersicht** bis zur Übersicht. Es müssen gültige freigegebene Beiträge
   und stimmberechtigte getrennte Teams existieren.
5. **Abstimmung öffnen** betätigen. Die Präsentation beziehungsweise ihre
   Moderationsvorschau zeigt die Abstimmungsphase; die Moderation zeigt den
   Teilnahmefortschritt, ohne laufende Stimmenzahlen je Beitrag. Im Teamformular
   erscheint genau ein Abschnitt **Deine Stimme** unter den bisherigen Schritten.
   Der eigene Beitrag ist gesperrt. Eine Stimme für einen fremden Beitrag abgeben.
   Vor Schließung kann die Auswahl geändert werden; das überschreibt die eine
   Stimme des Teams. Erneutes Öffnen stellt Auswahl und Identität wieder her.
6. **Abstimmung schließen**, anschließend **Meme-Ergebnis finalisieren**. Danach
   sind Stimmen gesperrt und das Ergebnis wird sichtbar. Im Test: Alpha zwei,
   Gamma eine, Beta null Stimmen; Alpha gewinnt und erhält den bestehenden einen
   Punkt. Datenprüfung: genau drei Stimmzeilen, Alpha nach Änderung Revision 2.
7. **Weiter** zeigt die Ergebnisfolie, weiteres **Weiter** die normale Folgefrage.
   Die tatsächliche Präsentation blieb über mehrere Minuten und nach Neuladen
   auf dieser Folgefrage; anschließend wurde ihre Auflösung erreicht. Es gab
   keinen Rücksprung zur Meme-Frage.

Typisch fehlende Voraussetzung ist Schritt 4 oder das ausdrückliche **Abstimmung
öffnen** nach Vorstellung/Übersicht. Die interne Testansicht ersetzt keine drei
persistenten Teamsitzungen, verbindlichen Einreichungen und Moderationsübergänge;
eine reine Folienvorschau kann deshalb kein vollständiges Voting beweisen.
Der vollständige Ablauf wurde danach über Block 2, Siegerehrung, Jahreswertung und
alle Outrofolien bis Folie 27/27 durchlaufen. Die tatsächliche Präsentation zeigte
abschließend die gespeicherte Buchungsfolie; keine unzugeordnete Frage erschien.
Quiz 103 wurde regulär beendet, ohne Antworten oder Ergebnisse zurückzusetzen.
Temporäre Preview-Zugangskopien wurden entfernt und die lokale Development-
Konfiguration wiederhergestellt; lokale Testserver sind gestoppt.

Die Teamansicht auf 390×844 und das Endergebnis wurden tatsächlich geprüft.
Die tatsächliche öffentliche Präsentation war während der offenen Abstimmung
zunächst noch hinter ihrer Startüberlagerung; die offene Phase wurde in der
Moderationsvorschau geprüft, das finale Ergebnis danach in der tatsächlichen
Präsentation. Diese Einschränkung wird nicht als volle öffentliche Live-Abnahme
der offenen Phase ausgegeben.

## Prüfungen und Bereitstellung

- Produktionsbuild mit installiertem Next.js 16.2.5 erfolgreich, über dokumentierte
  WASM-/Webpack-Ausführung wegen lokal durch Windows blockierter nativer SWC-Datei.
- TypeScript, Prisma-Validierung und ESLint der geänderten Dateien erfolgreich.
  Kein Schema geändert.
- Gesamtsuite zunächst erfolgreich; Wiederholung scheiterte im bestehenden
  Content-Browsertest an Windows-Profil-Dateisperre. Separater Wiederholungslauf
  außerhalb der Sandbox hat die betroffene LOVD-Suite einschließlich realer
  Browserprüfung erfolgreich abgeschlossen.
- Die unveränderliche Importplandatei besitzt im Windows-Checkout CRLF; für den
  Hash-Test ausschließlich lokal auf LF normalisiert und vom Commit ausgeschlossen.
  Generierter Prisma-Client ebenfalls nur lokal regeneriert und nicht Teil des PR.
- Question-Rewrite-Suite (39 Tests) und Meme-Archiv-Suite (5 Tests) erfolgreich.
  GitHub-CI bestätigt außerdem echte isolierte PostgreSQL-Importtransaktionen sowie
  Bridge- und isolierte Restore-Integrationstests. Diese Fixture-Restores ersetzen
  nicht den separat geprüften echten Restore. Auch dieser ist inzwischen erfolgreich, siehe Nachweis unten.
- Kein Merge oder Production-Deployment dieses Zehn-Punkte-Pakets ohne tatsächlich
  abgeschlossene Prüfungen. PR- und CI-Stand werden im Übergabebericht genannt.

Bereits geöffnete Ansichten nach Bereitstellung neu laden. Gespeicherte Intro-/
Outroprops werden beim Laden bezogen; die vorhandene Laufzeitabfrage ersetzt
keinen Reload der Inhaltsdaten. Die Moderation speichert Prognosebeobachtungen
lokal; Quizlaufzeit, Antworten und Punkte werden dadurch nicht zurückgesetzt.

## Echter isolierter Restore – abgeschlossen

- [Preflight 39924682983](https://github.com/justphilgud/pubquiz-web/actions/runs/39924682983):
  PASS, Zielidentität/Rechte/Leerzustand und Manifest-/Medienintegrität bestätigt.
- [Restore 39932475893](https://github.com/justphilgud/pubquiz-web/actions/runs/39932475893):
  PASS am 23.10.2026 um 11:51:50 MESZ; `restoreExecuted=true`,
  `databaseIntegrity=PASS`, `mediaIntegrity=PASS`, 834 Medienobjekte.
- Backup `production/acceptance/run-39743653050-1`, Snapshot 22.10.2026 09:54:07 MESZ,
  Manifest-SHA256 `eac00139fd734aacb5da731c611bdb64bf675c63faba7fc6f4b84c14ab198846`.
  Das GitHub-Artefakt `isolated-restore-evidence` (ID 12493356240) enthält den
  nicht vertraulichen maschinellen Nachweis. Datenbankstruktur, Tabellen-Digests/
  Anzahlen, Constraints, Sequenzen, Migrationen, redigierte Authwerte und
  persistierte Punkte-/Ranking-Rekonstruktion werden vor PASS zwingend verglichen.
- Ziel ausschließlich `ap94_restore_1a6a488b608f240bae7c8b09391f6503` im gepinnten
  Projekt `icy-leaf-46256271`, Endpoint `ep-small-poetry-b2jfzg9w`, PostgreSQL 17.
  Keine Production-/Preview-Wiederherstellung und keine erneute Beschreibung eines
  vorhandenen Ziels. Kein angemeldeter Browser-Spieltest des Restores; Authpasswörter
  sind bewusst ausgeschlossen. Medien im isolierten Runner geprüft, nicht neu publiziert.
- Ziel bleibt zur Nachvollziehbarkeit erhalten. Seine Schreibfreigabe läuft am
  24.10.2026 um 08:52:15 MESZ ab; die Lease löscht die Datenbank nicht automatisch.
  Eine spätere Bereinigung ist separat zu autorisieren.
- Das bestehende Backup enthält die veraltete Releasezuordnung `fecca333`; der
  bestätigte Daten-/Medien-Snapshot wird dadurch nicht zu einem aktuellen Backup.
  Der PR korrigiert die Ermittlung für zukünftige planmäßige Läufe. Neuer Wochenplan
  und 90-Minuten-Budget sind vor Integration nicht aktiv. Heutiger Readbackfehler
  bleibt als offenes Betriebsproblem dokumentiert; Restore-PASS behebt ihn nicht.

## Zentrale Änderungen und Betriebsanleitung

- `app/rendering/presentation/`: Lesbarkeit, Wartehinweis und gerenderte Regressionen.
- `app/quiz/`: Liveauswahl, feste Inhalte, Meme-Standard/-Einordnung, Moderationszeit.
- `app/fragen/questionSolutionPreview.ts`: kanonische Lösungsvorschau im Editor.
- [Template-Verträge](../architecture/presentation-rendering.md),
  [Laufzeitverträge](../architecture/quiz-runtime-contracts.md), `AGENTS.md`.
- [Backupumfang, Zeitplan, Retention und Wiederherstellung](../operations/ap96-backup-automation.md),
  `.github/workflows/ap94-acceptance.yml`, `scripts/operations/production-release*`.

Backup: privater bestehender Blobstore; DB, Konfigurationen und referenzierte Medien,
Authpasswörter ausgenommen. Montag 02:30 UTC entspricht 03:30 MEZ/04:30 MESZ.
Policy 14 Tage plus acht Wochenpunkte, geschützte Punkte länger; Löschung bleibt
Dry Run, daher derzeit keine automatische Speicherbegrenzung. Kein neuer Tarif.
Restoreziel ist eine frische, mit Lease markierte Datenbank ausschließlich im
vorhandenen isolierten Restoreprojekt. Der Required Reviewer bleibt erforderlich.
