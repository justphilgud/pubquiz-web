# Bingo-Abendkartensatz und SRA3-Sammeldruck

Stand: 28.11.2026. Ergänzt die bestehende [Vorbereitung](bingo-preparation.md),
[SRA3-Ausgabe](bingo-sra3.md) und den [Abendablauf](bingo-evening-dramaturgy.md).
Der bisherige Abenddruck und alle gespeicherten Einzelserien bleiben verfügbar.

## Zweck und Bedienung

`/bingo/<id>/karten#abendkartensatz` ist der zentrale Einstieg. Alle bis zu zehn
Runden erscheinen in ihrer Abend-Reihenfolge, unabhängig von Zahlen-/Themeninhalten.
Bei Neuanlage wird die Standardmenge (1–1000, Vorgabe 100) mit den Runden atomar
gespeichert. Historische Abende erhalten beim Lesen dieselbe Vorgabe, ohne Backfill.
Ein leeres Mengenfeld übernimmt den Standard; eine eigene Menge überschreibt nur
diese Runde. Abgewählte Runden bleiben erhalten und werden weder erzeugt noch gedruckt.
Wildcards haben unabhängig davon eine Menge von 0–1000.

| Aktion | Wirkung auf Bestand | Wirkung auf Druck |
| --- | --- | --- |
| Auswahl/Mengen bearbeiten | Keine | Noch kein gespeicherter Satz |
| Auswahl und Mengen speichern | Keine | Planung revisioniert gespeichert |
| Kartensatz vorbereiten, Bestand leer | Erstmalige Erzeugung für ausgewählte Abschnitte | Unveränderliches Manifest |
| Kartensatz vorbereiten, Bestand ausreichend | Bestehende Karten wiederverwenden | Dieselben stabil ausgewählten IDs |
| Bestand vorhanden, Menge zu klein | Sperre mit konkreter Fehlmenge | Kein unvollständiger Satz |
| Zusatzkarten erzeugen | Ausschließlich ausdrücklich angeforderte Zusatzmenge | Alte Manifeste unverändert |
| PDF herunterladen / Vorschau | Nur lesen | Gefrorene IDs und Druckstände |

Weniger geplante Karten wählt die ersten N Karten in stabiler Bestandsreihenfolge
(Serien-Anlagezeit, Serien-ID, Kartenordinal). Überzählige Karten werden weder
gelöscht noch neu zugeordnet. Nicht mehr zugeordnete alte Serien werden nicht als
leerer Bestand verschwiegen: Wiederzuordnung oder ausdrücklicher Zusatzschritt.
Die Zusatzmenge erhöht den Bestand, nicht eigenmächtig die gewünschte Druckmenge.

## Wildcards und Spielzuordnung

Wildcards sind eigenständige, unveränderliche Serien im vorhandenen Kartenmodell.
Sie verwenden das eingefrorene Zahlen-/Themenmapping der tatsächlichen letzten
Runde, auch wenn diese vom normalen Druck abgewählt ist. Die Druckbarkeit aller
75 Begriffe wird mit den bestehenden V3-/V4-Prüfungen vor Abschluss geprüft.
Fehlende Runde, ungültige oder nicht passende Inhalte verhindern die gesamte Aktion.

Die öffentliche Kennung lautet `WC-<Serienbuchstaben>-<Ordinal>`, beispielsweise
`WC-C-001`. Das normale `C-001` löst diese Karte ausdrücklich nicht auf. Die interne
unveränderte UUID/BG-Identität bleibt erhalten; bestehende normale Kurzkennungen
ändern sich nicht. Export, Kartenliste, Moderation und eingefrorene Deckanzeige
verwenden denselben Formatter. Die Rückseite verwendet STELP-Dunkelblau (`#062C3D`) aus der bestätigten
Sieben-Farben-Palette. Wie bei den Rundenkarten stehen LOVD und Phil Gud darauf,
Phil Gud immer im farbigen Original. Oben steht „Wildkart“ statt der Rundennummer, der WC-Code bleibt erhalten;
auf ausdrücklichen Nutzerwunsch gibt es keine zusätzlichen Texte „WILDCARD“ oder
„Nur in der letzten Runde“ auf der Karte.
Ein individuelles Umgestalten dieser neuen Serien ist gesperrt.

