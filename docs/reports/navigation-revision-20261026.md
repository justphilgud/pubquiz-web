# PR #131 – überarbeitete Navigation zur fachlichen Abnahme

Stand 26.10.2026. Verbindlicher Auftrag ersetzt die frühere Reihenhierarchie und die Empfehlungen Teams/Templates unter Quiz. **Kein Merge, kein Production-Deployment, keine fachliche Freigabe vorweggenommen.**

## Umsetzung

Hauptpunkte in fester Reihenfolge: **Quiz · Bingo · PowerPoint-Karaoke · Teams · Templates · Eventreihen · Administration**, jeweils aus den bestehenden Berechtigungen über alle erlaubten Reihen. Quiz hat nur das Dropdown **Inhalte / Quizze**, keine zusätzliche dauerhafte Unterleiste. Mobil werden dieselben berechtigten Ziele in einer kompakten Navigation angeboten.

Sammlungen öffnen den erlaubten Gesamtbestand. Eventreihen werden lokal und durchsuchbar gefiltert. Filter ändern keine Objektzuordnung. Alte Workspace- und Objektdirektlinks bleiben erhalten; Workspacewechsel behalten den Arbeitsbereich. Sichere Quiz-/Teamrückwege erhalten Such- und Reihenfilter, übernehmen keine externen Ziele oder Bearbeitungs-IDs.

Gemeinsame Teamidentitäten und Profile bleiben unverändert. Hauptpunkt Teams verwendet die bestehende Team-Policy; reine Bingo-Rollen erhalten keine bestehenden Quizteamrechte. Vorhandene Historie, globale Profil-/Passwortwirkung und Admin-Lifecycle bleiben erhalten. Es gibt keine Bingo-/Karaoke-Teilnahmen.

Templates ist ein gemeinsamer Einstieg in die vorhandene Adminverwaltung. Vorhandene Templates rendern weiterhin ausschließlich ihre bestehenden Quizoberflächen. Gemeinsam wiederverwendbare Assets/BrandTokens und das Reihenlogo sind vom heute formatspezifischen Layoutvertrag unterschieden. Die [Architektur](../architecture/multi-event-navigation.md) beschreibt das spätere gemeinsame Grunddesign mit Formatadaptern. Keine Renderer-/Schemaänderung und keine Bingo-Designinsel.

Bei der Browserprüfung nachgewiesen und korrigiert: Die Inhaltsliste zeigte während einer neuen URL-Suche kurz den vorherigen Trefferstand. Ergebnisse werden jetzt nur für ihren abgeschlossenen Suchkontext angezeigt; alte Treffer/Cursor sind während des neuen Ladestands verborgen. Eine gezielte Regression sichert dies ab.

## Tatsächliche lokale Browserabnahme

Fertiger lokaler Build, getrennte Cookie-Sitzungen für sechs bekannte synthetische Konten auf Loopback-Testhosts. Identität in jedem Kontomenü bestätigt. Datenbank ausschließlich `pr130_review_20261025`, kein Productionbestand.

| Rolle | Tatsächlich geprüft |
|---|---|
| Admin | Stabile gleiche Hauptpunkte auf Inhalte, Teams, Templates, Eventreihen, Benutzerverwaltung; Quizdropdown Inhalte/Quizze; Quizfilter mit 110 Suchtreffern plus Gesamtauswahl; langem Namen; Quiz A öffnen und zurück zu `/quiz?series=117` |
| Globaler Quiz-Editor | Nur Quiz-Inhalte, keine Quizverwaltung; ausschließlich zugängliche freigegebene globale Frage in den isolierten Suchdaten |
| Eventmanager | Erlaubte Format-/Team-/Reiheneinstiege; Teamliste B enthält nur Team B; Profilhinweis zur globalen Wirkung; Rückweg erhält Team-Reihenfilter; Quiz A und bestehende Live-Einstiege erreichbar |
| Reiheneditor | Bingo nur Platzhalter; keine Karaoke-, Team- oder Templatefunktion; fremde Frage ID 2 und manipulierte fremde Workspace-ID abgewiesen (Seite nicht gefunden) |
| Nur Reihenverwaltung | Einziger Arbeitsbereich Eventreihen; Zugriff auf Reihe 005 und Logo trotz fehlender Produkte/Spielrolle; Produktfreigabe nicht bedienbar |
| Ohne Rechte | Klare Leerseite; direkter Bingo-Aufruf abgewiesen |

Weitere tatsächlich ausgeführte Wege:

