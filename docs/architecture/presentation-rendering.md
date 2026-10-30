# Living Specification: Presentation Rendering (AP5)

Stand: 7. September 2026.

## Zweck und Abhängigkeiten

Die bestehenden Layouts sollen vollständige Inhalte mit begrenzter Typografie
darstellen. `PresentationSlideRenderer` bleibt der gemeinsame Renderer für
Präsentation, Moderationsvorschau und Templatevorschau. Storybook verwendet seine
vorhandenen Unterkomponenten. Es gibt keine zweite Präsentationsengine.

Verbindlich bleiben [Runtime-Verträge](quiz-runtime-contracts.md),
[Lifecycle](quiz-lifecycle.md), [Antwortinteraktion](answer-interaction.md),
[Pixel](pixel-question.md), [Bewertung](evaluation-workflow.md),
[Editor](editor-principles.md) und das
[Designmanifest](../design/ungegoogelt-design-manifest.md).

## Ein-/Ausgaben, Zustände und Persistenz

Eingang sind das bestehende Quiz-/Slide-Modell, aufgelöste Theme-Tokens und der
lesende Display-State. Ausgang ist der React-Renderbaum. Inhaltsdichte ist eine
reine Ableitung; Warnungen verändern weder Inhalt noch Speichergültigkeit.
Es gibt keine neuen Tabellen, Serveraktionen, Navigation, Submissions oder Punkte.

`presentationReadability.ts` unterscheidet `regular`, `compact` und `extended`.
Bis 60 % der jeweiligen Empfehlung gilt regular, bis zur Empfehlung compact,
darüber extended. Antwortoptionen einer Frage erhalten dieselbe Größenvariante.

## Fläche und Typografie

Live nutzt die tatsächliche Browserfläche (`h-dvh`, 16 px Außenabstand), kein
erzwungenes Seitenverhältnis. Moderation und Templateeditor skalieren weiterhin
1600 × 900. `cqw` bezieht Schriftgrößen auf den Renderer-Container; `vw` wäre in
einer skalierten Vorschau fälschlich vom umgebenden Editorfenster abhängig.

| Rolle | Minimum | responsive | Maximum |
| --- | --- | --- | --- |
| Frage regular | 32 px | 3,5 cqw | 64 px |
| Frage compact | 32 px | 3 cqw | 56 px |
| Frage extended | 32 px | 2,5 cqw | 48 px |
| Antwort regular | 24 px | 2 cqw | 36 px |
| Antwort compact/extended | 24 px | 1,7 cqw | 32 px |
| Storytitel | 32 px | 3,8 cqw | 68 px |
| Umfrageprompt | 32 px | 3,5 cqw | 64 px |
| Fließtext | 24 px | 1,9 cqw | 32 px |
| Zusatzinformation | 18 px | 1,45 cqw | 26 px |
| Status | 16 px | 1,15 cqw | 22 px |
| Lösung/Ergebnis regular | 32 px | 3,4 cqw | 64 px |
| lange Lösung | 24 px | 2 cqw | 36 px |

Werte gelten bei der üblichen Root-Schrift von 16 px; CSS verwendet rem.
Die verkleinerte Moderationsvorschau skaliert diese logischen Größen als Ganzes.
Die Zeilenhöhe der Kernfrage beträgt 1,18, Antworten 1,25, Fließtext 1,35.
Farben, Fonts, Rahmen, Bildwelten und visuelle Identität stammen aus dem Theme.

## Layout und Priorität

Geschlossene Bildfragen behalten das Medienlayout, zeigen aber im Lesebereich
auch sämtliche Optionen in `antwort_reihenfolge` mit denselben A/B/C-Labels wie
andere Auswahlfragen. Die Bildfläche gibt dafür Breite ab; offene Bildfragen und
spezialisierte Renderzweige behalten ihre bestehende Komposition.

`antworten.zusatzinformation` wird unverändert im autorisierten Präsentationsmodell
bereitgestellt und ausschließlich in der Auflösung an der zugehörigen Antwort
angezeigt. Zeilenumbrüche und Leerraum bleiben erhalten; leere Informationen
erzeugen kein Element. Die öffentliche Teilnehmerprojektion enthält dieses Feld
nicht, auch nicht vor der Auflösung. Keine neuen Speicherfelder oder Datenänderungen.

