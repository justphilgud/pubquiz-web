# Gemeinsamer Bedienstandard für Eventarten

Stand: 30.10.2026 · Konzeptfassung V3.1. Verbindliche Leitplanke für künftige Implementierungsaufträge; **keine Behauptung, dass alle Zielregeln bereits implementiert sind**. Keine Implementierungs-, Migrations- oder Releasefreigabe. Basis der Bestandsprüfung: Main `8fa60b68c0713dfe06e5dd6a203a369e1e73b961`.

## Geltung und Einordnung

Ergänzt [Editorprinzipien](editor-principles.md), [stabile Navigation](multi-event-navigation.md), [Quiz-Lifecycle](quiz-lifecycle.md), [Quiz-Runtime](quiz-runtime-contracts.md), [Antwortinteraktionen](answer-interaction.md), [gemeinsames Design](shared-game-design.md), [Phil-Gud-Verwaltung](../design/phil-gud-management-and-template.md) und [Designmanifest](../design/ungegoogelt-design-manifest.md). Bestehende Fachverträge bleiben für tatsächliche Laufzeit und Daten maßgeblich. Historische Aussagen wie „Bingo nur Vorbereitung“ im ursprünglichen Navigationskonzept sind durch [Bingo AP3](bingo-live.md) überholt; daraus keine Einschränkung des vorhandenen Spielbetriebs ableiten.

Neue **Eventarten** übernehmen diesen Rahmen; Abweichungen brauchen dokumentierten fachlichen Grund und gezielte Abnahme. Ein neues **Event** einer vorhandenen Art nutzt deren standardisierten Ablauf und bekommt keine individuelle Sonderoberfläche. Fachlogik darf verschieden bleiben: keine Universalengine, gemeinsame Laufzeittabelle oder künstlichen Quizdatensätze vorgeschrieben.

### Statuskennzeichnung

- **Bestand:** im unten genannten Code/Vertrag vorhanden; kein erneuter Production-Funktionstest dieses Dokumentationsauftrags.
- **Zielregel:** für neue/geänderte Implementierung verbindlich, noch nicht durchgängig vorhanden.
- **Formatspezifisch:** fachlich begründete Abweichung vom Rahmen.
- **Offen:** vor dem betroffenen Implementierungspaket entscheiden, keine stillschweigende Änderung.

## Begriffe

| Begriff | Bedeutung |
| --- | --- |
| Eventreihe | Gemeinsame organisatorische Zuordnung, Branding und Produktfreischaltungen; bestehende getrennte Benutzer-/Verwaltungsrechte. Kein global umschaltbarer Arbeitskontext. |
| Eventart | Produkt/Fachformat wie Quiz, Bingo, PowerPoint-Karaoke; Freischaltung ist Voraussetzung, aber kein Benutzerrecht. |
| Event | Konkrete Veranstaltung bzw. gespeichertes Spiel mit Reihe, Titel und optionalem Termin. Termin ist kein Laufzustand. Bestehende Quiz- und Spiel-IDs behalten ihre Bedeutung. |
| Runde | Fachlicher Abschnitt eines Events, z. B. eigener Bingo-Kartenbestand und Ziehungsfolge; nicht überall identisch mit einem Quizblock. |
| Technischer Durchlauf | Persistierte Ausführung mit eigener Identität/Revision/Zeit/Historie. Von Stammdaten, Event und Runde unterscheiden; kein impliziter Neustart durch Öffnen oder Reload. |

## Gemeinsame Regeln und Abnahmekriterien

