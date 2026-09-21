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

## Bestands- und Datenabnahme am 21. September 2026

### Bestehende Flaggenfragen

- 193 bestehende Flaggenfragen (Frage-IDs 133 bis 325) wurden über den regulären Frageneditor geprüft.
- Alle 193 Fragen besitzen nun genau vier verschiedene Antworten: eine unveränderte richtige Antwort und drei andere UN-Mitgliedstaaten als Distraktoren.
- Japan wurde als erste Einzelprobe ergänzt; der idempotente Sammellauf ergänzte anschließend die übrigen 192 Fragen. Eine unabhängige Nachprüfung bestätigte danach 193 von 193 Fragen.
- Fragewortlaut, Bild-URL, richtige Antwort, Quellenangabe, Freigabestatus, globale Sichtbarkeit, Quizzuordnungen und ursprünglicher Ersteller blieben unverändert.
- Die Distraktoren stammen aus der deterministischen visuellen und regionalen Rangfolge. Stichproben umfassten unter anderem Japan (Südkorea, Zypern, San Marino), Vereinigtes Königreich (Island, Norwegen, Botswana), Australien (Neuseeland, Nauru, Tuvalu), Bahrain (Katar, Malta, Madagaskar) und Tschad (Senegal, Rumänien, Mali).
- Der vorhandene offene Antwortmodus bleibt eine Eigenschaft der Quiz-Frage-Zuordnung. Die zugrunde liegende Frage bleibt eine Standardfrage mit vier Antworten; deshalb kann jede ergänzte Flaggenfrage weiterhin ohne Datenumbau offen oder als Multiple Choice gespielt werden.

### Länderumriss-Pilot in Preview

In der geschützten Preview wurden ausschließlich die folgenden fünf neuen Standardfragen angelegt:

| Frage-ID | Land | ISO | Antworten |
| --- | --- | --- | --- |
| 111 | Deutschland | DE | Deutschland, Polen, Österreich, Tschechien |
| 112 | Italien | IT | Italien, Kroatien, Griechenland, Portugal |
| 113 | Chile | CL | Chile, Vietnam, Norwegen, Argentinien |
| 114 | Australien | AU | Australien, Madagaskar, Südafrika, Papua-Neuguinea |
| 115 | Gambia | GM | Gambia, Senegal, Togo, Malawi |

Alle Fragen verwenden exakt „Welches Land ist anhand dieses Umrisses zu erkennen?“, das vorhandene Standard-Fragentemplate, Kategorie Geografie, ein Bildmedium, eine richtige und drei falsche Antworten. Die Medien liegen im Nonprod-Medienstore der Preview. Jedes hochgeladene Laufzeitbild ist ein 1600×1200-WebP; die zugehörigen 1200×900-Quellassets im Repository besitzen dasselbe 4:3-Seitenverhältnis.

Der Abnahmequiz ist `Länderumrisse Pilot-Abnahme 2026-09-21` (Preview-Quiz 55). Seine fünf Fragen liegen in einem Block. Gambia wurde über den vorhandenen Zuordnungs-Schalter als offene Frage gespielt, die übrigen vier als Auswahlfragen.

### Browser-Smoke

- **Offen:** Gambia wurde als Freitext gespeichert. Der Teilnehmerstatus wechselte von „Geändert – noch nicht gespeichert“ zu „Aktuelle Antwort gespeichert“. Nach einem echten Reload stand weiterhin `Gambia` im Formular. Reveal zeigte Gambia als richtige Lösung; die Auswertung bewertete die automatisch finalisierte Abgabe mit `CORRECT` und einem Punkt.
- **Multiple Choice:** Australien wurde als Auswahl D gespeichert. Nach einem echten Reload blieb `D. Australien` ausgewählt. Reveal zeigte Australien als richtige Lösung; die Auswertung bewertete die Abgabe mit `CORRECT` und einem Punkt.
- **Darstellung:** Alle fünf Fragen wurden im echten Präsentationsrenderer geprüft. Deutschland, Italien und Australien waren groß, zentriert und unverzerrt; Sizilien, Sardinien und Tasmanien blieben erhalten. Chile blieb trotz des extremen Seitenverhältnisses vollständig sichtbar; vorgelagerte Inselpunkte führten nicht zu einer unbrauchbar kleinen Hauptform. Gambia wurde unabhängig von seiner realen Fläche breit und gut erkennbar dargestellt. Keine Grafik enthielt Ländername, Flagge, Nachbarländer, Koordinaten, Maßstab oder andere Lösungshinweise.
- **Antworten:** Editor-, Teilnehmer- und Reveal-Prüfungen bestätigten pro Pilotfrage vier eindeutige Antworten und genau eine richtige Lösung. Für alle 193 Flaggenfragen bestätigte die vollständige Nachprüfung dieselben Invarianten.