- Inhaltsfilter A → B bleibt `/content`, ohne Sprung zu Quizzen. Während der Suche nur Überschrift/Ladestand, anschließend passende Treffer. Zurück zu A, Vorwärts zu B und vollständiger Reload zeigen die zugehörigen Daten.
- Quiz A → Zur Übersicht erhält Reihe 117. Globale Sammlungen verlangen vor dem Suchen keine Pflichtreihenauswahl.
- Produkt Quiz in synthetischer Reihe 117 kurz deaktiviert: bestehendes Editorfenster nach Reload abgewiesen. Wiederhergestellt, derselbe Aufruf erfolgreich.
- Editorrecht 117 für synthetischen Benutzer 9 kurz entzogen: bestehendes Fenster nach Reload abgewiesen. Ursprüngliche Editorrolle wiederhergestellt, zweite Zuordnung 121 erhalten. Keine echten Berechtigungen geändert.
- Daten-/Rechtevergleich nach Wiederherstellung erfolgreich: alle 63 Historienzeilen unverändert (61 erfolgreich, zwei historisch zurückgerollt), Fingerabdruck `d93a751cf6b478ca8e0e18c01baa8cea`; geprüfte synthetische Rollen/Produktflags entsprechen der Ausgangslage.
- Moderation, Präsentation und öffentliches Antwortformular von Testquiz A geöffnet: Vorbereitung, Begrüßung bzw. Teambeitritt; keine neue Verwaltungsnavigation darin. Kein Start, Reset, Teambeitritt oder Absenden einer Antwort.
- Angeforderte Viewports 1366 × 768, 1920 × 1080 und 390 × 844: Dokumentbreiten 1351/1905/375 px einschließlich Scrollbar, kein horizontaler Überlauf. Quiz-Dropdown per Tastatur geöffnet/geschlossen, Fokus sichtbar. Mobile Hauptnavigation und Quizauswahl bedient. Der finale gehostete Head wird zusätzlich für Fokus-/Dropdownverhalten geprüft.

## Ehrliche Prüfgrenze: ungespeicherte Änderungen

Die vorhandenen Dirty-Guards bleiben in Fragen-, Story-, Umfrage- und Quizformularen erhalten; echte Navigationslinks durchlaufen die bestehenden Capture-Handler. Der neue Navigator ersetzt diese nicht.

Beim tatsächlichen Versuch, einen ungespeicherten synthetischen Fragenentwurf über Teams zu verlassen, blockierte der native Bestätigungsdialog die Browsersteuerung. Die Dialog-API lieferte keinen zuverlässig bedienbaren Dialog; der Abbruch und anschließende Erhalt des Entwurfs wurden deshalb **nicht erfolgreich verifiziert**. Das eigene blockierte Fenster wurde geschlossen, nichts gespeichert. Kein Ursachenfix behauptet, keine Bestätigungen entfernt oder automatisch unterdrückt. Dieser Punkt bleibt eine manuelle fachliche Abnahmeprüfung in der neuen Preview. Es wurden keine Nutzertests durchgeführt.

## Prüfungen und CI

- Typecheck und striktes ESLint für geänderte/neue TypeScriptdateien erfolgreich.
- 56 gezielte Navigations-, Inhalts-, Team-, Header-/Mobilprüfungen erfolgreich; zusätzlich der betroffene Lifecycle-/Navigationssatz mit 37 erfolgreichen Prüfungen (überlappende Tests, nicht addiert).
- Lokaler fertiger Webpack-Build erfolgreich. Die vollständigen erforderlichen CI-Jobs prüfen den finalen Branchhead erneut einschließlich Build und realem PostgreSQL.
- Der erste neue CI-Lauf stoppte an einem alten Quelltextassert für parameterlose Quizlinks. Die Erwartung wurde gezielt auf den freigegebenen sicheren `returnTo`-Vertrag erweitert; keine Lifecycle-/Sicherheitsprüfung entfernt. Neuer vollständiger CI-Lauf vor Preview erforderlich.
- Exakter finaler SHA, CI-/Deploymentlauf, Vercel-READY-/Aliasbeleg und gehostete Nachprüfung werden im PR-Übergabeprotokoll festgehalten. Dieser Bericht macht aus einem laufenden Workflow keinen Erfolgsnachweis.

## Geänderte Verantwortlichkeiten / Dateien

- `app/workspaces/`: stabiler Rechtekatalog/Aktivmarker, kompakte Navigation/Dropdown, Suchauswahl und kompatible lokale Workspacefilter; vorbereitete Formatseiten unter `app/bingo` und `app/karaoke`.
- `AppHeader`: vorhandene Auth-/Kontoverantwortung, Übergabe des globalen Katalogs.
- Inhaltsbibliothek: Suchauswahl und Schutz vor alten Treffern; keine neuen Inhalts-/Freigaberechte.
- Quizliste/-detail: URL-Filter und sichere Rückwege; keine Änderung an Durchführung/Bewertung.
- Teamliste/-detail: gemeinsamer Einstieg, vorhandene Scopefilter und Rückwege, globale Wirkung erklärt; Teamservices unverändert.
- Templates: kurzer Titel und ehrliche Formatabgrenzung; bestehende Verwaltung/Renderer unverändert.
- Architektur, Regressionstests und historische Kennzeichnung der alten Berichte/Entwürfe.

Geöffnete Previewansichten für den neuen Stand neu laden. Kein Session-Reset. Bingo/Karaoke bleiben nicht spielbar. Historischer Backup-Readback-Befund und erster echter Wochenlauf sind unveränderte separate Betriebspunkte; kein zusätzliches Backup.
