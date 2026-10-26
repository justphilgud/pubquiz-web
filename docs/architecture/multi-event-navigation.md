# Gemeinsame Verwaltung und stabile Navigation

Stand: 26.10.2026. Verbindliche fachliche Überarbeitung von PR #131. Die frühere Reihenhierarchie und die Empfehlungen „Teambestand/Präsentationstemplates unter Quiz“ sind durch die neue Entscheidung ersetzt. Kein neues Berechtigungsmodell, keine Migration, kein Merge oder Production-Deployment.

## Struktur und Verantwortung

Die feste Reihenfolge lautet **Quiz · Bingo · PowerPoint-Karaoke · Teams · Templates · Eventreihen · Administration**. Quiz hat genau ein Dropdown mit **Inhalte** und **Quizze**. Es gibt keine zweite dauerhafte Quiz-Unterleiste. Auf kleinen Bildschirmen enthält die kompakte Hauptnavigation dieselben berechtigten Einträge in derselben Reihenfolge. Konto bleibt separat.

- `workspacePolicy.ts:getNavigationCapabilities` bildet den Katalog aus bestehenden Policies und allen aktuell erlaubten Reihen. Der Seitenpfad bestimmt nur den Aktivmarker, keine zusätzlichen Rechte. Ein Reihenfilter verändert die Hauptpunkte nicht.
- `workspace.server.ts:loadWorkspaceNavigation` liest den aktuellen Actor und Produktkatalog pro Request; keine gespeicherte letzte Auswahl überschreibt URLs. Der Header braucht keinen asynchronen Objektbesitz-Readback mehr. Tatsächlicher Besitz bleibt in den vorhandenen Objektseiten/Metadaten sichtbar.
- `WorkspaceNavigation` und `NavigationDropdown` verantworten Reihenfolge, Aktivmarker, Dropdown-/Mobilzustand und Fokus. `AppHeader` behält Authentifizierung, Konto und vorhandene Abmeldung. Keine neue Sessionlogik.
- `EventSeriesPicker` ist ein beschrifteter durchsuchbarer Auswahlbaustein mit begrenzter Ergebnisliste. Er verändert entweder einen lokalen Filterentwurf oder öffnet einen echten Sammlungslink. Er schreibt keine Objektzuordnungen und entscheidet keine Rechte.
- Bestehende Sammlungen, Formulare, Actions, Repositories und Objektprüfungen bleiben für Datenzugriff und Fachregeln verantwortlich.

## Rechte und Verfügbarkeit

Inhalte folgen der bestehenden Quiz-Redaktionspolicy; Quizze der bestehenden Manager-/Adminberechtigung. Globaler Quiz-Editor erhält seine bisherige Bibliothek, keine neuen Reihen-/Managerrechte. Bingo und Karaoke werden aus dem gesamten zulässigen Katalog angeboten, nicht nur aus der aktuellen Reihe. Admin erhält einen globalen Produkteinstieg; das aktiviert kein Reihenprodukt. Die konkrete Workspace-URL prüft weiterhin Freischaltung und Rolle. Karaoke bietet Editoren keine Funktion.

Teams verwendet ausdrücklich `canAccessTeamManagement` aus der bestehenden Team-Policy. Eine reine Bingo-Rolle gewährt dadurch **keinen** Zugriff auf vorhandene Quizteams. Templates bleibt Admin-only. Eventreihen ist für die nach heutigen Regeln sichtbaren Reihen erreichbar, Bearbeitung nur mit vorhandener eigener Verwaltungsfreigabe oder als Admin. Reine Reihenverwaltung braucht keine Spielrolle. Administration bleibt Admin-only; Produkte werden in der Reihe, Benutzerzuordnungen beim Benutzer gepflegt.

Entzogene Rechte/deaktivierte Produkte werden bei neuen Requests aus den vorhandenen serverseitigen Policies übernommen. Verbotene Direktlinks werden abgewiesen; sichtbare Links ersetzen keine Objektkontrolle. Keine stillen Ersatzrollen oder Freischaltungen.

## Lokaler Filter, Zuordnung und kompatible Routen

Die Haupteinstiege `/content`, `/quiz`, `/admin/teams`, `/templates`, `/admin/eventreihen` und bestehende Adminseiten bleiben erhalten. `/bingo` und `/karaoke` sind ausschließlich vorbereitete Übersichtsseiten. Dort stehen keine Spielaktionen bereit.

Sammlungen öffnen den erlaubten Gesamtbestand. Die lokale Reihenauswahl ist durchsuchbar und unterstützt lange Namen sowie 100+ Einträge. Inhalte verwenden ihren bisherigen URL-/Anwenden-Vertrag, Teams den vorhandenen GET-Filter. Quizlisten verwenden `series` für den Listenfilter und `status` für den Status, getrennt vom alten `eventreiheId` zur Vorbelegung eines neuen Quiz. Eine Anlegezuordnung bleibt im Formular ausdrücklich erforderlich und wird wie bisher serverseitig validiert.

Workspace-Direktlinks bleiben kompatibel. Ihr Pfad bindet die Reihe und den festen Inhaltstyp serverseitig/bei der Suche. Der lokale Reihenwechsel führt wieder in denselben Sammlungsbereich. `workspaceCollectionHref` nimmt nur bekannte Suchfilter mit, keine alten Objekt-, Entwurfs- oder Rücksprung-IDs. „Alle erlaubten Reihen“ öffnet die entsprechende Gesamtbibliothek; Story-Auswahl bleibt Story-Auswahl, sie springt nicht zu Quizzen.

