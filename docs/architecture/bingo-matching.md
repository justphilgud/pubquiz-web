# Bingo-Matching: Zuordnung, Druck und Präsentation

Implementierungsbranch `codex/bingo-matching-table`, Basis Main
`338887775389567fd2703cf177f3927cf89a1086`. Kein Merge oder Production-Auftrag.
Der tatsächliche Prüf-/Previewstand wird im zugehörigen Abnahmebericht geführt;
die Beschreibung allein ist kein Nachweis einer erfolgreichen Browserabnahme.

## Wiederverwendung und Grenzen

`game_drafts` bleibt die Spielidentität, AP1 unverändert die 75er-Regel- und
Gewinnquelle. Bestehende Begriffssätze werden um Vertragsversion 2 erweitert:
90 sortierte eindeutige Nummern, getrennte Präsentation und Kartenbeschriftung,
gespeicherte inaktive Alternativen und ausdrückliche Textkopplung. Alte V1-Sets,
Karten, Kennungen, PDF- und Rundensnapshots werden nicht konvertiert. Keine neue
Template-/Medienverwaltung, Quizvorlage oder allgemeine Laufzeitengine.

- `matching.ts`: reiner Datenvertrag, Bereichs-/Dublettenprüfung, tatsächliche
  Antwortbedeutungen. Vorwärts/Rückwärts/Bitcrush und Interpret/Titel/Kombination
  sind unabhängig. Leere bzw. nicht akzeptierte Lösungen und falsche
  Auswahlantworten werden nicht zu Standards. Nur eine eindeutige Antwort wird
  vorausgewählt. Felder werden anhand ihrer Beschriftung erkannt, nie ihrer Position.
- `matching/MatchingEditor` und `SourcePicker`: Entwurf, Bereichsauswahl, Vorschau,
  explizites Speichern/Abbrechen, bestehender Dirty-Guard. Filtern entfernt keine
  Zeilen aus dem Entwurf. Gleichzeitiges Speichern verwendet die Vorbereitungs-CAS.
- `matching/source.server`: begrenzte serverseitige Quellensuche und Projektion
  tatsächlicher Medien-Slots, kanonischer/akzeptierter Antwortfelder und dynamischer
  Vorlagen. Browser-TTS ohne Datei liefert keine erfundene Audiodatei.
- `matching/repository.server`: aktuelle Bingo-Rechte/Produkt/Archiv, Quelle,
  eingefrorene Medien-/Antwortfassung, Spielsperre und atomare neue Setfassung.
- Bestehende Druckrenderer besitzen weiterhin Passung, Originalfonts/Logos,
  Duplex und Kurzkennung. Nur neue V2-Zuordnungen verzweigen pro Zelle zwischen
  vorhandener Zahlenschrift und Textschrift. Keine Kürzung oder kleinere Mindestschrift.
- `eventRepository`/`eventRun`: vorhandene Runde, Kartenbindung, CAS, Request-ID,
  Journal, Rufgrenzen und Zahlenkorrektur. Kleine Matching-Referenz und Medienbefehle
  ergänzen diese Verträge, ohne Quizlaufzeit oder AP1-Regeln zu ändern.
- `MatchingPresentation`: verwendet den vorhandenen exportierten
  `SynchronizedMedia` unverändert. Bingo liefert eigenen persistierten Kontext und
  Befehle. Aktivierung im Publikumsfenster bleibt ausdrücklich; kein Autoplay-Attribut.

## Geltungsbereich, Veröffentlichung und Modus

Jeder Satz ist wie bisher spielgebunden und als benannte Fassung für andere
Runden desselben Spiels wiederverwendbar. Speichern erzeugt eine neue unveränderliche
Fassung; keine Aktualisierung alter Fassung. 1–90 ist ein Verwaltungsbereich.
Karten, Ziehung, Spaltenverteilung, Freifeld und Gewinne bleiben ausschließlich 1–75.
76–90 sind sichtbar als außerhalb des Modus gekennzeichnet. Bereich 15–26 bedeutet
keine Einschränkung des Ziehungspools. Gleiche effektive Kartenbeschriftungen im
aktiven 75er-Bereich werden einschließlich Zahlen/Text-Kollisionen abgewiesen.

„Zahl beibehalten“ verwendet die Zahl auf beiden Flächen und behält gespeicherte
Alternativen. „Gleicher Text“ gilt ausschließlich für Text. Medien haben eine
unabhängige Kartenantwort; ein Variantenwechsel setzt diese nicht zurück.
Ein Quellwechsel verlangt eine neue gültige Auswahl, wenn der alte Schlüssel nicht
mehr zur Fassung passt. Der endgültige Drucktext wird pro Zeile angezeigt.

