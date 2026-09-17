# AP9.1 – Antwortintegrität und Wiederaufnahme

Stand: 12. September 2026. **AP9.1 vollständig abgenommen – einschließlich gezielter Netzwerkfehler.**
Keine Production-Änderungen durch diesen AP.

## Nachgewiesene Ursachen

- **R01:** Der bisherige Status prüfte nur, ob irgendwann eine Draft-Revision
  vorhanden war. Ein neuer lokaler Wert konnte damit neben „gespeichert“ stehen,
  obwohl der 1.200-ms-Autosave noch ausstand. Eine lokale Wiederaufnahmekopie fehlte.
- **R02:** Polling konnte eine neue Serverrevision übernehmen und gleichzeitig den
  älteren lokalen Inhalt behalten. Der folgende CAS-Write erhielt dadurch eine
  fremde aktuelle Basis und konnte unbemerkt überschreiben. Der Server-CAS selbst
  war korrekt; der Client verband Inhalt und Basis falsch.
- **R06:** Join ohne catch/finally konnte im Pending bleiben. War die Teamanlage
  erfolgreich und ihre Antwort verloren, fehlte das erzeugte Passwort für einen
  erneuten Versuch. Save-Fehler wurden nicht zuverlässig und begrenzt wiederholt.
- **Zusätzlicher AP9-Randfall:** Inhaltsgleiche normalisierte Antworten liefern
  dieselbe Revision. Die Bestätigung muss den tatsächlichen gespeicherten Text
  zurückgeben, damit etwa BERLIN nicht bestätigt erscheint und beim Reload zu
  Berlin wechselt.
- **In der Browserabnahme gefunden:** Eine bereits bestätigte lokale Sicherung
  konnte nach späterem Gerätewechsel erneut als Konflikt auftauchen. Durch
  gezielte Bereinigung bestätigter Sicherungen und fensterbezogene Erledigtvermerke
  behoben und mit eigenem Regressionstest abgesichert.

## Umsetzung und Architektur

`QuizAntwortClient` behält Darstellung, Moderations-/Pixelstatus und bestehende
Abgabeaktionen. Die neue reine `AnswerDraftController`-Klasse verantwortet nur
Entwurfszustand, Debounce, begrenzte Wiederholung und Konfliktentscheidungen.
Der Hook bindet React, Browserspeicher und Browserereignisse an. Die bestehenden
serverseitigen Interaktions-, Submission-, Pixel- und Bewertungsregeln bleiben
maßgeblich; es wurde keine neue Submission-Engine eingeführt.

Jeder Entwurf hat lokalen Änderungszähler, Serverbasis, zuletzt bestätigten Inhalt,
Run und Schreibberechtigung. Polling darf eine lokal geänderte Basis nicht mit
fremdem Inhalt weiterschieben. Bei Konflikten werden beide Varianten gezeigt;
Weiterarbeiten erfordert eine bewusste Auswahl. Auch danach gilt CAS bei jedem Save.
Ein alter Request bestätigt keine zwischenzeitliche neue Eingabe.

Status: geändert / speichernd / bestätigt / Fehler / Konflikt / wiedergefunden /
geschlossen. Der HTTP-Transport hat 12 Sekunden Timeout. Pro Frage läuft höchstens
ein Save, mit drei automatischen Retries nach 2/5/10 Sekunden. Danach manuell oder
bei Rückkehr der Verbindung. Mehrere Änderungen während eines Requests bleiben
lokal geändert. Ein Timeout ist ausdrücklich kein Beweis einer Serverablehnung.

Unbestätigte Werte werden synchron im Browser geschützt, getrennt nach Quiz,
Teamsitzung und Client. Reload benötigt einen frischen Serverstand und eine
bewusste Übernahme, sofern der Server den Inhalt nicht ohnehin bestätigt. Die
Wiederaufnahme sendet nichts heimlich ab. Bei gesperrter Antwort bleibt die lokale
Variante als unbestätigt sichtbar und kann nicht nachträglich übernommen werden.
Bestätigte Antworten kommen beim Gerätewechsel vom Server; die vorhandene
Passwortanmeldung bleibt erhalten.

Beim Erstbeitritt schützt eine zufällige, vor dem Request gespeicherte UUID den
Retry nach verlorener Antwort. In derselben Transaktion wie die neue Sitzung
entsteht ihr SHA-256-Nachweis. Er ist an Quiz und Team gebunden und gilt höchstens
24 Stunden. Ein fremder Nachweis authentifiziert nicht. Die additive Migration
`20260911120000_team_join_recovery` ergänzt ausschließlich eine nullable Spalte.

