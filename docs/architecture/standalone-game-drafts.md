# Eigenständige Spielentwürfe – Arbeitspaket 1

Bingo und PowerPoint-Karaoke verwenden `pubquiz.game_drafts`, keine Quizze. Die UUID ist dauerhaft; die Eventart ist nach dem Anlegen unveränderlich. Der einzige Zustand ist `DRAFT`. Die Oberfläche kennzeichnet diese Datensätze ausdrücklich als Vorbereitung ohne Spielbetrieb. Gemeinsame Stammdaten sind Titel, Reihe, optionales Kalenderdatum und optionale Ortsuhrzeit sowie Erstellungs-/Änderungszeitpunkt. Eine Uhrzeit benötigt ein Datum; es findet keine Zeitzonenumrechnung oder Terminplanung statt.

Formatspezifische Konfiguration, Teamteilnahmen, Templates, Laufzeit und Mischveranstaltungen sind nicht implementiert. Spätere formatbezogene Tabellen können die UUID referenzieren. Es gibt weder eine universelle Laufzeit noch eine zweite Zustandsführung für Quiz. Der Fachvertrag benötigt keine Kamera, keinen Vercel-Dienst und keine Internetverbindung; Offlinebetrieb selbst ist noch nicht implementiert.

## Verantwortlichkeiten und Rechte

`gameDraft.ts` enthält Validierung, die Delegation an bestehende Rollenpolicies und die Begrenzung von Rückwegen. Das Repository prüft aktuelle aktive Benutzer, Reihenrollen und tatsächliche Produktfreischaltungen bei jeder Operation. Listen und Direktzugriffe werden auf zulässige Reihen und die konkrete Eventart begrenzt. Die Server Action authentifiziert den Aufruf und invalidiert betroffene Verwaltungsseiten. Die Form kümmert sich ausschließlich um Eingaben, Meldungen und den vorhandenen Schutz ungespeicherter Änderungen.

Anlegen und Bearbeiten benötigen Eventmanager oder Admin. Bingo-Editoren dürfen Stammdaten lesen, aber nicht die Veranstaltungsverwaltung bearbeiten. Karaoke-Editoren erhalten weiterhin keine Funktionen. Reine Reihenverwaltung genügt nicht. Auch Admins benötigen eine Produktfreischaltung. Beim Reihenwechsel müssen sowohl Quell- als auch Zielreihe schreibbar sein. Entzogene Rechte oder deaktivierte Produkte sperren den nächsten Zugriff; vorhandene Entwürfe bleiben erhalten.

Schreibvorgänge verwenden dieselbe transaktionale Produkt-Sperre wie Produktänderungen und stabilisieren die aktuellen Benutzer-/Rollenzeilen. Ein Änderungszeitpunkt als Versionsvergleich weist veraltetes Speichern ab; Eingaben bleiben dabei im Formular erhalten. Die Eventreihe muss beim Anlegen ausdrücklich gewählt werden. Filter sind lokal und ändern keine Rechte oder globalen Einstellungen.

## Migration, Betrieb und Rückfall

`20261026160000_standalone_game_drafts` legt ausschließlich die neue Tabelle, ihren Index, ihre Einschränkungen und einen Fremdschlüssel zur Reihe an. Bestehende Daten, IDs, Migrationsdateien und Quizlaufzeit bleiben unverändert. Die Datenbank erzwingt Eventart, Entwurfszustand, Titel und gültige Uhrzeit mit Datum. Reihen mit zugeordneten Spielen können nicht versehentlich kaskadierend gelöscht werden.

Der bestehende Backup-Dump erfasst das Schema `pubquiz`; die Snapshot-Integritätsprüfung ermittelt gewöhnliche Tabellen dynamisch über den PostgreSQL-Katalog. Die neue Tabelle fällt damit ohne zusätzliche Ausnahmen unter Sicherung und vollständiges Zurücklesen. Sie enthält keine Zugangsdaten oder externen Medien. In diesem Arbeitspaket werden keine manuellen Backups oder Restores ausgeführt. Die historische PRIVATE_READBACK_FAILED-Ursache und der echte Wochenlauf sind getrennte Betriebspunkte; hier wird kein Ursachenfix behauptet.

Ein Code-Rückfall kann die additive Tabelle stehen lassen. Vor späteren produktiven Schreibzugriffen sind die dann geltenden Release- und Sicherungsvorgaben zu prüfen. Dieses Paket autorisiert ausschließlich PR und isolierte Preview, keine Produktionsmigration und keinen Merge.

## Prüfstand

Siehe den zugehörigen PR-Prüfbericht für tatsächlich ausgeführte Unit-, PostgreSQL-, Migrations- und Browserprüfungen. Unausgeführte Prüfungen gelten ausdrücklich nicht als bestanden.

### Isolierte Preview-Baseline

Die eigene Datenbank `games_review_20261026c` wurde neu aus dem Main-Schema `6828d50e` aufgebaut. Ausschließlich dort wurden vorhandene Migrationen mit dem regulären Prisma-Baselineverfahren als angewendet registriert; anschließend wurde die neue Migration mit `migrate deploy` ausgeführt. Keine bestehende Datenbankhistorie wurde umgeschrieben. Grund: Die historische vollständige Leerdatenbank-Replaykette scheitert bereits an BOM beziehungsweise doppelter Spalte nach `0_init`. Das ist ein bestehendes Bootstrapproblem, kein Fehler der neuen Migration. Eine Schema-Baseline ersetzt nicht die Prüfung historischer datenabhängiger Migrationen oder Trigger; diese Preview beansprucht diesen Nachweis nicht.

Die Anzeige technischer Erstellungs-/Änderungszeitpunkte verwendet ausdrücklich `Europe/Berlin`, damit Server- und Browserrendering auch bei unterschiedlichen Systemzeitzonen identisch sind. Das optionale Veranstaltungsdatum und die Ortsuhrzeit bleiben davon unabhängige zivile Werte.

Die neuen Eingabefelder und der Speicherknopf sind serverseitig bis zur Client-Hydrierung gesperrt. Ein beobachtetes natives Absenden unmittelbar nach Reload wird damit verhindert; der Zustand verwendet dasselbe `useSyncExternalStore`-Muster wie der vorhandene Modal-Baustein. Der Chromium-Test prüft sowohl die gesperrte Serverdarstellung als auch die anschließend bedienbare Clientform.

Die vorhandene Quiz-Verwaltungsregel für archivierte Reihen gilt auch hier: kein neues Spiel und keine neue Zuordnung in eine archivierte Reihe; Stammdaten eines bereits dort liegenden Entwurfs bleiben bei weiterhin gültigen Rechten bearbeitbar. Diese Grenze wird bei jeder Schreibaktion geprüft und durch eine gemeinsame Zeilensperre mit Archivänderungen serialisiert. `canCreate` im Auswahl-DTO ist ausschließlich aus bestehenden Rechten und Archivstatus abgeleitet, keine neue Berechtigung.