DIRECT/APPROVAL/HIDDEN behalten ihren bisherigen Veröffentlichungsvertrag für
Text. Bei Medien wird die ausgewählte Aufnahme/das Bild nach bewusster
Zahlenveröffentlichung präsentiert; die Kartenlösung wird nicht als Dateiname,
Fragentitel oder Medienlabel eingeblendet. HIDDEN bietet die ausdrückliche
Auflösung. Numerisches Board und Historie bleiben nummernbasiert.

## Quellrechte und Erhalt

Neue Auswahl benötigt gleichzeitig aktuellen Bingo-Verwaltungszugriff und die
bestehenden Quiz-Quellenrechte. Wiederverwendet werden `getActorPermissions`,
`canViewScopedQuestion`, `isQuestionEligibleForQuiz` und der echte Spielkontext.
Nur freigegebene, nicht archivierte, nicht abgelaufene globale Quellen oder Quellen
derselben Eventreihe sind geeignet. Eine Menüanzeige erteilt keine Rechte.
Admin umgeht das Bingo-Produktgate nicht. Editor/alleinige Reihenverwaltung
erhalten keine neue Bingo- oder Karaoke-Funktion. Jeder Assetabruf prüft aktuelle
Spielrechte und Produkt, auch mit bekannter UUID; kein öffentlicher Assetzugriff.

Bewusste technische Entscheidung: Eine rechtmäßig eingefrorene Quelle ist wie ein
bestehender Druck-/Liveasset-Snapshot ein Bestandteil des berechtigten Bingo-Spiels.
Spätere Quelländerung, Archivierung oder Löschung ändert diese ausgegebene Fassung
nicht. Die vorhandenen Löschsperren im Quiz bleiben unverändert. Quellenrechte werden
bei neuer Übernahme erneut geprüft; archivierte/fremde Quellen sind keine neuen
Auswahlquellen. Bereits verwendete eingefrorene Kopien bleiben nach Spielrechten
lesbar. Entzug dieser Spielrechte sperrt Editor, Status, Schreiben und Assetabrufe.
Das ist keine Freigabe der veränderlichen Originalfrage über eine Bingo-Referenz.

Medienbytes, MIME, Variante, Quellidentität/-revision, SHA-256 und die tatsächlichen
Antwortoptionen liegen einmalig im eigenen unveränderlichen Assetdatensatz.
Die Setfassung referenziert dessen UUID, niemals signierte URLs. Auswahl anderer
Antworten aus dieser eingefrorenen Fassung bleibt auch nach Quelländerung möglich.
Neue Quelldaten überschreiben keine alten Antwortoptionen. Eigener Text bleibt möglich.

Es gelten die vorhandenen Formatbudgets: Bild 10 MB, Audio 25 MB, Video 100 MB;
zusätzlich 200 MB neu aufzunehmende Medien pro Speichervorgang. Aufnahme nur von
autorisierten bestehenden lokalen Medien bzw. dem authentifizierten vorhandenen
Blob-Store, begrenzte Leseoperation ohne Redirect oder beliebige Remotehosts.
Bestehendes Sharp/FFmpeg entfernt Antwort-Metadaten; Audio/Video nutzt Stream-Copy,
keine Generierung/Umkehrung oder neue kostenpflichtige Verarbeitung. Originalfrage
und Originaldatei bleiben unverändert. Die aufbewahrte Datei kann durch das Entfernen
von Metadaten andere Bytes haben; ihr eigener Hash ist maßgeblich.

## Karten und Livebindung

Kartenproduktion übernimmt den vollständigen geprüften Satz in den vorhandenen
Drucksnapshot. Bei Start muss jede zugeordnete Serie denselben Satz besitzen;
PostgreSQL vergleicht das vor dem Start, ohne Druckassets an die Anwendung zu senden.
Die Runde speichert nur ID, Hash und Veröffentlichungsart der unveränderlichen
Setfassung. Bereits verwendete Runden können nicht umgestellt werden. Kein
automatischer Ersatz gedruckter Karten und kein Reset.

