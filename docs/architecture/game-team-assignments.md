# Spielentwürfe: geplante Teamzuordnungen (AP2)

## Zweck und Persistenz

`pubquiz.game_team_assignments` verbindet eine dauerhafte UUID des Spielentwurfs mit einer bestehenden globalen `teams.team_id`. Eigene UUID und Erstellungszeitpunkt identifizieren die Verbindung. UNIQUE(game_id,team_id) verhindert Duplikate. Zwei RESTRICT-Fremdschlüssel schützen Team und Verbindung vor beiläufiger Löschung. Keine Kopien, Zugangsdaten, Anmeldung, Anwesenheit, Ergebnisse oder Punkte. `quiz_teams` und `quiz_team_sessions` behalten ihre Bedeutung und werden nicht migriert. Tatsächlicher späterer Beitritt braucht einen eigenen authentifizierten Vertrag; formatspezifische Auswertung kann an Spiel und Team anknüpfen, darf geplante Teilnahme nicht als tatsächliche Anwesenheit behandeln.

## Rechte-Matrix

Jede Operation liest aktuelle aktive Benutzerrollen und tatsächliche Produktfreischaltung serverseitig neu. Menü-Sichtbarkeit genügt nicht.

| Akteur | Zugeordnete Namen/Avatare lesen | Hinzufügen/Entfernen | Suchbestand |
| --- | --- | --- | --- |
| Admin, Spielprodukt aktiv | Ja | Ja; Hinzufügen nur aktive Reihe/aktives Team | Bisheriger globaler Teamverwaltungsbestand |
| Eventmanager der Spielreihe, Produkt aktiv | Ja | Ja; dieselben Archivgrenzen | Nur bisher zulässige Teams über Quiz-Teamsessions in seinen QUIZ-Managerreihen |
| Bingo-Editor der Reihe, Produkt aktiv | Ja | Nein | Keine Suche |
| Karaoke-Editor | Nein | Nein | Keine Suche |
| Nur gemeinsame Reihenverwaltung, fremde Reihe, inaktiver Benutzer oder deaktiviertes Produkt | Nein | Nein | Keine Suche |

Die vorhandene Policy `teamScopeWhere` / `canAccessTeamManagement` bleibt maßgeblich. Eine reine Bingo-/Karaoke-Rolle eröffnet keinen globalen Teambestand. Eine neue Spielzuordnung erweitert diesen Suchbestand ausdrücklich nicht. Spiel-Leserechte geben ausschließlich Team-ID, Name, sicheren Avatarcode und Archivkennzeichen zu bestehenden Verbindungen frei, weder Passwort/Foto-Uploadrechte noch Teilnahmehistorie. Suche ist begrenzt auf 50 Treffer plus Eingrenzungshinweis, mit serverseitiger Namenssuche. Nicht auswählbare Team-IDs werden beim Schreiben erneut abgewiesen.

## Zustände und Konsistenz

Teams sind optional. Erst nach gespeichertem Spiel ist der Bereich vorhanden. Seine Actions speichern unmittelbar ausschließlich Verbindungen. Das bestehende Stammdatenformular behält Zustand, Fehler, Versionsschutz und Navigationsguard. Bei ungespeicherten Stammdaten sind Zuordnungsaktionen mit Hinweis gesperrt; während einer Zuordnungsaktion sind die Stammdatenfelder und deren Speichern gesperrt. Keine Routeraktualisierung nach Zuordnungsaktionen, kein implizites Mitspeichern oder Verwerfen. Ein offener Entfernen-Dialog nennt die Verbindung ausdrücklich; Abbrechen/Escape schreiben nichts.

Alle Schreibvorgänge sperren zuerst dieselbe Spielzeile wie Stammdatenänderungen. Hinzufügen/Entfernen prüfen die bekannte Stammdatenversion und die ausdrücklich angezeigte Reihen-ID; Zuordnungen verändern diese Version nicht, da sie keine Stammdaten überschreiben. Ein Reihenwechsel prüft unter derselben Zeilensperre, dass keine Zuordnungen bestehen. Kein automatisches Verschieben oder Entfernen. Produkte, Reihe, aktive Benutzer-/Rollenzeilen und beim Hinzufügen die Teamzeile werden stabilisiert. UNIQUE plus serialisierte Upserts behandeln doppelte/parallele Add-Anfragen idempotent. Entfernen prüft zusätzlich die Zugehörigkeit der Verbindungs-ID zum berechtigten Spiel.

Archivierte Teams/Spielreihen behalten vorhandene Zuordnungen lesbar. Neue Verbindungen sind dort gesperrt; ausdrückliches Entfernen bleibt für weiterhin berechtigte Verwalter erlaubt. Entzug oder Produktdeaktivierung sperrt den nächsten Zugriff ohne Löschung. Globale Teamlöschung ist bei Spielzuordnungen auch mit Force gesperrt; zuerst Verbindungen ausdrücklich entfernen oder Team archivieren. Andere globale Teamrechte bleiben unverändert.

## Migration, Sicherung und Rückfall

`20261026180000_game_team_assignments` ist additiv: eine Tabelle, PK, UNIQUE-Index, Teamindex und zwei FKs. Keine historischen Dateien oder Quizdaten geändert. Leeres und synthetisch befülltes Main-Ausgangsschema werden mit echtem PostgreSQL geprüft. Die bekannte historische Bootstrapgrenze (BOM/doppelte Spalte in alter Leerkette) bleibt bestehen; eine frische Schema-Baseline ist kein Nachweis historischer Datenmigrationen. Baseline nur auf einer neu angelegten leeren isolierten Preview, niemals auf Production oder bestehender Historie.

Bestehender `pubquiz`-Dump sowie dynamische COLUMN_SQL/CATALOG_SQL-Inventur erfassen Tabelle, vier Spalten, Constraints und Indizes. Reale Integration prüft Inventur und `auditColumns`/`inspectRow` ohne Ausnahmen. Keine manuellen Backups/Restores. Rückfallcode kann die additive Tabelle und Verbindungen stehen lassen; keine destruktive Down-Migration.

## Abnahme

Unitvalidierung, reale Server Actions/Repositorytests gegen PostgreSQL und Chromium-Formularregressionen sind Pflicht. Tatsächliche gehostete Browserprüfung, Screenshots, CI und Prüfgrenzen stehen im AP2-Abnahmebericht/PR. Spielbetrieb, gemeinsame Renderer/Templates, öffentliche Anmeldung, Offline-Synchronisation und Reihen-Spieleübersicht sind nicht enthalten.
