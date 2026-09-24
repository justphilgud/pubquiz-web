# What the Meme! – AP1

Stand: 24. September 2026

## Umfang

Das Fragetemplate `meme_beschriften` sammelt kreative Meme-Beschriftungen ein.
AP1 umfasst Erstellung, Quizkonfiguration, Intro, moderierten Start, Countdown,
Drafts und finale Submissions. Auswahl, Moderation, Präsentation eingereichter
Memes, Voting, Gewinner und Punkte folgen in AP2 bis AP4.

## Wiederverwendete Architektur

- Der Frageneditor verwendet das bestehende Template-Registry-, Medien-,
  Freigabe-, Quellen- und Sponsoringmodell. Das Basisbild liegt einmal im
  vorhandenen Slot `question_image`.
- Die konkrete Quizzuweisung speichert ihre Meme-Konfiguration in
  `quiz_fragen.meme_config_json`. Sie gehört damit zur Verwendung der Frage im
  Quiz und nicht zur globalen Frage.
- Präsentationsnavigation und `quiz_interaction_runs` öffnen den Run. Das
  Erreichen der vorgelagerten `meme-erklaerung` öffnet noch keinen Run; erst der
  nächste Moderationsschritt auf die Frage erzeugt bei aktivierter
  Zeitbegrenzung `COUNTDOWN` und `deadline_at`. Ohne Zeitbegrenzung entsteht
  `OPEN` ohne Deadline.
- Drafts bleiben in `team_antworten`; finale, versionierte und idempotente
  Snapshots bleiben in `team_answer_submissions`. Reload, Mehrgeräte-Konflikte,
  verlorene Responses und Deadline-Ablehnung verwenden unverändert den
  allgemeinen Interaction-Service.
- Präsentation, Moderation und Teamansicht lesen dieselbe serverseitige
  Deadline. Der sichtbare Sekundentakt ist nur eine lokale Anzeige.

Der Meme-Run verändert weder Blockdeadline noch den globalen
Präsentationscountdown. Seine Frist existiert ausschließlich in
`quiz_interaction_runs.deadline_at`.

## Konfiguration pro Quizfrage

```ts
type MemeQuestionConfig = {
  version: 1;
  timerEnabled: boolean;
  responseDurationSeconds: number | null; // aktiv: 60 bis 600; inaktiv: null
  maxPresentedMemes: number | null; // 1 bis 100; null bedeutet „Alle“
};
```

Standard sind ein aktiver Timer mit 90 Sekunden und maximal fünf später
präsentierte Memes. Bestehende Konfigurationen ohne `timerEnabled` werden aus
Kompatibilitätsgründen als zeitbegrenzt gelesen. AP1 zeigt den Zeitmodus auf der
Introfolie und speichert ihn; eine Auswahl findet noch nicht statt.

## Antwortvertrag

Der Interaction-Typ lautet `MEME_CAPTION`. `antwort_text` enthält die
serialisierte Draftform:

```json
{"topText":"Oben","bottomText":"Unten"}
```

Der Submission-Snapshot enthält dieselben strukturierten Felder als JSON. Beide
Für `Text oben` und `Text unten` gelten jeweils maximal 80 Zeichen. Client,
Server und Renderer verwenden dieselbe fachliche Grenze. Die Rohfelder werden
vor dem Trimmen auf diese Länge geprüft, anschließend getrimmt und sind einzeln
optional. Mindestens eines muss für eine gültige Submission befüllt sein. Der
Server validiert Form, Länge, Run-, Team- und Fragenidentität sowie die aktuelle
Deadline erneut. Meme-Fragen haben in AP1 keine Bewertung und ein
Basispunktemaximum von 0.

## Rendering

`MemeRenderer` kombiniert das vorhandene Basisbild zur Laufzeit mit dem oberen
und unteren Text. Die Teamvorschau aktualisiert diese React-Komponente lokal bei
jeder Eingabe. Dabei entstehen weder Requests noch neue Dateien oder
Blobobjekte. Die Präsentation nutzt dieselbe Bildkomponente während der
Bearbeitung ohne Teamtexte. Bei aktivem Timer zeigt sie daneben den Countdown;
ohne Timer zeigt sie ausschließlich den offenen beziehungsweise beendeten
Einreichungsstatus. Die Schriftgröße wird für längere Captions im gemeinsamen
Renderer abgestuft, sodass auch 80 Zeichen im vorgesehenen Bereich bleiben.

## Bedienung

### Editor

1. Neue Frage anlegen und „What the Meme!“ wählen.
2. Überschrift, Metadaten, Quelle und gegebenenfalls Sponsor pflegen.
3. Im erforderlichen Bildslot das Basisbild über die vorhandene
   Medienbibliothek wählen oder hochladen.
4. Speichern und den bestehenden Freigabeprozess verwenden. Eine richtige
   Antwort wird nicht angelegt.

### Quizkonfiguration

1. Die freigegebene Frage dem Quiz hinzufügen.
2. **Zeitbegrenzung** aktivieren oder deaktivieren.
3. Bei aktiver Zeitbegrenzung die Antwortzeit wählen.
4. Eine maximale Zahl oder „Alle“ einstellen.
5. Die Werte werden sofort für diese Zuweisung gespeichert.

### Moderation

Die Meme-Erklärfolie zeigt Aufgabe, Zeitmodus, späteres Präsentationslimit und
die aktuelle Teamzahl. Während dieser Folie läuft kein Meme-Timer. „Meme-Frage
starten“ wechselt auf die Frage. Bei aktivem Timer öffnet dies die serverseitige
Frist; nach Ablauf wird die Eingabe gesperrt und ein verspäteter Request
serverseitig abgewiesen. Bei deaktivierter Zeitbegrenzung bleibt die
Meme-Einreichung geöffnet, bis ein berechtigter Moderator sie serverseitig über
**Einreichungen beenden** beendet. Reloads rekonstruieren `OPEN` oder `CLOSED`
aus dem Interaction-Run; parallele Moderatorclients verwenden denselben
idempotenten Close-Übergang.

## Abnahme

Die manuelle Preview-Abnahme verwendet genau eine Meme-Frage, ein Testquiz und
drei bis fünf Testteams. Sie prüft die Flows A bis I aus dem Auftrag:
Erstellung, Quizkonfiguration, untimed Intro, Start, lokale Vorschau, bestätigte
Speicherung, Reload, Deadline, parallele Geräte und Regression von Standard,
Pixelbild sowie einer weiteren Live-/Sonderfrage.
