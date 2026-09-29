# OpenTDB Production-Plan +492 (2026-09-29)

## Umfang

- AP-Ausgangsbestand: 713 Production-Fragen
- Bereits importierte Canary-Fragen: 3 (`#726` bis `#728`)
- Eingefrorener Hauptimport: 492 Fragen
- Erwarteter AP-Zuwachs nach erfolgreichem Import: 495 Fragen
- Beim read-only Preflight festgestellter Production-Bestand: 718 Fragen
- Erwarteter Production-Bestand nach dem Import: 1.210 Fragen
- Batch-ID: `opentdb-production-plus492-20260929`
- Plan-SHA-256: `3856a668447c00319d8a935ba733634b1d77d3dad3d6c4177520526d9f2d063d`

## Qualitäts- und Sicherheitsstatus

- 1.267 eindeutige Kandidaten wurden bewertet.
- 524 Kandidaten erfüllten den unveränderten automatisierten Production-Qualitätsvertrag.
- Der ursprüngliche 497er-Plan wurde im echten read-only Production-Preflight geprüft.
- 492 Kandidaten erhielten `CREATE`; fünf semantisch ähnliche Kandidaten erhielten `REVIEW_REQUIRED` und wurden ohne Ersatz entfernt.
- Alle 492 verbleibenden Einträge sind `VERIFIED`, `READY_FOR_REVIEW` und `AUTO_APPROVED_FOR_PRODUCTION`.
- Jeder Eintrag besitzt genau vier eindeutige Antworten.
- Kandidaten-IDs und externe Referenzen sind innerhalb des Plans eindeutig.
- Es werden ausschließlich bereits aktive Production-Kategorien verwendet.
- Quellen-, Sprach-, Dubletten- und Qualitätsgrenzen wurden nicht gelockert.
- Es gibt keine Medienobjekte, Migrationen, Schemaänderungen oder Runtime-Codeänderungen in diesem Plan.

Ausgeschlossen wurden die fünf Kandidaten zu Ankara/Türkei, Suezkanal, Mount Logan, Napoleons Geburtsort und Radius/Beinknochen. Die konkreten bestehenden Frage-IDs und Similarity-Befunde stehen im maschinenlesbaren Prüfbericht.

## Verteilung

Schwierigkeit:

- 25: 161
- 50: 185
- 75: 146

Die frühere weiche Kategorieobergrenze von 15 Prozent wurde auf ausdrückliche Freigabe für diesen Lauf nicht als Blocker angewendet. `Kultur` (77) und `Wissenschaft` (75) liegen über dem rechnerischen früheren Grenzwert von 74. Quellen-, Sprach-, Dubletten- und Qualitätsregeln bleiben unverändert.

Die vollständige Kategorien-, Mapping-, Ablehnungs- und Production-Preflight-Verteilung steht im maschinenlesbaren Prüfbericht `opentdb-production-plus492-plan-20260929.json`.

## Ausführungsgates

Vor dem ersten schreibenden Production-Zugriff bleiben zwingend:

1. unveränderter 492er-Plan nach erfolgreicher Main-CI,
2. frisches vollständig validiertes Production-Backup,
3. erneuter Production-Preflight mit `CREATE=492`, `ALREADY_PRESENT=0`, `CONFLICT=0` und `REVIEW_REQUIRED=0`,
4. geschützter Writer-Job im Environment `operations-content-import`,
5. anschließende Bestands-, Stichproben- und Idempotenzprüfung.

Die drei Canary-Fragen werden nicht erneut importiert. Zwei andere seit dem AP-Ausgangsbestand hinzugekommene Production-Fragen bleiben unberührt und erklären den erwarteten Gesamtbestand von 1.210.
