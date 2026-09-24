# What the Meme! – AP2 Auswahl und Moderation

Stand: 23. September 2026

## Umfang

AP2 beginnt mit der ersten finalen Submission eines `MEME_CAPTION`-Runs. Es
synchronisiert während der offenen Antwortphase die jeweils letzte gültige
finale Submission jedes Teams und stellt sie anonym zur Vorabmoderation bereit.
Erst nach dem serverseitigen Ende des Runs wird aus den freigegebenen Memes die
einmalig randomisierte, persistente Präsentationsauswahl gebildet. Präsentation,
Voting, Gewinner und Punkte bleiben AP3/AP4.

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

Während der Antwortphase werden alle gültigen Submissions ohne Auswahlwirkung
aufgenommen. Bei einer neuen finalen Version desselben Teams wird der Kandidat
auf diese unveränderliche Submission umgebunden und erneut auf
`PENDING_REVIEW` gesetzt. Beim Abschluss werden nur freigegebene Kandidaten mit
einem serverseitigen Fisher-Yates-Shuffle aus `node:crypto.randomInt`
randomisiert. `maxPresentedMemes = null` behält alle; ein festes Limit kürzt erst
nach dem Shuffle.

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
speichert Position, Review-Status (`PENDING_REVIEW`, `APPROVED`, `REJECTED`),
`selected_for_presentation`, eine eigene Review-Revision und Auditdaten. Nur
freigegebene Kandidaten mit `selected_for_presentation = true` gehen an AP3.

Ein Ausschluss erzeugt keinen Ersatzkandidaten. Die ursprüngliche Auswahl und
Reihenfolge bleiben unverändert.

## Moderationsablauf

1. Meme-Frage in der Moderation öffnen.
2. Final abgegebene Memes schon während der Antwortphase anonym prüfen.
3. Jeden Kandidaten mit „Freigeben“ oder „Ausschließen“ entscheiden.
4. Antwortphase mit dem zentralen „Weiter“ schließen.
5. Review abschließen; der Server synchronisiert zuvor nochmals alle finalen
   Submissions, randomisiert die freigegebenen Kandidaten und speichert die
   Präsentationsmenge und Reihenfolge.

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
abgeschlossenen Auswahl, gefiltert auf `APPROVED` und
`selected_for_presentation = true` sowie nach persistierter Position sortiert.
Die Rückgabe enthält Submission-ID, Quizfragen-ID, interne Team-ID, Texte und
Position. Teamdaten werden nicht an die AP2-Moderationsoberfläche gegeben und
können in AP3 anonym dargestellt werden.