Die Datenbank verhindert Fremdrunden-Zuordnungen. Nach angelegten Wildcards bleibt
deren Ziel die letzte Runde; eine neue Runde dahinter oder eine entsprechende
Umsortierung wird verständlich abgewiesen. Andere Runden dürfen untereinander
verschoben werden. Dies verhindert eine nachträgliche Umdeutung gedruckter Karten.
Bestehende Lauf-Mitgliedschaften und die Gewinn-/Ziehungsregeln bleiben maßgeblich.
Ein laufender Abend oder bereits verwendete Zielrunde sperrt neue Karten im neuen
Sammelpfad; gespeicherte Sätze bleiben lesbar.

## Persistenz und Zuständigkeiten

- `bingo_card_set_settings`: eine aktuelle, streng validierte Planung je Abend.
- `bingo_evening_card_sets`: unveränderliches Manifest mit geordneten Abschnitten,
  Karten-UUIDs und vollständigen gefrorenen Druck-Snapshots; Anfrage-ID/Hash für Retry.
- `bingo_wildcard_series`: unveränderliche Zuordnung Serie/Abend/letzte Runde mit
  zusammengesetzten Fremdschlüsseln und verzögert geprüfter Letztrunden-Invariante.

`cardSet.ts` hält Mengen-/Auswahlregeln, `cardSetManifest.ts` die gespeicherte Form.
`cardSetRead.server.ts` liest Bestand/Planung ohne Asset-Ingestion. Der Writer nutzt
frische bestehende Autorisierung, Spiel-Lock, Serienprüfung und Vorbereitungs-CAS.
Er delegiert Erzeugung und Druck-Snapshot-Aufnahme an die bestehenden Funktionen;
neue parallele Karten- oder Zufallslogik gibt es nicht. Fehler rollen die gesamte
Transaktion zurück. Wiederholte Erzeugungsanfragen werden vor CAS, nach erneuter
Autorisierung, auf denselben Hash geprüft. Archive bleiben lesend zugänglich.

Der PDF-Endpunkt hat einen getrennten Read-only-Importgraphen und eine
`REPEATABLE READ`-Transaktion. Er liest alle Manifest-Karten und prüft Integrität,
Abend- und Wildcard-Zuordnung. Spätere Quellassets, Druckversionen, Mengenänderungen
oder Zusatzkarten können den gespeicherten Satz nicht verändern. `no-store` und
Autorisierung gelten auch für eingebettete PDF-Vorschauen.

Die additive Migration schreibt keine alten Daten um. Backup-Inventar und strikte
JSON-/Routine-/Triggerprüfung berücksichtigen die neuen Tabellen und eingebetteten
Druckassets. Der exakte Release-Plan ist im Feature-PR enthalten; Owner-Freigaben,
geschützter Preflight und Deployment bleiben unverändert vorgeschrieben.

## Verbindliche Druckgeometrie des neuen Sammelsatzes

