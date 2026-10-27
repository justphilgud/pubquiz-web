# Bingo AP2 – quadratische Druckkarten, Vertrag V2

## Entscheidung und Grenzen

Dieser ausdrücklich beauftragte Vertrag ersetzt das rechteckige AP2-Drucklayout
für **neue Druckstände**. AP1-Regeln, Karten-UUIDs, Zahlen, technische Kennungen,
Serien-/Rundenzuordnungen und Ausgabemengen bleiben unverändert. Historische
Druckstände werden nicht umgeschrieben. Keine Laufzeit, kein AP3 und keine zweite
Templateverwaltung. Die bewusste gestalterische Änderung widerspricht nicht dem
Designmanifest: Markenassets und Typografie bleiben original; die Papierkarte
erhält eine eigene, zur Aufgabe passende Komposition.

## Verantwortung und Vererbung

Die vorhandene `presentation_templates.theme_config_json` erhält optional
`bingoPrint` (Vertragsversion 1). Alte Konfigurationen bleiben unverändert gültig.
Der vorhandene Template-Editor enthält dafür einen abgegrenzten Druckbereich.
Nullable `bingo_print_config` an Eventreihe und Bingo-Spiel bilden ausdrücklich
gespeicherte Druckabweichungen ab. Auflösung: Spielabweichung → Reihenabweichung →
gewählte gemeinsame Vorlage → aus deren Markenbasis abgeleiteter Druckstandard.
Die bestehende Auswahl Spielvorlage → Reihenvorlage → Phil Gud bleibt maßgeblich.
Eine Druckabweichung ist ein vollständiger, sichtbarer Druckblock; null bedeutet
echte Vererbung, keine kopierte Konfiguration und kein widersprüchlicher zweiter Wert.

Der Druckblock enthält sechs Farben, genau ein vorderes Logo, ein oder zwei
unterschiedliche Rückseitenlogos sowie getrennte Schriftwahlen. Andere Flächen
werten ihn nicht aus. Phil Gud: vorn Phil Gud, hinten Phil Gud, BINGO Phil Gud
Display Regular. LOVD: vorn LOVD, hinten LOVD und Phil Gud, BINGO Montserrat Regular.
Die Zahlenschrift ist standardmäßig Arimo Regular. BINGO bietet Phil Gud,
Montserrat und Arimo; Zahlen Montserrat und Arimo. Phil Gud wird für Zahlen nicht
angeboten. Alle Dateien sind bereits vorhanden und lizenziert. Originale werden
selbst gehostet für echte Schriftmuster und im PDF als Regular 400 eingebettet;
keine OS-Ersatzschrift, kein Font-Upload und kein zusätzliches Werkzeug erforderlich.

`bingoPrint.ts` validiert streng Version, vollständige Schlüssel, Farben, Schriften
und vorhandene Assetverträge. Kontrastprüfung: Zahlen mindestens 4,5:1, Kopftext
und Raster mindestens 3:1. Fehler bleiben sichtbar; Benutzerfarben werden nicht
ersetzt. Der Template-Editor warnt bei Entwürfen und verhindert unlesbare aktive
Druckkonfigurationen. Die Druckspeicherung/Erzeugung weist sie ebenfalls ab.
Die Serverauswahl beschränkt Logos auf die Originale und die tatsächlich vorhandenen
Reihen-, Vorlagen- und gespeicherten Drucklogos. Manipulierte fremde Blob-URLs
werden vor einem Abruf abgewiesen; die bestehenden Asset-Schutzregeln bleiben erhalten.

`PrintDesignPanel` besitzt ausschließlich Bearbeitung, Rückmeldung und den
vorhandenen Navigationsguard. Vor Hydration und während Anfragen ist Schreiben
gesperrt. `printDesignRepository.server.ts` übernimmt aktuelle Rechte,
Produkt-/Archivgrenzen, sichere Assetaufnahme, CAS und Druckversionen. Die
Reihenverwaltung benötigt das bestehende separate Verwaltungsrecht; Spiele den
bisherigen Bingo-Verwaltungszugriff. Editor erhält keine neue Schreib-/Exportrolle.
CAS berücksichtigt auch geänderte Vererbung, Reihen- und Vorlagenauswahl.

## Persistenz, Identität und ausdrückliche Neugestaltung

Die ursprüngliche AP2-Migration bleibt bytegleich. Zwei weitere additive
Migrationen ergänzen:

- `20261027210000_bingo_print_design`: nullable Druckblöcke, unveränderliche
  `bingo_series_labels` und `bingo_print_versions`; bestehende Drucksnapshot-
  Prüfung erlaubt zusätzlich V2. Keine Änderung bestehender Karten/Serien.
- `20261027213000_bingo_label_allocation`: atomare Präfixzuteilung beim Einfügen
  einer Serie, auch für ältere AP2-Schreibwege. Bereits vergebene Präfixe bleiben
  erhalten. Game-vor-Serie-Sperrreihenfolge und eindeutiger Index serialisieren
  parallele Erzeugung. Keine nachträgliche Änderung der bereits ausgeführten SQL-Datei.

Kurzkennung: persistierter Serienpräfix A … Z, AA … plus Ordinalzahl, z. B.
`A-001`. Eindeutig **innerhalb eines Spiels**, nicht global. Technische UUID und
vollständiger `BG-…`-Code bleiben erhalten. Kein Kürzen/Hash-Raten. Neuer Export
oder neues Design ändern die Kurzkennung nicht. Die Suche der ausgewählten Serie
findet beide Kennungen. Dieser Vertrag kann später eine Papierkarte innerhalb des
bekannten Spiels zur Gewinnprüfung auswählen; keine heutige Teilnahme-/Gewinnfunktion.

