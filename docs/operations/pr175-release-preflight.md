# PR175: exakter No-Delta-Plan für den geschützten Read-only-Preflight

## Auftrag und Status

Am 22.11.2026 hat der Auftraggeber nach abgeschlossener P0-Preview-Abnahme mit
akzeptierten Restgrenzen den Release von PR175 und anschließend die Vorbereitung
dieses **separaten Operations-PRs** ausdrücklich beauftragt. Dieser PR bereitet
ausschließlich die Planregistrierung, Tests und Dokumentation vor. Er wird nicht
automatisch gemergt und startet keine Production-Aktion.

Der Eintrag ergänzt die vorhandene No-Delta-Liste um genau ein unveränderliches
Paar. Paarvergleich, Schema-/Manifestprüfung und vollständige Historienprüfung
bleiben in den bestehenden Funktionen. Es gibt keinen neuen Ausführungspfad,
keine Wildcard und keine Änderung der vorhandenen Freigaben oder Defaults.

## Eingaben und gepinnte Belege

| Feld | Verbindlicher Wert |
| --- | --- |
| Erwarteter laufender Production-SHA | `31f99fe4f01596880dcec8ba614108fa5e1cd440` |
| Geprüfter PR175-Kandidat | `948b164de02bf3ec0edd3ab98352528a09b8905f` |
| Migrationsdateien | 79 |
| Letzte Migration | `20261119150000_add_quiz_mode` |
| Vollständiger Manifest-SHA256 | `8af6aff9799497bf6415f2e235bf5f74e7d2807c449d0872761d5e70fc0adb35` |
| Prisma-Schema-SHA256 | `c285d05ddb25bebba4314e74afd075f480462b816fb3ba0da468780e515727f8` |

Git bestätigt die Abstammung des Kandidaten von der Basis sowie bytegleiches
Schema und sämtliche 79 SQL-Dateien. Der Manifesthash bindet die geordnete Liste
aus Migrationsname und SHA256 der unveränderten Git-Bytes. Hashes werden nicht aus
einer lokalen Arbeitskopie oder aus dem Live-Katalog als Sollzustand übernommen.
Ein anderer PR175-Head oder Production-Basis-SHA ist durch diesen Plan nicht
freigegeben und erfordert eine neue konkrete Prüfung/Registrierung.

## Unveränderte Schutzmaßnahmen und Ausgaben

Der bestehende geheimnisfreie Referenzjob liest nur Git-Schema und Manifeste und
erzeugt `NO_SCHEMA_MIGRATION_DELTA`; er führt weder Kandidatenanwendung noch SQL
aus. Der geschützte Workflow bleibt main-only. Required Reviewer, getrennte
Environments `production` und `operations-backup`, GET-only Deploymentprüfung,
TLS, festgelegter Reader, READ ONLY und dessen Berechtigungsnachweise bleiben
erhalten. Keine Credentials, Rollen, Grants, Writer- oder Deploymentrechte werden
ergänzt. Der vorhandene CLI-Weg regeneriert den gepinnten Manifestnachweis und
prüft die Gleichheit zum Workflow-Artefakt vor dem festen Live-Historien-SELECT.

Ein erfolgreicher Live-Preflight verlangt alle 79 erfolgreich abgeschlossenen,
eindeutigen und checksumgültigen Migrationen ohne ausstehende, unerwartete oder
fehlgeschlagene Historie. Fehlende/zusätzliche/doppelte/geänderte Dateien,
abweichende Schemabytes sowie auch auf beiden Seiten übereinstimmend gefälschte
Belege werden verworfen. Alte Releasepaare und der bisherige 64-Dateien-Default
bleiben unverändert. Unbekannte oder verkürzte SHAs bleiben gesperrt.

Die Aussage bleibt begrenzt auf unveränderte Repository-Schemabytes und aktuelle
vollständige Migrationshistorie. Ein neuer vollständiger Live-DDL-Abgleich und
eine reparierte Neuinstallation werden nicht behauptet. Die historische
Bootstrapgrenze bleibt ausdrücklich `NOT_RUN` /
`HISTORICAL_BOOTSTRAP_LIMITATION_UNCHANGED`.

## Tests und Deployment-Scope

`production-preflight-plan.test.ts` prüft das reale Git-Paar und die 79 Dateien,
falsche/umgekehrte/gemischte/verkürzte SHAs, Manifest- und Schemamanipulationen,
unvollständige/fehlerhafte Historie sowie unveränderte frühere Pläne. Die
vorhandene Safety-CI erhält genau eine weitere Matrixzeile. Sie verwendet
ausschließlich disposable PostgreSQL17 auf localhost bzw. den vorhandenen
netzwerkisolierten Referenzpfad, ohne Production-Secrets oder Environments.

Die tatsächlichen vier geänderten Pfade müssen mit dem **unveränderten**
Deployment-Scope `needsApplicationDeployment=false` ergeben. Beim Hinzufügen von
Anwendungs-, Schema- oder Migrationsdateien muss das Ergebnis weiterhin `true`
sein. Keine Änderung an `deploy-production.yml`, am echten Preflightworkflow,
Deployment-Scope oder Environment-Schutz ist Bestandteil dieses PRs.

Lokale Vorbereitung am 22.11.2026: 30 fokussierte Plan-/Preflight-/Scope-Tests,
Typecheck und ESLint für die geänderten TypeScript-Dateien erfolgreich. Der echte
vier Dateien umfassende Diff liefert `needsApplicationDeployment=false`.
Die PostgreSQL-/Referenzmatrix wird separat in der Safety-CI geprüft; ihr Ergebnis
und die vollständige reguläre CI werden am Operations-PR dokumentiert. Ein
erfolgreicher lokaler Test wird nicht als Live-Preflight ausgegeben.

## Spätere Releasefolge, nicht Teil dieser Vorbereitung

1. Operations-PR nach technischen Reviews und vollständiger CI regulär integrieren;
   bestätigen, dass der Scope kein Anwendungsdeployment auslöst.
2. Production-Aliasse/READY/SHA und unveränderten PR175-Head erneut bestätigen.
   Geschützten Read-only-Preflight auf main für exakt dieses Paar starten und an
   einer erforderlichen Owner-Freigabe anhalten. Alle Live-Gates müssen PASS sein;
   diese offline geprüfte Registrierung ersetzt keinen Live-Nachweis.
3. Vor jeder Production-Änderung das geschützte Pre-deployment-Backup mit privatem
   Readback, Manifest/Hashes und Integritätsnachweis verifizieren. Übrige geforderte
   Preview-Prüfungen abschließen. Die akzeptierten P0-Restgrenzen bleiben bestehen.
4. PR175 regulär mergen, den exakten resultierenden main-Commit durch CI prüfen und
   den bestehenden geschützten Production-Workflow einschließlich Owner-Gate nutzen.
   Der Mergebaum darf nur den geprüften Kandidaten und das reviewte Operations-Paket
   ergänzen. Keine manuelle Migration, Reparatur, Baseline oder Schutzumgehung.
5. READY, Runtime-SHA, beide Production-Aliasse und lesenden Smoke-Test bestätigen;
   echte Quizdaten/Bewertungen unverändert lassen. Bei Fehlern anhalten.

Der vorliegende Operations-PR führt keinen dieser Schritte aus: kein Merge,
Backup, Restore, Live-Preflight, Migration oder Production-Deployment. Die
fachliche P0-Abnahme von PR175 bleibt durch die Vorbereitung unverändert.
