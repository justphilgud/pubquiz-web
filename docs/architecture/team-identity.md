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

## Globales Teamprofil

`teams.avatar_code`, `teams.foto_url` und `teams.foto_upload_gesperrt` gehören zur globalen Teamidentität. Sie werden nicht pro Quiz oder Eventreihe dupliziert. Ohne Foto und ohne bewusst gewählten Avatar wird aus der stabilen `team_id` deterministisch einer der zehn Systemavatare abgeleitet; es gibt daher niemals eine leere Bildfläche oder einen bei jedem Aufruf wechselnden Fallback.

Teilnehmer können ihr eigenes Profil nach jedem erfolgreichen Join ändern. Ein Upload wird serverseitig auf erlaubten Medientyp und Dateigröße geprüft, gedreht, quadratisch verkleinert, als WebP neu kodiert und ohne Quellmetadaten gespeichert. Archivierte Teams können ihr Profil nicht über einen Teilnehmer-Join ändern. Eine globale Upload-Sperre verhindert nur neue Teamfotos; Systemavatare bleiben wählbar.

## Berechtigungen

| Akteur | Foto hochladen/ersetzen | Avatar wählen | Foto entfernen | Foto-Upload sperren |
| --- | --- | --- | --- | --- |
| Team | eigenes Profil nach erfolgreichem Join | ja | eigenes Foto | nein |
| Eventmanager | nein | nein | im eigenen Eventreihen-Scope | im eigenen Eventreihen-Scope |
| Administrator | global | global | global | global |
| Editor | nein | nein | nein | nein |

Die bisherigen Rechte auf Suche, Passwortverwaltung, Archivierung und Löschung bleiben davon getrennt: Administratoren verwalten sie global; Eventmanager dürfen Passwörter nur für Teams in ausdrücklich zugewiesenen Eventreihen einsehen und ändern; Editoren erhalten keine Teamverwaltung.

Jeder Lese- und Schreibpfad prüft diesen Scope serverseitig. UI-Filter sind kein Berechtigungsmechanismus.

## Lebenszyklus und Löschen

Archivieren ist der sichere Standard. Historische Sessions, Antworten und Ergebnisse bleiben erhalten; archivierte Teams können keinem neuen Quiz beitreten und erscheinen standardmäßig nicht in aktiven Listen.

Ein unbenutztes Team ohne `quiz_team_sessions` kann physisch gelöscht werden. Bei Historie ist ein Force Delete ausschließlich für Administratoren mit exakter Namensbestätigung verfügbar. Dabei werden die Sessions des Teams einschließlich Antworten, Submissions und Bewertungen sowie `quiz_teams`-Zuordnungen entfernt. Diese Datenwirkung ist bewusst destruktiv und wird in der Oberfläche vorab genannt.

Archivierung erhält Foto und Avatar als Teil der historischen Identität. Beim Entfernen eines Fotos wird nur ein verwaltetes, nicht mehr referenziertes Blob gelöscht; die Darstellung fällt unmittelbar auf den gespeicherten oder deterministischen Avatar zurück.

## Identität in der Präsentation

Öffentliche Zwischenstände zeigen Rang und Punkte, aber weder Teamname noch Foto noch Avatar. Die Moderationsansicht darf für denselben Zwischenstand die vollständige Identität zeigen. Finale Rankings und bewusst ausgewählte, als skurril markierte Antworten dürfen die Teamidentität öffentlich sichtbar machen. Diese Audience-Regel ist template-neutral und keine LOVD-Sonderlogik.

## Bestehende Daten

Die Migration ordnet bestehende Sessions ausschließlich über einen eindeutigen normalisierten Namen zu und befüllt daraus `quiz_teams`. Uneindeutige Namen oder verwaiste Sessions stoppen die Migration. Ein späteres Zusammenführen fachlich identischer Alt-Teams ist ein eigenes Arbeitspaket.
