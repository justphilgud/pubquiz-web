# AP8 – Restbugs und Cleanup

Abnahmebericht vom 7. September 2026. Alle drei Restbugs sind auf dem finalen
Preview im realen Browser erfolgreich abgenommen.

Runtime-Commit: `a014c1be2f326cd562650c4fd6f4096c542809c4`.
Basis: AP7-Runtime `24efb4d` und Dokumentation `d647948`.
Branch: `codex/ap8-cleanup`; Deployment über `preview/content-and-quiz-flow`.

## Ergebnisse gemäß Auftrag

| Nr. | Gegenstand | Ergebnis |
| --- | --- | --- |
| 1 | B05-Ursache | „Kopie anlegen“ war `type=button` ohne Handler, „Abbrechen“ dagegen `type=submit`. Autorisierter Reproduktionsklick blieb im Dialog ohne Kopie. |
| 2 | B05-Fix | Reguläres Formular, Kopie als Submit, Abbruch als Button. Sofortige Ref-Sperre verhindert Mehrfachsubmit bis Fehler oder Navigation; Pending sperrt Eingaben und Schließen. |
| 3 | Kopiervertrag | Bestehende Action unverändert. Neue Quiz-/Block-/Zuweisungs-IDs, Referenzen auf vorhandene Fragen und Storyrevisionen; Reihenfolge und Konfiguration übernommen. Keine Runtime-Daten. Details: [Quiz-Kopiervertrag](../architecture/quiz-copy.md). |
| 4 | Reale Kopierabnahme | Klick → 31, Enter → 32, Doppelklick → 33. Genau drei freigegebene Kopien, kein Abbrucheintrag. Struktur erhalten; alle ohne Teams; 31 mit frischem Lifecycle und leerer Auswertung. |
| 5 | AP6-F01-Ursache | RULES verwendete große ursprüngliche Titel/Badges und eine `overflow:hidden`-Liste außerhalb der AP5-Rollen. Vier Zeilen benötigten 419 px in einer 269-px-Liste. |
| 6 | Regelfolien-Fix | Zentrale Readability-CSS-Regeln verwenden begrenzte Titel-/Textrollen, natürliche Zeilenhöhen und kontrollierte Abstände. Überlänge wird vom vorhandenen Scrollbereich aufgefangen. |
| 7 | 1280×720 | Eigene Kopie 31: alle vier Regeln sichtbar, 24 px Schrift, Liste 250/250 px, Inhaltsviewport 530/530 px, kein Scrollhinweis. |
| 8 | Themes | Standard, LOVD, Corporate und Storybook jeweils bei 1280×720, 1920×1080 und 2560×1440 ohne Overflow; Volltexttests grün. Legacy-Fallback mit acht langen Regeln bis zum Ende per Tastatur erreichbar. |
| 9 | AP7-F02-Ursache | Ein gemeinsames Label umschloss zwei Inputs. Der erste Name enthielt beide Beschriftungen und den rechten Wert; das zweite Input war unbenannt. |
| 10 | Accessibility-Fix | Äußerer Layoutcontainer bleibt, jedes Input erhält sein eigenes sichtbares Label. Handler und Persistenz unverändert. |
| 11 | Zugängliche Namen | Realer AX-Baum und Tests: exakt „Beschriftung links“ / „Beschriftung rechts“, jeweils ein Input pro Label. Tab links → rechts. |
| 12 | Persistenz/Mobil | Eigener Entwurf 98: beide Werte gespeichert und nach Wiederöffnen vorhanden; mobile Änderung links nach Reload erhalten, rechts unverändert. 360/390/430 px und 390×440 geprüft, Desktop weiterhin zweispaltig. |
| 13 | Living Specs | Quiz-Kopiervertrag neu dokumentiert; Presentation Rendering, Intro/Teambeitritt und Mobile Editor UX gezielt ergänzt. |
| 14 | Neue Tests | Acht neue Fälle: fünf Dialogtests, ein bestehende Action ausführender Kopiervertragstest, zwei Label-/Werttests. Bestehende Vier-Theme-Rendererprüfungen um vier kurze und acht lange Regeln erweitert. |
| 15 | Qualitätsprüfung | Lokal 1.095/1.095 Tests (400+508+11+176), TypeScript, repositoryweiter ESLint, Prisma-Validierung und Production-Build erfolgreich. Preview-CI, Deployment und HTTP-Smoke erfolgreich. |
| 16 | B10a-Smoke | Request-Loop-Regression grün; kein neuer Effect, Poller oder Requestpfad. Eigene Moderation einschließlich vier Folienwechsel und Regeln → QR stabil, keine Konsolenfehler. Keine neue Laststudie oder globale Requestmessung behauptet. |
| 17 | Offene Findings | B10b, AP7-F01, Hardwaretastaturabnahme und mobile/Hochkant-Präsentationsgestaltung bleiben bewusst außerhalb AP8. |
| 18 | Dateien | Auflistung unten. |
| 19 | Schema/Migration | Keine Änderungen, keine neuen Abhängigkeiten. |
| 20 | Commits | Runtime `a014c1b`; dieser Bericht mit Nachweisen wird separat als Dokumentationscommit veröffentlicht. |
| 21 | Finaler Preview-Commit | `a014c1be2f326cd562650c4fd6f4096c542809c4`, unverändert real abgenommen. |
| 22 | Preview-URL | https://pubquiz-ojcwrsyif-just-phil-gud.vercel.app |
| 23 | Main/Production | Abschließende Remote-Prüfung: `main` unverändert bei `e76f57dce19f26488cf9db24b881ab06bf004fd6`; Preview bei `a014c1b`. Production-Job übersprungen, keine Production-Veröffentlichung durch AP8. |
| 24 | AP9-Empfehlung | Bereit für AP9. Kein offener AP8-Blocker; die ausdrücklich ausgeschlossenen Backlogthemen bleiben separat. |

