# AP1 Meme beschriften – Preview-Abnahme 2026-09-23

## Ergebnis

AP1 deckt das Erstellen, Konfigurieren und Einsammeln einer Meme-Beschriftung ab. Auswahl, Moderationsprüfung, Präsentation eingereichter Memes, Voting und Punkte bleiben ausdrücklich AP2 bis AP4.

- Feature-Branch: `codex/meme-caption-ap1`
- Produktcommit: `9cf64221f8ba1546a7f5de56d616e272bc164bd4`
- Preview-Branch-Commit: `20c28493812b21729fe97a129f21ce03094e09e1`
- Preview: `https://pubquiz-web-git-preview-content-and-quiz-flow-just-phil-gud.vercel.app`
- Unveränderliche Deployment-URL: `https://pubquiz-e7minb6rf-just-phil-gud.vercel.app`
- Deployment-ID: `dpl_9F2MDW2AS8vPEYie8DU28jNkySKz`
- Preview-Deploy-Run: `35896163570`
- Production: unverändert

## Architektur

Die Umsetzung erweitert die vorhandene Frage-, Live- und Antwortarchitektur:

- Die bestehende Template-Registry führt `MEME_CAPTION` / `meme_beschriften` als kreative Frage ohne richtige Antwort und ohne Punkte.
- Der vorhandene Medienpfad speichert genau ein Basisbild an der Frage. Teamantworten erzeugen keine Bilder und keine Blobs.
- `MemeRenderer` rendert Basisbild, oberen Text und unteren Text gemeinsam in Teamvorschau und für spätere Präsentationskontexte.
- Die Quizfragen-Zuordnung speichert Dauer und Präsentationslimit als `meme_config_json`; `null` beim Limit bedeutet „Alle“.
- Der vorhandene Interaktionslauf erstellt beim Wechsel von der Erklärfolie zur Frage die serverseitige Deadline. Der Client zeigt nur die aus Serverzeit und Deadline abgeleitete Restzeit.
- Draft-, Submit-, Versions-, Konflikt-, Auto-Finalisierungs- und Deadline-Mechanismen bleiben dieselben wie bei bestehenden Antworten.
- Die strukturierte Antwort wird kanonisch als JSON `{"topText":"…","bottomText":"…"}` gespeichert. Die Evaluation vergibt immer null Punkte.

## Datenmodell und Migration

Migration `20260923160000_add_meme_caption_question` ergänzt additiv `quiz_fragen.meme_config_json`, registriert das Template und ordnet den Präsentationstyp `meme_caption` zu. Der geschützte Preview-Workflow bestätigte vor und nach dem Deploy die richtige Preview-Datenbank und einen aktuellen Migrationsstand.

## Automatisierte Prüfung

- Prisma-Schema: gültig
- TypeScript: erfolgreich
- ESLint der geänderten Dateien: erfolgreich
- Vollständige Tests: 757/757 erfolgreich
  - Hauptsuite 561/561
  - Präsentationslesbarkeit 14/14
  - realer 1280×720-Browsertest 1/1
  - Posttest-Suite 181/181
- Production-Build: erfolgreich
- Feature-CI `35895624554`: erfolgreich
- Preview-CI `35895913300`: erfolgreich
- Preview-Migration, Deployment und HTTP-Smoke `35896163570`: erfolgreich

Die Regression umfasst Template-Erstellung, Zahlen- und „Alle“-Konfiguration, Deadline-Erzeugung, Annahme vor und Ablehnung an/nach Deadline, leere bzw. zu lange Payloads, Reload, Auto-Finalisierung, doppelte und konkurrierende Writer sowie Standard-, Pixel- und Präsentationspfade.

## Repräsentative Preview-Daten

- Content-Frage `#118`: `Meme AP1 Preview-Abnahme 2026-09-23: Beschriftet dieses Bild.`
- Basisbild über die vorhandene Preview-Medienfunktion; Frage freigegeben und global.
- Quiz `#57`: ursprünglicher End-to-End-Lauf mit Standardfrage und Meme-Frage.
- Quiz `#58`: nichtdestruktiv kopierter Wiederholungs- und Konfliktlauf nach dem Snapshot-Fix.
- Konfiguration: 60 Sekunden, maximal 4 Memes.
- Testteams: vier Teams im ersten Lauf und ein weiteres Team im Wiederholungslauf.

## Manuelle Preview-Flows

### A – Frage erstellen

Bestanden. Meme-Template gewählt, Basisbild über die bestehende Medienfunktion hochgeladen, Frage gespeichert und freigegeben. Nach Reload blieben Template, Titel, Freigabestatus und genau ein Bild erhalten; es gibt keine Dummy-Antwort.

