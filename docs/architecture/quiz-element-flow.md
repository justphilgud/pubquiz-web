# Quiz-Element-Flow

Stand: 28. August 2026

Fragen, Story-Elemente und eigenständige Umfragen sind im Quiz drei sichtbare
Elementarten mit einer gemeinsamen redaktionellen Reihenfolge. Gemeinsam sind
Identität, Blockzuordnung, Sortierposition und Card-Grundstruktur. Ihre
fachlichen Fähigkeiten bleiben getrennt.

| Element | Präsentation | Moderation | Teaminteraktion | Auswertung | Punkte |
| --- | --- | --- | --- | --- | --- |
| Frage | ja | ja | ja | ja | ja |
| Story-Element | ja | ja | nein | nein | nein |
| Umfrage | ja | ja | ja | nein | nein |

## Editor

`QuizEditorElement` ist das gemeinsame diskriminierte View-Model. Die
Capability-Matrix liegt bei der gemeinsamen `QuizEditorElementCard`; sie
beschreibt explizit, welche Aktionen und Laufzeitfähigkeiten eine Elementart
besitzt. Die Card stellt Drag-Handle, Editor-Positionsnummer, Titel, Metadaten,
Konfiguration, Vorschau und optionale Overflow-Aktionen einheitlich dar.

Die Positionsnummer ist ausschließlich ein Editor-`displayIndex`. Sie ändert
weder die fachliche Fragenummer in der Präsentation noch Bewertung oder Punkte.
Die persistierte Reihenfolge verwendet die vorhandenen
`quiz_ablauf_elemente.sortierung`-Werte. `Kein Block` bleibt ein ausgeblendeter
Auffangbereich und der letzte Editor-Abschnitt.

Quizkarten zählen die tatsächlichen Datensätze in `quiz_fragen`, einschließlich
Fragen ohne Block. Story-Elemente, eigenständige Umfragen und Präsentationsphasen
erhöhen diese Zahl nicht. Der Quizeditor zeigt unter „Zusammensetzung“ denselben
Bestand. Jede Frage zählt einmal pro zugeordneter Kategorie und einmal für ihr
Template. Ohne Kategorie erscheint „Ohne Kategorie“, ohne Spezialtemplate
„Standardfrage“. Eigene Vorlagen erscheinen mit ihrem Namen. Die Zahl aller
Zuordnungen dient je Balken als Nenner, deshalb können Kategorien zusammen über
100 % erreichen. Die Anzeige erfindet keine redaktionelle Bewertung.

Das Lesen speichert keine Planungsdaten. Die Anzeige folgt dem serverseitig
bestätigten Stand. Zuordnungs- und Ablaufaktionen aktualisieren Quizeditor und
Quizübersichten. Dauer und Abgrenzung zum Einlass sind im
[Runtime-Vertrag](quiz-runtime-contracts.md) dokumentiert. Prüfnachweise:
`quizPlanning.test.ts`, `presentationTiming.test.ts` und
`scripts/testing/excel-question-import.browser.test.ts`.

## Runtime

`resolveQuizBlockSequence` ist die kanonische Blocksequenz. Es verbindet die
materialisierten `QUESTION`-Slots mit Story- und `LIVE_POLL`-Placements. Der
Presentation-Builder erzeugt daraus Slides; Moderation verwendet dieselbe
Slide-Liste. Die Präsentationsnavigation synchronisiert den bestehenden
Interaction-Run, den wiederum das Team-Antwortformular über den gemeinsamen
Live-Snapshot liest.

Story-Slides werden als `NON_QUESTION` veröffentlicht. Content-Polls verwenden
einen `LIVE_POLL`-Run sowie `live_poll_responses`, aber niemals
`team_antworten`, Quiz-Auswertung oder Punkte. Das Audience-Modell enthält nur
aggregierte Auswahlwerte beziehungsweise freigegebene öffentliche Texte.
Teamidentität und Originaltext bleiben ausschließlich im Moderationsmodell.

## Erweiterung um eine weitere Elementart

Eine weitere Elementart benötigt bewusst Änderungen an diesen zentralen
Stellen:

1. Editor-View-Model und Capability-Matrix;
2. gemeinsame Card-Aktionen und persistierte Blockreihenfolge;
3. `QuizFlowItem`-Read-Model und `resolveQuizBlockSequence`;
4. Presentation-Renderer und Slide-Key;
5. Moderations- und gegebenenfalls Team-Interaction-Contract;
6. gemischte Sequenz-, Audience- und Persistenzregressionen.

Eine neue Elementart rechtfertigt keine zweite allgemeine Flow-, Draft- oder
Submission-Engine.