## Reproduktion vor der Änderung

AP7-Preview: `https://pubquiz-3h0b87uu0-just-phil-gud.vercel.app`.
Eigenes Quiz 30 „Codex AP6 Intro und Teambeitritt“, fünf Testteilnahmen, null
Antworten, Vorbereitung. Die Fehlersuche änderte nur dessen Vorschauposition von
QR 6 auf Regeln 5; kein Start, Reset oder Eingriff in fremde Inhalte.

- [Kopierdialog ohne Klickwirkung](assets/ap8/copy-before.png)
- [Abgeschnittene Standard-Regelliste bei 1280×720](assets/ap8/rules-before-standard-1280.png)
- [AX-Baum der gemeinsamen Skalenbeschriftung](assets/ap8/scale-before-accessibility.txt)

Regelliste: oben 334,45 px, unten 603,21 px; `clientHeight=269`,
`scrollHeight=419`, `overflow=hidden`. Unterste Regel: 658,41–753,59 px.

## Reale Abnahme

### B05

Quelle 30 blieb redaktionell unverändert; Vorher-/Nachher-AX unterscheiden sich
nur in leeren Status-/Alertknoten. Datum der Kopien: 8. September 2026.
Klick zeigte „Wird kopiert …“ und deaktivierte Felder/Buttons, danach Navigation
auf `/quiz/31`. Enter im Namensfeld navigierte auf `/quiz/32`; echter
Playwright-Doppelklick auf den Submit auf `/quiz/33`. Die Übersicht enthielt
genau diese drei AP8-Kopien und keinen „Abbruch“-Eintrag.

Alle drei enthalten Intro mit fünf festen Slides, einen Fragenblock mit der
Schumacher-Frage (maximal 1 Punkt, offene Antwort), Outro mit zwei festen Slides
und END_OF_BLOCK. Die Übersicht zeigt überall 0 Teams/Teilnehmer gegenüber 5 in
der Quelle. Kopie 31 öffnete auf Wartebildschirm 1/15 in Vorbereitung, ohne
gestartetes Quiz und mit ungestartetem 05:00-Countdown. Auswertung mit „Alle
Fragen“: 0 Treffer, keine Antworten/Bewertungen. Die Engine-Regression prüft
zusätzlich, dass ausschließlich Inhaltstabellen angesprochen werden.

Abbruch mit ausgefüllten Pflichtfeldern: Dialog zu, URL weiter `/quiz/30`.
Mobil bei 390×844: Dialog 343 px breit innerhalb des Viewports, beide Buttons
44 px hoch; erneuter Abbruch ohne Kopie. Keine vierte Kopie angelegt. Touchziele
und native Formularsemantik sind geprüft; kein physischer Touch-Hardwaretest.

Nachweise: [drei Kopien](assets/ap8/copy-list.json),
[Klickstruktur](assets/ap8/copy-click.txt), [Enter](assets/ap8/copy-enter.txt),
[Doppelklick](assets/ap8/copy-doubleclick.txt),
[frischer Durchlauf](assets/ap8/copy-fresh-runtime.txt),
[leere Auswertung](assets/ap8/copy-empty-evaluation.txt),
[Quelle vorher](assets/ap8/copy-source.txt) / [nachher](assets/ap8/copy-source-after.txt).

### Regelfolie

[Echte Standard-Präsentation bei 1280×720](assets/ap8/rules-real-standard-1280.png)
und [Messwerte](assets/ap8/rules-real-1280.json): letzte Regel endet bei 500,63 px,
alle Texte in Reihenfolge vollständig. Vier manuelle Vorschauwechsel in Kopie 31
führten von Wartebildschirm über Startsequenz, Begrüßung und Preise zu Regeln.
Der nächste manuelle Wechsel zeigte [QR mit korrekter Kopie-31-Beitrittsadresse](assets/ap8/rules-to-qr.txt).
Kein Quizstart, kein Reset, keine Teams hinzugefügt.

| Theme | 1280×720: Inhalt/Viewport | 1920×1080 | 2560×1440 |
| --- | --- | --- | --- |
| Standard | 530/530 px | 858/858 px | 1218/1218 px |
| LOVD | 449/449 px | 750/750 px | 1102/1102 px |
| Corporate | 462/462 px | 814/814 px | 1174/1174 px |
| Storybook | 486/486 px | 846/846 px | 1206/1206 px |

