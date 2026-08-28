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
| Für die Quizfrage existiert noch kein Interaction Run | Status `NOT_PLAYED`; weder unbeantwortet noch falsch, keine vorläufige Nullbewertung. |
| Effektive Submission vorhanden, Evaluation fehlt oder ist unvollständig | Antwort sichtbar, Status `PENDING`, nicht unbeantwortet; Punkte gegebenenfalls vorläufig. |
| Interaction Run vorhanden, aber keine effektive Submission | Status `UNANSWERED`. |
| Submission und vollständige Evaluation | Persistierter Bewertungsstatus und vergebene Punkte. |

### Quizweite Sicht und Filter

Die Auswertung ist kumulativ über das ganze Quiz. Ergebnisse aus früheren
Blöcken bleiben nach späteren Blöcken vorhanden. Der Scope „Bisher gespielt“
ist die Standardansicht und umfasst jede Quizfrage, für die mindestens ein
Interaction Run gestartet wurde – unabhängig davon, ob ein Team geantwortet
hat. „Alle Fragen“ und ein bewusst gewählter Block zeigen auch zukünftige
Fragen mit `NOT_PLAYED`. Scope- und Statusfilter verändern nur die Darstellung,
niemals Evaluation, Backfill, Punktestand oder Persistenz.

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
| `app/quiz/evaluation/evaluationReadModel.test.ts` | `NOT_PLAYED`, `UNANSWERED` und `PENDING` bleiben anhand von Interaction Run, Submission und Evaluation unterscheidbar. |
| `app/quiz/evaluation/evaluationMatrix.test.ts` | Played-, All- und Block-Scope erhalten den quizweiten Datenbestand; zukünftige Zellen bleiben `NOT_PLAYED`. |
| `app/quiz/evaluation/evaluationAnswerFilter.test.ts` | Standardfilter umfasst alle bereits gespielten Blöcke; All- und Blockfilter sind explizit. |
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

Audience und Moderationsvorschau verwenden für den Zwischenstand dasselbe
anonyme Audience-Read-Model. Es lädt ausschließlich Rang und Punkte;
Teamidentität erreicht diese Datengrenze nicht. Vollständige Teamidentitäten
bleiben in der getrennten Auswertungs-/Adminansicht verfügbar:

| Zustand | Öffentliche Präsentation | Moderationsvorschau |
| --- | --- | --- |
| Zwischenstand | Rang und Punkte; kein Name, Foto, Avatar oder Team-ID | identische anonyme Folie mit Rang und Punkten |
| Endstand / Siegerehrung | Teamname, Punkte und Foto oder Avatar | vollständige Teamidentität |
| Jahreswertung | Teamname, Jahrespunkte, Foto oder Avatar und semantische Rangbewegung | identische Jahreswertung |
| bewusst gezeigte skurrile Antwort | Teamname, Antwort und Foto oder Avatar | Teamname, Antwort, Foto oder Avatar sowie Markierung |
| Join-/QR-Slide | kompakte Identität aus Foto oder stabilem Avatar und Teamname | identische öffentliche Join-Identität |

Der Fallback auf einen Systemavatar ist stabil und template-neutral. Templates dürfen die Anordnung gestalten, aber nicht die Audience-Regel umgehen.

Der öffentliche Zwischenstand verwendet Competition-Ranking (`1, 2, 2, 4`)
und zeigt die echten Punkte. Die Siegerehrung deckt ausschließlich vorhandene
Podiums-Ranggruppen in der Reihenfolge `3 → 2 → 1` auf. Danach folgt ein eigener
Endstand-Slide mit allen Teams, prominenten Podiumsgruppen und kompakter
Restliste; fehlende Ränge werden nicht erfunden.

Die anschließende Jahreswertung summiert ausschließlich bereits vergebene
Punkte aus nicht archivierten Quizzen derselben Eventreihe im Kalenderjahr bis
einschließlich des aktuellen Quiz. Rangbewegungen vergleichen Competition-Ränge
vor und nach dem aktuellen Quiz: aufwärts = grünes Dreieck, abwärts = rotes
Dreieck, unverändert oder ohne belastbaren Vorher-Rang = weißer Punkt. Diese
Read-Model-Berechnung verändert weder Bewertung noch Scoring oder Persistenz.

### FaceMorph in Präsentation und Antwortformular

`face_morph_result` ist der sichtbare, dominante Inhalt der öffentlichen
Fragephase. Die strukturierten Felder `Person A` und `Person B` gehören zum
Team-Antwortformular und werden nicht als Eingabekarten in der Präsentation
gerendert. Die Auflösung kombiniert das Morph-Bild mit den gepflegten Lösungen
beider Antwortfelder. Presentation-View-Model und Answer-Interaction bleiben
damit fachlich getrennt. Der zentrale Layout-Resolver trägt dafür die explizite
Presentation-Rolle `FACE_MORPH`; der Renderer leitet sie nicht erneut aus der
generischen Feldanzahl ab.