Kernfrage und Optionen haben Vorrang vor großen Innenabständen und Dekoration.
Choice verwendet die Frage oben und gleichgewichtete Optionen in zwei Spalten,
unter 1000 logischen Pixeln in einer Spalte. Die inhaltsbasierte Mindesthöhe der
Frage verhindert Überlagerungen. Auf Flächen bis 1450 Pixeln nutzt die Auswahlfrage
32 px und reduzierte Kartenabstände. Lange Bildfragen erhalten zwei
gleich breite Spalten; lange Standardlösungen 55 % Frage / 45 % Lösung.
Unter 1450 Pixeln werden Header und Abstände kompakter. Storybook gibt bei
dichterem Inhalt den für dekorative Galerien reservierten Platz frei; eigentliche
Fragenmedien bleiben erhalten.
Medien bleiben proportional (`object-contain`) und erhalten begrenzte Flächen.
Strukturierte Antworten zeigen Feldbeschriftungen sowie vorhandene Medien über
dieselbe Medienkarte wie andere Fragen. Pixelstatus erhält reservierten Platz;
Stufenberechnung, Reveal-Reihenfolge und Deadline bleiben unverändert.

Unter 1000 logischen Pixeln wechseln geteilte Layouts zu einer Spalte. Das ist
eine Anpassung an die Präsentationsfläche, nicht an den äußeren Editorviewport.

## Überlänge und Legacy

Keine Ellipse, Zusammenfassung oder automatische Inhaltsänderung. Beliebig lange
Bestandsinhalte und unbegrenzt viele Legacy-Antworten können mathematisch nicht
gleichzeitig mit einer Mindestschrift auf eine endliche Fläche passen. Deshalb
bleibt der gesamte Inhalt erhalten und im Grenzfall über eine fokussierbare
Scrollfläche erreichbar. Ein expliziter Hinweis zeigt diese Abweichung an.
Für eine Projektion muss der Inhalt dann redaktionell reduziert werden.

`PresentationOverflowRegion` misst einmal beim Inhalts-/Slidewechsel und bei
tatsächlichen Größenänderungen über ResizeObserver; Medien-load kann ebenfalls
eine Messung auslösen, ebenso das Laden der Fonts. Ein Inhaltsfingerabdruck
erfasst auch Änderungen auf derselben Slide, ohne den Anzeige-Timer einzubeziehen.
Keine Messung pro Animationsframe, kein zusätzliches
Polling und keine iterative Schriftanpassung. Der Hinweisplatz bleibt reserviert,
damit sein Einblenden keine sich selbst auslösende Resize-Schleife erzeugt.

## Empfehlungen im Editor

| Inhalt | Empfehlung |
| --- | --- |
| Frage / Umfrageprompt | 220 Zeichen |
| Antwort / Umfrageoption | 120 Zeichen |
| Storytitel | 100 Zeichen |
| Storytext / Beschreibung | 600 Zeichen |
| Erklärung / Bildunterschrift / Rezension | 300 Zeichen |
| Antwortanzahl | 6 |

Warnungen erscheinen beim Bearbeiten, oberhalb der Empfehlung. Bestehende harte
Limits (Frage 300, Antwort 200, Zusatzinfo 500; Live-Poll 2–6 Optionen und 160
Zeichen je Option; typabhängige Storygrenzen) werden nicht verschärft. Keine
Migration und keine neue serverseitige Ablehnung älterer Inhalte.

## Medien und B06

Die Layoutauflösung priorisiert strukturierte Felder bewusst vor AUDIO_FOCUS.
Der Fehler lag im fehlenden Medienaufruf dieses Renderzweigs, einschließlich
Storybook. Die Priorität bleibt erhalten; `renderMedienKarte` rendert nun dessen
Medien. Die bestehende URL-Auflösung und Blob-Architektur bleiben unverändert.
Nur das primäre abspielbare Medium erhält den Befehl; bei geöffnetem Overlay
wechselt dieser an das Overlay. Keine parallele Wiedergabe desselben Mediums.

