# AP9.2 – Serververbindlicher Blockschluss

Stand: 12. September 2026. Abnahme in Arbeit, Production unverändert.

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

## Qualitätsgate

Automatisierte Prüfungen und Preview-Browserabnahme laufen noch.
AP9.2 vollständig abgenommen: **Nein – noch in Arbeit.**