Originalversion 1 bleibt im ursprünglichen Serien-Snapshot. Bewusst bestätigte
Neugestaltung fügt Version 2, 3 … mit Actor und Zeitpunkt hinzu. Die Layoutversion
des neuen Snapshots ist V2, unabhängig von seiner fortlaufenden Serienversion.
Karte/Serie/Zuordnungen/Ausgabe werden dabei weder aktualisiert noch kopiert.
Vorschau-Hash bindet die tatsächlich aufgelösten Einstellungen und eingefrorenen
Assetbytes. Geänderte Gestaltung nach Vorschau oder veraltete Vorbereitungsrevision
verhindern die Bestätigung. Die alte Version bleibt ausdrücklich auswählbar.
Ohne Versionsparameter ist immer die ursprüngliche Version 1 maßgeblich; ein
normaler Download übernimmt niemals still einen neuen Druckstand.

## PDF und verbindliche Vorschau

`pdfSquare.server.ts` zeichnet V2, `pdf.server.ts` erhält den historischen V1-Pfad.
V2: vier ganze Quadrate mit je rund 92,5 mm Kantenlänge, A4 Hochformat, 10 mm Rand,
5 mm Abstand. Die restliche Seitenfläche bleibt frei. BINGO-Kopf, vollständiges
5×5-Raster, genau ein vollständiges Original-Logo statt Text im freien Zentrum,
dezente Kurzkennung. Kein Spieltitel, Rundentitel oder Serienumfang. Rückseiten
enthalten ausschließlich gewählten Hintergrund und ein großes zentriertes oder
zwei gleich gewichtet angeordnete Logos. Seitenverhältnisse bleiben erhalten.
Schnittmarkierungen liegen außerhalb der fertigen Quadrate.

Die Vorschau benutzt **denselben PDF-Renderer** wie der Download. Sie bietet
Vorder-/Rückseitenumschaltung und einen direkten Vorschau-PDF-Link. Eine reine
Gestaltungsvorschau verwendet synthetische Werte; die Neugestaltungsvorschau die
erste tatsächlich gespeicherte Karte der ausdrücklich gewählten Serie.
Änderungen machen die angezeigte Vorschau ungültig; Speichern ist ausdrücklich.

Sichtbare Originalkonturen und eingebettete durchsuchbare Textebene bleiben
erhalten. Die Zentrierung verwendet die tatsächlichen Glyphenkonturen des
Regular-400-Schnitts einschließlich Offsets; Transformationen sind pro Lauf und
Glyph isoliert. Die frühere gemeldete Kollision benachbarter Zahlen wurde mit
den vorhandenen PDFs unter Poppler nicht reproduziert; kein historischer
Ursachenfix wird behauptet. Neue PDF- und Rastertests prüfen echte Zellen,
sichtbare Ziffernränder, alle vier Positionen, Folgeblätter und alle Schriftwahlen.

Duplex: Vorderseitenbogen, zugehöriger Rückseitenbogen, nächster Vorderseitenbogen
usw. Bei Wenden an langer Kante werden die Kartenpositionen horizontal gespiegelt,
die Logos selbst nicht. Bei unvollständigen Bögen bleiben die korrespondierenden
Rückseitenplätze leer. Bereich 2–6 ist genauso möglich wie 1–5. Öffentliche
Exportmodi ausschließlich `front` und `duplex`; `back` ist interne Einzelvorschau.
Höchstens 200 Karten pro PDF bleiben bestehen; Duplex ergibt höchstens 100 Seiten.
Zusätzliche technische Grenze 20 MB: expliziter Fehler statt Teil-/Leerdatei.
PDFs werden nicht dauerhaft in der Datenbank gespeichert.

Empfohlener Druck: A4 Hochformat, tatsächliche Größe/100 %, beidseitig, an langer
Kante wenden. Kein zusätzliches Spiegeln oder automatisches Anpassen. Zuerst einen
Testbogen drucken. Die mathematische Zuordnung ersetzt keinen physischen Test der
druckerspezifischen Registrierung; dieser wurde nicht durchgeführt.

## Betrieb und Tests

Bestehende dynamische Dump-/Kataloginventur erfasst neue Tabellen, Trigger,
Spalten, Rechtebeziehungen und eingefrorene Bytes. Der eng begrenzte Snapshot-
Validator prüft auch `bingo_print_versions.snapshot`; keine pauschale Ausnahme für
JSON, Assets oder Geheimnisse. Keine manuellen Backups/Restores gestartet.
Migrationen und Beispieldaten ausschließlich isoliert. Ein späterer Release muss
diese Migrationen vor dem neuen Code beachten; kein unbedachter Rückfall auf
Parser, die `bingoPrint` noch nicht kennen.

Tests: `test:bingo-preparation`, echte PostgreSQL-Integration, bestehende
Template-/SharedDesign-/Quiz-/Karaoke-Regressionen, `test:bingo-print:browser` und
`scripts/testing/bingo-print-pdf.verify.py`. Letzteres prüft tatsächlich erzeugte
PDFs und Rasterpixel (nicht nur Textextraktion), Quadratflächen, Duplexplätze,
vollständige Logos, Fonts, gespeicherte Zahlen und Zellränder.