Audio verwendet `SynchronizedMedia`, preload metadata, keine nativen Großcontrols
und kein autoplay-Attribut. Das UI beschreibt den angeforderten Befehl; eine
abgelehnte Wiedergabe bietet den bestehenden Aktivierungsknopf. Ladefehler werden
sichtbar. Quellenwechsel werden trotz gleicher Befehlsnummer neu berücksichtigt.
Reload, PREPARATION/RUNNING-Wechsel und Reset verlangen die AP1-Aktivierung.
STOPPED und Stopbefehle verwenden unverändert den vorhandenen Lifecycle-Vertrag.

Die Startsequenz verwendet denselben synchronisierten HTML-Audiopfad. Ohne
konfigurierte URL bleibt die versionierte Datei
`/medien/audio/intro/mexico.mp3` der bewusste Fallback. Play-Markierung,
Aktivierungsknopf und Legacy-Kicker beziehen Farbe und Kontrast aus dem gewählten
Theme; Komm.ONE erbt dadurch keine Neon-Pink-Akzente.

## AP2–4: Flächenkontrast und Wahr/Falsch

Text auf `surface` und `surfaceStrong` verwendet abgeleitete Vordergrund-Tokens
mit mindestens 4,5:1 Kontrast. Das gilt insbesondere für Meme-Status,
Meme-Ergebnis und veröffentlichte offene Liveantworten. Ein realer Chrome-Test
misst die berechneten Farben in NEON, EDITORIAL, KOMM_ONE, BIRTHDAY und
CORPORATE; große Statusschrift darf mindestens 3:1 verwenden.

Wahr/Falsch-Optionen sind vor der Auflösung in allen Designwelten neutral. Erst
die Auflösung markiert beide Optionen anhand von `templateData.correctAnswer` als
richtig oder falsch und ergänzt `✓ Richtige Antwort` beziehungsweise
`✕ Falsche Antwort`. Die Logik funktioniert deshalb auch, wenn „Falsch“ korrekt
ist, und verändert weder Eingabe noch Bewertung.

## Invarianten und Tests

| Invariante | Vertrag / Absicherung |
| --- | --- |
| PRES-INV-01 | Gemeinsame Rollen statt ungebundener Einzelgrößen |
| PRES-INV-02 | Drei Dichten, definierte clamp-Minima/-Maxima |
| PRES-INV-03 | Volltext plus sichtbarer Overflow-Fallback |
| PRES-INV-04 | Kurze Fragen überschreiten 64 px nicht |
| PRES-INV-05 | Optionen vollständig im Renderbaum, ohne Ellipse |
| PRES-INV-06 | Medien proportional und begrenzt; Frage priorisiert |
| PRES-INV-07 | Story und Poll verwenden dieselben Lesbarkeitsrollen |
| PRES-INV-08 | Empfehlungen im Frage-, Story- und Polleditor |
| PRES-INV-09 | Strukturierte Medien nutzen bestehende Medienkarte/URL |
| PRES-INV-10 | Keine Umgehung der AP1-Aktivierung |
| PRES-INV-11 | Keine Schreibpfade für Submissions/Bewertungen |
| PRES-INV-12 | Branding aus den bestehenden Theme-Tokens |

`presentationReadability.test.ts` prüft Grenzen, Warnungen, vollständige lange
Inhalte und Audio für vier Designwelten. Bestehende Renderer-/AP1–AP4-Tests gelten
weiter. Geometrie und tatsächliche Wiedergabe benötigen zusätzlich die dokumentierte
Browserabnahme. `/templates/presentation-quality` liefert nach Anmeldung dieselben
internen, rein lesenden Fixtures über den produktiven Renderer; keine Quizdaten.

## AP6: Intro und Teambegrüßung

AP8/AP6-F01: RULES verwendet ebenfalls `--pres-title` und `--pres-body`.
Die Regelliste und ihre Zeilen behalten natürliche Mindesthöhen; weder Liste
noch Folie schneiden Text ab. Vier kurze Regeln passen ohne Scrollbedarf in
1280 × 720, 1920 × 1080 und 2560 × 1440. Überlange Bestandsregeln bleiben
vollständig und nutzen ausschließlich den vorhandenen zugänglichen
`PresentationOverflowRegion`-Scrollbereich samt Hinweis. Themefarben und
Branding bleiben erhalten, ebenso LOVDs Mehrspaltenlayout für mehr als vier
Regeln. Die interne Referenz enthält `rules` und `rules-legacy`; Renderer-Tests
prüfen vier Designwelten, die Browserabnahme ergänzt Geometrie und Scrollbarkeit.