Die bestehende geometrische Druckprüfung bleibt maßgeblich. Auch eine Auswahl
unter 40 Zeichen kann bei mindestens 10 pt zu breit/hoch sein. Konkret wurde die
lange Beispielkombination „Bob Dylan – Blowin’ in the Wind“ im vorhandenen kleinen
Kartenfeld abgewiesen. Die sechs fachlichen Kombinationen bleiben auswählbar;
überlange Kartenbeschriftungen benötigen eine passende vorhandene Schrift/Format
oder bewusst gewählten kürzeren eigenen Text. Keine stillschweigende Kürzung,
kleinere Schrift oder neue Kartengeometrie. Fehlgeschlagene Produktion speichert
keine Teilkarten. Ein eigener Test erhält diese Grenze ausdrücklich.

Medienbefehle PLAY/PAUSE/REPLAY sind revisionsgebundene, idempotente vorhandene
Journalereignisse und an die aktuelle Ziehungs-ID gebunden. Sie verändern weder
Rufgrenze noch Gewinnregel. Runden-/Zahlenwechsel, Korrektur und Abschluss stoppen
den alten Medienkontext. Wiedergabe hängt an Befehlsidentität, nicht an Pollantworten.
Mehrere Moderationsfenster müssen denselben CAS-Vertrag erfüllen. Medienfehler
werden sichtbar, während numerische Verwaltung und Gewinnprüfung unabhängig bleiben.

## Leistung, additive Migration und Betrieb

`20261107150000_bingo_matching` ergänzt nur eine Assettabelle, einen nullable
Hash an Sets, die zwei Versions-CHECK-Erweiterungen und zwei exakt geprüfte
Immutable-Trigger auf Basis der bestehenden Funktion. Kein Backfill, neue Funktion,
Rechteänderung, Änderung alter Migrationsdateien oder bestehender Daten.

Unveränderte Statusabfragen verwenden weiterhin den frisch autorisierten ETag-Weg
ohne Karten/Journal/Snapshots. Ein voller Zustandswechsel lädt nur die aktuelle
Matching-Zeile per JSON-Projektion in PostgreSQL. Vollständige Matching-Konfiguration,
Quellfragen, Antwortoptionen und Medienbytes gehören nicht in Pollantworten.
Die Moderationsvorbereitung lädt dort keine V2-Sets. Bibliothek und Quellensuche
werden separat bewusst aufgerufen. Medien laden nur für Vorschau/aktuelle Zahl;
keine unbegrenzte Vorabladung. Bestehende serielle Polling-Queue und Cleanup bleiben.

Die dynamische Backupinventur und der schemaweite Dump erfassen neue Spalten und
alle Binärdaten. Exakte Migrations-/Triggerreferenz in
`schema-reference/bingo-matching-routines.json`; unbekannte/fehlende/veränderte oder
deaktivierte Objekte bleiben Fehler. Für genau die neue bytea-Spalte berechnet
PostgreSQL SHA-256, Länge und Signatur aus den tatsächlichen Bytes. Diese kompakte
Inventur vermeidet eine hundert-MB-Hexzeile am libpq-Ausgabelimit. Der Dump enthält
weiterhin sämtliche Bytes; nach isoliertem Restore werden die tatsächlichen
restaurierten Bytes erneut gehasht und vollständig verglichen. Ein gespeicherter
deklarierter Hash allein ist kein Integritätsnachweis. Bestehende Tabellen und
deren Prüfungen bleiben unverändert. Kein manueller Production-Backup/Restore.

## Verifikation

### Matching-Editor: Bedienung und Vorlagenfilter

Die Matching-Seite gruppiert Einstellungen, Bereichsauswahl und Zuordnungszeilen.
Die vorhandene Medien-Lupe steht bündig neben der Präsentationsauswahl. Auf kleinen
Bildschirmen stehen Präsentation und Kartenantwort innerhalb jeder Kugel untereinander.
Eine am unteren Rand sichtbare Leiste zeigt Speicherstatus, Konflikt-/Fehlermeldungen
und Speichern/Abbrechen. Die Bereichsauswahl filtert ausschließlich die Ansicht;
der gespeicherte Satz enthält weiterhin alle 90 Einträge und die 75er-Regel bleibt.

Der Filter „Fragevorlage“ ist eine durchsuchbare Einzelauswahl. Er verwendet stabile
Vorlagencodes und bevorzugt `source_vorlage` gegenüber der technischen Basisvorlage.
Angeboten werden nur Vorlagen mindestens einer freigegebenen, gültigen, nicht
archivierten und für Spielreihe sowie aktuellen Quiz-Zugriff sichtbaren Quelle.
Fehlende Preview-Daten können daher Optionen reduzieren; sie erklären aber nicht das
frühere Freitextfeld. Medienverfügbarkeit wird weiterhin bei der Quellenauswahl geprüft.

