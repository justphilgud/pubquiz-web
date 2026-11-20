# Bewertungs- und Ergebnisworkflow (AP4)

## AP5-Anwendungsergänzung 20.11.2026

Die historische Analyse unten bleibt als fester Befund erhalten. Die nun beauftragte
Anwendungsverbesserung liegt ausschließlich in der Antwortprüfung, getrennt von
Quiz-Ampeln und deren Modus. Keine neue Persistenz, Migration oder Abhängigkeit.

- Bestehende Bereichs-, Team-, Offen-/Falsch- und Unbeantwortet-Filter bleiben erhalten.
  Zusätzlich wählbar: „Noch zu prüfen“ (gespielt, wirksame Antwort, REVIEW_REQUIRED,
  nicht MANUAL, nicht ausstehende Berechnung) und das Ausblenden automatisch eindeutig
  falscher geschlossener Antworten. Bereits manuelle Entscheidungen werden dadurch
  nicht als eindeutiger automatischer Fall versteckt.
- Meme-/Ordering-Zuweisungen sind unabhängig von Aliasnamen keine normalen Fälle
  dieser Prüfliste. Matrix, Punkte, Voting und Ordering-Auswertung bleiben unverändert.
- `manualReviewHints.ts` ist eine reine, schreibfreie Hinweislogik. Sie verarbeitet
  nur den bereits autorisierten Readmodel-Stand, nie neue Drafts anstelle finaler
  Submission-Snapshots. Der Leser ergänzt rohe strukturierte Feldtexte und ihre
  bereits freigegebenen kanonischen Lösungen aus den schon geladenen Daten.
- Gleiche Feldtexte werden innerhalb derselben Zuweisung und derselben Feld-ID
  markiert; Unicode-Normalisierung, Leerraum und Groß-/Kleinschreibung einschließlich
  deutschem ß/SS sind für diesen Vergleich unerheblich. Originaltexte bleiben erhalten.
  Zähler und Vergleichsgruppen beziehen sich auf den aktuellen Filter, nicht auf
  unsichtbare Teamantworten. Keine Gleichsetzung unterschiedlicher Fragekontexte.
- Sehr ähnliche Texte bedeuten genau eine Zeichenersetzung, -einfügung oder -löschung
  nach Normalisierung, z. B. ein doppelter Buchstabe. Hinweise vergleichen sowohl
  Teamtexte untereinander als auch akzeptierte Lösungen. Keine automatische Annahme
  weiterer Schreibvarianten in der Bewertungsengine.
- FaceMorph mit genau zwei strukturierten Feldern erhält einen Hinweis, wenn ein
  Feld zur Lösung der anderen Person passt und nicht zur eigenen. Zwei Gegenmatches
  markieren eine mögliche Vertauschung. Mehrdeutige eigene/andere Lösungen werden
  nicht als Vertauschung behauptet; flache Legacytexte werden nicht in A/B geraten.
- Hinweise schreiben weder Bewertung noch Punkte, Antworttexte, Submissions oder
  akzeptierte Lösungen. Die bestehenden Einzelaktionen samt Revision/Quiz-Lock und
  zentraler Punkteprojektion bleiben die einzige bewusste Bewertungsmöglichkeit.

Die Darstellung bleibt kompakt: Aufklappbare Hinweise zeigen in der Zusammenfassung
die Hinweisarten und die Zahl gleicher sichtbarer Feldtexte. Die Tabelle scrollt
auf schmalen Geräten intern horizontal und ist als fokussierbare Region erreichbar.
Dadurch werden Bewertungsaktionen nicht mehr durch den bisherigen Overflow-Container
abgeschnitten; kein Wechsel zu einem separaten Bewertungsworkflow.

