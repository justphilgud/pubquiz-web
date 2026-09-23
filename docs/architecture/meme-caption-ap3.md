# Meme beschriften – AP3 Präsentation und Voting

Stand: 23. September 2026

## Umfang

AP3 übernimmt ausschließlich die in AP2 abgeschlossene, freigegebene
Kandidatenmenge. Die Moderation präsentiert diese Kandidaten anonym in der
persistierten AP2-Reihenfolge, zeigt anschließend eine paginierte Übersicht und
öffnet ein serverseitig gespeichertes Team-Voting. Gewinner, Gleichstände,
Punkte, Teamnamenauflösung und Ergebnisfolien gehören weiterhin zu AP4.

## Wiederverwendete Infrastruktur

- `ModerationClient`, `QuizPraesentationPlayer` und der bestehende Live-Snapshot
  synchronisieren Moderation, Leinwand und Teamgeräte.
- `requireQuizLiveController` schützt Start, Navigation, Öffnen und Schließen.
- `resolveParticipantSession` bindet einen Vote an die bestehende Quiz-Team-
  Sitzung; der Client kann keine fremde Team-ID vorgeben.
- `MemeRenderer` rendert in Einzelansicht, Übersicht und Team-Voting dasselbe
  Basisbild mit denselben gespeicherten Texten.
- AP2 bleibt Eigentümer von Kandidaten, Reihenfolge, Position und Reviewstatus.
  AP3 kopiert oder verändert diese Daten nicht.

Die bestehende Content-Umfrage speichert Antworten an einer Poll-Revision und
einem Interaction-Run. Ein Meme-Vote referenziert dagegen einen unveränderlichen
AP2-Kandidaten und benötigt einen eigenen Präsentationszustand. Deshalb ergänzt
AP3 zwei kleine Tabellen, statt die fachlich anders gebundene Poll-Antwort zu
überladen.

## Serverseitiger Ablauf

`meme_presentations` speichert genau einen Ablauf pro abgeschlossener
AP2-Auswahl. Die Zustände sind:

1. `PRESENTING`: aktueller Kandidat wird einzeln gezeigt;
2. `OVERVIEW`: bis zu vier Kandidaten je Übersichtsseite;
3. `VOTING_OPEN`: Teamgeräte dürfen einen Vote schreiben oder ändern;
4. `VOTING_CLOSED`: finaler, für AP4 lesbarer Zustand.

Die sichtbare Nummer ist immer `meme_moderation_candidates.position`. Interne
Kandidaten-IDs erscheinen nicht in der Oberfläche. Abgelehnte AP2-Kandidaten
werden nicht geladen und verursachen keine Neunummerierung.

Der Moderator muss jeden freigegebenen Kandidaten durchlaufen und bei mehreren
Übersichtsseiten bis zur letzten Seite navigieren. Erst dann erlaubt der
Zustandsautomat `OPEN_VOTING`. Jede Mutation sperrt die Präsentationszeile und
prüft die erwartete Revision. Zwei Moderatorclients können deshalb nicht
unbemerkt zwei verschiedene Übergänge ausführen.

## Stimmen und Konflikte

`meme_votes` speichert pro Präsentation und Quiz-Team-Sitzung genau eine Zeile.
Ein eindeutiger Datenbankschlüssel erzwingt diese Kardinalität. Während das
Voting offen ist, ersetzt eine neue Auswahl die vorhandene Kandidatenreferenz
und erhöht die Vote-Revision.

Vor jedem Schreiben sperrt der Server die Präsentation und serialisiert
gleichzeitige Schreibversuche derselben Präsentation und Team-Sitzung mit einem
transaktionalen Advisory Lock. Danach prüft er Status, Kandidatenmenge,
Besitzerteam und erwartete Vote-Revision. Damit gilt:

- ein veraltetes zweites Gerät erhält `REVISION_CONFLICT` und den aktuellen
  Vote;
- nach `VOTING_CLOSED` werden neue und geänderte Votes abgewiesen;
- ein Kandidat außerhalb der abgeschlossenen AP2-Freigabe wird abgewiesen;
- genau eine effektive Stimme bleibt persistent.

> Während des offenen Votings werden keine Zwischenstände pro Kandidat
> angezeigt.

Nur die Moderation sieht den neutralen Fortschritt „X von Y stimmberechtigten
Teams“. Kandidatenwerte, Prozentwerte und Rangfolgen werden weder an Leinwand
noch Teamgeräte ausgegeben.

## Selbstwahl und Teilnahme

Ein Team sieht sein eigenes freigegebenes Meme mit derselben Nummer, aber
deaktiviert. Die Oberfläche ist nur die erste Schutzschicht: Der Server löst die
Team-ID aus der signierten Team-Sitzung auf, liest das Besitzerteam direkt aus
der AP2-Submission und lehnt Gleichheit ab.

> Ein Team kann sein eigenes Meme weder über die Oberfläche noch über direkten
> Request wählen.

Angemeldete Teams ohne freigegebenes eigenes Meme dürfen alle Kandidaten wählen.
Existiert nur ein Kandidat und ist ein Team dessen Besitzer, bleibt dieser Vote
gesperrt; es wird keine künstliche Selbststimme erzeugt. Der Moderator kann den
Ablauf regulär schließen und an AP4 übergeben.

## Reload und Synchronisierung

Jeder Client rekonstruiert den Zustand aus dem gemeinsamen Live-Snapshot:

- Moderator und Leinwand erhalten Phase, aktuelle AP2-Position und
  Übersichtsseite;
- ein Team erhält die öffentlichen Kandidaten erst ab `VOTING_OPEN`, dazu nur
  seine eigenen Kandidaten-IDs und seinen eigenen Vote;
- interne Teamzuordnungen und Votes anderer Teams verlassen den Server nicht;
- ein Reload behält aktiven Kandidaten, Übersichtsseite, Votingstatus,
  vorhandenen Vote und Revision;
- Polling führt mehrere Moderator- und Teamclients wieder auf denselben
  Serverzustand zusammen.

## Übergabe an AP4

`readClosedMemeVotingForAp4` liefert nur für `VOTING_CLOSED`:

- die freigegebenen Kandidaten in AP2-Reihenfolge;
- stabile Kandidatennummer und Submission-ID;
- interne Besitzerteam-ID;
- genau die finalen Votes mit abstimmendem Team, Kandidat, Revision und
  Zeitstempel;
- den finalen Schließzeitpunkt.

AP4 muss Kandidaten weder neu interpretieren noch Votes deduplizieren. AP3
berechnet noch keinen Gewinner und vergibt keine Punkte.
