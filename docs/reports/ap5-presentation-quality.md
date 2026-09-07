# AP5 – Präsentationsqualität und Renderer

Status: AP5 auf Preview abgenommen. Finale Runtime `4bce410`; visuelle Matrix,
Screenshots und tatsächliche Audiounterbrechung erfolgreich geprüft.

## 1. Ausgangsvertrag und Inventar

Basis AP4 Runtime `2df6283aad3d7bc0a448b110e2436de2248fbff3`, Bericht
`825cae20250e463e5526df3f49ab1e1700e5a490`, isolierter Branch
`codex/ap5-presentation`. Der ursprüngliche lokale Arbeitsstand bleibt unangetastet.

Produktive Fragentemplates: standard, multiple_choice, face_morph,
musik_rueckwaerts, eight_bit, pixelbild, wahr_falsch, schaetzfrage, reihenfolge,
uebersetzt_vorgelesen, anagramm, google_rezensionen, umfrage_einfach,
umfrage_mehrfach und umfrage_skala. Dynamische Templates verwenden die vorhandenen
Contracts und Fallbacks. MATCHING/BUZZER sind keine produktiven Erweiterungen dieses AP.

Story-/Flow-Renderer: TEXT, ANECDOTE, QUOTE, IMAGE, IMAGE_GALLERY,
MEDIA_SEQUENCE, PORTRAIT, AUDIO, VIDEO, CHAPTER_INTRO und CUSTOM_MESSAGE;
zusätzlich Live-Poll-Auswahl/Freitext sowie bestehende feste Intro-/Outro-,
Pausen-, QR- und Ergebnisfolien. Die Reihenfolge bleibt unverändert.
Designwelten: Standard/Neon (einschließlich dunkler Variante), LOVD/Editorial,
Corporate und Storybook/Birthday.

## 2. Ursachen und reale Beispiele

Einzelne Renderzweige nutzen text-3xl bis xl:text-9xl; LOVD überschreibt Fragen
mit bis zu 92 px und 21ch Textbreite, Storybook mit eigenen vw-Größen und 17ch.
Choice erhält teilweise eine schmale Seitenhälfte. Stories kombinieren große
Innenabstände, begrenzte Textbreite und overflow hidden. Die Livefläche folgt
dem Viewport; Editor/Moderation skalieren hingegen 1600 × 900. vw-Schriften in
dieser Vorschau hängen deshalb vom falschen Fenster ab.

Reales eigenes Testmaterial aus AP1: Schumacher-Frage, Anagramm
„US DEPLIH IPIPULG“ und „Welcher Song wurde hier rückwärts abgespielt? Nennt
Interpret und Titel.“ Letztere hat zwei Antwortfelder und ein vorhandenes
Preview-Blob-WAV. Für AP5 wurde Quiz 21 nach Quiz 28 kopiert, ohne dessen
Ergebnisse oder andere Quizdaten zu verändern. Quiz 28 war zur Reproduktion in
Standard/PREPARATION, danach wieder auf Slide 1; keine Teams oder Antworten.

B06 vor Änderung auf Quiz 28, Slide 10: STRUCTURED_RESPONSE enthält Frage,
Interpret und Titel, aber keine Medienkarte / Audioanzeige, obwohl die Moderation
Audio erkennt. [Baseline](assets/ap5/b06-before.png).

## 3–18. Architektur und Regeln

Die vollständigen Größen, Text-/Medienprioritäten, Warnschwellen, Legacystrategie,
Audioaktivierung, Theme-/Preview-Verhältnis und Performance-Regeln stehen in der
[Living Specification](../architecture/presentation-rendering.md).

Keine neuen Abhängigkeiten, keine Datenbankmigration, keine neuen harten Limits.
B06 wird im bestehenden Renderzweig durch die bestehende Medienkarte behoben,
auch in Storybook. Strukturierte Felder behalten ihre Layoutpriorität.