Grenzen: Ähnlichkeit ist ein Prüfhinweis, kein Beweis. Numerische/Länder-, Pixel-,
Paare-, Meme-, Ordering- und Umfragefälle bekommen keine unscharfen Freitexthinweise.
Verglichen werden Texte mit Buchstaben von 3 bis 512 Unicodezeichen. Maximal 5000
Paarvergleiche je Frage/Feld und vier Hinweise pro Zeile begrenzen die Darstellung;
fehlende Hinweise bedeuten keine bestätigte Richtigkeit. Keine Sammelbewertung und
keine garantierte historische Zeit-/Klickersparnis. Die bisherigen Scorer und ihre
Schreibweisenormalisierung werden durch die Ergänzung nicht verändert.

Tests: `manualReviewHints.test.ts`, bestehende Filter-/Workflow-/Scorer-/Submission-
Regressionen und `quizPlanning.browser.test.ts` mit echter Antwortprüfungs-Komponente,
Filterwechsel, FaceMorph-/Ähnlichkeitshinweisen und null ausgelösten Schreibaktionen.
Neuanlage/Bearbeiten des Fragetextes mit reiner Vorlesedauer wird separat geprüft.
Gehostete Abnahme und bekannte Grenzen: [AP5-Anwendungsbericht](../reports/ap5-review-improvements.md).

## LOVD November AP5 · historische manuelle Auswertung

Der [Analysebericht](../reports/lovd-november-ap5.md) untersucht Quiz 37 mit zwölf
Teams anhand eines festen Aggregatstands vom 19.11.2026. Er verändert keine
Bewertungs-, Filter-, Submission- oder Lifecycle-Regel. `manualReviewAnalysis.ts`
ist reine Auswertung anonymisierter Summen. Answer-Mode-Resolver und bestehende
Filter bleiben die Definition der Sichtbarkeit. `REVIEW_REQUIRED` ohne manuelle
Quelle, bereits manuell entschiedene Fälle und unvollständige Bewertung sind getrennt.
Sichtbarkeit im Filter „nur falsche Antworten“ bedeutet nicht manuellen Restbedarf.

Die SQL-Analyse liest pro Antwort ausschließlich die höchste Submission desselben
Runs und bei fehlendem Run den bestehenden Legacy-Inhalt. Neuere Drafts ersetzen
keinen finalen Snapshot. Die Abfrage gibt nur Frageaggregate und Gruppengrößen aus;
Antworttexte, Teamdaten, individuelle Scores und Equality-Schlüssel bleiben in SQL.
Ein SELECT verwendet einen konsistenten Statement-Snapshot. Keine Deadline-
Finalisierung, Rekalkulation oder Backfillaktion darf für diese Analyse aufgerufen werden.

Identität meint ganze TEXT-/STRUCTURED_TEXT-Inhalte je konkreter Zuweisung, ohne
Schreibweisenormalisierung. Strukturierte Feld-IDs gehören zum Schlüssel. Gruppen
mit widersprüchlichen gespeicherten Entscheidungen erzeugen keine Einsparung.
Pixel-, Risiko-, Zahlen- und Länderfälle sind kein allgemeines Freitextpotenzial.
Eine Ersparnis ist `max(0, Gruppengröße − 1)`, getrennt für sichtbare, belegte
manuelle und heute noch offene Fälle. Historische Klickzahlen sind nicht gespeichert.

Der feste Bericht `/berichte/lovd-november-ap5` nutzt `requireAdmin`, die gespeicherte
Aggregatdatei und den reinen Analysator. Er lädt keine Produktionsdaten nach und
bietet keine Bewertungsaktion. Normale Auswertung bleibt unverändert zuständig für
alle Schreibaktionen. Empfehlungen sind geplant, insbesondere kein implementierter
Sammelbewertungs- oder neuer Filtervertrag.

Regressionen: `manualReviewAnalysis.test.ts`, bestehende Filter-/Readmodel-/Submission-
Tests und `scripts/analysis/lovd-manual-review.integration.test.ts`. Letzterer läuft
auf einer isolierten synthetischen PostgreSQL-Fixture mit vollständigem Rollback
und ist im CI-PostgreSQL-Job verdrahtet. Aggregatmetadaten und Browserabnahme stehen
im Bericht. Keine Migration oder zusätzliche Projektabhängigkeit.

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

