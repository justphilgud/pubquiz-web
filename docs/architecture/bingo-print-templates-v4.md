# Bingo-Druckvorlagen V4 und gemeinsame Verwaltung

Stand: 6. November 2026. Implementierung auf `codex/bingo-print-templates-ui`, Basis
`192f27848f723559e3e18a0b9fdbbeb169a10ed3`. Keine Production-Freigabe.
Ergänzt [V3](bingo-card-design-v3.md), [Druckdesign](bingo-print-design.md) und
[Eventbedienung](event-operation-standard.md). Historische Verträge bleiben gültig.

## Bestands- und Änderungsmatrix

| Bereich | Wiederverwendeter Bestand | Gezielte Erweiterung |
| --- | --- | --- |
| Karten und Regeln | AP1-Generator, UUIDs, Zellen, Begriffssets, Nummern und Kurzkennungen | Keine neue Karten-/Spielidentität oder Regel |
| Druck | V1/V2/V3-Renderer, unveränderliche Serien und Druckversionen | Getrennter V4-Renderer für die beiden gelieferten Designs |
| Vorschau | Vorhandene PDF.js-Canvas-Vorschau mit Original-PDF und Zoom | Zentraler Zahlen-/Text-/Rückseiten-/Druckbogenzugang |
| Templates | Bestehende Tabelle, Adminaktionen, Kopie, DRAFT/ACTIVE/ARCHIVED, Revision und CAS | Zweck BINGO_PRINT und zwei getrennte System-IDs |
| Vererbung | Bestehendes bingo_print_config an Reihe und Spiel, null erbt | Version 2 referenziert zentrale Druckvorlage und Event-Papierformat |
| Verwaltung | Quiz-EventRow, tatsächliche Heroicons, Reihenpicker, validierte Rückwege | Bingo-Raster, Terminfilter, belegte Karten-/Ausgabewerte und Zusatzaktionen |
| Quiz und Live | Vorhandene Laufzeit, Design-/Antwortauswahl und Quizoberfläche | Keine Neugestaltung, keine Regeln oder Medienaktionen |

## Zentrale Zuständigkeiten und Rechte

`presentation_templates` bleibt die einzige Vorlagenverwaltung. Das vorhandene
Konfigurationsformat wird um den eindeutigen Zweck `purpose: BINGO_PRINT` ergänzt.
System-IDs: `bingo-print-phil-gud` und `bingo-print-lovd-phil-gud`. Beide unterstützen
Zahlen und Text; keine vier unabhängigen Vorlagen. Sie stehen ausschließlich in
`/templates`, nicht im Live-/Antwortformular-/gemeinsamen Design-Selektor.
Serverseitige Auswahl und Runtimeadapter weisen den falschen Zweck ab.

Bestehender Lebenszyklus: System kopieren → Entwurf bearbeiten → ausdrücklich
aktivieren → aktiven Stand nur durch neue Entwurfskopie weiterentwickeln.
Speichern prüft Administratorrecht, stabile Art/ID, Revision, Farben, verfügbare
Originalschriften und sicher ladbare Logos. Aktive Versionen bleiben unverändert.
Archivierung sperrt Vorlagen mit Reihen-/Spiel-Druckzuordnung; Auswahl und
Archivierung verwenden dieselbe bestehende Zeilensperre FOR SHARE/FOR UPDATE.

Berechtigte Bingo-Eventmanager können System-/aktive Druckvorlagen im gemeinsamen
Einstieg nur lesen und für ihre erlaubten Events auswählen. Sie sehen keine
fremden Entwürfe und erhalten kein globales Bearbeitungs-, Kopier-, Aktivierungs-
oder Uploadrecht. Alle bisherigen Schreibaktionen bleiben adminpflichtig.
Editoren und reine gemeinsame Reihenverwaltung erhalten dadurch keine neue
Bingo-Spielrolle. Objekt-, Produkt-, Archiv-, Rechteentzugs- und CAS-Prüfungen
bleiben in den bestehenden Repositories. Ein ausgeblendetes Menü ersetzt keine
serverseitige Prüfung. Die Hauptnavigation von Quiz bleibt unverändert.

## Persistenz und Vererbung

Das bestehende JSON-Feld hat genau eine maßgebliche Repräsentation:

- `null`: bisherigen Reihen-/Systemstandard erben.
- Version 1: vollständige vorhandene individuelle Druckabweichung; unverändert.
- Version 2: `{version:2, templateId, format}`; Stil ausschließlich aus der
  zulässigen zentralen Druckvorlage, Papierformat ausdrücklich beim Event bzw.
  Reihenstandard. Keine zweite parallel wirksame Stilkonfiguration.

