# Quiz Runtime Contracts

Stand: 21. August 2026

Dieses Dokument ist die verbindliche fachliche Spezifikation für den laufenden
Quizbetrieb. Es beschreibt den implementierten Stand und keine alternative
Zielarchitektur. Änderungen an Ordering, Präsentationsablauf, Interactions,
Submissions, Auswertung, Spezialfragen, Kalender-Abonnements oder
Eventreihen-Sichtbarkeit müssen diese Invarianten und die zugeordneten
Regressionstests erhalten.

## Grundregel: semantische Datenrollen bleiben getrennt

Das System unterscheidet insbesondere:

- kanonische Inhaltsdaten einer Frage, einschließlich der richtigen Lösung;
- quizspezifische Zuweisungsdaten wie Teilnehmerreihenfolge und Overrides;
- Runtime-Zustände wie Interaction Run, Draft und Submission;
- Evaluation als eigener Zustand nach einer Submission;
- Präsentations- und Medienkontext, der keine Lösung wird, nur weil er
  verfügbar ist;
- Design-/Theme-Daten, die keine Quizlogik implementieren.

UI-Zustand ist keine persistierte Wahrheit. Maßgeblich sind die jeweils unten
genannten Datenquellen und serverseitigen Verträge.

## Ordering Contract

### Kanonische und quizspezifische Reihenfolge

Die Frage besitzt die kanonische Lösungsreihenfolge. Sie steuert Editor,
Bewertung, Auflösung und Soll-Lösung der Auswertung. Die davon getrennte
Teilnehmerreihenfolge liegt pro Quizzuweisung in
`quiz_fragen.antwort_reihenfolge` und besteht aus stabilen numerischen
Datenbank-`antwort_id`s.

Für eine Ordering-Frage mit mindestens zwei unterschiedlichen Elementen gilt:

```text
participantInitialOrder
  == persistedQuizQuestionOrder
  == presentationInitialOrder
  == answerFormInitialOrder

participantInitialOrder != canonicalSolutionOrder
resolutionOrder == canonicalSolutionOrder
```

Die persistierte Teilnehmerreihenfolge ist für alle Teams gleich und bleibt bei
Reload oder erneutem Quizstart stabil. Präsentation und Antwortformular lösen
dieselben IDs auf sichtbare Labels auf. Die Auflösung verwendet dagegen nie die
Teilnehmerreihenfolge.

### Reparatur und Legacy-Daten

- Eine gültige, nicht kanonische ID-Permutation wird unverändert verwendet.
- Eine eindeutig erkennbare Legacy-Index-Permutation wird auf Antwort-IDs
  normalisiert.
- Ein fehlender, beschädigter oder kanonischer Teilnehmerwert wird einmalig
  durch eine nicht kanonische ID-Permutation ersetzt und per Compare-and-swap
  persistiert.
- Ein ungültiger Teilnehmerwert darf niemals still auf die richtige Lösung
  zurückfallen.
- Ordering-Submissions dürfen intern serialisierte IDs enthalten. Vor jeder
  Darstellung in der Auswertung werden sie auf Labels abgebildet; Roh-IDs,
  UUIDs oder JSON sind keine Benutzeroberfläche.

### Ausführbare Spezifikation

| Testdatei | Geschützte Invariante |
| --- | --- |
| `app/quiz/orderingQuestionOrder.test.ts` | Persistenz, gemeinsame Reihenfolge aller Consumer, Nicht-Lösungs-Fallback, Legacy-Normalisierung, einmalige Reparatur und Labeldarstellung. |
| `app/quiz/answerInteraction.test.ts` | Das Antwortformular übernimmt die gespeicherten Ordering-Identitäten in den ausführbaren Interaction Contract. |
| `app/quiz/evaluation/evaluateBaseAnswer.test.ts` | Bewertung vergleicht die abgegebene Reihenfolge positionsweise mit der kanonischen Lösung und behandelt ungültige Payloads kontrolliert. |
| `app/fragen/editor/templates/questionTemplatePhaseOne.test.ts` | Die kanonische Template-Reihenfolge bleibt die Grundlage der strukturierten Ordering-Lösung. |

