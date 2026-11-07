# Bingo-Karten und Druck V3

Stand: 6. November 2026. Implementierung auf `codex/bingo-card-design-v3`.
Kein Merge oder Production-Release. Der tatsächliche Abnahmestand steht im PR.
Ergänzt [V2](bingo-print-design.md), [Vorbereitung](bingo-preparation.md) und
[Eventbedienung](bingo-event-operation.md). Alte Verträge bleiben für ihre
historischen Snapshots maßgeblich.

## Zuständigkeit und Erhalt

AP1 bleibt die Quelle der 75er-Zahlenverteilung und Gewinnregeln. Karten-UUID,
BG-Code, Kurzkennung, Zellen, Rundenzuordnung und Ausgabehistorie bleiben erhalten.
Die vorhandenen unveränderlichen Serien und Druckversionen werden weiterverwendet.
`pdf.server.ts` verzweigt nach gespeicherter Layoutversion: V1 und V2 behalten
unveränderte Renderer; V3 nutzt `pdfModern.server.ts`. Neue Karten und ausdrücklich
bestätigte Neugestaltung erhalten V3. Allgemeines Lesen alter Einstellungen stellt
keinen Druckstand um. Gespeicherte Farben und Schriftentscheidungen bleiben bei
der Übernahme erhalten. Nur bei fehlender individueller Konfiguration sind
Phil Gud Display für BINGO und Zahlen der neue Standard; Begriffe nutzen Arimo.
Publikumsdesigns und Druckdesigns bleiben getrennt.

UI-Komponenten besitzen Entwurf, explizites Speichern, Dirty-Guard und Rückmeldung.
Repositories prüfen aktuelle Rolle, Produkt, Objektbezug, Archiv und Revision.
Die bestehenden Spiel-/Produkt-/Benutzersperren bleiben erhalten. Keine neuen Rollen.

## Konfiguration, Vorschau und Export

Die Spielvorbereitung bietet direkte Links „Druckgestaltung und Vorschau“ sowie
„Karten und PDF“. Runden enthalten Menge, gespeicherte Begriffszuordnung und
vollständige Downloadaufteilung. Bestehende Formelemente, Buttons und
Navigationswachen werden verwendet. Nur diese Verwaltungsrouten erhalten die
bestehende Phil-Gud-Hülle; Moderation und Präsentation bleiben ausgeschlossen.

Vorschau und Export erzeugen dieselben PDF-Zeichnungen. Die gespeicherte
Druckvorschau liest ausdrücklich Version und Kartenbereich; sie erzeugt keine
Karten und bestätigt keine Neugestaltung. Die Gestaltungsvorschau verwendet
klar benannte synthetische Werte. Die Redesignvorschau verwendet echte Serienkarten.
Vorderseite, zugehörige Rückseite und ganzer Druckbogen sind getrennt wählbar;
historische V1-Druckstände bieten keine erfundene Rückseite.

Im angemeldeten lokalen Browser wurde die leere native PDF-Einbettung reproduziert:
Der Umschalter und die PDF-Erzeugung funktionierten, die iframe-Fläche blieb leer.
Die ausdrücklich freigegebene Abhängigkeit `pdfjs-dist` 6.5.438 zeichnet jetzt das
wirkliche PDF in Canvas, einschließlich Originalglyphen und Logos. Der Worker
wird lokal und versionsgebunden unter `/bingo/pdf-worker/6.5.438` ausgeliefert,
ohne CDN. Dokumente, Renderaufgaben und Object-URLs werden wieder freigegeben.
Seitenwahl, Seiteneinpassung und Zoom sind reine Ansicht; PDF-Öffnen bleibt verfügbar.
Die Druckversionsauswahl bleibt auch mit langen historischen Bezeichnungen innerhalb
der verfügbaren Mobilbreite. Der Druckhinweis folgt dem gespeicherten Papierformat,
nicht einem pauschalen A4-Standard.

## Formate und Typografie

| Format | Anordnung | Kartenkante | Rand / Abstand |
| --- | --- | --- | --- |
| DIN A4, vier Karten | 2 x 2, Hochformat | 92,5 mm | 10 / 5 mm |
| DIN A4, sechs Karten | 2 x 3, Hochformat | 89,0 mm | mindestens 10 / 5 mm |
| DIN A6, eine Karte | 1 x 1, Hochformat | 93,0 mm | mindestens 6 / 0 mm |

Die kleinere Sechserkarte ist horizontal zentriert; dadurch bleibt die Spiegelung
an der Papiermitte korrekt. Schnittmarken liegen außerhalb der Karten.
Duplex wechselt Vorder-/Rückseitenbogen und spiegelt nur die belegten Positionen
horizontal. Leere Plätze bleiben korrespondierend leer, auch bei Teilbereichen.
Drucken mit tatsächlicher Größe / 100 %, Hochformat, Wenden an langer Kante.
Ein physischer Druck-/Registrierungstest bleibt erforderlich und wurde nicht behauptet.

