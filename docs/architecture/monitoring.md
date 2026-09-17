# AP9.5 Monitoring V1

## Zweck und Vertrag

Read-only Betreiberübersicht `/admin/monitoring`, erreichbar im Benutzermenü unter
Monitoring. Bestehendes `requireAdmin` schützt die Seite; der GET-Health-/Diagnoseread
`/api/admin/monitoring` prüft die aktuelle globale ADMIN-Rollenzuweisung separat.
Editor, Eventmanager und Publikum erhalten keine Betriebsdaten. Keine Änderung an
Authentifizierung, Lifecycle, Antworten, Moderation, Präsentation oder Operations.
Der vorhandene mutierende Live-Snapshot wird ausdrücklich nicht aufgerufen.

Der Healthcheck ist bewusst **intern/admin-only**, kein öffentliches DB-Probeangebot.
Die bestehende Proxy-Anmeldung kann unangemeldete API-Anfragen bereits zur Anmeldung
umleiten; der Handler selbst liefert 401/403. Fehler der Rollenprüfung liefern einen
festen 503-Code ohne Exceptiontext. Kein öffentlicher Detail-Endpunkt.

## Quellen und Status

| Signal | Quelle | Refresh | Grün | Gelb | Rot |
|---|---|---|---|---|---|
| Anwendung | erfolgreicher geschützter Monitorread, logische Umgebung | 30 s | valide Umgebung, frische Antwort | Erhebung älter als 60 s | widersprüchliche/ungültige Umgebung; Monitorrequest scheitert |
| DB | SELECT 1 und begrenzte Reads in Read-only-Transaktion | 30 s Cache/Instanz | vollständig erfolgreich, Probe <500 ms | Probe ≥500 ms oder Quelle veraltet | Leseprüfung fehlgeschlagen, inklusive Timeout/Pool/SQL |
| Live | Präsentationsstatus RUNNING, nicht archivierte Quizze, registrierte Teams | 30 s | erfolgreicher Read, auch kein Quiz | fehlt, veraltet oder mehr als sechs Quizze | kein abgeleiteter Ausfall aus unverändertem Zustand |
| Antworten | COUNT und MAX(draft_updated_at) nur aktueller Interaction-Run | 30 s | nicht behauptet | Save-Zuverlässigkeit unbekannt | keine Savefehler aus Monitorfehlern ableiten |
| Backup | kuratierter AP9.4-Nachweis, Run 35102025962 | versionierter Beleg | nicht behauptet | historischer oder fehlender Nachweis | kein Laufstatus erfunden |
| Deployment | VERCEL_GIT_COMMIT_SHA, getLogicalEnvironment | pro Erhebung | gültige SHA und Umgebung | SHA fehlt | Umgebung ungültig |

Gesamtstatus: Rot vor Gelb vor Grün. Fehlende Pflichtsignale verhindern Grün. Deshalb
bleibt V1 auch bei gesunder DB wegen der ausdrücklich ausgewiesenen Messlücken gelb.
„System betriebsbereit“ ist als getestete Aggregationsstufe vorhanden, wird aber nicht
als vollständige Betriebsfreigabe vorgetäuscht. Preview ist deutlich kein Productionnachweis.

500 ms ist die konservative Startgrenze aus AP9.5-Analyse Abschnitt E, **kein gemessenes
SLO**. V1 warnt sofort statt eine nicht vorhandene verteilte 2-Minuten-p95-Messung zu
erfinden. In der Generalprobe kalibrieren. 60 s Frische = zwei Pollintervalle.
Rot beim fehlgeschlagenen Read bedeutet „Prüfen“, nicht automatisch „Neon ausgefallen“.

## Datenzugriff und Budget

- Vor jeder Datennutzung bestehende aktuelle Rollenprüfung, nicht im Messcache.
- Ein Browserrequest je 30 s, nur sichtbarer Tab, kein paralleler Poll, Abort nach 8 s.
- Ein gemeinsam genutztes laufendes Promise und 30-s-Ergebniscache **je Node-Instanz**.
  Kein globaler/dauerhafter Cache und keine globale Statistik behauptet.
- Bestehender Prisma-Pool; Transaktion `READ ONLY`, `statement_timeout=1500ms`,
  Transaktionslimit 4000 ms, Poolwartebudget 1000 ms. Rollen-/Authkosten liegen außerhalb.
