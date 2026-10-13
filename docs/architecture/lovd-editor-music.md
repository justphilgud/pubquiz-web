# LOVD, Vorlagendialog und Musikantworten

## Verantwortlichkeiten

Der gemeinsame `Modal` rendert in `document.body`, begrenzt die Gesamthöhe am
Viewport und scrollt nur den Inhalt. Kopf und Aktionen bleiben erreichbar.
Fokusführung, Escape, Abbrechen und Rückgabe des Fokus bleiben im Modal;
Formulardaten und idempotente Vorlagenanlage bleiben beim bestehenden Editor.
Es wird keine neue Dialogbibliothek eingeführt.

Die LOVD-Komposition bleibt im gemeinsamen datengetriebenen Renderer. Nur
explizit offene, medienfreie Standardansichten im EDITORIAL-Design verlieren
den leeren Antwortbereich. Geschlossene Fragen, Medien und spezialisierte
Templates behalten ihre bisherigen Zweige. Die Startsequenz zeigt die zentrale
Intro-Countdown-Zeit der tatsächlichen Audiodatei vor Überschrift und
konfiguriertem Begleittext. Der Renderer startet keinen Timer; die bestehende
Moderationssteuerung steuert weiterhin Audio-Start und Pause. Der dekorative
Play-Marker und die Medienaktivierung
innerhalb dieser öffentlichen LOVD-Folie werden nicht gerendert. Die bestehende
Aktivierung des Präsentationsfensters bleibt für Browser-Autoplay erforderlich.

## Musik: additive JSON-Konfiguration

`musicAnswerScope` liegt in der vorhandenen `template_config_json`:
`SINGLE` oder `ARTIST_TITLE`. Ohne Angabe gilt das bisherige Verhalten.
Eine Schema-Migration oder Bestandsdatenänderung ist nicht notwendig.
Die Fähigkeit wird aus deklarierter Audio-/Interpret-/Titelstruktur der Vorlage
abgeleitet, nicht aus Fragetext, Quiz-ID oder Vorlagennamen. Dynamische Vorlagen
übernehmen den Modus mit ihrem vorhandenen Konfigurationssnapshot.

Der Editor übergibt nur aktive Antwortgruppen an den bestehenden Save-Service.
Varianten innerhalb der einzelnen Gruppe bleiben erhalten. Die beiden Modi
halten ihre eingegebenen Werte während des Umschaltens im Editor getrennt;
nach Speichern und Neuladen existieren nur die tatsächlich gespeicherten
Komponenten. Das erklärt die Oberfläche vor dem Umschalten.

Servervalidierung prüft den Umfang zusätzlich zu den bestehenden Pflichtfeld-
und Medienregeln. Persistierte Antwortfelder, Teilnehmer-Contract, Submission,
Auflösung und Bewertung verwenden weiterhin die gemeinsame Pipeline. Eine
einzelne Gruppe erhält ausschließlich ihre bisherigen Komponentenpunkte;
Interpret und Titel behalten die bestehende Teilbewertung. Der Modus enthält
keine Lösungen und erweitert keine Teilnehmer-Payload um Lösungsdaten.

## Verifikation und Release

Gezielte Tests prüfen JSON-/Vorlagen-Roundtrip, Einzelantworten, Leerzeichen,
Audio-Pflicht, Varianten, Komponentenbewertung, offene LOVD-Fragen und die
Countdown-Reihenfolge. Die bestehende CI bleibt verbindlich.
Auf Windows unterscheidet der unveränderte, eingefrorene Production-Importplan
wegen CRLF vom erwarteten Byte-Hash; der Git-Blob besitzt den erwarteten Hash.
Dieser unabhängige Test wird weder angepasst noch die Datei umgeschrieben.

Production ist für diesen Umfang nach erfolgreicher Preview-Abnahme freigegeben.
Ohne vollständigen Nachweis der echten Editor-, Vorlagen- und Spielabläufe
erfolgt kein Production-Release. Isolierte Testdaten dürfen echte Quizdaten
nicht verändern.
