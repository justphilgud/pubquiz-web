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

## Übersetzung und Browserstimmen

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

`getQuestionDuplicateFingerprint` bildet die fachliche Kernfrage zentral ab:

- Standard und Wahr/Falsch: Fragentext beziehungsweise Aussage
- Übersetzt vorgelesen: Originaltext und gesuchte Lösung
- Google-Rezensionen: Ortsname oder Ortslink plus Reviewtexte beziehungsweise
  Reviewlinks; die Place ID bleibt nur ein Legacy-Fallback
- Anagramm: Ursprungsname
- Schätzfrage: Fragentext, Zielwert und Einheit
- Reihenfolge: Aufgabenstellung und normalisierte Elementmenge

Ein generischer Templatefragetext allein erzeugt damit keine Warnung.

## Datentransfer und manuelle Regression

Export und Import übertragen Template-ID und das vollständige normalisierte
JSON. Der Klonpfad kopiert Template-Fremdschlüssel und Konfiguration.

Manuell zu prüfen sind insbesondere Browserstimmen in Chrome und Edge,
Pointer-/Touch-Sortierung, sichtbare Schätzeinheiten, das Verbergen des
Übersetzungsoriginals sowie Reviewkarten mit und ohne ausgeblendete Autoren-
und Sternhinweise.
