# Quiz-Kopiervertrag

Stand: AP8, 7. September 2026. Maßgeblich ist `copyQuiz` in `app/quiz/actions.ts`.

## Inhalt und Zuständigkeiten

`QuizCopyDialog` verwaltet Eingaben, native Formularvalidierung, Pending und
Fehlermeldung. „Kopie anlegen“ ist der Submit, Enter nutzt denselben Pfad.
„Abbrechen“ ist ein normaler Button und schließt ohne Server-Aufruf. Eine
synchrone Ref-Sperre verhindert weitere Submits bis zum Fehler oder zur Navigation;
währenddessen sind Eingaben, Abbruch und Escape gesperrt. Erfolg navigiert auf
`/quiz/<neue ID>`. Ein Fehler bleibt im Dialog sichtbar und erlaubt einen neuen
Versuch. Das ist eine lokale Submit-Sperre, kein neuer serverseitiger Idempotenzvertrag.

Die bestehende Server-Action bleibt für Berechtigung, Stammdatenvalidierung und
die Transaktion verantwortlich. Nur Quizadministratoren dürfen kopieren;
archivierte Eventreihen sind ausgeschlossen. Titel und Datum werden neu angegeben.

Übernommen werden Eventreihe, Zeit, Ort, Karten-URL, interne Notiz, gemeinsame
Präsentations-/Antwortformularvorlage, Auflösungsstrategie sowie Intro-/Outro-
Konfiguration. Die öffentliche URL wird geleert, Team-/Teilnehmerzahlen sind null
im fachlichen Sinn (gespeichert als 0), Archivierung ist aufgehoben.

Blöcke werden in ihrer Reihenfolge mit Typ, Dauer, QR-/Medienangaben, Notiz und
Strategie neu angelegt. Fragen bleiben Referenzen auf bestehende Inhaltsfragen;
ihre Quizzuweisungen entstehen über `addQuestionToQuiz` mit bisheriger Reihenfolge,
Punktemodus, Layout, Antwortreihenfolge, Freitextoption und Ergebnisdarstellung.
Dessen bestehende Validierung/Normalisierung gilt auch beim Kopieren. Die Übernahme
verknüpfter Storyelemente bleibt erhalten. Es entsteht keine Kopie der Inhaltsfrage.

Ablaufelemente behalten Typ, Reihenfolge, Sichtbarkeit, Bezeichnung, Konfiguration,
Version, Standardkennzeichen und Storyrevision/-beziehung. Block-, Frage- und
Story-Fragenbezüge werden auf die neuen Zuweisungs-IDs abgebildet. Die Quelle wird
nicht geschrieben. Die bestehende Kopierengine wird durch AP8 nicht erweitert.

## Kein Durchlauf wird kopiert

Es werden keine Teamteilnahmen, Sessions, Antworten, Interaction Runs, Drafts,
Submissions, Bewertungen, Punkte, Countdown-/Medienbefehle oder Lifecyclezustände
der Quelle übernommen. Die Kopie beginnt im normalen frischen Vorbereitungszustand.
Globale Inhalts- und Teamkonten werden nicht dupliziert.

## Absicherung

`QuizCopyDialog.test.ts` prüft Formularrollen, Abbruch, Pending, Mehrfachsubmit,
Fehler/Retry, Eingabeprüfung und Zielnavigation. `quizCopyContract.test.ts` führt
den vorhandenen Action-Rumpf mit kontrollierter Transaktion aus und prüft
Inhaltsreferenzen, Reihenfolge, neue IDs, unveränderte Quelle und ausschließlich
Inhaltstabellen. Reale Preview-Abnahme ergänzt Klick, Enter, Doppelklick,
Abbruch sowie Struktur und leeren Durchlauf eigener Testkopien.
