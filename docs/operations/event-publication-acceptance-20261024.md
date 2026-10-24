# Event-Veröffentlichung – isolierte Abnahme 24.10.2026

## Umfang und Schutz

Auftrag aus `neu 6.txt` einschließlich Vierer-Anzeige. Neuer Branch ab Main
`bb969a99`; bestehender fremder Hauptcheckout unverändert. Kein produktiver Merge,
keine Produktionsmigration und kein Produktionsdeployment. Echte Eventreihen,
Quiz #31, Teams, Antworten und Laufzeitstatus wurden nicht geändert.

Abnahme: separate Datenbank `event_publication_qa_20261024` auf dem freigegebenen
Preview-Host (wispy-bird). Synthetische Reihen A/B/privat, insgesamt 13 öffentliche
Termine plus ein privater. Lokale echte PubQuiz-Ansichten und bestehender
Website-Quellcode; keine nachgebaute Verwaltungsoberfläche. Echte signierte
Nonprod-Blob-Uploads mit zwei transparenten synthetischen PNGs.

## Tatsächlich geprüft

| Bereich | Ergebnis |
| --- | --- |
| Ursache | Vor Fix an echter gerenderter EventSeriesManager-Komponente reproduziert: erster Action-Reset löscht Checkbox/Template im DOM, zweites Speichern sendet Defaults. |
| Speichern | Beschreibung ändern, zweimal speichern, normales Neuladen und Bearbeiten: öffentliche Sichtbarkeit, LOVD-Template, Absätze und übrige Werte erhalten. |
| Bewusste Änderung | Privat schalten und Komm.ONE-Template wählen; echte API enthält danach nur Reihe B. Wieder öffentlich schalten funktioniert. |
| Reservierung | Reihenlink, eigener Quizlink, Standardänderung bei bestehender Überschreibung, Entfernen eigener URL; echte Editorherkunft und API geprüft. Zuletzt exakte bestätigte LOVD-Adresse im synthetischen Reihenstandard, ohne Queryparameter. |
| Bilder | Reihenlogo hochladen, eigenes Quizbild hochladen, Reihenlogo ersetzen, eigenes Bild bleibt; Entfernen stellt aktuelles Reihenlogo wieder her. Echte Upload-/Speicheraktionen erfolgreich. Proportionale und transparente Bilder im Browser. |
| Texte | Ergänzen mit Absatzabstand, Ersetzen nur Quiztext, Whitespace trotz Ersetzen fällt auf Reihe zurück. Fehlender Text in Reihe B erzeugt keinen Website-Textblock. Weitere Blankkombinationen automatisch geprüft. |
| Veröffentlichung | Private Reihe und beide internen SECRET-Testwerte aus echter API ausgeschlossen. Effektive Werte ändern sich mit aktuellen Standards, eigenständige Overrides bleiben erhalten. |
| Website Desktop | Quiztitel, Beschreibung, Bilder und Reservierung rechts; Kalenderdownload direkt unter Abo, kein sichtbarer Zeitzonenhinweis. Automatischer bestehender Minutenabruf übernahm Reihenänderung ohne manuelles Neuladen. |
| Vierer-Anzeige Desktop | 13 Termine: 4 → 8 → 12 → 13; Button verschwindet. Reihe A: Reset auf 4, dann 7; sichtbare Vorgänger bleiben stehen. |
| Vierer-Anzeige Mobil | Viewport 390×844 (Inhaltsbreite 375): Reihe B 4 → 6, Button weg; Wechsel auf alle setzt auf 4 zurück. Scrollbreite = Inhaltsbreite, kein horizontaler Überlauf. |
| Kalender | Beide UI-Links folgen Filter 1, 2 beziehungsweise 1,2. Echte ICS-Antworten enthalten 7, 6 beziehungsweise alle 13 Termine trotz begrenzter Anzeige; stabile Quiz-UIDs und Ausschluss privat. Externe Kalenderprogramme wurden nicht gestartet. |
| Additive Migration | Gegen isoliertes Basisschema mit vorhandenen synthetischen Datensätzen ausgeführt; alle bisherigen Quizspaltenwerte vorher/nachher identisch, neue nullable Felder null, Modus APPEND. |

## Prüfungen

- `npm test`: vollständig erfolgreich einschließlich Vor-/Nachläufen und Browserregressionen.
- `npm run test:event-publication`: 7 gezielte Tests erfolgreich.
- `npm run typecheck`, `npm run db:validate`, ESLint mit `--max-warnings=0` für
  geänderte/neue Quell- und Testdateien erfolgreich.
- PubQuiz-Build mit `next build --webpack` erfolgreich. Die Abhängigkeiten wurden
  ohne Neuinstallation aus vorhandenem `node_modules` verknüpft; Turbopack lehnt
  die Worktree-übergreifende Verknüpfung lokal ab. CI führt den normalen Build aus.
- Website: Tests, Typecheck und statischer Build erfolgreich; finale PR-/Versions-
  und CI-Verweise werden nach Bereitstellung ergänzt.

Windows-Hinweis: Der unveränderte alte Importplan wurde von Git mit CRLF ausgecheckt
und verletzte dadurch seinen Byte-Hash-Test. Originale Git-Bytes (LF) im Testcheckout
wiederhergestellt; danach vollständiger Testlauf grün. Kein inhaltlicher Plandiff.

## Vorhandene Einschränkungen und Bereitstellung

- Gemeinsame Preview enthält zusätzlich `20261006120000_add_quiz_purpose`, die
  nicht im Main-Migrationsverzeichnis liegt. Kein Reset, keine Historienänderung,
  keine Migration der gemeinsamen Preview durch diesen lokalen Test.
- Vollständiger Aufbau einer leeren Datenbank scheitert bereits an der unveränderten
  `0_init`-Migration wegen UTF-8-BOM. Für den isolierten Funktionstest Basisschema
  per Prisma-Diff erzeugt und ausschließlich unsere neue SQL-Migration darauf
  ausgeführt. Kein Ursachenfix für die alte Initialmigration behauptet.
- `codex/event-publication` ist noch nicht in der exakten GitHub-Environment-
  Allowlist `TRUSTED_PREVIEW_BRANCHES`. Diese Schutzregel wird nicht umgangen.
  Die lokale Preview mit isolierter Datenbank ist geprüft; gehostete GitHub/Vercel-
  Preview benötigt die reguläre Branchfreigabe und einen grünen Head-CI-Lauf.
- Sites bietet in diesem Projekt ein eigenes Quellrepository und gespeicherte
  Versionen, keinen GitHub-PR-Workflow. Website-Quellpatch und gespeicherte Version
  werden zum Backend-PR referenziert; keine Veröffentlichung.
- Eigene Quizbilder werden bewusst separat gespeichert; bei Neuanlage zuerst das
  Quiz anlegen, dann seine Einstellungen öffnen. Keine neuen Abhängigkeiten.

Für spätere Production gelten die Release-Reihenfolge und Feldverträge in
[public-events-api.md](../architecture/public-events-api.md). Geöffnete Editoransichten
nach Bereitstellung neu laden. Kein Session-Reset notwendig.
