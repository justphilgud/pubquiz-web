# Manueller Test: mobile Medien- und Kategorienauswahl

## Voraussetzungen

- Ein Mobilgerät oder die mobile Browseransicht verwenden.
- Je einen Administrator und Editor mit Zugriff auf den Frageneditor bereithalten.
- Eine aktive, eine offene und eine archivierte Kategorie vorbereiten.

## Bildauswahl

Für jeden manuellen Bildplatz der Frage, der Antworten und der Generator-Eingaben:

1. `Bild auswählen` antippen. Die Systemauswahl darf keine Kameraaufnahme
   erzwingen. Bild auswählen und Vorschau, Ersetzen sowie Entfernen prüfen.
2. `Foto aufnehmen` antippen. Auf einem unterstützten Mobilgerät soll die
   rückseitige Kamera angeboten werden. Aufnahme bestätigen und Vorschau prüfen.
3. Beide Dialoge jeweils abbrechen. Ein bereits vorhandenes Bild und sein
   Löschstatus müssen unverändert bleiben.
4. Falschen Dateityp und zu große Datei in beiden Pfaden prüfen. Beide müssen
   dieselben Validierungsfehler anzeigen.
5. Uploadfehler simulieren. Die vorhandene Vorschau muss erhalten bleiben und
   der Fehler verständlich angezeigt werden.

## Kategorien im Frageneditor

1. Feld mit Touch und Tastatur öffnen; Pfeiltasten, Enter und Escape prüfen.
2. Nach exaktem Namen, Anfang und enthaltenem Wort suchen. Trefferreihenfolge
   und Groß-/Kleinschreibung prüfen.
3. Als Administrator einen neuen Namen anlegen. Er muss sofort aktiv, gewählt
   und anschließend allgemein auffindbar sein.
4. Als Editor einen neuen Namen vorschlagen. Er muss als `Offen` markiert und
   sofort an der aktuellen Frage speicherbar sein, aber nicht in einer anderen
   Frage als neue Auswahl erscheinen.
5. Eine Frage mit archivierter Zuordnung öffnen. Die Kategorie muss sichtbar
   bleiben; nach dem Entfernen darf sie nicht erneut angeboten werden.

## Administration

1. `/admin/kategorien` als Editor aufrufen: Zugriff muss verweigert werden.
2. Als Administrator anlegen, umbenennen, archivieren und reaktivieren.
3. Offenen Vorschlag mit und ohne Namensänderung freigeben sowie einen Vorschlag
   archivieren.
4. Kategorie mit mehreren Fragen zusammenführen. Vorherige Bestätigung,
   Zuordnungszahl, keine Duplikate und archivierte Quelle prüfen.
5. Einen Fehler innerhalb der Zusammenführung provozieren. Weder Zuordnungen
   noch Status dürfen teilweise geändert sein.

## Regression

- Kategorienfilter der Fragenübersicht und Schnellquiz prüfen.
- Frage mit Kategorien klonen; Zuordnungen müssen erhalten bleiben.
- Administrator-Import mit neuer und vorhandener Kategorie prüfen.
- Desktopdarstellung, Fokusmarkierungen und Touch-Ziele kontrollieren.

## Fragenfreigabe und Übersicht

1. Eine Frage mit einer offenen Kategorie als Administrator zur Prüfung öffnen.
   Dialog abbrechen: Frage und Kategorie müssen unverändert bleiben.
2. Kategorie bestätigen und Frage freigeben. Beides muss gemeinsam gespeichert
   sein.
3. Einen nur dort verwendeten Vorschlag verwerfen: Zuordnung und Kategorie
   müssen verschwinden, die Frage wird freigegeben.
4. Einen auch anderweitig verwendeten Vorschlag verwerfen: Die Kategorie wird
   archiviert, andere Zuordnungen bleiben erhalten.
5. Dieselbe offene Kategorie alternativ unter `/admin/kategorien` freigeben.
6. `/fragen` auf Desktop und Smartphone prüfen: Statuschips, Filter öffnen und
   schließen, Text-, Status-, Template- und Kategorienfilter kombinieren.
7. Browser-Zurück, Neuladen und einen kopierten Filterlink prüfen.
8. Eine ungenutzte aktive, offene und archivierte Kategorie löschen. Bei einer
   verwendeten Kategorie muss Löschen fehlen und auch ein direkter Action-Aufruf
   serverseitig abgelehnt werden.