V3 enthält vorn keine Kurzkennung; sie steht unten rechts auf der zugehörigen
Rückseite, auf einem kontrastsicheren hellen Feld. Reine Vorderseitenexporte
warnen ausdrücklich vor der fehlenden Kennung. Die technische BG-Kennung bleibt
in Speicherung und Suche erhalten; das Spiel bleibt der Kurzkennungs-Scope.

BINGO, Zahlen und Begriffe besitzen getrennte Schriftwahl aus vorhandenen
Originaldateien. Neue V3-Gestaltung erlaubt Phil Gud auch für Zahlen. Keine
Fontsubstitution, künstlichen Gewichte oder geänderten Originalassets.
Sichtbare Glyphenkonturen und eingebettete durchsuchbare Texte werden gemeinsam
mit den tatsächlichen Originalmetriken gezeichnet. Unbekannte Zeichen werden abgewiesen.
Die bisherigen Farb-/Kontrastprüfungen gelten weiter.

## 1.000 unterschiedliche Karten

Eine bestätigte Erzeugung akzeptiert 1 bis 1.000 Karten. Innerhalb einer einzigen
Transaktion werden bei Bedarf zwei vorhandene Serien mit höchstens 500 Karten
angelegt. Die Spielsperre serialisiert Erzeugungen. Vorhandene Layout-Hashes des
Spiels und alle neu erzeugten Karten bilden gemeinsam die Ausschlussmenge;
Dubletten zwischen Teilserien werden verworfen. Eine fehlgeschlagene Teilserie
rollt die ganze Erzeugung zurück. Request-ID und Inhaltshash erhalten die bisherige
Idempotenz, auch bei Wiederholung einer 1.000er-Anfrage.

Die Grenze von 200 Karten / 20 MB pro PDF bleibt bestehen. Alle Teilbereiche
werden vollständig angeboten und auf Wunsch nacheinander heruntergeladen.
1.000 Karten in zwei 500er-Serien ergeben sechs Dateien (200/200/100 je Serie).
Keine stille Kürzung und keine Verdopplung von Layouts, um eine Menge vorzutäuschen.
Browser können Mehrfachdownloads bestätigen lassen; einzelne Links bleiben erreichbar.
Unterschiedliche Karten, Exemplare bei einmaligem Druck und zusätzliche Kopien
im Druckdialog werden ausdrücklich unterschieden. Downloads ändern keine Ausgabezahl.

## Text-, Bullshit- und Musikbingo

Zahlen bleiben die technische Identität; das Regelwerk bleibt 75er-Bingo.
Ein Begriffsset enthält Namen, genau 75 eindeutige Nummern von 1 bis 75 und
eindeutige nichtleere Begriffe. Normalisierte, auch nur durch Großschreibung oder
Leerraum verschiedene doppelte Begriffe werden als mehrdeutig abgewiesen.

Sets sind spielgebunden und können für neue Runden übernommen werden. Speichern
erzeugt eine neue benannte Fassung; spätere Änderungen folgen ausgegebenen Karten
nicht nach. Die Zuordnung wird in die Runde kopiert und vor Kartenerzeugung
in den unveränderlichen V3-Drucksnapshot übernommen. Eine Runde mit Karten oder
aktivem eingefrorenem Lauf kann nicht auf andere Begriffe umgestellt werden.
Zuordnen vorhandener Serien verlangt dieselbe vollständige festgehaltene
Setfassung, einschließlich Veröffentlichungsregel. Anders konfigurierte Runden
benötigen ein passendes Set bzw. neue Karten; keine stille Umdeutung.

Beim Start wird die Rundenzuordnung zusätzlich im vorhandenen Rundensnapshot
festgehalten. Moderation zeigt bereits vor Veröffentlichung den Begriff zur manuell
eingegebenen Zahl. DIRECT veröffentlicht durch die bestehende ausdrückliche
Zahlenaktion, APPROVAL fordert davor eine zusätzliche Moderationsbestätigung.
HIDDEN zeigt dem Publikum zunächst „Verdeckt“; erst „Begriff auflösen“ schreibt
ein ausdrückliches, revisionsgebundenes Journalereignis. Verdeckte Texte gelangen
nicht in die Publikumsprojektion. Eine Korrektur verbirgt den Ersatzbegriff erneut.
Auflösung verändert weder Zahl, Rufgrenze noch Gewinnprüfung. Abgeschlossene Runden
weisen sie ab. Alte numerische Rundensnapshots und Journale bleiben lesbar.
OCR ist nicht implementiert: Eine spätere Erkennung soll denselben nummernbasierten
Vorschlags-/Freigabeweg bedienen, keine eigene Veröffentlichung oder Gewinnlogik.

