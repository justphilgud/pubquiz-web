# Bingo AP3: Prüfbericht und ausstehende gehostete Abnahme

## Status

**Blockiert für die vollständige Lieferung; kein Merge, keine Production-Änderung.**
PR: https://github.com/justphilgud/pubquiz-web/pull/145
Basis: `4f437c17d675cdf027b25cb2c2196f9ef19f5345`.
Lokal geprüfter Anwendungscode: `88ea3e0384d53aac5b6f7f1be70acea4e32e9a55`.
Der anschließende Prüfbericht-/Testcommit verändert den Anwendungscode nicht.

Die isolierte gehostete Preview ist **noch nicht bereitgestellt oder geprüft**.
Die separat angefragte menschliche Branch-Vertrauensfreigabe für
`codex/bingo-live-run` steht aus. Die Vorschrift in
[media-upload-environments.md](../architecture/media-upload-environments.md)
(„Neue Namen werden erst nach menschlicher Vertrauensprüfung separat aufgenommen“)
wird nicht durch eine bestehende andere Branch-Freigabe ersetzt. Weder Allowlist
noch Environment-Branch-Policy wurden umgangen. Nächster Schritt: nach dieser
Freigabe erfolgreiche genaue Head-CI prüfen, ausschließlich die isolierte
synthetische Datenbank anbinden, READY/Alias/Runtime nachweisen und den echten
gehosteten Ablauf samt frischem Login durchführen. Erst danach Previewlinks und
synthetischen Zugang direkt an den Auftraggeber liefern. Zugangsdaten stehen
nicht im Repository, in Screenshots oder im PR.

## Architektur und Migration

[Architekturvertrag](../architecture/bingo-live.md): AP1 bleibt unverändert die
Regelquelle, AP2 die Quelle der vorhandenen unveränderlichen Karten. Ein eigener
Durchlauf referenziert `game_drafts.id`, friert genau eine vorbereitete Runde,
ihren Kartenbestand und das aufgelöste gemeinsame Präsentationsdesign samt
benötigten Schrift-/Bildbytes ein. Druckgestaltung bleibt getrennt. Keine
Quizlaufzeitänderung, zweite Kartengenerierung oder neuen Abhängigkeiten.

Einzige additive Migration:
`20261028090000_bingo_live` mit den Tabellen `bingo_live_runs`,
`bingo_live_cards`, `bingo_live_events`. Transaktion, Fremdschlüssel,
Datenbank-Unique-Index für höchstens einen aktiven Durchlauf, vier eng geprüfte
Unveränderlichkeitstrigger mit bestehender Funktion. Keine historische
Migrationsdatei verändert. Normalisierter SHA-256 der neuen SQL-Datei:
`43b739f502a8f6e556191538f24f368c15ed546b4f38d8639ad55878e6c5bca4`.

Jeder Schreibbefehl prüft aktuelle Rolle, Produkt und Archivzustand unter
konsistenter Sperrreihenfolge. Revision, Request-ID und kanonischer Requesthash
sichern Konkurrenz und unklare Wiederholungen. Die Uhr kommt aus PostgreSQL;
Polling und Seitenaufrufe schreiben keine Fachzustände. Die Präsentation nutzt
einen eigenen authentifizierten Leseweg mit erneuter Berechtigungsprüfung; die
URL-Kennung allein verleiht keinen Zugriff.

## Tatsächliche Prüfungen

- Strikter Typecheck und ESLint der geänderten Dateien erfolgreich. Vollständiges
  `npm test` und Production-Build lokal erfolgreich; genaue Head-CI siehe PR.
- Echter PostgreSQL-Dienst: parallele und wiederholte Starts/Befehle,
  Revisionskonflikte, Datenbank-Unique-Index, falsche/fremde/nicht zugeordnete
  Karten, Rollen-/Produktentzug, Archivierung, alle drei Gewinnstufen,
  Rufgrenze, Korrektur/Nachprüfung/Rücknahme, aktive Zeit, Ende und neuer
  eigenständiger Durchlauf. Ein erreichtes Ziehungsziel beendet nicht automatisch.
