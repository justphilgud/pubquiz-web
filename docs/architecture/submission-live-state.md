# Living Specification: Submission- und Moderationskonsistenz (AP2)

Stand: 7. September 2026. Ergänzt [Quiz-Lifecycle](quiz-lifecycle.md),
[Antwort-Interaction](answer-interaction.md) und [Runtime-Verträge](quiz-runtime-contracts.md).

## Zweck und fachlicher Begriff

Der Moderationszähler beantwortet: Wie viele angemeldete Teams haben für die
angezeigte Quizfrage bereits eine inhaltliche Antwort gespeichert?
„Eingegangene Antwort“ bezeichnet einen gespeicherten, gemäß Run-Contract
nichtleeren Draft **oder** eine wirksame finale Submission. Das ist kein neues
Submission-Artefakt und keine Aussage über Richtigkeit, Vollständigkeit aller
strukturierten Felder oder bereits erfolgte Bewertung. Inhalt und erlaubte Werte
prüft derselbe `validateInteractionPayload` wie Autosave und Auto-Finalisierung.
Eine teilweise ausgefüllte strukturierte Antwort zählt gemäß dessen `hasContent`.
Eine Reihenfolge zählt erst als persistierte gültige vollständige Permutation.

Finale Submissions bleiben unveränderliche Snapshots. Die separate Anzeige
„Finale Antworten“ zählt ausschließlich die wirksamen finalen Snapshots.
Öffentliche Ergebnisverteilungen und Bewertung erhalten keine Drafts aus AP2.

## Ausgangsfehler und bewusste Korrektur

`getAntwortStatusData` zählte bei einem `is_current`-Run nur
`team_answer_submissions`; normale Team-Autosaves stehen zunächst in
`team_antworten`. Deshalb meldete die Moderation 0 trotz gespeicherter Eingaben.
Ohne aktuellen Run zählte der Fallback dagegen sämtliche Draft-Zeilen, auch leere.
Das widersprach dem dokumentierten zweistufigen Antwortfluss.
Zusätzlich initialisierte die Moderationsseite den Zähler immer mit `questionId =
null`; ausstehende Polls einer vorherigen Frage konnten Client-State überschreiben.

## Quelle, Zustände und Identitäten

`getQuizAnswerProgress` liest Teams, den letzten Run der **konkreten**
`quiz_id × quiz_fragen_id`-Zuweisung sowie dessen Drafts und letzte Snapshots in
einer `RepeatableRead`-Transaktion. `is_current`, Sichtbarkeit und terminaler
Run-Zustand sind keine Inhaltsfilter. Ein älterer Run derselben Frage wird nicht
mit dem maßgeblichen letzten Run vermischt. Historische Daten ohne jeglichen Run
verwenden ausschließlich runlose Drafts und den vorhandenen Inhaltsvergleich
`hasAnswerContentChanged` gegen eine leere Antwort; sie werden nicht als finale
Snapshots ausgegeben. Es findet weder Run-Reparatur noch Finalisierung beim Lesen statt.

Die Projektion `resolveAnswerProgress` verwendet den gemeinsamen
`draftInputFromStored`-Adapter, den gespeicherten Contract und
`selectEffectiveLiveSubmissions` für die letzte Submission-Version. Mengen von
`quiz_team_session_id` verhindern Doppelzählungen. Nur Sessions dieses Quiz zählen;
deren bestehende Anzahl bildet den Nenner. Ein weiterer Online-/Aktivitätsbegriff
wird nicht eingeführt. Globale Teamidentität und AP1-Reset bleiben unverändert.

Eingabe: autorisierte Quiz-ID und relevante Frage-ID oder null.
Ausgabe: angemeldete Teams, eingegangene und finale Antworten, Prozent, letzter
Inhaltszeitpunkt. Ohne Frage: Teamzahl und 0 Antworten; dies ist kein Quizgesamtzähler.
Die aktuelle Frage folgt derselben Slide-Sequenz wie die Moderation, einschließlich
Frage-, Funny- und Lösungsphase. Initiales Server-Rendering und Polling verwenden
denselben Leser. Ein verspäteter Poll aus einem verlassenen Frage-/Durchlaufkontext
wird verworfen. Die Effect-Abhängigkeit ist die primitive Frage-ID, nicht das
bei Rendern neu erzeugbare Slide-Objekt: sonst können gültige Poll-Ergebnisse
fortlaufend verworfen werden. Bestehender Takt: 1,5 Sekunden, ohne überlappende Requests je Effect;
Fehler werden beim nächsten Poll wiederholt. Keine zusätzliche Cache-Schicht.

