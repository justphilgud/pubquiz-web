# Bewertungs- und Ergebnisworkflow (AP4)

## Zweck und Zuständigkeit

Eine wirksame finale Antwort wird bewertet, die Bewertung atomar gespeichert und
in Auswertung, Matrix, Team-Gesamtsumme und sichtbaren Ergebnisfolien dargestellt.
Die fachliche Wahrheit liegt in `team_antworten`: automatische Basis-/Endpunkte,
vergebene Punkte, Status, Quelle und manuelle Entscheidung. Der bestehende zentrale
Evaluator berechnet weiterhin offene, strukturierte, Ordering-, Risiko- und
Pixel-Antworten. AP4 führt weder Punktelogik noch eine zweite Bewertungsablage ein.

Verwandte Verträge: [Lifecycle](quiz-lifecycle.md),
[Submission-Live-State](submission-live-state.md),
[Answer Interaction](answer-interaction.md),
[Runtime-Verträge](quiz-runtime-contracts.md), [Pixel](pixel-question.md).

## Schreiben und Konkurrenz

Automatische Bewertung bleibt Teil der bestehenden Submission-/Finalisierungspfade.
Manuelle Bewertung autorisiert den Quizadministrator im Event-Kontext, sperrt die
Quizzeile und liest die Antwort einschließlich wirksamer Submission innerhalb
derselben Transaktion erneut. Die Sperrreihenfolge ist wie in AP1/AP2: Quiz zuerst.
Auch allein gestartete Rekalkulationen sperren das Quiz vor dem Lesen. Diese Sperre
schreibt keinen Präsentationsstatus und wechselt keinen Lifecycle-Zustand.

Der Client sendet den Fingerabdruck der angezeigten Antwort. Ein abweichender
persistierter Stand wird abgewiesen: Der Nutzer prüft die aktualisierte Antwort
und entscheidet erneut. Der Fingerabdruck umfasst Bewertung, manuelle Zeit,
Interaktionslauf und Draftrevision; er ist keine alleinige Zeitstempelprüfung.
Automatische Änderungen ohne `bewertet_am` werden ebenfalls erkannt.

Die Entscheidung ersetzt Werte; sie addiert keine Punkte. Der zentrale Evaluator
projiziert abhängige Teamwerte und die betroffenen Statistiken in derselben
Transaktion. Sein vorhandener Schutz manueller Overrides bleibt erhalten.
Der zusätzliche globale Statistikaufruf entfällt: Er verlangte die globale
Adminrolle und leitete Event-Manager nach bereits erfolgtem Commit auf `/fragen` um.

## Lesen und Aktualisieren

Die Auswertungsseite liest Antworten, Rangliste, Backfillstatus und Fingerabdruck
aus einem gemeinsamen Repeatable-Read-Snapshot. Die Matrix wird daraus abgeleitet.
Nach erfolgreicher Aktion invalidiert `revalidatePath` die Auswertungsroute;
`router.refresh()` übernimmt die neuen Server-Props ohne Vollreload.

Andere Auswertungsfenster prüfen alle zwei Sekunden nach abgeschlossenem Abruf
einen Inhaltsfingerabdruck. Er berücksichtigt individuelle Bewertungen, Teams,
Fragen und Interaktionsläufe, nicht nur Gesamtsumme oder neuesten Zeitstempel.
Nur ein abweichender Stand löst einen Router-Refresh aus.

Moderation und Präsentation lesen auf Ergebnisfolien ihre bestehenden Ergebnis-
und Jahreswertungsprojektionen wiederholt. Der anonyme Zwischenstand verwendet
weiter ausschließlich seinen bisherigen anonymen Leser. Abrufe überlappen nicht;
Antworten nach dem Verlassen einer Ansicht werden verworfen. Netzwerkfehler
behalten den letzten bestätigten Stand und werden beim nächsten Abruf erneut versucht.
Die übliche Verzögerung beträgt zwei Sekunden zuzüglich Server-/Netzlaufzeit.

## UI-Zustand und Fehler

Aktueller Tab, Filter, Teamidentität und Matrixauswahl bleiben lokaler UI-Zustand.
Die geöffneten Matrixdetails werden anhand der Auswahl aus der aktuellen Matrix
abgeleitet; eine kopierte alte Zelle ist nicht die Anzeigequelle. Next erhält
unveränderte Client-Komponenten und deren Scrollzustand beim Refresh.

Bewertungsbuttons besitzen `type="button"`. Eine synchrone Client-Sperre und die
React-Transition verhindern Mehrfachaktionen während Speichern und Aktualisieren.
Es gibt keine optimistischen Punkte. Fehler werden in derselben Ansicht angezeigt;
Validierungs-/Berechtigungs-/Konfliktfehler speichern nichts. Ein verlorener
Netzwerk-Response kann einen bereits erfolgten Commit nicht rückgängig machen;
der nächste Leseabruf stellt den tatsächlichen Zustand dar.

Bewertungen navigieren nicht automatisch zu einer anderen Seite, Frage, einem
anderen Team oder Slide. Nur bewusste Navigationsaktionen des Nutzers dürfen dies.

## Invarianten und Regressionen

| Invariante | Vertrag | Nachweis |
|---|---|---|
| SCORE-INV-01 | Erfolgreiche Entscheidung einmal persistieren | Revisionsprüfung unter Quiz-Sperre; Browser |
| SCORE-INV-02 | Anzeige ohne manuellen Reload aktualisieren | Pollingtests; Browser A–E/K/L |
| SCORE-INV-03 | Route bleibt erhalten | Kein Redirect/globaler Adminaufruf; Browser G–K |
| SCORE-INV-04 | Frage-/Team-Auswahl bleibt erhalten | Stabile Teamidentität und Matrixauswahl; Browser |
| SCORE-INV-05 | Kein Lifecycle-Wechsel | Schreibgrenzen-Test; AP1-Regressionen |
| SCORE-INV-06 | Keine Submission-Inhalte verändern | Schreibgrenzen-Test; AP2-Regressionen |
| SCORE-INV-07 | Punkte und Matrix aus derselben Persistenz | Snapshot-Test; bestehende Bewertungs-/Matrixtests; Browser |
| SCORE-INV-08 | Doppelklick vergibt keine doppelten Punkte | Client-Sperre, Revisionsprüfung; Browser |
| SCORE-INV-09 | Fehler erfinden keinen fachlichen Zustand | Fehler-/Retrytest; Browser ungültige Punkte |
| SCORE-INV-10 | Reload entspricht aktualisiertem Stand | Persistenzbasierte Leser; Browser F |
| SCORE-INV-11 | Aufeinanderfolgende Bewertungen konsistent | Zehn Revisionswechsel; Browser H |
| SCORE-INV-12 | Ergebnislesen erzeugt weder Submission noch Run | Lesegrenzen-Test; bestehende AP2-Verträge |

`evaluationWorkflow.test.ts` prüft Revisionen, Konkurrenzschutz, Abrufreihenfolge,
Fehler und Entsorgung sowie die Verdrahtung der Schreib-/Lesegrenzen. Die bestehende
Suite prüft die fachlichen Scorer einschließlich automatischer/manueller Overrides,
Ordering, strukturierter Antworten, Pixel Challenge und Stufenwertung. Reale
Server-Persistenz und Browsernavigation müssen zusätzlich auf Preview mit eigenem
Testquiz, drei Teams und mindestens zehn Bewertungsaktionen abgenommen werden.

Schema und Migration bleiben unverändert. Reset, Antwortzähler, Draft/Final,
Frage aus-/einblenden, Blockclose und Lifecycle werden nicht neu modelliert.