## Automatisierte Nachweise

- Erste Controller-Tests vor Implementation rot (fehlendes Modul), danach grün.
- Join-Responseverlust gegen echten Service mit kontrollierter Transaktion zuerst
  rot beim erneuten Beitritt ohne Passwort, nach Korrektur grün.
- Lokale Eingabe während laufendem Save, schnelle Änderungen, begrenzte Retries,
  verlorene Save-Antwort, veraltete Polls und verspätete Bestätigung.
- Explizit A auf N geändert → B auf N+1 gespeichert → A pollt N+1 → kein stilles
  Überschreiben; bewusste Konfliktauflösung und normaler Gerätewechsel.
- Reload alter bestätigter/neuer unbestätigter Inhalt; keine Wiederbelebung bereits
  bestätigter Sicherungen; fremde Fenster behalten unbestätigte Kopien.
- Fehlender Request, abgebrochene Response, hängender Response-Body, 401 und
  begrenzte Server-Action-Wartezeit.
- Echter Save-Funktionskörper mit kontrollierter Transaktion/Uhr: −10.000 ms,
  −1 ms, exakt 0 ms, +1 ms und +5.000 ms zur Deadline; ab Deadline kein Write,
  auch nicht beim Retry. Die Zeit wird weiterhin nach den Serverlocks bestimmt.
- Bestehende Pixel-, Lifecycle-, Submission-, Ergebnis- und Bewertungsregression
  vollständig erhalten.

Lokale Gesamtsuite: **1.113 bestanden** (418 + 508 + 11 + 176).
TypeScript, repositoryweiter ESLint und Produktionsbuild grün. Der erste lokale
Build benötigte erlaubten Netzwerkzugriff für bestehende Google Fonts; keine
Produktänderung dafür. Build nur mit synthetischen lokalen Umgebungswerten.
Keine neuen Abhängigkeiten.

## Preview und Browserabnahme

