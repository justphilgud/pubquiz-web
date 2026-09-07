# AP5 – Präsentationsqualität und Renderer

Status: Implementierung und lokale Prüfung; Preview-Abnahme noch ausstehend.

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
Ergebnisse oder andere Quizdaten zu verändern. Quiz 28 ist Standard, PREPARATION,
nach der Reproduktion wieder Slide 1; keine Teams oder Antworten.

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

## 19–20. Automatisierte Prüfung

11 neue Tests mit 19 Inhaltsfällen × vier Designwelten sowie Audio-/Warnprüfungen.
Erste vollständige Suite: 1059 Tests bestanden (391 + 508 + 11 + 149).
TypeScript, repositoryweiter ESLint und Prisma-Validierung bestanden.
Production-Build, CI und finaler Stand werden nach Abschluss ergänzt.

## 21–23. Browser und Screenshots

Die reale Preview-Abnahme einschließlich B06 steht noch aus.
Die Fixtureseite `/templates/presentation-quality` verwendet den produktiven
Renderer und dieselbe Liveflächenregel; sie speichert keine Inhalte.
Audio wird zusätzlich im eigenen Quiz 28 mit regulärem Lifecycle geprüft.

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
Dateiliste und finale Commit-/Deployment-Referenzen folgen nach Preview-Abnahme.

`main` am Start: `e76f57dce19f26488cf9db24b881ab06bf004fd6`.
Nur Preview ist als Deploymentziel autorisiert; Production bleibt unberührt.