| Nr. | Ergebnis |
| --- | --- |
| 3 | Gemeinsame Rollen für Frage, Antwort, Titel, Fließtext, Zusatzinformation, Status und Ergebnis; drei Längendichten. |
| 4 | Frage 32–64 px, lange Frage bis 48 px; Antworten 24–36 px; Storytitel 32–68 px; Fließtext 24–32 px; Status 16–22 px. Vollständige clamp-Tabelle in der Living Spec. |
| 5 | Begrenzte Lesebreite und Zeilenhöhe 1,18; lange Bildfragen teilen die Fläche gleichmäßig; auf schmalen Flächen Frage vor Medium. |
| 6 | Frage oben, Optionen gleichgewichtet; zwei Spalten, unter 1000 logischen Pixeln eine Spalte. Keine gekürzten Antworten oder unterschiedlichen Schriftgrößen je Option. |
| 7 | Storys und Polls nutzen gemeinsame Rollen und konsistente Abstände; der Pollprompt nutzt die Fragenrolle. |
| 8 | Vorhandene Medienkarte mit proportionalen Bildern und begrenzter Medienhöhe; strukturierte Felder behalten ihren Platz. |
| 9 | Hinweise ab Frage/Prompt 220, Antwort 120, Titel 100, Story 600, Zusatzinfo 300 Zeichen und über sechs Antworten. Hinweise in Frage-, Antwort-, Spezialtemplate-, Story- und Polleditor. |
| 10 | Vorhandene harte Limits unverändert; keine zusätzliche Speicherablehnung. Die Hinweise empfehlen redaktionelle Kürzung, ohne sie automatisch vorzunehmen. |
| 11 | Legacy-Volltext bleibt erhalten; bewusste Grenzfälle sind vollständig per sichtbarem, tastaturbedienbarem Scrollbereich erreichbar. |
| 12 | B06: STRUCTURED_RESPONSE hatte wegen seiner Feldpriorität keinen Aufruf des vorhandenen Medienrenderers. |
| 13 | Medienaufruf im strukturierten Zweig ergänzt, auch für Storybook; bestehende URL-/Blob-Auflösung und SynchronizedMedia wiederverwendet. |
| 14 | AP1-Aktivierung bleibt Voraussetzung. Medienfehler sichtbar; Play-Label beschreibt einen angeforderten Befehl, nicht ungeprüft einen hörbaren Erfolg. |
| 15 | Standard, LOVD, Corporate und Storybook behalten Farben, Fonts und Identität. Bei dichterem Storybook-Inhalt weicht die dekorative Galerie. |
| 16 | Editor/Moderation behalten die feste logische 1600 × 900-Fläche; Live-Präsentation folgt dem realen Viewport. cqw misst die Präsentationsfläche. |
| 17 | Drei Dichten statt iterativem Font-Fitting. ResizeObserver, Inhaltswechsel, Medien-/Fontload lösen begrenzte Messungen aus; keine Animationsframe-Messung oder neues Polling. |
| 18 | Neue Living Spec mit PRES-INV-01 bis PRES-INV-12; keine Änderung der AP1–AP4-Geschäftsregeln. |

## 19–20. Automatisierte Prüfung

11 neue Tests mit 19 Inhaltsfällen × vier Designwelten sowie Audio-/Warnprüfungen.
Erste vollständige Suite: 1059 Tests bestanden (391 + 508 + 11 + 149).
TypeScript, repositoryweiter ESLint und Prisma-Validierung bestanden.
Production-Build bestanden. Der erste Versuch scheiterte ausschließlich am
eingeschränkten Google-Fonts-Netzwerkzugriff; Wiederholung mit Netzwerkfreigabe grün.
Nach den letzten Änderungen: TypeScript, gezielter ESLint und 28 Renderer-Tests grün.
Preview-CI #147 (`34128157855`) und Feature-CI #148 (`34128157936`) erfolgreich.
Deployment #154 (`34128383801`, Job `101762331475`) erfolgreich, inklusive Smoke-Test.
Bestehende CI-Warnung: checkout/setup-node v4 verwenden eine ältere Actions-Runtime;
kein AP5-Fehler und in diesem Auftrag nicht geändert.