## Block Lifecycle Contract

`resolveQuizBlockSequence` bestimmt die inhaltliche Frage-/Auflösungsstrategie.
`buildPraesentationSlides` setzt diese Sequenz gemeinsam mit den konkreten
Round-End-Elementen in Slides um. Sortierung und Runtime-Finalisierung sind
getrennte Verantwortlichkeiten.

### Gesammelte Auflösung (`END_OF_BLOCK`)

```text
Fragen des Blocks
→ Countdown
→ Countdown erreicht 0
→ Block und offene Interactions schließen/finalisieren
→ gesammelte Auflösungen
→ nächster Block
```

Beispiel:

```text
Q1 → Q2 → Q3 → COUNTDOWN → S1 → S2 → S3
```

Der Countdown gehört zum konkreten Block und darf weder hinter dessen
Auflösungen noch in einen Nachbarblock wandern.

### Direkte Auflösung (`AFTER_EACH_QUESTION`)

Der bestehende Direktmodus bleibt separat:

```text
Q1 → S1 → Q2 → S2 → ... → COUNTDOWN
```

Nur bei `END_OF_BLOCK` wird ein `ROUND_END`-Countdown vor die gesammelten
Auflösungen gezogen.

### Ablauf bei Countdown-Ende

Bei `0` stößt die Moderation Blockschließung und Countdown-Ende an.
`schliesseQuizBlock` persistiert den geschlossenen Block und schließt danach die
zugehörigen offenen Interactions transaktional. Inhaltlich gefüllte aktuelle
Draft-Revisionen werden als Submission finalisiert und die Bewertung wird
angestoßen. Beim Eintritt in die erste gesammelte Auflösung wird die
Blockfinalisierung zusätzlich vor dem Presentation-Interaction-Sync
sichergestellt. Erst die anschließende Navigation zeigt die Auflösungsphase.

### Ausführbare Spezifikation

| Testdatei | Geschützte Invariante |
| --- | --- |
| `app/quiz/flow/quizBlockSequence.test.ts` | Effektive Strategie, kanonische Fragenidentitäten sowie unmittelbare und gesammelte Auflösungssequenzen. |
| `app/quiz/[quizId]/praesentation/buildPraesentationSlides.test.ts` | Countdown vor gesammelten Auflösungen, Blockzugehörigkeit und unveränderter Direktmodus. |
| `app/quiz/interaction/interactionArchitecture.test.ts` | Blockschließung finalisiert freigegebene Fragen; die erste gesammelte Auflösung schließt vor dem Runtime-Sync. |
| `app/quiz/interaction/interactionStateMachine.test.ts` | Zulässige Run-Übergänge und die serverseitige Deadline als Schreibgrenze. |
| `app/quiz/interaction/interactionSubmissionPolicy.test.ts` | Nur inhaltlich gefüllte, noch nicht finalisierte Draft-Revisionen werden beim Schließen auto-finalisiert. |

## Evaluation Contract

### Submission ist nicht Evaluation

Eine Submission belegt, dass ein Team eine Antwort abgegeben hat. Die
Evaluation beschreibt deren Bewertungsstand. Beide Zustände dürfen nicht
gleichgesetzt werden.

| Zustand | Darstellung |
| --- | --- |
| Effektive Submission vorhanden, Evaluation fehlt oder ist unvollständig | Antwort sichtbar, Status `PENDING`, nicht unbeantwortet; Punkte gegebenenfalls vorläufig. |
| Keine effektive Submission | Status `UNANSWERED`. |
| Submission und vollständige Evaluation | Persistierter Bewertungsstatus und vergebene Punkte. |

### Quizweite Sicht und Filter

