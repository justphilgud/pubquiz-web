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

Final abgegebene Memes erscheinen bereits während der laufenden Antwortphase
anonym in der Moderation. Sie können sofort freigegeben oder ausgeschlossen
werden. Der Review kann erst abgeschlossen werden, wenn die Antwortphase
geschlossen ist und alle bis dahin gültigen Einreichungen entschieden wurden.

Der zentrale **Weiter**-Button direkt unter der aktuellen Folie steuert danach
den gesamten Ablauf. Der vorhandene Weiter-Hotkey löst dieselben Schritte aus:

1. laufende Antwortphase schließen;
2. Review abschließen, Kandidaten einmal zufällig anordnen und Meme 1 starten;
3. alle freigegebenen Kandidaten in der gespeicherten Reihenfolge zeigen;
4. durch alle Übersichtsseiten wechseln;
5. Voting öffnen und nach der Abstimmung schließen;
6. Ergebnis genau einmal finalisieren;
7. entsprechend der gewählten Auflösung zur Ergebnisfolie oder zur nächsten
   regulären Quizfolie wechseln.

Die Moderation sieht beim offenen Voting nur den neutralen Fortschritt der
abgegebenen Stimmen, niemals Kandidaten-Zwischenstände. Direkte
Rückwärtsaktionen bleiben im Meme-Bereich verfügbar; die primäre
Vorwärtsnavigation erfolgt immer über **Weiter**. Tastenkürzel greifen nicht,
solange ein Eingabefeld oder editierbarer Text fokussiert ist.

Ein Team hat genau eine Stimme und kann sie während des offenen Votings ändern.
Das eigene Meme bleibt sichtbar, ist aber gesperrt. Ein Team ohne eigenen
freigegebenen Kandidaten darf alle Kandidaten wählen. Reloads erhalten den
aktuellen Ablauf und die eigene Auswahl; bei konkurrierenden Geräten gewinnt
der zuerst bestätigte Schreibvorgang und der andere Client lädt den aktuellen
Serverstand.

Auf der Ergebnisfolie stehen Kandidatennummer, Meme, Team, Stimmen und Anteil.
Bei Gleichstand sind alle Kandidaten mit der höchsten Stimmenzahl Gewinner und
jedes zugehörige Team erhält einen Punkt. Ohne gültige Stimme wird kein Gewinner
erfunden und kein Punkt vergeben. Mehr als vier Ergebnisse werden mit **Weiter**
seitenweise gezeigt. Reload und zwei Moderatorfenster ändern das persistierte
Ergebnis oder den Punktestand nicht erneut.
