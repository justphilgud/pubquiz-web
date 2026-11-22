# Quiz-Ampeln und Vorlesedauer

## Zweck und bestehende Zuständigkeiten

### Korrektur 22.11.2026: Kategoriebezugsmenge

Die Rückfrage zum widersprüchlichen neuen Auftrag wurde ausdrücklich entschieden:
**Grün ≤20 %, Gelb >20–30 %, Rot >30 % bleibt verbindlich.** Die alten 10-/20-%-Grenzen
werden nicht wieder eingeführt. Neu ist ausschließlich der Kategorie-Nenner:
Fragen mit mindestens einer tatsächlichen Kategoriezuordnung **im jeweiligen Block**.
Jede solche Frage zählt einmal im Nenner und einmal je ihrer Kategorien im Zähler;
Mehrfachzuordnungen dürfen zusammen mehr als 100 % ergeben. „Ohne Kategorie“ zeigt
Anzahl und Anteil an allen Blockfragen separat und ist keine erfundene Kategorie.
Ohne zugeordnete Fragen bleibt der Kategorieabschnitt neutral („Keine Kategorien
zugeordnet“). Template-Nenner und -Ampeln bleiben die gesamte Blockfragenzahl.
Beispiel: 1 Filmfrage und 24 unzugeordnete Fragen ergeben Film 100 % von 1, nicht 4 %
von 25. Bei 25 **zugeordneten** Fragen gilt weiterhin 5 grün, 6–7 gelb, ab 8 rot.
Die folgenden älteren Angaben „Blockanteil“ meinen für Kategorien nun diese
zugeordneten Fragen; Anzeige, Status und Suchalternativen teilen denselben Nenner.

Die Quizliste und die Vorbereitung zeigen kompakt den Fragenmix je Fragenblock.
Ein Klick öffnet den vorhandenen `Modal` mit Ringdiagramm, Zählwerten, Regeln und
Empfehlungen. `quizBalance.ts` berechnet rein aus Zuweisungen, Block- und
Kategoriemetadaten. `quizBalance.server.ts` liest nur bereits autorisierte Quiz-IDs
und keine Teamantworten, Bewertungen oder Submissions. Die bestehende Dauerprognose,
Zuordnung, Sortierung, Berechtigung und Laufzeit bleiben in ihren bisherigen Pfaden.
Die Ampel wird nicht persistiert; nur der Quizmodus ist ein dauerhaftes Stammdatum.
Es gibt keine neue Projektabhängigkeit.

## Quizmodus

Neuanlage und Bearbeitung verwenden die vorhandenen Quiz-Stammdatenformulare.
`quiz_modus` speichert `VARIED` (Abwechslungsreiches Quiz, Standard) oder `THEMED`
(Themenquiz). Die additive Migration `20261119150000_add_quiz_mode` ergänzt eine
NOT-NULL-Spalte mit Standard `VARIED`; damit erhalten Bestandsquiz denselben Modus.
Ein Check-Constraint und die Actions verhindern andere Werte. Bei Update ohne
Modusparameter bleibt der gespeicherte Wert erhalten; Kopien übernehmen ihn.
Schnellquiz verwendet den Datenbankstandard. Rechte, Navigation und Laufzeit ändern
sich nicht. Ein bewusster Moduswechsel wird gespeichert und beim Neuladen wirksam.

Im abwechslungsreichen Quiz gelten die unten verbindlich dokumentierten Grenzen. Im
Themenquiz bleiben Sachkategorien mit Anzahl und Blockanteil sichtbar, aber neutral:
keine grüne/gelbe/rote Kategorieampel, kein Einfluss auf Block-/Gesamtstatus und
keine Kategorie-Ausgleichsempfehlung oder daraus abgeleiteter Kategorie-Suchfilter.
Template-Ampeln und Template-Empfehlungen bleiben aktiv.
Der kompakte Einstieg nennt den Modus; Detailansicht und Regeltabelle erklären ihn.

Der Auftraggeber hat überschneidungsfreie Templategruppen bestätigt: Standardfragen
werden nach ihrem effektiven quizbezogenen Antwortmodus aufgeteilt. Multiple Choice
gehört zur geschlossenen Templategruppe; Wahr/Falsch bleibt eine eigene Gruppe.
Andere Spezialtemplates werden nicht zusätzlich als Standard-offen/-geschlossen
gezählt. Eigene Vorlagen folgen ihrem persistierten Basistemplate; Registry-Aliase
werden kanonisch aufgelöst. Unbekannte Vorlagen werden ausdrücklich als unbekannt
ausgewiesen, zählen aber weiterhin zur Blockgröße.