[Intro-/QR-Flow und Teambeitritt](intro-team-join.md) definiert den manuellen QR-Abschluss,
die rein lokale Begrüßungsqueue und die Wiederverwendung vorhandener Snapshots.

## LOVD-Nachtauftrag 2026-10-10: Audio-Phasen

Musik rückwärts und 8-Bit wählen in QUESTION ausschließlich ihren generierten
Slot, in SOLUTION ausschließlich music_original_audio. Die Reihenfolge der
persistierten Medien ist unerheblich. Fehlendes generiertes Audio fällt nicht
auf das Original zurück. Mehrdeutige alte unmarkierte Dateien werden nicht
erraten. Normale Vorlage musik nutzt question_audio in beiden Phasen, optional
music_original_audio in der Auflösung. Vorhandene Medien werden nicht umgeschrieben.
Der Player bleibt verantwortlich für die vorhandenen Moderationsbefehle;
questionPhaseMedia enthält nur die deterministische Auswahl. Ein src-Wechsel
ersetzt den Medienknoten; Cleanup und verspätete Play-Promises pausieren alte Knoten.
Tests: questionPhaseMedia, bestehender audioReverse-Prozessor, synchronizedMedia.browser.


## Template-Verträge (verbindliche Ergänzung, 23. Oktober 2026)

Quelle: Auftrag „zehn Verbesserungen“ vom 23.10.2026, Designmanifest,
[Runtime-Verträge](quiz-runtime-contracts.md), [Antwortinteraktion](answer-interaction.md)
und die dort verlinkten Spezialverträge. Der Registry-Eintrag unter
`app/fragen/editor/templates/questionTemplateRegistry.ts` bestimmt die vorhandenen
Fragetemplates; Aliase sind keine zusätzlichen Templates. Die folgende Matrix ist
Sollverhalten, keine pauschale Erklärung des aktuellen Codes zum fehlerfreien Zustand.

### Gemeinsame Regeln für jede Designwelt und Oberfläche

- Fragephase: vollständiger Fragetext, zugeordnete freigegebene Medien, bei geschlossenen
  Fragen sämtliche Optionen in gespeicherter Quizreihenfolge mit konsistenten Buchstaben.
  Bei Bildfragen bleiben Frage, Bild und Optionen gleichzeitig sichtbar. Keine
  Richtig-Markierung, Lösungstexte, Originalbilder oder Lösungs-Zusatzinformationen.
- Auflösung: kanonische richtige Lösung(en), zugehörige gespeicherte Zusatzinformation
  einschließlich Absätzen. Fehlende Zusatzinformation erzeugt keinen Leerblock.
  Antwortinformationen bleiben ihrer Antwort zugeordnet, auch bei gemischter Reihenfolge.
- Offene Frage: kein leerer Optionskasten und kein bedeutungsloses „keine
  Antwortmöglichkeiten“. Antwortfelder gehören ins Teamformular, nicht als Platzhalter
  auf die Leinwand. Quiz-Override „offen“ hat Vorrang vor gespeicherten Distraktoren.
- Teamformular: ausschließlich freigegebene Inhalte, passende Antwortinteraktion,
  bestätigte eigene Abgabe und vorhandene Sperr-/Countdownzustände; keine kanonischen
  Lösungen vor Freigabe. Moderation darf Lösung und Steuerung sehen; ihre Vorschau
  zeigt den öffentlichen Phasenzustand und startet kein Audio.
- Varianten pro betroffenem Template: kurz/lang, mit/ohne Fragebild, geschlossene
  Bildfrage, mit/ohne Zusatzinformation, Frage/Auflösung, Team/Moderation,
  Containerverkleinerung/-vergrößerung und Vollbild. Kein Ellipsis oder stilles Kürzen.
  Extrem lange Altinhalte bleiben vollständig und dürfen die vorhandene Scroll-/
  Überlaufbehandlung nutzen; beliebige Textmengen passen nicht garantiert auf eine Folie.