| Ereignis | Zähler und Persistenz |
| --- | --- |
| Feld nur geöffnet / leerer Draft | 0; Fokus und lokaler Text zählen nicht |
| Nichtleerer Autosave | Team zählt einmal nach erfolgreicher Persistenz und nächstem Poll |
| Wiederholte Bearbeitung | Aktueller Inhalt ersetzt Draft; Team weiterhin höchstens einmal |
| Draft geleert, keine finale Abgabe | Team zählt nicht mehr |
| Draft geleert, finale Abgabe vorhanden | Finale Abgabe zählt weiterhin; sie wird auch in der Auswertung nicht gelöscht |
| Team-/Moderator-Reload, zweites Fenster | Gleiche persistierte Quelle; kein Inhaltsverlust und keine Finalisierung |
| Ausblenden / Einblenden / Rücknavigation | Inhalt und Run bleiben erhalten; Zählung folgt der ausgewählten Frage |
| Run-/Blockschließen | Bestehende Finalisierung bleibt zuständig; nichtleere Drafts werden finale Snapshots |
| STOPPED | AP1 schließt/finalisiert; Antworten der beibehaltenen Frage bleiben gezählt |
| RESET | AP1 entfernt Sessions/Runs/Antworten; Zähler und Nenner sind 0 |

## Invarianten und ausführbare Regressionen

| ID | Vertrag | Regression in `answerProgress.test.ts` |
| --- | --- | --- |
| SUB-INV-01 | Ohne relevante gespeicherte Eingabe keine Antwort | D, Choice |
| SUB-INV-02 | Team pro Frage maximal einmal | B, C/L |
| SUB-INV-03 | Draft-Updates erhöhen nicht mehrfach | C/L |
| SUB-INV-04 | Team-Reload erhält Zähler | E/F |
| SUB-INV-05 | Moderations-Reload erhält Zähler | E/F, Serverpage-Guard |
| SUB-INV-06 | Schließen entwertet keine Submission | G/H/J |
| SUB-INV-07 | Wiederöffnen zählt nicht doppelt | G/H/J |
| SUB-INV-08 | Rücknavigation löscht keine Antwort | I und AP1-Regressionen |
| SUB-INV-09 | STOPPED erhält Durchlaufantworten | G/H/J und AP1-Regressionen |
| SUB-INV-10 | RESET ergibt 0 | K und AP1-Regressionen |
| SUB-INV-11 | Formular und Moderation verwenden gemeinsame Inhaltssemantik | Contract- und Architekturtests |
| SUB-INV-12 | Anzeige/Polling schreibt keine Antwort | E/F, Read-only-Guard |

Die Projektionsfälle sind Unit-Tests mit gespeicherten Datensätzen; sie ersetzen
nicht den realen Browser-/DB-Nachweis. Die bestehende Interaction-Architekturprüfung
prüft nun zentrale Projektion und Team-Menge statt der bisherigen SQL-`distinct`-
Implementierung. Bewertungs-, Ordering-, Pixel- und Public-Live-Result-Tests bleiben
unverändert. `npm test` führt zusätzlich die Payload- und AP1-Regressionstests aus.

## Grenzen und Abnahme

AP3 ergänzt [Pixel-Stufenmetadaten](pixel-question.md) am vorhandenen Draft.
Grenz-Snapshots sind keine finalen Submissions und verändern diese Zählregeln nicht.

Keine Migration, neue Dependency, neue Submission-Engine oder neues Realtime-System.
Content-Umfragen bleiben bei `live_poll_responses`; Pixel-Schreib-/Stopregeln und
alle Bewertungsverfahren bleiben unverändert. Ungültige persistierte Contracts oder
Payloads werden von der bestehenden Validierung abgewiesen und nicht als gültige
Antworten interpretiert; eine Datenreparatur gehört nicht in diesen Leser.

Preview-Abnahme mit einem eigenen Quiz und mindestens drei Teams:
0 → 1 → 2 → 3, Änderung bleibt 3, Reload beider Ansichten, zwei Moderationsfenster,
Aus-/Einblenden, Vor-/Zurücknavigation, Blockclose, Stop und bestätigter Reset.
Ergebnisse und Qualitätsnachweise: [AP2-Bericht](../reports/ap2-submission-consistency.md).

## AP4: Bewertung und Ergebnisaktualisierung

[Bewertungsworkflow](evaluation-workflow.md) definiert Persistenz, Konkurrenzschutz
und automatische Ergebnisaktualisierung unter Erhaltung dieses Vertrags.