### B – Quiz konfigurieren

Bestanden. Die Frage wurde in Block 1 aufgenommen. 60 Sekunden und maximal 4 Memes wurden gespeichert und nach Reload sowie beim Kopieren des Quiz unverändert gelesen.

### C – Intro

Bestanden. Die separate Folie zeigte Aufgabe, 60 Sekunden, maximal 4 Memes und im ersten Lauf vier angemeldete Teams. Im Teilnehmerclient blieb die Eingabe geschlossen und es lief kein Meme-Timer.

### D – Start

Bestanden. Erst der Moderationswechsel von der Erklärung zur Frage erzeugte den Interaktionslauf. Präsentations-/Moderationsansicht und Teamgerät nutzten dieselbe Deadline; die Eingabefelder wurden erst dann freigeschaltet.

### E – Meme erstellen

Bestanden. Oberer und unterer Text aktualisierten Bild, Zähler und Umbruch unmittelbar lokal. Vor dem Submit stand der Status auf „Geändert – noch nicht gespeichert“, nach bestätigter Serverantwort auf „Antwort abgegeben / Aktuelle Antwort gespeichert“. In den Runtime-Logs erschienen während der Eingabe nur die vorhandenen Snapshot-/Antwortrequests und kein Medienupload.

### F – Reload

Bestanden. Nach Reload wurden Text, Abgabestatus und verbleibende serverseitige Zeit rekonstruiert. Eine Änderung ließ sich innerhalb der Frist erneut verbindlich abgeben.

### G – Deadline

Bestanden. Nach Ablauf sperrte die Browseroberfläche beide Felder. Ein bereits vor Frist serverseitig gespeicherter Draft wurde nach dem vorhandenen Auto-Finalisierungsvertrag erhalten. Die deterministischen Deadline-Tests decken zusätzlich den technisch verspäteten Request ab: Ein vor Ablauf begonnener, aber erst nach der Sperrgrenze serialisierter Save wird serverseitig abgewiesen; ein vor Deadline angenommener Save bleibt nach später Response bzw. Reload bestätigt.

### H – Parallelität

Bestanden. Dasselbe Team war gleichzeitig in zwei Browserclients geöffnet. Nahezu gleichzeitige Änderungen `CLIENT A` und `CLIENT B` erzeugten genau einen bestätigten Serverstand. Der zweite Client zeigte den Versionskonflikt mit den vorhandenen Optionen; „Gespeicherte Antwort verwenden“ stellte den eindeutigen Stand wieder her. Reload bestätigte nur `CLIENT A` als abgegebene Antwort.

### I – Regression

Bestanden.

- Standardfrage: im selben Quiz vor der Meme-Frage gerendert; Sequenz und offene Antwort unverändert.
- Pixel-Frage: bestehendes Preview-Quiz `#50` zeigte weiterhin die Pixel-Regelfolien und das aktive Pixelbild in der Präsentation.
- Kunstwerk als weiteres Sonderformat: bestehendes Preview-Quiz `#54` zeigte weiterhin Bild, Künstler, Titel und Quelle in der Auflösung.
- Die vollständige Testmatrix bestätigte zusätzlich, dass Blocktimer, Pixel-Interaktion, bestehende Submissions und Präsentationssequenzen unverändert bleiben.

## Während der Abnahme gefundener Fehler

Der erste Browserlauf speicherte die Meme-Antwort, aber die anschließende Snapshot-Auswertung kannte `MEME_CAPTION` noch nicht und lieferte `Nicht unterstützter Submission-Typ: MEME_CAPTION`. Der minimale Fix in Commit `9cf64221f8ba1546a7f5de56d616e272bc164bd4` dekodiert und kanonisiert ausschließlich diesen strukturierten Payload im bestehenden Effective-Submission-Adapter. Zwei Regressionstests prüfen gültige und ungültige Snapshots. Nach erneutem Preview-Deploy waren Auto-Finalisierung, Submit, Reload und Konfliktauflösung fehlerfrei; die Runtime-Logs enthielten keine erneute Ausnahme.

## Bewusst verschoben

Zufallsauswahl, Moderationsprüfung, Präsentation von Team-Memes, Kandidatennummern, Voting, Ausschluss der Selbstwahl, Gewinnerermittlung, Punkte und Gleichstände bleiben AP2 bis AP4.

## Abschluss

Alle AP1-Abnahmekriterien sind erfüllt. `main` und Production wurden durch AP1 nicht verändert; die Migration wurde ausschließlich auf Preview ausgeführt.