## Template-Punktehilfe und 8-Bit (14. November 2026)

Der Template-Picker zeigt die Regel vor der Auswahl und am gewählten Template.
Ein Link öffnet `/hilfe?topic=punkte` in einem neuen Tab, damit ein ungespeicherter
Entwurf erhalten bleibt. Die vorhandene rollenabhängige Hilfe erlaubt den Zugriff
für Editoren und Eventmanager einschließlich Eventreihenrollen sowie Admins.
`questionScoringGuide.ts` liefert beide Anzeigetexte; `QuestionScoringOverview`
ist reine Darstellung ohne eigene Berechnung, Datenbankabfrage oder Mutation.
Eigene Vorlagen lösen ihren `baseTemplateId` auf, einschließlich `null` für Standard.

Explizite fachliche Änderung: 8-Bit hat insgesamt 1 Basispunkt statt 0,5 pro
Titelfeld. Policy und Evaluator verwenden dasselbe Maximum. Ein einzelnes
korrektes Titelfeld ergibt 1; historische mehrteilige Fragen verteilen diesen
Punkt gleichmäßig. Alias-IDs gelten identisch. Freitext-Altfälle bleiben binär.
Expertenbonus verdoppelt das Ergebnis; mehrere Felder sperren weiterhin Risiko.
Andere strukturierte Templates behalten 0,5 pro Feld. Keine Medien-, Antwort-,
Submission-, Präsentations- oder Moderationsnavigation wird geändert.

Die Datenmigration aktualisiert ausschließlich das Maximum von 8-Bit-Zuweisungen
in noch nicht gestarteten Quizzen ohne Runs oder Teamantworten. Sie schreibt keine
Teamwertung und keine Lösung. Bereits gespeicherte Spielergebnisse werden nicht
automatisch neu bewertet; die Engine-Version wird nicht global erhöht. Eine später
bewusst ausgelöste Neuberechnung nutzt die neue Regel und schützt wie bisher
manuelle Overrides. Bei laufenden Quizzen deshalb erst nach dem Spiel ausrollen.

Nachweise: `eightBitScoring.test.ts`, bestehende `evaluateBaseAnswer.test.ts`,
`questionScoringGuide.test.tsx` und `helpContent.test.ts`.
`eightBitMigration.integration.test.ts` prüft in einem zurückgerollten lokalen
PostgreSQL-Schema Alias-IDs, Idempotenz und den Schutz laufender/gespielter Quizze;
der bestehende PostgreSQL-CI-Job führt ihn aus. Die Hilfe beschreibt auch
den Meme-Votingsiegerpunkt, Pixel-Challenge, Risiko und abweichende Musikfeldanzahl.

Die eigene Vorlage „8bit“ bleibt für Redaktion, Medien und Antwortinteraktion
eine Musikvorlage. Ihr Vorlagensnapshot setzt `scoringTemplateId` auf `eight_bit`.
Der Editor verwendet damit den 8-Bit-Regeltext. Neue Quizzuweisungen speichern
einen Basispunkt. Bei vorhandenen Zuweisungen bestimmt das gespeicherte Maximum,
ob die 8-Bit-Regel gilt oder die bisherige Musikbewertung weiterverwendet wird.

Die Folgemigration aktualisiert ausschließlich die Zuweisungen #466, #469 und
#470, sofern sie weiterhin zu den geprüften Fragen und zur eigenen Vorlage
gehören. Das Quiz muss in Vorbereitung sein und die konkrete Frage darf weder
einen Interaktionslauf noch Teamantworten haben. Testläufe anderer Fragen im
selben Quiz schließen die Zuweisung nicht aus. Die Migration sperrt die betroffenen
Quizze gegen gleichzeitigen Start und schreibt ausschließlich den Vorlagensnapshot
und das Basismaximum der berechtigten Zuweisungen. Der PostgreSQL-Test prüft die
Auswahl, den Schutz von Spielergebnissen und die Wiederholbarkeit.