- Gestaltung ist in allen bestehenden Designwelten konsistent; Template-Sonderverträge
  (z. B. Kunstwerk, FaceMorph, Pixel, Meme) gehen generischen Layoutannahmen vor.
  Inhalte und gespeicherte Medien werden durch Layoutänderungen nicht verändert.

### Vollständige Fragetemplate-Matrix

„Basis“ bedeutet sämtliche gemeinsamen Regeln oben. Moderation umfasst zusätzlich
immer Navigation, Folienzeit, Vorschau und vorhandene Freigabe-/Auswertungssteuerung.

| Registry-ID | Fragephase | Auflösung | Teamformular / besondere Moderation |
|---|---|---|---|
| `standard` | Basis; offene oder geschlossene Form gemäß Quiz | Richtige klassische/strukturierte Antworten und Zusatzinformation | Text, Felder oder Auswahl gemäß effektiver Form |
| `multiple_choice` | Basis; alle Optionen, neutral | Alle Optionen, richtige markiert, zugeordnete Zusatzinformation | Bestehende Einfach-/Mehrfachauswahl; Regeln unverändert |
| `fakten_jahr` | Hinweise in Reihenfolge, keine Jahreslösung | Jahr, gespeicherte Erklärung/Antwortinformation | Jahres-/Zahleneingabe; keine versteckten Lösungsdaten |
| `fakten_land` | Hinweise, gegebenenfalls konfigurierte Optionen | Gespeichertes Land lesbar, keine erratene Lösung | Länder-/Auswahlinteraktion gemäß Konfiguration |
| `fakten_frei` | Hinweise, offene oder geschlossene Variante | Gespeicherte Textlösung, akzeptierte Varianten nur an zulässiger Stelle | Freitext oder konfigurierte Auswahl |
| `face_morph` | Nur Morph, keine Originale/Namen | Original A, Morph, Original B nebeneinander; kanonische Namen | Strukturierte Namen; Spezialvertrag Runtime und Medienprojektion |
| `musik` | Frage und Audio; keine Metadaten als Lösung | Interpret und Titel aus Antwortfeldern, Zusatzinformation | Bestehende Interpret-/Titelfelder |
| `musik_rueckwaerts` | Verarbeitetes rückwärts abgespieltes Audio | Hinterlegte Musiklösung, vorhandenes Lösungsmedium | Wie Musik; keine Änderung der Audioverarbeitung |
| `eight_bit` | Vorhandenes 8-Bit-Medium | Hinterlegter Songtitel und Interpret | Wie Musik; individuelle Medien erhalten |
| `kunstwerk` | Kunstbild im spezialisierten großen Medienbereich | Gespeicherter Künstler/Titel und Alternativen | Strukturierte Antwort; eigene Typografiegrenzen bleiben |
| `pixelbild` | Live-Stufen, Countdown; Original streng verborgen | Original und gespeicherte Motivlösung | Stoppen/Antwort/Stufen nach [Pixel-Vertrag](pixel-question.md) |
| `wahr_falsch` | Beide Möglichkeiten neutral | Konfigurierter Wahrheitswert und Erklärung | Einfachauswahl; bestehende Reihenfolge erhalten |
| `schaetzfrage` | Frage und Einheit, kein Zielwert | Gespeicherter Wert, Einheit und Erklärung | Numerische Eingabe; bestehende Toleranz-/Bewertungsregel |
| `reihenfolge` | Quizspezifisch gemischte Items | Kanonische gespeicherte Reihenfolge und Erläuterungen | Sortierinteraktion; Draft/Submission und Reihenfolgenvertrag |
| `uebersetzt_vorgelesen` | Übersetzter Vorlesetext/Audio gemäß Sprachschutz | Gespeichertes Original und zulässige Erklärung | Freie Antwort; Moderations-/Vorschauaudio startet nicht automatisch |
| `anagramm` | Generiertes Anagramm; gesuchter Name verborgen | Gespeicherter Name | Bestehende Textantwort |
| `google_rezensionen` | Rezensionen; Autor/Rating gemäß Freigabekonfiguration | Ort und gespeicherte Auflösungsdaten | Text; Quellen-/Attributionspflichten erhalten |
| `umfrage_einfach` | Frage und Optionen | Freigegebenes Ergebnis, keine erfundene richtige Lösung | Einfachabstimmung, vorhandene Publikationssteuerung |
| `umfrage_mehrfach` | Frage und Optionen | Freigegebenes Ergebnis | Mehrfachabstimmung nach bestehender Regel |
| `umfrage_skala` | Frage, Endpunkte und Skala | Freigegebene Verteilung | Konfigurierte Werte/Schrittweite |
| `meme_beschriften` | Erklärung, Bild/Zonen, maßgeblicher Erstellungs-Countdown | Finalisiertes Publikumsergebnis/Gewinner | Verbindliche Meme-Abgabe, Review, Vorstellung, Abstimmung, Abschluss; eigene Beiträge ausgeschlossen, bestehende Stimme ersetzbar |

