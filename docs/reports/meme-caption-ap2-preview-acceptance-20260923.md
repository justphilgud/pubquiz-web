# AP2 Meme-Auswahl und Moderation – Preview-Abnahme 2026-09-23

## Ergebnis

AP2 erweitert den in AP1 bestehenden Meme-Submission-Lifecycle um eine einmalige serverseitige Auswahl, eine persistente Reihenfolge, einen anonymen Moderator-Review und eine stabile serverseitige Leseschnittstelle für AP3. Präsentation, Voting und Punkte sind weiterhin nicht Bestandteil von AP2.

- Feature-Branch: `codex/meme-moderation-ap2`
- Feature-Commit: `e7888ed5b75c3c66224a5e758e064183d37c51d2`
- getesteter Preview-Branch-Commit: `5687c6de8817344b5db86db03bd668dec3a704f4`
- stabile Preview: `https://pubquiz-web-git-preview-content-and-quiz-flow-just-phil-gud.vercel.app`
- erstes Deployment: `dpl_8m7nF7pP3pFP4mhqrBT8DN42GqAT`
- erstes unveränderliches Deployment: `https://pubquiz-qdm5l8b8w-just-phil-gud.vercel.app`
- Persistenz-Redeploy: `dpl_B59QuAFJhYu7LFpy7WCJWxYFKBQv`
- zweites unveränderliches Deployment: `https://pubquiz-ldbab5lgu-just-phil-gud.vercel.app`
- Preview-CI: `35900161907`
- Preview-Deploy: `35900447820`
- no-change Persistenz-Redeploy: `35901900736`
- Production und `main`: unverändert

## Wiederverwendete Architektur

- AP1-Interaktionsläufe, serverseitige Deadlines, final akzeptierte Submissions, Team-Sessions und der bestehende Antwort-/Draft-Controller bleiben die Quelle der Kandidaten.
- Die AP1-Konfiguration `meme_config_json` liefert `maxPresentedMemes`; `null` bedeutet weiterhin „Alle“.
- Die Moderation bleibt Teil des vorhandenen `ModerationClient` und nutzt dessen Live-Snapshot, Rollenprüfung und Blockschluss.
- `MemeRenderer` rendert Basisbild und gespeicherte Texte auch im Review. Es werden keine gerenderten Bilder, Screenshots, Base64-Kopien oder zusätzlichen Medien gespeichert.
- AP1-Submissions werden durch AP2 weder aktualisiert noch gelöscht.

## Kandidaten, Auswahl und Persistenz

`collectValidMemeSubmissions` berücksichtigt nur `MEME_CAPTION`-Submissions des richtigen Interaktionslaufs mit finalem Status, gültigem Payload und mindestens einem Text. Pro Team gewinnt die höchste fachliche Submission-Version; bei gleicher Version entscheidet die höhere Submission-ID.

`createMemeSelectionPlan` mischt die gültige Menge serverseitig mit einem Fisher-Yates-Verfahren und `node:crypto.randomInt`. Bei „Alle“ wird die vollständige gemischte Menge übernommen. Bei festem Limit wird genau `min(Limit, gültige Einreichungen)` übernommen.

Beim ersten AP2-Zugriff sperrt eine Transaktion den Interaktionslauf, liest eine bereits vorhandene Auswahl zuerst und legt andernfalls genau einen Selection-Datensatz sowie die Kandidaten mit festen Positionen an. Eindeutige Datenbankbedingungen auf `interaction_run_id`, Submission und `(selection_id, position)` schützen auch parallele Erzeugungsversuche. Reload, zweiter Client, Tab-Neustart und Deployment lesen anschließend ausschließlich diese Datensätze.

## Review und AP3-Vertrag

