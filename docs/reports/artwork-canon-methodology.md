# Kunstwerk-Kanon 200 – Methodik

## Ziel und unveränderliche Referenz

Der Katalog enthält genau 200 Werke. Die vorhandene Mona-Lisa-Frage bleibt unverändert und ist in der Provenance als `bereits vorhanden` markiert. 199 weitere Einträge sind für einen ausschließlich auf Preview zulässigen, wiederaufnehmbaren Import vorbereitet.

## Auswahl

1. Wikidata liefert Werke mit bekanntem Urheber, konkretem Bild und internationaler Wikipedia-Abdeckung.
2. Ein Rohbestand von 699 eindeutigen Werken wird anhand von Lizenz, Urheberstatus, Bildqualität, Sammlung, Datierung und eindeutiger Künstleridentität gefiltert.
3. Kuratierte Ergänzungen sichern Fresken, Druckgrafik und Werke aus Japan, China, Indien, Nord- und Lateinamerika.
4. Der versionierte Kandidatenpool umfasst 300 Werke. Aus ihm werden 200 Werke mit höchstens fünf Werken je Künstler ausgewählt.
5. Die Auswahl kombiniert internationale Bekanntheit (Wikipedia-Abdeckung), kunsthistorische Kanonanker und dokumentierte manuelle Ergänzungen. Offensichtlich ungeeignete Motive und Dateien mit unvollständiger Provenance werden explizit ausgeschlossen.

Kanonquellen und Prüfgrundlagen:

- College Board, *AP Art History Course and Exam Description*, Liste der 250 Pflichtwerke
- Wikidata als strukturierte Quelle für Werk, Urheber, Entstehungszeit und Sammlung
- Wikimedia Commons für die konkrete Datei und deren Dateilizenz
- offizielle Open-Access-Grundsätze von Metropolitan Museum of Art, National Gallery of Art und Rijksmuseum
- die in den strukturierten Daten genannte aktuelle Museumssammlung zur fachlichen Gegenprüfung

## Rechtevertrag

Der finale Katalog lässt ausschließlich konkrete Reproduktionen mit `Public domain` oder `CC0` zu. Zusätzlich muss der bekannte Urheber spätestens 1955 verstorben sein. Damit werden moderne, möglicherweise nur als frei lizenzierte Fotografien verfügbare Werke nicht versehentlich über die Lizenz der Reproduktion freigegeben.

## Medienvertrag

Jede neue Quelldatei wird vor dem Import vollständig geladen, als Bild dekodiert und gehasht. Die Normalisierung verwendet die bestehende `sharp`-Abhängigkeit, bewahrt das Seitenverhältnis, vergrößert nicht über 2.560 Pixel und erzeugt WebP mit Qualitätsstufe 88. Der Preview-Import wiederholt Quellhash und Dekodierung, lädt in den bestehenden Pfad `preview/question-media/question_image/image/` hoch und verifiziert Bytes, SHA-256 und Abmessungen durch privaten Blob-Readback.

## Importvertrag

Der Adapter ist zugleich an `VERCEL_ENV=preview`, die logische Umgebung `preview`, den Blob-Präfix `preview` und eine angemeldete globale Adminrolle gebunden. Pro Request wird höchstens ein Werk gespeichert. Die Wikidata-ID im Quellenfeld macht den Vorgang wiederaufnehmbar und dublettensicher. Frage, Template, Kategorie, Eigentümer, Freigabestatus, Medien- und Antwortfeldstruktur werden von der unveränderten Mona-Lisa-Referenz übernommen. Es gibt keine Migration und keine Änderung an Frage-, Quiz- oder Präsentationslogik.