| ID / verbindliche Zielregel | Bestand / Planung | Spätere Review- und Prüfkriterien |
| --- | --- | --- |
| B01 Navigation: vorhandene Reihenfolge Quiz · Bingo · PowerPoint-Karaoke · Teams · Templates · Eventreihen · Administration. Lokale Reihenfilter verändern keine Hauptnavigation und verleihen keine Rechte. Echte Links und validierte interne Rückwege erhalten den zulässigen Listen-/Filterkontext. | Bestand: WorkspaceNavigation, workspacePolicy, workspaceCollectionHref und bestehende Rückweg-Policies. | Rollenunion, fremde/entzogene Rechte, direkte Objektlinks, externe/manipulierte Rückwege, Rückkehr mit lokalem Filter; Desktop und Mobil. |
| B02 Einheitliche Eventzeile: Titel, Reihe, Art, Termin, realer Spielstatus; Aktionen in fester Reihenfolge Vorbereiten · Moderation · Präsentation. Listeneinstiege öffnen nur, starten nichts. | Ziel: gemeinsame Zeile in Formatlisten, Reihenansicht und optionalem Home-Aggregat. Quiz hat bereits direkte Einstiege; Bingo-Liste noch nicht vollständig. | Derselbe erlaubte Datensatz in allen relevanten Listen, lange Titel, fehlender Termin, echter Laufstatus statt DRAFT; nachweislich keine Laufmutation beim Öffnen. |
| B03 Reihendetail trennt Events und Einstellungen. Events formatübergreifend; Anlage übernimmt Reihe und bietet Schnittmenge aus Freischaltung und Erstellrecht. | Ziel: heute Quizliste und Produkt-Sofortschalter auf Detail; Eventarten fehlen im Bearbeitungsformular. | Admin, Reihenverwalter, Editor/Manager je Art; keine fremden Objekte; keine implizite Produktaktivierung; Leerzustand und passende Rückwege. |
| B04 Terminstatus und Spielstatus getrennt. Vergangenheit bedeutet nicht beendet; DRAFT-Metadaten bedeuten nicht ungespielt. | Ziel für Bingo-Listen; Laufstatus im AP3-Durchlauf bereits vorhanden. | Kombinationen Datum fehlt/zukünftig/vergangen mit Vorbereitung/laufend/pausiert/beendet; keine zweite Statusquelle. |
| B05 Moderation übernimmt dunklen Quiz-Rahmen: kompakter Kopf mit Titel/Laufstatus/Start/Rückweg, zentrale Arbeitsfläche, zugehörige Hauptsteuerung, ergänzende Seitenbereiche. Präsentation separat direkt öffnen. | Quiz-Bestand `ModerationClient.tsx:994ff`; Bingo-Anpassung geplant. Verwaltungsdesign bleibt hell und auf Verwaltungsrouten begrenzt. | Gleiche Positionen, Kontrast und Bedeutungen; längere Titel, Status-/Fehlertexte, 1280×720, 1366×768 und 390×844 gemessen. Keine Admin-CSS-Lecks. |
| B06 Aktionen: Hauptaktion am Arbeitsplatz, häufige Aktionen direkt erreichbar; Folgenreiche separat, mit Auswirkung und Bestätigung. Keine konkurrierenden Start-/Ende-Einstiege. | Muster teilweise vorhanden. Quiz besitzt historische Resetaktion; daraus **keine** neue Resetpflicht oder Bingo-Resetfunktion ableiten. | Fokus und Tastatur, sichtbare Beschriftung/Name, pending/Doppelklick, eindeutiger Erfolg/Fehler. Öffnen/Weiter/Start/Ende nicht gleichsetzen. |
| B07 Speichern: Formulardraft, gemeinsames explizites Speichern, Abbrechen verwirft Ungespeichertes. Verborgene/ausgefilterte oder nicht bearbeitbare Werte erhalten. Autosave nur als dokumentierter Fachvertrag. | Bestehende Formguards; vereinheitlichte Reihen-/Produktspeicherung geplant. Adminproduktrecht bleibt getrennt. Binärupload ist nicht durch eine DB-Transaktion automatisch atomar. | Abbrechen, Filterwechsel, Reload, Konflikt zweier Tabs, manipulierte Payloads, unveränderte versteckte Rechte; Uploadfehler/Referenzspeicherung sichtbar. |
| B08 Dialog/Fokus: vorhersagbares Schließen und Fokus zurück zum Auslöser. Dialoge dürfen zeitkritische wiederholte Liveeingaben nicht blockieren. Prüfungsentwürfe bei Kontextwechsel erhalten. | ConfirmDialog/Modal als Bestand; nichtmodaler Bingo-Prüfbereich geplant. | Tab/Shift+Tab/Escape gemäß Flächentyp; keine Focus-Trap im nichtmodalen Arbeitsbereich; zusätzliche Rufe möglich, begonnene Karte/Begründung unverändert. |
| B09 Reload/Verbindung/Konflikte: persistierten Lauf lesen, nicht neu starten; unbestätigte Aktionen nicht als Erfolg ausgeben. Während Verbindungsstörung schreibgeschützt, letzter bestätigter Stand markiert. Revision/CAS und Request-ID erhalten. | Bingo AP3 serverseitig vorhanden, UI-Ausbau geplant. Lokaler Prototyp hat keine Persistenz. | Reload zwei Fenster, Reihenfolge verspäteter Antworten, Rechteentzug, Konflikt vor Bestätigung, unveränderte Wiederholung mit gleicher Request-ID, keine doppelte Veröffentlichung oder stille Überschreibung. |
| B10 Responsive/zugänglich: Hauptaktionen erreichbar, Touchziele mindestens 44×44 CSS-px, sichtbarer Fokus, logische Reihenfolge, Status nicht nur Farbe. Feste Leisten reservieren Platz. | Ziel, pro Oberfläche tatsächlich prüfen. Quizkopf enthält heute auch 36px hohe Controls; keine pauschale bestehende Konformität behaupten. | Tatsächliche Viewportmessung, Klick-/Überdeckungsgeometrie, schmale Höhe/Bildschirmtastatur möglichst real, Zoom, Tastatur und Touch; Geräte-/Vollbildgrenzen ausdrücklich benennen. |
| B11 Rollen, Produkte, Archiv: jede Lese-/Schreibaktion prüft tatsächliche Objekt-ID und aktuelle Rechte. Produktfreischaltung Admin, Reihenverwaltung separat; keine Karaoke-Editorrechte. Archiv-/Laufgrenzen erhalten. | Bestand: Role-/Game-/EventSeries-Policies und AP3-Schreibsperren. Quizdeaktivierung bei laufendem Quiz gesperrt. Gleichartige Bingo-Deaktivierungssperre heute nicht vorhanden. | Fremde Reihen, manipulierte IDs, deaktiviertes Produkt, entfernte Zuordnung, archivierte Reihe/Spiel/Karte, keine stillen Ersatzrollen; laufender Quizschutz bleibt. |
| B12 Gestaltungssphären getrennt: Administration, Moderation, Publikum und Druck haben Aufgaben und Geltungsbereiche. Gemeinsames Branding erzeugt keine gemeinsame Fachlogik und ändert keine Standardzuordnung. | Bestand: AdminAppearance/philGud.css, SharedDesign-V1, AP2 Druckstände, AP3 eingefrorenes Live-Design. | Scope-Regressionen, Vorlagenvererbung, Originalassets, bestehende Präsentations-/Antwortvorlagen separat; keine Übernahme von Drucklayout als Zahlenboard. |