Ausgangsstand Main/Preview: `1d4c703e068c0752a10757620d1f7fe03d47b20a`.
Erstes AP9-Deployment: `a641cb359027e3f5e9837a3daf2dbc227a59f355`,
<https://pubquiz-nbasmi8gl-just-phil-gud.vercel.app>.
GitHub-CI 34584357976 und Preview-Deploy 34584522763 erfolgreich.
Finale Runtime-Korrektur: `49b6ca7d70ed7c8ae909c0da5b2e83aaa27843b0`.
GitHub-CI [34585833398](https://github.com/justphilgud/pubquiz-web/actions/runs/34585833398)
und Preview-Deploy [34585975363](https://github.com/justphilgud/pubquiz-web/actions/runs/34585975363)
erfolgreich. Finales Preview:
[pubquiz-4i9pnc3vh](https://pubquiz-4i9pnc3vh-just-phil-gud.vercel.app).
GitHub-Deployment 6390637739 bestätigt exakt Runtime-Commit `49b6ca7`.
Der zweite, nicht zutreffende Deployment-Workflow 34586042614 wurde übersprungen.

Eigene Preview-Testdaten: Quiz 35 „Codex AP9 Antwortintegrität 2026-09-11“
(Kopie von 22) und Quiz 36 „Codex AP9 Pixel 2026-09-11“ (Kopie von 23).
Vorlagen wurden nicht verändert; keine Medienänderungen.

Historischer Zwischenstand vor der ergänzenden Netzwerkfreigabe; offene E/F-Fälle wurden unten abgeschlossen.

| Fall | Bisheriger Browsernachweis |
| --- | --- |
| A – normal | Erstes Deployment: Berlin bestätigt und nach Reload identisch. Finaler Commit: Leipzig nach Gerätewechsel geladen; Hannover nach Sofort-Reload bestätigt. |
| B – letzte Änderung | Hamburg vor Reload als geändert angezeigt; pagehide-Save angenommen und anschließend auf beiden Clients bestätigt. Auf finalem Commit mit Hannover wiederholt. Das simuliert keine längere Offlinephase. |
| C – zwei Clients | Erstes Deployment: Köln/Bremen parallel, Köln bestätigt und Bremen sichtbar im Konflikt mit beiden Varianten. Auf finalem Commit waren weitere Browseränderungen zeitlich nacheinander erfolgreich; der deterministische Konfliktregressionstest ist dort grün. |
| D – Gerätewechsel | Zwei Origins mit Passwortanmeldung. Finaler Commit: Hannover auf A bestätigt, Dresden auf B gespeichert, A erneut geladen: Dresden bestätigt und kein Alt-Konflikt. |
| E – Netzunterbrechung | Vollständige instrumentierte Browserprüfung noch offen; automatisierte Transport-/Retrytests grün. |
| F – Blockschluss | Finaler Commit: manuell geschlossen; Formular nach Reload weiterhin geschlossen. Der letzte Eingabeversuch konnte im Browser nicht deterministisch nach der Grenze gehalten werden. Offline-/Responseverlust über den Blockschluss daher noch offen; Servergrenzen automatisiert grün. |
| Pixel | Stop ausgelöst und während laufender Anfrage neu geladen; Antwort danach verbindlich gesperrt. Stufenwechsel 3→2 und Reload im laufenden Countdown mit erhaltener Antwort. Stufe 1 über sechs Minuten offen beobachtet. Auf finalem Commit „Finale Pixelantwort“ gespeichert, manuell geschlossen und in Auswertung als automatisch finalisierte Abgabe bestätigt. Nach Reload geschlossen. |

Zusätzlich auf finalem Commit: neues Team „AP9 Join Wiederaufnahme“ beigetreten
und nach Reload wieder angemeldet. Die Antwort war bereits vor dem Reload
angekommen; dies wird ausdrücklich nicht als Lost-Response-Nachweis gewertet.
Keine Fehler in der abschließend geprüften Browserkonsole von Teilnehmer B.

Letzte Remote-Prüfung: Main unverändert auf `1d4c703e068c0752a10757620d1f7fe03d47b20a`,
Preview auf `49b6ca7d70ed7c8ae909c0da5b2e83aaa27843b0`. Keine Production-Veröffentlichung.

Der lokale Fehlersimulator wird korrekt von Vercels Preview-Anmeldung abgefangen.
Die verfügbare Browsersteuerung bietet keine Offline-/Request-Interception. Eine
zusätzliche Playwright-Netzwerksteuerung wurde angefragt; die Browserwerkzeug-Regel
verlangt dafür einen ausdrücklichen Nutzerwunsch. Die Preview-Schutzkonfiguration
wurde nicht abgeschwächt. Der lokale Simulator wurde beendet.

## Geänderte Dateien

### Ergänzende Netzwerkabnahme vom 12. September

Der Nutzer hat zusätzliche Playwright-Netzwerksteuerung ausdrücklich freigegeben.
Die geschützte Preview wurde im dedizierten Chrome-Testbrowser regulär angemeldet;
die Schutzkonfiguration blieb unverändert. Eigene Testkopien: Quiz 37
„Codex AP9 Netzwerkabnahme 2026-09-12“, Quiz 38 „Codex AP9 Netzwerk Regression
2026-09-12“, Quiz 39 „Codex AP9 Countdown Regression 2026-09-12“.

Auf `49b6ca7` deterministisch nachgewiesen:

- Save vor Serverkontakt abgebrochen und normale Teilnehmer-Snapshots blockiert:
  „Netz Basis“, Revision 1, bleibt serverseitig unverändert. Client zeigt geändert,
  speichernd und Fehler. Reconnect bestätigt „Offline vor Schluss“, Revision 2.
- Save via `route.fetch()` tatsächlich angenommen, Response 14 Sekunden
  zurückgehalten und verworfen: Server bestätigt „Responseverlust vor Schluss“,
  Revision 3; Client zeigt nach seinem 12-Sekunden-Timeout Fehler. Reconnect
  bestätigt denselben Inhalt ohne neue Revision.
- Join tatsächlich angenommen, Response verworfen, Reload und erneuter Beitritt:
  dieselbe `quiz_team_session_id`, derselbe Teamname und dasselbe erzeugte Passwort.
  Der signierte Sessiontoken wird neu ausgestellt. Kein zweites Team entsteht.
- Zwei Antworten während blockierter Snapshots: Frage 128 nimmt „Angenommen vor
  Deadline“ als Revision 4 an (10:48:51.630 UTC); Frage 129 erhält die lokale
  Änderung „NICHT rechtzeitig angenommen“ nie. Dort bleibt „Zweite rechtzeitig
  bestätigt“, Revision 1 (10:48:50.118 UTC).
- Regulärer einminütiger Pausen-Countdown löst über die vorhandene Moderation
  `handleBlockSchliessen()` aus. Dies ist der bestehende automatische Blockschluss,
  kein künstlich gesetzter Run-Deadline-Zeitstempel. Danach sind beide verspäteten
  Save-Retries mit `LIVE_STATE_CHANGED` abgelehnt (10:50:36 UTC).
- Auswertung bestätigt ausschließlich die rechtzeitigen Inhalte als automatisch
  finalisierte Abgaben. Die nicht zugestellte Änderung wurde nicht finalisiert.

**Reproduzierter Fehler:** Der geschlossene vollständige Snapshot enthielt
`fragen: []` und damit keinen bestätigten Antwortinhalt mehr. Die rechtzeitig
angenommene Antwort blieb im Client fälschlich unbestätigt; „Zuletzt bestätigt“
zeigte noch Revision 3. Der Schreibschutz selbst war korrekt.

Minimale Korrektur: `answerConfirmations` liefert im bestehenden autorisierten
Snapshot eigene gespeicherte Inhalte auch ohne sichtbares Formular. Der bestehende
Controller gleicht nur bekannte, nicht sichtbare Einträge desselben Runs ab und
erteilt keine Schreibrechte. Ein später abgelehnter alter Retry entwertet eine
zwischenzeitliche Bestätigung nicht mehr. Die vorhandene Statuskomponente zeigt
den bestätigten Inhalt. Keine neue Route, Migration, Dependency oder Engine.

Korrekturcommit: `0beb76d5b1481dc9ad6e832ed515cce4c2f35f98`.
Lokale vollständige Regression: **1.114 Tests** (419 + 508 + 11 + 176),
TypeScript, vollständiger ESLint und Produktionsbuild erfolgreich.
CI [34689996701](https://github.com/justphilgud/pubquiz-web/actions/runs/34689996701)
erfolgreich. Deployment 6408926331 bestätigt diesen Commit auf
[pubquiz-bxbj44dy6](https://pubquiz-bxbj44dy6-just-phil-gud.vercel.app).
Der Regressionstest führt den echten Snapshot-Funktionskörper aus und prüft
Team-/Quiz-Isolation, bestätigte vs. unbestätigte Inhalte nach Schluss, Reload,
fremde Runs sowie eine spät abgelehnte Save-Anfrage nach Snapshot-Bestätigung.

Die abschließende Browserwiederholung auf genau dieser Preview ist erfolgreich:

| Szenario | Tatsächlicher Nachweis auf `0beb76d` |
| --- | --- |
| Join-Responseverlust | Server legt das Team an; Response gezielt verworfen. Reload und Retry liefern dieselbe Team-Session und dasselbe Passwort, kein Duplikat (Beleg 34). |
| Unterbrechung vor Serverkontakt, Reconnect im offenen Block | Server behält Revision 1; Client zeigt geändert → speichernd → Fehler. Reconnect speichert den lokalen Inhalt als Revision 2 (35). |
| Angenommener Save, verlorene Response, Reconnect im offenen Block | Server speichert Revision 3; Client kann zunächst nicht bestätigen. Reconnect bestätigt dieselbe Revision ohne zusätzlichen Write (35). |
| Beide Fehler über manuellen Blockschluss | Frage 130: angenommene Revision 4 vom 12.09., 11:19:35.654 UTC bleibt verbindlich. Frage 131: nicht zugestellte Änderung bleibt lokal, serverseitig ausschließlich Basis B, Revision 1. Beide späten Retries werden mit LIVE_STATE_CHANGED abgelehnt. Snapshot bestätigt A grün und zeigt B geschlossen mit lokalem und zuletzt bestätigtem Inhalt (39). |
| Reload nach Blockschluss | A bleibt ohne alten Fehler; B bleibt als nicht gespeicherte lokale Änderung geschlossen. Auswertung finalisiert ausschließlich rechtzeitige Inhalte (40). |
| Beide Fehler über natürliche Pixel-Challenge-Deadline | Quiz 40, Frage 134, Run 470: A erreicht den Server noch OPEN, Revision 2, 11:34:04.881 UTC. Response geht verloren. B erreicht ihn nicht; Basis B bleibt Revision 1. Die unveränderte natürliche Stufenfrist beendet den Run serverseitig mit CLOSED; A Revision 2 und ausschließlich Bs Basis werden AUTO_FINALIZED (47). |
| Reconnect nach Pixel-Deadline | Tatsächliche Save-Retries beider Clients werden um 11:39:05 UTC mit LIVE_STATE_CHANGED abgewiesen. Sobald Snapshots wieder erreichbar sind, zeigt A bestätigt und B geschlossen/unbestätigt. Revisionen und Finalisierungsversion 1 bleiben unverändert (48–49). |
| Reload nach Pixel-Deadline | A weiter bestätigt, B weiter geschlossen mit lokaler verworfener Änderung und Basis B. Kein nachträglicher Save, keine Finalisierung des verspäteten Inhalts (50). |

Alle fünf Statuswerte `dirty`, `saving`, `saved`, `error`, `closed` wurden im
Browser aufgezeichnet. „Geschlossen“ während noch blockierter Snapshots behauptet
keinen Datenverlust: Es sagt ausdrücklich, dass die Änderung noch nicht bestätigt
ist. Nach Wiederaufnahme bestätigt der autorisierte Snapshot den tatsächlichen Stand.
Die Moderationsauswertung bestätigt die gleichen automatisch finalisierten Inhalte.
Die separate Punkteberechnung war noch ausstehend; sie ist kein Nachweisziel dieses AP.

Die natürliche Pixel-Deadline wurde weder umgeschrieben noch künstlich verkürzt.
`deadline_at` bleibt bei diesem ungestoppten Challenge-Run null; fachlich gilt
`opened_at` plus die vorhandenen drei Stufendauern (`pixelAnswerDeadline`). Der
Browsernachweis beobachtet OPEN vor und CLOSED nach dieser Grenze. Eine
millisekundengenaue Browserzustellung wird nicht behauptet. Die vollständige
Regression prüft den echten Save-Funktionskörper zusätzlich bei −10 s, −1 ms,
exakt 0, +1 ms und +5 s: ab der Grenze kein Write, auch nicht bei Retry.

**Separater offener Nebenbefund:** Bei Quiz 39 erreichte der einminütige
Pausen-Präsentationscountdown null und zeigte eine Schließmeldung, während der
Serverblock noch OPEN blieb. Dieser Versuch zählt ausdrücklich nicht als
bestandener Deadline-Nachweis. Schließen aus dem Fragekontext funktionierte;
der Testblock wurde so geschlossen. Ursache und allgemeine Moderations-/Countdown-
Logik wurden außerhalb des AP9.1-Auftrags nicht verändert. Die Antwortintegrität
an einem tatsächlichen serverseitigen Schluss und einer tatsächlichen Deadline
ist durch die oben getrennten Fälle belegt. Dies ist keine allgemeine Releasefreigabe.

Ergebnis: **AP9.1 vollständig abgenommen.** Kein weiterer Produktfehler in der
abschließenden Wiederholung, daher keine weiteren Produktänderungen.
Lokale Belege: `ap9-evidence/result-34.json`, `35`, `39`, `40`, `47` bis `50`
(jeweils `result-<Nummer>.json`), Screenshots `final-manual-close.png`,
`final-pixel-A.png` und `final-pixel-B.png` im Codex-Artefaktverzeichnis.
Die Laufzeit auf Preview entspricht `0beb76d`; dieser Abschlussbericht wird
anschließend separat versioniert.
Ein Testwerkzeugproblem (zwei CDP-Verbindungen behandeln denselben
Verlassen-Dialog) wurde durch einen einzigen besitzenden Playwright-Prozess
beseitigt; unvollständige Werkzeugläufe gelten nicht als Abnahmebeleg.

### Dateien des gesamten AP9.1

- `app/quiz/[quizId]/antworten/QuizAntwortClient.tsx`, `AnswerSaveStatus.tsx`
- `app/quiz/interaction/answerDraftController.ts`, `useAnswerDrafts.ts`,
  `draftJournal.ts`, `participantRequest.ts`
- `app/quiz/interaction/answerDraftController.test.ts`, `participantRecovery.test.ts`,
  angepasster Transportvertrag in `interactionArchitecture.test.ts`
- `app/api/quiz/team-answer-draft/route.ts`, `app/api/quiz/team-session/route.ts`, `proxy.ts`
- `app/quiz/actions.ts`, `app/quiz/interaction/interaction.server.ts`
- `app/teams/teamSession.server.ts`, `teamJoinRecovery.test.ts`
- `prisma/schema.prisma`, additive Migration und generierte Prisma-Typen
- `package.json`, `docs/architecture/answer-interaction.md`, dieser Bericht

## Getrennte Grenzen und Nebenbefunde

Keine Arbeit an Backup/Restore, Medienisolation, allgemeiner Countdown-Engine,
Lasttest, Runbook, Generalprobe oder neuen Templates. Diese Punkte bleiben gemäß
Auftrag außerhalb AP9. Browserereignisse garantieren beim Schließen keine
Netzübertragung; deshalb lokale Sicherung und wahrheitsgemäßer Status. Ein
Browserspeicher-Ausfall wird gemeldet. Kein physischer Gerätesperren-Test behauptet.
