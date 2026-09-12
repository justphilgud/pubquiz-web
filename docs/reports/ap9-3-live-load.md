# AP9.3 – Last- und Parallelitätstest

Stand: 13. September 2026. Dauerlauf und Abschlussgate beendet.
**AP9.3 vollständig abgenommen: Ja.** Die Kapazitätsfreigabe und ihre Grenzen
sind unten ausdrücklich festgehalten; keine uneingeschränkte Freigabe jeder Teamzahl.

## Geltungsbereich und Testaufbau

Geschützte Preview: https://pubquiz-qowmwx1ez-just-phil-gud.vercel.app
Produktcommit: `79a91d46beecd5b8ecb626d1e38d21cf11fb4625`.
[CI #185](https://github.com/justphilgud/pubquiz-web/actions/runs/34724141564)
und [Preview #191](https://github.com/justphilgud/pubquiz-web/actions/runs/34724207087)
erfolgreich. Production/main unverändert:
`1d4c703e068c0752a10757620d1f7fe03d47b20a`.
Keine Infrastruktur, Abhängigkeiten, fachlichen Fristen oder globalen Fragen
geändert. Testdaten ausschließlich in eigenen Preview-Quizzen 41, 42 und 43,
regulär über die Verwaltung angelegt und zurückgesetzt.

Playwright verwendet die bestehende reguläre Vercel-/Quiz-Anmeldung. Ein einziger
CDP-Steuerungskanal; Teilnehmer besitzen regulär ausgestellte Teamsitzungen.
APIRequestContext erzeugt Last über die echten Join-, Save- und Snapshot-Endpunkte.
Echte getrennte Moderations-/Präsentationsseiten laufen daneben. Kein Umgehen
oder Abschwächen des Preview-Schutzes. Sitzungstoken bleiben im Arbeitsspeicher.

Matrix jeweils 5/10/20/40 Teams: A = ein Teilnehmerclient, B = zwei Clients/Team.
Ein aktiver Schreiber je Team, zwei unabhängige Pollzustände im Reservemodell.
Polls überlappen nicht: 500 ms Abstand nach Abschluss, begrenzter Fehler-Backoff.
Die finale Matrix sendet wie der Browser bekannte Live-Revision/aktive Frage;
bedingte vollständige Snapshots nach Antwortänderungen sind eingeschlossen.
45 Sekunden Schreiben je Modell, Änderungen verteilt alle 2–5 Sekunden;
regulärer 60-Sekunden-Countdown, ca. 70 % Peak-Saves in den letzten drei Sekunden,
übrige nach Ablauf. Kein geänderter Test-Countdown im Produkt.

Quiz 41: vier Fragen pro Block (Text, Single Choice, Text, Reihenfolge).
Quiz 42: Pixel mit regulären Stufen 3 → 2 → 1 (20 s / 20 s / letzte Stufe offen).
Quiz 43: zwei Blöcke à vier Fragen, zusätzlich Single Choice und Zahl; 40 Teams /
80 synthetische Clients plus drei echte Browserteams und ein zweites Teamfenster:
insgesamt 43 Teams / 84 Teilnehmerclients, dazu Moderation/Präsentation.
Schreibbursts mit 2–5 s Abstand und 12–24 s Denkpausen im Dauerlauf.

Messung: Ende-zu-Ende-Latenzen, Nearest-Rank-Quantile, echte Serverzeitstempel,
HTTP-/Transportfehler, Retries, CAS-Konflikte, erneutes Lesen aller bestätigten
Inhalte und Revisionen. Ein späterer eigener erfolgreich gespeicherter Inhalt
ist kein Verlust seiner absichtlich ersetzten Vorgängerversion. Verlorene Responses
werden mit dem eigenen ausstehenden Inhalt abgeglichen. Fremde Änderungen dürfen
nicht still übernommen/überschrieben werden.

## Baseline vor Änderungen

Produkt `f403d3577c7b10edb04fc68dbd27a9f38bebb4ec`, Preview
https://pubquiz-kgc1d7ybv-just-phil-gud.vercel.app, Messreihe `baseline-v2`.
Save-Quantile dieser und der folgenden Haupttabelle: **erfolgreiche Bestätigungen**.

| Teams / Clients A–B | Join p50/p95/p99 ms | Save p50/p95/p99 ms | Snapshot p95 ms | 5xx | verlorene Bestätigungen |
| --- | --- | --- | --- | --- | --- |
| 5 / 5–10 | 247/330/330 | 157/293/846 | 207 | 0 | 0 |
| 10 / 10–20 | 287/1827/1827 | 191/1010/1443 | 352 | 0 | 0 |
| 20 / 20–40 | 442/1937/2012 | 614/1825/2079 | 1272 | 0 | 0 |
| 40 / 40–80 | 851/2567/2708 | 1813/3618/4581 | 3600 | 28 | 0 |

40 Teams: 20 Snapshot-500 und 8 Save-503, 8 Save-Retries, 28/6730 Requests =
0,416 % unerwartete HTTP-Fehler. Keine clientseitigen Timeouts in dieser Matrix.
Save: 678/714 Versuche bestätigt, 28 fachliche Deadlineablehnungen. Auch 16 der
28 vor Ablauf gestarteten Peak-Requests kamen nicht rechtzeitig zur Annahme.

Ein früher Vorlauf hatte einen zeitlich gebündelten Transportabbruch ohne
HTTP-Status. Zwei scheinbare Inhaltsabweichungen waren nachweislich neuere eigene
angenommene Saves mit verlorener Response, kein Datenverlust. Ein gleichzeitiger
Vercel-Logabruf endete ebenfalls mit ECONNRESET; genaue Transportursache offen.
Dieser Vorlauf ist separat dokumentiert und wird weder als fehlerfreie Baseline
noch als behobener Produktfehler ausgegeben. Die finalen Wiederholungen dienen
der Kapazitätsaussage.

## Nachgewiesene Ursachen und Korrekturen

1. `5dcb01f`: Jeder Live-Poll reservierte vorher eine Transaktion samt exklusivem
   Quiz-Lock, auch ohne abgelaufene Frist. Bei 80 Clients reproduziertes Prisma
   P2028 („Unable to start a transaction in the given time“). Frische lesende
   Fristvorprüfung vermeidet diese Reservierung bei nicht fälligen Fristen;
   bei Fälligkeit bleibt die bestehende gesperrte Transaktion maßgeblich.
   Saves prüfen die Deadline unverändert unter ihren bisherigen Sperren.
2. `46db857`: Ältere Fragen im offenen Block lösten bei Änderungen eines zweiten
   Fensters keinen vollständigen Teilnehmerrefresh aus. CAS schützte den Server,
   aber die Konfliktwahl konnte dauerhaft alten Inhalt als gespeichert anzeigen.
   Die Live-Revision umfasst nun alle eigenen Draft-Revisionen des Quiz/der
   signierten Sitzung. Light: ein begrenztes Aggregat; Full: vorhandene Antwortdaten.
3. `3e925f1`: Unter Last blieb noch die sofortige Konfliktwahl vor dem nächsten
   Poll falsch. REVISION_CONFLICT liefert nun den bereits unter Lock gelesenen
   eigenen aktuellen Draft samt Revision. Der bestehende Controller übernimmt
   den Vergleich sofort und schützt neuere bereits gepollte Revisionen.
   Keine zusätzliche Abfrage, kein neuer Lock und keine neue Zustandsmaschine.
4. `79a91d4`: Nach Reload einer nie angenommenen Antwort war der lokale Status
   „wiedergefunden“, obwohl die Frage nach Blockschluss nicht mehr verfügbar war.
   Der Server wies alle vier gehaltenen Requests korrekt ab. `pauseMissing`
   schließt jetzt auch wiederhergestellte, bereits nicht schreibbare Einträge.
   Eine eigene echte Bestätigung wird danach wie bisher abgeglichen. Eine
   Controller-Bedingung und eine Regression; keine Serveränderung. Der Lauf
   auf 3e925f1 wurde deshalb nach dem ersten Block nicht zur Dauerabnahme gezählt.

Die Oberfläche stellt weiterhin nur den Controllerzustand dar. Autorisierung,
CAS, Deadline, Finalisierung und Bewertung bleiben im bestehenden Service.
Keine neue Komponente oder prophylaktischer Umbau. Die zwei wegen falscher
Bestätigung abgebrochenen Dauerläufe (~13 bzw. ~5 Minuten) zählen nicht zur
Dauerabnahme. Sie bleiben als reproduzierbare Fehlerbelege erhalten.

## Matrix nach den Korrekturen

5/10 Teams wurden auf 3e925f1, 20/40 zusätzlich auf dem endgültigen 79a91d4
gemessen. Zwischen diesen Ständen änderte sich ausschließlich die lokale
Wiederaufnahme-Anzeige; die API-/Serverpfade sind identisch. Die folgenden
Zeilen verwenden jeweils die letzte abgeschlossene Messung.

| Teams / Clients A–B | Join p50/p95/p99 ms | Save p50/p95/p99 ms | Snapshot p95 ms | bestätigte Saves / Versuche | Snapshots erfolgreich |
| --- | --- | --- | --- | --- | --- |
| 5 / 5–10 | 1703/1999/1999 | 164/299/1088 | 178 | 130/131 | 2268/2268 |
| 10 / 10–20 | 265/2164/2164 | 164/367/885 | 163 | 259/262 | 4620/4620 |
| 20 / 20–40 | 1990/2632/2694 | 199/933/1295 | 182 | 497/508 | 9270/9270 |
| 40 / 40–80 | 749/1384/1687 | 416/1476/1816 | 141 | 938/950 | 19073/19073 |

Alle 75 Joins erfolgreich und innerhalb ihres jeweiligen Laufs unterschiedliche
Sitzungen. Je Stufe derselbe Join-Nachweis erneut eingelöst: identische Sitzung.
Matrix: 0 unerwartete HTTP-/Transportfehler, 0 Timeouts, 0 Retries,
0 ungeplante CAS-Konflikte, 0 verlorene Bestätigungen.
Mittlere API-Request-Raten über die gesamten Stufen: 14,6 / 29,0 / 56,7 / 114,3 pro s.
Die statische Kontrollanfrage `/favicon.ico` liefert erwartungsgemäß 404 und zählt
nicht als Produktfehler. Lokale Timerdrift und Generator-RSS werden separat erfasst.

Save-p95 einschließlich fachlicher Ablehnungen: 299 / 353 / 1002 / 1514 ms.
Vorher/nachher 40 Teams: Bestätigungs-p95 3618 → 1476 ms; Snapshot-p95
3600 → 141 ms; 28 → 0 HTTP-Fehler. Gleiche Clientzahlen und Schreibintervalle;
schnellere Polls erzeugen mehr erfolgreiche Requests. Die finale Messung umfasst
zusätzlich die jetzt realistisch angeforderten bedingten Full-Snapshots.

## Deadline und Blockschluss

| Teams | rechtzeitige Peakannahmen / vor Ablauf gestartete | nach Ablauf gestartete, alle abgewiesen | zusätzlich zu spät angekommene | Moderation 00:00 nach Frist ms | Präsentation 00:00 nach Frist ms |
| --- | --- | --- | --- | --- | --- |
| 5 | 4/4 | 1 | 0 | 643 | 869 |
| 10 | 7/7 | 3 | 0 | 719 | 190 |
| 20 | 9/14 | 6 | 5 | 624 | −40 |
| 40 | 28/28 | 12 | 0 | 338 | 767 |

Alle angenommenen Save-Zeitstempel liegen vor der Serverdeadline. Keine fachlich
verspätete Annahme. Lokaler Requeststart begründet keine Annahmegarantie.
Wiederholungen zeigen Laufzeitschwankungen: zuvor 20 Teams 14/14 angenommen,
40 Teams 16/28 (weitere zwölf zu spät angekommen). Die letzte 20-Team-Stufe
war die erste nach Bereitstellung. Sehr späte Änderungen besitzen auch bei
20 Teams keine Annahmegarantie; maßgeblich bleibt die echte Bestätigung.
Echte Reloads von Moderation/Präsentation erhielten dieselbe persistierte Frist;
nach Ablauf beide geschlossen/00:00. UI-Messauflösung etwa 100 ms;
−40 ms liegt innerhalb dieser Mess-/Uhrabgleichsunschärfe und ist keine
serverseitige Annahme oder Schließung vor der Frist.
Erste im Teilnehmer-Messstrom beobachtete geschlossene Serverantwort nach Frist:
563 / 500 / 694 / 865 ms. Das ist eine Beobachtungsgrenze, keine isolierte
Datenbank-Schließdauer; andere Clients können den Schluss vorher auslösen/sehen.
Die fachliche Annahmesperre gilt ab Deadline, Persistierung beim nächsten Zugriff.

## Browser-Störungen unter Reservelast

- Echter Join von Browser C: Server nimmt an, Playwright verwirft Response;
  Reload und erneuter Join verwenden denselben Nachweis und dieselbe Sitzung.
- Browser A offline und Save vor Versand gehalten: Server hat keinen Inhalt.
  Browser B: Save angekommen, Response verloren, Snapshotantworten blockiert.
  Vor Reconnect unterscheiden sich Serverzustände genau entsprechend.
- Nach 20 s Reconnect: beide aktuellen Inhalte korrekt bestätigt, jeweils Revision 1;
  tatsächlicher Reload erhält Inhalt und Bestätigung. Statusfolgen enthalten
  geändert, speichernd, Fehler und bestätigt; keine falsche Offlinebestätigung.
- Zwei Fenster desselben Teams: veralteter Save wird per CAS abgewiesen.
  Bei weiterhin blockiertem Poll zeigt die Konfliktantwort sofort den aktuellen
  Vergleich. Unmittelbare Serverwahl: Anzeige = Serverinhalt, Revision 2.
- Über den Blockschluss: B vor Deadline angenommen, Response verloren;
  nach Reconnect exakt derselbe Inhalt/Revision 2 bestätigt. C vor Versand
  gehalten, vier Requests erst nach Deadline freigegeben: alle abgewiesen,
  kein Draft vorher/nachher. Nach Reload ausdrücklich geschlossen/unbestätigt,
  keine lokale Übernahme angeboten. Im nächsten Block bleibt die alte Änderung
  ebenfalls geschlossen. Direkte Wiederholung mit der ursprünglichen lokalen
  Sicherung bestätigt denselben Zustand auch nach zwei Reloads.

## Pixel, Bewertung und Dauerlauf

Pixel 40 Teams: 109 bestätigte Saves / 149 Versuche, 40/40 nach bestätigtem
manuellem Schluss abgewiesen; 9291/9291 Snapshots, 0 Timeouts/5xx/Verluste.
Join p50/p95/p99 878/1471/1536 ms; bestätigte Saves 1030/2939/3392 ms,
Maximum 3556 ms. Frühere Wiederholung p95 3720 ms / Maximum 3925 ms.
Die kurzen gleichzeitigen Stufenschreibbursts überschreiten
2 s, ohne falsche Bestätigung oder Folgefehler. Letzte Stufe bleibt nach 25 s
weiterhin offen, bis regulär manuell geschlossen. Echte Teilnehmer-, Moderations-
und Präsentationsreloads erhalten Stufe/Deadline. Boundary-Saves werden nach
wirklicher serverseitiger Annahmestufe behandelt.

160 automatische finale Abgaben wurden zügig regulär mit 0,5 Punkten bewertet;
160/160 Teilpunkte nach echtem Reload erhalten. Erste Antwort anschließend
„Richtig“: Ergebnis einmal 2,5 und 39-mal 2 Punkte, alle 40 Teams vorhanden.
Bewertungsaktion unter parallelem 40-Team-Dauerlauf p50/p95/p99:
2672/2962/3729 ms. Sichtbare Bearbeitungszeit, keine verlorene Bewertung,
keine veralteten Ergebnisse, kein Navigationsabbruch.

Pixel regulär manuell „Richtig“ klassifiziert, nicht künstlich 3/2/1 Punkte
eingetragen: 13 Teams × 3, 13 × 2, 14 × 1 = 79 Punkte. Alle 40 nach Reload
korrekt; Ergebnisreihenfolge und Gesamtsumme stimmen. Bewertungs-p95 580 ms.
Der ununterbrochene finale Dauerlauf dauerte **31 Minuten 34 Sekunden**:
40 synthetische Teams / 80 Clients plus drei Browserteams / vier Fenster,
Moderation und Präsentation. 267362 API-Requests, im Messfenster rund 141/s.
40/40 Joins: p50/p95/p99 696/1348/1404 ms. 9619/9643 Saves bestätigt;
24 gezielt verspätete Saves korrekt abgewiesen. Bestätigungs-p50/p95/p99
175/626/1325 ms, Maximum 1897 ms. Einschließlich Ablehnungen: 176/662/1346 ms.
257677/257679 Snapshots erfolgreich, p50/p95/p99 66/129/759 ms.

Zwei spontane TCP-Abbrüche ausschließlich bei Snapshots (ECONNRESET um
23:39:30 und 23:41:30 UTC) ohne HTTP-Response: nächster Poll erfolgreich,
kein betroffener Save, keine falsche Bestätigung. Transportfehlerquote
2/267362 = 0,000748 %, keine 5xx, Timeouts oder Save-Retries. Die genaue
TCP-Ursache ist nicht zugeordnet; diese Beobachtung wird nicht als Nullfehlerlauf
oder als behobener Serverfehler dargestellt. Gezielte Browserfehler separat oben.

Beide regulären Blockdeadlines unverändert: 23:26:44.533 und 23:42:24.264 UTC.
Jeweils 28/28 rechtzeitige Peaks angenommen, 12/12 verspätete abgewiesen;
erste geschlossene Teilnehmerantwort nach 858 bzw. 935 ms beobachtet.
Null verlorene Bestätigungen, null fachlich verspätete Annahmen.
Alle 320 synthetischen finalen Antworten exakt mit den bestätigten Inhalten
verglichen. Zusätzlich alle 24 Antwortplätze der drei Browserteams geprüft:
drei erwartete Inhalte, 21 leere Plätze, insbesondere keine späte Antwort von C.
Alle 40 synthetischen Sitzungen weiterhin gültig, alle 43 Teams im Ergebnis.
Zweiter Block: echte Browserantwort gespeichert und nach Reload identisch;
die alte Antwort behält ihre Revision und ihren geschlossenen Zustand.

Bewertung, normale Reveal-Navigation und Endstand unter fortgesetzten Polls:
alle 43 Teamnamen und Punktwerte in Präsentation und Auswertung identisch,
keine Doppelwertung. Countdown-Stichprobe über drei Sekunden: Moderation
180 Frames, p95-Abstand 17,4 ms / Maximum 32,7 ms; Präsentation 181 Frames,
17,3 / 32,6 ms. Keine beobachteten Navigationsabbrüche oder zunehmenden Hänger.
**Visueller Nebenbefund:** Die Endstandstabelle mit 43 Teams ist bei 1280 × 720
stark zusammengedrängt und überlagert sich, obwohl alle Inhalte/Punkte korrekt
sind (`final-results.png`). Der technische Reservebereich ist deshalb keine
Freigabe dieser Darstellung für 43 Teams. Keine Designänderung innerhalb AP9.3.

Save-p95 je Fünf-Minuten-Fenster: 789 / 497 / 472 / 836 / 630 / 473 ms;
Rest ab Minute 30: 314 ms. Kein fortlaufender Latenzanstieg erkennbar.
Die Generator-Messspanne einschließlich Randrequests beträgt 1895,75 s;
die eigentliche Dauerlaufprüfung 1894,34 s. Ergebnis-Smoke danach separat
gespeichert und nicht zur Mindestlaufzeit hinzugerechnet.

## Server- und Datenbankbefunde

Baseline-Logfenster 21:09:00–21:09:16 UTC: 503 eindeutige Requests,
12 Fehlerzeilen mit P2028-Transaktionsreservierung. Statische Referenz p95 65 ms,
Generator-Timerdrift p95 12 ms: tatsächlicher Server-/Transaktionsengpass.
Keine nachgewiesenen Deadlocks oder Funktionsabstürze.

Finales 40-B-Fenster 23:07:43.590–23:07:51.590 UTC: 1227 eindeutige Requests,
0 Fehler, maximale Requestlaufzeit 865 ms, Funktionsspeicher max. 494 MB,
beobachtete Funktionsparallelität max. 7. Fünf-Minuten-Probe des Dauerlaufs:
1266 Requests in acht Sekunden, maximal 727 ms / 530 MB, 0 Fehler.
Weitere vollständig nach Log-Ingestion erhobene Acht-Sekunden-Proben:

| Laufminute | Requests | Requestmaximum ms | Speichermaximum MB | Parallelität max. | Fehler |
| --- | --- | --- | --- | --- | --- |
| 15 | 1089 | 817 | 545 | 10 | 0 |
| 25 | 1244 | 578 | 547 | 6 | 0 |
| 29 | 1263 | 307 | 528 | 4 | 0 |

Keine anhaltende Zunahme von Requestdauer oder Funktionsspeicher in diesen
Stichproben. Das begründet keine allgemeine Garantie gegen Speicherlecks.

In einer früheren Deadlineprobe wurde eine `pg`-DeprecationWarning zu parallelem
`client.query` als Error geloggt, aber der zugehörige Request war HTTP 200,
kein Crash/P2028. Keine Änderung daran im AP. Frühere Logauszüge hatten einen
zusätzlichen Seitenoffset und unterschätzten die Zeilenzahl. Finale Proben sind
mit Zeitcursor und konstantem page=0 vollständig neu erhoben; Request-Raten
der Lastmatrix stammen unabhängig davon aus allen Generatoranfragen.

Exakte PostgreSQL-Lockhalte-/Wartezeiten und Poolbelegung sind über die bestehende
Preview-Beobachtung nicht verfügbar. Sie werden nicht als „0 ms“ erfunden.
Prisma-Querysummen enthalten parallele Abfragen und sind keine isolierten
Lockzeiten. Request-/Funktionszeiten, P2028 und Deadlock-/Crashmeldungen dienen
als beobachtbare Indikatoren. Keine neuen Messdienste oder Infrastruktur angelegt.
Lokaler Generator-RSS wächst auch durch absichtlich aufbewahrte Messdaten und
alte Läufe; das ist kein Nachweis eines Serverspeicherlecks.

## Regression, Nachweise und Grenzen

Geänderte Produktdateien gegenüber dem AP9.2-Stand:

| Datei | Verantwortung |
| --- | --- |
| `app/quiz/interaction/interaction.server.ts` | Fristvorprüfung, eigene Live-Revision, atomarer Konfliktvergleich |
| `app/quiz/actions.ts` | passende Revision im vollständigen Teilnehmerstatus |
| `app/quiz/[quizId]/antworten/QuizAntwortClient.tsx` | Konfliktinhalt aus dem vorhandenen Transport abbilden |
| `app/quiz/interaction/answerDraftController.ts` | sofortiger aktueller Vergleich, geschlossene Wiederaufnahme |
| `app/quiz/blockCountdown.test.ts` | parallele Reads und eigener Run-Konfliktinhalt |
| `app/quiz/interaction/participantRecovery.test.ts` | vollständige und leichte eigene Antwortrevisionen |
| `app/quiz/interaction/answerDraftController.test.ts` | Konfliktreihenfolge und nie angenommene lokale Kopie |

Zusätzlich ausschließlich AP9.3-Testskripte und dieser Abnahmebericht.

Produktprüfung nach letzter Korrektur: vollständige Suite 1131/1131;
TypeScript, ESLint, Prisma validate und Next-Build erfolgreich.
Drei neue Regressionen zum unmittelbaren Konfliktvergleich sowie zuvor
80 parallele Fristleser und sitzungsgebundene Antwortrevisionen. AP9.1/AP9.2,
Pixel, Submission und Bewertung in vollständiger Suite enthalten.
Finale Wiederholung nach Dauerlauf ebenfalls erfolgreich: 1131/1131 Produkttests
(436 + 508 + 11 + 176), 6/6 Generator-/Logsammlertests, TypeScript, ESLint für
alle geänderten Produktdateien und AP9.3-Skripte, Prisma validate und Next-Build.
Die letzte Korrektur enthält außerdem die Regression für die geschlossene lokale
Wiederaufnahme. Alle Prüfungen Exit 0; keine neuen offenen Produktkorrekturen.

Lokaler Build verwendet CI-Konfiguration mit unbenutzter localhost-Dummy-DB;
Google Fonts benötigen Netzfreigabe. Bestehende Next-Worktree-Root-Warnung und
GitHub-Actions-Node20-Deprecation unverändert. Kein Produktionsbuild veröffentlicht.
Die überlange Test-Pixelfrage verwendet die vorhandene scrollbare Darstellung;
kein Designumbau innerhalb dieses AP.

Skripte: `scripts/ap9-3-{load,browser,pixel,soak,evaluation,server-logs,final,summarize}.mjs`
und sechs Generator-/Logsammler-Prüfungen in `scripts/ap9-3-load.test.mjs`.
`ap9-3-final.mjs` verwendet die bestehende authentifizierte Playwright-Sitzung;
es startet keinen zweiten Browsercontroller und beschafft keine Zugangsdaten.
Rohbelege lokal unter
`C:/Users/gudel/.codex/visualizations/2026/09/11/01a08f64-96fb-7e62-9f96-5c7f014eb61e/ap93-evidence/`:
`baseline-v2`, `after-5dcb01f`, `final-46db857`, `final-3e925f1`, `final-79a91d4`.
Kompakte Dauerlaufmetriken zusätzlich in `docs/reports/ap9-3-metrics.json`.
Finale Belege: `soak-complete.json`, `browser-under-load.json`,
`browser-deadline.json`, `evaluation-40.json`, `pixel-scoring.json`,
`final-submission-content.json`, `soak-final-content.json`,
`result-presentation.json`, `animations.json`, `server-*.json`,
`tests-final.txt`, `validation.json`, `build-final.txt`.
Ungültige frühe Logpaginierung (Duplikate) und absichtlich abgebrochene Läufe sind
keine finalen Abnahmebelege. Korrigierter Sammler dedupliziert Request-IDs und
verschiebt die Zeitgrenze. Generator behandelt eigene angenommene Antworten mit
verlorener Response gesondert; keinerlei stilles Konfliktüberschreiben.

## Verbindliche Kapazitätsempfehlung für diese Abnahme

Sicherer technischer Planungsbereich: bis 20 Teams /
40 Teilnehmerclients; geprüfte Reserve 40 / 80 mit spürbarer Konkurrenz in den
letzten Sekunden und Pixel-Bursts um 4 s. Über 40 Teams nicht getestet und für
den ersten Abend nicht empfohlen. Für den 21.10.2026 konservativ 20 Teams.
Diese Aussage gilt für die getesteten vier Fragen je Block und acht Fragen im
Dauerlauf, bestehende Preview-Infrastruktur und vergleichbare Netzbedingungen;
keine Garantie für beliebig große Blöcke oder Veranstaltungs-WLAN.
Die 43-Team-Endstandsdarstellung ist visuell eingeschränkt (siehe oben).
Die Teamzahl-Empfehlung ist eine technische Lastfreigabe, keine Zusage für die
Lesbarkeit jeder Ergebnisdarstellung auf jeder Projektionsauflösung.
Production/main abschließend read-only unverändert verifiziert; Production-Workflow
für den Produktcommit übersprungen. Preview-Branch verweist auf `79a91d4`.
Testlast und Quiz-Browserseiten beendet. Keine weiteren Produktänderungen.