### Informations- und Laufzeitfolien

Intro/Outro, Rundenintro, Geschichte, Sponsor, Pause/Countdown, QR/Beitritt,
Zwischenstand, Siegerehrung und Jahresrangliste sind Flow-/Präsentationstemplates,
keine zusätzlichen Fragetypen. Ihre Verträge bleiben in diesem Dokument sowie
`quiz-runtime-contracts.md`, `quiz-lifecycle.md`, den bestehenden Ranking-/Sponsor-Spezifikationen im Runtime-Vertrag und den
typisierten Flow-Konfigurationen. Sie erzeugen keine bewertete
Antwort. Team-/Moderationsoberflächen zeigen ihren Freigabestatus, keine versteckten
Folgefragen. Sponsor darf den vorherigen Antwortlauf nicht als aktuelle Frage ausgeben.
Begrüßung und Schluss verwenden individuelle gespeicherte Quizwerte vor alten
materialisierten Standardkopien; eigene zusätzliche Flow-Folien bleiben unabhängig.

### Bewusste Änderungen und offene Grenzen

Der bisherige feste 2rem-Laptopdeckel für Auswahl-Fragetexte entfällt zugunsten der
vorhandenen Container-Typografie; Antworttext wächst auf 1.75–3rem, bei dichten
Antworten 1.5–2.5rem. Die 4rem-Obergrenze des allgemeinen Fragetextes und der separate
Kunstwerkvertrag bleiben. Das aktualisiert die früheren kleineren Antwortwerte bewusst.
Unzugeordnete Fragen sind redaktioneller Vorrat, kein impliziter letzter Liveblock.
120 Sekunden ist nur der neue Meme-Erstellungsstandard, keine Migration gespeicherter
90 Sekunden. Timer-Warnfarben gelten vorläufig für alle Folientypen mit letzter
Warnschwelle 3:00; keine neue Einstellung und kein weiterer Timer.

Nicht entschieden sind eigene Warnschwellen je Template, eine zentrale historische
Zeitstatistik über mehrere Browser und ein neues UX-Konzept für beliebig lange Texte.
Nicht vorhandene/reservierte Interaktionen (z. B. Matching/Buzzer) werden durch diese
Matrix nicht als fertig implementiert erklärt. Zusätzliche Vorlagen oder abweichende
Fachregeln müssen mit Quelle und Tests ergänzt werden.

### Automatische Nachweise und Grenzen

`PresentationSlideRenderer.test.ts`, `presentationReadability.test.ts` und
`presentationContrast.browser.test.ts` prüfen gerenderte Frage-/Auflösungsvarianten
in fünf Designwelten. Bildoptionen, Antwortreihenfolge und Zusatzinformationen werden
in `PresentationSlideRenderer.test.ts` explizit gegen Regression geschützt;
`participantQuestionPayload.test.ts` prüft den echten Server-Serializer gegen
Lösungslecks, `GenericAnswerRenderer.test.ts` die Antwortinteraktionen.
Die bestehenden Pixel-/Meme-/Ordering-/Medien-Browsertests bleiben Teil von `npm test`
und damit der CI. Diese Tests belegen definierte Fälle, keine vollständige visuelle
Fehlerfreiheit aller Inhalt-/Viewportkombinationen. Die interaktive Abnahme wird
separat im Änderungsbericht mit tatsächlich getesteten Ansichten geführt.


## Phil Gud als zusätzliche ausdrückliche Markenwelt (26.10.2026)

