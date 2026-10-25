# Rollen, Eventarten und Eventreihenverwaltung

Stand: 25. Oktober 2026, nach fachlicher Präzisierung im Review. Nur PR und Preview,
kein automatischer Merge oder Production-Release.

## Fachlicher Vertrag

Eine Person erhält direkt beim Benutzer **eine Rolle je Eventreihe**: kein Zugriff,
EDITOR oder EVENT_MANAGER. Dieselbe Person darf in verschiedenen Reihen andere
Rollen haben. Die Eventreihe bestimmt unabhängig davon, welche Produkte (QUIZ,
BINGO, POWERPOINT_KARAOKE) freigeschaltet sind. Später aktivierte Produkte verwenden
die vorhandene Reihenrolle automatisch; das ist ausdrücklich gewünschtes Verhalten.

Dies ersetzt das frühere Ziel einer Rolle pro Benutzer × Reihe × Eventart.
Die separate Eventartrechte-Matrix entfällt. Produkt und Rolle bleiben zwei
getrennte Voraussetzungen, aber Rollen werden nicht mehr je Produkt gepflegt.

| Fakt | Alleinige Quelle | Pflege |
| --- | --- | --- |
| Globale ADMIN-/Quiz-EDITOR-Rolle | GLOBAL in `benutzer_rollenzuweisungen` | Benutzerformular |
| EDITOR/EVENT_MANAGER je Benutzer × Reihe | `benutzer_reihenrollen` | Benutzerformular |
| Produktfreischaltung | `eventreihe_eventarten` | Eventreihe: Anlegen / Detail |
| Gemeinsame Stammdaten/Branding | `eventreihe_verwaltung` | Benutzerformular, getrennte Checkbox |

Diese Quellen sind die alleinige Berechtigungsquelle. `users.role`, alte
EVENT_SERIES-Zuweisungen, `eventreihe_benutzerrollen` und die ehemalige Tabelle
`benutzer_eventartrollen` erteilen keine zusätzlichen Rechte.

## Aufgaben je Format

| Rolle | Quiz | Bingo (zukünftig) | PowerPoint-Karaoke (zukünftig) |
| --- | --- | --- | --- |
| Editor | Fragen/Inhalte im bisherigen Workflow | Begriffe/Feldinhalte, z. B. Bullshit-Bingo | Keine Editorfunktionen definiert, daher kein Format-Zugriff |
| Eventmanager | Inhalte, Zusammenstellung, Durchführung/Auswertung im bisherigen Umfang | Inhaltsverwaltung und Durchführung | Durchführung |
| Admin | Global | Global | Global |

Bingo und Karaoke bleiben nicht implementiert. Die Tabelle definiert ihre
Rechtegrenze, keine bereits vorhandenen Spiele oder erfundenen Funktionen.
`hasEventTypeAccess` lässt Karaoke-Editoren ausdrücklich nicht zu.
Globale Quiz-Editoren erhalten keine Bingo-/Karaoke-/Reihenrechte.
Gemeinsame Verwaltung erteilt keine Spielrechte und umgekehrt. Neue Eventmanager
bekommen gemeinsame Verwaltung nicht automatisch; bisherige behalten ihr backgefülltes
Recht. Nur Admin verwaltet Benutzer und Produktfreischaltungen.

## Serverseitige Durchsetzung

`getActorPermissions` liest aktive Benutzer und die aktuellen Quellen je Aufruf.
Aus Reihenrollen und Produktstatus entstehen `eventTypeAssignments`. Ausschließlich
wirksame QUIZ-Rechte fließen in `AuthorizationActor.assignments` ein. Die bestehenden
Objektprüfungen für Fragen, Quiz, Medien, Storys, Teams, Antworten und Livezustand
bleiben bestehen. Keine Rechte aus ausgeblendeten Menüs, Sitzungsrollen oder Hosts.

Produktdeaktivierung sperrt Formatfunktionen, erhält Reihenrollen und Inhalte und
entzieht keine gemeinsame Verwaltung. Ein laufendes Quiz verhindert Deaktivierung;
Start und Deaktivierung teilen Advisory-/Quizlocks. Rechteentzug/Kontodeaktivierung
greifen beim nächsten Serveraufruf. Bereits ausgelieferte Inhalte sind nicht rückrufbar.
Kein Session-Reset. Subdomains verleihen keine Rechte.

