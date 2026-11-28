# Release-Ablauf: ein Feature-PR, geprüfte Nachweise, explizites Deployment

Stand: 27.11.2026. Dieser Standard ersetzt für neue Releases ohne Schemaänderung
zusätzliche Operations-PRs zur Registrierung eines erst nach dem Merge bekannten
Commit-Paars. Historische exakte Pläne und ihre Prüfungen bleiben unverändert.
Dieser Umbau selbst ist zunächst ein Review-PR, keine Merge-/Production-Freigabe.

## Zweck und Verantwortlichkeiten

Der Feature-PR enthält Anwendung, Tests und `release/plan.json` gemeinsam.
Der Plan enthält keinen eigenen Commit-SHA: Das wäre selbstreferenziell. Stattdessen
pinnt er die unabhängig verifizierte Production-Basis, vollständigen sortierten
Migrationsmanifest, Schema-Hash, Anzahl und letzte Migration. Nach dem Merge bindet
der geschützte Workflow die geprüften Daten an den vollständigen tatsächlichen
Merge-SHA und dessen erfolgreiche main-CI. Die Zielrevision wird nie aus dem
aktuellen main-HEAD als Ersatz für einen freigegebenen Anwendungskandidaten geraten.

| Bisher | Neuer Standard | Erhaltene Prüfung |
| --- | --- | --- |
| Teure CI bei Feature-Push und erneut auf dem PR | Ein Lauf pro PR-Head; weiterer Lauf für den resultierenden main-Commit | Alle Qualitäts-, PostgreSQL-, Lint- und Build-Prüfungen bleiben |
| Safety-/Bridge-Matrix auf Feature-Push, PR und main | Bei betroffenen Pfaden auf PR und main | Historische Regressionen, isoliertes PostgreSQL und enge Pfadfilter bleiben |
| Operations-Merge pro neuem No-Delta-SHA-Paar | Plan bereits im Feature-PR, nach Merge exakt gebunden | Vollständige Byte-/Schema-/Historienprüfung, Abstammung, PR-/CI-Herkunft |
| Automatischer Production-Lauf blockiert den vorgelagerten Preflight | Ausschließlich ausdrücklicher manueller Production-Start nach Preflight | Owner-Review, main-only, Featureflag, gemeinsame Serialisierung |
| Manuelle Zuordnung von Preflight und Deploy | Preflight-Lauf-ID und exakter Release-SHA sind obligatorische Inputs | Herkunft/Erfolg aller Nachweise und deren SHA-Paar werden geprüft |

Ein Push ohne PR startet absichtlich keine Feature-CI; PRs einschließlich Drafts
werden regulär geprüft. Dadurch wird nicht jede Workflow-Ausführung eingespart:
main wird nach dem Merge weiterhin eigenständig geprüft. Dies ist notwendig, weil
dort der tatsächliche Mergebaum entsteht. Es wird keine Geldersparnis behauptet,
für die keine Abrechnung vorliegt. Die bestehende Concurrency darf überholte
CI-Läufe ersetzen; dieser Auftrag bricht keine laufenden Releases ab.

## Plan vorbereiten und prüfen

Nach unabhängigem Nachweis des aktuell veröffentlichten vollständigen Production-SHA:

```powershell
node --import tsx scripts/operations/prepare-feature-release.ts <production-sha-40-zeichen>
```

Das erzeugt lokal `release/plan.json`, greift nicht auf Production zu und führt
keinen Kandidatencode oder SQL aus. Datei im normalen Feature-PR prüfen/committen.
`FeaturePlan.version=1`, `kind=NO_DELTA` akzeptiert ausschließlich identische
Schema- und vollständige Migrationsbytes auf beiden Seiten. Gleichartig verfälschte
Baselines/Kandidaten, entfernte/zusätzliche/doppelte/umsortierte Migrationen,
abweichende Planfelder und verkürzte/falsche SHAs werden abgewiesen.

Ändert sich Production vor dem Merge, muss der Plan im Feature-PR bewusst auf die
neue verifizierte Basis gebracht werden. Ein veralteter Plan wird nicht automatisch
umgeschrieben. Bereits veröffentlichte historische Pläne bleiben lesbar.

