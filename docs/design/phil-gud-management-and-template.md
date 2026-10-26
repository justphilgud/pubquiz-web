# Phil Gud: Verwaltung und ausdrückliches Quiztemplate

Stand: 26.10.2026. Eigener Branch nach Main/PR #131. Nur isolierte Preview und fachliche Abnahme; kein Merge oder Production-Release.

## Verifizierte Referenz und Originalassets

Die aktuelle https://philgud.events/ wurde im echten Browser geprüft, einschließlich berechneter Styles. Der Rechercheabruf konnte die Seite nicht öffnen; der direkte Browserzugang und der Abruf der tatsächlich verlinkten CSS-Datei funktionierten. CSS-Referenz: `/_next/static/css/129f3a3ea223e284.css`.

- Hintergrund: Schwarz `#000000`, warmes Offwhite `#FAF8F2`, Text `#171717`; Akzente Gelbgrün `#F0FC16`, Rosa `#F6C4DC`. Fokus wird für ausreichend Kontrast etwas dunkler als der Website-Akzent: `#A32661`.
- Markenschrift: **Phil Gud Display Regular**, PostScript **PhilGudDisplay-Regular**, Website-CSS-Alias `PhilGud`. Original `https://philgud.events/phil-gud.woff`, unveränderte selbst gehostete Datei `public/branding/phil-gud/phil-gud.woff`, SHA256 `ab4436805cd8dc4f947279b81a34d8103a3bf42da578e685368df6452631658d`. Ein vorhandener Regular-Schnitt; keine erfundenen Gewichte. Cmap geprüft: ÄÖÜ äöü ß und Ziffern 0–9 besitzen Glyphen.
- Tatsächliches Website-Logo: `https://philgud.events/phil-gud.png`, Inhalt ist JPEG (1536×1536), deshalb lokal ehrlich `website-logo.jpg` benannt; Bytes unverändert, SHA256 `1026945d8d04338db2391dd6b5bfaf1174f38f55492ba76e07b498be79f83f4e`.
- Gudi: `https://philgud.events/gudi-transparent.png`, PNG 660×720, lokal `website-gudi.png`, SHA256 `dca783730a6689ec6c189c7befd3365a9b22140a5b86b4fc723df5b9dc977cdb`.
- Arial/Helvetica/Sans Serif als funktionale Ergänzung entsprechend der Website: Tabellen, Eingaben, längere Texte, Fehlermeldungen. Die Markenschrift wird nicht als installierte Schrift vorausgesetzt: ausschließlich lokale URL, `font-display: swap`, sofort nutzbarer Fallback.

## Bewusste Gestaltungsentscheidungen

Die Website ist eine Marketingfläche mit großen Überschriften. Verwaltung verwendet dagegen kompakte Überschriften (maximal 32 px), kurze Zeilenabstände, ruhige helle Arbeitsflächen, kleinere Kartenradien, unveränderte Touchziele und keine dekorative Animation. Schwarzer Kopfbereich, echtes Logo, Markenschrift und gelbgrüner Aktivmarker stellen die Zugehörigkeit her. Zustandsfarben bleiben semantisch unterscheidbar; kein pauschales Einfärben sämtlicher Erfolgsmeldungen in Markenfarbe.

**Benannter Konflikt:** Das ungegoogelt-Manifest definiert eine Serifenschrift für redaktionelle Titel. Der ausdrückliche Auftrag verlangt hier die vorhandene Phil-Gud-Schrift. Dies ist eine eigene Markenwelt mit bewusst abweichender Display-Stimme, kein stiller Umbau von ungegoogelt, LOVD, Storybook oder Komm.ONE. Klarheit, Lesbarkeit, Inhaltserhalt und sparsame Bewegung bleiben verbindlich.

## Architektur und sichere Grenze

`PHIL_GUD` in `app/branding/philGud.ts` enthält wiederverwendbare Markenwerte und Assetreferenzen ohne Spielvertrag. Spätere Eventarten dürfen diese Daten nutzen, erhalten dadurch aber weder Spielflächen noch Rechte.

`AdminAppearance` ist ausschließlich eine visuelle Grenze im Rootlayout. Die reine `isAdministrationPath`-Policy markiert bekannte Verwaltungs-/Login-/Kontorouten. Live-Präsentation, Moderation, Teamformular, interne Quiztestansicht, öffentliche Einreichung und Präsentationsreferenz erhalten keinen Wrapper. Die Komponenten behalten ihre Actions, Berechtigungen, Formzustände, Filter, Rückwege und Dirty-Guards; PR-131-Navigation und Bezeichnungen bleiben unverändert.