Globale freigegebene Fragen dürfen im erlaubten Quiz verwendet werden. Globale
Originale und Kopierregeln bleiben geschützt; mehrfach verwendete Fragen verlangen
die bestehenden Rechte in allen betroffenen Reihen. Quiz-Editoren erhalten keine
Quiz-/Teamverwaltung. Globale Teamlöschung und Lifecycle-Aktionen bleiben beim Admin.

## Schreiben, Migration und Kompatibilität

Benutzeridentität, globale Rollen, Reihenrollen und gemeinsame Verwaltung werden in
einer serialisierbaren Transaktion gespeichert; unbekannte IDs/Rollen und doppelte
Reihen sind ungültig. Ein vollständiges neues Formular trägt einen Versionsmarker.
Alte bereits geöffnete reine Identitätsformulare ohne diesen Marker erhalten
Reihen-/Verwaltungsrechte. Veraltete Reihenfelder und die alte Matrix-Action werden
verständlich abgewiesen. Letzter aktiver globaler Administrator bleibt geschützt.

`20261025140000_event_type_permissions` bleibt unverändert. Die zusätzliche Migration
`20261025160000_series_roles` übernimmt eindeutige vorherige Rollen je Reihe samt
Zuweiser und Auditzeiten in die neue Quelle. Unterschiedliche Rollen desselben
Benutzers in derselben Reihe führen zum transaktionalen Abbruch, nicht zu einer
automatischen Höherstufung oder zum Verlust von Rechten. Vorherige Formatzeilen
bleiben beim Backfill unverändert und werden anschließend nur als abgeleiteter
Kompatibilitätsspiegel gepflegt. Direkte alte Matrix-Schreibzugriffe sind gesperrt. Für einen regulären Upgrade von Main existieren nach dem ersten Backfill
nur Quizrollen; dadurch entstehen keine solchen Konflikte.

`syncLegacyQuizRoles` spiegelt die Reihenrolle in die alte Formattabelle, damit
bereits ausgelieferte Preview-Instanzen keinen alten Rollenstand behalten. In die
beiden älteren Quizrepräsentationen schreibt er ausschließlich wirksame Quizrechte,
nie zurück in die maßgeblichen Reihenrollen. Sein Marker ist
transaktionslokal und kommt nicht aus Formularen. Sperren/Reaktivieren eines
Produkts ändern keine gespeicherte Reihenrolle. Globale Dual Writes bleiben erhalten.

Kein uneingeschränkter Code-Rollback auf Main nach Rechteänderungen: alter Code kann
Quizmanager wieder als Brandingverwalter interpretieren. Bei notwendigem Rückfall
Schreib-/sensible Zugriffspfade sperren, Quellen erhalten und korrigierten Code mit
neuen Gates bereitstellen. Keine Legacy-Rückkopie und kein Restore bestehender Daten.
Die Contract-Phase (Entfernen alter Tabellen) bleibt ein separater Auftrag.

## Bedienung und Prüfungen

Unter `/admin/users` Benutzer anlegen oder **Bearbeiten**. Globale Rollen und darunter
**Rollen je Eventreihe** pflegen; **Eventreihe verwalten** bleibt getrennt. **Speichern**
übernimmt alles gemeinsam. Keine zusätzliche Benutzerwahl oder globale Rollenmatrix.
Reihenrollen bleiben auch bei gesperrten Produkten in Liste/Formular sichtbar.

Unter `/admin/eventreihen` beim Anlegen **Freigeschaltete Eventarten** auswählen;
keine Vorauswahl. Spätere Änderungen in der Detailseite. Gemeinsame Verwalter dürfen
keine Produkte aktivieren. Bestehende individuelle Werte bleiben erhalten.

Automatische Prüfungen: Formularparser, Format-/Produktgates, echte Guards/Actions,
PostgreSQL-Migration einschließlich Konfliktabbruch, Benutzeranlage/-änderung,
Rechteentzug, aktuelle Konten, Quizstart und konkurrierende Deaktivierung. Die
gehostete Browserabnahme ergänzt diese Tests. Gemischte Events und eigentliche
Bingo-/Karaokefunktionen bleiben separate Aufgaben.
