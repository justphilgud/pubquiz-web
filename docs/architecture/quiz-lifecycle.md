# Living Specification: Quiz-Lifecycle (AP1)

Stand: 7. September 2026. Verbindliche Ausgangsbasis; Änderungen müssen die
Anforderung bewusst gegen diesen Vertrag prüfen, Regressionen testen und den
Vertrag aktualisieren. Siehe auch `answer-interaction.md` und `AGENTS.md`.

## Zweck und analysierter IST-Zustand

Ein Live-Abend braucht Vorbereitung, einen bewussten Start, ein persistentes Ende
und einen ausdrücklich bestätigten neuen Durchlauf. Vor AP1 war ausschließlich
`quiz_praesentation_status.quiz_started_at` vorhanden. Die Moderation rief `starteQuiz`
beim Audio-Play der festen Startsequenz auf; Mehrfachaufrufe überschrieben die Zeit.
`getOrCreatePraesentationStatus` synchronisierte beim Laden einen alten Slide mit
Interaction-Runs. Die Präsentation stellte grundsätzlich die letzte Position wieder
her. „Quiz beenden“ setzte nur lokalen React-State und beendete den Pausen-Countdown;
Reload verlor den Beendet-Zustand. Einen vollständigen Durchlauf-Reset gab es nicht.

Position, Medienbefehle, Reveal, Countdown und Schätzfragen-Overlay liegen im
Präsentationsstatus. Blockfreigaben und aktuelle Frage liegen in
`quiz_block_freigaben`. Interaction-Runs halten Öffnung, Deadline, Zustand und
Template-Snapshot. Teamanmeldungen liegen in `quiz_team_sessions`; globale Konten
in `teams`, historische Quiz-Team-Zuordnungen in `quiz_teams`. Drafts und Bewertungen
liegen in `team_antworten`, Auswahl-/Feldinhalte in deren Kindtabellen. Finale
Abgaben sind versionierte `team_answer_submissions`. Die Teamansicht rehydriert
signierte Sessions und Drafts über den gemeinsamen Live-Snapshot-Service.

Die bisherige Freigabe „irgendwann seit Blocköffnung geöffnet“ ließ nachfolgende
Fragen bei Rücknavigation sichtbar. Ein erneuter Besuch einer finalisierten Frage
konnte einen neuen Run erzeugen; dadurch wurden vorhandene Antworten beim nächsten
Speichern einem neuen Kontext zugeordnet. Diese beiden Ursachen werden getrennt
behandelt: Sichtbarkeit wird explizit, Run-Identität bleibt erhalten.

## Gemeinsames Zustandsmodell

Einzige Quelle ist der bestehende `quiz_praesentation_status`, kein zweiter
Quiz-Status auf `quiz`. `resolveQuizLifecycle` interpretiert:

| Zustand | Persistierte Bedingung | Verhalten |
| --- | --- | --- |
| PREPARATION | keine Start-/Stopzeit; auch fehlender Status | Moderation, QR, Teambeitritt, Vorschau und ausdrücklich geöffnete Testinteraktionen erlaubt |
| RUNNING | Startzeit vorhanden, keine Stopzeit | Regulärer Durchlauf; Position und Antworten bleiben bei Reload/Reconnect erhalten |
| STOPPED | Stopzeit vorhanden | Finale Position bleibt zur Nachvollziehbarkeit erhalten; Antwortannahme, neue Freigaben und Live-Steuerung gesperrt |

Start benötigt eine autorisierte explizite Aktion „Quiz starten“. Er schreibt die
Startzeit genau einmal. Wiederholte Startaufrufe desselben Durchlaufs sind
idempotent. Start löscht keine Testteams oder Testantworten und verändert die
getestete Position nicht. Wer einen sauberen Lauf braucht, setzt vorher zurück.
STOPPED kann nur über Reset verlassen werden. Ein vorhandener alter Startzeitpunkt
wird bei der additiven Migration als RUNNING interpretiert; ein historisch nur lokal
gestopptes Quiz kann technisch nicht nachträglich als STOPPED erkannt werden.

Stop bleibt eine bewusst bestätigte Aktion. Er persistiert zusätzlich zum bisherigen
Timerende die Stopzeit, stoppt Audio, schließt Blöcke und finalisiert nichtleere offene
Drafts über die vorhandene Close-/Bewertungslogik. Vorhandene Submissions und
Bewertungen werden nicht gelöscht. Leere Drafts erzeugen keine finale Abgabe.

## Laden, Position und Aktivierung

Moderation lädt/erstellt lediglich den Status; Laden synchronisiert keine Interaktion
mehr und startet kein Quiz. Moderation folgt der gemeinsam gespeicherten Position.
Eine neu geöffnete oder neu geladene Präsentation in PREPARATION zeigt lokal Slide 1.
Eine alte Position wird beim Polling nicht wiederhergestellt, solange kein neuer
Navigationszeitpunkt veröffentlicht wurde. Diese lokale Anfangsansicht ist keine
Freigabe und verändert keine Antworten. Anschließende bewusste Navigation folgt
wieder dem gemeinsamen Status. In RUNNING und STOPPED wird die gespeicherte
Position wiederhergestellt; Reset liefert Index 0 ohne alten Slide-Key.

