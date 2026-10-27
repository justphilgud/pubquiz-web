# Bingo AP2 – isolierte Abnahme

**Aktuelle Drucküberarbeitung:** [Quadratische Karten, Rückseiten, Druckeinstellungen, Versionierung und neue Downloads](print-design.md).
Die nachfolgende ursprüngliche Drucklayout-Abnahme bleibt als historischer Erststand dokumentiert; maßgeblich für neue Druckstände ist der verlinkte Bericht.

Die lokale technische Abnahme ist unten dokumentiert. Verbindliche Nachweise zu
Head-CI, gehosteter Preview, ausgeliefertem Commit und ihrer Browserabnahme werden
im [zugehörigen PR #143](https://github.com/justphilgud/pubquiz-web/pull/143) geführt.
Kein Merge, kein Production-Release.

## Umfang und Architektur

Die vorhandene Spiel-ID bleibt erhalten. Sechs additive Tabellen speichern Runden,
explizite Serienzuordnungen, vollständige unveränderliche Karten, Druckdesign samt
Schrift-/Logobytes, Versionskonflikte und die Ausgabehistorie. Der AP1-Regelkern,
Quizlaufzeit, Teams und gemeinsame Designauswahl bleiben unverändert.
Details: [Living Specification](../../architecture/bingo-preparation.md).

Kleinere Entscheidungen: 25 Runden/Serien und 50 Karten je Listenseite; 500 Karten
je Erzeugungsauftrag; höchstens 200 Karten pro PDF mit ausdrücklich beschrifteten
Paketen. Für Druckschriften werden vorhandene Originaldateien versioniert
eingebettet. Variable Originalschriften erhalten sichtbare Vektorkonturen aus
derselben Schrift und einen eingebetteten durchsuchbaren Textanteil; dies verhindert
die in der echten Rasterprüfung gefundenen fehlenden Glyphen. Keine zusätzliche
Schriftverarbeitungsabhängigkeit wurde installiert.

Die erste gehostete Preview scheiterte am regulären 250-MB-Funktionslimit, weil der
PDF-Importgraph auch die Quelldateien der Erzeugung mitpackte. Der lesende Export
wurde deshalb mit gemeinsamer unveränderter Autorisierung getrennt; eine
Importgrenzen-Regression verhindert die erneute Einbindung des Asset-Laders.
Das Plattformlimit und bestehende Schutzregeln wurden nicht geändert.
Ein weiterer Build zeigte denselben unnötigen Schreibimport in der Kartenansicht.
Auch die lesenden Seitenzugriffe sind nun getrennt; der lokale Logo-Lesepfad
bleibt statisch unter `public` und wird zusätzlich kanonisch geprüft. Nach dem
regulären lokalen Build umfassen die verfolgten Dateien rund 9,2 MB für den
PDF-Export, 8,5 MB für die Kartenansicht und 38,8 MB für die Vorbereitung.
Das sind lokale Tracing-Messungen; der endgültige Vercel-READY-Nachweis steht im PR.
Der generische Preview-Migrationsworkflow ist für diesen einzelnen Branch
ausdrücklich gesperrt, damit er die AP2-Migration nicht versehentlich auf die
gemeinsame Development-Datenbank anwendet. Bereitgestellt wird über das bestehende
gezielte administrative Git-Preview-Werkzeug mit externer exakter Branch-Freigabe,
erfolgreicher Head-CI und eigener branchgebundener Review-Verbindung.

## Tatsächlich durchgeführte Prüfungen

- Typecheck und ESLint sämtlicher geänderter Anwendungs-/Testdateien: erfolgreich.
- Vollständiger lokaler `npm test` und `npm run build`: erfolgreich. Ein lokaler
  CRLF-Effekt bei einem unveränderten historischen Freigabeplan wurde durch
  bytegenaues Lesen aus Git beseitigt; Test und historische Datei bleiben unverändert.
- AP1: bestehende 17 Regelkerntests bleiben enthalten; kein Kerncode geändert.
- Neue Policy-/PDF-Tests: manipulierte IDs/Felder, Integergrenzen, null/0,
  Kartenvalidierung, komplette Bereichspakete, echte PDFs beider Marken,
  Originalschrift-Vektoren und eingebetteter Text, 200 Karten/50 Seiten,
  Wiederexport, abgewiesene fremde Asset-URLs und nicht unterstützte Zeichen.
- Echter PostgreSQL-Test: Migration auf leerem und repräsentativ befülltem
  isoliertem AP1-Schema; vorhandene Quizdaten und Rollen unverändert. Alle sechs
  neuen Tabellen sind im bestehenden Backup-Katalog enthalten; Druckdesign und
  Prüfsummen werden durch die Integritätsprüfung validiert. Keine manuellen
  Backups oder Restores gestartet.
- Reale Repository-Aufrufe: verweigerte Editor-/fremde Reihen-/Verwaltungszugriffe,
  Produktdeaktivierung auch für Admin, Rechteentzug, Archivgrenzen, fremde IDs,
  vollständiger Rollback bei erzwungenem Fehler während der Karteninsertion,
  parallele identische Erzeugung (genau eine Serie), geänderte Wiederholungsdaten,
  Versionskonflikte, gesperrter Reihenwechsel, Karten-/Serien-Unveränderlichkeit,
  Strategiekonflikte, null/0-Ausgabehistorie, Wiederverwendung und Reihung.
- 500 unterschiedliche gespeicherte Karten: vollständig und ohne Überschneidung
  über 1–200, 201–400 und 401–500 gelesen; 201 Karten in einem Export abgewiesen.
- Tatsächlicher Chromium-Browser gegen Next.js und die eigene Review-Datenbank:
  frischer Passwortlogin; Spiel/Runden anlegen, bearbeiten und vollständig neu
  laden; Karten doppelt anklicken (eine Erzeugung); vorhandene Serie zuordnen;
  Ausgabe speichern und neu laden; stale Formular in zweitem Tab behält Eingaben;
  Kartenkennung suchen; tatsächlicher PDF-Download; Editor-Direktlink abgewiesen,
  sein bisheriger Stammdaten-Lesezugriff bleibt erhalten; Quizverwaltung erreichbar.
- Native Tastaturbedienung: Tab-Reihenfolge, sichtbarer Fokus und Bearbeitung des
  Zahlenfelds mit der Pfeiltaste. Während einer Kartenerzeugung sind andere
  Rundenaktionen gesperrt, damit deren Aktualisierung keine Eingaben verdrängt.
- Der native Abbruchdialog wurde **automatisiert** abgebrochen: Seite und geänderte
  Eingabe blieben erhalten. Dies ist keine behauptete menschliche Abnahme.
- Laptop 1366×768 und Mobilviewport 390×844: Runden- und Kartenansichten geprüft,
  kein horizontaler Seitenüberlauf. Screenshots unten.
- PDF-Struktur und Text: beide Markenbeispiele und der echte Browserdownload
  jeweils 9 Karten/3 A4-Seiten, zwei eingebettete Schriften, ein eingebettetes Logo;
  jede Kennung und Zelle gegen die jeweilige Kartengrundlage verglichen, beim
  Browserdownload direkt gegen die gespeicherten PostgreSQL-Karten. Textfelder
  innerhalb der Seitenränder. Beide Marken tatsächlich gerastert und visuell geprüft.

Wiederholbar: `npm run test:bingo-preparation`; PostgreSQL über
`BINGO_PREPARATION_TEST_DATABASE_URL` und
`scripts/testing/bingo-preparation.integration.test.ts` (legt ausschließlich eine
neue eigene Testdatenbank auf einem explizit erlaubten Nicht-Production-Host an).
`npm run test:bingo-preparation:browser` ist auf die isolierte AP2-Preview oder
Loopback beschränkt und benötigt die privaten synthetischen Testkonten.

## Migration und Betriebsgrenzen

Review-Datenbank: `bingo_preparation_review_20261027b`, nur synthetische Daten.
Dedizierter Laufzeitbenutzer ohne Rechte zum Lesen der bestehenden Development-
Datenbank; der entsprechende Negativtest besteht. Keine Production-Verbindung.
Die neue Migration wurde ausgeführt. Ältere Migrationen wurden in dieser neu
erstellten Datenbank anhand des AP1-Schemabaselines registriert, **nicht** als
vollständige historische SQL-Kette nachgespielt. Historische Bootstrap-Probleme
werden weder als AP2-Fehler noch als behoben ausgewiesen.

Ein echter Drucker-/Papiertest und unterschiedliche PDF-Viewer sind nicht vollständig
abgedeckt. Nicht unterstützte Schriftzeichen/-gewichte oder zu lange Druckzeilen
führen zu einer ausdrücklichen Exportfehlermeldung, niemals zu stiller Kürzung oder
einer anderen Schrift. Der PDF-Fehler verändert weder Karten noch Ausgabeangaben.

Bingo bleibt Vorbereitung. Nachfolgende AP3/AP4 müssen Livebetrieb/Start, Ziehungszustand, öffentliche
Präsentation und Ruf-/Gewinnworkflows samt dauerhafter Runtime-Integration ergänzen;
AP2 bietet dafür keine vorgetäuschten Schaltflächen oder Publikumslinks an.

## Bilder und synthetische Druckbeispiele

![Runden am Laptop](images/rounds-laptop.jpg)
![Runden auf schmalem Bildschirm](images/rounds-mobile.jpg)
![Karten am Laptop](images/cards-laptop.jpg)
![Karten auf schmalem Bildschirm](images/cards-mobile.jpg)

[Phil-Gud-Beispiel](examples/bingo-phil-gud.pdf) ·
[LOVD-Beispiel](examples/bingo-lovd-ungegoogelt.pdf)

Kontodaten werden ausschließlich privat in der Übergabe bereitgestellt, nicht in
diesem Bericht, im PR, in Screenshots oder im Repository.

## Fachliche Abnahme in sechs Schritten

Preview-Einstieg: [Login](https://pubquiz-web-git-codex-bingo-preparation-just-phil-gud.vercel.app/login).
Die folgenden Links gehören ausschließlich zur isolierten Review-Datenbank;
Bereitstellungsstatus und Runtime-Commit stehen im verlinkten PR-Nachweis.

1. Mit dem privat übergebenen Admin-Testkonto anmelden. Öffne
   [Phil Gud – Runden](https://pubquiz-web-git-codex-bingo-preparation-just-phil-gud.vercel.app/bingo/25000000-0000-4000-8000-000000000001/vorbereitung)
   oder [LOVD – Runden](https://pubquiz-web-git-codex-bingo-preparation-just-phil-gud.vercel.app/bingo/25000000-0000-4000-8000-000000000002/vorbereitung).
   Jeweils zwei vorbereitete Runden und eine Serie mit zwölf Karten sind vorhanden.
2. „Runde hinzufügen“ anklicken, „Bezeichnung“ und „Geplante Ziehungen“ ändern,
   „Runde speichern“ anklicken und die Seite vollständig neu laden. Die Angaben
   müssen erhalten bleiben; über „Nach oben“/„Nach unten“ lässt sich die Runde ordnen.
3. Bei „Neue Karten je Runde“ die „Anzahl neuer Karten“ prüfen (Standard 100) und
   „Kartenserie erzeugen“ anklicken. Die neue Serienkennung und Kartenanzahl erscheinen.
   Erst danach bei „Karten und PDF“ die gespeicherten Karten öffnen.
4. In einer weiteren Runde „Vorhandene Karten verwenden“ wählen, „Runde speichern“,
   die gewünschte „Vorhandene Serie“ auswählen und „Serie zuordnen“ anklicken.
   „Ausgegebene Karten gesamt“ eintragen und speichern: leer bedeutet nicht erfasst,
   0 ausdrücklich keine. Nach Reload müssen Zuordnung und Ausgabe erhalten bleiben.
5. Unter [Phil Gud – Karten](https://pubquiz-web-git-codex-bingo-preparation-just-phil-gud.vercel.app/bingo/25000000-0000-4000-8000-000000000001/karten)
   beziehungsweise [LOVD – Karten](https://pubquiz-web-git-codex-bingo-preparation-just-phil-gud.vercel.app/bingo/25000000-0000-4000-8000-000000000002/karten)
   eine Serienkennung öffnen, eine Kartenkennung suchen und „PDF herunterladen“
   mit dem angebotenen Kartenbereich anklicken. Vier Karten passen auf eine A4-Seite;
   Kennung und Zahlen müssen mit der Bildschirmkarte übereinstimmen.
6. Eine Rundenangabe ändern, „Abbrechen“ anklicken und den Wechsel im Browserdialog
   abbrechen: Seite und Eingabe bleiben erhalten. Danach die Änderung bewusst
   verwerfen. Optional mit dem Editor-Testkonto prüfen: Stammdaten bleiben lesbar,
   Vorbereitung und PDF-Zugriff sind gesperrt. Es gibt keinen Spielstart.
