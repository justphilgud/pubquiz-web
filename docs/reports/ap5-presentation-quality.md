# AP5 – Präsentationsqualität und Renderer

Status: Implementiert und auf Preview bereitgestellt; visuelle und Audio-Abnahme
wartet auf Anmeldung an der neuen Deployment-Adresse.

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
Production-Build bestanden. Der erste Versuch scheiterte ausschließlich am
eingeschränkten Google-Fonts-Netzwerkzugriff; Wiederholung mit Netzwerkfreigabe grün.
Nach den letzten Änderungen: TypeScript, gezielter ESLint und 28 Renderer-Tests grün.
Preview-CI #147 (`34128157855`) und Feature-CI #148 (`34128157936`) erfolgreich.
Deployment #154 (`34128383801`, Job `101762331475`) erfolgreich, inklusive Smoke-Test.
Bestehende CI-Warnung: checkout/setup-node v4 verwenden eine ältere Actions-Runtime;
kein AP5-Fehler und in diesem Auftrag nicht geändert.

## 21–23. Browser und Screenshots

Die Anmeldung im ersten Preview ist bestätigt. Die reale Browsermatrix bei
1280 × 720 deckte schmale Bildspalten, doppelte Story-/Pollabstände und durch
Storybook-Dekoration eingeschränkte Lösungen auf. Diese wurden korrigiert.
Die anschließende lokale Geometrieprüfung verwendet den produktiven Renderer
und die gebauten Styles/Fonts: 19 Fälle × vier Themes × vier Größen = 304
Kombinationen. Reguläre Fälle passen bei 1280 × 720, 1920 × 1080 und 2560 × 1440;
die schmale 900 × 900-Ansicht erhielt zusätzliche einspaltige Anordnungen.
Überlange Legacyfälle bewahren den Volltext mit explizitem Scroll-Fallback.
Finale Preview-Screenshots und der reale B06-Ablauf stehen noch aus.
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
Die Dateiliste folgt nach Preview-Abnahme.

Erster AP5-Runtime-Commit: `36bba85c7108d27604035af6c4ae250c7d13746d`.
Preview: https://pubquiz-cqmu9qsxa-just-phil-gud.vercel.app
Deployment-ID: `dpl_9EPD93ZZ2tLvgXrM3Z431x3Saz3z`.
Die Deployment-Zusammenfassung bestätigt ausdrücklich diesen Runtime-Commit;
die Workflowdefinition selbst stammt wie bisher vom Default-Branch.

`main` am Start: `e76f57dce19f26488cf9db24b881ab06bf004fd6`.
Nur Preview ist als Deploymentziel autorisiert; Production bleibt unberührt.