Spiel gewinnt vor Reihe. Vorhandene Version-1-Werte werden nicht automatisch
umgestellt. Die individuelle Gestaltung bleibt ausdrücklich wählbar. Die zentrale
Vorschauformatwahl ist nur Ansicht; sie überschreibt kein Eventformat.
Vorlagenname, Stilquelle, Vererbung und zuständiger zentraler Link werden angezeigt.
Speichern verändert weder vorhandene Karten noch eingefrorene Laufzeitdaten.

Neue V4-Snapshots enthalten die wirklichen Schrift-/PNG-Bytes samt SHA-256,
Papierformat, vollständige Einstellungen und gegebenenfalls ID/Name der zentralen
Quelle. Alte Versionen hängen beim Export nicht von deren späterer Verfügbarkeit
ab. Eine Neugestaltung bestehender Karten benötigt die vorhandene Vorschau und
bewusste Bestätigung; sie fügt ausschließlich eine neue Druckversion hinzu.

## Referenzen und bewusste Abweichungen

Verbindliche Nutzervorlagen: `Bingo-Design-und-Typografie.pdf` (4 Seiten) und
`Bingo-Druckprobe-A4-A6.pdf` (6 Seiten). Keine Musterkarten werden produktiv
übernommen. Die darin eingebetteten originalen transparenten PNGs wurden
unverändert extrahiert, nicht nachgezeichnet oder generiert:

| Datei unter public/branding/bingo-print | SHA-256 |
| --- | --- |
| phil-gud.png | b9bad3476c151c03f47241ef3b4ff85e6f479d5645a22cdb30c39ed1b9a2c275 |
| lovd.png | ab4a04f53da6f81d9177519064054c74ae0b8f14c8d30026c8d57a26e975f813 |

Historische Originaldateien werden nicht ersetzt. Laden, Größenbegrenzung und
Einfrieren von Logos bleiben im vorhandenen sicheren Assetpfad.
Die bestehende lizenzierte Phil-Gud-Originalschrift wird für BINGO, Zahlen und
standardmäßig Begriffe eingebettet. Arimo zeichnet die kleine vollständige Kennung.
Vorhandene Schriftwahl, Farbwahl sowie ein vorderes/ein oder zwei hintere Logos
bleiben anpassbar. Bei einem Rückseitenlogo entfällt das gezeichnete feine ×.

Phil Gud: Weiß, Schwarz, Gelb #F0FC16, Pink #F6C4DC. LOVD: Creme #FFF8E9,
Burgund #733B40, Schwarz. Zahlen #171717, Raster #888888. Schwarze Rückseite,
Kennung neutral grau unten rechts ohne Beschriftungsbalken. Der Renderer wählt
auch für individuell geänderte Rückseiten einen mindestens 4,5:1 kontrastierenden
neutralen Kennungston. Logos werden proportional platziert.

Verbindlich bleiben die Produktionsmaße: A4 vier 92,5 mm, A4 sechs 89 mm,
A6 eine 93 mm. Der Referenzwert 95 mm für A6 wird ausdrücklich nicht übernommen.
Textbegriffe bleiben mindestens 10 pt, statt der 9 pt im Entwurf. V4 nutzt
angepasste Zellfläche, Innenabstände, echte Glyphenmetriken und bis zu drei
Wortzeilen bei 11 bis 10 pt. Zu breite Einzelwörter werden verständlich abgewiesen;
keine Kürzung, Ellipse oder horizontale Stauchung. Keine neue globale
18-Zeichen-Grenze. V3 behält seine bisherigen Regeln und seinen eigenen Renderer.

Duplex spiegelt nur belegte Kartenpositionen an der langen Papierkante; Texte
und Logos selbst werden nicht gespiegelt. Unvollständige letzte Bögen behalten
die korrespondierenden Leerplätze. Exportgrenze 200 Karten/20 MB bleibt bestehen;
1.000 unterschiedliche Karten ergeben weiterhin zwei atomare Serien und sechs
vollständige PDF-Teile. Drucken mit tatsächlicher Größe/100 % und langer Kante.

## Verwaltungsfunktionen und Grenzen

