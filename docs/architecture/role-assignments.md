# Rollen, Eventarten und gemeinsame Eventreihenverwaltung

Stand: 25. Oktober 2026. Erweiterung auf Basis von Main/PR #129. Auslieferung dieser
Erweiterung erst nach separater Review; kein automatischer Merge oder Production-Release.

## Verantwortung und Berechtigungsquelle

`app/roles/eventTypes.ts` definiert stabile Kennungen `QUIZ`, `BINGO` und
`POWERPOINT_KARAOKE`. Der additive DB-Katalog `eventarten` sichert Referenzen ab.
Bingo und PowerPoint-Karaoke sind nur administrative Freischaltungen/Rollen, noch
keine spielbaren Funktionen. Ein weiterer Katalogeintrag benötigt eine bewusste
Implementierung und Migration; er erteilt niemals automatisch Rechte.

Vier getrennte Fakten werden persistiert:

| Fakt | Tabelle | Wer ändert ihn? |
| --- | --- | --- |
| Globale Rollen ADMIN/EDITOR | `benutzer_rollenzuweisungen`, GLOBAL | Admin |
| Produkt pro Eventreihe aktiv/inaktiv | `eventreihe_eventarten` | Admin |
| EDITOR/EVENT_MANAGER je Benutzer × Reihe × Eventart | `benutzer_eventartrollen` | Admin |
| Gemeinsame Stammdaten/Branding verwalten | `eventreihe_verwaltung` | Admin |

Diese Tabellen sind die alleinige Berechtigungsquelle. `users.role`,
`eventreihe_benutzerrollen` und EVENT_SERIES-Zeilen in `benutzer_rollenzuweisungen`
sind keine Fallbacks. Identität/Sitzung allein erteilt keine Rechte.
`getActorPermissions` lädt alle Fakten mit aktivem Benutzerfilter bei jedem
Serveraufruf neu. Es gibt keinen Session- oder Subdomain-Rechtecache.

`AuthorizationActor.assignments` enthält globale Rollen sowie ausschließlich die
**wirksamen Quizrollen** aus den neuen Tabellen. Dadurch bleiben die in PR #129
abgesicherten Fragen-, Quiz-, Medien-, Team-, Story- und Live-Objektprüfungen an ihrem
bestehenden Ort. `eventTypeAssignments` enthält auch deaktivierte gespeicherte Rollen
mit `enabled=false`; `hasEventTypeAccess` verlangt Produkt und Rolle gemeinsam.
`managedEventSeriesIds` ist davon unabhängig. Client-Capabilities sind Anzeigehilfen,
keine Sicherheitsgrenze. Unbekannte Rollen/Scopes/Eventarten wirken fail-closed.

## Matrix und Objektgrenzen

Alle Reihenrechte verlangen ein aktives Konto. Formatgebundene Rechte verlangen
zusätzlich ein freigeschaltetes Produkt und den passenden Objektzugriff.

| Aktion | Admin | Globaler Quiz-Editor | Quiz-Editor einer Reihe | Quiz-Eventmanager | Bingo-/Karaoke-Eventmanager | Eventreihe verwalten |
| --- | --- | --- | --- | --- | --- | --- |
| Globale eigene Quizentwürfe bearbeiten | ja | ja, bisheriger Workflow | nein | nein | nein | nein |
| Freigegebene globale Fragen sehen | ja | ja | ja | ja | keine Quizrechte daraus | nein |
| Eigene Reihenentwürfe bearbeiten | ja | nur mit zusätzlicher Quizrolle | ja, bestehende Objektregeln | ja | keine Quizrechte | nein |
| Reihenfragen freigeben | ja | nur mit zusätzlicher Managerrolle | nein | alle zugeordneten Reihen erforderlich | keine Quizrechte | nein |
| Quiz zusammenstellen, moderieren, auswerten und Teams verwalten | ja | nein | nein | eigene Quizreihen | nein | nein |
| Gemeinsame Stammdaten/Logo/Standardbranding | ja | nein | nein | nur mit Zusatzrecht | nur mit Zusatzrecht | ja |
| Benutzer/Rollen/Produktfreischaltungen | ja | nein | nein | nein | nein | nein |

Admin behält globalen Verwaltungs-/Inhaltszugriff. Auch Admin startet kein Quiz mit
deaktiviertem Quizprodukt; der Runtime-Gate gilt zusätzlich. Globale Quizentwürfe
sind keiner einzelnen Reihenfreischaltung unterworfen. Neue Produkte erhalten keine
automatischen globalen Editorrechte. Gemeinsame Verwaltung kann ohne eine
Formatrolle vergeben werden. Neue Formatmanager erhalten sie niemals implizit.

