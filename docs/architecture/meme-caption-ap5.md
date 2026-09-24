# What the Meme! – AP5 Caption-Renderer und Auto-Fit

Stand: 24. September 2026

## Umfang

AP5 modernisiert ausschließlich die Darstellung und Lesbarkeitsprüfung bereits
vorhandener `MEME_CAPTION`-Antworten. Lifecycle, Auswahl, Moderation, Voting,
Bewertung und Persistenz aus AP1 bis AP4 bleiben unverändert. Es gibt keine
Datenbankmigration und bestehende `{topText,bottomText}`-Payloads werden ohne
Neuspeicherung weiter gerendert.

## Gemeinsamer Aufbau

`MemeRenderer` bleibt die einzige produktive Meme-Darstellung für
Teamvorschau, Moderation, Einzelpräsentation, Übersicht, Voting und Ergebnis.
Er verwendet ein festes 4:3-Raster:

1. optionale obere Caption mit höchstens 21 Prozent Höhe;
2. Bildfläche mit dem gesamten verbleibenden Raum;
3. optionale untere Caption mit höchstens 21 Prozent Höhe.

Leere Caption-Zeilen werden nicht gerendert. Mit zwei Captions bleiben
mindestens 58 Prozent der Rendererhöhe für das Bild, mit einer Caption 79
Prozent und ohne Caption die gesamte Fläche. Das Bild bleibt `object-contain`
und wird weder beschnitten noch durch Text überlagert.

## Auto-Fit

`AutoFitText` misst ausschließlich lokal im Browser. Es startet mit der von
`analyzeMemeCaptionLayout` bestimmten Größe und sucht per achtstufiger binärer
Suche die größte passende Schriftgröße zwischen 7,5 cqw und 4,5 cqw. Auf sehr
kleinen Flächen gilt zusätzlich eine Untergrenze von 12 Pixeln. Ein
`ResizeObserver` wiederholt die Messung bei Größenänderungen; die Schriftmessung
wird nach dem Laden der Fonts einmal aktualisiert. Dabei entstehen keine
Netzwerkrequests.

Für SSR, Tests und serverseitige Finalisierung bildet
`memeCaptionLayout.ts` dieselben festen Grenzen deterministisch ab:

- höchstens drei Zeilen je Caption;
- Mindestgröße 4,5 Prozent der Rendererbreite;
- gewichtete Glyphenbreiten für breite, schmale und normale Zeichen;
- Umbruch von Wörtern sowie sehr langen Einzelwörtern;
- vertikaler Platz der festen Caption-Zeile inklusive Innenabstand.

Die DOM-Messung kann die Größe innerhalb dieser Grenzen noch präziser
anpassen. Unterschreitet der Text selbst bei Mindestgröße die Lesbarkeitsgrenze,
meldet die Vorschau den Warnzustand und sperrt die verbindliche Abgabe.

## Client- und Servervalidierung

Drafts bleiben speicherbar, damit ein Team beim Kürzen keinen eingegebenen Text
verliert. Ein unlesbarer Draft darf jedoch weder ausdrücklich submitted noch
beim Schließen automatisch finalisiert werden:

- `GenericAnswerRenderer` zeigt den konkreten Warntext und meldet den Zustand
  an `QuizAntwortClient`;
- die Abgabeschaltfläche ist gesperrt und `handleSubmit` prüft den Zustand
  nochmals;
- `submitTeamAnswer` wiederholt die deterministische Lesbarkeitsprüfung in der
  gesperrten Servertransaktion;
- `autoFinalizeDrafts` überspringt unlesbare Meme-Drafts.

Die technische Grenze von 80 Zeichen je Feld, die erlaubten Payload-Felder und
die Nichtleerprüfung bleiben bestehen. Historische Submissions werden beim
Lesen nicht nachträglich abgewiesen oder verändert.

## Vorbereitung für AP6

`AutoFitText` kennt nur Text, Position und Fit-Rückmeldung. Textmessung,
Umbruch, Größenregeln und Overflow-Erkennung liegen außerhalb der
oben/unten-spezifischen Rasterentscheidung. AP6 kann diese Bausteine für frei
definierte Caption-Zonen wiederverwenden, ohne einen zweiten Renderer oder eine
zweite Validierungslogik einzuführen.
