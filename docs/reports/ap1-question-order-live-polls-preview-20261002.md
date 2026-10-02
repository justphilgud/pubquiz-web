# AP1 – Fragenreihenfolge und additive Livefragen

Stand: 2026-10-02

## Ergebnis

Die Findings 6 und 7 sind auf Preview behoben und mit einem getrennten Editor-, Moderations-, Präsentations- und Teilnehmerablauf abgenommen. `main` und Production wurden im Rahmen dieses AP nicht verändert.

Preview-Testquiz: [TEST – AP1 Reihenfolge und Livefragen 02.10.2026](https://pubquiz-web-git-preview-content-and-quiz-flow-just-phil-gud.vercel.app/quiz/73)

Deployment:

- URL: `https://pubquiz-d3yf8nio0-just-phil-gud.vercel.app`
- Deployment-ID: `dpl_2YpX9isXjDWWWp7wU2XrorAWxqLA`
- Preview-Merge-Commit: `7e2d07fc1310f76bc4945137a2a67a219e9f34d3`
- Feature-Commits: `b1bb24fbeb4abd3e87e027280676fccc10e4f42c`, `2aa48c63f8abb93afba8c42e46e6439d9be17024`

## Ursachen

### Finding 6

Die Quizkonfiguration und das Antwortformular verwendeten die redaktionelle Reihenfolge der Quizfragen, während Präsentation und Moderation zusätzlich den gespeicherten Ablauf (`quiz_ablauf_elemente`) auswerteten. Nach einer Umordnung konnten Frageposition und Ablaufposition auseinanderlaufen. Gleiche oder fehlende Sortierwerte hatten außerdem keinen überall identischen Fallback.

Die erste Preview-Abnahme deckte zusätzlich einen Persistenzfehler auf: Beim Umordnen wurden nur im Editor sichtbare Ablaufzeilen temporär neu nummeriert. Unsichtbare, aber im selben Datenbankslot gespeicherte Lösungs- und Verknüpfungselemente behielten ihre Sortierwerte. Dadurch konnte die eindeutige Slot-/Sortier-Constraint kollidieren und die Änderung wurde nicht gespeichert.

Der gemeinsame Vertrag liegt nun in:

- `app/quiz/quizQuestionOrder.ts`: redaktionelle Position, danach stabile `quiz_fragen_id`.
- `app/quiz/flow/quizBlockSequence.ts`: dieselbe kanonische Fragenidentität für den gemeinsamen Ablauf.
- `app/quiz/[quizId]/praesentation/buildPraesentationSlides.ts`: identischer deterministischer Fallback.
- `app/quiz/[quizId]/quizStructureActions.ts`: transaktionale, serialisierte Neuordnung des vollständigen Slots.
- `app/quiz/flow/quizEditorSequencePersistence.ts`: sichtbare Editor-Reihenfolge wird in die vollständige Slotfolge eingesetzt; nicht sichtbare Elemente behalten ihre relative Position.

Antworten bleiben an `quiz_fragen_id` gebunden. Es gibt keine Datenmigration und keine nachträgliche Umhängung bestehender Antworten.

### Finding 7

`QuizAntwortClient.tsx` hatte bisher zwei gegenseitig ausschließende Darstellungszweige: Sobald `livePollState` vorhanden war, wurde nur das Livefragenformular gerendert. Das war eine Client-Darstellungsentscheidung und keine technische Notwendigkeit des Servermodells.

Der Server liefert nun eine gemeinsame Teilnehmersequenz aus freigegebenen regulären Fragen und bereits geöffneten Livefragen. Der Client rendert die aktive Livefrage hervorgehoben an ihrer gespeicherten Position, ohne reguläre Fragen zu entfernen. Noch nicht geöffnete Livefragen werden nicht ausgeliefert. Geschlossene Livefragen zeigen nur die eigene letzte gültige Antwort; die vorhandene serverseitige OPEN-Sperre bleibt maßgeblich.

## Preview-Abnahme

Da Quiz 18 in Preview nicht den beschriebenen Datenbestand enthielt, wurde Quiz 73 als Testkopie verwendet. Die persistierte Reihenfolge nach Reload war:

1. XL-Frage (offen)
2. Farbfrage
3. Wochenfrage
4. Hauptstadtfrage
5. Planetenfrage
6. Tierfrage
7. Reihenfolgefrage
8. What the Meme!
9. Auswahl-Livefrage
10. Freitext-Livefrage

Geprüft:

- Umordnung zwischen gemischten Fragen und beiden Livefragen bleibt nach Speichern und Reload erhalten.
- Interne Ablaufansicht, Moderation und Präsentation verwenden dieselbe relative Reihenfolge.
- Eine reguläre Antwort blieb während beider Livephasen, nach dem Schließen und nach Reload erhalten.
- Die erste Livefrage erschien erst nach Freigabe, war nur offen beantwortbar und zeigte nach dem Schließen ausschließlich die eigene Antwort.
- Die zweite Livefrage war vorher verborgen, erschien anschließend an Position 10 und behielt ihre eigene Antwort nach Schließen und Reload.
- Reload/Reconnect zeigte beide Livefragen geschlossen, ohne wieder aktivierte Eingabefelder.
- Präsentation und Moderation zeigten bei der zweiten Livefrage dieselbe Ablaufposition 18/34.
- Navigation vorwärts und rückwärts zeigte die korrekten Inhalte.

Die Preview-Testkopie bleibt als Abnahmenachweis bestehen. Ihre Laufzeit-Testdaten wurden nicht in Production übernommen.

## Automatisierte Prüfung

- Erweiterte AP1-Fokussuite auf dem Preview-Branch: 93/93 erfolgreich.
- Persistenz-Regressionssuite nach dem Reorder-Fix: 34/34 erfolgreich.
- Erneute gezielte Prüfung auf dem von `main` bereinigten Branch: 48/48 erfolgreich.
- TypeScript: erfolgreich.
- ESLint für geänderte Dateien: erfolgreich.
- Prisma-Validierung: erfolgreich.
- Production-Build mit Next.js 16.2.5: erfolgreich.
- Preview-CI: erfolgreich, Runs `36993603635`, `36993659768`, `36994027416`.
- Preview-Deployment: erfolgreich, Run `36994284938`.

Der vollständige lokale Windows-Testlauf hatte 682/683 erfolgreiche Tests. Der einzige lokale Fehler ist der bereits bestehende CRLF-Rohdatei-Hash-Test des OpenTDB-Productionplans. Derselbe unveränderte Gate-Test ist in Linux-CI erfolgreich; die AP1-Änderungen verursachen diesen lokalen Unterschied nicht.

## Einschränkungen

- Die im Ausgangsbefund genannte konkrete Türme-Frage war im verfügbaren Preview-Bestand nicht vorhanden. Der Ablauf wurde mit dem vorhandenen Fragetyp `Reihenfolge` reproduziert.
- Das Testquiz ist noch als Preview-Abnahmenachweis vorhanden. Eine spätere Bereinigung seiner Laufzeitdaten benötigt eine separate, konkrete Freigabe.