Bingo nutzt denselben Seitenrahmen, 2-Spalten-Filter und das Kartenraster der
unveränderten Quizreferenz. `EventActionLink` extrahiert deren tatsächliche
20px-Heroicons/44px-Ziele, Farben und Semantik; bestehende Quizaufrufe ändern sich
nicht. Der Regressionstest vergleicht das vollständige gerenderte Quiz-Markup
gegen den ausgelieferten Basiscommit, einschließlich SVG-Pfade und Attribute.
Navigation bleibt Link, Änderungen bleiben Buttons. Speichern/Abbrechen bleiben Text.

Terminstatus und Laufstatus bleiben getrennt. Archiviert bezeichnet bei Bingo
explizit die Reihe; ein eigenes Spielarchiv existiert nicht. Zugeordnete physische
Karten werden bei Wiederverwendung einer Serie nur einmal gezählt. Ausgabe ist
eine ausdrücklich als solche benannte Rundensumme mit Erfassungsumfang: unbekannt
bleibt „Nicht erfasst“, erfasste Null bleibt 0. Keine Teilnehmerzahl vortäuschen.
Einstellungen, Teams, Karten/PDF und Druck sind echte vorhandene Zugänge.
Bingo-Duplizieren, eigenes Spielarchiv, Löschen und separate Auswertung werden
nicht durch funktionslose Icons vorgetäuscht; umfangreiche neue Logik ist nicht
enthalten. Abschlussübersichten bleiben in der bestehenden Moderation.

## Migration, Sicherung und Rückfall

`20261106210000_bingo_print_templates_v4` erweitert ausschließlich vier bestehende
CHECK-Verträge: Drucksnapshot 4 und Druckauswahl 2. Keine neue Tabelle, Spalte,
Trigger oder Datenänderung; historische Migrationen bleiben unverändert.
Die Migration muss im vollständigen leeren und repräsentativ befüllten isolierten
Schema geprüft werden. Vorwärtsbetrieb benötigt den V4-fähigen Parser/Renderer;
ein Rückfall auf alten Code nach Speicherung neuer Werte wäre nicht sicher.

Die vorhandene dynamische Tabelleninventur erfasst neue Vorlagen und JSON-Werte.
`parsePrintSnapshot` prüft auch V4-Struktur, Schrift-/Logobytes und Prüfsummen;
`inspectRow` inventarisiert Quelle und Code-Schrift ohne Binärdaten auszublenden.
Keine pauschalen Medien-/Geheimnisfreigaben. Der isolierte PostgreSQL-Test prüft
vollen Snapshotvergleich und vollständigen Restore mit alten und neuen Druckständen.
Keine manuellen Production-Backups, Restores oder Datenänderungen für diese Abnahme.

## Regressionen und tatsächlicher Nachweis

- `printTemplates.test.ts`: strikte Vorlagenart/Auswahl, falsche Runtimeflächen,
  beide Designs × Zahlen/Text × drei Formate, eingebettete Schriften, 10pt-Minimum,
  vollständige Begriffe, korrupte Schriftprüfung und unveränderte Karten.
- `bingo-print-v4.verify.py`: tatsächliche PDFs, Seitenmaße, vollständiger Text,
  gezeichnete Glyphenkonturen innerhalb der Zellen, Logoanzahl/-proportion,
  Kennung ohne Balken, korrespondierende Rückseiten einschließlich Teilbogen.
  Die Original-Versalschrift teilt Groß-/Kleinschreibungs-Glyphen; die unabhängige
  Textprüfung normalisiert nur diese Schreibweise und Zeilenleerraum. Kontur-
  und Mindestschriftprüfungen bleiben unabhängig davon strikt.
- Bestehende V1/V2/V3-, 1.000er-, Rollen-, Konflikt-, Integritäts- und Restoretests
  bleiben erhalten; ergänzt durch `bingo-print-template.acceptance.ts`.
- `EventActionLink.test.ts`, `bingoOverviewPolicy.test.ts`: unverändertes Quiz-Markup,
  Filterrückwege, manipulierte Rückwege, Kartenwiederverwendung und unbekannt/Null.

Aktuelle Browser-/CI-Ergebnisse und verbleibende Grenzen stehen im Prüfbericht.
Kein physischer Druck- oder Duplexregistrierungsnachweis wird behauptet.

Lokale Abnahme, Bilder und konkreter Hostingblocker: [Prüfbericht](../acceptance/bingo-print-templates-v4-2026-11-06.md). Der neue `scripts/testing/bingo-print-templates.browser.mjs` prüft tatsächlich den nativen Abbruchdialog, Schrift-/Farbpersistenz, PDF-Canvas und drei gemessene Viewports.
