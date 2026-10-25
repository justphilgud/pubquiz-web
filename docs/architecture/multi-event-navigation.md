# Verwaltung nach Eventreihe und Eventart

Stand: 25.10.2026. Navigationspaket auf Grundlage von Main/PR130, ohne Schemaänderung.

## Verantwortung und Routen

`app/workspaces/workspacePolicy.ts` bildet aus bestehenden Rollen- und Produktprüfungen den Navigationskatalog. `workspace.server.ts` liest ausschließlich aktuelle Zuordnungen des aktiven Benutzers und freigeschaltete Produkte. Die Navigation erteilt keine Objektberechtigung. Bestehende Actions und Objekt-Guards bleiben maßgeblich.

Der kanonische Reihenarbeitsbereich lautet `/workspaces/{id}/{quiz|bingo|karaoke}/{Bereich}`. Quizbereiche sind `content`, `questions`, `stories`, `polls`, `events` und `teams`. `/workspaces/{id}/settings` öffnet die erlaubte gemeinsame Reihenverwaltung. Die wiederverwendbaren Seitenkörper liegen außerhalb der Next-Seiteneinstiege; alte Routen rendern weiterhin dieselben Komponenten.

Die Reihe kommt aus dem URL-Pfad, nicht aus lokalem Speicher. Ein Wechsel übernimmt nur einen ausdrücklich erlaubten Sammlungsbereich, niemals eine Objekt-ID, einen Entwurf oder Suchparameter der vorherigen Reihe. Ohne passenden Bereich wird eine gültige Startseite gewählt. Feste Inhalts-Unterbereiche binden auch den Inhaltstyp; Queryfilter können Reihe und Typ nicht überschreiben. Filter zurücksetzen erhält den Reihen-Kontext. Inhaltssuchen werden beim Reihen-/Bereichswechsel neu gemountet; bestehende Generation-Guards verwerfen verspätete Suchantworten.

Alte Objektlinks bleiben gültig. Ihr sichtbarer Kontext wird aus der tatsächlichen Datenbankzuordnung aufgelöst; weder `returnTo` noch Präferenzen sind dafür vertrauenswürdig. Die Auflösung zeigt nur Reihen aus dem aktuellen berechtigten Katalog. Globale und mehrfach zugeordnete Inhalte werden entsprechend beschriftet. Während der asynchronen Auflösung erscheint ein neutraler Prüfstatus, keine behauptete globale Zuordnung. Veraltete Antworten einer früheren URL werden ignoriert.

## Menü und Rechte

- Suchbare Eventreihe, darunter beziehungsweise daneben deren freigeschaltete und berechtigte Eventarten. Bei einer einzigen Reihe gibt es einen direkten Link statt eines Auswahlmenüs.
- Quiz: Inhalte mit Fragen, Story-Elementen und Umfragen; für Eventmanager zusätzlich Quizveranstaltungen und Teams.
- Reiheneinstellungen sind an das eigenständige Verwaltungsrecht gebunden; allein dieses Recht genügt auch ohne Spielrolle oder Produktfreischaltung.
- „Reihenübergreifend“ öffnet die bestehende erlaubte Inhaltsbibliothek. Dies ist keine künstliche Datenbankreihe und kein zusätzliches globales Schreibrecht. Freigegebene globale Fragen bleiben hier entsprechend bestehender Regeln erreichbar.
- Administration ist globalen Administratoren vorbehalten und enthält Eventreihen, Benutzer, Quiz-Präsentationstemplates, globale Teams, Kategorien, Fragenvorlagen, externe Fragen und Monitoring.
- Globale Quiz-Editoren erhalten ihre bisherige Bibliothek, aber keine Reihen-, Bingo-, Karaoke- oder Administrationsrechte ohne gesonderte bestehende Zuweisung.
- Bingo und PowerPoint-Karaoke zeigen ausschließlich „Noch nicht verfügbar“. Für Karaoke-Editoren wird weder ein Menüeintrag noch eine Oberfläche angeboten.