## Textpassung

Zeichenobergrenzen sind 40 pro Begriff für A4-vier/A6 und 36 für A4-sechs.
Das sind Vorgrenzen, keine Passgarantie. Maßgeblich sind die eingefrorene Schrift,
tatsächliche Glyphenbreite, Feldkante, Zeilenumbrüche und vertikale Metriken.
Der Renderer bevorzugt vollständige Wörter und prüft dafür 14 bis mindestens
10 pt in halben Schritten. Erst wenn ein Einzelwort selbst bei 10 pt zu breit
ist, wird es zusätzlich innerhalb des Wortes umgebrochen. Zeilenhöhe ist 1,2. Auch die vollständige Ober-/Unterlänge
muss passen. Alle 75 Begriffe werden vor Kartenpersistenz und jedem PDF geprüft,
nicht nur die zufällig auf den ausgewählten Karten vorkommenden.
Zu lange oder nicht unterstützte Begriffe erzeugen einen verständlichen Fehler;
keine Kürzung, kein Clipping, keine unbegrenzte Verkleinerung.

## Migration, Betrieb und Rückfall

`20261106180000_bingo_card_design_v3` ist additiv: neue spielgebundene Tabelle
`bingo_term_sets`, nullable `bingo_rounds.term_snapshot` und Erweiterung zweier
Snapshot-Versionsprüfungen auf V3. Keine Änderung bestehender Zeilen, IDs oder
historischer Migrationsdateien, keine neue Funktion und kein Trigger.

Die dynamische Inventur und der schemaweite Dump erfassen die neue Tabelle und
Spalte. Snapshotvalidierung prüft auch eingefrorene Textschrift und Begriffsstruktur;
die vorhandene Inhaltsprüfung untersucht neue Textwerte zusätzlich. Keine pauschale
JSON- oder Katalogausnahme. Lokale vollständige Snapshot-/Restorevergleiche
schließen synthetische V3-Daten ein. Dies ist kein Production-Backup oder Wochenlauf.

Isolierte Tests verwenden die dokumentierte historische Modellbasis plus
unveränderte geprüfte Migrationen; kein behaupteter vollständiger chronologischer
Replay alter Bootstrapmigrationen. Die V3-Migration wird mit leerem Bingo-Bestand
und echten vorab angelegten gültigen V2-Karten geprüft. Alte IDs, Zellen, Runde,
Kurzkennungspräfix und V2-Druckbytes müssen erhalten bleiben.

Nach Speicherung von V3-Snapshots oder Auflösungsereignissen ist ein unbedachter
Rückfall auf ältere Parser nicht geeignet. Keine Production-Migration wurde für
diese Abnahme ausgeführt. Die Preview nutzt ausschließlich eigene synthetische
Datenbank und das freigegebene Branch-Medienpräfix. Der gemeinsame Preview-
Migrationsjob ist für genau diesen Branch gesperrt; vorhandene Medien-/CI-Guards
bleiben wirksam.

## Prüfungen und Grenzen

Regulär `test:bingo-preparation`: alte V1-/V2-Tests plus V3-PDFs, alle Formate,
Originalschriften, Dubletten-/Begriffsregeln, Duplexslots, Teilbögen, Auflösung und
Korrektur. `bingo-preparation.integration.test.ts` prüft echte PostgreSQL-
Transaktionen, alte/neue Migrationen, 1.000 unterschiedliche Textkarten, Retry,
Rollen, Produktgrenzen, unveränderte historische Karten sowie vollständige
Snapshot-/Wiederherstellungsintegrität ausschließlich isoliert.

Browser-/Screenshot-/PDF-Artefakte und der tatsächliche gehostete Commit werden
im PR dokumentiert. Keine vollständige Geräte- oder physische Duplexabnahme
allein aus Canvas, Textextraktion oder mathematischer Spiegelung ableiten.

### Bingo-Matching (Vertragsversion 2)

Die neue gezielte Erweiterung ist in [bingo-matching.md](./bingo-matching.md) beschrieben: unabhängige Medien-/Kartenantwort, unveränderliche spielgebundene Fassung, 90 Verwaltungszeilen bei unverändertem 75er-Regelkern und aktuelle Berechtigungsprüfung. Bestehende V1-Karten-/Laufzeitverträge bleiben erhalten. Vollständige Zuordnungen und Medienbytes gehören ausdrücklich nicht in regelmäßige Statusabfragen. Praktische Nachweise und Grenzen stehen im zugehörigen Matching-Abnahmebericht.
