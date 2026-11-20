# AP5-Anwendung: schnellere manuelle Antwortprüfung

Basis: main `e456764a` mit gemergtem PR #172. Historischer Befund unverändert:
112 manuelle Bewertungen, ein offener Prüffall, sechs konservativ vermeidbare
Freitext-Einzelentscheidungen (6,8 %), zwei Länderfälle zusätzlich; historische
Klickzahlen unbekannt. Dieser Auftrag verbessert die Anwendung statt die
Aggregation erneut auszuführen. Keine Production-Daten wurden dafür nachgeladen.

## Fachlich getrennte Umsetzung

Die Antwortprüfung nutzt `manualReviewHints.ts` und die kleine Darstellung
`ManualReviewHintList.tsx`. Sie importiert keine Quiz-Ampelregeln und hängt nicht
vom Quizmodus ab. Der bestehende autorisierte Readmodel-Leser liefert zusätzlich
Feld-IDs, wirksame finale Feldtexte und akzeptierte Lösungen aus bereits geladenen
Daten. Neue Drafts überschreiben keine wirksamen Submission-Snapshots.

Bestehende Filter bleiben erhalten. „Noch zu prüfen“ trennt echte unbehandelte
REVIEW_REQUIRED-Fälle von bereits manuell entschiedenen und ausstehenden
Berechnungen. Eine weitere Option blendet eindeutig automatisch falsche
geschlossene Antworten aus. Meme- und Ordering-Fragen erscheinen nicht in dieser
gewöhnlichen Prüfliste; Matrix und bestehende Wertungen bleiben unverändert.

Gleiche Texte werden ohne Groß-/Kleinschreibung markiert, einschließlich ß/SS.
Sehr ähnliche Texte mit einer Zeichenersetzung/-einfügung/-löschung erhalten
Prüfhinweise: ein abweichender oder verdoppelter Buchstabe. Verglichen werden
sichtbare Teamantworten je Zuweisung/Feld sowie akzeptierte Lösungen. FaceMorph
erkennt mögliche Gegenmatches der zwei kanonischen Felder und weist auf teilweise
oder vollständig vertauschte Personen hin; mehrdeutige Matches werden nicht geraten.

**Keine automatische Bewertung:** Hinweise und Filter schreiben keine Punkte,
Antworten, Status, akzeptierten Lösungen oder Submissions. Einzelentscheidungen
verwenden weiter dieselben Actions mit Revision/Quiz-Lock. Keine Sammelbewertung.

## Prüfungen und Grenzen

76 gezielte Tests erfolgreich, einschließlich bestehender Scorer-, Submission-,
Filter- und Workflow-Verträge. Browserregression mit echter Antwortprüfungs-
Komponente: Case-Gruppen, Tippfehler, FaceMorph, Ausschluss Meme/Ordering,
Filterwechsel und null durch Hinweise/Filter ausgelöste Bewertungsaktionen.
Typecheck und geändertes ESLint erfolgreich. Die separate allgemeine Vorlesedauer
und bestehende Übersetzungsdauer sind im gemeinsamen Browserpaket geprüft.
Ein unveränderter Such-Browsertest hatte parallel einmal einen Timingfehler;
beide Browsertests bestanden einzeln. Vollständige CI wird vor Übergabe abgewartet.

Hinweise sind keine Beweise. Numerische/Länder-, Pixel-, Paare-, Umfrage- und
Spezialwertungen erhalten keine unscharfen Freitexthinweise. Nahe Texte brauchen
3–512 Unicodezeichen und Buchstaben; maximal 5000 Vergleiche je Frage/Feld, maximal
vier Hinweise je Zeile. Die Zahl identischer sichtbarer Antworten ist keine
historische Klickersparnis. Flache FaceMorph-Legacytexte ohne zwei Feld-IDs werden
nicht als A/B interpretiert. Fehlende Hinweise bedeuten keine bestätigte Richtigkeit.

## Gemeinsame Preview und technische Abnahme