## Dunkle Moderationsreferenz und Wiederverwendung

Bestand `app/quiz/[quizId]/moderation/ModerationClient.tsx:994–1068`: Zinc-950-Grundfläche, Zinc-900-Panels, Zinc-800-Rahmen, Zinc-100/300-Texte, kompakter Kopf, Raster `minmax(0,2.4fr) / 360px`, scrollende Bereiche, hervorgehobene Steuerleiste. Die bestehende Quiz-Moderation verwendet noch Cyan. Dies ist eine sichtbare **Bestandsabweichung** vom bestätigten Phil-Gud-Farbziel; ihre spätere Angleichung ist ein separater Auftrag. In diesem Auftrag wird sie nicht umgefärbt.

### Verbindliche Phil-Gud-Farbquelle und Bedeutungen (V3.1)

Zentrale Quelle ist `PHIL_GUD.colors` in `app/branding/philGud.ts`, bestätigt in [Phil-Gud-Spezifikation](../design/phil-gud-management-and-template.md). Keine geschätzten Ersatzfarben oder neue Akzentpalette pro Eventart: Gelb `#F0FC16`, Pink `#F6C4DC`, dunkle Beschriftung `#171717`, helle Schrift `#FAF8F2`, Schwarz `#000000`. Bestehende neutrale Zinc-Flächen dürfen für die dunkle Moderationsstruktur bleiben. `#A32661` bleibt der vorhandene Fokuswert auf hellen Verwaltungsflächen; auf dunklen Moderationsflächen wird ein kontraststarker Pink-Fokus mit dunklem Abstand verwendet.

