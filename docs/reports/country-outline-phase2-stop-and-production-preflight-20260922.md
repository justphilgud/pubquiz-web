# Länderumrisse Phase 2 – kontrollierter Abbruch und Production-Preflight

## Abbruchstatus

Der vollständige Preview-Import wurde nicht gestartet. Angelegt wurde genau eine zusätzliche Phase-2-Einzelprobe: Afghanistan, Preview-Content-ID 116. Zusammen mit den fünf unveränderten Pilotfragen 111–115 enthält Preview damit sechs Länderumriss-Fragen (DE, IT, CL, AU, GM, AF). Es wurde nichts gelöscht.

## Vorbereiteter Production-Bestand

- Soll-Liste: 193 eindeutige UN-Mitgliedstaaten.
- Natural-Earth-Zuordnung: 193 eindeutige Features; 192 direkt über `ADM0_A3`, Südsudan über die dokumentierte Aliasregel `SSD → SDS`.
- Assets: 193 SVG- und 193 WebP-Dateien, jeweils lokal versioniert und ohne externe Laufzeitabhängigkeit.
- Antworten: je Frage genau vier verschiedene deutsche Kurznamen, davon exakt eine richtige Antwort; sämtliche Distraktoren stammen aus dem 193er-Katalog.
- Territorien: keine zusätzlichen Fragen.
- Duplikate: keine doppelten ISO-Codes, Ländernamen, Marker oder Assets.
- visuelle Prüfung: vier beschriftete Contact Sheets außerhalb der Quizassets; Sondergruppen für Kleinstaaten, Archipele/Mehrteiler, Antimeridianfälle, verworfene Kleinteile und extreme Seitenverhältnisse.
- kritische QC-Befunde: 0.

## Read-only Production-Inventur

Am 22. September 2026 ergab die Suche im angemeldeten Production-Frageneditor nach dem exakten Wortlaut `Welches Land ist anhand dieses Umrisses zu erkennen?` 0 Treffer. Production wurde nicht verändert. Bei unverändertem Wiederholungs-Preflight sind 193 neue Fragen anzulegen.

## Idempotenz und Schreibgate

Der Importplan ist anhand des eindeutigen Markers `COUNTRY_OUTLINE_V1; ISO=XX; NE=5.1.1` wiederholbar. Vor einem schreibenden Lauf werden alle exakten Wortlaut-Treffer vollständig geladen und mit dem Plan abgeglichen. Nur vollständig übereinstimmende Marker/Wortlaut/Antworten/Richtig-Markierung/Kategorie/Template/Medienanzahl werden übersprungen. Doppelte, unerwartete oder abweichende Datensätze stoppen den Lauf. Offline-Regressionen decken leeren, vollständigen und partiellen Bestand sowie Duplikat- und Abweichungsfälle ab.

`data/countries/country-outline-import-plan.json` bleibt mit `writeAuthorized: false` gesperrt. Es ist keine Production-Schreibfreigabe erteilt.