### Funny-Reveal

`team_antworten.ist_skurril` bleibt die einzige Markierung für „Falsch aber lustig“. Es wird kein paralleles Funny-Flag persistiert. Der Reveal ist ein reiner Präsentationszustand und verändert weder Submission noch Bewertung, Punkte oder kanonische Lösung. Er existiert nur, wenn die effektive Answer-Interaction `TEXT` oder `STRUCTURED_TEXT` ist und mindestens eine so markierte wirksame/finalisierte Antwort vorliegt. Auswahl-, Zahlen-, Ordering-, Poll- und `NO_ANSWER`-Interactions erhalten auch bei einem inkonsistenten Flag keinen Funny-Zustand.

```text
Frage → optional FUNNY → richtige Auflösung
```

Admin und Eventmanager im serverseitig geprüften Quiz-/Eventreihen-Scope dürfen die bestehende Markierung setzen. Die Moderation kann bei vorhandenen Treffern ausdrücklich den Funny-Schritt wählen oder direkt zur Auflösung springen. Ohne Treffer oder ohne Freitextfähigkeit existiert der technische Zwischenschritt nicht im Deck und erhöht weder Slidezahl noch Zähler. Pro Seite erscheinen höchstens drei Antworten; weitere Seiten bleiben über denselben Reveal-Zustand erreichbar. Erst danach folgt unverändert die normale Auflösung.

| Testdatei | Geschützte Invariante |
| --- | --- |
| `app/quiz/funnyAnswerReveal.test.ts` | Nur freie Text-Interactions sind zulässig; ein bis drei Antworten passen auf eine Seite und fünf bleiben ohne Kürzung über zwei Seiten erreichbar. |
| `app/quiz/[quizId]/praesentation/buildPraesentationSlides.test.ts` | Nur tatsächlich verfügbare Funny-Zustände liegen vor der zugehörigen Auflösung; abwesende Zustände erhöhen das Deck nicht. |
| `app/rendering/presentation/presentationLiveState.test.ts` | Funny-Schlüssel erhalten die Fragenidentität, werden aber nicht zur Lösungsphase. |
| `app/rendering/presentation/presentationRankingPolicy.test.ts` | Öffentliche Zwischenstände bleiben anonym; Competition-Ränge und vorhandene Podiumsgruppen bleiben korrekt. |
| `app/quiz/yearlyRanking.test.ts` | Jahrespunkte, Competition-Ränge und neutrale/aufwärts/abwärts gerichtete Bewegungen bleiben reine Read-Model-Logik. |
| `app/rendering/presentation/PresentationSlideRenderer.test.ts` | FaceMorph trennt Bildpräsentation und Antwortfelder; Rankings und Join-Identitäten erfüllen ihre Audience- und Layout-Verträge. |

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

## Live-Result-Contract

`quiz_fragen.ergebnisdarstellung` ist eine quizspezifische Darstellungsstrategie
und verändert weder den Interaction Contract noch Submission, Lösung,
Auswertung oder Punkte. `STANDARD` ist der sichere Default. `LIVE` ist nur für
Single-/Multiple-Choice, Wahr/Falsch, Polls und echte `TEXT`-Interaktionen
zulässig; Ordering, strukturierte Texte, Zahlen, Pixel und FaceMorph bleiben
ausgeschlossen.

Der verbindliche Ablauf ist:

```text
QUESTION / OPEN
→ Submissions sammeln und moderator-only prüfen
→ CLOSE
→ optionales LIVE RESULT REVEAL
→ normaler SOLUTION-/Quiz-Flow
```

Während `OPEN` sieht das Publikum ausschließlich die Frage. Es erhält weder
Antwortverteilung noch offene Texte oder Lösung. Die Moderation sieht den
Antwortfortschritt und darf eingegangene Antworten in einem ausdrücklich
moderator-only Bereich prüfen. Bei Freitext darf sie Veröffentlichungen bereits
vorbereiten oder zurücknehmen; die Publikumsfolie bleibt trotzdem unverändert.

`CLOSE` sperrt weitere Antworten und Änderungen, erhält vorhandene Submissions,
Moderationsstatus und Veröffentlichungen und erzeugt keinen neuen Run. Ein
gefüllter Draft ohne finale Submission wird dabei einmalig als
`AUTO_FINALIZED` gesichert; ein leerer Draft erzeugt keine Submission. Der
explizite LIVE-Close stößt für diese Auto-Finalisierung keine fachliche
Evaluation an. Finalisierung und Evaluation bleiben getrennte Zustände.

Erst im Zustand `CLOSED` ist „Ergebnis anzeigen“ verfügbar. Das Ergebnis bleibt
anonym und neutral; eine Richtig/Falsch-Markierung gehört ausschließlich zum
separaten Solution-Reveal.