Die Auswertung ist kumulativ über das ganze Quiz. Ergebnisse aus früheren
Blöcken bleiben nach späteren Blöcken vorhanden. Die Standardansicht startet
mit allen Teams, Fragen und Antworten; es ist kein versteckter Filter aktiv.
Filter wie „nur falsche Antworten“ sind explizite Benutzerentscheidungen und
verändern nur die Darstellung, niemals den zugrunde liegenden Evaluation-Stand.

### Backfill und Neuberechnung

„Berechnung fortsetzen“ verarbeitet in begrenzten, wiederaufnehmbaren Batches
tatsächlich unvollständige oder veraltete Bewertungen. Vorhandene Antworten und
Ergebnisse werden nicht aus der quizweiten Sicht entfernt. Persistierte
manuelle Overrides bleiben beim automatischen Recalculate erhalten; ältere
Engine-Versionen können über denselben Vollständigkeits- und Backfill-Mechanismus
neu berechnet werden.

### Ausführbare Spezifikation

| Testdatei | Geschützte Invariante |
| --- | --- |
| `app/quiz/evaluation/evaluationReadModel.test.ts` | `PENDING` mit Submission bleibt von `UNANSWERED` ohne Submission unterscheidbar. |
| `app/quiz/evaluation/evaluationMatrix.test.ts` | Pending-Antworten bleiben sichtbar; Statuszellen und Ranking werden aus demselben quizweiten Datenbestand aufgebaut. |
| `app/quiz/evaluation/evaluationAnswerFilter.test.ts` | Standardfilter erhält Antworten aller Blöcke und Teams; optionale Filter sind explizit. |
| `app/quiz/evaluation/evaluationMatrixDisplay.test.tsx` | Matrixfilter verändern nur die sichtbare Fragenmenge, nicht die Matrixdaten. |
| `app/quiz/evaluation/evaluationLifecycle.test.ts` | Persistierte Ergebnisse, vorläufiger Zustand, autorisierte Neuberechnung und Erhalt manueller Overrides. |
| `app/quiz/evaluation/evaluationBackfillPolicy.test.ts` | Begrenzte, wiederaufnehmbare und idempotente Backfill-Batches verarbeiten offene Bewertungen. |

## Contract für automatische offene Antworten

Die automatische Bewertung offener Antworten ist bewusst konservativ. Beide
Seiten werden ausschließlich so normalisiert:

```ts
value.trim().toLocaleLowerCase("de-DE")
```

Nur zwei nicht leere, danach exakt gleiche Werte werden automatisch als
`CORRECT` bewertet.

```text
7 == 7
Lösung A == lösUNG a
" Baby Got Back " == "baby got back"

7 != 7.0
Baby Got Back != Got Back
```

Es gibt keine Fuzzy-, Teilstring-, Levenshtein-, KI-, Semantik-, Synonym- oder
sonstige Toleranzlogik. Nicht exakte Fälle bleiben `REVIEW_REQUIRED`.

`app/quiz/evaluation/evaluateBaseAnswer.test.ts` schützt Normalisierung,
Nicht-Leerheit, exakte Übereinstimmung, konservative Zahlenbehandlung und den
Review-Fallback.

## Spezialfragen-Contract

Spezialfragen unterscheiden sichtbaren Prompt, Medien-/TTS-Kontext und
kanonische Lösung. `QuestionTemplateRuntimeModel` darf diese semantischen Rollen
nicht aufgrund der bloßen Verfügbarkeit eines Felds vermischen.

### `uebersetzt_vorgelesen` / `TRANSLATION_READ_ALOUD`

| Rolle | Kanonische Quelle | Verwendung |
| --- | --- | --- |
| Sichtbarer Prompt | Fragetext | Fragephase. |
| Übersetzung | `template_config_json.templateData.translation` | Nicht sichtbare TTS-/Audio-Eingabe. |
| Produktives Audio | Medium im Slot `lyrics_tts_audio` | Wiedergabe in der Präsentation. |
| Kanonische Lösung | richtige `antworten.antwort` | Auflösung und Evaluation. |

