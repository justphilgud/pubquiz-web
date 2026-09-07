# AP7 – Mobile redaktionelle Bedienbarkeit

Abnahmebericht, 7. September 2026. AP7 ist auf Preview implementiert und im
realen Browser mit den unten beschriebenen Geräte-/Automationsgrenzen abgenommen.

Finaler Runtime: `24efb4dc0b40ec3c0a5f6f2d1c38df7f8b8898f9`.
[Finales Preview](https://pubquiz-3h0b87uu0-just-phil-gud.vercel.app).

## Ergebnis entsprechend den 27 Berichtspunkten

| Nr. | Gegenstand | Ergebnis |
| --- | --- | --- |
| 1 | Mobiler IST-Zustand | Drei gestapelte 48-px-Buttons plus dauerhafte Spezialvorlagenoption belegten bei 390×440 rund 274 px. |
| 2 | Ursache | Gemeinsamer Footer verwendete unter 640 px dieselbe volle Aktionsmenge in vertikaler Anordnung. |
| 3 | Aktionshierarchie | Primäre erlaubte Workflow-Aktion plus „Weitere Aktionen“; reguläre Leiste jetzt 61 px. |
| 4 | Abbrechen | Im sekundären Bereich zuletzt, unterstrichen und weniger dominant, weiterhin erreichbar. |
| 5 | Spezialtemplate | Genau eine bestehende Konfigurationsinstanz im sekundären Bereich. Dialog vollständig innerhalb der sichtbaren Höhe; kein Template im Test angelegt. |
| 6 | Keyboard/Viewport | Gemeinsamer ereignisbasierter VisualViewport-Observer, CSS-Variablen und dvh, Fallback ohne VisualViewport. Keine Geräteheuristik. |
| 7 | Scroll/Safe-Area | Hauptscrollbereich bleibt die Seite; Safe-Area-Padding und Scroll-Margins. Nur bewusst geöffnete Sekundärbereiche/Dialoginhalte scrollen separat. |
| 8 | Frageneditor | Neue/bestehende Frage 97, zwei Antworten, Warnungen, Negativtest, Entwurf, Freigabe und erneute Desktopbearbeitung mit persistierter zweiter Antwort. Pixel, Ordering, Übersetzung und Rezensionen zusätzlich mobil geprüft. |
| 9 | Story | Eigene Story 5: langer Text, Warnung, Scope, Medienfelder, Desktop-/Mobilspeicherung, leerer Titel und Korrektur. Finale Revision 6, null Verwendungen. |
| 10 | Umfrage | Eigener Poll 3: sechs Optionen, Entfernen/Hinzufügen, Warnung, letzter Input, Draft/Reload, Desktop, Freitext-Wall mit Moderationsmodus, leerer Prompt/Korrektur. Finale Revision 4 als Freitextentwurf, null Platzierungen. |
| 11 | AP5-Warnungen | Schwellen und harte Grenzen unverändert. Mobil native aufklappbare Hinweise, Desktop vollständiger Text. |
| 12 | Rollen/Review | Keine Änderungen an Fähigkeiten oder Serveraktionen. Drei Rollenprojektionen automatisiert; reale Eventmanager-Freigabe ausschließlich der eigenen Frage nach ausdrücklicher Nutzerfreigabe. Andere Rollen nicht mit separaten Konten im Browser angemeldet. |
| 13 | Desktop | 1440×900: Reihenfolge, x/y-Positionen, Breiten und 48-px-Höhen der Fragenbuttons identisch zum Vorher-Nachweis. Fragen-, Story- und Poll-Speicherwege erfolgreich. |
| 14 | Accessibility/Touch | Mobile Aktionen/Optionsmenü mindestens 44 px, Poll-Hinzufügen jetzt 44 px. aria-expanded/controls, Pending/Disabled und sichtbarer 2-px-Tastaturfokus geprüft. Bestehender Skalen-Labelbefund separat dokumentiert. |
| 15 | Performance/B10a | Keine neuen Requests, Server-Actions, Timer, Poller oder Frame-Messschleifen. Listener-Cleanup und B10a-Regression grün. Keine neue Laststudie erforderlich oder behauptet. |
| 16 | Living Spec | `mobile-editor-ux.md` und Verweis im Architekturindex. |
| 17 | Neue Tests | Neun AP7-Fälle zu gemeinsamer Projektion, Rollen, Pending, Warnung, Viewport/Fallback/Cleanup und Architektur. |
| 18 | Qualität | 1.087 Tests, TypeScript, repositoryweiter ESLint, Prisma, Production-Build, finale CI, Preview-Deployment und HTTP-Smoke grün. |
| 19 | Mobile Browserabnahme | 360/390/430 px, reduzierte sichtbare Höhe, aktive Text-/Antwort-/Lösungs-/Medien-/Optionsfelder. Reale OS-Tastatur nicht darstellbar; keine Android-/iOS-Hardwareabnahme behauptet. |
| 20 | Nachweise | Vorher/Nachher, sekundäre Aktionen, Dialog, Story, Poll, Templates, Desktop/Tablet/Querformat und gespeicherte Geometrie. |
| 21 | Backlog | AP7-F01: Trennung zwischen Live-Poll-Typen und Frage-Polltemplates. AP7-F02: bestehendes gemeinsames Label für zwei Skalenrandfelder. Ausgeschlossene Themen unverändert. |
| 22 | Dateien | Vollständige Runtime-Dateiliste unten, dazu Spec/Index/Bericht/Nachweise. |
| 23 | Schema | Keine Schemaänderung, Migration oder neue Abhängigkeit. |
| 24 | Commits | `e17f180` Implementierung, `24efb4d` Dialog-/Touchkorrektur aus der Browserabnahme; Dokumentation separat auf Feature-Branch. |
| 25 | Finaler Preview-Commit | `24efb4dc0b40ec3c0a5f6f2d1c38df7f8b8898f9`. |
| 26 | Preview-URL | https://pubquiz-3h0b87uu0-just-phil-gud.vercel.app, Deployment `dpl_AyvzPWGKKWwZdK5ag2xiwKbZakRH`. |
| 27 | Main/Production | Main unverändert auf `e76f57dce19f26488cf9db24b881ab06bf004fd6`; alle AP7-Production-Deployments übersprungen. Ausschließlich Preview und eigene Testinhalte verändert. |

## Ausgangslage und Architektur

Die gemeinsame `ContentEditorActionBar` zeigte unter 640 px drei volle Buttons
untereinander, darüber dauerhaft die Spezialvorlagenoption. Im eigenen
Vorher-Nachweis bei 390×440 px lagen die Buttons bei y=268/324/380 mit jeweils
48 px Höhe. Der gesamte Speicherbereich belegte rund 274 px der verbleibenden
Höhe. Desktop bei 1440×900: drei Buttons nebeneinander, y=840, Höhe 48 px.

AP7 erweitert diese gemeinsame Komponente. Die drei Editoren behalten sämtliche
fachlichen Callbacks, Berechtigungen und Speicherzustände. Die Leiste übernimmt
nur responsive Anordnung, sekundäre Optionen und den sichtbaren Viewport.
Die Spezialvorlagenoption bleibt eine einzige zustandsbehaftete Instanz.

Die primäre Aktion bleibt sichtbar; Entwurf, Spezialvorlage und Abbrechen sind
unter „Weitere Aktionen“ erreichbar. Abbrechen steht weniger dominant am Ende.
Ab 640 px gilt die bisherige Desktop-Reihenfolge. AP5-Warntexte werden mobil
aufklappbar, ohne geänderte Schwellen oder Inhaltsgrenzen.

`contentEditorViewport.ts` berechnet den unteren Versatz aus Layout-Höhe,
VisualViewport-Höhe und oberem Versatz. Ereignisbasierte Listener mit Cleanup,
keine Poller oder Requests. `dvh`, Safe-Area-Padding und Scroll-Abstand ergänzen
das native Fokus- und Scrollverhalten. Der Spezialvorlagen-Dialog erhält eine
auf den sichtbaren Bereich begrenzte mobile Höhe.

## Qualitätsprüfungen

- Vollständiges `npm test`: 1.087 Tests grün (392 + 508 + 11 + 176).
- Neun neue AP7-Regressionen: gemeinsame Aktionen/Template-Instanz,
  Draft-/Editor-/Reviewer-Projektion, Pending-Disabled, AP5-Warnung,
  Viewport-Geometrie, Listener-Cleanup/Fallback und gemeinsame Integration.
- `npm run typecheck`: grün.
- `npm run lint`: repositoryweit grün. Ein neuer Test-Lintfehler wurde vor
  Veröffentlichung durch reguläres JSX korrigiert; keine Regeln abgeschwächt.
- `npm run db:validate`: grün mit ausschließlich lokalem Validierungs-URL.
- `npm run build`: Production-Build grün.
- Keine neuen Abhängigkeiten, keine Schemaänderung und keine Migration.

## Abnahmegrenzen und bestehende Findings

Der vom Nutzer genannte ursprüngliche Screenshot `/mnt/data/137201.png` ist in
dieser Windows-Umgebung nicht erreichbar. Der eigene Vorher-Nachweis wurde auf
dem unveränderten AP6-Preview erstellt.

Die Browserautomation stellt keine echte Android-/iOS-Systemtastatur dar.
Reduzierte Viewport-Höhen und sichtbare Feld-/Leistengeometrie dienen der
ergänzenden Abnahme gemäß AP7 §20; echte Android-Chrome-/iOS-Safari-Hardwaretests
werden dadurch nicht behauptet.

AP7-F01 (bestehende Funktionsabweichung zum Auftrag): Der redaktionelle
Live-Poll-Editor bietet ausschließlich „Auswahl“ (`SINGLE_CHOICE`) und
„Freitext-Wall“ (`FREE_TEXT`). Multi/Scale existieren hier nicht als editierbare
Live-Poll-Typen. Neue Typen wären fachliche Erweiterungen und wurden nicht
eingeführt. Multi und Scale wurden ergänzend als vorhandene Spezialtemplates
im Frageneditor geprüft: drittes Multi-Antwortfeld und rechte Skalenbeschriftung
waren bei 390×440 px erreichbar.

AP7-F02 (bestehend, Accessibility): Im Skalentemplate umschließt ein gemeinsames
Label beide Randtext-Inputs (`StructuredTemplateEditor.tsx`, Zeile 594). Im
Browser erhält das erste Feld dadurch beide Beschriftungen, das zweite keinen
eigenen zugänglichen Namen. Reproduktion: Spezialfrage „Umfrage: Skala“ öffnen
und Accessibility-Baum lesen. Beide Felder sind visuell bedienbar. Dieselbe
Struktur ist bereits in der AP6-Basis vorhanden; sie wurde nicht verändert.

B05, B10b, AP6-F01 und alle weiteren ausdrücklich ausgeschlossenen Themen
bleiben unverändert.

## Nachweise

- [Frageneditor vorher, 390×440](assets/ap7/question-before-390x440.png)
- [Desktop vorher, 1440×900](assets/ap7/question-before-desktop.png)
- [Frage mobil auf finalem Preview](assets/ap7/question-mobile-final.png)
- [Sekundäre Aktionen](assets/ap7/question-secondary-actions.png)
- [Spezialvorlagen-Dialog final](assets/ap7/template-options-final.png)
- [Dialog-Geometrie final](assets/ap7/dialog-final-geometry.json)
- [Story mobil final](assets/ap7/story-mobile-final.png)
- [Storyfehler final](assets/ap7/story-validation-final.png)
- [Poll mit sechs Optionen](assets/ap7/poll-mobile-final.png)
- [Poll-Freitextmodus](assets/ap7/poll-free-text-final.png)
- [Pollfehler final](assets/ap7/poll-validation-final.png)
- [Desktop final](assets/ap7/question-desktop-final.png)
- [Tablet](assets/ap7/question-tablet-final.png)
- [Querformat final](assets/ap7/question-landscape-final.png)
- [Alle Geometriemessungen](assets/ap7/geometry.json)
- [Living Specification](../architecture/mobile-editor-ux.md)

Weitere Screenshots im selben Asset-Verzeichnis zeigen Pixel, Ordering,
Übersetzung, Rezensionen, ausgeklappte AP5-Warnungen und Desktop-Story/Poll.

## Reale Preview-Abnahme

Alle Inhalte sind eigene, ausdrücklich erkennbare Testinhalte. Es wurde kein
bestehendes fachliches Quizmaterial verändert oder in einen Quizblock eingefügt.

| Fall | Beobachtung |
| --- | --- |
| Normale Frage 97 | Eigener 255-Zeichen-Fragentext, richtige 129-Zeichen-Antwort plus falsche Antwort; beide Warnungen vorhanden. Entwurf gespeichert, erneut geöffnet, zweite Antwort geändert und nach ausdrücklicher Freigabe des Nutzers veröffentlicht. |
| Validierung | Leere richtige Antwort führte zu „Keine ausgefüllte richtige Antwort vorhanden“ und Fokus auf das Antwortfeld. Feld y=227–277, Leiste beginnt bei y=335 einschließlich Fehlertext. |
| Mobile Leiste | 390×440: 61 px Höhe, beide sichtbaren Buttons jeweils 44 px. Vorher rund 274 px. Aktiver Fragentext y=159–281, Leiste y=379–440. |
| Spezialvorlage | Sekundäre Option öffnet genau einen Dialog; Name/Beschreibung bearbeitet, ohne Vorlage anzulegen. Erste Abnahme fand einen um 13 px überstehenden Dialograhmen; nach Korrektur in `24efb4d`: Panel y=16–424 innerhalb 440 px, Beschreibung y=152–248, Übernehmen y=312–356 und Abbrechen y=364–408. |
| Story 5 | Eigene Anekdote mit 781 Zeichen als Entwurf gespeichert. Warnung vollständig aufklappbar. Bei 360×440 Textfeld y=208–336, Leiste ab y=379. Kapitelintro-Medienfelder separat ohne Speichern geprüft und verworfen. |
| Poll 3 | Eigene Auswahlumfrage mit sechs Optionen als Entwurf gespeichert und wieder geöffnet; letzte Option entfernt und neu hinzugefügt. Bei 430×440 letzte Option y=198–242, Leiste ab y=379. |
| Poll-Touchziel | Bisheriges „+ Option“ 20 px hoch; in `24efb4d` mobil auf mindestens 44 px erweitert, Desktop unverändert. Vercel-Toolbar überlagerte zeitweise Klicks; Tastaturaktivierung funktionierte. |
| Pixel | Stufenwertung ausgewählt und Lösungsfeld bearbeitet; y=195–245 bei 390×440. Keine Mediengenerierung und keine Änderung der Pixelregeln. |
| Ordering | Drei Begriffe, zusätzliche Erklärung des dritten Begriffs; y=198–242 bei 390×440. |
| Übersetzt vorgelesen | Lange eigene Original-/Übersetzungstexte und gesuchte Lösung bearbeitet. Übersetzungsfeld y≈188–252, Lösung y≈198–242. Keine Audioerzeugung. |
| Google-Rezensionen | Fiktiver Ort, zweite lange erfundene Rezension und zusätzlicher Hintergrundtext; beide Felder vollständig über der Leiste. Keine externen Rezensionen übernommen. |
| Multi/Skala | Vorhandene Frage-Spezialtemplates geöffnet und Endfelder bearbeitet; keine neue Umfragelogik. |

Die Spezialtemplate-Prüfungen verwendeten ungespeicherten eigenen Inhalt.
Persistiert sind nur Frage 97, Story 5 und Poll 3. Die Frage ist freigegeben,
Story und Poll sind Entwürfe ohne Verwendung. Der Poll wurde nach den
Auswahlrevisionen als Freitext-Wall gespeichert; keine Inhalte wurden in ein
Quiz eingefügt.

Auf dem finalen direkten Preview außerdem geprüft:

- Tablet 768×1024: aktives Fragenfeld y=451–573, Footer ab y=887.
- Querformat 844×390: aktives Antwortfeld y=170–220, Footer ab y=253.
- Story mobil 360×440 nach Speichern: Textfeld y=156–284, Footer mit
  Rückmeldung ab y=315. Leerer Titel ergibt „Mindestens ein Textfeld ist leer
  oder zu lang“; nach Korrektur Revision 6 gespeichert.
- Poll mobil 430×440: letzte Option y=198–242, Footer mit Rückmeldung ab
  y=313. Die bestehende Poll-Abstandsregel lässt unter dem Footer 20 px frei.
  Leerer Prompt ergibt „Prompt oder Moderationsnotiz ist ungültig“; korrigiert
  und als Revision 4 gespeichert.
- Finale Frage mobil: Fragentext y=159–281, Footer y=379–440. Zweite Antwort
  nach erneutem Öffnen: „Grün – eigene bearbeitete AP7-Testantwort“.
- Tab von primärer Aktion führt zu „Weitere Aktionen“, sichtbarer Fokus
  `solid`, 2 px. Abschließend keine erfassten Browser-Konsolenfehler.

Die Funktion zum direkten Leeren eines Inputs änderte in dieser Browserautomation
zeitweise nicht den Wert. Negative Story-/Pollfälle wurden deshalb erst nach
echtem Strg+A/Backspace und sichtbarer Leerwertkontrolle als bestanden gewertet.
Zusätzliche erfolgreiche Testrevisionen während dieser Prüfung waren einzeln
ausgelöste Speicherungen, kein automatischer Doppelsubmit.

## Browser- und Geräteabgrenzung

Die browserweite Größensteuerung wirkt in dieser Umgebung auf den tatsächlich
aktiven Tab. Ein Versuch, den inaktiven Storytab auf Desktopgröße umzustellen,
blieb bei 360×440; dieser Datensatz ist ausdrücklich als nicht angewandte
Desktopanforderung markiert. Er ist kein Desktopnachweis.
Ebenso zeigte ein alter Tab trotz Reload noch das vorherige Deployment.
Die finale Abnahme erfolgte daher auf der direkten Deployment-Adresse mit
verifiziertem Asset-Deployment-Identifier. Fotos wurden nach abgeschlossener
Größenumschaltung aufgenommen; Browser-Screenshots können Scrollleisten und
Fensterränder ausschließen. Maßgeblich für CSS-Pixel sind die DOM-Geometriewerte.

## Runtime und Ziel

Erster Runtime-Commit: `e17f180b380dceaed8ce7259907179380bcfdd88`.
Layoutkorrektur: `24efb4dc0b40ec3c0a5f6f2d1c38df7f8b8898f9`.
Finaler Runtime: [Preview](https://pubquiz-3h0b87uu0-just-phil-gud.vercel.app),
Deployment `dpl_AyvzPWGKKWwZdK5ag2xiwKbZakRH`.
CI-Läufe `34148937886` und `34148937888`: erfolgreich.
Deployment/Smoke `34149041299`: erfolgreich.
Feature-Branch: `codex/ap7-mobile-editor`.
Deployment-Ziel: `preview/content-and-quiz-flow`.
Basis: AP6 inklusive Bericht `bfd71a39e0792da0718b389733f81256f68e19e1`;
vorheriger Preview-Runtime `0a250b9601abc0b6b59f776df5727d719b24539a`.
`main` vor Beginn und vor Runtime-Push:
`e76f57dce19f26488cf9db24b881ab06bf004fd6`.

## Geänderte Dateien

Runtime und Tests:

- `app/components/content/ContentEditorActionBar.tsx`
- `app/components/content/ContentEditorShell.tsx`
- `app/components/content/contentEditorViewport.ts`
- `app/components/content/mobileEditor.test.tsx`
- `app/fragen/editor/components/CreateDynamicQuestionTemplate.tsx`
- `app/globals.css`
- `app/rendering/presentation/PresentationContentWarning.tsx`
- `app/story-elemente/StoryElementEditor.tsx`
- `app/umfragen/LivePollEditor.tsx`
- `components/ui/Modal.tsx`
- `package.json`

Dokumentation:

- `docs/architecture/mobile-editor-ux.md`
- `docs/architecture/README.md`
- `docs/reports/ap7-mobile-editor.md`
- `docs/reports/assets/ap7/` (Screenshots und Geometrien eigener Tests)

Der lokale Worktree ist `.worktrees/ap5-presentation` auf
`codex/ap7-mobile-editor`; der übergeordnete Arbeitsstand mit fremden Änderungen
wurde nicht verändert. Abschließender Remotevergleich bestätigt Main unverändert
und Preview auf `24efb4dc0b40ec3c0a5f6f2d1c38df7f8b8898f9`.