Alle zwölf Kombinationen: horizontaler Inhaltsumfang gleich Viewportbreite,
vier Regeln vollständig, Scrollhinweis unsichtbar. Schrift 24 px bei 720p,
32 px bei 1080p/1440p. [Vollständige Matrix](assets/ap8/rules-theme-matrix.json),
[Storybook 720p](assets/ap8/rules-storybook-1280.png).

Legacy: acht Regeln mit je einem langen Absatz; 2165 px Inhalt bei 530 px Höhe.
Scrollhinweis sichtbar, Fokus auf „Präsentationsinhalt“, Strg+Ende erreicht nach
dem nativen Scrollen die unterste Regel (Ende 605,57 px innerhalb Viewportende
625,41 px). [Messung](assets/ap8/rules-legacy.json) und
[vollständiges Listenende](assets/ap8/rules-legacy-end.png). Es wird nichts gekürzt.

### Skalenfelder

Eigener **Entwurf 98**, „Codex AP8 Skala: Wie gut passt die Testbeschriftung?“,
Bestandsquizze; keine Freigabe und keine Quizzuweisung. Zunächst beide Randwerte
geändert und als Entwurf gespeichert, dann unter `/content/questions/98` erneut
geöffnet. Beide Werte vorhanden. Mobil nur links auf „AP8 links mobil geprüft“
geändert, gespeichert und vollständig neu geladen. Rechts blieb
„AP8 rechts: vollkommen“. Von/Bis/Schrittweite unverändert 1/5/1.

Jeweils ein Input pro Label, Namen exakt „Beschriftung links“ und „Beschriftung
rechts“. Tab vom linken Feld fokussiert das rechte. Mobil gestapelt, 44 px Höhe;
Breiten 287 px bei 360, 317 px bei 390 und 357 px bei 430. Auch bei 390×440
bleibt das rechte fokussierte Feld sichtbar (y=198 bis 242). Desktop 1280:
beide Felder auf y=338, nebeneinander mit 16 px Abstand. Konsole ohne Fehler.

[AX nach Korrektur](assets/ap8/scale-after-accessibility.txt),
[gespeicherter Reload](assets/ap8/scale-reloaded.txt),
[Mobilgeometrie](assets/ap8/scale-mobile-geometry.json),
[Mobilansicht](assets/ap8/scale-mobile-390.png), [Desktop](assets/ap8/scale-desktop.png).

## Geänderte Dateien

- `app/quiz/QuizCopyDialog.tsx`
- `app/quiz/QuizCopyDialog.test.ts`
- `app/quiz/quizCopyContract.test.ts`
- `app/fragen/editor/components/StructuredTemplateEditor.tsx`
- `app/fragen/editor/components/pollScaleAccessibility.test.ts`
- `app/rendering/presentation/presentationReadability.css`
- `app/rendering/presentation/presentationReadability.test.ts`
- `app/rendering/presentation/presentationQualityFixtures.ts`
- `package.json` (neue Regressionen in vorhandener Testsuite)
- `docs/architecture/quiz-copy.md`
- `docs/architecture/presentation-rendering.md`
- `docs/architecture/intro-team-join.md`
- `docs/architecture/mobile-editor-ux.md`
- dieser Bericht und `docs/reports/assets/ap8/`

## Architektur und Grenzen

Keine neue Komponente oder Kopierengine. UI-Zustand bleibt im Dialog,
Berechtigung/Validierung/Kopieren in der bestehenden Server-Action. Geometrie
bleibt in der zentralen AP5-Schicht; Theme-Branding und AP6-Flow unverändert.
Skalenwerte bleiben im vorhandenen strukturierten Editor-/Draftvertrag.
Die internen RULES-Fixtures sind rein lesend und nutzen den produktiven Renderer.

Die Dialogsperre gilt für die laufende Komponente bis Navigation; sie verspricht
keine globale Idempotenz zwischen Tabs oder bei unbekanntem Netzwerkergebnis.
Automatisierte Browserbedienung ersetzt keine echte Android-/iOS-Hardwareabnahme.

## Pipeline

- [Preview-CI erfolgreich](https://github.com/justphilgud/pubquiz-web/actions/runs/34152107153)
- [Feature-CI erfolgreich](https://github.com/justphilgud/pubquiz-web/actions/runs/34152107293)
- [Preview-Deployment und Smoke erfolgreich](https://github.com/justphilgud/pubquiz-web/actions/runs/34152240529)
- Deployment-ID: `dpl_HHhnrtfCmmqpP5bLhqZwb2wf6KoE`
- Deployment-Runtime: `a014c1be2f326cd562650c4fd6f4096c542809c4`
- Production-Workflow 34152240545: `skipped`.
- Bestehender Hinweis zu Node-20-basierten GitHub Actions, die auf Node 24 laufen;
  Workflow-Runtimemodernisierung bleibt ausdrücklich außerhalb AP8.