## Verbindliche Regeln

Nenner ist immer die Anzahl zugeordneter Fragen im **jeweiligen Fragenblock**.
Verglichen werden ganzzahlige Zählerprodukte, keine gerundeten Anzeigeprozente.
Eine Frage zählt einmal pro Templategruppe und einmal pro zugeordneter Sachkategorie;
doppelte Kategorie-IDs erhöhen nichts. Kategorieanteile dürfen zusammen über 100 %
liegen. Stories und eigenständige Umfrage-Ablaufelemente sind keine Fragenzuweisungen
und verändern die Fragenzahl nicht. Historische Umfrage-Fragenzuweisungen zählen
zur Fragenzahl, erhalten selbst aber keine Ampel.

| Gruppe | Vollständige Registry-Zuordnung | Rot | Gelb | Grün |
|---|---|---|---|---|
| Offene Fragen | Standard, effektiv offen | <5 % oder >25 % | 5–<10 % oder >20–25 % | 10–20 % |
| Geschlossene Fragen | Standard, effektiv geschlossen; Multiple Choice | <10 % oder >60 % | >50–60 % | 10–50 % |
| Audio-Fragen | Musik rückwärts, normale Musik, 8-Bit-Musik, Übersetzt-vorgelesen | 0 Fragen | — | ≥1 Frage |
| Sachkategorien, abwechslungsreiches Quiz | Bestehende zugeordnete Kategorien, z. B. Politik, Wirtschaft, Kultur, Film, Geografie | >30 % | >20–30 % | ≤20 % |
| Sachkategorien, Themenquiz | Dieselben Kategorien und Anteile; neutrale Anzeige ohne Ausgleichsempfehlung | — | — | — |
| Fakten | Person, Jahr, Land, Freitext | 0 Fragen | — | ≥1 Frage |
| Bild | FaceMorph, Pixelbild, Kunstwerk | 0 Fragen | — | ≥1 Frage |
| Kreativität | Anagramm, Meme beschriften, Google-Rezensionen | 0 Fragen | — | ≥1 Frage |
| Reihenfolge | Sortier-/Reihenfolgefragen | 0 Fragen | — | ≥1 Frage |
| Paare | Paare bilden | 0 Fragen | — | ≥1 Frage |
| Wahr oder Falsch | Wahr oder Falsch | 0 Fragen | — | ≥1 Frage |
| Schätzfrage | Schätzfrage | — | — | — |
| Umfragen | Einfachauswahl, Mehrfachauswahl, Skala | — | — | — |

Die Kategoriegrenzen wurden mit der Ergänzung vom 20.11.2026 ausdrücklich geändert;
sie ersetzen die ursprünglichen Kategoriegrenzen des Auftrags. Templategrenzen
bleiben unverändert. `CATEGORY_BALANCE_LIMITS` liefert die Zahlen für Berechnung
und Regelanzeige. Genau 20 % sind grün, genau 30 % gelb; erst darüber wechselt die
Ampel. Bei 25 Fragen bedeuten 5 grün, 6–7 gelb und ab 8 rot. Nicht vorhandene
Kategorien bleiben ausgeblendet; leere Blöcke haben keine Bezugsgröße.

`BALANCE_TEMPLATE_GROUPS` ist ein exhaustives `Record` aller aktuellen Registry-IDs;
neue IDs erzwingen eine bewusste Ergänzung. Sachkategorien mit null Fragen sind
keine Ampelzeilen. Fehlende oder archivierte Kategorien werden nicht erfunden;
vorhandene zugeordnete archivierte Kategorien bleiben für korrekte Anteile sichtbar,
aber werden nicht als aktive Suchalternative empfohlen.

Mit dem abschließenden Auftrag vom 20.11.2026 ist 10 % bei offenen und geschlossenen
Fragen ausdrücklich inklusive grün. Die oberen Grenzen bleiben unverändert.
Der Auftraggeber hat außerdem ausdrücklich bestätigt: Audio ist bereits ab einer
Frage je Block grün. Die früheren Audio-Prozentgrenzen und die Drei-Audio-Zusatzregel
entfallen vollständig; das interne Modell und die Oberfläche führen sie nicht weiter.
Fakten, Bild, Kreativität, Reihenfolge, Paare und Wahr/Falsch haben kein Gelb.
Es genügt ein Vertreter der jeweiligen Gruppe; nicht jedes der 23 Templates muss
vorkommen. Schätzfragen und Umfragen zeigen ausschließlich „Keine Ampel“.

