# Bingo-Transfer-Fix: lokaler Prüfbericht

6. November 2026 · Branch `codex/bingo-print-templates-ui` · vor dem getrennten
Druckdesign-Commit. Baseline: `192f27848f723559e3e18a0b9fdbbeb169a10ed3`.
Vertrag und Wiederholung: [Bingo-Polling](../architecture/bingo-polling-transfer.md).

## Gemessener Vorher-/Nachher-Vergleich

Identische eigene lokale Datenbank `bingo_ap2_qa_1793997287473`, ein pausierter
aktueller und drei beendete historische Durchläufe. Eingefrorene Liveassets
zusammen **8.156.356 Byte**, unveränderter Lauf-Fingerprint
`ae3ccaf03c1d783720d981b93863878d` in beiden Messungen.
Je zehn Abrufe pro Endpunkt (30 insgesamt), 1.500 ms Abstand je Abrufgruppe;
Vorher 13.845 s, nachher 13.584 s.
SQL-Zahl umfasst auch Transaktions-/Autorisierungs-/Statusanweisungen.

| Endpunkt | DB-Byte vorher | DB-Byte nachher | SQL vorher/nachher | HTTP-Körper Byte vorher/nachher | HTTP-Socket Byte vorher/nachher |
| --- | ---: | ---: | ---: | ---: | ---: |
| moderation | 146,421,880 | 21,789 | 440 / 140 | 51,370 / 0 | 53,470 / 2,610 |
| presentation | 20,464,110 | 19,310 | 160 / 120 | 16,310 / 0 | 18,700 / 2,910 |
| gamePresentation | 20,489,920 | 19,308 | 260 / 120 | 16,310 / 0 | 18,400 / 2,910 |
| **Summe** | **187,375,910** | **60,407** | **860 / 380** | **83,990 / 0** | **90,570 / 8,430** |

Das sind **99.968 % weniger tatsächliche DB-Socketbytes** im gemessenen unveränderten
Stand. Nachher 30× HTTP 304. Das ist kein Versprechen für jede Kartenzahl oder
Zustandsänderung: Nach einer Revision erfolgt vollständiges geprüftes Nachladen.
Kein pauschaler Cache und keine Intervallverlängerung. JSON-Einzelmessungen/SQL
stehen lokal unter `.artifacts/bingo-transfer/before.json` und `after.json`.

## Tatsächliche Prüfungen

- 5 Clienttests: serialisierte parallele Abrufe, ETag/304, Offline-Recovery,
  aktive/wartende Abbrüche, Remount, Timeout und DB-Zeit einschließlich Pause.
- Zusätzlich ist der isoliert gestagte Fix **ohne Druckdesignänderungen** mit
  dem vollständigen PostgreSQL-Integrationsvertrag erfolgreich geprüft.
- PostgreSQL-Regression mit vier echten eingefrorenen Originalasset-Sätzen:
  Initiales SQL lädt keine Binärfelder; 304 lädt weder Snapshots, Karten noch
  Journal. Änderung liefert 200/neuen Validator. Fremde Rollen/entzogene
  Zuordnung werden auch im Statuspfad abgewiesen. Direkte und stabile
  Präsentationsreader werden auf dieselbe SQL-Grenze geprüft.
- Bestehende AP1/AP2/AP3-/Eventtests einschließlich Konkurrenz, Request-Retry,
  Rufgrenze, Nachprüfung, vier Runden, Produktgate und unveränderlichen Karten.
- Lokaler Chromium mit frischer Admin-/Manager-/Editoranmeldung und getrennten
  Moderations-/Präsentationsfenstern: Erstellung, Kartenbindung, fünf Zahlen,
  zwei unabhängige Rufe, Kartenidentifikation/Entscheidung, frühere Korrektur,
  Nachprüfung/Widerruf, Pause/Fortsetzen, Offline/Reconnect, Reload gleicher
  Lauf/Revision, drei Runden plus Zusatzrunde, Abschluss und Editor-Abweisung.
  Viewports Moderation 1280×720, 1366×768, 390×844; Präsentation 1280×600
  und 1920×1080. Alte Quizliste weiterhin lesbar. Screenshots und Ergebnis in
  `.artifacts/bingo-event-operation/`; kein physischer Gerätetest.
- Typecheck und striktes ESLint für geänderte Fixdateien; optimierter lokaler
  Build. Tatsächliche CI-/PR-Ergebnisse werden nach Push ergänzt.

## Grenzen und Betrieb

Die Messung enthält ausschließlich unveränderte Polls nach Warm-up. Sie misst
PostgreSQL-/HTTP-Anwendungsprotokollbytes auf Loopback, keine IP-/TLS-Rahmen,
keine Vercel-Kompression und keine Neon-Abrechnung. Der Gesamtverbrauch von
11,8 GB des gesperrten Nonprod-Projekts lässt sich ohne dessen Abfragehistorie
nicht vollständig einzelnen Ursachen zuordnen. Kein Lasttest dort durchgeführt.

Die gehostete Designpreview bleibt durch das bestehende Neon-Transferkontingent
blockiert. Der Fix gibt kein verbrauchtes Kontingent frei. Keine Tarif-/Limit-
Änderung, kein Merge, Production-Deployment, Production-Backup oder Restore.
Der vorhandene vollständige lokale Integrationscheck verwendet ausschließlich
entbehrliche synthetische Datenbanken. Bestehende Production-Daten und Sessions
bleiben unverändert. Geöffnete laufende Präsentationen wurden nicht bedient.