Der Übersetzungstext wird nicht als sichtbare Fragezeile, Kontext, Subtitle oder
`solutionLine` gerendert. Die Auflösung zeigt ausschließlich die kanonische
Antwort, beispielsweise `Baby Got Back`. Die Evaluation vergleicht ebenfalls
mit den als richtig gepflegten Antworten.

### Ausführbare Spezifikation

| Testdatei | Geschützte Invariante |
| --- | --- |
| `app/fragen/editor/templates/questionTemplatePhaseOne.test.ts` | Übersetzung bleibt im TTS-Payload, während `solutionLines` nur die kanonische Antwort enthalten; andere Spezialtemplates bleiben unverändert. |
| `app/rendering/presentation/PresentationSlideRenderer.test.ts` | Übersetzungs- und Originaltext bleiben in Frage und Auflösung unsichtbar; Titel und vorbereitetes Audio bleiben verfügbar. |
| `app/quiz/evaluation/evaluateBaseAnswer.test.ts` | Der Songtitel, nicht der Übersetzungskontext, ist die bewertbare Lösung. |

Generelle Regel: Spezialfragen-Renderer verwenden semantische Runtime-Feldrollen
und interpretieren Kontextfelder niemals allein wegen ihrer Verfügbarkeit als
Lösung.

## Calendar Contract

„Kalender abonnieren“ bedeutet ein dauerhaftes Abonnement gegen einen stabilen
Feed und keinen einmaligen `.ics`-Download.

```text
Allgemein:  webcal://<host>/calendar/public.ics
Eventreihe: webcal://<host>/calendar/event-series/<id>.ics
```

Kalender-Outro, Antwortformular, Eventreihen-Detailseite und `/kalender`
verwenden die zentralen Builder aus `app/calendar/publicCalendar.ts`. Der
Legacy-Pfad `/calendar/subscribe` ist kein primärer Abonnementweg.

Ein späterer Abruf desselben Feeds enthält neu hinzugekommene oder geänderte
öffentliche Termine. Private, archivierte oder anderweitig nicht feedfähige
Inhalte bleiben ausgeschlossen. Der Feed antwortet als `text/calendar`.

Eine SSO-geschützte Preview kann externe Kalender-Synchronisation verhindern,
weil Kalender-Clients keine Browser-SSO-Session besitzen. Das ist eine
Preview-/Infrastruktureinschränkung und kein Bruch des `webcal:`-Contracts.

`app/eventreihen/eventCalendar.test.ts` schützt zentrale `webcal:`-URLs, alle
Entry Points, stabile Feed-Endpunkte, spätere Ergänzungen und Änderungen sowie
den Ausschluss nicht öffentlicher Eventreihen.

## Eventreihen-Sichtbarkeits-Contract

Eventreihen-Sichtbarkeit ist in beide Richtungen persistierbar:

```text
privat → öffentlich
öffentlich → privat
```

Die Servereingabe wird aus dem tatsächlich abgesendeten `FormData` aufgebaut.
Für die Checkbox gilt: vorhandener Wert `true`, fehlender Wert `false`. Ein
staler React-State aus einer Closure ist keine persistierte Quelle. Andere im
selben Submit geänderte Felder bleiben erhalten. Die gespeicherte Sichtbarkeit
steuert anschließend auch öffentliche Feeds.

| Testdatei | Geschützte Invariante |
| --- | --- |
| `app/eventreihen/eventSeriesWrite.test.ts` | Explizite Checkbox-Semantik, Persistenz in beide Richtungen, Reload und gemeinsames Speichern weiterer Felder. |
| `app/eventreihen/eventCalendar.test.ts` | Öffentliche Feeds reagieren auf die persistierte Sichtbarkeit und entfernen private Reihen. |

## Presentation Template Contract

### Teamidentität nach Audience und Phase

Rankingdaten dürfen die globale Teamidentität transportieren; der Renderer entscheidet anhand der Audience und der fachlichen Phase, ob sie sichtbar wird:

| Zustand | Öffentliche Präsentation | Moderationsansicht |
| --- | --- | --- |
| Zwischenstand | Rang und Punkte; kein Name, Foto oder Avatar | vollständige Teamidentität |
| Endstand / Siegerehrung | Teamname, Punkte und Foto oder Avatar | vollständige Teamidentität |
| bewusst gezeigte skurrile Antwort | Teamname, Antwort und Foto oder Avatar | Teamname, Antwort, Foto oder Avatar sowie Markierung |

Der Fallback auf einen Systemavatar ist stabil und template-neutral. Templates dürfen die Anordnung gestalten, aber nicht die Audience-Regel umgehen.

### Funny-Reveal

`team_antworten.ist_skurril` bleibt die einzige Markierung für „Falsch aber lustig“. Es wird kein paralleles Funny-Flag persistiert. Der Reveal ist ein reiner Präsentationszustand und verändert weder Submission noch Bewertung, Punkte oder kanonische Lösung.

```text
Frage → optional FUNNY → richtige Auflösung
```

Admin und Eventmanager im serverseitig geprüften Quiz-/Eventreihen-Scope dürfen die bestehende Markierung setzen. Die Moderation kann bei vorhandenen Treffern ausdrücklich den Funny-Schritt wählen oder direkt zur Auflösung springen. Ohne Treffer wird der technische Zwischenschritt übersprungen. Pro Seite erscheinen höchstens drei Antworten; weitere Seiten bleiben über denselben Reveal-Zustand erreichbar. Erst danach folgt unverändert die normale Auflösung.

| Testdatei | Geschützte Invariante |
| --- | --- |
| `app/quiz/funnyAnswerReveal.test.ts` | Ein bis drei Antworten passen auf eine Seite; fünf Antworten bleiben ohne Kürzung über zwei Seiten erreichbar. |
| `app/quiz/[quizId]/praesentation/buildPraesentationSlides.test.ts` | Der stabile Funny-Zustand liegt für jede Frage vor der richtigen Auflösung. |
| `app/rendering/presentation/presentationLiveState.test.ts` | Funny-Schlüssel erhalten die Fragenidentität, werden aber nicht zur Lösungsphase. |
| `app/rendering/presentation/presentationRankingPolicy.test.ts` | Öffentliche Zwischenstände bleiben anonym; finale und bewusst identifizierende Phasen dürfen Teamidentität zeigen. |

Corporate-/Venue-Templates wie LOVD sind Designkonfigurationen innerhalb der
bestehenden Template- und Theme-Infrastruktur. Sie:

- verwenden den bestehenden Template Generator und die zentralen
  Template-/Theme-Tokens;
- vermeiden unnötig komponentenseitig hardcodierte Farben und Fonts;
- erzeugen keine parallele Theme-Infrastruktur;
- gestalten Präsentation und Antwortformular, implementieren aber keine Quiz-,
  Ordering-, Block- oder Evaluation-Regeln.

`app/rendering/presentationTemplates/presentationTemplate.test.ts` schützt die
normalisierte Theme-Konfiguration, den gemeinsamen produktiven Renderer, die
editierbare LOVD-Vorlage sowie die Trennung von Design und Eventdaten.

## Pflichtprüfung bei Änderungen

Vor einer Änderung in einem der beschriebenen Bereiche:

1. maßgebliche Datenquelle und semantische Feldrolle bestimmen;
2. prüfen, ob kanonischer Inhalt, Quizzuweisung, Submission und Evaluation
   getrennt bleiben;
3. die oben zugeordneten Regressionstests ausführen;
4. `npm test`, `npm run typecheck` und ESLint für geänderte Dateien ausführen;
5. bei Runtime-Code zusätzlich den Production Build prüfen.

Die zentralen Ordering- und Interaction-Lifecycle-Tests sind Teil von
`npm test`; dadurch bleiben Teilnehmerreihenfolge, Blockfinalisierung und
Submission-Lifecycle auch in CI ausführbare Spezifikation.