`phil-gud` verwendet dieselbe vollständige Template-/Phasenmatrix und denselben Renderer. Optionales validiertes `tokens.typography.displayFamily` trennt echte Markenschrift für kurze Titel von der funktionalen Textschrift. Keine automatische Zuweisung, keine Migration, kein pauschales Styling bisheriger Liveflächen. Bestehende Templates ohne dieses Feld behalten ihren Vertrag. [Spezifikation und Referenz](../design/phil-gud-management-and-template.md).

## Korrektur 30.10.2026: Reihenfolgenauflösung

Der generische Auflösungszweig für ORDERING bekommt einen ausschließlich dort
verwendeten Messrahmen. Kanonische `runtime.solutionLines`, Nummerierung und
Erläuterungen bleiben vollständig und unverändert. Storybook behält seinen
separaten Renderer. Fragephase, Teamformular, Reihenfolgenpersistenz und
Bewertung ändern sich nicht.

Natürliche Zeilenhöhen ersetzen zusammengedrückte Ergebnisfelder. Die begrenzte
Messung wählt Frage oben oder links und eine gemeinsame Antwortschrift von
24–64 logischen CSS-Pixeln anhand tatsächlicher Breite und Höhe. Sie läuft nur
bei Inhalts-, Größen-, Schrift- und Vollbildwechseln; skalierte Vorschauen
verwenden ihre logische Fläche. Header/Abstände werden nur auf dieser Fläche
kompakter. Keine Polling- oder Datenänderung. Überlange Inhalte behalten bei
24 px natürliche Zeilenhöhen und den bestehenden Scrollfallback statt Überlappung.

`ordering-odyssey-solution` bildet die fünf gespeicherten Einträge und vollständigen Erläuterungen der freigegebenen Production-Frage #1410 ab (rein lesend am 30.10.2026 abgeglichen, Quiz Oktober). Schreibweise und Interpunktion bleiben erhalten; keine Produktionsinhalte werden geändert. Die ebenfalls gelesene Entwurfsdublette #1411 ist nicht die Quizzuordnung.
`orderingLayout.browser.test.ts` prüft Volltext/kanonische Reihenfolge,
Textgeometrie, 1280×600 bis 2560×1440, Größenwechsel, skalierte Vorschauen,
Überlängenfallback und Rückwechsel. Die bisherigen Choice-/Renderer-Tests
bleiben unverändert verpflichtend.


Nachprüfung des Korrekturvorschlags: allgemeine spätere Theme-Regeln und Corporate-
`!important`-Höhen hatten den beabsichtigten kompakten Rahmen überschrieben.
Die Geometrie hat deshalb nur innerhalb der Ordering-Auflösung ausdrücklich
Vorrang; Farben, Schriften und Logo-Seitenverhältnis bleiben vom Theme.
Die vorhandene Top-/Side-Messung nutzt eine lösungsbetonte Seitenspalte und
natürliche Zeilenhöhen. Reale Textrechtecke ergänzen die Prüfung der verfügbaren
Breite/Höhe. Der tatsächlich als passend gemessene Schriftwert wird übernommen:
kein nachträglicher pauschaler Abschlag mit neuer Rundungs-/Glyphenabweichung.
Unveränderte Grenzen: Antworten mindestens 24 px, Kernfrage im vorhandenen
Ordering-Messvertrag mindestens 26 px. Keine neue Seitennavigation oder Laufzeitaktion.

Der zusätzliche Storybook-Vergleich ist ausdrücklich menschlich freigegeben:
bei 1280x600, 1280x720 und 1366x768 hat bereits der unveränderte Production-
Renderer bei der kurzen Fixture Scrollbedarf. Der neue Test bestätigt exakt
identische Zeilengeometrie gegenüber Main 1b025a78; bei 1920x1080 und 2560x1440
passt sie. Der separate Storybook-Pfad bleibt unverändert. Dies ist eine bestehende
Grenze außerhalb dieses Fixes, kein erfolgreicher Nachweis eines scrollfreien
Storybook-Layouts. Alle ursprünglichen PR149-Prüfungen bleiben erhalten.
Für die korrigierte generische Auflösung wurden die Überlaufprüfungen zusätzlich
auf null Scrolltoleranz verschärft, damit keine Ein-Pixel-Scrollleiste durchgeht.
