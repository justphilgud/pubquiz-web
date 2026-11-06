# Bingo-Polling: exakter No-Delta-Teilrelease aus PR #154

Am 6. November 2026 ausdrücklich beauftragt: gesamter Release von PR #154 sowie,
bei weiterhin blockierter Designpreview, separat vollständig geprüfter Transferfix.
Nach Ablehnung der Freigabe aus dem Anhang zusätzlich im Chat ausdrücklich
bestätigt: Release, lesende Productionprüfung und exakte Operations-Erweiterung.

## Exaktes Paar und technische Prüfung

Production `192f27848f723559e3e18a0b9fdbbeb169a10ed3` → ausschließlich
Kandidat `1ff5854dd716d5fb2559e3d5f4cf970e5f5d1696` (PR #155).
Beide Produktionsaliase wurden unabhängig als dasselbe READY-Productiondeployment
mit dem erwarteten Ausgangscommit verifiziert. Unmittelbar vor dem Release erneut prüfen.

Alle 70 historischen Migrationen und Prisma-Schemabytes sind identisch.
Manifest-SHA256 `069b34755e9e5eb309c770ffcd17783e1f5bd8ca914096e803ac7d007d5325de`;
Schema-SHA256 `df7cd584585ca2fab7fab2926a63f5c90790d461bbc1ac7270733efdc4dab7e8`;
letzte Migration `20261106180000_bingo_card_design_v3`.
Die V4-Designmigration aus #154 ist **nicht** enthalten und nicht freigegebenes Delta
dieses Teilreleases. Weder andere Kandidaten noch Merge-SHAs werden pauschal zugelassen.

Das vorhandene `approvedNoDeltaPreflightPlan` prüft den fest gebundenen Eintrag.
Bestehende Releasepaare, Reader-/TLS-/Autorisierungs-/Checksum-/Historiengates und
der main-only geschützte Workflow bleiben unverändert. Kein Kandidatenanwendungscode
im geheimnistragenden Job; nur Git-Manifeste/Schemabytes. Erfolgreiche Historie
verlangt exakt 70 eindeutige abgeschlossene Migrationen ohne failed/pending/drift.
Der Nachweis umfasst aktuellen Historienstand und fehlendes Repositorydelta,
keinen neuen vollständigen Live-DDL-Abgleich. Historische Bootstrapgrenze bleibt
NOT_RUN / HISTORICAL_BOOTSTRAP_LIMITATION_UNCHANGED, nicht repariert.

## Umfang, Kontrollen und Integration

Operations-Diff nur Plan, zusätzliche Tests, ein Safety-CI-Matrixeintrag und dieses
Dokument. Der tatsächliche Pfaddiff muss mit unverändertem Deployment-Scope false
liefern; gemischte App-/Schema-/SQL-Änderungen bleiben true. Normale CI/Review,
regulärer Merge; Anwendungsmigrations-/Deploymentjob muss nach Operations-Merge
übersprungen sein. Erst danach den geschützten Read-only-Preflight ausführen.

Der Fix bleibt gegenüber der bereits unabhängig geprüften Fassung unverändert.
Seine exakte 1ff5854d-Variante erhält eigene CI und lokale isolierte Browserabnahme
mit echter Anmeldung, Moderation, direktem/stabilem Präsentationseinstieg und
bestandskompatibler PostgreSQL-Fixture. Vorhandene Messungen werden unverändert
als Messung unveränderter Abrufe geführt, nicht als Einsparung des Gesamtbetriebs.
Der bestehende No-Delta-Releaseweg verlangt für diesen schemafreien Fix keinen
zusätzlichen gehosteten Previewnachweis. Dies schafft keine allgemeine Ausnahme
für den **Designteil**: Dort bleibt die gehostete Abnahme nach dem expliziten V4-
Vertrag offen. Neon meldet weiter Netzwerktransferlimit; kein anderer kostenpflichtiger
Tarif, keine Kontingentumgehung und kein Productionbestand als Testfixture.

Nach PASS Aliase/Production/Kandidat erneut gegen den Beleg prüfen. Mergebaum darf
außer den separat geprüften Operationsdateien keine ungeprüften Appänderungen
enthalten. Dann regulärer Fix-Merge → Main-CI → bestehender geschützter Production-
Workflow. Sein Migrationsstatus muss unverändert sauber sein; keine neue SQL-Datei,
kein resolve/Baseline/Reset. READY, beide Aliase und tatsächlicher Runtime-Commit
sind abschließend Pflicht. Smokes ausschließlich lesend ohne Liveinitialisierung.

Die jüngeren spezifischen Bingo-/No-Delta-Releaseverträge und der tatsächliche
Releaseworkflow verlangen keine zusätzliche manuelle Sicherung. Der historische
allgemeine Preflightabschnitt mit separater Backupreihenfolge wird hier nicht als
Auftrag für ein neues Backup/Restore verstanden. Es werden weder Sicherungsflags
noch Backupcode, Datenbankrechte, Secrets oder Environmentregeln geändert.

Design-PR #154 nach Teilrelease regulär mit Main zusammenführen; kein Force-Push,
keine neue Designabnahme behaupten. Der Gesamtauftrag ist erst mit dem Designrelease
vollständig erfüllt; dessen konkreter verbleibender Blocker bleibt dokumentiert.
