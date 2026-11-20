# Fragentemplates: zentrale Architektur

Die fachliche Quelle für alle Fragentemplates ist
`app/fragen/editor/templates/questionTemplates.ts`. Registry, Editor,
Validierung, Runtime, Präsentation, Moderation, Import, Export und Klonen
verwenden dieselbe diskriminierte Konfiguration unter
`fragen.template_config_json.templateData`.

## Fragentext und Validierung

`fragen.frage` ist die einzige fachliche Quelle des Fragentexts. Bei älteren
Wahr/Falsch-Daten gewinnt ein nicht leerer kanonischer Fragentext; nur wenn er
leer ist, wird `templateData.statement` einmalig übernommen. Ein
Templatewechsel überschreibt vorhandenen Fragentext nicht.

Entwürfe dürfen unvollständig bleiben. Einreichen und Freigeben verwenden die
strikte zentrale Validierung. Templatefehler besitzen qualifizierte Codes und
Fokusziele. Bei einer Schätzfrage ohne Einheit lautet der Fehler
`ESTIMATE_UNIT_REQUIRED` und zeigt direkt auf das Einheitenfeld; er wird nicht
als fehlende Antwort oder ungültige Pixelkonfiguration ausgegeben.

Bei „Paare bilden“ stehen Lösungen ausschließlich in `templateData.pairs`.
Der Editor lädt eine leere klassische Antwortliste ohne Platzhalter. Dadurch
kann die Statusaktion die gespeicherte Paarfrage strikt validieren und ohne
Inhaltsänderung freigeben. Tatsächlich gespeicherte klassische Antworten bleiben
sichtbar für die Validierung und werden nicht stillschweigend verworfen.

## Dublettenhinweise

Der Frageneditor vergleicht Standardfragen und klassische Auswahlfragen weiterhin
über normalisierte Textähnlichkeit. Für Spezialtemplates vergleicht er die
vollständige fachliche Signatur des jeweiligen Templates. Dazu gehören bei
Paarfragen die sortierten Links-Rechts-Tupel, bei Fakten Hinweise und Lösungen
einschließlich Varianten sowie bei Reihenfolgen die kanonische Reihenfolge.
Mediengebundene Templates benötigen die Referenz auf ihr inhaltliches Medium.
Technische IDs, Frage-Metadaten und abgeleitete Pixel- bzw. Audiovarianten mit
vorhandener Originalreferenz werden ignoriert. Fehlende Vergleichsdaten erzeugen
keine exakte Meldung. Ein gleicher Platzhaltertext genügt bei Spezialtemplates nie.

Der Server begrenzt Treffer auf die bestehende Sichtbarkeit und bei
Nichtadministratoren weiterhin auf eigene Fragen. Archivierte und die aktuell
bearbeitete Frage sind ausgeschlossen. Die Suche ist ein redaktioneller Hinweis
und ändert keinen Speicher- oder Freigabestatus. Der Excel-Import nutzt dieselbe
Paar-Normalisierung. Standardtextimporte vergleichen keine generischen
Spezialvorlagentexte. Regressionen prüfen `questionSimilarity.test.ts`,
`excel-question-import.integration.test.ts` und den dazugehörigen Browsertest.

## Übersetzung und Browserstimmen