- Kandidaten beginnen als `PENDING_REVIEW` und können nur `APPROVED` oder `REJECTED` werden.
- Der Moderator sieht Meme, Kandidatennummer und Reviewstatus, aber keinen Teamnamen und keine Textfelder.
- Ablehnung erzeugt keinen Ersatzkandidaten.
- Alle Kandidaten müssen entschieden sein; mindestens einer muss freigegeben sein. Eine leere Auswahl wird explizit als `SKIPPED` abgeschlossen.
- Auswahl- und Kandidatenrevisionen bilden einen Optimistic-Locking-Vertrag. Ein veralteter Client erhält `REVISION_CONFLICT` und den aktuellen Serverstand.
- Nach `COMPLETED` sind die Reviewaktionen gesperrt.
- `readApprovedMemeCandidatesForAp3` liefert ausschließlich freigegebene Kandidaten eines abgeschlossenen Reviews in Positionsreihenfolge, einschließlich Submission-ID, Quizfrage, interner Teamreferenz, Texten, Position, Review- und Auswahlstatus.

## Datenmodell und Migration

Die additive Migration `20260923190000_add_meme_moderation` ergänzt:

- `meme_moderation_selections` für Interaktionslauf, Zustand, Revision, gültige Anzahl, angewendetes Limit und Auditdaten,
- `meme_moderation_candidates` für unveränderliche Submission-Referenz, stabile Position, Reviewstatus, Revision und Auditdaten,
- die Enums `MemeModerationSelectionState` und `MemeModerationReviewStatus`.

Der geschützte Preview-Workflow validierte vor und nach dem Deploy die Preview-Datenbankidentität und den vollständigen Migrationsstand. Der zweite Deploy desselben Commits war migrationsseitig ein No-op.

## Automatisierte Prüfung

- fokussierte AP2-Tests: 9/9 erfolgreich,
- bestehende vollständige Testmatrix einschließlich AP1, Standard-, Pixel-, Präsentations- und Browserregression: erfolgreich,
- Prisma-Generierung und Schema-Validierung: erfolgreich,
- TypeScript: erfolgreich,
- ESLint der geänderten TypeScript-/JavaScript-Dateien: erfolgreich,
- vollständiger Production-Build: erfolgreich,
- Feature-CI `35899633427`: erfolgreich,
- Preview-CI `35900161907`: erfolgreich,
- beide Preview-Migrations-/Deploy-/HTTP-Smokes `35900447820` und `35901900736`: erfolgreich.

Die automatisierten AP2-Fälle prüfen Kandidatenfilterung, den letzten gültigen Stand pro Team, „Alle“, festes Limit, weniger und exakt so viele Einreichungen wie das Limit, keine Duplikate, Abschlussregeln, eindeutige Persistenz, stabile Position, Optimistic Locking, serverseitige Rollenprüfung, gemeinsame Rendering-Komponente, fehlende Editorfelder, unveränderte AP1-Submissions und den AP3-Lesevertrag.

## Repräsentative Preview-Daten

- Quiz `#59`: Limit 4, sechs gültige Einreichungen, Deadline tatsächlich abgelaufen.
- Quiz `#60`: „Alle“, drei gültige Einreichungen.
- Quiz `#61`: Limit 8, drei gültige Einreichungen.
- Quiz `#62`: keine Einreichung.
- Quiz `#63`: zwei Einreichungen, beide ausgeschlossen; absichtlich weiterhin im blockierten Reviewzustand.
- Quiz `#64`: AP1-Reloadregression und genau eine gültige Einreichung bei Limit 8.
- Quiz `#65`: Limit 8, exakt fünf gültige Einreichungen.

## Preview-Flows A bis I

### A – Auswahl

Bestanden. In Quiz `#59` wurden sechs gültige, vor Deadline bestätigte Einreichungen erzeugt. Nach tatsächlichem Fristablauf erschienen exakt vier unterschiedliche Kandidaten. Die Auswahl entstand erst nach dem serverseitigen Ende; während des Countdowns zeigte die Moderation ausdrücklich „noch nicht bereit“.

### B – Stabilität

Bestanden. Die vier Kandidaten und ihre Reihenfolge blieben identisch nach Reload, in einem zweiten Moderatorclient, nach Schließen und neuem Öffnen eines Moderatortabs sowie nach einem vollständigen no-change Preview-Redeploy desselben Commits. Der Reviewzustand `2 freigegeben / 2 ausgeschlossen / 0 offen` blieb über den Redeploy erhalten.