- Zwei SELECTs ohne aktives Quiz, drei mit laufendem Quiz, zuzüglich BEGIN/COMMIT und
  zwei SET-Anweisungen sowie Auth-/Rollenprüfung. Die Anzeige zählt versuchte SELECTs.
- Höchstens sieben Statuszeilen zur Überlaufprüfung, sechs Quizze dargestellt. Teamcounts
  über vorhandenen quiz_id-Index, Antwortcounts über vorhandenen interaction_run_id-Index.
  Keine regelmäßigen vollständigen Antwort-/Teamtabellenzählungen. Statussuche kann die
  kleine Präsentationsstatustabelle lesen; Statementbudget begrenzt Laufzeit, kein neuer Index.
- Kein externer Providerread, keine Schreibprobe, Migration, neue Tabelle oder Dependency.
- DB-Latenz ist SELECT-1-Zeit nach Transaktionsbeginn. Gesamterhebungszeit separat.
- „Letzte erfolgreiche DB-Prüfung“ ist Instanzspeicher, kein globales SLA; Neustart leert ihn.

Registrierte Teams sind nicht aktive Clients. Die Zeit des Zustandswechsels ist kein
Fetch-/Client-Ack-Zeitpunkt. Nur die Monitorantwort belegt Frische dieses Monitors.
Antwortdatensätze sind keine Saveversuche oder bestätigten HTTP-Antworten. Die angezeigte
Runphase folgt der bestehenden rein funktionalen Deadlineprüfung; sie ist keine Garantie,
dass weitere fachliche Annahmebedingungen erfüllt sind.

## Grenzen und Historie

Keine belastbare zentrale Quelle für Saveversuche/-fehler/-quote/-latenz/Retry,
Functionfehler, Clientpräsenz, Moderator-/Präsentationsempfang, READY oder letzten
Productiondeploy. Keine neuen Providercredentials, keine flüchtigen Zähler als globale
Metrik. Ein verlorener Save-Response kann trotz Commit auftreten.

Backupkarte: Snapshot 2026-09-16 13:28:18.907 UTC, Job 308 s, Integrität/Readback aus
AP9.4-Run #19; Datennachvalidierung 14:36:24.616 UTC. Der referenzierte Bericht
`ap9-4-run19-readonly-validation-20260916.md` im Operations-Arbeitsstand lässt den
Browserabschluss offen. Keine neue Backup-/Restoreausführung, keine Aussage, dass
dies noch das neueste Backup ist. Kein Token/Host/Manifest-/Signed-URL im Dashboard.

Maximal 20 Statuswechsel nur im RAM dieses geöffneten Dashboards. Reload löscht die
Historie. Simulation ist separat beschriftet. Kein LocalStorage, keine Datenbankpersistenz,
keine Antwortinhalte, Namen von Teams, Userdaten, Secrets, Stacktraces oder Rohfehler.
Quiztitel und numerische Quiz-ID sind ausschließlich adminsichtbare Betriebsdaten.
Gleiche Anwendung: kein unabhängiger Uptimecheck. Ein Überwachungsausfall darf keinen
Fachaufruf auslösen; die bestehenden Quizmodule importieren keine Monitorfunktionen.

## Preview-Abnahme und Tests

Nur bei VERCEL_ENV=preview **und** logischer Preview darf ein Admin die festen Szenarien
healthy/warning/error/no-quiz wählen. Der API-Pfad prüft Rolle und Umgebung vor Fixture-
Erzeugung. Fixtures lesen/schreiben keine DB und sind nie aktuelle Productionwerte.
Healthy zeigt gesunde Messwerte, aber verbleibende Messlücken weiterhin gelb.

`app/admin/monitoring/monitoring.test.ts` prüft Zugriffsgrenzen, healthy/error/keine/aktive
Quizze, fehlende Save-Erfolg-/Fehlersignale, Backup verfügbar/fehlend, Aggregation,
Secretunterdrückung, Cachekonkurrenz/-fehler und Read-only-Architektur. Teil von npm test.
Browser- und Lastnachweis: separater AP9.5-Abnahmebericht.

## V2, ausdrücklich nicht implementiert

Generalprobe: Schwellen kalibrieren; kostengeprüfte zentrale Save-/Fehlertelemetrie und
Client-Acks; signierte sichere Operationsstatuszusammenfassung; längere Historie;
unabhängiger Healthbeobachter; danach freigegebene E-Mail-/Provider-Benachrichtigung,
Backupfehler-/Livealarm. Keine Vorab-Notificationengine oder externen Webhooks.
