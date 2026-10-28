# Bingo AP3: Prüfbericht und ausstehende gehostete Abnahme

## Status und gehosteter Nachweis (28.10.2026)

PR: https://github.com/justphilgud/pubquiz-web/pull/145
Basis: `4f437c17d675cdf027b25cb2c2196f9ef19f5345`.
Der vollständige gehostete Funktionsablauf wurde auf
`73b22580b4c8236fb7173d1e32c38f1049872dbc` erfolgreich geprüft.
Initiales READY-Deployment: `dpl_6DoFMumMB2DXH5whizTZm1FtAGrv`,
https://pubquiz-4hqqn9dae-just-phil-gud.vercel.app .
Alias und authentifiziertes Admin-Monitoring bestätigten exakt diesen SHA und
`environment=preview`; Datenbankverbindung erfolgreich.

Danach korrigiert `e36fdbc69eaee675764536bad794205209e8a056`
ausschließlich den veralteten AP2-Hinweis „Bingo ist noch nicht spielbar“ in der
Vorbereitung. Keine Spiel-/Speicher-/Rechtelogik geändert. Finale Head-CI,
Auslieferung dieser Textkorrektur und deren gehostete Sichtprüfung werden mit
Deployment-ID und Runtime-SHA im PR festgehalten. Ein späterer Berichtscommit
ist von diesem Anwendungscode ausdrücklich zu unterscheiden.

Stabiler eigener Preview-Einstieg:
https://pubquiz-web-git-codex-bingo-live-run-just-phil-gud.vercel.app .
Es gelten weiterhin die vorhandene Vercel-Anmeldung und die separate
Anwendungsanmeldung. Synthetische Zugangsdaten werden ausschließlich direkt an
den Auftraggeber gegeben, nicht hier, im PR, in Screenshots oder Logs.

Der menschliche Fortsetzungsauftrag gibt genau `codex/bingo-live-run` ab dem
oben genannten Head separat frei. Nur dieser Name wurde zur bestehenden
`TRUSTED_PREVIEW_BRANCHES`-Liste und zur exakten Environment-Branch-Policy
hinzugefügt. Bestehende Einträge und Schutzregeln bleiben erhalten. Der gemeinsame
Preview-Migrationsworkflow bleibt für diesen Branch gesperrt. Der gezielte
administrative Git-Preview-Weg prüft erfolgreiche genaue Push-CI und die sechs
zentralen Medienmetadaten. Nur `DATABASE_URL` und `AUTH_SECRET` erhielten
branchgebundene Overrides. Keine zentralen Medienwerte oder fremden Bestände
geändert, keine storeweite Bereinigung. AP3 verwendet gegebenenfalls ausschließlich
seinen eigenen bestehenden Branch-Präfix.

Vor Konfiguration und nach Abschluss: exakt eigene isolierte synthetische
Datenbank `bingo_live_review_20261027c` und eigener Runtime-Benutzer verifiziert;
68 registrierte Migrationen mit passenden kanonischen Repository-Checksummen.
Kein erneuter Seed, keine Migration in gemeinsam genutzte Development-Datenbank.
Kein Merge, kein Production-Deployment, keine Production-Daten-/Rechteänderung.

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

## Kurze Anleitung (lokal und im gehosteten Browser erprobter Ablauf)

Für die spätere persönliche Abnahme bleibt Spiel
`26000000-0000-4000-8000-000000000001` ungestartet. Die separate automatisierte
Browserprüfung nutzte ausschließlich Spiel `…0002`; Beispiel `…0003` ist beendet.
Vorbereitung: `/bingo/26000000-0000-4000-8000-000000000001/vorbereitung`.
Moderation: `/bingo/26000000-0000-4000-8000-000000000001/moderation`.
Präsentation: `/bingo/26000000-0000-4000-8000-000000000001/praesentation`.
Diese Routen unter dem oben verifizierten Branch-Alias verwenden. Der Abnahmefall
wurde gehostet rein lesend geöffnet; er bleibt ungestartet.

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
Betriebspunkte. Die Freigabe des PR aus Draft erfolgt erst nach erfolgreicher finaler Head-CI,
Runtime-/Aliasprüfung und Sichtprüfung der eng begrenzten Textkorrektur.


## Tatsächlich gehostete Browserabnahme

Frischer Admin-Login am Branch-Alias, separates Präsentationsfenster vor dem
bewussten Start. Zusätzlich eigenständige Anmeldungen als Manager und Editor auf
der festen Deployment-URL; keine Änderung ihrer synthetischen Rechte nötig.
Manager darf die eigene Reihe öffnen, fremde Reihe liefert 404; Editor erhält
auch bei direktem Moderationslink der eigenen Reihe 404.

