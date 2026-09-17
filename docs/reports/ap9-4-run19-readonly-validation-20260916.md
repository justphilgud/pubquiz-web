# AP9.4 – Run 19: vollständige lesende Nachvalidierung nach PR #15

Stand: 16.09.2026. **Daten-Nachvalidierung erfolgreich; vollständige AP9.4-Abnahme bleibt bis zum gesonderten Browser-Smoke offen.**

## Integration und unveränderte Systeme

PR #15 wurde nach ausdrücklicher Betreiberfreigabe regulär integriert. Freigegebener
Head: `8b3ada2771cc68cd6c598a8574fd674dd470cf52`.
Main: `49ee7b68173ee574ed98c0912efbd8a187ef13ad`.

- [Main-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/35107950778): erfolgreich, einschließlich Typecheck und ESLint.
- [Bridge-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/35107950680): erfolgreich.
- [Deploy Production #231](https://github.com/justphilgud/pubquiz-web/actions/runs/35108183985): Scope-Prüfung erfolgreich; **Approve, migrate and deploy Production übersprungen (0s)**.
- Deploy Preview #237 ebenfalls übersprungen.
- `app/` ist gegenüber Production-Release `1d4c703e068c0752a10757620d1f7fe03d47b20a` unverändert.
- 65/65 Operations-/Bridge-/Deployment-Scope-Regressionstests nach Main-Integration nochmals lokal erfolgreich.

Kein neuer Backup-/Restorelauf, kein Deployment, keine Credential-/Environment-/Schutzregeländerung,
keine Änderung an Production, Preview oder Development. Beide Automatisierungs-/Retention-Schalter
wurden nicht geändert. Keine App-/Domain-Verbindung zum Restore-Projekt eingerichtet.

## Unveränderte Backup- und Zielidentität

Backup: `production/acceptance/run-35102025962-1`, [Run #19](https://github.com/justphilgud/pubquiz-web/actions/runs/35102025962).
Snapshot: `2026-09-16T13:28:18.907504+00:00`.
Artefakte: 209290150 Bytes; zusätzlich Manifest 259377 Bytes.
Manifest-SHA-256: `d60a86f750a9c6f80ec7e66f7c37c54f87cd779986b1783b13474f3feb76581b`.
`parseManifest` aus dem integrierten Stand hat Hash, Identität, Inventar, Quelle, Ziel und Authpolicy erneut erfolgreich geprüft.

Ziel: `pubquiz-restore-test-20260914`, Projekt `icy-leaf-46256271`,
Branch `br-bitter-paper-b20sx4lu`, Endpoint `ep-small-poetry-b2jfzg9w`,
Host `ep-small-poetry-b2jfzg9w.c-6.eu-central-1.aws.neon.tech`, `neondb`.
Aktuelle lesende Identitätsprüfung: `neondb_owner`, PostgreSQL `17.11 (c4ba6b8)`,
`transaction_read_only=on`. Die bestehenden festen Ausschlüsse der Production-,
Preview- und Development-Hosts sowie der zusätzliche exakte Ziel-Pin bleiben unverändert.

## Methode und Resultat

Abfragen ausschließlich im authentifizierten Neon-SQL-Editor des fest identifizierten
Restoreprojekts: `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, `search_path=pg_catalog`,
UTC, ISO-Datumsformat. Keine DDL/DML, kein nextval/setval, kein Restoreaufruf.
Ein syntaktisch fehlerhafter SELECT-Kodierungsversuch wurde explizit zurückgerollt;
auch diese Transaktion war read-only.

Metadaten gelesen um `2026-09-16T14:24:30.29178Z`, vollständige Zeilenbelege um
`2026-09-16T14:35:40.385099Z`. Die Spalten wurden vor dem Datenlesen mit dem bestehenden
`auditColumns` geprüft. Die beiden Authspalten wurden zusätzlich in den SELECT-Projektionen
redigiert. Eine separate Aggregatprüfung bestätigt die tatsächlich im Ziel vorhandenen
inerten Werte (0 nicht redigierte Werte).

Die vollständigen Zeilen wurden als geordnete PostgreSQL-JSON-**Texte** erfasst,
nicht als numerisch neu serialisierte Datensätze. Ein lokaler Replay-Adapter liefert
nur diese tatsächlich gelesenen Ergebnisse an das unveränderte `collectSnapshot`.
Der integrierte `compareSnapshots` vergleicht anschließend alle fünf Bereiche ohne
weitere Normalisierung oder abgeschwächte Gates. Temporäre lokale Rohbelege enthalten
keine ursprünglichen Passwortwerte und werden nicht in Git veröffentlicht.

| Prüfung | Ergebnis |
| --- | --- |
| Unerwartete Schemas/Foreign Tables/Publikationen/Routinen | 0 |
| Spaltendefinitionen | 460 identisch |
| Tabellen / sämtliche Zeilen / vollständige Tabellenhashes | 45 / 1717 / alle identisch |
| Deterministische Stichprobenhashes | 171 identisch |
| Constraints einschließlich FK/CHECK/Validierungsstatus | 165 gleichwertig gemäß engem PR-15-Vertrag |
| Indizes einschließlich partiellem Unique-Index | 158 gleichwertig gemäß engem PR-15-Vertrag |
| Sequenzdefinitionen und last_value/is_called | 41 vollständig identisch |
| Enumlabels / Schemas / Views | 63 Labels / 2 Schemas / 0 Views identisch |
| Migrationen | alle 42 Zeilen inklusive vollständigem Tabellenhash identisch |
| Tatsächliche nicht redigierte Authwerte im Ziel | 0 |
| Medienreferenzen | alle 96 identisch |
| Gespeicherte Ergebnisaggregate einschließlich pending | alle 20 identisch |

Die erste direkte Übernahme aus dem sichtbaren Browserzellentext kollabierte
Mehrfachleerzeichen in sieben Zeilen dreier Tabellen. Das erzeugte ausschließlich
lokale Hashabweichungen. PostgreSQL-seitig berechnete SHA-256-Werte stimmten bereits
exakt mit dem Backup überein. Erneuter Transfer des JSON-Texts als Base64 beseitigte
den Darstellungsfehler; anschließend bestand **derselbe unveränderte Validator** alle
Vergleiche. Keine Produktions-/Restorekorrektur und keine Validatorausnahme erforderlich.

## Anwendungssmoke, Ergebnisrekonstruktion und Medien

Die vorhandenen Anwendungsfunktionen `formatQuizPoints` und `rankScores` wurden auf
allen 20 rekonstruierten Team-Ergebnisgruppen aus vier Quizzen ausgeführt. Punktewerte
sind endlich, Formatierung erfolgreich; Ranking einschließlich Gleichständen entspricht
exakt der Rekonstruktion aus den Manifestdaten. Anwendungscode entspricht dem oben
identifizierten Production-Release. Dies ist ein **Domain-Smoke**, kein behaupteter
Browser-/Login-/Routingtest.

Mediennachweis: Run #19 hat vor dem einzigen Datenbankschreibaufruf sämtliche Artefakte
privat heruntergeladen, Größen/Hashes geprüft und `verifyMediaFiles` für alle 96 Originale
abgeschlossen. Erst danach konnte der später beobachtete Katalogfehler auftreten.
Das ist ein Nachweis aus dem ausgeführten Kontrollfluss, kein neuer Medien-Downloadlauf.
Die aktuelle Nachvalidierung bestätigt erneut die vollständige URL-/Manifestzuordnung.
Kein Medienobjekt wurde verändert, veröffentlicht, gelöscht oder in Production zurückgeschrieben.

## Zeitbewertung / RPO / RTO

- Snapshot: 13:28:18.907504 UTC.
- Backupmessung im Manifest: 259497 ms (4m19.497s); Medienerfassung darin 2887 ms.
  Der Messpunkt liegt vor abschließendem Manifestupload/Anonymtest, also keine vollständige End-to-End-Dauer.
- Gesamter Backupjob laut GitHub: 5m08s.
- Restorejob: 4m10s; eigentlicher Restore-/Validierungsschritt 13:34:43 bis 13:38:09 UTC, 3m26s.
- In diesem Schritt: privater Download, Medienprüfung, Zielprüfung, DB-Restore mit Commit,
  anschließend fehlgeschlagener Katalogvergleich. Die reine DB-Restoredauer wurde wegen
  des späteren Fehlers nicht ausgegeben. Belastbare Obergrenze: **206 Sekunden**, kein exakter Einzelmesswert.
- Snapshotalter bei Beginn des Restore-Schritts: **6m24.092s**. Der DB-Restore begann
  innerhalb dieses Schritts; Alter beim tatsächlichen DB-Start daher zwischen **6m24.092s und 9m50.092s**.
- Erfolgreiche Offline-Nachvalidierung abgeschlossen um `2026-09-16T14:36:24.616Z`;
  Rechenzeit 24 ms, ausdrücklich ohne SQL-Abfrage-/Transfer-/Bedienzeiten.
- Vom Beginn des ursprünglichen Restore-Schritts bis zur bestätigten Datennachvalidierung:
  **61m41.616s** inklusive Diagnose, Fix-/Freigabe-/CI- und manueller Nachvalidierungszeit.
  Vom Snapshot bis dahin: **68m05.709s**.

RPO-Nachweis: Der gesicherte Datenstand ist der genannte Snapshot; Änderungen danach
sind nicht Teil dieses Backups. Es wird kein fiktiver Ausfallzeitpunkt und kein dauerhaftes
RPO-Versprechen angenommen. Automatisierung bleibt aus. RTO: Die Datenwiederherstellung
ist nachgewiesen; die vollständige Anwendungsbereitschaft ist wegen des noch offenen
Browser-Smokes nicht abschließend gemessen. Keine exakte Restore-/Validierungsteilzeit erfinden.

## Verbleibendes Abnahmegate

Das Runbook verlangt zusätzlich einen echten Application-/Browser-Smoke gegen das isolierte
Ziel und erklärt ausdrücklich, dass der Domain-Smoke ihn nicht ersetzt. Gleichzeitig gilt
weiterhin das Verbot einer App-/Domain-Verbindung. Eine ausschließlich lokale, kurzlebige,
technisch schreibgesperrte Testinstanz wurde deshalb zur Abgrenzung beim Betreiber angefragt.
Keine solche Verbindung wurde ohne Klärung hergestellt. Keine Authwerte werden hierfür
restauriert oder im Ziel neu gesetzt. Ein HTML-Test mit frei erfundenen Daten wäre kein Ersatz.

- Datenbank-/Manifest-/Ergebnis-Nachvalidierung: **bestanden**.
- R03 Backup/Restore geschlossen: **Nein**, bis Browser-Smoke/Anwendungsbereitschaft geklärt und nachgewiesen.
- R04 Preview-/Production-Isolation geschlossen: **Ja**, bestehende Nachweise unverändert; aktueller Main-Deploy wurde übersprungen.
- AP9.4 vollständig abgenommen: **Nein**.

Nächster sicherer Schritt: Browser-Smoke unter explizit geklärter lokaler Read-only-Grenze
vorbereiten; vorhandenes Backup und vorhandenes Restoreziel weiterverwenden. Kein erneuter Backup-/Restorelauf.