Nach den Browserkorrekturen erneut: 1059 Tests, TypeScript, repositoryweiter
ESLint, Prisma-Validierung und Production-Build erfolgreich. Abschließender
ESLint der zuletzt berührten TypeScript-Dateien ebenfalls erfolgreich.
Finale Feature-CI #149 (`34130271929`) und Preview-CI #150 (`34130271937`) grün.
Deployment #156 (`34130445043`, Job `101769022936`) einschließlich Smoke-Test grün.

Nach der Auswahlkorrektur erneut 1059 Tests, TypeScript, repositoryweiter ESLint,
Prisma und Production-Build grün. Feature-CI #151 (`34131638085`), Preview-CI #152
(`34131638208`) und Deployment #157 (`34131809583`, Job `101773442047`) inklusive
Smoke-Test erfolgreich. Die letzte Runtime ist `4bce410`.

## 21–23. Browser und Screenshots

Die Anmeldung im ersten Preview ist bestätigt. Die reale Browsermatrix bei
1280 × 720 deckte schmale Bildspalten, doppelte Story-/Pollabstände und durch
Storybook-Dekoration eingeschränkte Lösungen auf. Diese wurden korrigiert.
Die anschließende lokale Geometrieprüfung verwendet den produktiven Renderer
und die gebauten Styles/Fonts: 19 Fälle × vier Themes × vier Größen = 304
Kombinationen. Reguläre Fälle passen bei 1280 × 720, 1920 × 1080 und 2560 × 1440;
die schmale 900 × 900-Ansicht erhielt zusätzliche einspaltige Anordnungen.
Überlange Legacyfälle bewahren den Volltext mit explizitem Scroll-Fallback.
Die reale Preview-Matrix auf `12b4abc` ergab in allen 304 Kombinationen keinen
Überlauf regulärer Inhalte. Die anschließende Screenshotprüfung fand trotzdem
eine Überlagerung zwischen Frage und Antworten in LOVD. Ursache: min-height:0
ließ die erste Gridzeile unter die Textgröße schrumpfen. `4bce410` reserviert
die natürliche Mindesthöhe und reduziert ausschließlich bei kompakten
Auswahlfolien Fragegröße (32 px) und Abstände. 96 lokale Auswahlkombinationen
(sechs Fälle × vier Themes × vier Größen) sind ohne Überlauf und mit positivem
Abstand zwischen Frage und Antwortliste geprüft. Das ist ausdrücklich ein
zusätzlicher Überlagerungstest; Scrollmaße allein genügen nicht.
Legacy wurde real per End-Taste bis scrollTop 253 von maximal 254 px bedient;
Hinweis sichtbar und Region fokussierbar. Moderation real mit 1600 × 900 bestätigt.
Die Fixtureseite `/templates/presentation-quality` verwendet den produktiven
Renderer und dieselbe Liveflächenregel; sie speichert keine Inhalte.
Audio wird zusätzlich im eigenen Quiz 28 mit regulärem Lifecycle geprüft.

### Audioablauf im ersten AP5-Preview (`36bba85`)

Eigenes Quiz 28, keine Teams/Antworten. PREPARATION → Vorschau aktivieren →
Quiz starten → RUNNING verlangt erneute Fensteraktivierung → reguläre Navigation
zu Slide 10. Das vorhandene Blob-WAV lädt mit readyState 4 und 20,397732 s Dauer.
Play aus der Moderation: paused=false, currentTime=6,435342 s, muted=false.
Zurück zu Slide 9 entfernt das Audioelement; Rückkehr zu Slide 10 bleibt bei
paused=true/currentTime=0. Nach Reload erscheint die AP1-Aktivierung erneut.
Erneute Aktivierung erlaubt Play (currentTime=11,20998 s); Reload während dieses
Befehls bleibt paused=true/currentTime=0. Kein Autoplay-Bypass verwendet.
Das belegt tatsächliche Browserwiedergabe; eine akustische Raumabnahme wurde
nicht behauptet.

