# Scope-basierte Rollenzuweisungen

## Zielmodell

Fachliche Berechtigungen werden durch `benutzer_rollenzuweisungen` beschrieben. Eine Zuweisung kombiniert eine Rolle mit einem Geltungsbereich:

- `ADMIN + GLOBAL`
- `EDITOR + GLOBAL`
- `EDITOR + EVENT_SERIES + eventreihe_id`
- `EVENT_MANAGER + EVENT_SERIES + eventreihe_id`

Alle anderen Kombinationen sind ungültig und wirken in der Anwendung fail-closed. Check-Constraints verhindern ungültige Kombinationen zusätzlich in PostgreSQL.

Pro Benutzer darf jede globale Rolle höchstens einmal vorkommen. Für Eventreihen gilt Variante A: Pro Benutzer und Eventreihe ist höchstens eine Rolle zulässig. `EVENT_MANAGER` enthält die eventbezogenen Editorrechte; eine zusätzliche Editorrolle wäre redundant.

## Expand-and-Contract

Paket 1.5 umfasst Expand und Application Cutover:

1. Neue Enums und die Assignment-Tabelle werden additiv angelegt.
2. Bestehende globale Rollen und Eventreihen-Memberships werden deterministisch backgefüllt.
3. Die Anwendung lädt aktuelle Assignments serverseitig und verwendet sie als alleinige Berechtigungsquelle.
4. Rollenänderungen aktualisieren Assignment und Legacy-Repräsentation atomar in einer serialisierbaren Transaktion.
5. Legacy-Felder und die alte Membership-Tabelle bleiben für Rollback und Beobachtung erhalten.

Die spätere Contract-Phase darf erst nach erfolgreicher Preview-/Production-Beobachtung erfolgen. Erst dann können `users.role`, `UserRole`, `eventreihe_benutzerrollen`, `EventSeriesRole` und die Dual-Write-Adapter in einer eigenen Migration beziehungsweise einem eigenen Auftrag entfernt werden.

## Backfill

| Legacy | Assignment |
| --- | --- |
| `UserRole.ADMIN` | `ADMIN + GLOBAL` |
| `UserRole.EDITOR` | `EDITOR + GLOBAL` |
| `UserRole.USER` | keine globale Zuweisung |
| `EventSeriesRole.EVENT_EDITOR` | `EDITOR + EVENT_SERIES` |
| `EventSeriesRole.EVENT_MANAGER` | `EVENT_MANAGER + EVENT_SERIES` |

Globale Assignments übernehmen `users.created_at` und `users.updated_at`. Ein ursprünglicher Zuweiser ist für das einzelne Legacy-Rollenfeld nicht bekannt und bleibt deshalb `NULL`. Eventreihenassignments übernehmen Zuweiser sowie beide Auditzeitpunkte aus der Legacy-Membership. `ON CONFLICT DO NOTHING` macht den Backfill konfliktfrei, ohne bestehende Datensätze zu überschreiben.

## Read- und Session-Strategie

Die Session enthält weiterhin nur Identitätsdaten und den Legacy-Rollenwert für Rückwärtskompatibilität und Anzeige. Jede serverseitige Berechtigungsentscheidung lädt die aktuellen Assignments anhand der Benutzer-ID. Client-Komponenten erhalten nur abgeleitete Capabilities; sie sind keine Sicherheitsgrenze.

Unbekannte Rollen, unbekannte Scopes, eine fehlende Eventreihen-ID oder eine Eventreihen-ID bei globalem Scope ergeben keine Rechte. Die Legacy-Struktur wird nicht als Rechte-Fallback verwendet.

## Dual Write und Schutzregeln

Globale Assignments werden auf die Legacy-Rolle mit der Priorität `ADMIN > EDITOR > USER` abgebildet. Eventreihenrollen werden als `EDITOR -> EVENT_EDITOR` und `EVENT_MANAGER -> EVENT_MANAGER` gespiegelt. Teilupdates sind durch serialisierbare Transaktionen ausgeschlossen; Serialisierungskonflikte werden begrenzt wiederholt.

Der letzte aktive globale Administrator kann weder seine Adminrolle verlieren noch deaktiviert oder archiviert werden. Der letzte aktive Eventmanager einer aktiven Eventreihe kann weder entfernt, zum Editor geändert noch deaktiviert werden. Für archivierte Eventreihen greift diese Manager-Mindestbesetzung bewusst nicht, bestehende Zuweisungen bleiben aber sichtbar und entfernbar.

Sicherheitsrelevante Änderungen, Schutzfälle, ungültige Kombinationen und erkannte Legacy-/Assignment-Inkonsistenzen werden mit technischen IDs, jedoch ohne vertrauliche Benutzerdaten, über das bestehende Console-Logging protokolliert.

## Deployment-Kompatibilität

Die Deployment-Pipeline führt Migrationen vor dem Vercel-Deployment aus. Die Migration aus Paket 1.5 legt ausschließlich neue Typen, Tabelle, Constraints und Indizes an und füllt die neue Tabelle. Bestehende Spalten, Enums, Memberships und Werte werden weder verändert noch entfernt. Der aktuell laufende Produktionscode funktioniert deshalb zwischen Migration und neuem Deployment unverändert weiter; ein Rollback auf ihn bleibt während der Expand-Phase möglich.
