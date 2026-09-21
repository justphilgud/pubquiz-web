# Länderfragen: Flaggen-Distraktoren und Umriss-Pilot

## Datenvertrag

Die 193 Länder entsprechen dem bereits importierten UN-Mitgliedstaaten-Katalog. ISO-2/ISO-3, deutsche Kurznamen, Region und Subregion liegen eingefroren in `data/countries/un-member-states.de.json`. Flaggen bleiben die bereits im PubQuiz-Medienstore gespeicherten Dateien; ihre URLs und Hashwerte dienen nur zur Bestandsprüfung.

Jede Länderfrage wird als bestehende Standardfrage mit vier klassischen Antworten gespeichert: genau eine richtige und drei falsche. Damit erkennt die bestehende Antwortmoduslogik sie als geschlossen. Die vorhandene Option `Als offene Frage stellen` setzt weiterhin ausschließlich die jeweilige Quiz-Zuordnung auf den effektiven offenen Modus; Lösungen und Bewertungsvorgaben der Frage bleiben erhalten.

## Flaggen-Distraktoren

`scripts/country-questions/build-country-catalogue.mjs` erzeugt die Antwortpläne deterministisch. Dazu werden die geprüften Flaggenquellen auf ein gemeinsames 24×16-RGB-Raster normalisiert. Die Rangfolge kombiniert visuelle Pixeldistanz, Original-Seitenverhältnis sowie Region/Subregion. Bei der Auswahl wird höchstens ein nahezu identischer Kandidat zugelassen und zwischen den drei Distraktoren zusätzliche visuelle Vielfalt verlangt. Das vermeidet sowohl beliebige Welt-Lotterie als auch drei nur pixelgenau unterscheidbare Antworten.

Der erzeugte Plan liegt in `data/countries/country-question-plan.json`. Er enthält keine Zugangsdaten und keine Laufzeitabhängigkeit von REST Countries.

## Natural-Earth-Quelle und Lizenz

Quelle: Natural Earth, **Admin 0 – Countries**, Maßstab 1:10m, Version 5.1.1, Datei `ne_10m_admin_0_countries.geojson`. Der vollständige Quelldatensatz wird nur beim Build eingelesen. Im Repository liegt ausschließlich der auf Deutschland, Italien, Chile, Australien und Gambia reduzierte GeoJSON-Ausschnitt.

Natural Earth stellt sämtliche Raster- und Vektordaten auf der eigenen Website als **Public Domain** bereit. Nutzung und Bearbeitung sind ohne Erlaubnis möglich; eine Nennung ist nicht erforderlich. Wir dokumentieren die Herkunft dennoch als „Made with Natural Earth“.

Links:

- https://www.naturalearthdata.com/downloads/10m-cultural-vectors/
- https://www.naturalearthdata.com/about/terms-of-use/
- https://github.com/nvkelso/natural-earth-vector/tree/v5.1.1/geojson

## Geometrie und eigene Assets

`scripts/country-questions/generate-outline-assets.mjs` verarbeitet Polygon und MultiPolygon einheitlich. Es nutzt nicht pauschal nur das größte Polygon:

1. Flächenanteile und Abstände aller Polygonteile werden in einer lokal entzerrten Projektion ermittelt.
2. Signifikante Teile bleiben erhalten. Kleine nahe Inseln werden ebenfalls bewahrt.
3. Sehr kleine abgelegene Inseln dürfen entfallen, damit die charakteristische Hauptform nicht auf wenige Pixel schrumpft.
4. Bei echten Archipelen ohne dominantes Hauptpolygon greift eine niedrigere relative Flächenschwelle, sodass Inselketten erhalten bleiben.
5. Die erhaltene Geometrie wird seitenverhältnistreu mit 72 Pixeln Mindestabstand auf eine identische 1200×900-Zeichenfläche eingepasst.

Die editierbaren Vektorquellen liegen als `public/country-outlines/<iso2>.svg` vor. Für den bestehenden Medienupload werden daraus verlustfreie WebP-Dateien gleicher Größe erzeugt, weil der aktuelle Frageneditor ausschließlich JPEG, PNG und WebP akzeptiert. Beide Varianten sind eigene, versionierte Anwendungsassets; zur Laufzeit gibt es keinen Abruf bei Natural Earth oder einem sonstigen Fremdserver. Hashwerte, Abmessungen, erhaltene Polygonteile und verworfener Flächenanteil stehen in `data/countries/country-outline-assets.json`.

## Pilot und Phase 2

Der Pilot umfasst ausschließlich Deutschland, Italien, Chile, Australien und Gambia. Die fünf Antwortpläne stehen zusammen mit den Flaggenplänen in `data/countries/country-question-plan.json`. Für einen späteren Vollimport kann dieselbe Pipeline auf die 193 UN-Mitglieder angewandt werden. Vor Phase 2 sind kartografische Sonderfälle wie Exklaven, überseeische Gebiete, Antimeridian-Länder, Kleinstaaten und weit gestreute Inselstaaten anhand des generierten Prüfmanifests gesondert zu prüfen.
