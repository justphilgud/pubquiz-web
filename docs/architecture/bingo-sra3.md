# Bingo-Druck auf SRA3

Stand: 20.11.2026. Ergänzt [V3](bingo-card-design-v3.md), [V4](bingo-print-templates-v4.md) und [Vorbereitung](bingo-preparation.md). Keine Änderung von Kartenidentität, Spielregeln, Livezustand oder Ausgabehistorie. Abnahme: [Prüfbericht](../acceptance/bingo-sra3-2026-11-20.md).

## Zuständigkeiten und Bedienung

`PrintFormatFields` ist die gemeinsame Auswahl in der normalen Rundenvorbereitung und den bestehenden individuellen bzw. zentralen Druckeinstellungen. Sie zeigt Papierformat und wirksame Kartenkante getrennt. Auf SRA3 bleibt das zuletzt wirksame, auch geerbte Profil erhalten. Direkte Auswahl ohne abweichende Einstellung übernimmt A4-vier/92,5 mm. Bei SRA3 ist die Kartengröße ausdrücklich sichtbar und zwischen den drei bisherigen Profilen wählbar.

Geometrie, Profilwechsel und strikte Eingabeprüfung liegen in `printFormats.ts`. Die Renderer bleiben für Zeichnung, Farben, Originalassets, Schriften, Textpassung und Kennungen zuständig. Insbesondere richten sich die V3-Grenze von 36 Zeichen und die V4-Zahlengröße des 89-mm-Profils nach dem Kartenprofil, nicht nach dem Druckpapier. Numerische, Text- und gemischte Karten verwenden denselben vorhandenen Renderer. SRA3 erhält keinen eigenen Kartenstil.

Die Erzeugung übernimmt optional `printLayout` in den bestehenden revisionsgesicherten/idempotenten Befehl. Ohne ausdrückliche Auswahl bleiben bisherige Standard- und Vererbungsregeln bestehen. Layout ist Teil des Anfragehashs; Wiederholung mit verändertem Profil wird abgewiesen. Autorisierung, Sperren, Mengenlimits, vollständiger Transaktionsrollback und Ausgabezahlen bleiben unverändert. Die Auswahl bei Erzeugung ändert nicht automatisch den Reihen-/Eventstandard.

## Persistenz und Invarianten

- `PrintLayout`: altes `{format}` bleibt gültig; SRA3 benötigt ausdrücklich `{format:'SRA3_TWELVE',cardProfile:'A4_FOUR'|'A4_SIX'|'A6_ONE'}`. Fremde Felder, fehlende oder ungültige SRA3-Profile werden abgewiesen.
- Individuelle Einstellungen speichern das Profil in `settings.layout`; zentrale Druckauswahl Version 2 ergänzt `cardProfile` nur für SRA3. Alte Auswahlwerte werden nicht umgeschrieben.
- V3/V4-Snapshots frieren Papier und Profil einschließlich vollständiger Einstellungen und Assetbytes ein. Das Profil ist Bestandteil des bestehenden Designhashs. Wiederabruf, Einzelkarte, Bogen, PDF-Vorschau und Export lesen diesen unveränderlichen Stand.
- Alte V1/V2/V3/V4-Druckstände bleiben exportierbar. Bestehende Karten erhalten SRA3 nur über gespeicherte Druckeinstellungen → vorhandene Serienvorschau → bewusste Bestätigung einer zusätzlichen Druckversion. UUIDs, Zellen, Zahlen/Texte und Kurzkennungen bleiben erhalten.
- Bestehende JSON-Spalten und CHECK-Verträge erlauben die additive Layoutinformation; keine Schemaänderung oder Datenmigration erforderlich. Ein späterer Code-Rollback muss SRA3-Werte verstehen oder deren Nutzung vorher beurteilen; alte Parser können neue SRA3-Werte nicht lesen.

## Verbindliche Bogengeometrie

Echte PDF-Seiten 320 × 450 mm, Hochformat, 3 Spalten × 4 Reihen. 5 mm Abstand, vorhandene Schnittmarken außerhalb der Karten. Horizontal und vertikal zentriert; restliche Fläche wird Außenrand. Alle Maße gelten bei tatsächlicher Größe/100 %.

| Kartenprofil | Kante | Außenrand links/rechts | Außenrand oben/unten |
| --- | ---: | ---: | ---: |
| A4-vier | 92,5 mm | 16,25 mm | 32,5 mm |
| A4-sechs | 89,0 mm | 21,5 mm | 39,5 mm |
| A6-eins | 93,0 mm | 15,5 mm | 31,5 mm |