- Migration isoliert auf leerem Ziel transaktional geprüft und auf einer
  repräsentativ befüllten AP2-Basis angewendet. Historische Modellbaseline plus
  echte AP2/AP3-Migrationen; **kein vollständiger historischer Migrationsreplay**.
  Bestehende AP2-Karten bleiben unverändert.
- Schemaweiter isolierter Dump und Restore in ein eigens neu erzeugtes Ziel,
  anschließend vollständiger Snapshotvergleich von Tabellen, Zeilen, Referenzen,
  ausführbaren Objekten und eingefrorenen Assets erfolgreich. Exakte neue
  Trigger-/Migrationsbindung und negative Manipulationsfälle geprüft. Dies ist
  weder Production-Backup/Restore noch Nachweis des echten Wochenlaufs.
- Tatsächlicher lokaler Browser mit frischen getrennten Admin-/Manager-/Editor-
  Sitzungen sowie getrenntem Moderations- und Präsentationsfenster:
  bewusster Start/Abbruch, manuelle Vorschau/Veröffentlichung, ungültiger Ruf,
  Bingo/Doppel/Triple per Kurzkennung/vollständiger Kennung/UUID,
  begründete Korrektur/Nachprüfung/Rücknahme, Pause/Zieländerung/Fortsetzen,
  ausdrückliches Ende und vollständiger Reload erfolgreich.
- **Eigener lokaler Serverprozess während Pause tatsächlich beendet und mit
  derselben isolierten Datenbank neu gestartet**: bestehende Anmeldung,
  Durchlauf-ID, Revision und Pausenzustand bleiben erhalten; der Browserablauf
  wurde danach erfolgreich fortgesetzt. Keine Session und kein Spiel zurückgesetzt.
- Native Warnung vor ungespeicherten Eingaben im frischen Testbrowser ausgelöst
  und Wechsel abgebrochen: Seite und Zahl bleiben erhalten. Dies ist ein
  Browserautomationsnachweis, keine behauptete menschliche AP3-Abnahme.
- Echte Netzwerkunterbrechung der Präsentation, unveränderter letzter Stand und
  anschließend synchrones Aufholen erfolgreich. Boardtests prüfen auch verspätete
  Revisionen, Wechsel zwischen Durchläufen und eine tatsächlich unbeantwortete
  Anfrage mit begrenzter Wartezeit.
- 30 Boardfälle: beide Marken, vor Start/laufend/pausiert/beendet/Nachprüfung,
  1280×600, 1366×768, 1920×1080, skalierte Vorschau, echte HTML-Fullscreen-API,
  Größenwechsel und alle 75 stabilen Zellen. Keine daraus abgeleitete physische
  Beamer- oder vollständige Geräteabnahme.
- Original-Assets vor Screenshots tatsächlich geladen; kalter Schriftladefall
  mit verzögerten Antworten und Pixelnachweis sichtbarer aktueller Zahl.
  Negative Kontrolle ohne `font-display: swap` schlägt genau an dieser Prüfung
  fehl, anschließend Quelldatei identisch wiederhergestellt.
- Bestehende synthetische Quizverwaltung lesend im Browser geprüft; bestehende
  AP2-/PDF-/Geometrie-/Kontrast-/Regressionsprüfungen bleiben erhalten.

Ein bestehender zufallsabhängiger AP2-Suchtest erwartete fälschlich immer genau
 einen Treffer für `B-001`; ein zufälliger vollständiger Seriencode konnte weitere
korrekte Teiltreffer erzeugen. Die Anwendungssuche wurde nicht geändert. Der
Test prüft jetzt einen eindeutigen Kurzcode sowie den deterministischen
Kollisionsfall mit exakten Kartenidentitäten und Trefferzahlen.

## Kurze Anleitung (lokal erprobt, gehostet noch nicht vollständig verifiziert)

Für die spätere persönliche Abnahme bleibt Spiel
`26000000-0000-4000-8000-000000000001` ungestartet. Die separate automatisierte
Browserprüfung nutzte ausschließlich Spiel `…0002`; Beispiel `…0003` ist beendet.
Vorbereitung: `/bingo/26000000-0000-4000-8000-000000000001/vorbereitung`.
Moderation: `/bingo/26000000-0000-4000-8000-000000000001/moderation`.
Präsentation: `/bingo/26000000-0000-4000-8000-000000000001/praesentation`.
Dies sind **Routen, keine nachgewiesenen gehosteten Previewlinks**.