Der Durchlauf `3bd681b9-8777-4f26-8be7-1e093291b302` in Prüfspiel `…0002`
wurde ausschließlich über die gehostete UI erzeugt und regulär beendet:

- Start abbrechen, danach bewusst starten; vorab geöffnetes Publikum übernimmt
  neuen Run mit Revision 0. Ungültige Zahl 0 schreibt nichts.
- Ungültiger Ruf bei Ziehung 0: Karte zuordnen, Bestätigung wird abgewiesen,
  ausdrücklich ablehnen. Nach 14 späteren Zahlen bleibt die erneute Bestätigung
  dieses historischen Rufs abgewiesen, Revision unverändert.
- Alle 14 Zahlen einzeln vorprüfen/veröffentlichen; getrenntes Publikum übernimmt
  jede aktuelle Zahl. Bingo, Doppel und Triple bestätigt mit Kurzkennung,
  vollständiger Kennung und UUID. Ein erreichtes Ziel 5 beendet nichts automatisch.
- Letzte Zahl 73 mit Begründung nach 1 korrigiert: Triple sichtbar nachzuprüfen,
  aktuelle Linien nur noch zwei; Bestätigung ausdrücklich zurückgenommen.
- Pause sperrt Veröffentlichung; Ziel 50, vollständiger Reload beider Fenster,
  gleiche Revision 31 und Pausenzustand; Fortsetzen erfolgreich.
- **Echter Ausfall des eigenen gehosteten Endpunkts:** ausschließlich der eigene
  Preview-Alias wurde 45 Sekunden entfernt und automatisch auf dasselbe geprüfte
  Deployment zurückgestellt. Offizielle Vercel-Alias-API, keine Änderung der
  Schutzregeln. Publikum zeigt Verbindungsfehler und behält Revision 32/Zahl 1.
  Die separate Moderation über die feste Deployment-URL speichert Ziel 60 mit
  Revision 33. Nach Wiederherstellung übernimmt das Publikum Revision 33 ohne
  Reload und entfernt die Verbindungswarnung. Kein physisches WLAN-Abschalten
  behauptet; keine Production-Aliasse berührt.
- Ausdrückliches Beenden mit Dialogbestätigung. Moderation und Publikum nach
  Reload beendet; kein Fortsetzen angeboten. Abschließende reine DB-Prüfung:
  alle Testdurchläufe beendet, Abnahmespiel `…0001` weiterhin ohne Durchlauf.
- Beide Marken in tatsächlich gemessenen 1280×600, 1366×768 und 1920×1080:
  75 Zellen, fitted-Status, keine Dokument-Scrollfläche. Vergrößern und
  Verkleinern über den vorhandenen Viewport-Mechanismus. Originalschrift und
  Logo sichtbar; Moderation zusätzlich 390×844 ohne horizontalen Überlauf.

**Zusätzliche Prüfgrenze:** Der native Navigations-Abbruchdialog ließ sich im
gehosteten In-App-Browser nicht zuverlässig bedienen: Input-/Screenshot-Timeout,
Dialog-API meldete keinen bedienbaren Dialog. Kein bestandener gehosteter oder
menschlicher Nachweis hierfür behauptet; lokaler vollständiger Test ist oben
separat dokumentiert. Native Fensterprüfung wurde nicht freigegeben und nicht
umgangen. Der gespeicherte Spielstand blieb erhalten; regulärer Abschluss erfolgte
anschließend im ursprünglichen Moderationsfenster. Dies ist kein nachgewiesener
Anwendungsfehler. Keine neue native Vollbild- oder physische Beamerabnahme.

Gehostete Screenshots (Vercel-Preview-Toolbar teilweise sichtbar):

- [Moderation 1366×768](bingo-ap3-hosted-images/moderation-1366x768.png)
- [Moderation 390×844](bingo-ap3-hosted-images/moderation-390x844.png)
- LOVD: [1280×600](bingo-ap3-hosted-images/lovd-1280x600.png),
  [1366×768](bingo-ap3-hosted-images/lovd-1366x768.png),
  [1920×1080](bingo-ap3-hosted-images/lovd-1920x1080.png)
- Phil Gud: [1280×600](bingo-ap3-hosted-images/phil-gud-1280x600.png),
  [1366×768](bingo-ap3-hosted-images/phil-gud-1366x768.png),
  [1920×1080](bingo-ap3-hosted-images/phil-gud-1920x1080.png)
- [Verbindung unterbrochen](bingo-ap3-hosted-images/connection-interrupted.png)
- [Beendet nach Reload](bingo-ap3-hosted-images/ended-after-reload.png)
