# What the Meme! – AP4 Ergebnis, Punkte und Auflösung

Stand: 23. September 2026

## Umfang und vorhandene Infrastruktur

AP4 übernimmt ausschließlich einen final geschlossenen AP3-Votingstand. Die
bestehende Präsentationssequenz bestimmt weiterhin, ob die Auflösung unmittelbar
nach der Frage oder gesammelt am Blockende erscheint. Die bestehende zentrale
Bewertung in `team_antworten` bleibt die einzige Quelle für Quizpunkte und den
normalen Punktestand.

AP4 ergänzt deshalb keine zweite Punkte- oder Ranking-Engine. Ein kleiner
persistenter Ergebnis-Snapshot hält lediglich Stimmenzahl, Gewinnerkennzeichen
und vergebene Punkte je unveränderlichem AP2-Kandidaten fest. Die ursprünglichen
AP1-Submissions, AP2-Auswahl und Reviewentscheidung sowie AP3-Votes werden nicht
verändert.

## Finalisierung

Nur eine über `requireQuizLiveController` berechtigte Moderations- oder
Adminrolle kann **Ergebnis finalisieren** auslösen. Der Server sperrt zuerst das
Quiz und danach die Meme-Präsentation. Er akzeptiert nur den Zustand
`VOTING_CLOSED`, lädt die freigegebenen Kandidaten in ihrer stabilen AP2-Reihenfolge
und zählt die final gespeicherten AP3-Votes.

Der höchste positive Stimmenwert bestimmt den Sieger. Haben mehrere Kandidaten
denselben höchsten Wert, sind alle Gewinner:

> Bei Gleichstand auf Platz 1 gelten alle punktgleichen Kandidaten als Gewinner.
> Jedes zugehörige Team erhält einen Quizpunkt.

Bei null gültigen Stimmen gibt es weder einen Gewinner noch einen Punkt. Das gilt
auch bei genau einem Kandidaten, wenn wegen der Selbstwahlsperre keine gültige
Stimme möglich ist. Es entsteht trotzdem ein finaler, lesbarer Ergebniszustand.

## Zentrale Punkte und Idempotenz

Jeder Kandidat referenziert die bereits vorhandene finale Teamantwort. AP4 setzt
deren `vergebene_punkte` und zugehörige automatische Bewertungsfelder absolut auf
`1` für einen Gewinner beziehungsweise `0` für einen Nichtgewinner. Der normale
Punktestand summiert weiterhin ausschließlich diese zentralen Werte.

Die Datenbank erlaubt je Präsentation und Kandidat genau einen Ergebniseintrag.
Unter der Präsentationssperre prüft der Server `result_finalized_at`; ein erneuter
Request liefert den bestehenden Zustand und schreibt weder Ergebnis noch Punkte
erneut. Automatische Neubewertung wird nach der Finalisierung für diese
Meme-Frage übersprungen. Die normale manuelle Bewertungsaktion lehnt Änderungen
an finalisierten Meme-Punkten ab. Es gibt keine neue Undo- oder Reset-Funktion.

> Ergebnisberechnung und Punktevergabe sind idempotent und dürfen durch Reload
> oder mehrere Moderator-Clients nicht mehrfach ausgelöst werden.

Der bestehende Quiz-Reset entfernt über die vorhandenen Run-Kaskaden auch den
zugehörigen Meme-Lauf und dessen Ergebnis. Das ist weiterhin eine ausdrücklich
bestätigte, quizweite Betreiberaktion.

## Sichtbarkeit und Auflösung

Moderation erhält den finalen Snapshot sofort. Teamgeräte und Leinwand erhalten
Teamname, Teamprofil, Stimmen und Gewinnerstatus erst, wenn die vorhandene
Präsentationsidentität die `SOLUTION`-Phase erreicht.

- **Direkte Auflösung:** Nach Finalisierung führt der nächste reguläre Schritt
  auf die direkt folgende Lösung und zeigt das Ergebnis.
- **Auflösung am Blockende:** Die Punkte werden bei der Finalisierung einmalig
  gespeichert. Während der weiteren Fragen bleiben Ergebnis und Teamidentitäten
  verborgen. Die regulär erzeugte Lösungsfolie am Blockende liest denselben
  Snapshot.

Ein Vorwärtssprung aus der Meme-Frage wird client- und serverseitig abgewiesen,
solange das geschlossene Voting noch nicht finalisiert ist. Rückwärtsnavigation
erzeugt keine neue Auswertung. Reveal und Reload lesen stets den persistenten
Snapshot.

## Ergebnisfolie

Die Ergebnisfolie verwendet den gemeinsamen `MemeRenderer` und zeigt in stabiler
Kandidatenreihenfolge:

- Kandidatennummer und Meme;
- Teamname sowie vorhandenes Teamfoto oder Avatar;
- Stimmenzahl und prozentualen Anteil;
- eine eindeutige Gewinnerkennzeichnung und den vergebenen Punkt.

Bis zu vier Kandidaten werden pro Seite dargestellt. Mehr Kandidaten verwenden
den vorhandenen persistierten Reveal-Zähler der Präsentation; Nummern und
Gewinnerstatus bleiben über Seiten und Reloads stabil. Bei null Stimmen erscheint
ein verständlicher Hinweis ohne Fehlerzustand.

## Datenmodell

Migration `20260923230000_add_meme_results` ergänzt:

- Finalisierungszeit, verantwortlichen Benutzer und Ergebnisrevision an der
  Meme-Präsentation;
- `meme_result_entries` als kompakten, unveränderlichen Aggregat-Snapshot;
- Eindeutigkeits-, Fremdschlüssel- und Werte-Constraints.

Die Migration ist additiv. Sie kopiert keine Votes, verändert keine laufende
Interaktion und führt keine Production-Migration aus.