Die bestehenden Produkt- und Rollenprüfungen werden wiederverwendet. Eine Produktfreischaltung allein erteilt keinem Benutzer eine Rolle; eine Rolle allein schaltet kein Produkt frei. Ein nicht mehr berechtigter Direktaufruf oder ein deaktiviertes Produkt führt im Workspace zu 404. Auch Administratoren sehen dort nur tatsächlich freigeschaltete Produkte; ihre bestehenden globalen Verwaltungsrechte bleiben erhalten.

## Formulare und Bedienung

Kontextziele sind echte Links, damit der bestehende Änderungswarnschutz des Frageneditors greift. Story-, Umfrage- und Quiz-Erstellungsformulare verwenden denselben Bestätigungsgrundsatz über einen kleinen gemeinsamen Navigationshook: Abbruch erhält den Entwurf; nur erfolgreiche Speicherung erlaubt die anschließende automatische Navigation. Mehrere gleichzeitig montierte Quizformulare lösen pro Klick höchstens eine gemeinsame Warnung aus. Es gibt keinen neuen Autosave und keine Änderung an Live-Drafts oder Teamformularen.

Auswahlmenüs verwenden beschriftete Buttons, eine Suchbox und fokussierbare Links. Tab navigiert zu Treffern, Escape schließt und stellt den Triggerfokus wieder her; Außenklick schließt ebenfalls. Die Menühöhe ist begrenzt und scrollt intern. Es gibt keine persistierte letzte Auswahl, die einen Direktlink überschreiben könnte. Lokale Loopback-Testhosts sind ausschließlich für die sechs getrennten Browser-Testkonten als Development-Origins zugelassen.

## Gestaltung und künftige Erweiterung

Die bisherigen Präsentationstemplates sind global verwaltete Quiz-Darstellungswelten einschließlich ihrer bestehenden Renderingverträge. Sie werden ausdrücklich als Quiz-Präsentationstemplates eingeordnet. Das Reihenlogo und allgemeine Stammdaten gehören zur gemeinsamen Reihe; vorhandene Präsentations-/Antworttemplate-Standards gelten weiterhin für Quiz.

Gemeinsames Branding mehrerer Formate erfordert später einen ausdrücklich vereinbarten gemeinsamen Brandingvertrag, den formatspezifische Renderer konsumieren. Dieses Paket konvertiert keine Templates und erfindet keine Bingo-/Karaoke-Einstellungen. Der Workspace ist ein Arbeitskontext; er erweitert das Veranstaltungsdatenmodell nicht um eine dauerhafte Festlegung auf genau eine Eventart. Gemischte Veranstaltungen bleiben ein gesondertes Vorhaben.

## Preview und Betrieb

Die Preview nutzt ausschließlich die vorhandene synthetische Datenbank `pr130_review_20261025` auf dem Development-Host `ep-dry-dust-aljik09f-pooler.c-3.eu-central-1.aws.neon.tech`. Die neue Navigation verwendet einen eigenen eingeschränkten Datenbanklogin. Ein Leseversuch dieses Logins auf Development-Bestandsdaten wurde abgewiesen. Vorhandene synthetische PR130-Fixtures und die 61 Migrationseinträge bleiben erhalten; keine Production-Daten werden kopiert.

`isolated_navigation` in `deploy-preview.yml` ist auf exakt `codex/multi-event-navigation` gebunden. Ohne diesen Schalter kann der Branch keine Preview auf dem geteilten Standardziel bereitstellen. Exakter erfolgreicher Push-CI-Head, menschlich freigegebene Branch-Allowlist und Environment-Policy sowie zentrale Medien- und Datenbankidentitätsprüfungen bleiben erforderlich. Die menschliche Freigabe dieses Branches wurde im Auftrag ausdrücklich erteilt. Secrets liegen ausschließlich geschützt bei GitHub/Vercel; der Quellcode enthält keine Zugangsdaten.

Kein Merge und kein Production-Deployment sind Bestandteil dieses Auftrags. Bingo/Karaoke sind nicht spielbar. Historischer Backup-Readback-Fehler und echter Wochenlauf bleiben unveränderte separate Betriebspunkte.
