# OpenTDB Production-Plan +500 (2026-09-29)

## Umfang

- AP-Ausgangsbestand: 713 Production-Fragen
- Bereits importierte Canary-Fragen: 3 (`#726` bis `#728`)
- Eingefrorener Hauptimport: 497 Fragen
- Erwarteter AP-Zuwachs nach erfolgreichem Import: exakt 500 Fragen
- Batch-ID: `opentdb-production-plus500-20260929`
- Plan-SHA-256: `fb4706a5d43edcecdda035526fa8b9e55cfcf22bcc9ab3cad9d4b047a75ebf2b`

## Qualitäts- und Sicherheitsstatus

- 1.267 eindeutige Kandidaten wurden bewertet.
- 524 Kandidaten erfüllten den unveränderten automatisierten Production-Qualitätsvertrag.
- 497 Kandidaten wurden für den eingefrorenen Plan ausgewählt.
- Alle 497 Einträge sind `VERIFIED`, `READY_FOR_REVIEW` und `AUTO_APPROVED_FOR_PRODUCTION`.
- Jeder Eintrag besitzt genau vier eindeutige Antworten.
- Kandidaten-IDs und externe Referenzen sind innerhalb des Plans eindeutig.
- Es werden ausschließlich bereits aktive Production-Kategorien verwendet.
- Nicht zuverlässig belegte, nicht ausreichend lokalisierte, widersprüchliche oder qualitativ unzureichende Kandidaten bleiben ausgeschlossen.
- Es gibt keine Medienobjekte, Migrationen, Schemaänderungen oder Runtime-Codeänderungen in diesem Plan.

## Verteilung

Schwierigkeit:

- 25: 162
- 50: 187
- 75: 148

Die frühere weiche Kategorieobergrenze von 15 Prozent wurde auf ausdrückliche Freigabe für diesen Lauf nicht als Blocker angewendet. Nur `Kultur` (77) und `Wissenschaft` (76) liegen knapp über dem bisherigen Grenzwert von 75. Quellen-, Sprach-, Dubletten- und Qualitätsregeln bleiben unverändert.

Die vollständige Kategorien-, Mapping- und Ablehnungsverteilung steht im maschinenlesbaren Prüfbericht `opentdb-production-plus500-plan-20260929.json`.

## Ausführungsgates

Vor dem ersten schreibenden Production-Zugriff bleiben zwingend:

1. unveränderter Plan nach erfolgreicher Main-CI,
2. frisches vollständig validiertes Production-Backup,
3. Production-Preflight mit `CREATE=497`, `ALREADY_PRESENT=0`, `CONFLICT=0` und `REVIEW_REQUIRED=0`,
4. geschützter Writer-Job im Environment `operations-content-import`,
5. anschließende Bestands-, Stichproben- und Idempotenzprüfung.

Die drei Canary-Fragen werden nicht erneut importiert. Andere seit dem AP-Ausgangsbestand hinzugekommene Production-Fragen verändern den AP-Zielzuwachs nicht.
