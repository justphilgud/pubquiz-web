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

## Objektgrenzen und Bereichswechsel

Die Fragen-Policies in `app/fragen/editor/questionScopePolicy.ts` sind maßgeblich:
Lesen einer Reihenfrage benötigt eine passende Zuordnung; Bearbeitung und Freigabe
benötigen die bestehenden Rechte für sämtliche zugeordneten Reihen. Globale Editoren
behalten ihre globalen Entwurfsrechte, erhalten dadurch aber keine Reihenrechte.

`canSaveScopedQuestion` prüft bei bestehenden Fragen sowohl das gespeicherte Objekt
als auch den angeforderten Zielbereich. Das gilt auch für Freigaben und Rückgaben.
`saveQuestion` prüft vor der Verarbeitung und erneut unmittelbar vor dem Schreiben;
bestehende Fragen werden dabei in der Transaktion gesperrt. Die Angabe einer eigenen
Reihe verleiht niemals Zugriff auf ein fremdes oder globales Original.

Auch die erhaltenen Alt-Actions `getFrageDetails`, `getFrageForEdit` und `updateFrage`
verwenden die konkreten VIEW-/EDIT-Prüfungen. Such- und Ähnlichkeitsabfragen verwenden
`questionVisibilityWhere`, die Query-Entsprechung der bestehenden Lesepolicy.
Urheberschaft allein erhält nach einem Rechteentzug keinen privaten Bereichszugriff.
Quizverwendungen einschließlich Anzahl und Verwendungsfilter werden auf tatsächlich
verwaltbare Quiz beschränkt (`questionQuizUsageWhere`); das gilt auch für Detaildaten.
Die Content-Oberfläche erhält `can_archive` aus derselben Bearbeitungspolicy wie die
Archivierungs-Action. Neue Reaktivierungs- oder globale Kopierrechte entstehen nicht.

Ein Quizwechsel benötigt Verwaltungsrechte auf Quell- und Zielreihe. Prüfung der
Inhaltsgrenzen und Änderung erfolgen gemeinsam in einer serialisierbaren Transaktion.
`getQuizSeriesChangeBlocker` prüft Fragen, übernommene Fragen-/Story-Verknüpfungen,
auch unsichtbare Story-Platzierungen und Umfragen. Globale und zur Zielreihe passende
Inhalte sowie Inhalte dieses konkreten Quiz bleiben zulässig. Die Prüfung verändert
keinen Freigabe-, Archiv-, Ablauf- oder Laufzeitstatus: Bestehende Inhalte werden
weder entfernt noch automatisch freigegeben. Unverträgliche Inhalte blockieren den
Wechsel mit einer verständlichen Meldung ohne fremde Objektmetadaten.

`/api/quiz/live-snapshot` verwendet bereits `requireQuizViewer` und für Moderationsdaten
zusätzlich `requireQuizLiveController`; beide prüfen über `requireUser` das aktive
Konto und aktuelle Assignments. Teilnehmer behalten ihren separaten signierten
Quiz-Sitzungszugriff. Die bestehende Publikumspräsentation benötigt weiterhin eine
autorisierte Moderator-/Admin-Sitzung und die lokale Präsentationsfreigabe; es wird
kein neuer anonymer Präsentationszugriff eingeführt.

Entzogene Rechte oder deaktivierte Konten wirken beim nächsten Serveraufruf auch
mit bestehendem Sitzungscookie. Bereits ausgelieferte Inhalte können nicht aus
Browsern zurückgerufen werden. Ein gleichzeitig bereits autorisierter Aufruf ist
keine zentrale Sitzungswiderrufsfunktion.

Regression: `npm run test:authorization` führt echte Actions und die API-Route mit
echten Guards/Policies und isolierten Auth-/Persistenzadaptern aus. Der Test ist Teil
von `npm test`. Eine getrennte Browserabnahme und Befundzuordnung stehen im
[Abnahmebericht vom 25.10.2026](../operations/authorization-hardening-20261025.md).

Unbekannte Rollen, unbekannte Scopes, eine fehlende Eventreihen-ID oder eine Eventreihen-ID bei globalem Scope ergeben keine Rechte. Die Legacy-Struktur wird nicht als Rechte-Fallback verwendet.

## Dual Write und Schutzregeln

Globale Assignments werden auf die Legacy-Rolle mit der Priorität `ADMIN > EDITOR > USER` abgebildet. Eventreihenrollen werden als `EDITOR -> EVENT_EDITOR` und `EVENT_MANAGER -> EVENT_MANAGER` gespiegelt. Teilupdates sind durch serialisierbare Transaktionen ausgeschlossen; Serialisierungskonflikte werden begrenzt wiederholt.

Der letzte aktive globale Administrator kann weder seine Adminrolle verlieren noch deaktiviert oder archiviert werden. Für Eventmanager gibt es dagegen keine Mindestbesetzung: Eine Eventreihe darf ohne Eventmanager bestehen, und die letzte Eventmanager-Zuweisung darf entfernt, zum Editor geändert oder durch Deaktivierung beziehungsweise Archivierung des Benutzers inaktiv werden.

Sicherheitsrelevante Änderungen, Schutzfälle, ungültige Kombinationen und erkannte Legacy-/Assignment-Inkonsistenzen werden mit technischen IDs, jedoch ohne vertrauliche Benutzerdaten, über das bestehende Console-Logging protokolliert.

## Deployment-Kompatibilität

Die Deployment-Pipeline führt Migrationen vor dem Vercel-Deployment aus. Die Migration aus Paket 1.5 legt ausschließlich neue Typen, Tabelle, Constraints und Indizes an und füllt die neue Tabelle. Bestehende Spalten, Enums, Memberships und Werte werden weder verändert noch entfernt. Der aktuell laufende Produktionscode funktioniert deshalb zwischen Migration und neuem Deployment unverändert weiter; ein Rollback auf ihn bleibt während der Expand-Phase möglich.