## Technische Verifikation

- Lokaler Gesamttest: alle Testgruppen grün (561 Anwendungstests, 14 zusätzliche Katalog-/Assetprüfungen, Browser-Kunstwerkregression und 176 Posttests).
- TypeScript-Typecheck: erfolgreich.
- Geänderte Dateien ESLint: erfolgreich in GitHub CI.
- Production-Build: erfolgreich in GitHub CI.
- GitHub CI-Run `35635424228`: vollständig grün.
- Preview-Deploy-Run `35635651971`: vollständig grün, einschließlich Preview-Datenbankprüfung, Deployment und HTTP-Smoke.
- Preview-Deployment `dpl_B1Yu7MzyVvr7FQetyrw6AdgVRiTF`: `https://pubquiz-hbgsx9v58-just-phil-gud.vercel.app`.
- Produktcommit: `105d024512249b8d15d38b298d54a6cc582a36d3`.
- Keine Schemaänderung und keine Datenbankmigration wurden eingeführt. `main` und Production-Anwendungscode blieben unverändert.

## Vorschlag für Phase 2

Phase 2 würde dieselbe Pipeline auf die übrigen 188 UN-Mitgliedstaaten anwenden und damit insgesamt 193 Umrissfragen liefern. Abhängige Gebiete und sonstige Natural-Earth-Einträge würden nicht automatisch zu eigenen Fragen; sie blieben nur dann Teil der Geometrie eines UN-Mitgliedstaats, wenn der dokumentierte Polygonfilter sie als charakteristisch und darstellungsrelevant einstuft.

Vor einem Vollimport sollte das Prüfmanifest vier gesonderte Reviewgruppen erzeugen:

1. **Kleinstaaten und Enklaven:** unter anderem Monaco, San Marino, Liechtenstein, Andorra und Vatikanstadt; Mindeststrichstärke und Padding werden visuell geprüft.
2. **Insel- und Archipelstaaten:** unter anderem Indonesien, Japan, Philippinen, Griechenland und Neuseeland; charakteristische Inselketten müssen erhalten bleiben.
3. **Weit gestreute oder Antimeridian-Geometrien:** unter anderem Fidschi, Kiribati und Tuvalu; Längengrad-Normalisierung darf die Hauptdarstellung nicht auseinanderziehen.
4. **Überseeische Teile und Exklaven:** unter anderem Frankreich, Vereinigte Staaten, Russland und Aserbaidschan; entfernte Kleinstflächen werden nach Flächenanteil, Abstand und Wiedererkennungswert bewusst ein- oder ausgeschlossen.

Die Umriss-Distraktoren werden weiterhin deterministisch aus Seitenverhältnis, Formmerkmalen, Region und typischen Verwechslungen gewählt. Vor dem Import erfolgen automatisierte Prüfungen auf genau vier eindeutige Antworten, genau eine Lösung, gültige ISO-Zuordnung, Asset-Hash, sichtbare Pixel, Padding, Seitenverhältnis und zulässigen verworfenen Flächenanteil. Danach folgen gestaffelte Preview-Importe mit visueller Stichprobe pro Sonderfallgruppe und ein gemeinsamer offener/Multiple-Choice-Smoke. Ein Vollimport ist in diesem Pilot ausdrücklich nicht erfolgt.