| Eigenschaft | Wert |
| --- | --- |
| Alle PDF-Seiten | SRA3, 320 × 450 mm, Hochformat |
| Ausschießung | 3 Spalten × 4 Zeilen, höchstens 12 Karten |
| Karten-Endformat | 92,5 × 92,5 mm, keine nachträgliche Skalierung |
| Fester Anschnitt | 3 mm umlaufend, Fläche 98,5 × 98,5 mm |
| Abstand zwischen Endformaten | 12 mm |
| Schnittmarken | Nur am Papieraußenrand: 1 mm eingerückt, 4 mm lang, 0,3 pt, gestrichelt und kontrastgerecht hell/dunkel |
| Ausrichtung | Links/rechts waagerecht, oben/unten senkrecht: jeweils orthogonal zur Papierkante und exakt auf den Karten-Endkanten |
| Freiraum zum Anschnitt | Mindestens 1,25 mm; keine Marken in Karten- oder Anschnittflächen |
| Rückseiten | Gesamter SRA3-Bogen vollflächig in Rundenfarbe, einschließlich Rändern, Stegen und leeren Plätzen |
| Vorderseiten | Gesamter SRA3-Bogen in der gespeicherten Vorderseiten-Hintergrundfarbe, ebenfalls mit Rändern, Stegen und freien Plätzen |
| Duplex | Lange Kante; Spalten gespiegelt, Zeilen unverändert |
| Teilbogen | Keine zusätzlichen Kartenmotive; auch die unbesetzten Rückseitenplätze sind voll eingefärbt; Spiegelung im vollen Raster |
| Ausgabe | 100 %, tatsächliche Größe; keine Druckdialog-Zugabe nötig |

Die alten Renderer zeichnen weiterhin die Karten, Schriften, Logos, Zahlen und
Begriffe. `cardSetPdf.server.ts` bettet deren einzelne Vektorkarten ohne Skalierung
ein und ergänzt ausschließlich die neue Ausschießung, Anschnittflächen und Marken.
Runden beginnen jeweils auf einem neuen Duplex-Bogenpaar. Rundennummer und Farbe
stehen auf jeder Rückseite; der separate beschriftete Wildcard-Abschnitt folgt
zuletzt. Es gibt keine Trennseiten mit anderem Papierformat.

Die Seitenzahl lautet je Abschnitt `2 × ceil(Karten / 12)`; Wildcards sind ein
eigener Abschnitt. Beispiel: 13 + 14 + 13 Wildcards = 40 Karten, 12 Seiten/6 Bögen.
Es gilt die bestehende 20-MB-Grenze; ein zu großer Export liefert keine Teil-PDF.

Eine PDF-Seite besitzt technisch nur jeweils **eine** TrimBox und BleedBox, keine
zwölf unabhängig zuweisbaren Seitenboxen. Media/Crop/Trim/BleedBox beschreiben
deshalb den vollständigen SRA3-Bogen. Die pro Karte eindeutigen Endformat- und
Anschnittkoordinaten stehen in der eingebetteten `ausschiessung.json`; die
Schnittmarken kennzeichnen die einzelnen Endformate. Die UI-Geometrievorschau
unterscheidet Schnittkante (blau), Anschnitt (rosa) und Marken (schwarz). Diese
Hilfslinien werden nicht auf den fertigen Karten gedruckt.

## Ansatzmarken für die Schneidemaschine

Letzte Nutzerkorrektur: Die Marken dienen zum Ansetzen der Schneidemaschine und
liegen deshalb ausschließlich am Papieraußenrand. Die bisherigen kurzen Marken
an den Kartenecken im Bogeninneren entfallen ausdrücklich. Die zentrale Funktion
`cardSetCutMarks()` liefert die 28 eindeutigen Vektoren: sechs senkrechte
Schnittpositionen mit Marken oben/unten und acht waagerechte Schnittpositionen
mit Marken links/rechts. Alle zeigen rechtwinklig zur jeweiligen Papierkante
auf die Karten-Endkante, nicht auf den äußeren Anschnitt. Sie beginnen 1 mm im
Bogen und reichen 4 mm nach innen; die Strichelung beträgt 1 mm / 0,75 mm Pause.
PDF und UI-Geometrievorschau verwenden dieselbe Quelle. Voll- und Teilbögen
besitzen auf Vorder- und Rückseite dasselbe Raster. Es werden keine Schnittlinien
über die fertigen Karten gedruckt. Die vollflächigen Hintergrundfarben bleiben.

## Rückseitenkorrektur 28.11.2026