### Audio und STOPPED auf `12b4abc`

Nach erneuter regulärer Aktivierung spielte das Live-Audio mit readyState 4,
paused=false und currentTime=13,305041 s. Pause war ebenfalls beobachtet
(paused=true bei 0,111908 s). Eigenes Quiz 28 wurde über „Quiz beenden“ und den
Bestätigungsdialog beendet. Die erste Messung danach lag am natürlichen Dateiende
(20,397732 s, paused=true); sie belegt deshalb nicht separat eine vorzeitige
Unterbrechung. STOPPED zeigt „Quiz beendet“, nach Reload paused=true/time=0,
ohne Aktivierungsknopf. Keine Teams/Antworten/Bewertungen gelöscht, kein Reset.
Die nachfolgende Änderung `4bce410` betrifft nur CSS des Auswahl-Layouts.
Für den eindeutigen Unterbrechungsnachweis hat der Nutzer den Reset des leeren
eigenen Durchlaufs 28 ausdrücklich freigegeben. Dieser Reset ist ausgeführt;
der erneute Test ist am letzten Preview erfolgreich abgeschlossen (siehe unten).

### Bildnachweise

Im Verzeichnis `assets/ap5/`: kurze und lange Standardfrage, LOVD-Story und -Poll,
Bildfrage, strukturierte Corporate-Audiofrage, Storybook-Lösung und -Ordering,
Legacy-Scrollzustand sowie B06-Wiedergabe und STOPPED. Die fehlgeschlagene
Auswahlfolie ist als `choices-overlap-before.png` getrennt dokumentiert;
die korrigierte Aufnahme wurde bei der Deploymentabnahme ergänzt.
Die korrigierte Aufnahme liegt jetzt als `choices-lovd.png` vor. Alle regulären
Referenzscreenshots wurden am finalen Preview `4bce410` erneuert.

### Finale Abnahme auf `4bce410`

304 reale Preview-Kombinationen (19 Inhalte × vier Themes × vier Größen),
keine unerwarteten horizontalen/vertikalen Überläufe regulärer Inhalte und
keine negativen Abstände zwischen Auswahlfrage und Antwortliste. Vollständige
Messwerte: [preview-matrix.json](assets/ap5/preview-matrix.json).
Die absichtlich extremen Legacytexte verwenden den geprüften Scroll-Fallback.

Nach freigegebenem Reset: PREPARATION → Vorschau aktivieren → Quiz starten →
erneute AP1-Aktivierung → Slide 10 → WAV geladen (readyState 4) → Play.
Unmittelbar vor Beenden: paused=false bei 9,938735 s. Nach bestätigtem
„Quiz beenden“: paused=true bei 11,63616 von 20,397732 s. Eine spätere Messung
blieb exakt bei 11,63616 s. Damit ist die tatsächliche vorzeitige Unterbrechung
belegt. Reload zeigt weiterhin „Quiz beendet“ und paused=true/time=0.
[Messwerte](assets/ap5/audio-stop.json). Quiz 28 bleibt STOPPED, ohne Teams/Antworten.