Wiederkehrende Aktionen haben formatübergreifend gleiche Gestaltung und Bedeutung. Gelb: Hauptaktion und aktuelle Zahl; Pink: Bingo-Ruftasten und bereits gezogene Zahlen; Grau: ungezogene Zahlen/Nebenaktionen. Dunkle Schrift auf Gelb/Pink. Formatunterschiede betreffen Fachinhalte, nicht neue Paletten oder willkürliche Bedienmuster. Administration bleibt hell; auswählbare Publikums-/Drucktemplates, LOVD und andere bestehende Zuweisungen werden nicht überschrieben. Interner Bedienstandard ist kein pauschaler Renderer-/Druck-Farboverride.

Normal, Hover, Fokus, gedrückt und deaktiviert müssen unterscheidbar sein. Deaktivierte Aktionen neutral grau, nicht blass aktive Markenbuttons. Aktuelle Zahl mit kräftiger/doppelter Kontur und zugänglicher Zustandsbezeichnung; bereits gezogen mit zusätzlichem Zeichen/Schriftgewicht; ungezogen neutral. Farbe allein vermittelt keine entscheidende Information. Warnung/Fehler/Erfolg bleiben fachlich benannt und semantisch getrennt; keine pauschale Umfärbung in Markenfarben.

Künftige Review-/Prüfkriterien zu B05/B06/B10/B12: tatsächliche CSS-Farben in allen Zuständen messen; Text mindestens 4,5:1, großer Text 3:1, notwendige Grenzen/Zustandsmarkierungen 3:1; Fokus gegen angrenzende Fläche; keine Blau-/Türkisreste in Fortschritt, Links oder Auswahl. Kontrastschwache Kontur durch bestehendes helles Neutral oder Markenfläche mit dunkler Beschriftung lösen, keine neue Akzentpalette. Normative Grenzen gelten auch im statischen Entwurf; spätere Appumsetzung benötigt eigene Tests.

Konkrete Wiederverwendung bei späterer Umsetzung:

- `components/ui/Button.tsx`, `IconButton` und `components/ui/ConfirmDialog.tsx`: vorhandene Button-/Fokus-/Bestätigungsgrundlagen nach Scope-/Kontrastprüfung; kein Kopieren von Resetbefehlen.
- `ModerationClient`: Anordnungs-/Zinc-/Breakpointmuster; heute kein generischer extrahierter Moderationsshell. Eine gemeinsame Extraktion ist **nicht** Bestandteil dieses Auftrags.
- `components/ModerationToolbar.tsx` innerhalb der Quizmoderation: Gruppierung und beschriftete Icons, nicht Quiz-Props oder Weiter-/Audiofachlogik übernehmen.
- `CurrentSlidePanel`: Rahmen/Größen-/Ladeprinzipien als Referenz; Bingo ersetzt den Inhalt vollständig durch Zahlenarbeitsfläche, ohne eingebettete Präsentation.
- `useContentNavigationGuard`, bestehende validierte Listenrückwege, EventSeriesPicker und getrennte Policyauflösung behalten Zuständigkeiten.
- `app/bingo/live/ModerationPanel.tsx`, `useLivePolling.ts`, Actions, Repository und AP1 behalten Autorisierung, Uhr, Revision und Fachzustand. Die Oberfläche zeigt diese Daten, erfindet keine zweite Wahrheit.

## Formatspezifisch: Bingo-Ziel V3.1

Diese Punkte sind geplant; der aktuelle [AP3-Vertrag](bingo-live.md) bleibt Bestandsbeschreibung.

