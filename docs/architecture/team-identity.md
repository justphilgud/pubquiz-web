# Globale Teamidentität

## Verbindlicher Domain-Contract

Ein Datensatz in `teams` ist die globale Identität eines Teams. Quiz- und Eventreihenteilnahmen erzeugen keine neue Identität, sondern referenzieren dieselbe stabile `team_id`. Ergebnisse bleiben über das jeweilige Quiz und dessen `eventreihe_id` fachlich getrennt.

```text
teams (globale Identität)
  ├─ quiz_teams (Zuordnung und Ergebnis je Quiz)
  └─ quiz_team_sessions (konkrete Teilnahme)
       └─ team_antworten / team_answer_submissions

quiz → eventreihen (Wertungsscope)
```

`quiz_team_sessions.teamname` bleibt als historischer Anzeigename erhalten. Die verbindliche Identität ist `quiz_team_sessions.team_id`. Neue Sessions werden pro `quiz_id × team_id` höchstens einmal angelegt.

## Namen und Zugangswörter

`teams.teamname_normalisiert` ist der getrimmte, kleingeschriebene globale Such- und Eindeutigkeitsschlüssel. So kann `Kolibri` nicht versehentlich als `KOLIBRI` erneut angelegt werden. Die Migration bricht bei bestehenden normalisierten Dubletten ab und führt sie niemals automatisch zusammen.

Team-Zugangswörter sind bewusst leicht kommunizierbare, auslesbare Wörter. Sie liegen in `teams.team_passwort`, werden case-sensitiv verglichen und nur über autorisierte Serverpfade ausgegeben. Passwortwerte gehören nicht in Logs oder Listen-DTOs.

## Berechtigungen

- Administrator: globale Suche, Passwortverwaltung, Archivierung und Löschung.
- Eventmanager: Teams mit mindestens einer Teilnahme in einer ausdrücklich zugewiesenen Eventreihe; Passwort anzeigen und ändern. Fremde Eventreihen-Details werden nicht ausgeliefert.
- Editor: keine Teamverwaltung.

Jeder Lese- und Schreibpfad prüft diesen Scope serverseitig. UI-Filter sind kein Berechtigungsmechanismus.

## Lebenszyklus und Löschen

Archivieren ist der sichere Standard. Historische Sessions, Antworten und Ergebnisse bleiben erhalten; archivierte Teams können keinem neuen Quiz beitreten und erscheinen standardmäßig nicht in aktiven Listen.

Ein unbenutztes Team ohne `quiz_team_sessions` kann physisch gelöscht werden. Bei Historie ist ein Force Delete ausschließlich für Administratoren mit exakter Namensbestätigung verfügbar. Dabei werden die Sessions des Teams einschließlich Antworten, Submissions und Bewertungen sowie `quiz_teams`-Zuordnungen entfernt. Diese Datenwirkung ist bewusst destruktiv und wird in der Oberfläche vorab genannt.

## Bestehende Daten

Die Migration ordnet bestehende Sessions ausschließlich über einen eindeutigen normalisierten Namen zu und befüllt daraus `quiz_teams`. Uneindeutige Namen oder verwaiste Sessions stoppen die Migration. Ein späteres Zusammenführen fachlich identischer Alt-Teams ist ein eigenes Arbeitspaket.