Das Öffnen des Dialogs lädt einmalig Vorlagen- und Berechtigungsmetadaten in Seiten
von 200 Datensätzen; Frageninhalte, Antworten und Medien werden dafür nicht geladen.
Es gibt keine zusätzliche Pollingabhängigkeit. Die neue Serveraktion prüft Sitzung,
Bingo-Spielzugriff und Quiz-Quellenrechte erneut. Die Freitext-Filteroption bleibt für
bestehende Aufrufer kompatibel; die Oberfläche nutzt den exakten Codefilter.

CSS bleibt lokal im Matching-Modul. Keine Änderung gemeinsamer UI-Komponenten,
Quizansichten, Druckvorlagen, Laufzeit-, Speicher- oder Snapshot-Verträge.
Lokale Nachweise und Prüfgrenzen: [Matching-UX](../reviews/bingo-matching-ux/README.md).

Verbindlich: `test:bingo-preparation`, `test:bingo`, Typecheck, geänderte-Dateien-ESLint,
vollständige erforderliche CI und Build. Die echte PostgreSQL-Abnahme erweitert
`bingo-preparation.integration.test.ts`: leere/befüllte additive Migration, alte
Karten/Druckstände/Läufe unverändert, sechs Auswahlkombinationen, Quelllebenszyklus,
CAS, Rechte/Produkt und ID-Manipulation, numerischer Ablauf, Pollingprojektionen und
vollständiger isolierter Snapshot-/Restorevergleich. Menschliche und automatische
Browsernachweise, konkrete Viewports, PDFs und DB-/HTTP-Messwerte getrennt im Bericht.
Historische Bootstrap- und Backup-Betriebspunkte werden dadurch nicht als behoben
markiert. Echtes 90er-Bingo, kleinerer Ziehungspool, OCR und neue TTS gehören nicht dazu.

Abnahme, konkrete Nachweise, Transfermessungen und Grenzen: [bingo-matching-acceptance.md](./bingo-matching-acceptance.md). Die Kartenbeschriftung bei Textkopplung wird abgeleitet und auch im gesperrten Eingabefeld entsprechend angezeigt; die manuelle Alternative bleibt erhalten. Fehlende gespeicherte Medien werden nicht als Browser-TTS ausgegeben. Der Audio-Countdown besitzt einen eigenen Inline-Size-Container und keine scrollbare Innenfläche.

### Quellensuche: Filterung vor Pagination (PR #160)

Die Matching-eigene SQL-Projektion wendet Freigabe, Archivierung, Gültigkeit,
Spielreihe, aktuelle effektive Quiz-Leserechte, Fragetext, ursprüngliche Vorlage
(`source_vorlage` vor technischer Basis) und Medientyp **vor** `skip/take` an.
Das verhindert leere Seiten trotz passender Quellen hinter den ersten 20 Fragen.
Die abschließende Objektpolicy bleibt zusätzlich erhalten. Bingo-Zugriff allein
berechtigt weiterhin nicht zu Quizquellen oder deren Vorlagenmetadaten.

`sourceQuery.ts` bildet die vorhandene Policy ausschließlich für freigegebene
Quellen ab und verwendet die vorhandenen Medienslotdefinitionen sowie die
bestehende Typnamenspriorität Bild → Audio → Video. Antwortbilder zählen nur in
passenden Antwortslots, bei einfachen Antworten nur für richtige Antworten.
Die Suche liefert höchstens 20 Kennungen/Titel/Vorlagennamen und ein `more`-Flag;
keine Antworten, Medienpfade, Bytes oder vollständigen Quelldetails. Erst die
bewusste Auswahl lädt über den vorhandenen autorisierten Detailweg tatsächliche
Varianten und Kartenantworten. Eine vorhandene Quelle bzw. Vorlage garantiert
keine verfügbare Datei. Browser-Sprachausgabe bleibt ausdrücklich keine Audiodatei.

Die Vorlagenliste lädt beim Öffnen oder ausdrücklichem Wiederholen ausschließlich
Berechtigungs-/Vorlagenmetadaten in 200er-Seiten. Identische Namen verschmelzen
keine unterschiedlichen Codes. Kein neuer Pollingpfad, Schema- oder Laufzeitvertrag.
Automatische Nachweise: `sourceQuery.test.ts`, `sourceOptions.test.ts` und die echte
PostgreSQL-Abnahme mit 210 Bild- und 50 Audioquellen (20/20/10), Vorlagen jenseits
200, Produkt-/Quellenentzug und Kontrolle der tatsächlichen SQL-Projektion.
