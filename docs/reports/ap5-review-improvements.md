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

Gemeinsame Preview, gehostete Testfälle, Bildnachweise und abschließende CI werden
nach erfolgreicher exakter CI ergänzt. Die Ampelregeln stehen getrennt in
[Quiz-Ampeln](../architecture/quiz-balance.md), der gemeinsame Release-Nachweis im
[Previewbericht](quiz-ampeln-vorlesedauer.md). Kein Merge, Production-Backup oder
Production-Deployment. Die gemeinsame fachliche Abnahme bleibt ausstehend.
