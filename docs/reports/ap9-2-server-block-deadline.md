# AP9.2 – Serververbindlicher Blockschluss

Stand: 12. September 2026. Implementierung und Preview geprüft; ein Browserfall
wartet auf externe Anmeldung. Production unverändert.

## Reproduktion vor der Korrektur

Ausgangscommit `0beb76d5b1481dc9ad6e832ed515cce4c2f35f98`, geschützte Preview
`https://pubquiz-bxbj44dy6-just-phil-gud.vercel.app`, eigenes Testquiz 39.
Moderation startet auf Pausefolie 10 einen regulären einminütigen Countdown.
Fenster bei 00:52 geschlossen, keine weitere Moderation für dieses Quiz geöffnet.
Leinwand neu geöffnet: 00:00. Teilnehmer speichert danach erfolgreich
„AP92 Leinwand 00:00 aber Server offen“, Revision 3, serverseitig
2026-09-12T12:19:35.255Z; Snapshot weiterhin OPEN und Block nicht gesperrt.
Lokaler Beleg `ap92-evidence/result-4.json`. Keine Deadline künstlich manipuliert.

## Technische Ursache

`starteCountdown` schrieb nur Dauer, Start und Status der Präsentation.
Keine allgemeine Antwortdeadline war mit dem Block verbunden. Save prüfte zwar
Run-/Blockfreigabe korrekt, konnte daraus aber keinen abgelaufenen allgemeinen
Countdown erkennen. Ein Moderations-Effect sollte am Ende Blockschluss und
Countdown-Ende getrennt aufrufen; beim Schließen/Reload/Netzverlust fehlt dieser
Effect. Auf einer Ablauf-Pause fehlt außerdem `aktuellerSlide.abschnitt`, sodass
`handleBlockSchliessen` ohne Aktion zurückkehrte. Zusätzlich zeigte ein zweiter
Effect nach bloßer Folien-Verweildauer bereits die Abschlussmeldung. Die Renderer
setzten bei `finished` die Anzeige wieder auf die Ausgangsdauer.

Pixel verwendet dagegen bereits serverseitige Run-/Stufenfristen. Diese
Speziallogik ist nicht die Ursache und wird nicht vereinheitlicht.

## Umsetzung

Eine nullable Blockdeadline (additive Migration) und der bestehende transaktionale
Interaction-/Finalisierungspfad. Lazy Enforcement auf autorisierten Reads sowie
Writes, unveränderte Lockreihenfolge Quiz → Run → Draft. Kein Hintergrunddienst.
Serverzeit >= Deadline ist geschlossen. Wiederholtes Starten und Reload verlängern
nicht; Navigation erhält die Blockfrist. Reset nach Ablauf öffnet nicht wieder.
Details und Verantwortlichkeiten: `docs/architecture/answer-interaction.md`, AP9.2.

Die Moderation behält Bedienung/Anzeige, übernimmt den Serverstart und wartet für
die Abschlussmeldung auf den bestätigten Serverstatus. Manueller Schluss auf
Pause nutzt die vom Server gemeldete Block-ID. Die Renderer zeigen nach Ende 00:00.
AP9.1-Controller und Pixel-Engine wurden nicht umgebaut.

## Automatisierte Prüfungen

Alle 1.125 Tests bestanden (430 + 508 + 11 + 176), keine Fehler oder übersprungenen
Tests. Die elf neuen Countdown-Tests prüfen den bestehenden Servicepfad inklusive
Schreibzugriff, finalisiertem Inhalt, verlorener/später Antwort, Reset,
Navigation und serialisierten konkurrierenden Zugriffen. Exakte Grenzen werden
mit Serverzeit eine Millisekunde vor, exakt an und eine Millisekunde nach der
Deadline geprüft. Ab Deadline gilt geschlossen; ein späterer Retry kann keine
neue Revision annehmen. Browsermessungen ersetzen diese Millisekundentests nicht.