Der Editor zeigt zusätzlich eine rein abgeleitete Vorlesedauer aus Übersetzung und
Geschwindigkeit, ohne Textänderung oder Generatoraufruf. Annahme, Leerzustand und
Regressionen stehen in [Quiz-Ampeln und Vorlesedauer](quiz-balance.md#vorlesedauer).

Original und Übersetzung werden getrennt gespeichert und sind auf je 2.000
Zeichen begrenzt. Der Originaltext bleibt im Editor, Export und Klon erhalten,
wird aber weder im Teamformular noch in der normalen Präsentation ausgegeben.

Die tatsächlich auf dem Gerät vorhandenen `speechSynthesis`-Stimmen werden
über `getVoices()` und `voiceschanged` geladen. Stimmen der Zielsprache werden
priorisiert, weitere Stimmen nach Gebietsschema gekennzeichnet. Die
Konfiguration trennt `voiceProvider`, `voiceId`, `voiceStyle` und
`voiceInstruction`. Eine nicht vorhandene Dialektstimme wird nicht
vorgetäuscht; fehlt die gespeicherte Browserstimme, gilt der sichtbare
Standardstimmen-Fallback.

## Anagramme

Der lokale Generator ignoriert die Wortgrenzen des Ausgangstexts und bestimmt
die Wortzahl automatisch. Er bewertet nacheinander vollständige deutsche und
englische Wörterbuchkombinationen, bekannte Wörter mit aussprechbaren
Restbegriffen, vollständig aussprechbare Fantasiewortkombinationen und zuletzt
formal gültige Fallbacks. Kandidaten werden unter anderem nach Vokal-/
Konsonantenwechseln, üblichen Buchstabengruppen, Segmentlänge und Abstand zur
Originalreihenfolge bewertet.

Alle angezeigten Vorschläge verwenden exakt dieselben normalisierten
Buchstaben. Unveränderte Namensteile, reine Rückwärtsformen, Rotationen und
Duplikate werden ausgeschlossen. Die internen Qualitätsstufen `DICTIONARY`,
`MIXED`, `PRONOUNCEABLE` und `FALLBACK` steuern nur das Ranking und sind kein
zusätzliches UI-Feld. Manuell bearbeitete Anagramme durchlaufen dieselbe
buchstabengenaue Validierung.

## Google-Rezensionen und Places-Grenze

Der normale Editor ist ein kompakter manueller Workflow. Sichtbar sind nur
Ortsname und -link, optionale Zusatzangabe sowie die redaktionellen
Rezensionsfelder. Place ID, Attribution und technische Übernahmezeitpunkte
werden nicht manuell gepflegt. Bestehende Werte bleiben beim Laden, Speichern,
Import, Export und Klonen erhalten.

Die drei Darstellungsoptionen verwenden die zentrale
`components/ui/Checkbox` mit `variant="card"`. Die native Checkbox ist das
einzige Auswahlzeichen; Rahmen und Hintergrund unterstützen den aktiven
Zustand. Das Grid steht auf kleinen Bildschirmen untereinander und ab `sm` in
drei Spalten. Dadurch bleiben Semantik, Tastaturbedienung und Fokusdarstellung
identisch mit der gemeinsamen Komponentenbibliothek.

Google Places ist eine optionale Recherche- und Übernahmehilfe. Ihre Oberfläche
erscheint ausschließlich, wenn `GOOGLE_PLACES_FEATURE_ENABLED=true` gesetzt
und zusätzlich ein plausibel konfigurierter serverseitiger
`GOOGLE_MAPS_API_KEY` vorhanden ist. Ohne diese doppelte Freigabe erscheinen
weder Recherchebuttons noch deaktivierte Platzhalter oder Konfigurationshinweise.
Die Server Actions prüfen unabhängig davon weiterhin die vorhandene
Fragebearbeitungsberechtigung.

Verwendet werden die offiziellen Places-API-(New)-Endpunkte:

- `GET https://places.googleapis.com/v1/places/{placeId}` für Ortsdetails und,
  in einem getrennten expliziten Abruf, verfügbare Rezensionen
- `POST https://places.googleapis.com/v1/places:searchText`, wenn der geprüfte
  Maps-Link keine Place ID enthält

Anzeigename, formatierte Adresse, Durchschnittsbewertung, Bewertungsanzahl und
die gelieferten Reviewobjekte leben nur im lokalen Zustand der aktuellen
Editoransicht. Erst „Ortsname übernehmen“ beziehungsweise
„Als Quiz-Rezension übernehmen“ kopiert sichtbare Werte in frei editierbare
Quizfelder. Ein erneuter Abruf überschreibt diese Felder nicht.

Dauerhaft gespeichert werden beim Ort `placeId`, `placeMapsUrl`, der
redaktionelle `placeName`, `placeAdditionalLabel` und
`placeImportedOrEditedAt`. Eine Rezension enthält ausschließlich `text`,
`authorName`, `rating`, `publishedLabel`, `sourceUrl`, `attributionText` und
`importedOrEditedAt`. Die früheren Namen `mapsUrl`, `accessedAt`, `author`,
`dateLabel` und `reviewSourceUrl` werden beim Einlesen rückwärtskompatibel
normalisiert. Rohantworten, aktuelle Ortsadresse, Durchschnittsbewertung und
Bewertungsanzahl werden verworfen.

Ein geteilter Reviewlink kann über die offizielle API nicht garantiert einer
Einzelrezension zugeordnet werden. Nur ein exakt einmal vorkommender
`googleMapsUri`-Treffer gilt als eindeutig; andernfalls bleiben Auswahl oder
manuelle Pflege. Scraping, Headless-Browser, interne Google-Payloads und
Hintergrundabgleiche sind ausgeschlossen.

Kurzlinks werden nur serverseitig und ohne Bodyverarbeitung aufgelöst.
HTTPS-/Host-Allowlist, DNS-Prüfung gegen lokale und private Ziele, erneute
Prüfung jedes Redirects, Redirect-, Größen- und Zeitlimits, sichere
API-Fehlerklassen und Klickbegrenzung schützen den Abruf. Schlüssel und
Rohantworten werden nicht geloggt.

In der Quizfrage können Autor und Sterne optional bis zur Auflösung verborgen
werden. Ortsname und Ortslink erscheinen erst in der Auflösung; technische
Referenzen bleiben unsichtbar.
Präsentation und Moderation verwenden nur die gespeicherte redaktionelle
Fassung und führen keine Google-Anfrage aus.

## Dubletten-Fingerprints

`getQuestionDuplicateFingerprint` bildet die fachliche Kernfrage zentral ab.
Wahr/Falsch vergleicht Aussage und Wahrheitswert. Schätzfragen vergleichen
Aufgabe, Zielwert und Einheit. „Übersetzt vorgelesen“ vergleicht Original,
Übersetzung, Sprachen und akzeptierte Lösungen. Google-Rezensionen vergleichen
redaktionellen Ortsnamen und Rezensionstexte. Anagramme vergleichen Ursprungsname
und das gezeigte Anagramm. Eigene Vorlagen auf Standardbasis vergleichen ihre
Antwortfelder und relevanten Medien.

## Datentransfer und manuelle Regression

Der [Excel-Fragenimport](excel-question-import.md) legt offene Standardfragen,
Einfachauswahl und Paare als medienfreie Entwürfe mit der Editorvalidierung an.
Die Paarzeilen behalten ihre Zuordnung. Die bestehende Laufzeit mischt beide
Seiten unabhängig und bewertet jede richtige Verbindung mit 0,25 Basispunkten.

Export und Import übertragen Template-ID und das vollständige normalisierte
JSON. Der Klonpfad kopiert Template-Fremdschlüssel und Konfiguration.

Manuell zu prüfen sind insbesondere Browserstimmen in Chrome und Edge,
Pointer-/Touch-Sortierung, sichtbare Schätzeinheiten, das Verbergen des
Übersetzungsoriginals sowie Reviewkarten mit und ohne ausgeblendete Autoren-
und Sternhinweise.
