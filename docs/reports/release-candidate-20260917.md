# Production Release Candidate — Arbeitsstand 17.09.2026

## Entscheidung

**Production Release Candidate noch nicht freigabefähig.**

Der gemeinsame Code- und Dokumentationsstand ist hergestellt. Die lokale Qualität,
die additive Migration und die isolierte Outro-Abnahme sind grün. Offen bleiben die
Bereitstellung und die vollständige Browser-/Lastabnahme der gemeinsamen Preview.
Production, `main`, Credentials und Schutzregeln wurden nicht verändert.

## Release und Inventar

- Tatsächliche Production: `1d4c703e068c0752a10757620d1f7fe03d47b20a`,
  Deployment `dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3`, READY.
- Integrationsbranch: `codex/production-release-candidate` im eigenen Worktree.
- Codeintegration: `1cbb3c484e26a0bc32b8ae2088ca3d808792b93c`.
- Aktueller RC-Arbeitsstand nach AP9.4-Dokumentationsübernahme: `20b3042`;
  der endgültige Release-SHA wird erst nach dem Abschlussbericht festgeschrieben.
- `origin/main` `49ee7b68173ee574ed98c0912efbd8a187ef13ad` ist vollständig enthalten.
- Enthaltene Featureköpfe: AP9.1–9.3 `c693b74`, LOVD/Sponsor `bc8625b`,
  AP9.5 `8126093`, Outro einschließlich Layoutfix `918e128`.
- AP9.4-Operationscode stammt ausschließlich aus den bereits integrierten Main-PRs
  #2–#15. Zusätzlich ist nur der rein dokumentarische Run-19-Nachweis `d7f044a`
  übernommen. Keine Restore-Testkonfiguration wird in die PubQuiz-Runtime geladen.
- Der stark veränderte Root-Worktree blieb unangetastet. Kein blinder Cherry-pick,
  kein Force-Push, kein Merge nach `main`.

## Outro-Abnahme

Eigene Preview-Testquizze 45 (`Codex RC Outro-Abnahme 2026-09-17`) und die über
den echten Kopierdialog angelegte Kopie 46; keine Bestandsquizze geändert.

- Aktiv/inaktiv, Defaults und sämtliche individuellen Texte bestanden.
- Telefon, E-Mail, Instagram, `@ungegoogelt`, dynamischer QR-Code und Nutzenhinweise
  bestanden; leere Felder werden nicht ausgegeben.
- Speicherung, Reload und Quizkopie bestanden. Die vorhandenen Abschluss- und
  Kalenderfolien bleiben unverändert.
- BOOKING_CONTACT ist eine nichtinteraktive Präsentationsfolie.
- Smartphone-Scan durch den Betreiber bestätigt das konfigurierte Instagram-Ziel.
- Der zunächst gefundene 720p-Überlauf wurde mit `918e128` ausschließlich in der
  Buchungsdarstellung korrigiert. Danach passen Default- und Kontaktvarianten bei
  1280 × 720 und 1920 × 1080 vollständig in die Folie.
- Evidenz: `screenshots/rc-outro/default-contacts-720p-fixed.png`,
  `default-contacts-fullhd-fixed.png`, `contacts-720p-fixed.png` und
  `contacts-fullhd-fixed.png`.

[Living Specification](../architecture/booking-outro.md).

## Gemeinsame Integration und Qualität

Die fachlich einzige Mergeüberschneidung betraf die Testliste. Die neueren
LOVD-/Sponsor-/Outro-/Monitoringtests und die AP9.1–9.3-Regressionen werden gemeinsam
ausgeführt. Zwei alte VM-Testfixtures erhielten ausschließlich ihre inzwischen realen
Abhängigkeiten. Ein zusätzlicher Integrationstest belegt: Ein Sponsor-Moment verändert
keine laufende Blockdeadline; eine bereits abgelaufene Deadline wird trotzdem
serverseitig geschlossen.