Pixel-Stop bleibt eine eigenständige, explizite Aktion. Ein allgemeiner Close
darf einen vorhandenen Stopper, Stop-Zustand und eine bestehende Deadline nicht
verändern, keinen zweiten Stop oder Countdown erzeugen und keinen neuen Run
öffnen. Drafts anderer Teams dürfen nach den bestehenden Regeln normal
auto-finalisiert werden, werden dadurch aber weder zum Pixel-Stop noch allein
wegen Close bewertet. Terminale Pixel-Runs bleiben bei Navigation und Reload
die maßgebliche Run-Identität.

Choice-Ergebnisse basieren ausschließlich auf der jeweils neuesten finalen
Submission pro Team. Drafts und ältere Versionen zählen nicht. Der öffentliche
Snapshot transportiert die Aggregate erst nach `CLOSED` und ausdrücklicher
Ergebnisfreigabe. Die bestehende Snapshot-Abfrage und das bestehende Polling
transportieren den Zustand; es entsteht kein paralleler Live-Kanal.

Freitext bleibt zweistufig: Die Original-Submission ist unveränderliche Quelle
für Moderation und Auswertung. Eine Zeile in
`live_text_response_publications` gibt genau diese Submission ausdrücklich für
eine spätere öffentliche Darstellung frei. Ohne Freigabe erscheint kein Text;
auch eine Freigabe während `OPEN` wird erst im geschlossenen, ausdrücklich
gezeigten Ergebnis sichtbar. Der öffentliche Snapshot enthält dann nur
`publicText`; Teamidentität, Original und Diff werden ausschließlich nach
serverseitiger `CONTROL_LIVE`-Prüfung geladen.

Aktive `public_text_replacement_rules` werden deterministisch ausschließlich
auf die öffentliche Projektion angewendet. Die Regeln ändern nie Payload,
Draft, Submission oder Evaluation und bewirken keine automatische Freigabe.
Nur Administratoren verwalten Regeln; Admin und Eventmanager im Quiz-Scope
steuern Sichtbarkeit, Freigaben und das Schließen der Antwortphase.

| Testdatei | Geschützte Invariante |
| --- | --- |
| `app/quiz/liveResults/liveResultMode.test.ts` | Nur unterstützte Interaction-Typen können `LIVE` verwenden. |

## Eigenständige Content-Umfragen

`LIVE_POLL` ist ein nicht bewertetes `quiz_ablauf_elemente`-Element und ausdrücklich keine Quizfrage. Die Platzierung referenziert eine konkrete unveränderliche `live_poll_revision`; spätere redaktionelle Änderungen erzeugen eine neue Revision und verändern bestehende Quizabläufe nicht. Ein Präsentationsschlüssel `poll-placement:<id>` öffnet einen eigenen `quiz_interaction_runs`-Run mit einem `contentPoll`-Snapshot.

```text
Umfrage-Platzierung
→ OPEN Content-Poll-Run
→ Teams überschreiben ihre aktuelle Auswahl oder ihren Textbeitrag
→ Audience erhält nur Aggregate bzw. freigegebene bereinigte Texte
→ Moderation erhält Original, öffentliche Fassung und Teamidentität
→ CLOSED
→ nächstes Ablaufelement (keine Lösung, keine Bewertung, keine Punkte)
```

Auswahl erlaubt zwei bis sechs Optionen und genau eine wirksame Auswahl pro Team und Run. Freitext erlaubt einen wirksamen Beitrag pro Team und Run; Wiederholungen ersetzen ihn bis zum Schließen. `AUTOMATIC` veröffentlicht die bereinigte Fassung direkt, `MODERATED` erst nach serverseitiger Freigabe. Die öffentliche Wall ist auf die letzten 20 sichtbaren Beiträge begrenzt. Ranking-, Funny-, Evaluation- und Solution-Pfade lesen diese Tabellen nicht.

Der Abruf nutzt die bestehenden autorisierten Live-Snapshot-Routen mit `no-store`. Für laufende Content-Umfragen beträgt der Takt 1,2 Sekunden in sichtbaren Tabs und 5 Sekunden in Hintergrund-Tabs; wiederholte Fehler führen zu exponentiellem Backoff bis 15 Sekunden. Die Darstellung interpoliert Änderungen clientseitig und führt keine Datenbankabfrage pro Animationsframe aus.
| `app/quiz/liveResults/liveChoiceResults.test.ts` | Effektive Abgaben werden neutral und submissionsbasiert aggregiert. |
| `app/quiz/liveResults/liveTextResults.test.ts` | Öffentlich gelangen nur freigegebene, ersetzte Texte; Moderation behält Original und Identität. |
| `app/quiz/liveResults/publicTextSanitizer.test.ts` | Groß-/Kleinschreibung, Leetspeak, Wiederholungen und Separatoren werden konservativ erkannt. |
| `app/quiz/liveResults/liveResultArchitecture.test.ts` | Rechte, Audience-Grenze und unveränderte Submission-Persistenz bleiben erhalten. |

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
