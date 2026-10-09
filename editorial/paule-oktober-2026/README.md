# Vorbereitung Paule II und Oktober

Stand: 7. Oktober 2026. Dieses Paket enthält ausschließlich lokale redaktionelle Entwürfe. Keine Production-Änderung, keine Fragefreigabe und keine finale Quizzuordnung.

## Redaktionelles Paket

- [50 Anagramme](anagrams.md): 50 unterschiedliche berühmte Persönlichkeiten; 50/50 Buchstabenidentität nach vorhandener Editor-Normalisierung.
- [50 Schätzfragen](estimates.md): recherchierte Referenzwerte, Quellen, Einheiten, Zeitbezüge, Schwierigkeiten und Kategorien.
- [40-Slot-Gerüst](slot-plan.md): dieselbe Template-Reihenfolge für Paule II und Oktober, 20 Fragen pro Block, Pixel und Meme in beiden Blöcken.
- [40 Kandidatenpaare](candidate-pairs.md): unterschiedliche Vorschläge, bekannte IDs und offene Medien-/Statusprüfungen ausdrücklich markiert.
- [Content-Lücken](content-gaps.md): Bedarf für beide Quizze und vorläufig bekannte Verfügbarkeit.
- [Planungsvergleich](planning-comparison.md): Struktur, Schwierigkeit und vorgeschlagene Themenverteilung je Quiz und Block; kein behaupteter Production-Score.

Die JSON-Dateien enthalten die vollständigen Datensätze. `node editorial/paule-oktober-2026/build-tables.mjs` erstellt die Tabellen erneut. `npm run test:quiz-content` prüft acht Testfälle, unter anderem alle 100 Template-Datensätze über den bestehenden Parser. Die Tests laufen auch über `npm test`.

## Qualität und Datenherkunft

Beide Pools verteilen Schwierigkeit auf 15 LEICHT, 25 MITTEL und 10 SCHWER. Diese redaktionelle Einschätzung verwendet keine Spielergebnisse. Die Kategorien sind Vorschläge für die geplanten Oberkategorien, keine automatischen Änderungen bestehender Fragen.

Die Schätzwerte wurden gegen veröffentlichte Quellen geprüft. Verlinkt sind zuständige Organisationen, Hersteller, Museen, Verbände und wissenschaftliche Institutionen; beim Titanic-Datensatz die Wiedergabe des ursprünglichen britischen Untersuchungsberichts. Publizierte Näherungswerte und Herstellerangaben bleiben solche: etwa Skelettvarianten, 217 Meter gerundete Fernsehturmhöhe, rund 155 Kilometer Berliner Mauer und bis zu drei Jahre Tabasco-Lagerung. Historische Normen sind datiert, beispielsweise FIBA 2024. Keine frei erfundenen Fermi-Werte. Quellenprüfung ersetzt nicht die redaktionelle Freigabe. Die Antworttoleranz ist bewusst noch offen.

Die Personenreferenzen aller 50 Anagramme wurden auf Erreichbarkeit und Identität geprüft. Die bestehende Normalisierung zerlegt Umlaute, entfernt Satzzeichen/Leerzeichen und behält ß bei. Daher steht zum Beispiel „Cleopatra“ als konkrete Namensform im Datensatz; alternative Schreibweisen müssen gegebenenfalls separat zugelassen werden. Die Anagramme bestehen aus zwei bis vier Wörtern. Wortwitz, Sprachgefühl und Bekanntheit sind vor einem Einsatz redaktionell zu prüfen.

Bestehende Kandidaten stammen aus früheren UI-Beobachtungen; das Paket ist kein vollständiger Production-Snapshot. Weder alle aktuellen Statuswerte noch Medien und Wiederholungen sind verifiziert. Zahlen in der Gap-Liste sind deshalb vorläufig; `missingVerifiedProduction` bleibt ausdrücklich unbekannt. Die lokalen Anagramm- und Schätzpools sind noch nicht importiert.

## Offene Aufgaben vor der endgültigen Auswahl

1. Vollständigen, autorisierten Read-only-Bestand bereitstellen: Statusmatrix, Templateverteilung, Kategorienabdeckung und verifizierte Kandidatenverfügbarkeit fehlen weiterhin.
2. Kandidaten fachlich prüfen, Quellen/Medien öffnen, Rechte und Wiederholungen dokumentieren. Pixelmotive und zweite FaceMorph-Lösung sind teilweise unbekannt.
3. Vorläufige Medienlücken schließen: zwei Meme, ein Rückwärts-Musiktitel, zwei FaceMorphs, vier Google-Rezensionsfragen; drei Wahr/Falsch-Entwürfe sind in der Matrix vorgeschlagen und noch auszuarbeiten. Neue Flaggen, Umrisse und Kunstmedien ebenfalls vorbereiten.
4. Vier Inhalte „Übersetzt vorgelesen“ liefert ausschließlich der Product Owner.
5. Schwierigkeit der korrespondierenden Slots, Formulierungen und Bewertungstoleranzen redaktionell bestätigen. Die Zeitplanung in der Generalprobe prüfen.
6. Finale Auswahl separat freigeben. Production-Import, Fragenfreigabe, Umbenennung der Eventreihe, Merge und Deployment benötigen weiterhin eigene Freigaben.

## Production-Blocker und technische Trennung

[PR #92](https://github.com/justphilgud/pubquiz-web/pull/92) bleibt offen. Die getestete Read-only-Projektion ist vorhanden; der Production-Zugriff ist blockiert. Weitere Versuche zur Entschlüsselung von `DATABASE_URL` oder Umgehung von Zugangsbeschränkungen finden nicht statt. Der vorhandene Anwendungsexport ist keine ausreichende Alternative: Er erzwingt keine PostgreSQL-Transaktion mit `READ ONLY` und enthält nicht die vollständige Analyseprojektion. Er wurde nicht für diese Analyse ausgeführt. Keine neuen Production-Endpunkte.

Die Variety-Domainfunktion wird getrennt vorbereitet und ausschließlich synthetisch getestet. Persistente Kategorien, Eventreihen-/Quizkonfiguration und UI sind nachfolgende Arbeitspakete. Dieses Paket besitzt keine technische Abhängigkeit von ihnen und verändert keine bestehenden offenen PRs.