AP9.1- und bestehende Pixeltests vollständig grün. TypeScript, vollständiger
ESLint-Lauf, Prisma-Validierung und lokaler Production-Build grün. CI-Lauf
34694448598 ebenfalls erfolgreich für den unten genannten Produktcommit.

## Browserabnahme auf der neuen Preview

Eigene Testquizze 39 (allgemeiner Block) und 36 (Pixel). Reguläre einminütige
Blockcountdowns und konfigurierte Pixelphasen; keine künstliche Änderung von
Deadline oder Serveruhr. Netzwerkfehler ausschließlich über autorisiertes
Playwright-Routing im separaten Chrome-Testbrowser.

| Fall | Ergebnis und tatsächliches Verhalten |
| --- | --- |
| A – normaler Blockschluss | Bestanden. Deadline 12:50:37.989Z. Rechtzeitige Antwort Revision 2 bleibt erhalten; späterer Save `LIVE_STATE_CHANGED`. Block LOCKED/geschlossen, Moderation und Leinwand 00:00. Auswertung finalisiert ausschließlich den rechtzeitigen Inhalt. |
| B – Moderation schließen | Bestanden. Vor Deadline 12:53:34.163Z alle Steuerfenster für Quiz 39 geschlossen. Erster späterer Zugriff setzt Schluss serverseitig durch; kein verspäteter Save angenommen. Neu geöffnete Moderation und Präsentation sofort beendet/00:00. |
| C – Moderation neu initialisieren | Bestanden durch Schließen und Öffnen eines neuen vollständigen Browserdokuments während des Countdowns (kein bloßer Komponentenwechsel). Originaldeadline unverändert, zuletzt um 12:53:26.599Z geprüft. Ein zusätzlicher wörtlicher F5-/Playwright-reload-Lauf ist nicht separat erfolgt. |
| D – Moderationsclient offline | Offen: gezieltes Playwright-Offline für einen angemeldeten Moderationsclient nicht ausgeführt. Im separaten Chrome ist Vercel angemeldet, aber die Quizverwaltung zeigt weiterhin ihr E-Mail-/Passwort-Login. Die bereits angefragte reguläre Anmeldung ist noch erforderlich. Anmeldung im Codex-Browser überträgt sich nicht automatisch. |
| E – rechtzeitig akzeptiert, Response verloren | Bestanden. Save um 12:52:57.141Z serverseitig angenommen (Revision 2), Response zurückgehalten und nach Deadline verworfen. Reconnect bestätigt exakt diesen Inhalt; Reload und Auswertung erhalten ihn. |
| F – Request erreicht Server zu spät | Bestanden. Lokale Änderung vor Deadline; Request vor Serverkontakt gehalten und erst nach Ablauf zugelassen. Save und Retry `LIVE_STATE_CHANGED`; Revision 1 bleibt maßgeblich. Lokaler Text bleibt sichtbar als unbestätigt/gesperrt, einschließlich Reload. Kein nachträgliches Finalisieren der Änderung. |
| G – Pixel | Bestanden. Sichtbare Stufen 3 → 2 → 1, Save in jeder Stufe, Reload in Stufe 3 ohne Verlängerung, letzte Stufe nach weiteren 25 Sekunden weiterhin OPEN ohne Deadline. Manueller Blockschluss finalisiert Revision 3. Zuvor zurückgehaltener Request und Retry danach abgewiesen; geschlossener Zustand und korrekte Bestätigung nach Reload. |

Die Präsentation wurde nach Ablauf neu geöffnet und zeigte sofort 00:00.
Zusätzlich wurde sie während eines weiteren regulären 60-Sekunden-Countdowns
geschlossen und als neues Browserdokument geöffnet: vorher 00:47, danach 00:41,
identischer Serverstart und identische Dauer. Dieser ergänzende Anzeigetest
erfolgte bei bereits geschlossenem Antwortblock und prüft keine neue Freigabe.
Auch hier wurde vollständige Dokument-Neuinitialisierung statt F5 verwendet.