| Screenshot | Nachweis |
| --- | --- |
| [Kurze Standardfrage](assets/ap5/short-standard.png) | Begrenzte Maximalgröße |
| [Lange Standardfrage](assets/ap5/long-standard.png) | Vollständiger Text, Mindestgröße |
| [Lange LOVD-Antworten](assets/ap5/choices-lovd.png) | Kein Überlappen, vier vollständige Optionen |
| [LOVD-Story](assets/ap5/story-lovd.png) | Lesbarer Fließtext |
| [LOVD-Poll](assets/ap5/poll-lovd.png) | Vollständige Labels und Ergebnisbalken |
| [Bildfrage](assets/ap5/image-standard.png) | Ausgewogene Text-/Bildfläche |
| [Strukturiertes Audio](assets/ap5/structured-corporate.png) | Medienkarte und Antwortfelder |
| [Storybook-Lösung](assets/ap5/solution-storybook.png) | Lange Frage und Lösung |
| [Storybook-Ordering](assets/ap5/ordering-storybook.png) | Spezialtemplate |
| [Legacy](assets/ap5/legacy-lovd.png) | Expliziter Scroll-Fallback (Zwischenstand, unverändert) |
| [B06 Play](assets/ap5/b06-playing.png) | Tatsächlicher eigener Live-Durchlauf |
| [B06 STOPPED](assets/ap5/b06-stopped.png) | Gesperrte, stumme Präsentation nach Beenden |

## 24. Abgrenzung / Findings

B05 bestätigt: Im bestehenden Kopierdialog fehlt dem Knopf „Kopie anlegen“ ein
Handler; „Abbrechen“ ist submit. Die Kopie wurde über Formular-Enter angelegt.
Dieser separate bekannte Fehler wird nicht in AP5 geändert.

Allgemeine Fragen/Ordering haben keine einheitliche maximale Antwortanzahl;
First-Class-Live-Polls erlauben 2–6, Skalen maximal elf Werte. Ein universelles
Versprechen, beliebig viele beliebig lange Antworten gleichzeitig raumlesbar zu
zeigen, wäre unzutreffend. AP5 bewahrt Volltext und macht Grenzfälle sichtbar.

## 25–30. Dateien, Migration, Commits und Deployment

Geänderte Verantwortlichkeiten: Renderer und Storybook-Medienintegration,
DesignStage/Overflowregion, zentrale Lesbarkeitsregeln/CSS, bestehende Editorfelder,
gemeinsame Fixtures/Tests, interne Referenzseite, Testscript und Dokumentation.
Dateien:

- `app/fragen/editor/components/{QuestionSection,AnswerCard,AnswersSection,StructuredTemplateEditor}.tsx`
- `app/story-elemente/StoryElementEditor.tsx`, `app/umfragen/LivePollEditor.tsx`
- `app/globals.css`
- `app/rendering/presentation/{PresentationContentWarning,PresentationDesignSystem,PresentationOverflowRegion,PresentationSlideRenderer,PresentationStorybookQuestionTypes}.tsx`
- `app/rendering/presentation/{presentationReadability.ts,presentationReadability.css,presentationReadability.test.ts,presentationQualityFixtures.ts}`
- `app/templates/presentation-quality/{page,PresentationQualityPreview}.tsx`
- `docs/architecture/presentation-rendering.md`, dieser Bericht und `docs/reports/assets/ap5/`
- `package.json` (Testscript; keine neue Dependency)

Erster AP5-Runtime-Commit: `36bba85c7108d27604035af6c4ae250c7d13746d`.
Zwischenstand: `12b4abc1c5b84d7db79f1276bb14deae6b808c13`.
Finaler Runtime-Commit: `4bce410a822ec249a8b4c71011b5c8668e6823cc`.
Preview: https://pubquiz-46zl77j4i-just-phil-gud.vercel.app
Deployment-ID: `dpl_DKcfst1nj1uUfWMV1eCKLJf97ChJ`.
Die Deployment-Zusammenfassung bestätigt ausdrücklich diesen Runtime-Commit;
die Workflowdefinition selbst stammt wie bisher vom Default-Branch.

`main` am Start und nach Veröffentlichung unverändert:
`e76f57dce19f26488cf9db24b881ab06bf004fd6`. Nur Preview deployt;
Production-Workflows wurden übersprungen. Keine Änderungen an Produktionsdaten.
Keine offenen AP5-Blocker; B05 und die bestehende Actions-Runtimewarnung bleiben
außerhalb dieses Auftrags. Keine neue Dependency, Schemaänderung oder Migration.