**Migrationen:** Der allgemeine neue Pfad autorisiert ausdrücklich keine neuen
SQL-Deltas. Ein migrationshaltiger Feature-PR muss neben seinem deklarativen Plan
auch den engen migrationsspezifischen Validator und isolierte Delta-/Kompatibilitäts-
und Rückwegtests mitbringen. Dafür ist kein erst nach dem Merge eingetragener
Kandidaten-SHA und kein weiterer Operations-PR vorgesehen: Der geprüfte Plan wird
an den tatsächlichen Merge gebunden. Die dafür notwendige Planart/Validierung muss
in demselben Feature-PR implementiert und reviewed werden. Aktuell wird nur
`NO_DELTA` allgemein unterstützt; unbekannte Planarten bleiben BLOCKED. Bestehende
historische SQL-Releasepaare bleiben über ihre unveränderten Spezialprüfungen
verfügbar. Kein automatischer Freifahrtschein für beliebiges neues SQL.

Der Bingo-Farbauftrag ergänzt die eng begrenzte Planart `BINGO_ROUND_COLOR`
für exakt eine nullable HEX-Farbspalte an `bingo_rounds`. Plan, Validator,
isolierter Schema-/Daten-/Rückwegtest und Anwendung liegen gemeinsam im Feature-PR.
Die allgemeine SQL-Sperre und alle geschützten Freigaben bleiben erhalten;
Details im [Bingo-Farbvertrag](../architecture/bingo-presentation-colors.md).

## CI und Preview

`CI`, `Production Preflight Safety` und `AP9.4 Bridge Checks` laufen auf PRs und
Pushes nach main. PR-Checkout pinnt ausdrücklich den PR-Head-SHA, sodass die
getestete Revision eindeutig der späteren Preview entspricht. main-CI prüft den
Merge separat. Qualitätsjob-Namen und vorhandene Pfadfilter bleiben erhalten.

Preview verwendet weiterhin ausschließlich exakt freigegebene Branches und die
bereits isolierten Datenbanken/Medienstores. Ein erfolgreicher PR-CI-Lauf reicht
nur mit geprüftem Workflowpfad, passendem Branch und SHA sowie separat über die
GitHub-PR-API bestätigter Herkunft aus diesem Repository. Fork-PRs und bloß gleiche
Branch-Namen reichen nicht. Bestehende erfolgreiche Push-Nachweise bleiben für
ältere Previews kompatibel. Zusätzlich muss ein unveränderliches Artefakt aus genau diesem erfolgreichen
CI-Lauf und Laufversuch den tatsächlich ausgecheckten Git-SHA bestätigen. Ältere
PR-CI ohne dieses Artefakt oder mit getestetem GitHub-Mergebaum reicht nicht;
dafür den Branch auf den neuen Ablauf aktualisieren und regulär prüfen lassen.
Production akzeptiert keinen PR-Ausführungskontext.

## Release Schritt für Schritt

1. Feature-PR technisch prüfen, alle notwendigen Checks grün abwarten, isolierte
   Preview und fachliche Abnahme wie bisher. Keine automatische Mergefreigabe.
2. Regulär mergen, tatsächlichen Merge-SHA festhalten, vollständige main-CI abwarten.
   Direkte main-Pushes, ungeprüfte PR-Heads, andere Workflows, fremde Repositorys,
   nicht erfolgreiche oder noch laufende neueste CI-Läufe liefern keinen neuen
   Feature-Release-Nachweis.
3. Bestehenden `production-read-only-preflight.yml` auf main mit exakt
   `expected_production_sha` und `release_candidate_sha` starten. Vorgeschriebener
   production-Owner bestätigt den Environment-Review selbst. Metadaten lesen nur
   feste Vercel-GET-Endpunkte. `operations-backup` prüft weiterhin mit dem
   privilegienbeschränkten Reader und READ ONLY ausschließlich Migrationshistorie.
   Kein Production-SQL aus dem Kandidaten wird dabei ausgeführt.
4. Backup nach dem jeweils geltenden bestehenden Verfahren. Ein Verzicht gilt nur
   bei ausdrücklicher Freigabe für diesen konkreten Release; PR191s Ausnahme ist
   keine dauerhafte Backup-Ausnahme. Backup-/Restoreworkflows, Rollen und Secrets
   werden durch diesen Umbau nicht geändert.