`quizCollectionReturnHref` erhält einen validierten Rückweg zur Quizliste samt Filtern. Ohne Herkunft wird die tatsächliche Quizreihe als Filter verwendet. Externe Ziele, fremde Workspace-Reihen und Objektziele werden verworfen. Teamprofile können über `teamCollectionReturnHref` zur Ausgangssammlung zurückkehren. Berechtigungen des Rückziels werden dort normal geprüft.

Die Inhaltsliste bindet ein Suchergebnis an seinen abgeschlossenen URL-/Refresh-Kontext. Solange ein neuer Kontext noch lädt, werden die alten Treffer und Cursor nicht angezeigt/bedient. Eine Generation verhindert zusätzlich, dass verspätete Antworten einen neueren Suchstand überschreiben. Das behebt den in der Browserabnahme beobachteten kurzzeitigen alten Trefferstand.

Es gibt keine neue Filterpräferenz in Storage. Vorhandenes Scroll-/Fokus-Resume bleibt an die konkrete URL gebunden. Haupt-/Kontextziele sind echte Links, damit die bestehenden Dirty-Guards greifen. Keine neuen Live-Drafts, kein Autosavevertrag. Escape schließt das nächste Dropdown und stellt dessen Fokus wieder her; außerhalb schließt die bestehende Popoverlogik.

## Teams: gemeinsame Identität, getrennte Teilnahme

`teams` bleibt eine globale wiederverwendbare Identität ohne direkte Eventreihen-Fremdschlüssel: Name, Passwort, Foto/Avatar und Archivzustand. `quiz_team_sessions` und `quiz_teams` behalten konkrete Quizteilnahme, Antworten und Ergebnisse. Profil/Passwortänderungen wirken global und werden entsprechend beschriftet.

Der Hauptpunkt **Teams** ist ein gemeinsamer Einstieg, kein neuer gemeinsamer Autorisierungsvertrag. Sichtbare Teilnahmehistorie, M-Scope und Admin-Lifecycle bleiben unverändert. Am konkreten Quiz bleiben Moderation und Auswertung mit Teilnahmeinformationen erreichbar. Dieses Paket baut keinen zusätzlichen Teilnehmermanager und keine Bingo-/Karaoke-Teilnahmelogik. Spätere Formate können die Identität weiterverwenden, benötigen dafür eigene ausdrücklich definierte Teilnahme-/Auswertungsverträge.

## Templates und gemeinsames Erscheinungsbild

Drei Dinge bleiben fachlich getrennt:

1. **Reihenbranding:** vorhandenes `eventreihen.logo_url`, Name/öffentlicher Name und Stammdaten. Das Logo ist ein gemeinsames Asset; heute konsumieren es die bestehenden Quizoberflächen.
2. **Designvorlage:** vorhandene `PresentationTemplateConfig` enthält `BrandTokens`, semantische `design`-Bausteine und validierte Assets. Farben, Schriftdefinitionen, Logo-/Assetreferenzen, Abstände und Radien sind gemeinsame Gestaltungswerte und mögliche Grundlage eines künftigen gemeinsamen Grunddesigns. Bereits gemeinsam nutzbar heißt hier wiederverwendbare Daten/Assets; kein heute funktionierender Bingo-Renderer.
3. **Formatspezifisches Layout/Verhalten:** `surfaces.presentation`, `moderation`, `answerForm`, Quiz-Templateauflösung und `ResolvedQuizTheme` sind derzeit Quizverträge. Varianten, Folien, Frage-/Lösungsdarstellung und Laufzeitlogik sind keine fertigen Bingo-/Karaokelayouts.

Der Hauptpunkt **Templates** öffnet die bestehende Verwaltung mit ihren bisherigen Admin-, Versions-, Archiv- und Zuweisungsregeln. Keine neue Bingo-Designinsel, keine automatische Konvertierung, keine Rendereränderung. Die Reihenstandards bleiben vorhandene Quizvorgaben und werden nicht als universelles Mehrformat-Rendering verkauft.

Das anschließende Renderingpaket muss einen versionierten gemeinsamen Grunddesignvertrag festlegen (Branding/Design-Tokens und Priorität Reihe → Designvorlage → konkretes Spiel), dazu formatbezogene Capability-/Layoutverträge und Adapter. Erst dann können Quiz und Bingo derselben Reihe denselben Grundentwurf konsumieren. Bestehende Quizvarianten müssen kompatibel bleiben, Validatoren und Tests jede tatsächlich unterstützte Oberfläche prüfen. Die neue Navigation nimmt keine Schema-/Rendererabkürzung vor, die eine Designvorlage dauerhaft auf genau eine Eventart festlegt.

## Verifikation und Betrieb

Gezielte Regressionen liegen in `workspacePolicy.test.ts` und `contentLibrary.test.ts`: Union der Berechtigungen, reine Verwaltung, Bingo-only ohne Quizteamzugriff, aktiver Bereich alter Objektlinks, aufgabengetreue Filterziele, sichere Rückwege und Zurückhalten alter Suchtreffer. Bestehende Team-/Content-/Header-/Mobiltests bleiben erhalten.

Browserabnahme ausschließlich mit synthetischen Konten/Reihen in `pr130_review_20261025`. Die bestehende Preview-Branchfreigabe und alle CI-/Environment-/Medien-/Datenbankgates gelten unverändert. Runtime- und Migrationslogin bleiben getrennt. Keine neue Migration und keine Änderungen an Production, Antworten, Punkten oder laufenden Sessions. Die frühere Backup-Readback-Ursache und der echte Wochenlauf bleiben separate Betriebspunkte.

Die ausführliche aktuelle Browser-/Deploymentabnahme wird im PR-Übergabebericht dokumentiert. Historische Berichte vom 25./26.10. sind ausdrücklich als überholt markiert, ihre damaligen Befunde werden nicht umgeschrieben.