`canSaveScopedQuestion` prüft gespeicherten und angeforderten Zielbereich, bei
bestehenden Fragen erneut unter Row-Lock. Globale Originale und Kopierverbote bleiben
geschützt; mehrfach zugeordnete Inhalte behalten die bisherigen Jeder-Reihe-Regeln.
`questionVisibilityWhere` filtert Suche, Ähnlichkeit und Dashboard; Urheberschaft
allein erhält keinen privaten Bereichszugriff. Review-Dashboard und Quiz-Dashboard
sind ebenfalls auf tatsächlich berechtigte Quizbereiche beschränkt.
`questionQuizUsageWhere` schützt Quizverwendungen einschließlich Anzahl/Filter.
Legacy-Frage-Actions behalten die VIEW-/EDIT-Objektprüfungen aus PR #129.

`getQuizSeriesChangeBlocker` schützt weiterhin Fragen, übernommene Storylinks,
Story-Platzierungen und Umfragen. Ein Reihenwechsel entfernt oder genehmigt keine
Inhalte. Gemeinsame Brandingrechte ersetzen keine Story-/Quizrechte. Stories sind
im derzeitigen Produkt Quiz-Inhalte; gemeinsame zukünftige Designelemente werden
in diesem Auftrag nicht neu modelliert. Templates behalten ihre bisherigen Admin-
und Objektregeln; keine neue formatspezifische Templateimplementierung.

Medienupload-Autorisierung verwendet weiterhin Frage/Quiz/Template-Objektprüfungen;
Reihenlogos verwenden das separate gemeinsame Verwaltungsrecht. Bereits bekannte
öffentliche Bild-/Blobadressen lassen sich durch einen Rollenentzug nicht aus
Browsern zurückrufen. Es wird keine neue private Medienauslieferung behauptet.

## Deaktivierung, Runtime und Sitzungen

`setEventTypeEnabled` ändert ausschließlich die Produktfreischaltung. Inhalte und
neue Rollen bleiben erhalten und werden nach Reaktivierung wieder wirksam. UI und
Erfolgsmeldungen weisen darauf hin. Nicht freigeschaltete Rollen können im Voraus
konfiguriert werden; dies schaltet kein Produkt frei.

Quiz-Deaktivierung prüft den tatsächlichen `quiz_praesentation_status`:
`quiz_started_at IS NOT NULL AND quiz_stopped_at IS NULL` bedeutet RUNNING, auch bei
archiviertem Quiz. Ein laufendes Quiz blockiert die Deaktivierung verständlich.
Start und Produktänderung nehmen zuerst denselben transaktionalen Advisory-Lock
(860012, Eventreihen-ID), danach die bestehenden Quiz-Row-Locks. Produktänderungen
lesen unter Read Committed nach dem Warten den aktuellen Lifecycle. Das vermeidet
einen veralteten Serializable-Snapshot. Matrix- und Kontoschreibvorgänge bleiben in
einer serialisierbaren Transaktion mit begrenztem Retry.

`requireQuizProductEnabled` prüft im gesperrten Antwort-/Startpfad erneut die aktuelle
Freischaltung. Signierte Teamsitzungen und öffentlicher Join-Status verlangen das
aktive Quizprodukt. JSON/ICS liefern keine Quiztermine deaktivierter Quizprodukte;
öffentliche Reihenmetadaten bleiben unabhängig davon erhalten.

Rollenentzug und Kontodeaktivierung wirken beim nächsten Serveraufruf mit bestehendem
Cookie. Bereits gelieferte Inhalte verschwinden nicht rückwirkend; ein bereits
autorisierter gleichzeitiger Aufruf wird nicht zentral abgebrochen. Teamidentitäten
haben weiterhin ihren getrennten signierten Zugang, keine Benutzerrollenzuweisung.
Erfolgreiche Matrix-/Produktänderungen verwenden das bestehende technische Console-Audit mit IDs und Eventart, ohne Personendaten.
Es gibt keinen Session-Reset. Reconnect, Antworten und Bewertung bleiben unverändert.

## Administrative Bedienung