### C – Alle

Bestanden. Quiz `#60` übernahm bei `Alle` alle drei gültigen Einreichungen genau einmal und ließ sich mit drei Freigaben abschließen.

### D – Weniger als Limit

Bestanden. Quiz `#65` übernahm bei Limit 8 alle fünf gültigen Einreichungen genau einmal. Zusätzlich wurden die Grenzfälle 3/8 und 1/8 geprüft.

### E – Moderation

Bestanden. Die gemeinsame `MemeRenderer`-Darstellung zeigte alle ausgewählten Texte. Freigabe und Ausschluss wurden persistent gespeichert. Der Abschluss sperrte sämtliche Reviewaktionen. Zwei der vier Hauptfall-Kandidaten blieben ausgeschlossen; kein fünfter oder sechster Kandidat rückte nach.

### F – Zweiter Moderator

Bestanden. Zwei Clients sahen dieselbe Auswahl. Gleichzeitiges Freigeben bzw. Ausschließen desselben Kandidaten mit demselben alten Revisionsstand führte zu genau einer gespeicherten Entscheidung und bei Client B zur sichtbaren Konfliktmeldung; beide Clients lasen danach denselben Serverstand.

### G – Kein freigegebener Kandidat

Bestanden. In Quiz `#63` wurden beide Kandidaten ausgeschlossen. Die Moderation zeigte die geforderte Warnung und deaktivierte den Abschluss. Die Auswahl blieb unverändert; es rückte niemand nach.

### H – Keine Einreichung

Bestanden. Quiz `#62` erzeugte keine leere Zufallsauswahl und keinen Fehler. Die Ansicht zeigte `0 gültige Einreichungen`; „Ohne Meme fortfahren“ schloss den Lauf ausdrücklich als `SKIPPED` ab.

### I – AP1-Regression

Bestanden. Timer und serverseitige Deadline liefen unverändert. In Quiz `#64` wurde ein Meme-Draft gespeichert, die Teilnehmerseite real neu geladen, beide Texte unverändert wiederhergestellt und danach verbindlich abgegeben. Nach Blockschluss erschien genau ein Kandidat und ließ sich regulär freigeben und abschließen. Die weiteren Abnahmequizze nutzten denselben bestehenden Teambeitritts-, Draft-, Submit- und Bestätigungsweg.

## Sicherheit und Browserbefund

Alle drei AP2-Server-Actions wiederholen die vorhandene `requireQuizLiveController`-Prüfung. Die Reviewoberfläche enthielt in der Browserprüfung keine Teamnamen, keine editierbaren Meme-Felder und keine anderen Submissions außerhalb der gespeicherten Auswahl.

Ein frischer Moderationstab protokolliert den bereits vor AP2 vorhandenen React-Hydrationhinweis `#418`. Ursache ist die bestehende zeitabhängige Initialisierung von `now` und `initialClockOffset` mit `Date.now()` im `ModerationClient`; diese Zeilen sind im AP2-Diff unverändert. React stellt die Seite wieder her, und alle AP2-Zustände und Aktionen funktionieren. Der Altbefund ist nicht Teil des AP2-Scopes und wurde daher nicht verändert.

## Restpunkte

AP3 beziehungsweise AP4 bleiben zuständig für Leinwandpräsentation, manuelles Durchschalten, Publikumskandidatennummern, Gesamtübersicht, Voting, Ausschluss der Selbstwahl, Stimmenauswertung, Gewinner, Punkte, Auflösungszeitpunkt und spätere Teamnamen-Auflösung.

## Abschluss

Alle AP2-Abnahmekriterien sind erfüllt. Die zufällige Auswahl wird genau einmal serverseitig erzeugt und danach stabil gespeichert. `main` und Production wurden nicht verändert; die additive Migration wurde ausschließlich auf Preview ausgeführt.
