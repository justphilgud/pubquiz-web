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