Im Pixel-Lauf blieb die erste Stufengrenze vor und nach Reload exakt
13:07:41.332Z; die zweite lag bei 13:08:01.332Z. Um 13:08:28.537Z war die letzte
Stufe noch offen. Die Auswertung zeigt „Pixel letzte Stufe bleibt offen“ als
automatisch finalisierte Abgabe, niemals „Pixel nach manuellem Schluss VERBOTEN“.
Die bestehenden automatisierten Pixeltests sichern zusätzlich die exakten
Deadlinegrenzen ab. Pixel-Engine und Stufenbewertung unverändert.

Unvollständige Pixel-Anläufe wurden nicht als Abnahme gewertet: Teststeuerung
verwechselte interne/angezeigte Stufen, wartete auf ein deaktiviertes Feld bzw.
verwendete einen bestehenden Teamnamen ohne Passwort. Korrigierter vollständiger
Lauf mit neuem Team und aktivem Feld erfolgreich. Eine spätere Testassertion
erwartete Fragen im geschlossenen Snapshot; dieser liefert korrekt eine leere
Fragenliste und separate answerConfirmations. Prüfung des Bestätigungsvertrags
und der Auswertung bestätigte den unveränderten Inhalt. Keine Produktkorrektur
aufgrund dieser Teststeuerungsfehler.

## Nachweise und Auslieferung

- Produktcommit: `f403d3577c7b10edb04fc68dbd27a9f38bebb4ec`.
- Unveränderliche Preview: https://pubquiz-kgc1d7ybv-just-phil-gud.vercel.app
- Preview-Workflow 34694548023 erfolgreich: Preview-Datenbankidentität geprüft,
  additive Migration angewendet und verifiziert, Deployment und Smoke grün.
- GitHub-Deployment 6409783417: Preview, derselbe Commit, erfolgreich.
- Production-Workflow 34694547974 übersprungen. `main` weiterhin
  `1d4c703e068c0752a10757620d1f7fe03d47b20a`; abschließend per ls-remote geprüft.
- Lokale Belege unter
  `C:/Users/gudel/.codex/visualizations/2026/09/11/01a08f64-96fb-7e62-9f96-5c7f014eb61e/ap92-evidence`:
  result-4 (Reproduktion), result-10 bis result-17 (allgemeiner Block),
  BCEF-reconnect.png, result-26/27/29/30 (vollständiger Pixel-Lauf und Schluss),
  result-32/33 (Präsentations-Neuinitialisierung während Countdown),
  full-tests.log, typecheck.log, lint.log, build.log, block-tests.log.

Geänderte Verantwortlichkeiten: Blockdeadline im bestehenden Prisma-Modell;
Enforcement und Finalisierung im bestehenden Interaction-Service;
Countdown-Aktionen speichern Serverstart/Frist; Moderation und Renderer stellen
diesen Zustand dar. Geänderte Dateigruppen: Prisma-Schema/Migration/generierter
Client, Quiz-actions und Interaction-Service, blockCountdown samt Tests,
Präsentations-statusActions, Moderations-/Präsentationskomponenten und SSR-Seiten,
Live-State-Typ, Regression-Fixture, package.json-Testlauf und Dokumentation.
Vollständige Dateiliste: `git show --stat f403d3577c7b10edb04fc68dbd27a9f38bebb4ec`.

## Offene Punkte und Abschlussstatus

Keine neuen Produktfehler in den ausgeführten Abnahmen gefunden. Keine weiteren
Produktänderungen nach dem genannten Commit, keine neue Infrastruktur, keine
Abschwächung des Preview-Schutzes und keine Production-Veröffentlichung.

Die externe Verwaltungsanmeldung für D bleibt offen. Für den abschließenden
Wiederholungslauf können zusätzlich wörtliche Playwright-reloads von Moderation
und Präsentation mitgeführt werden; vollständige Dokument-Neuinitialisierungen
sind bereits geprüft. Alle derzeit unabhängig ausführbaren Arbeiten sind
abgeschlossen; die Abnahme wird nicht trotz fehlendem D als vollständig gemeldet.

**AP9.2 vollständig abgenommen: Nein.**