5. `deploy-production.yml` ausdrücklich auf main starten:

   ```powershell
   gh workflow run deploy-production.yml --ref main -f release_candidate_sha=<exakter-merge-sha> -f preflight_run_id=<erfolgreicher-preflight-lauf>
   ```

   Der geheimnisfreie Job `release-evidence` bestätigt main-CI, gemergten PR,
   Repository-/Workflow-/Eventherkunft des Preflight-Laufs und die über GitHub
   geladenen unveränderlichen Artefakte. Deployment- und Datenbankartefakt müssen
   dasselbe freigegebene SHA-Paar und erfolgreiche Pflichtgates enthalten.
   Fehlende/gelöschte Artefakte, fehlgeschlagene/abgebrochene Läufe und vermischte
   Nachweise sperren das Deployment. Kein manuelles Ersetzen von Artefakten.
6. Erst danach wartet der bestehende `production`-Job auf Owner-Review. Er checkt
   den exakten Anwendungskandidaten aus. Ein kleiner, aus dem geprüften main-Code
   gebündelter Guard wird als unveränderliches Artefakt aus demselben Lauf geladen;
   er verwendet keine Guarddatei aus dem Kandidaten. Vor Migrationen bestätigt er
   die aktuelle grüne Kandidaten-CI sowie Production-Alias/READY/Basis erneut per
   GET. Bei zwischenzeitlicher Promotion/abweichender Basis wird abgebrochen.
7. Bestehende DB-Identitätsprüfung, Migrationsstatus vorher, `db:deploy`, Status
   nachher, Vercel-Deployment und HTTP-Smoke bleiben erhalten. Anschließend
   authentifizierter, bevorzugt lesender fachlicher Smoke und dokumentierter
   Runtime-SHA/URL/Migrationsstand wie bisher. Keine echten Bewertungen oder
   Quizdaten für einen Smoke-Test verändern.

## Schutzmaßnahmen, Persistenz und Grenzen

Keine GitHub-Environment-, Reviewer-, Branchpolicy-, Account-, Rollen- oder
Secretänderung. Production und Preflight bleiben main-only und teilen die Gruppe
`production-deployment` mit `cancel-in-progress: false`. Das Deploymentfeatureflag
bleibt obligatorisch. Der Preflight behält ausschließlich lesende Rechte; GitHub
bekommt zusätzlich nur lesende Actions-/PR-Metadatenrechte. Datenbank-/Vercel-
Credentials bleiben in ihren bisherigen geschützten Environments. Keine neue
Abhängigkeit, keine Schema-Migration und kein Backup in diesem Umbauauftrag.

Der bisherige Scope-Klassifikator bleibt erhalten und seine Tests prüfen weiterhin
Operations-only gegenüber gemischten App-/Schema-/Packageänderungen. Für neue
Production-Releases ist er kein automatischer Trigger mehr: Ohne manuellen
Start gibt es weder für Operations- noch App-Merges ein Production-Deployment.
Ein ausdrücklich manuell gestarteter, nachgewiesener Kandidat darf wie bisher
auch Operationsänderungen enthalten; ein zufälliger Operations-Merge startet
aber keinen zusätzlichen Deploy. Keine Scope-Ausnahme wird erweitert.

Die klassische Branch-Protection-API meldete bei der Bestandsaufnahme für main
„Branch not protected“. Das ist ein vorhandener Zustand, keine Änderung dieses PRs.
Die hier implementierten Gates ersetzen keine fehlende repositoryweite Mergepolicy.
Historischer Bootstrap bleibt als NOT_RUN/offene Grenze dokumentiert; identische
Repositorybytes sind kein neuer vollständiger Live-DDL-Abgleich. Externe direkte
Vercel-Promotions oder DB-Schreibzugriffe außerhalb der Workflows bleiben außerhalb
der GitHub-Concurrency; deshalb werden die aktuelle Aliasbasis und Migrationsstatus
weiterhin geprüft. Bei Fehlern anhalten, keine improvisierte Datenreparatur.

## Technische Abnahme

`feature-release-plan.test.ts` prüft manipulierte Manifest-/Schema-/Planwerte,
Abstammung und echte unveränderliche Git-Bäume mit synthetischen GitHub-Antworten.
Kandidatencode enthält dabei absichtlich einen Fehler und darf nie ausgeführt
werden. Wiederholtes Prüfen muss identische Nachweise erzeugen.
`verify-production-release.test.ts` prüft fehlende/fehlerhafte Gates, falsche SHAs,
vermischte Artefakte und fremde/fehlgeschlagene Preflight-Läufe. Bestehende
Metadatenregressionen bleiben für die reine Codeextraktion unverändert gültig.
Previewregressionen prüfen Fork-/Branch-/SHA-/Workflow-Abgrenzung. Bestehende
historische Plan-, PostgreSQL-, Backup-/Restore- und Workflowtests bleiben aktiv.
Tatsächlich ausgeführte Ergebnisse und CI-Läufe werden im zugehörigen PR dokumentiert.
Ein echter Production-Release mit dem neuen Ablauf benötigt nach Review eine
separate Freigabe; er wird hier nicht zum Testen gestartet.