Duplex folgt der langen Kante: auf jeden Vorderseitenbogen folgt unmittelbar sein Rückseitenbogen. Reihe bleibt, Spalte wird `2 − Spalte`. Es wird stets das vollständige Dreispaltenraster gespiegelt, niemals die Zahl belegter Karten; Texte/Logos bleiben aufrecht. Restplätze bleiben korrespondierend frei. 13 Karten ergeben vier Duplexseiten bzw. zwei Vorderseiten. Explizite Teilbereiche beginnen im ersten Platz ihres eigenen Bogens; Kurzkennungen und Kartenreihenfolge bleiben erhalten. Die Grenzen von 200 Karten/20 MB und vollständige Downloadaufteilung gelten weiterhin.

## Prüfverträge

`printFormats.test.ts`: Profile, Mindestabstände, vollständige Spiegelung, direkte Auswahl und strikte Parser. `sra3Pdf.test.ts`: echte PDF-Seiten, V3/V4, beide Marken, individuelle Schriften/Farben, Zahlen/Text/Mischung, 89-mm-Textgrenze und 1/12/13-/Teilbereichsexporte. `bingo-print-template.acceptance.ts`: echte isolierte PostgreSQL-Erzeugung aus geerbtem Profil, Wiederholung, Reload, neue und historische Druckversionen mit unveränderten Identitäten.

`bingo-sra3.browser.mjs` prüft den normalen lokalen Bedienweg einschließlich Neuanlage, direkter SRA3-Auswahl, 13 Karten, Reload, echter Downloads, gespeicherter Canvasvorschau und Laptop/Mobil. Er erlaubt ausschließlich lokale Ziele und synthetische Konten. `bingo-sra3.verify.py` misst unabhängige PDF-Rechtecke und Textpositionen, prüft Kennungen/Zellen und vergleicht ausgeschnittene Vorder-/Rückseiten mit Poppler bei 144 dpi. Physische Druckerregistrierung bleibt gesondert zu prüfen.

## LOVD-Partnerkorrektur in PR174 (20.11.2026)

Für neue LOVD-Druckstände gilt [der Nachtrag mit regulärem Muster und Messungen](../acceptance/bingo-lovd-pr174-2026-11-20.md). Der geerbte V3-Frontpfad bleibt hinsichtlich Raster, Größen, Schriftdateien und Textpassung erhalten. Implizite Standardfarben werden auf den häufigsten Rotton der eingebetteten originalen Rückseitenkachel `#74291D` (Kopfzeile und Freifeld) / BINGO Creme Catalana `#FFF9E9` korrigiert; explizite individuelle Farbfelder und Schriftentscheidungen bleiben erhalten.

Die neue optionale gespeicherte Gestaltungsvariante `partnerBack:1` nutzt oben die rote LOVD/STELP-Originalkachel (`/branding/lovd/lovd-stelp.png`), darunter das transparente Phil-Gud-Original, freie L-Schutzzonen und die gemeinsame Partner-Rückseite mit × und regulärer grauer 6,5-pt-Kennung. V3-Snapshots mit diesem Marker enthalten zusätzlich den streng geprüften eingefrorenen `codeFont` (Arimo Regular 400). V3 ohne Marker behält unverändert die alte Rückseite und seine bisherige JSON-Struktur. V4 behält sein Frontlayout und seinen bisherigen Pflicht-`codeFont`; neue LOVD-Systemwerte enthalten ebenfalls den Marker. Der Marker ist eine versionierte Gestaltungsentscheidung, kein Papierformat und keine Umstellung auf V4.

Auflösung und neue Captures wenden den Adapter an; ein gespeicherter Snapshot wird beim Lesen/Export niemals nachträglich angepasst. Bewusste Neugestaltung erzeugt nur eine zusätzliche unveränderliche Druckversion. Bestehende CHECK-Verträge für JSON und Layoutversionen erlauben den optionalen Variantenmarker; keine Tabellen-, Schema- oder Datenmigration. Backup-Inventur/Checksummenprüfung berücksichtigt den zusätzlichen V3-Schriftasset. Keine neuen globalen Fonts, anderen Eventdesigns oder reinen Phil-Gud-Standards.

Regressionen: `lovdPrint.test.ts`, erweiterte echte `bingo-print-template.acceptance.ts`, regulärer Browserlauf mit `--lovd-correction` sowie unabhängige `bingo-lovd.verify.py` (PDF-Farben, Schriftkonturen, Schutzzonen, Transparenz, ×, A-012 und historische Wiederexporte).