1. Drei Ruftasten Bingo / Doppel-Bingo / Triple-Bingo bleiben während einer Kartenprüfung erreichbar. Nichtmodaler Prüfbereich in der zentralen Spalte; rechts offene Rufe mit stabiler Ruf-ID, Stufe, Zeitpunkt, Ziehungsgrenze und Status. Kartenkennung erst nach Ruf. Kein Teamkonto nötig und keine erfundenen Teamidentitäten.
2. Ein neuer bewusster Ruf erzeugt eine neue Ruf-ID auch bei gleicher Stufe/Grenze; Doppelklickschutz ist nur UI-Schutz. Technischer Retry verwendet dieselbe Request-ID und denselben Hash. Niemals Rufe nach `(Stufe, Ziehungsgrenze)` deduplizieren. Begonnene Karte/Begründung bleiben beim Erfassen weiterer Rufe erhalten. Bei CAS-Konflikt keinen Ruf automatisch mit neuer Grenze umdeuten; ursprünglichen Kontext und Konflikt sichtbar behalten. Bei veraltetem Ziehungsstand sichtbaren Konflikt melden; Rufzeitpunkt und Grenze niemals still verändern. Eigenständige Rufe aus mehreren Fenstern erhalten eigene Identitäten, technische Wiederholungen nicht doppelt speichern. Kein Browserzeitwert ersetzt die fachliche Serverzeit. Der konkrete Adapter-/CAS-Vertrag ist technische Umsetzung, keine offene Fachentscheidung.
3. Ruf vor Kartenprüfung serverseitig erfassen; historische Grenze bleibt. Mehrere unabhängige Entscheidungen; keine automatische Gewinnbestätigung oder rückwirkende Heilung durch spätere Zahlen. Bestätigungen erhalten, notwendige Nachprüfung markieren.
4. Chronologische Ziehungen auswählen, bisherige/neue Zahl und Grund prüfen, bestätigen. Geplante Erweiterung: beliebige frühere Ziehung **der offenen Runde**, nicht nur letzte wie AP3. AP1 `correctDraw` erhält Draw-ID und Position; unveränderliches Korrekturereignis statt alte Befehle umzuschreiben. Aktuelle Zahl bleibt die letzte Position; bei früherer Korrektur ändert sich nur Board/Zuordnung, nicht die aktuelle Zahl. Historische Rufgrenzen und ursprüngliche Nachweise bleiben. AP1 markiert bestätigte Gewinne, die durch Korrektur nicht mehr gedeckt sind; keine automatische Aberkennung.
5. Rundenende / nächster Start / Zusatzrunde / Eventende sind verschiedene Aktionen. Drei geplante plus vierte Zusatzrunde im selben Event; je Runde bewusste Kartenbindung und leerer Zahlenstand. Nach Eventende nur Zusammenfassung der gespielten Runden/Ergebnisse, kein „Nächste Runde“-Angebot. Mehr-Runden-Persistenz ist eine Erweiterung des Ein-Runden-AP3, kein UI-only-Fix.
6. Offene Prüfung darf weitere Rufe nicht verhindern. Bestätigte Zielregel: weitere Zahlenveröffentlichungen bei offenen Rufen **oder erforderlichen Nachprüfungen** sperren; weitere Rufe bleiben erfassbar. Keine implizite Pause der Laufzeituhr. Hier dokumentiert/statisch gezeigt, noch kein implementierter Serververtrag.

## Bestätigte Fachentscheidungen V3.1 / Implementierungsgrenze

- Keine Korrekturen abgeschlossener Runden. Dies ist keine noch offene Option; geschlossen bleibt lesend.
- Produktdeaktivierung bei laufendem **oder pausiertem** Bingo blockieren. Das ist ein bestätigter Ausbau gegenüber dem heutigen Schalter, nicht bereits serverseitig umgesetzt.
- Eigenständige Rufe mehrerer Fenster getrennt erhalten; technische Wiederholung anhand Request-ID/Hash deduplizieren, nicht nach Rufstufe/Grenze.
- Veralteter Ziehungsstand führt zu sichtbarem Konflikt; Rufzeitpunkt/Grenze niemals still ändern.
- Zahlenveröffentlichung bei offenen Rufen oder nötiger Nachprüfung sperren, weitere Rufe zulassen.

Diese Entscheidungen werden in den späteren Umsetzungspaketen U1 (Produktgate), U3 (Rufkonflikte/Queue), U4 (offene Runde/Korrektur) und U6 (Abschluss) verbindlich geprüft. Offen bleiben technische Umsetzung/Verifikation, nicht diese Fachregeln. Keine serverseitige Implementierung in diesem Dokumentationsauftrag.

## Checkliste für neue Eventarten und spätere Aufträge

- [ ] Bestehende Navigation/Eventkontext integriert, keine zusätzliche Kontextwahrheit?
- [ ] Vorbereitung, Moderation und Präsentation an erwarteten Stellen, nur bei tatsächlicher Verfügbarkeit?
- [ ] Vorhandene Komponenten/Scope-/Fokus-/Designregeln verwendet und konkrete Wiederverwendung benannt?
- [ ] Begriffe, Termin-/Spielstatus, Speichern und Abbrechen stimmen?
- [ ] Moderation für Quiz-Anwender wiedererkennbar; Fachabweichungen erklärt?
- [ ] Rollen, Produkt-/Archivgrenzen und alte Daten-/Laufverträge erhalten?
- [ ] Desktop und Mobil mit gemessenen Größen, Fokus, Touchzielen und tatsächlichen Grenzen geprüft?
- [ ] Vollständiger Abnahmeweg von Anlage bis Ende mit Reload/Konflikt/Verbindung beschrieben?
- [ ] Jede B01–B12-Regel einem betroffenen Review-/Regression-/Browsertest zugeordnet, Bestands- und Zielnachweise getrennt?
- [ ] Neue Eventinstanz nutzt bestehenden Artablauf; keine Sonderoberfläche pro Event?