`/admin/users`: Globale Rollen im bestehenden Kontoformular, daneben eine unabhängige
Eventartrechte-Matrix mit Benutzerwahl, Eventreihen als Zeilen und drei Eventarten
als Spalten. „Kein Zugriff“ löscht nur die betreffende neue Zuweisung. Die separate
Checkbox „Eventreihe verwalten“ verleiht weder Quiz- noch Benutzer-/Produktrechte.
Die Tabelle scrollt auf schmalen Bildschirmen horizontal. Die bisherige Benutzerliste
wird ausdrücklich als Zusammenfassung **wirksamer Quizrollen** gekennzeichnet.
Kontospeichern verändert keine Eventart- oder gemeinsamen Verwaltungsrechte.
Neue Konten können zunächst ohne Rechte angelegt werden (Least Privilege); danach
vergibt der Admin die gewünschten Matrixrechte. Letzter aktiver Admin bleibt geschützt.

`/admin/eventreihen/:id`: Produktfreischaltungen sichtbar; nur Admin kann sie ändern.
Gemeinsame Verwalter können Stammdaten/Branding bearbeiten. Ohne Quizverwaltungsrecht
werden keine Quizobjekte/Quizanzahlen ausgegeben. Die Rollenübersicht bezeichnet ihre
bestehenden Profile ausdrücklich als Quizprofile und erläutert Zusatzrechte.

## Migration und Kompatibilität

`20261025140000_event_type_permissions` ist eine additive Transaktion:
Katalog/Tabellen/FKs/Indizes und Rollen-Check-Constraint anlegen; bestehende Reihen
für QUIZ aktivieren; ausschließlich aktuelle EVENT_SERIES-Assignments auf Quiz
übertragen; nur bisherigen EVENT_MANAGERn gemeinsame Verwaltung zuweisen.
Zuweiser und Auditzeiten werden beim Backfill übernommen. Globale Rollen, Benutzer,
Inhalte, Zuordnungen und Ergebnisse bleiben unverändert. Keine Bingo-/Karaoke-
Freischaltung oder -Zuweisung durch den Backfill, auch nicht für Admin.

Legacy-Schreibpfade sind bewusst nicht weiter als Rechtequelle kompatibel:
Alte Membership-Actions und Reihenfelder alter Kontoformulare werden verständlich
abgewiesen; der alte interne Reihen-Writer wirft einen Validierungsfehler.
Datenbanktrigger sperren direkte/alte EVENT_SERIES- und Membership-Schreibvorgänge
nach dem Backfill. Nur `syncLegacyQuizRoles` setzt transaktionslokal den Marker für
die Projektion wirksamer Quizrechte in beide Altstrukturen. Globale Dual Writes
bleiben erhalten. Dieses Flag ist keine Clientberechtigung und wird nie aus
Formulareingaben übernommen. Reaktivierung restauriert die Quizprojektion aus den
neuen gespeicherten Rechten. Neue Quellen werden nie aus Legacy-Daten rekonstruiert.

Der frühere Expand-and-Contract-Vertrag aus Paket 1.5 wird damit für Reihenrechte
bewusst abgelöst. Ein uneingeschränkter Rollback auf Main #129 würde ein neues
Quizmanagerrecht wieder als Brandingrecht interpretieren und kann ein bereits entzogenes
gemeinsames Recht wieder erteilen. Deshalb ist ein bloßer Code-Rollback nach Matrixänderungen
**nicht sicher**. Siehe verbindlichen [Migrations-/Rückfallplan](../operations/event-type-permissions-20261025.md).
Die spätere Contract-Phase (Entfernen der Altstrukturen) ist weiterhin ein separater
Auftrag; keine Historie wird gelöscht oder zurückgesetzt.

## Erweiterungsgrenze und Prüfungen

Eventreihe bleibt Grenze für Produkte, Benutzerzuweisungen und gemeinsame Verwaltung.
Fragen bleiben Quiz-Inhalte mit GLOBAL/mehrfachen Reihen, keine implizite universelle
Inhaltstabelle. Es wird kein neues Eventobjekt mit zwingend genau einer Eventart
angelegt. Gemischte Veranstaltungen, neue Navigation, gemeinsames Designsystem,
Subdomains und eigentliche Bingo-/Karaokefunktionen bleiben separate Aufgaben.

`npm run test:authorization`: echte Actions/API mit echten Guards und isolierten
Auth-/Persistenzadaptern. `eventTypes.test.ts`: getrennte Rechtekombinationen und
Produktgates. `scripts/testing/event-types.integration.test.ts`: echtes PostgreSQL,
frische leere QA-Datenbank, unveränderte Bestandsdaten, Backfill, Legacy-Sperre,
reale Admin-/Konto-/Start-Actions, laufende/konkurrierende Starts und Deaktivierung.
CI führt den DB-Test im bestehenden isolierten PostgreSQL-Job aus. Lokale
Browserabnahme und verbleibende Grenzen stehen im Betriebsbericht.