Lokale Ergebnisse dieses Umbaus: 61/61 gezielte Schutz-/Workflowtests und 40/40
historische Plan-/Scope-/Release-Regressionen bestanden (getrennte Suiten mit
Überschneidungen, keine Behauptung von 100 verschiedenen Tests). Typecheck und
ESLint des gesamten Operationsbereichs sowie der geänderten CI-/Previewdateien
mit null Warnungen bestanden. Vollständiger Next.js-Build erfolgreich. Alle sechs
geänderten Workflowdateien mit dem vorhandenen `js-yaml` auf gültige Syntax und
Struktur geprüft. Der aus main-Code gebündelte Guard ist etwa 16 KB groß und
baut ohne Warnungen; ohne gültigen Kontext blockiert er wie vorgesehen.

Zusätzlicher rein lesender Realitätsabgleich: GitHub-CI-/PR-/Preflight-Metadaten
und bereits lokal vorhandene Artefakte des abgeschlossenen PR191-Releases werden
vom neuen Validator mit dem korrekten exakten Paar akzeptiert. Es wurde dafür
keine Production-API oder Datenbank aufgerufen. Das ist kein neuer Live-Preflight
und keine Production-Abnahme dieses Workflowumbaus. Die neue geschützte
End-to-End-Orchestrierung bleibt bis zur separaten Integrationsfreigabe ungefahren.

### Excel-Browserstart (PR #194)

Der Excel-Import-Browsertest verwendet den vorhandenen `waitForChromeEndpoint`-
Prüfer statt nur auf die Existenz von `DevToolsActivePort` zu warten. Fehlende,
leere oder teilweise geschriebene Dateien gelten nicht als Bereitschaft. Das
explizite Startbudget beträgt wie beim Präsentationsharness 45 Sekunden; das
Gesamttestlimit bleibt bei 300 Sekunden. Prozessende, Signal und Spawnfehler
brechen den Start ab. Eine begrenzte Chrome-Fehlerausgabe wird zusammen mit
Exitstatus und Next.js-Diagnose gemeldet. `--disable-dev-shm-usage` übernimmt
die bestehende Harness-Konfiguration für Runner mit begrenztem Shared Memory.

Der vorangegangene CI-Lauf belegte nur den fehlenden Endpunkt nach 30 Sekunden;
die verworfene Chrome-Ausgabe erlaubt keine nachträgliche Aussage zur konkreten
Prozessursache. Kein automatischer Neustart, keine gelockerten fachlichen
Assertions und keine Änderung an Anwendung, Datenbank oder Release-Gates.
Die vorhandenen Endpunktregressionen prüfen verzögerten Start, Teilinhalte,
ungültige Endpunkte, Timeout und vorzeitiges Prozessende. Der echte Excel-
Browserablauf wird weiterhin im isolierten PostgreSQL-CI-Job ausgeführt.

### Formular-Browserstart nach PR #198

Die main-CI `46166938677` scheiterte in `GameDraftForm.browser.test.ts` beim
WebSocket-Aufbau mit `Invalid URL`. Der bisherige Test las die Portdatei bereits
bei ihrer Existenz; Chrome kann sie zu diesem Zeitpunkt noch teilweise schreiben.
Der Formular-Browsertest verwendet nun ebenfalls `waitForChromeEndpoint` und
wartet auf einen vollständig validierten Port und Browserpfad. Das bestehende
30-Sekunden-Gesamtbudget bleibt erhalten; Prozessende oder Signal brechen ab.
Es gibt weder Testwiederholung noch übersprungene fachliche Assertions.

Regression: `scripts/testing/chrome-endpoint.test.ts` prüft fehlende, leere,
teilweise und ungültige Inhalte, verzögerten Start, Timeout und Prozessende.
`app/games/GameDraftForm.browser.test.ts` prüft weiterhin beide Formate,
abgelehnte Schreibversuche, Abbrechen, Reload und identische Retry-Identitäten
ausschließlich mit lokalen synthetischen Adaptern. Anwendung, Release-Plan,
Migrationen, CI-Gates und Production-Daten bleiben durch diese Korrektur unverändert.