Die sieben HEX-Werte wurden auf der vom Nutzer genannten
[LOVD/STELP-Farbseite](https://www.branddoq.io/stelp/farben) gegengeprüft.
Die neue Aufnahme erzwingt beide Logos auch bei ausdrücklich neu gestalteten
Serien. Auf hellen Flächen darf ausschließlich LOVD zur dunklen Kontrastvariante
wechseln. Die eingebetteten PNG-Bytes von Phil Gud bleiben identisch zum farbigen
Original. Das transparente LOVD-Lockup ersetzt bei neuen Aufnahmen das ältere opake
quadratische Logo-Bild, auch bei ausdrücklich neu gestalteten Serien ohne
Rundennummer. Das bestehende 40-%-Breitenlimit bleibt erhalten. Dies ist die
bewusste Korrektur des alten Quadratbild-Vertrags für die nun freigegebenen
farbigen Rückseiten; Vorderseiten und historische gespeicherte Logo-/
Farbsnapshots werden nicht umgeschrieben.
Alle sieben Rückseiten sind durchgehend bis in den 3-mm-Anschnitt eingefärbt;
transparente Logobereiche erhalten keinen weißen Unterleger.

Präzisierung des Nutzers: Auch die bisherigen weißen Stege und Außenränder
werden auf der Rückseite eingefärbt. Der Export zeichnet deshalb zuerst eine
Hintergrundfläche über die vollständige MediaBox (320 × 450 mm), auch bei
Teilbögen über alle freien Plätze. Das ersetzt ausdrücklich die frühere
Begrenzung auf Kartenfläche/Anschnitt. Schnittmarken verwenden dieselbe
kontrastgeprüfte helle/dunkle Tinte wie die Rundenbeschriftung. Die nachfolgend ebenfalls freigegebenen Vorderseiten erhalten denselben
vollflächigen Bogenauftrag, jedoch mit ihrer gespeicherten Vorderseiten-
Hintergrundfarbe. Kartenmotive, Zahlenfelder, Maße, 3-mm-Anschnitt und
Duplex-Zuordnung bleiben erhalten.

Der Offline-Generator `scripts/testing/generate-bingo-color-examples.ts` liefert
sieben Rundenfarben plus dunkelblaue Wildcard ohne Datenbankzugriff. Er prüft
beide Logoassets und die unveränderten Phil-Gud-Bildbytes. Das Übersichts-PDF ist
für die Designprüfung, das separate SRA3-PDF enthält vollständige Duplex-Bögen.

## Regressionen und Grenzen

`cardSet.test.ts` prüft Mengen, Überschreibungen, Auswahl, Seitenzahlen und alle
zwölf Geometrien/Spiegelungen/Abstände. `exportBoundary.test.ts` schützt beide
PDF-Endpunkte und die Kartenübersicht vor Importen des Erzeugungs-/Assetpfads.
`cardSetPdf.test.ts` prüft die neue Ausschießung mit tatsächlichen V3- und
V4-Vektorkarten ohne Datenbankzugriff oder Veränderung der gefrorenen Eingaben.
`bingo-card-set.acceptance.ts` erweitert die echte isolierte PostgreSQL-Abnahme um
Retry, Rollen, Bestandserhalt, Themen-Wildcards, Codes, mehrteilige Zusatzserien,
Laufsperren und Read-only-Downloads. Der eigenständige Release-Delta-Test prüft
exakte SQL-/Schema-Bytes, leere neue Tabellen, alte Zeilen/Leser, Constraints und
Transaktionsrückweg. Bestehende V3/V4-/Matching-/Lauf-/Restore-Regressionen bleiben.

Der lokale HTTP-Browsertest deckt Neuanlage, Mengen, Abwahl, Speichern/Reload,
Erzeugen, wiederholten PDF-Abruf und Desktop/Mobil ab. Der
[Abnahmebericht](../acceptance/bingo-card-set-2026-11-28.md) enthält echte gerenderte
PDFs, Messwerte und Screenshots. Ein physischer Duplex-Test am konkreten Drucker
bleibt erforderlich: Papiertransport/Registrierungsabweichungen des Geräts können
Softwaretests nicht nachweisen. Kein Merge oder Production-Deployment aus der
technischen lokalen Abnahme ableiten.
