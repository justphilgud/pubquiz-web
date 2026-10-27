# Bingo AP2: geschützter Release-Preflight

Exaktes Paar: Production `8d2af14f959c920869a3375bc1236a46d2247533`
→ Kandidat `834242e51f8d9819aaf05d3e006f50a5694b6345`.
Beide Produktionsaliase wurden unabhängig auf dasselbe READY-Deployment
`dpl_4euCqJ9C9Mx4Y1iqXZ3w4SESiSSY` und diesen Production-SHA geprüft.
Der Kandidat ergänzt seit der fachlichen Abnahme ausschließlich den separat
geprüften Backup-Sicherheitsfix, Tests und Dokumentation; Anwendung und SQL bleiben
unverändert. Kein erneuter Designumbau.

## Unveränderliche Referenzen

Der neue separate Plan bindet beide vollständigen SHAs, beide Prisma-Schemahashes,
den vollständigen 64er-Historienmanifesthash und exakt drei geordnete Migrationen:

- `20261027180000_bingo_preparation`: `7eb3f09ef62dcf44d508219dacdfdd68ad1a31831aa4a41c5dc0cb92e18fabc2`
- `20261027210000_bingo_print_design`: `5ddc528da448e994c8da48d4bbf3d698298e648913b3cfa059b050b94ae088b7`
- `20261027213000_bingo_label_allocation`: `09a5d228854865c5712779bdd007b5d165a52d650afd62637769e8b3412b82e6`

Keine allgemeine Kandidatenfreigabe, kein No-Delta-Ersatz, keine Rechteänderung.
Bestehende Freigaben und Gates bleiben erhalten. Geänderte/fehlende/zusätzliche/
umsortierte Migrationen, falsche Schemata und unbekannte Paare werden abgewiesen.

Der unveränderte main-only Workflow nutzt `production` und `operations-backup`.
Der geheimnistragende Job führt ausschließlich vertrauenswürdigen Main-Code und
feste READ-ONLY-Katalog-/Historien-SELECTs aus, niemals Kandidatenanwendung oder SQL.
Zusätzlich werden vorhandene SELECT-Defaultrechte des Backupreaders für neue
Tabellen des bestehenden `game_drafts`-Eigentümers rein lesend geprüft; fehlender
Nachweis blockiert, kein GRANT. Bestehende Identität, least-privilege-Reader,
Migrationschecksummen, Ancestry und vollständiger Live-Baselinekatalog bleiben Gates.

## Isolierter SQL-Nachweis

Im geheimnisfreien Netzwerk-none-PostgreSQL17-Container entsteht dieselbe
unabhängige historische Modellreferenz plus alle unveränderten Inkremente bis zum
aktuellen Production-SHA. Erwarteter Baselinekatalog wird vor dem AP2-Delta erfasst;
kein Productionkatalog erzeugt die Referenz. Erst dort werden exakt die drei
hashgeprüften SQL-Dateien ausgeführt. Repräsentative synthetische Bestandszeilen,
eine alte Kartenserie zwischen erster und zweiter Migration, unveränderte Karten,
Kurzkennungs-Backfill, Constraints, Rückrollprobe und vollständige Projektion des
Katalogs auf den alten Zustand werden geprüft. Kandidatenanwendung wird nicht
benötigt. Der vollständige AP2-Asset-/Snapshotpfad ist separat in der realen
AP2-PostgreSQL-CI nachgewiesen.

Historischer New-install-Replay bleibt getrennt FAIL mit dem bekannten
`20260713130000_add_question_draft_fields`-/0_init-Konflikt. Eine andere Kollision
blockiert. Kein Baseline/resolve, keine historischen SQL-Änderungen und keine
Behauptung, Bootstrapprobleme seien behoben.

## Scope, Sperren und Rückfall

Dieser Operations-PR ändert nur `scripts/operations`, dieses Dokument und die
bestehende Safety-CI. `needsApplicationDeployment` ergibt false für den tatsächlichen
Diff; gemischte App-/Prismaänderungen bleiben true. Keine Änderung an Secrets,
Environmentregeln, Production-Workflow oder Deployment-Scope-Ausnahmen.

Die AP2-Migrationen erzeugen acht Tabellen, neun Funktionen und fünfzehn Trigger;
zwei nullable JSONB-Spalten ergänzen bestehende Tabellen. DDL und CHECK-Anlage
benötigen zeitweise ACCESS EXCLUSIVE, FK-Anlage Referenzsperren. Die letzte
Migration sperrt `game_drafts` vor `bingo_card_series` jeweils SHARE ROW EXCLUSIVE.
Isolierte Proben mit 2s lock_timeout/30s statement_timeout sind keine Garantie für
Produktionsdauer. Kein Quizruntime-SQL wird geändert. Kein blinder Code-Rollback:
älterer Backupcode lehnt die neuen Ausführungsobjekte ab, daher nach Migration
nur ausdrücklich kompatiblen Code verwenden. Keine Down-Migration oder Datenlöschung.

Nach grüner Operations-CI und regulärem Merge geschützt preflighten; unmittelbar
vor Appmerge Aliase, Kandidat und Mergeumfang erneut prüfen. Erst dann regulärer
Appmerge, Main-CI, geschützte Migration/Deployment, Status/Aliase/Runtime und nur
lesende Smokes. Fehlende Nachweise sind kein PASS. Keine manuellen
Production-Backups/Restores. Wochenlauf und PRIVATE_READBACK_FAILED bleiben getrennt.