Leere Blöcke haben keine Prozentbezugsgröße und bleiben neutral, mit erklärtem
Leerzustand. Nicht zugeordnete Fragen werden getrennt genannt und verdünnen keine
Blockanteile. Der kompakte Gesamtstatus ist der schlechteste bewertete Block-/
Zusatzstatus. Unbekannte Vorlagen erhalten keine erfundenen Grenzen.

## Details und Empfehlungen

Ein Ring zeigt die disjunkten Templategruppen mit Legende und Anteil je Block.
Sachkategorien stehen separat mit Anzahl, Blockanteil und Ampel; ein gemeinsamer
Kategorie-Kreis wäre wegen möglicher Mehrfachzuordnungen irreführend. Alle Werte
sind auch als Text/Tabelle verfügbar, Farben sind nicht die einzige Information.
Der vorhandene Dialog stellt Escape, Fokusbegrenzung, Scrollcontainment und
Fokusrückgabe bereit. Die Übersicht bleibt kompakt und behält ihren Zustand.

Zu niedrige Gruppen führen zu einer Suche nach einer passenden Auswahl aus dieser
Gruppe, nicht nach jedem fehlenden Einzeltemplate. Überrepräsentierte Gruppen und
Sachkategorien erhalten Ausgleichshinweise. Für gelb/rot gewichtete Sachkategorien
kann eine aktive wenig vertretene Alternative empfohlen werden, auch ein bislang
nicht verwendetes Thema. Solche Themen sind Empfehlungen, keine Null-Ampelzeilen
und keine Pflicht, alle Kategorien zu verwenden. Bestehen zugleich Gruppen- und
Themenbedarf, enthält derselbe Link beide Filter.
Dabei lösen ausschließlich gelbe/rote Kategorien (über 20 %) Kategorie-Ausgleich
aus; Alternativen stammen aus dem grünen Bereich bis einschließlich 20 % oder
sind bislang unbenutzt. Es gibt keine separate historische 10-%-Schwelle mehr.
Kategorieanzeige, Block-/Gesamtstatus und Empfehlungsbedarf verwenden dieselben
ungerundeten Bewertungen. Im Themenquiz entsteht dieser Kategoriebedarf nie.

Die Links sind echte `/fragen`-Links mit `target="_blank"` und
`rel="noopener noreferrer"`. Sie setzen Frage-Inhaltstyp, Freigabestatus und die
benötigten `template`-/`categoryId`-Werte. Offene Standardempfehlungen setzen zusätzlich
`answerMode=open`, geschlossene Empfehlungen `answerMode=closed`. Ein zusätzlicher Reihenfilter wird nicht aufgezwungen, weil er
global wiederverwendbare Fragen ausschließen würde. Der bestehende Suchzugriff
autorisiert weiterhin jeden Treffer; ein Link ordnet keine Frage zu.

Die aktive Inhaltssuche akzeptiert wiederholte `template`-Parameter (ODER zwischen
Templates) und kombiniert sie mit Kategorie-/Antwortmodusfiltern (UND). Alte
Einzel-Template-URLs bleiben gültig. Mehrfachauswahl verwendet die vorhandene
`TemplateFilterCombobox`; Templatewechsel bleiben sofort anwendbar. URL-Kontext,
Paging-/Stale-Request-Schutz und explizites Anwenden anderer Filter bleiben erhalten.
Workspace-Rückwege erhalten auch den Antwortmodus.

Bewusste Vertragskorrekturen für passende Empfehlungen: Der historische Filter
„Standard“ schließt Multiple Choice und Wahr/Falsch nicht mehr stillschweigend ein.
Multiple Choice und 8-Bit sind nun selbst filterbar, bleiben aber wie zuvor nicht
als eigenständige Editor-Auswahl angeboten. Bestehende Assertions sind gezielt auf
diesen verlangten Suchvertrag aktualisiert; keine Scoring-/Runtime-Regel ändert sich.

## Vorlesedauer

`QuestionSection` zeigt zusätzlich die geschätzte Vorlesedauer des allgemeinen
Fragetextes bei Neuanlage und Bearbeiten. Dieselbe reine Berechnung nutzt den
aktuellen Text bei 1×; keine Änderung, Kürzung, Speicherung oder Generatoraktion.
Die folgende Übersetzungsanzeige bleibt separat erhalten.