Die Präsentation bleibt ein lesender Consumer ohne Quizstart-/Navigationsaktion.
Ihr lokaler Aktivierungsknopf ist die zweite bewusste Benutzerinteraktion. Vor der
Aktivierung werden keine Play-Befehle an Medien gegeben. RUNNING verlangt eine neue
Aktivierung auch nach einer bereits aktivierten Vorbereitung; Reload und Reset
heben die lokale Aktivierung auf. Die bestehende Medienkomponente behält ihren
Fallback bei abgelehntem `play()`. Eine Browserinteraktion ist keine Garantie, dass
jedes später neu erzeugte Medienelement in jedem Browser automatisch spielen darf.

## Fragen, Navigation und Submissions

Navigation validiert Index und Slide-Key gegen den tatsächlichen Quizablauf.
Block-Intro und Blockfreigabe behalten ihre vorhandene Fachlogik. Vorwärtsnavigation
lässt zuvor freigegebene normale Fragen im offenen Block verfügbar. Rücknavigation
blendet die nachfolgenden Frage-Slides über `quiz_interaction_runs.is_hidden` aus.
Sichtbarkeitsänderungen sperren auch serverseitige Schreibzugriffe.

„Frage schließen / ausblenden“ ist eine reversible Sichtbarkeitssperre, kein finales
Interaction-Close: Draft, Deadline, Run, Revisionen, Submission-Versionen und
Bewertung bleiben erhalten. „Frage wieder einblenden“ nimmt diese Sperre zurück.
Zeit läuft dadurch nicht rückwärts; abgelaufene Deadlines bleiben abgelaufen.
Das bestehende endgültige Blockschließen und die Lösungsphase finalisieren weiterhin
über `closeRun`. Bereits CLOSED/REVEALED gewordene Runs bleiben beim Wiederbesuch
finalisiert und werden lesend wiederverwendet. Erneut editierbar sind nur weiterhin
OPEN/COUNTDOWN befindliche Interaktionen mit gültiger Freigabe und Deadline.
Pixel-Stopper, Punkteallokation und Poll-Sonderregeln bleiben bestehen.

Navigation erzeugt einen Run nur bei erstmals besuchter Interaktion. Spätere Besuche
nutzen den jüngsten vorhandenen Run derselben Quizfrage. Normale Navigation,
Ausblenden und Wiederöffnen löschen weder Teams noch Drafts, Submissions oder
Bewertungen. Aktuelle Antworten behalten ihren ursprünglichen Run-Kontext.

## Reset und Datenentscheidung

Reset verlangt den bestehenden Bestätigungsdialog mit ausdrücklicher Beschreibung
der unwiderruflichen Löschung sowie serverseitig `confirmed === true` und die
aktuelle `lifecycle_revision`. In einer Transaktion:

- quizbezogene Team-Sessions löschen; deren FK-Cascades entfernen Drafts,
  Feld-/Auswahlwerte, Bewertungen und Submission-Snapshots;
- Interaction-Runs und Blockfreigaben dieses Quiz löschen;
- quizbezogene `quiz_teams` (Punkte/Platzierung) entfernen;
- Team-/Teilnehmerzahl auf 0 setzen;
- Start-/Stopzeit, Medien, Timer, Reveal und Schätzfragen-Overlay zurücksetzen;
- Position auf Index 0 ohne alten Key setzen, Lifecycle-Revision erhöhen.

Globale `teams`, Quizinhalt, Fragen, Templates, andere Quizdaten und historisch
aggregierte Fragenstatistiken/Präsentationsdauer-Messungen bleiben erhalten.
Alte signierte Team-Sessions werden nach Reset serverseitig ungültig; die bestehende
401-Behandlung führt zur erneuten Anmeldung. Reset erzeugt keine neuen Sessions.

Historisierung wurde geprüft: Sessions sind pro Quiz/globaler Team-ID eindeutig, Drafts pro
Quizfrage/Session; Auswertung und zahlreiche Queries aggregieren unmittelbar pro
Quiz. Ein bloßes Archivflag würde alte Antworten und Ranglisten weiter einbeziehen.
Sichere vollständige Run-Historisierung erfordert eine neue Durchlaufidentität mit
Migration aller Lese-/Schreibwege und ist außerhalb AP1. Daher wird ausdrücklich
die beschriebene physische Löschung gewählt. Empfehlung für ein späteres AP:
vollständige Quizdurchlauf-Identität samt Audit-/Statistikvertrag einführen.

## Verantwortlichkeiten, Ein-/Ausgaben und Konkurrenz