1. Mit dem später direkt mitgeteilten synthetischen Admin anmelden. Moderation
   öffnen und „Präsentation vorab öffnen“ in einem zweiten angemeldeten Fenster
   öffnen. Noch kein laufender Durchlauf. In der Vorbereitung liegen zwölf
   vorhandene Karten; Prüfkarte ist `A-001` (`BG-EF058724C160-0001`).
2. „Vorbereitete Runde“ wählen, „Durchlauf bewusst starten“, Zusammenfassung
   prüfen, „Bestätigen“. Beide Fenster zeigen die gestartete Runde ohne Zahlen.
3. Bei „Physisch gezogene Zahl“ nacheinander `4, 22, 39, 49, 73` eingeben,
   jeweils „Zahl prüfen“ und „Zahl veröffentlichen“. Die Vorschau veröffentlicht
   nichts vor dem zweiten Klick. Die Publikumsanzeige übernimmt jede Zahl.
4. „Gerufene Stufe“ = „Bingo“, **sofort** „Bingo-Ruf jetzt erfassen“, danach
   „Kartenkennung“ = `A-001`, „Karte für diesen Ruf prüfen“, „Begründung der
   Entscheidung“ ausfüllen, „Gewinn bestätigen“. Für „Doppel-Bingo“ zusätzlich
   `11, 19, 42, 53, 65`, für „Triple-Bingo“ zusätzlich `6, 28, 50, 69`
   veröffentlichen und den Ruf jeweils neu erfassen. Weiterziehen bleibt möglich.
5. Für den Korrekturfall zuletzt `69` durch `1` ersetzen: „Physisch gezogene
   Zahl“ und „Begründung der Korrektur“ ausfüllen, „Letzte Zahl korrigieren“,
   „Bestätigen“. Nachprüfung ist sichtbar; eine „Bestätigung zurücknehmen“
   erfordert eine ausdrückliche Begründung. Ein Ruf vor den nötigen Ziehungen
   darf auch nach späteren Zahlen nicht bestätigt werden.
6. „Pause“ sperrt Zahlenveröffentlichung. „Ziehungsziel“ mit „Ziehungsziel ändern“
   verlängern, beide Fenster neu laden, gespeicherten Stand prüfen, „Fortsetzen“.
   „Durchlauf beenden“ und „Bestätigen“ beendet unveränderlich; Reload reaktiviert
   nichts. Ein neuer Start erzeugt einen neuen Durchlauf, keinen Reset.

## Screenshots und Grenzen

Screenshots stammen ausschließlich aus der **lokalen isolierten** Umgebung;
Next-Entwicklungsindikator sichtbar. Keine gehostete Abnahme behauptet.

- [Moderation Laptop, 1366×768](bingo-ap3-images/moderation-laptop.png)
- [Moderation mobil, 390×844](bingo-ap3-images/moderation-mobile.png)
- LOVD: [1280×600](bingo-ap3-images/audience-1280x600.png),
  [1366×768](bingo-ap3-images/audience-1366x768.png),
  [1920×1080](bingo-ap3-images/audience-1920x1080.png)
- Phil Gud: [1280×600](bingo-ap3-images/audience-phil-gud-1280x600.png),
  [1366×768](bingo-ap3-images/audience-phil-gud-1366x768.png),
  [1920×1080](bingo-ap3-images/audience-phil-gud-1920x1080.png)

Keine Production-Migration/Datenschreibaktion, kein Backup/Restore auf Production,
kein Merge. Keine OCR, Pi-/Offline-Synchronisierung, digitalen Teilnehmerkarten,
Selbstanmeldung, Statistik, Mehr-Runden-Komfort oder physischer Beamertest.
Historisches PRIVATE_READBACK_FAILED und der echte Wochenlauf bleiben getrennte
Betriebspunkte. AP3 ist erst nach erfolgreicher gehosteter Abnahme reviewbereit.
