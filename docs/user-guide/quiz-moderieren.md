# Quiz moderieren

Die Moderationsansicht zeigt die aktuelle Präsentation, die nächste Folie, Notizen, Teamstatus, Timer und die zugehörigen Live-Steuerungen.

![LIVE-Antworten mit Entwurf- und Finalstatus](screenshots/live-drafts-moderation-eventmanager.jpg)

## Quiz-LIVE

1. Die LIVE-Frage öffnen. Das Publikum sieht ausschließlich die Frage.
2. Unter **Antworten ansehen (intern)** die gespeicherten Teamantworten kontrollieren.
3. Während OPEN tragen aktuelle Autosaves den Status **Entwurf**. Änderungen ersetzen die vorige Draft-Anzeige und werden nicht doppelt gezählt.
4. Bei Freitext werden Original und bereinigte öffentliche Fassung getrennt dargestellt. Ein Entwurf kann noch nicht veröffentlicht werden.
5. **Antwortphase schließen** finalisiert inhaltlich gefüllte Drafts. Leere Drafts erzeugen keine Antwort; es erfolgt keine automatische Bewertung allein durch CLOSE.
6. Der Status wechselt zu **Final**. Erst jetzt kann über **Ergebnis anzeigen** die anonyme Auswahlverteilung oder eine freigegebene Textauswahl veröffentlicht werden.
7. Die Lösung bleibt ein eigener Präsentationsschritt.

LIVE-Drafts sind Moderationsdaten. Sie erscheinen weder in der Publikumspräsentation noch in einer öffentlichen Verteilung oder Text-Wall.

## Umfragen und Zwischenstände

Content-Umfragen verwenden ebenfalls OPEN und CLOSE, bleiben aber ohne Punkte. Bei Freitext entscheidet die konfigurierte automatische oder moderierte Veröffentlichung. Der öffentliche Zwischenstand ist anonym und enthält nur Rang und Punkte; die Moderationsansicht behält die Teamidentität.

## Meme-Präsentation und Voting

Nach dem abgeschlossenen Meme-Review erscheint der Bereich **Meme-Präsentation
& Voting**:

1. **Präsentationsphase starten** zeigt Meme 1 anonym auf der Leinwand.
2. Mit **Nächstes Meme** werden alle freigegebenen Kandidaten in der stabilen
   AP2-Reihenfolge gezeigt. Nach dem letzten Kandidaten folgt die Übersicht.
3. Bei mehr als vier Kandidaten mit **Nächste Übersichtsseite** durch alle
   Seiten navigieren.
4. Auf der letzten Übersichtsseite **Voting öffnen** wählen. Erst jetzt können
   die angemeldeten Teams abstimmen.
5. Die Moderation sieht nur den neutralen Fortschritt der abgegebenen Stimmen,
   niemals Kandidaten-Zwischenstände.
6. **Voting schließen** beendet die Abstimmung endgültig und übergibt den
   stabilen Stand an die spätere AP4-Auswertung.

Ein Team hat genau eine Stimme und kann sie während des offenen Votings ändern.
Das eigene Meme bleibt sichtbar, ist aber gesperrt. Ein Team ohne eigenen
freigegebenen Kandidaten darf alle Kandidaten wählen. Reloads erhalten den
aktuellen Ablauf und die eigene Auswahl; bei konkurrierenden Geräten gewinnt
der zuerst bestätigte Schreibvorgang und der andere Client lädt den aktuellen
Serverstand.