| Gate | Ergebnis |
| --- | --- |
| Gesamte lokale Testsuite | 1.162/1.162 erfolgreich |
| Ergänzende AP9.3-Harness-Tests | 6/6 erfolgreich |
| TypeScript | erfolgreich |
| Changed-file ESLint | 88 Dateien, 0 neue Findings |
| Prisma Validate | erfolgreich |
| Production Build | erfolgreich; Fontdownload erforderte Netzwerkzugriff |
| GitHub-CI für Codeintegration | [35194395622](https://github.com/justphilgud/pubquiz-web/actions/runs/35194395622), success |
| Lokaler Migrationstest | PostgreSQL 18, 6/6 Vertragsprüfungen erfolgreich |
| Gemeinsame RC-Preview | offen |
| Gemeinsamer Browser-/Lastlauf | offen |

Der Migrationstest verwendete einen kurzlebigen Cluster ausschließlich auf
`127.0.0.1:55459`; bestehende Datenbanken wurden nicht verwendet. Der Testcluster
wurde nach Erfolg gestoppt und entfernt.

## Datenbankmigrationen

Gegenüber der echten Production existieren genau zwei neue Migrationen:

| Migration | Zweck | Bewertung |
| --- | --- | --- |
| `20260911120000_team_join_recovery` | Nullable `quiz_team_sessions.join_request_hash` für die Wiederaufnahme eines neuen Beitritts nach verlorener Response | Additiv, kein Default, Bestandszeilen bleiben `NULL`, alter Code ignoriert die Spalte |
| `20260912123000_block_answer_deadline` | Nullable `quiz_block_freigaben.answer_deadline_at`; Backfill nur für offene freigegebene Blöcke mit tatsächlich laufendem Countdown | Additiv und rückwärtskompatibel; geschlossene/inaktive Blöcke bleiben `NULL` |

Der synthetische Test bestätigt Bestandszeilen, Nullable-Defaults, den millisekundengenauen
Deadline-Backfill, den Ausschluss geschlossener/inaktiver Blöcke sowie Inserts im alten
Spaltenformat. Kein Preview-/Production-SQL wurde ausgeführt. Die reale Zielversion ist
Neon PostgreSQL 17; der lokale Engine-Test lief mit PostgreSQL 18.4.

`join_request_hash` ist ein SHA-256-Nachweis über Quiz, normalisierten Teamnamen und eine
zufällige Request-ID. Er enthält weder Team-Passwort noch die Request-ID und erlaubt keine
Anmeldung. Der bestehende AP9.4-Audit schließt weiterhin `users.password_hash` und
`teams.team_passwort` aus und blockiert unreviewte Passwort-/Secret-/Tokenfelder.

### Migrationsplan

1. RC vollständig auf Preview abnehmen; währenddessen keine Migration in Production.
2. Wartungsfenster ohne aktives Quiz wählen. Direkt davor ein aktuelles AP9.4-Backup
   aus Production über `pubquiz_backup_reader` erzeugen und Manifest, SHA-256,
   privaten Readback, Authausschluss und Medienstatus prüfen.
3. Bei fehlgeschlagenem Backup, falscher Zielidentität oder offenem Quiz abbrechen.
4. Nach gesonderter Integrations-/Deploymentfreigabe den exakten freigegebenen SHA
   verwenden. Der geschützte Production-Workflow prüft Host, DB, Branch und Revision,
   zeigt zunächst den Migrationsstatus und führt dann `prisma migrate deploy` aus.
5. Migrationsstatus erneut prüfen; erst danach den exakt selben SHA deployen und den
   Production-Smoke ausführen. Keine Seeds, kein `db push`, kein `migrate reset`.

## Environment- und Operationsisolation

Lesende Providerprüfung am 17.09.2026:

- `pubquiz-web` Production ist ausschließlich mit `pubquiz-media-public`
  (`store_bIx6H2j23vJzi240`, public/FRA1) verbunden.
- Preview ist ausschließlich mit `pubquiz-media-nonprod`
  (`store_VzfNwjccgkzhc9bi`, public/FRA1) verbunden. Der RC-Branch besitzt keine
  eigene abweichende Medienbindung.
- Development besitzt getrennte Development-DB-/Auth-/Medienvariablen; der bestehende
  Vertrag weist den Nonprod-Store zu. Secretwerte wurden nicht ausgegeben.
- `pubquiz-backups` (`store_BVRjATGCRBW0fBeF`) ist private/FRA1 und ausschließlich
  mit Production des separaten Projekts `pubquiz-backup-operations` verbunden.
- Das Operationsprojekt hat keine Datenbankvariable und keinen statischen
  `BLOB_READ_WRITE_TOKEN`; nur OIDC-/Bridge-Konfiguration und die Storebindung.
- Storestände wurden nur gelesen: Nonprod 81 Objekte, Productionmedien 149 Objekte,
  privater Backupstore 105 Objekte. Nichts wurde hochgeladen, gelöscht oder rotiert.
- Production-Deployment und -Aliase blieben unverändert.

R04 bleibt nach diesen Nachweisen geschlossen. AP9.4/R03 bleibt formal offen, weil der
im Runbook verlangte vollständige lokale Read-only-Browser-Smoke gegen das bereits
wiederhergestellte isolierte Ziel noch nicht abgeschlossen ist. Das erfolgreiche Backup
`production/acceptance/run-35102025962-1` und der Restore werden nicht wiederholt.

## Noch ausstehende gemeinsame Preview-Abnahme

Nach der Bereitstellung des exakten finalen RC-SHA:

1. AP9.1: Save/Änderung/Reload/Reconnect, verlorene Save-Response, rechtzeitig
   akzeptiert, verspätet abgewiesen, Status `geändert/speichernd/bestätigt/Fehler/geschlossen`.
2. AP9.2: Countdown, Moderator-/Präsentationsreload, Moderator offline über Deadline,
   Grenz-/Nachfrist-Saves und unveränderte Serverdeadline.
3. Pixel: 3 → 2 → 1, Reload, letzte Stufe offen, manueller Schluss und Sponsorübergang
   ohne vorzeitige Finalisierung oder Deadlineänderung.
4. Sponsor: ohne/mit Sponsor, offen/geschlossen, Logo-Upload/-Tausch/-Entfernen,
   Reload/Kopie/Wiederverwendung, Wartezustand, genau eine Öffnung, Reveal, zweiter Sponsor;
   breite/quadratische/hohe Logos, 720p/Full-HD und Reduced Motion.
5. Outro: kurzer Re-Smoke der bereits vollständig abgenommenen Buchungsfolie.
6. Monitoring: Admin/Editor/anonym, sechs Kacheln, healthy/warning/error/no-quiz,
   Refresh, Desktop/Smartphone und unveränderter Quizlauf.
7. Zusammenhängend: Intro → Join → offene/geschlossene Frage → Sponsor → Sponsorfrage
   → Pixel → Reveal → Zwischenstand → Endstand → Outro → Buchungsfolie; parallel Monitoring.
8. Lastregression gegen die Referenz 20 Teams/40 Clients, mit 40/80 nur als geprüfte
   Reserve. Monitoringbudget 2–3 SELECTs je Erhebung, 30-s-Intervall und 30-s-Cache.

## Pre-Deployment-Backupplan

Kein Backup wird vor vollständiger RC-Abnahme ausgelöst. Danach und noch vor dem Merge,
der einen Productionworkflow auslösen kann, wird ein ausdrücklich manueller AP9.4-Lauf
mit unveränderten Schaltern `BACKUP_AUTOMATION_ENABLED=false` und
`BACKUP_RETENTION_VERIFIED=false` gestartet. Pflichtnachweise sind Snapshotzeit,
Backupkennung, Manifest, exakte Größen, SHA-256, privater Readback, Authausschluss,
Medienvollständigkeit und anonymer Zugriffsnegativtest. Die Kennung kommt in den finalen
Releasebericht. Jeder Fehler stoppt Merge und Deployment. Retention und Automatisierung
bleiben aus; kein Restore ist Bestandteil des normalen Deployments.

## Rollbackplan

- Vorheriger Production-SHA: `1d4c703e068c0752a10757620d1f7fe03d47b20a`.
- Neuer SHA: erst nach gemeinsamer Abnahme endgültig; aktuell `20b3042`.
- Bei CI-, Backup-, Zielguard-, Migrations- oder Previewfehlern wird vor Deployment
  abgebrochen.
- Scheitert der Production-Build vor Umschaltung, bleibt das vorhandene Deployment aktiv.
- Scheitert der Smoke nach Umschaltung, wird der vorherige Production-SHA regulär erneut
  deployt. Die beiden additiven Spalten bleiben bestehen; sie werden nicht gedroppt.
- Der alte Code kann das Schema lesen, bietet aber keine neue Join-Wiederaufnahme und
  keine serververbindliche Deadline. Deshalb erfolgt ein Rollback nur ohne laufendes Quiz.
- Ein Code-Rollback repariert keine fachlich bereits entstandenen falschen Antworten,
  Medienänderungen oder Credentialprobleme. Solche Fälle stoppen den Betrieb und werden
  separat analysiert. Production-Restore ist kein normaler Rollbackschritt.

## Aktuelles externes Gate

Der reguläre Branch-Push hat kein automatisches Preview erzeugt. Der explizite, durch
Projekt-/Branch-/CI-/Storeguards abgesicherte Preview-Aufruf wurde vor Ausführung von der
automatischen Sicherheitsprüfung gestoppt, weil Vercel beim Build die bereits hinterlegten
Nonprod-Datenbank-/Blob-Secrets einbindet. Es wurde kein Deployment angelegt und kein
Secretwert ausgelesen oder geändert. Für diesen konkreten Vorgang ist eine ausdrückliche
Freigabe der Secretübertragung an Vercel erforderlich. Erst danach können die gemeinsamen
Browser-, Netzwerk- und Lastprüfungen beginnen.
