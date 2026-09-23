# Meme beschriften – AP2 Auswahl und Moderation

Stand: 23. September 2026

## Umfang

AP2 beginnt erst nach dem serverseitigen Ende eines `MEME_CAPTION`-Runs. Es
ermittelt die letzte gültige finale Submission jedes Teams, wendet die im
Run-Snapshot gespeicherte Konfiguration `maxPresentedMemes` an und stellt die
ausgewählten Memes in der bestehenden Moderationsseite zur Prüfung bereit.
Präsentation, Voting, Gewinner und Punkte bleiben AP3/AP4.

## Wiederverwendete AP1-Verantwortung

- `quiz_interaction_runs` bestimmt Run, Zustand und Deadline.
- `team_answer_submissions` bleibt der unveränderliche finale Snapshot.
- `parseMemeCaptionPayload` validiert den gespeicherten Inhalt.
- `MemeRenderer` rendert Basisbild und Teamtext auch im Review.
- `requireQuizLiveController` schützt jede lesende oder schreibende
  Server-Action.

AP2 ändert weder Draft noch Submission. Es speichert keine gerenderten Bilder.

## Kandidatenbildung und Auswahl

Nur `SUBMITTED`- und `AUTO_FINALIZED`-Snapshots des passenden Runs mit
Interaction-Typ `MEME_CAPTION` und mindestens einem nicht leeren Textfeld sind
gültig. Pro Team gewinnt deterministisch die höchste Submission-Version, bei
Gleichstand die höchste Submission-ID.

Bei `maxPresentedMemes = null` werden alle gültigen Submissions übernommen.
Bei einem festen Limit wird ein serverseitiger Fisher-Yates-Shuffle mit
`node:crypto.randomInt` verwendet und anschließend auf das Limit gekürzt. Liegt
die Zahl gültiger Submissions unter oder auf dem Limit, werden alle übernommen.

> Die zufällige Auswahl wird genau einmal serverseitig erzeugt und danach
> stabil gespeichert.

Eine Transaktion sperrt den Interaction-Run mit `FOR UPDATE`. Der eindeutige
Schlüssel auf `interaction_run_id` verhindert auch bei zwei Moderatoren eine
zweite Auswahl. `meme_moderation_candidates.position` fixiert die spätere
Reihenfolge.

## Datenmodell

`meme_moderation_selections` speichert Run, Quizfragen-Zuweisung, gültige
Gesamtzahl, verwendetes Limit, Lifecycle (`REVIEWING`, `COMPLETED`, `SKIPPED`)
und eine optimistische Revision.

`meme_moderation_candidates` referenziert die unveränderte AP1-Submission und
speichert ausschließlich Position, Review-Status (`PENDING_REVIEW`, `APPROVED`,
`REJECTED`) sowie eine eigene Review-Revision und Auditdaten.

Ein Ausschluss erzeugt keinen Ersatzkandidaten. Die ursprüngliche Auswahl und
Reihenfolge bleiben unverändert.

## Moderationsablauf

1. Meme-Frage in der Moderation öffnen.
2. Nach Ablauf oder zulässigem Schließen der Antwortphase erscheint die
   persistierte Auswahl.
3. Jeden Kandidaten mit „Freigeben“ oder „Ausschließen“ entscheiden.
4. „Auswahl bestätigen / Review abschließen“ wählen.

Ein Abschluss ist erst möglich, wenn alle Kandidaten entschieden und mindestens
einer freigegeben ist. Bei ausschließlich abgelehnten Kandidaten erscheint eine
Warnung; der Moderator muss eine Entscheidung ändern. Gibt es keine gültige
Submission, erlaubt die explizite Aktion „Ohne Meme fortfahren“ den Zustand
`SKIPPED`.

Nach dem Abschluss sind Entscheidungen gesperrt. Reload, zweiter Moderator und
neues Deployment lesen dieselben Datensätze.

## Konflikte

Jede Kandidatenmutation verlangt `expectedReviewRevision`. Ein veralteter
Moderator erhält `REVISION_CONFLICT` und den aktuellen serverseitigen Stand.
Der Abschluss verlangt zusätzlich die erwartete Auswahlrevision. Es gibt keine
stille Last-write-wins-Überschreibung.

## Übergabe an AP3

`readApprovedMemeCandidatesForAp3` liefert ausschließlich Kandidaten einer
abgeschlossenen Auswahl, gefiltert auf `APPROVED` und nach persistierter Position
sortiert. Die Rückgabe enthält Submission-ID, Quizfragen-ID, interne Team-ID,
Texte und Position. Teamdaten werden nicht an die AP2-Moderationsoberfläche
gegeben und können in AP3 anonym dargestellt werden.