Dokumentation allein erzwingt keine Einhaltung. Der spätere PR muss pro betroffener Regel Codepfad, Reviewbefund und konkrete Testergebnisse liefern; fehlende Nachweise als Grenzen benennen. In diesem Dokumentationsauftrag wurden keine Tests oder CI geändert.


## V3.1-Implementierungszuordnung

Die Bestands-/Zielaussagen der Tabelle oben beschreiben die vor der Umsetzung
geprüfte Main-Basis `8fa60b68`. Den tatsächlichen neuen Umfang beschreibt
[Bingo-Eventbedienung](bingo-event-operation.md); der gehostete Prüfstand steht in
[PR #147](https://github.com/justphilgud/pubquiz-web/pull/147). Daraus folgt keine
Merge- oder Production-Freigabe.

| Regeln | Verwendeter Code | Konkrete Prüfung |
| --- | --- | --- |
| B01–B04 | `EventRow`, `EventCollection`, `readEvents`, `readBingoStatuses`, bestehende Quiz-/Game-Rückwegpolicies | Gemeinsame Event-Architekturtests, bestehende Navigationstests, Quiz-Lifecycle-Einstiegstest und Browsernavigation |
| B03/B07/B11 | `EventSeriesManager`, `settingsRepository`, `settingsRevision`, `productSafety` | Form-Browsertest einschließlich Logo-Fehler/ID-Erhalt; realer PostgreSQL-CAS-/Start-Deaktivierungs-Race; `event-settings.browser.mjs` |
| B05/B06/B08–B10/B12 | `EventModerationPanel` und sein CSS-Modul; separate bestehende `BingoBoard`-/Publikumsrenderer | V3.1-Browserablauf, gemessene Laptop-/Mobilgrößen, Fokus-/Kontrast-/Touchprüfung; bestehender Board-/Polling-Browsertest |
| B06/B07/B11 | `eventCreation`, `eventRepository`, `eventRun`, AP1 und AP2 | Regeltreue-/Kontexttests; drei Runden und Zusatzrunde in PostgreSQL und Browser; echte Retry-/Rollen-/Konfliktprüfung |
| B11/B12 | alte AP3-Dispatchpfade, eingefrorene Rundendaten und AP2-Druckstände | Bestandslauf und vollständiger alter/neuer Snapshot mit echtem isolierten Dump/Restore |

Quiz-Farben werden weiterhin bewusst separat angeglichen. Gemeinsame Eventzeilen
und Einstiege ersetzen weder seine Moderationslogik noch Publikumsvorlagen.
Physische Smartphone-, Bildschirmtastatur- oder Beamertests werden durch diese
Zuordnung nicht behauptet.

## Korrektur 30.10.2026: bestehende Icon-Einstiege erhalten

Die gemeinsame Eventzeile verwendet die vorherigen Quiz-Iconlinks unverändert in
Bedeutung und Gestaltung: Stift (Vorbereitung), Megafon (Moderation) und Play
(Präsentation). Quiz-Einstellungen behalten das Zahnrad. Moderation/Präsentation
öffnen wie zuvor in einem separaten Tab; vorhandene Rückwege bleiben erhalten.
Bingo übernimmt dieselben Icons. Tooltip und zugänglicher Name benennen Aktion
und Kontext; Klickflächen bleiben mindestens 44×44 CSS-px. Keine Umwandlung in
sichtbare Textbuttons ohne ausdrücklichen Auftrag. Nicht verfügbare Aktionen
werden weiterhin vom vorhandenen Reader ausgeschlossen.
Nachweis: gerenderter Eventzeilentest in `eventOperationArchitecture.test.ts`
und Browsergeometrie in `orderingLayout.browser.test.ts`.
