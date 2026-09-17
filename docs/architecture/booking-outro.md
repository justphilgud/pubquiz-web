# Buchungs-/Kontaktfolie im Outro

Release-Candidate-Voraussetzung, 17.09.2026.

## Vertrag

Zusätzliche optionale feste Folie `BOOKING_CONTACT`, nach dem bisherigen Outro
(Sortierung 60). Bei Bestandsquizzen und neuen Quizzen zunächst deaktiviert. Die
bisherigen Folien behalten Typ, Inhalt, Reihenfolge und Sichtbarkeit.

Pflege: Quiz → Outro konfigurieren → Buchung / Kontakt. Bestehende `requireQuizEditor`-
Berechtigung vor jedem Speichern, `requireQuizViewer` beim Lesen. Adminrolle wird nicht
zusätzlich vorausgesetzt; die vorhandene quizbezogene Berechtigung bleibt maßgeblich.

Headline, Subheadline, Beschreibung, CTA, Telefon, E-Mail, Instagram, HTTPS-QR-Ziel und
höchstens drei Nutzenhinweise sind editierbar. Instagram initial `@ungegoogelt`, QR-Ziel
initial die zugehörige Instagram-Adresse; Telefon/E-Mail bleiben leer. Leere Felder
werden ausgeblendet, nicht ungefragt durch Defaults ersetzt. Leeres QR-Ziel: kein QR.
Eingabelimits und serverseitige Validierung in `app/quiz/bookingSlide.ts`.

QR-Code wird mit bereits vorhandenem react-qr-code aus dem gespeicherten Ziel erzeugt.
Keine URL-Auflösung, kein Serverfetch, keine neue Dependency. Nur HTTPS ohne Credentials;
keine javascript-/data-/protokollrelativen Ziele. Text wird durch React escaped.

## Persistenz und Rückwärtskompatibilität

`quiz_ablauf_elemente.konfiguration.booking`, Version 1, vorhandene JSONB-Spalte;
Sichtbarkeit in `ist_sichtbar`. Kein neues DB-Feld und keine SQL-Migration. Bestehende
Materialisierung ergänzt die ausgeschaltete Defaultfolie, sobald eine autorisierte
Ablaufbearbeitung erfolgt. Lesen allein materialisiert nicht neu. Quizkopie verwendet
die bestehende vollständige Konfigurationskopie; gesonderter Regressionstest prüft sie.

Ein alter Code-Release kennt BOOKING_CONTACT nicht und überspringt diesen neuen Typ;
die JSON-Daten bleiben erhalten. Das ersetzt nicht die separate Migrationsanalyse des
gesamten Release Candidates.

## Verantwortlichkeiten und Invarianten

- Bestehender Ablauf: Berechtigung, Position, Sichtbarkeit, Speicherung, Kopie, Navigation.
- Reines Inhaltsmodul: Defaults, Normalisierung, URL-/Kontakt-/Längenprüfung.
- Eigener Renderer: Typografie, Kontaktangaben, dynamischer QR-Code; vorhandene Themefarben.
- CSS ausschließlich auf neue booking-Klassen begrenzt. Andere Presets behalten ihre
  bestehenden Folien; die zusätzliche Folie verwendet deren Themevariablen.
- Keine Antwortöffnung, keine Animation als Logiktreiber, kein Timer, keine Deadline-
  oder Pixeländerung. Teilnehmerstatus für die Buchungsfolie: „Das Quiz ist beendet“.
- Testmodus erhält einen direkten Sprung zur aktivierten Buchungsfolie.

## Tests und Abnahme

`bookingSlide.test.tsx`: Defaults, leere Felder, unerlaubte URLs, Kontakte, Länge,
Reload-/Parservertrag, unterschiedliche QR-Ziele, Escaping. `quizCopyContract.test.ts`
prüft unveränderte JSON- und Sichtbarkeitskopie. Bestehende Flow- und Fixed-Slide-Tests
prüfen die zusätzliche ausgeschaltete Folie und unveränderte bisherigen Outroelemente.

Browserabnahme einschließlich Speichern, Reload, Kopie, Full HD/720p und QR-Decodierung
muss vor Abschluss dieses Pakets separat nachgewiesen werden. Ein grüner Unit-Test
ersetzt diese Abnahme nicht.