Im gemeinsamen Übersetzungseditor erscheint beim Erstellen und Bearbeiten eine
aus `translation` und `speed` abgeleitete Dauer. Annahme: 150 durch Leerraum
getrennte Wörter pro Minute bei 1×. Sekunden = aufgerundet Wörter × 60 / (150 ×
Geschwindigkeit), formatiert als Minuten:Sekunden. Die Annahme ist ein redaktioneller
Richtwert, keine gemessene Aufnahme; Stimme, Sprache und Pausen können abweichen.
Leerer Text zeigt einen Leerhinweis. Text- und Geschwindigkeitsänderungen
aktualisieren die Anzeige unmittelbar und zugänglich über `role=status`.

Der Helfer `readingDuration.ts` verändert weder Original noch Übersetzung, erzeugt
keinen Generatoraufruf, startet keine Audioausgabe und schreibt nichts. Bestehende
Zeichenlimits, Draft-/Speicher- und Freigaberegeln bleiben erhalten. Redaktionelle
Kürzung und Umformulierung bleiben vollständig beim Nutzer.

## Regressionen und Abnahme

- `quizBalance.test.ts`: alle Grenzen und Nachbarbereiche, ungerundete Berechnung,
  Blocknenner, Kategorien, vollständige Registry, Aliase, Präsenzgruppen, Audio-
  Präsenz statt alter Audio-Zusatzregel, fehlende Blöcke und kombinierte Suchlinks.
  Quizmodus: Film-only grün bei ausgeglichenen Templates, neutrale Kategorien,
  weiterhin rote Templatewarnungen, keine Kategorie-Ausgleichsfilter, Rückwechsel.
  Kategoriegrenzen: genau 20/30 %, knapp darüber, 5/6/7/8 von 25, konsistente
  Block-/Gesamtstatus und Empfehlungen, grüne Alternativen bis 20 % sowie
  überlappende Kategorieanteile über 100 % ohne Normalisierung.
- `excel-question-import.integration.test.ts`: echte additive Quizmodus-Migration,
  Altbestands-/Insertstandard, dauerhafter Wechsel, Erhalt bei anderen Updates und
  DB-Constraints gegen ungültige/NULL-Werte.
- `excel-question-import.browser.test.ts`: echte Quiz-Neuanlage und Bearbeitung
  über Next-Actions, Standardauswahl, Themenquiz speichern, Reload und Rückwechsel.
- `readingDuration.test.ts`: Textmenge, Geschwindigkeit, Leerzustand, Format und
  Unverändertheit der Eingaben.
- `quizPlanning.browser.test.ts`: echte Clientkomponenten, dynamische Dauer,
  Original-/Übersetzungserhalt, Modal und Fokusrückgabe, Linkvertrag und Multiselect.
- Bestehende Such-, Kategorie-, Workspace-, Planungs- und Template-Regressionspakete.
- Gemeinsamer Next-Production-Build und gehostete Preview mit ausschließlich
  synthetischen Daten; echte Suchtreffer, neuer Tab, bestehender Quiztab sowie
  Erstellen/Bearbeiten und Desktop-/Mobilgrößen zusätzlich prüfen.

Die historische AP5-Analyse bleibt abgeschlossen und unverändert. Dieser
Auftrag enthält weder Production-Backup noch Production-Deployment; beide folgen
erst nach gemeinsamer Preview-Abnahme in einem separaten autorisierten Schritt.

Die neue AP5-Anwendungsverbesserung ist getrennt in
[Bewertungsworkflow](evaluation-workflow.md#ap5-anwendungsergänzung-20112026) beschrieben.
Sie teilt weder Ampelmodell noch Ampeloberfläche und verändert nicht die historische
AP5-Aggregation. Gemeinsamer Browsernachweis prüft nur beide getrennten Oberflächen.

## Dauer in der Fragensuche (22.11.2026)

Die autorisierte Suchprojektion liefert für Übersetzt-vorgelesen die gleiche
`estimateReadingDuration` wie der Editor: Fragetext bei Normaltempo, Übersetzung
bei ihrer konfigurierten Geschwindigkeit, jeweils ausdrücklich als Schätzung.
Suchzeile und Vorschau verwenden diese Daten ohne Textänderung. Für Übersetzungs-
und Musiktemplates lädt die sichtbare Suchzeile lediglich Audiodatei-Metadaten;
erst eine positive endliche Browserdauer wird als „Dateidauer“ angezeigt. Kein
Autoplay, keine zusätzliche Dauer in der DB und kein erratener Wert bei fehlender
oder nicht lesbarer Datei. Verborgene Treffer laden keine Metadaten. Berechtigung,
Suchfilter, Cursor, Antwortprüfung und Templateauswahl behalten ihre Zuständigkeit.
Tests: `questionDuration.test.ts` und Browserprobe mit zweisekündiger WAV-Datei.