[Antwortprüfung mit synthetischen Fällen](https://pubquiz-listjyww8-just-phil-gud.vercel.app/quiz/10/auswertung),
Deployment `dpl_3L8XheZ3Pb33A9qhZibKa4fJMfHx`, Environment `preview`, Quellstand
`da2b9dd1b3c26f2c79093947340e5d87903e6106`, 20.11.2026. Die exakte
[Push-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/44706585403) und
[PR-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/44706591786) sind
vollständig grün, einschließlich Gesamt-/Browserregressionen. Der unveränderte
Such-Browsertest bestand auch in beiden vollständigen CI-Läufen.

Eigenes Quiz #10, drei eigene synthetische Teams, zwölf wirksame finale Antworten
und neuere abweichende Drafttexte. Die Testdaten enthielten zunächst drei falsch
aufgebaute MC-Snapshots (`optionId` statt `optionIds`); die bestehende Validierung
hat sie abgewiesen. Nur diese eigene Fixture wurde korrigiert, keine Schutzregel.

| Gehostete Prüfung | Ergebnis |
|---|---|
| Case und Tippfehler | „Berlin“ / „BERLIN“ als gleicher Feldtext (2) markiert; „Berlinn“ als mögliche Schreib-/Lösungsvariante. Originaltexte erhalten. |
| FaceMorph | „Person A: Bob / Person B: Alice“ markiert mögliche Vertauschung gegenüber A=Alice/B=Bob; kanonisch passende Felder erhalten keinen Vertauschungshinweis. |
| Arbeitsvorrat | 9 gewöhnliche Zeilen; 6 nach Ausblenden der drei automatisch falschen geschlossenen Antworten; 3 nach „Noch zu prüfen“ im Stand nach den bewusst gespeicherten Entscheidungen. |
| Spezialfragen | Meme und Ordering nicht in der gewöhnlichen Prüfliste, aber beide weiterhin in „Team × Frage“ vorhanden. |
| Finale Daten statt Draft | Abweichender neuerer Drafttext erscheint weder als Antwort noch als Vergleichshinweis. |
| Keine Schreibwirkung der Hinweise | Vor und nach Lesen, Aufklappen, Filter-/Tabwechsel identischer SHA-256-Fingerabdruck der zwölf Antworten inklusive Wertung, ihrer Submissions und Runs: `d5cd3211ec63d51659b754a3fb6b4a20a29dbaac904c4d054d3274b7dc4178fa`. |
| Bewusste Einzelbewertung | Anschließend zehn explizite Richtig/Falsch-Entscheidungen im finalen Deployment; Werte 1/0 bestätigt, Route bleibt `/quiz/10/auswertung`. Reload bestätigt den gespeicherten manuellen Zustand. |
| Desktop und Mobil | 1366×768 kompakte aufklappbare Hinweise. 390×844 ohne Seitenüberlauf; Tabelle intern scrollbar bis zu den Bewertungsbuttons. |

Die Schreibphase wurde ausdrücklich vom vorherigen schreibfreien Fingerabdrucktest
getrennt. Nach bewusster Einzelbewertung greift wie zuvor die zentrale Auswertung
mit ihren Punkteprojektionen; die Screenshots zeigen diesen gespeicherten Stand.
Sie sind kein Beleg für eine automatische Punktevergabe durch Ähnlichkeitshinweise.

Bildnachweise: [kompakte Übersicht](assets/ap5-review-improvements/ap5-hints-final-1366.png),
[FaceMorph-Details](assets/ap5-review-improvements/ap5-hints-final-face-1366.png),
[mobile Antwort- und Bewertungsansicht](assets/ap5-review-improvements/ap5-hints-final-390.png).
[Zehn gespeicherte Testentscheidungen](assets/ap5-review-improvements/rating-walk.json).

Die technische Abnahme ist erfolgreich, keine offenen technischen Fehler.
Bekannte fachliche Grenzen stehen oben; insbesondere keine Sammelbewertung und
keine automatische Korrektur. Die Ampelregeln stehen getrennt in
[Quiz-Ampeln](../architecture/quiz-balance.md), der gemeinsame Release-Nachweis im
[Previewbericht](quiz-ampeln-vorlesedauer.md). Kein Merge, Production-Backup oder
Production-Deployment. Die gemeinsame fachliche Abnahme bleibt ausstehend.