Styles gelten nur unter `[data-admin-ui="phil-gud"]`. Eingebettete `[data-quiz-theme-version]`-Flächen und deren Nachfahren sind explizit ausgenommen. Portal-Dialoge erhalten dieselbe ausdrückliche Routengrenze über einen rein visuellen React-Kontext am Dialoginhalt (kein Router im gemeinsamen Modal), ohne Overlay-, Fokus-, Escape- oder Schließlogik zu ändern. Keine globalen Tailwind-Farbtokenänderungen, keine allgemeine Umfärbung von Spielen. Header/Anmeldekarte bekommen das echte Logo mit korrekten intrinsischen Dimensionen. Bestehendes `APP_BRAND` wird nicht als neues Runtime-Theme global umdefiniert.

## Zusätzliches Template „Phil Gud“

System-ID `phil-gud`, zusätzlicher auswählbarer Registry-Eintrag samt Antwortformularpartner. Systemdefaults, vorhandene IDs und Zuweisungen bleiben unverändert. Verwendet den bestehenden Corporate-Kompositionsvertrag und denselben produktiven `PresentationSlideRenderer`, ohne neue Renderingengine oder Laufzeitlogik. Ruhige schwarze Flächen, Originalschrift für kurze Überschriften, funktionale Schrift für längere Kernfragen/Antworten, Original-Logo, reduzierte Rahmen, keine Corporate-Dekoration oder fremder Slogan.

`BrandTypographyTokens.displayFamily` ist optional und wird gegen die vorhandene Font-Allowlist validiert. Alte Konfigurationen ohne dieses Feld bleiben unverändert; neue Phil-Gud-Konfigurationen und explizite Kopien behalten es. `QuizThemeScope` markiert ausschließlich diese ausdrücklich konfigurierte Display-Stimme. Nur diese Markierung aktiviert die zusätzlichen Template-Regeln. Keine Datenbankmigration.

### Bewusst auswählen

In Quiz-Einstellungen die Präsentationsvorlage **Phil Gud** wählen und speichern. Für das Teamformular kann unabhängig die Antwortformularvorlage **Phil Gud** gewählt werden; unveränderte Auflösung Quiz → Reihe → System. Alternativ ausdrücklich als Reihenstandard setzen, sofern fachlich gewünscht – diese Umsetzung tut das nicht automatisch. Präsentation und Moderationsvorschau verwenden das gewählte Präsentationstheme; die Moderations-/Antwortoberflächen folgen ihren vorhandenen separat aufgelösten Verträgen. Keine automatische Umstellung laufender Sessions. Templates ist weiterhin Adminverwaltung; Inhalte/Berechtigungen werden dadurch nicht erweitert.

## Prüfung und isolierte Testdaten

Zuerst tatsächlich im Browser geprüft: Inhaltsliste, Frageneditor, Frage und Auflösung über den produktiven Renderer. Eigene Schrift sichtbar geladen; berechnete Fontfamilie und getrennte funktionale Schrift kontrolliert. Darauf beruhen die weiteren Verwaltungsanpassungen.

Isolierte Datenbank `pr130_review_20261025` am bestätigten Nonproduction-Host. Neues Testquiz **Phil Gud · Designabnahme**, ID 4, drei eigene synthetische Fragen (IDs 5–7), explizite Präsentations-/Antwortvorlage `phil-gud`. Neue isolierte Editor-Speicherprobe ID 8 wurde per Oberfläche gespeichert, erneut geöffnet und vollständig neu geladen; Umlaute, ß, Ziffern und Antwort erhalten. Vorhandene Zuordnungen, echte Daten, Migrationshistorie und Production wurden nicht verändert. Keine Daten aus Preview nach Production übernehmen.

Automatische Tests prüfen Routengrenze, bestehende Defaults/LOVD-Asset, validierte optionale Displayfamilie, Original-Fonthash, Swap/Fallback sowie alle vorhandenen synthetischen Rendering-Szenarien im neuen Theme und fehlende Phil-Gud-Markierung in bisherigen Designwelten. Die Fontauswahl wird um genau die echte Originalschrift erweitert (14 statt 13 Einträge). Keine Testlockerung für Inhalts-/Berechtigungsregeln.

Browsergeometrie, tatsächliche Kontraste, Rollen, Speichern/Abbrechen und finaler CI-/Deploymentstand werden im PR-Abnahmebericht mit konkreten Ergebnissen und verbleibenden Grenzen protokolliert. Laufende Prüfungen sind kein Erfolgsnachweis. Gehostete Preview benötigt die separate menschliche Freigabe des neuen Branches nach der bestehenden Medien-/Environment-Policy.