- `quizLifecycle.ts`: reine Zustandsauflösung, Anzeigenamen und Revisionsprüfung.
- `quizLifecycle.server.ts`: gemeinsames Quiz-Row-Lock, Stop-Sperre und Resetdefaults.
- `praesentation/statusActions.ts`: autorisierte Lifecycle-/Navigationsaktionen;
  Eingaben Quiz-ID, Ziel/Operation und Durchlaufrevision; Ausgabe persistierter Status.
- `interaction.server.ts`: vorhandene Runs, Drafts, Finalisierung, Snapshots;
  berücksichtigt Sichtbarkeit und Lifecycle-Sperre.
- `quizAnswerLiveState.ts`: zentrale Sichtbarkeits- und Schreibfreigabeauswahl.
- `QuizLifecycleControls`: Anzeige, Pending-/Fehlerrückmeldung und Resetbestätigung.
- bestehende Moderation: Navigation, Fachbedienung und Darstellung; folgt auch
  Statusänderungen aus anderen Fenstern über den gemeinsamen Snapshot.
- bestehender Player: lokale Browseraktivierung und Darstellung, keine Fachmutation.

Sperrreihenfolge: Quiz → Run → Draft. Lifecycle-Aktionen, Navigation, Teambeitritt,
Antwortschreiben und Blockaktionen werden transaktional serialisiert. Start erhält
seine Zeit bei Doppelklick; Reset erhöht die Durchlaufrevision, sodass alte
Start-/Reset-/Navigationsbefehle der Moderation abgewiesen werden. Die Revision ist
keine Berechtigung: bestehende Quiz-Rollenprüfungen bleiben verpflichtend.

## Invarianten und Regressionen

INV-01/02: Oberflächen laden ohne impliziten Start. INV-03: Start nur ausdrücklich.
INV-04: PREPARATION-Präsentation beginnt lokal bei Slide 1. INV-05: RUNNING-Reconnect
erhält die Position. INV-06/07: Navigation/Ausblenden löschen keine Submissions.
INV-08: Wiederöffnen behält den Run. INV-09: nur bestätigter Durchlauf-Reset entfernt
die beschriebenen Laufzeitdaten. INV-10/11: Reset hinterlässt keine Freigabe und
beginnt auf Slide 1. INV-12: alle Oberflächen lesen dasselbe Lifecycle-Modell.

Regressionen: `quizLifecycleRegression.test.ts`, `quizAnswerLiveState.test.ts`,
`interactionArchitecture.test.ts`, `presentationLiveState.test.ts` und
`presentationOutputPolicy.test.ts`; außerdem bestehende Interaction-, Pixel-,
Poll- und Bewertungstests. A–H sind im AP1-Regressionstest zugeordnet. Die bisherigen
Source-Tests „keine Buttons im Player“ und „Audio startet Quiz“ widersprechen der
neuen Anforderung und wurden gezielt auf lokale Aktivierung bzw. expliziten Start
aktualisiert. Keine fachlichen Bewertungstests werden dafür abgeschwächt.

Die echte Browser-/Datenbank-Abnahme muss auf einem eigens angelegten Development-
oder Preview-Testquiz erfolgen: anmelden → öffnen → speichern/absenden → zurück →
ausblenden/einblenden → Reload → stoppen → Reset → neu öffnen. Niemals produktive
Quizdaten dafür zurücksetzen. Qualitäts- und Deployment-Ergebnisse siehe AP1-Bericht.

## Integration auf den aktuellen Preview-Vertrag

Die globale Teamidentität bleibt in `teams`; `startGlobalTeamQuizSession` sperrt
den Quiz-Lifecycle innerhalb seiner vorhandenen Transaktion, bevor sie Teilnahme
und Quiz-Team-Zuordnung schreibt. Profile, Avatare, Zugangswörter und Jahreswertung
anderer Quiz bleiben erhalten.

Eigenständige Content-Umfragen verwenden weiterhin `live_poll_responses` und
keine Frage-Submissions. Ihr Schreibweg beachtet Stop/Reset und ausgeblendete Runs.
Beim erneuten Besuch einer Platzierung wird deren Run inklusive bereits vorhandener
Antworten wiederverwendet; geschlossene Umfragen bleiben geschlossen. Reset entfernt
Umfrageantworten über die Session-/Run-Cascades, nicht den redaktionellen Poll oder
seine Revisionen. `live_text_response_publications` werden über die gelöschten
Submission-Snapshots entfernt; globale Textersetzungsregeln bleiben erhalten.

Der vorhandene LIVE-Close, die Trennung von Finalisierung und Evaluation,
moderator-only Originaltexte, öffentliche Ergebnisfreigaben und adaptives
Content-Poll-Polling bleiben erhalten. AP1 erweitert die zentrale Run-Reuse-Policy
bewusst auf CLOSED/REVEALED auch für Standardfragen; die bisherige Erwartung, dass
diese einen neuen leeren Kontext erhalten, widerspricht INV-08. Die zugehörigen
Regressionserwartungen wurden auf Erhalt der finalen Identität aktualisiert.
