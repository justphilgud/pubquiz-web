# AP9.6 – Backup-Automatisierung und Retention

## Unveränderte Grundlage

AP9.6 erweitert den in AP9.4 abgenommenen Backupkern. Quelle bleibt ausschließlich
`pubquiz_backup_reader` am fest geprüften Production-Direct-Endpoint. Snapshot,
Authausschluss, `pg_dump`, Medienerfassung, Manifest, SHA-256, privater Upload,
Readback und anonymer Zugriffsnegativtest bleiben Pflichtbestandteile jedes Backups.
Transport und Storezugriff verwenden weiterhin GitHub OIDC, die bestehende Trusted
Source, die isolierte Bridge und kurzlebige objektgenaue Berechtigungen. Es gibt
keinen neuen statischen Blobtokenpfad.

Restore bleibt ein gesonderter, ausschließlich manueller Job in
`operations-restore`. Er läuft nur bei der expliziten Workflow-Eingabe
`restore_after_backup=true` und bleibt am Required-Reviewer-Gate geschützt. Der
tägliche Schedule startet niemals einen Restore.

## Zeitplan und Aktivierung

Der bestehende Workflow `AP9.4 Manual Backup and Isolated Restore` enthält den
Schedule `30 2 * * *`. GitHub wertet ihn in UTC aus:

- 03:30 Uhr in Europe/Berlin während der Winterzeit.
- 04:30 Uhr in Europe/Berlin während der Sommerzeit.

Das ist bewusst eine feste UTC-Zeit; der lokale Zeitpunkt verschiebt sich beim
Zeitwechsel um eine Stunde. Alle Backup-, Dry-Run- und optionalen Retentionsschritte
teilen die Concurrency-Gruppe `ap94-manual-acceptance` mit
`cancel-in-progress: false`. Automatische und manuelle Läufe werden dadurch
serialisiert. Ein Retry erhält durch GitHub Run-ID und Run-Attempt eine neue,
unveränderliche Backupkennung und überschreibt kein vorhandenes Objekt.

Solange `BACKUP_AUTOMATION_ENABLED=false` ist, beendet der Schedule den Job vor
Checkout, OIDC, Datenbank- oder Storezugriff. Vor einer späteren Aktivierung muss
in `operations-backup` zusätzlich `PRODUCTION_RELEASE_SHA` auf den tatsächlich
laufenden Production-SHA gesetzt und gemeinsam mit dem Production-Releaseprozess
aktuell gehalten werden. Erst nach Gate 2 darf
`BACKUP_AUTOMATION_ENABLED=true` gesetzt werden.

## Manueller vollständiger Lauf

Der manuelle Trigger verwendet denselben Backupkern und dieselben Prüfungen. Beispiel
für ein geschütztes Eventbackup:

```powershell
gh workflow run ap94-acceptance.yml --repo justphilgud/pubquiz-web --ref main `
  -f mode=acceptance `
  -f production_commit=<AKTUELLER-PRODUCTION-SHA> `
  -f backup_type=pre-event `
  -f protect_backup=true `
  -f restore_after_backup=false
```

Zulässige manuelle Typen:

- `manual`: normaler Betreiberlauf; mit `protect_backup=true` dauerhaft vor der
  normalen Retention geschützt.
- `pre-deployment`: immer geschützt.
- `pre-event`: immer geschützt.

Der Schedule kennzeichnet Backups intern als `scheduled` und ungeschützt. Der Typ,
Schutzstatus und Trigger stehen im Manifest Version 3. Bestehende AP9.4-Manifeste
Version 2 bleiben wiederherstellbar und werden von Retention als geschützte
Legacy-Nachweise behandelt.

## Erfolg und Fehler

Ein Lauf ist nur erfolgreich, wenn Production-Identität, read-only Leserrolle,
Snapshot, Authausschluss, Datenbankdump, Medien, Manifest, Hashes, Größen,
privater Upload, privater Readback und anonymer Zugriffsnegativtest bestanden sind.
Retention läuft im Workflow erst nach dem erfolgreichen Backupstep.

Bei einem Fehler:

- schlägt der Workflow mit einer festen, secretsicheren Fehlerkategorie fehl;
- startet keine Retention und kein Restore;
- wird kein vorhandenes Backup verändert;
- bleibt ein teilweise hochgeladener neuer Pfad unvollständig und wird nie als
  gültiges Backup klassifiziert;
- darf der Betreiber erst nach Ursachenklärung einen neuen Attempt starten.

Private Uploads werden weiterhin seriell ausgeführt. Für einen signierten PUT gilt
eine eng begrenzte Transportwiederholung: höchstens vier Versuche, ausschließlich
nach HTTP 429 oder 5xx, mit exponentiellem Backoff und beachtetem `Retry-After`
(höchstens 60 Sekunden). HTTP 400, 401 und 403 werden nicht wiederholt. Jeder
Versuch fordert eine neue objektgenaue Signed URL an. Nach einer transienten
Antwort prüft ein privater Readback zuerst, ob der Provider das Objekt trotz
verlorener Antwort bereits korrekt gespeichert hat. Exakte Größe und SHA-256
müssen übereinstimmen; ein abweichendes vorhandenes Objekt bricht mit
`PRIVATE_UPLOAD_HASH_CONFLICT` ab. Ein Manifest wird weiterhin erst nach allen
vollständigen und verifizierten Datenartefakten hochgeladen.

Die Uploaddiagnostik protokolliert nur Objektposition, Gesamtzahl, logischen Typ,
Bytezahl, MIME-Typ, SHA-256, Versuch, HTTP-Status, Endpunktklasse, begrenztes
`Retry-After` und allowlist-geprüfte Provider-Request-/Trace-IDs. Objektpfad,
Signed URL, Token und Providertext werden nie ausgegeben. Der manuelle synthetische
Modus kann mit `diagnostic_upload_matrix=true` zusätzlich eine serielle Matrix aus
1 KB, 100 KB, 1 MB, 5 MB und einer repräsentativen 2-MB-Mediendatei ausführen.
Diese festen Testobjekte liegen ausschließlich unter dem run-spezifischen
Synthetic-Prefix und enthalten keine Production-Daten.

## Retention-Policy V1

Die vorgeschlagene Policy ist:

- alle gültigen ungeschützten Backups der letzten 14 Tage behalten;
- danach je UTC-Kalenderwoche den neuesten Wiederherstellungspunkt für weitere
  acht Wochen behalten;
- keine monatliche Stufe in V1;
- neuestes gültiges Backup immer behalten;
- `pre-deployment`, `pre-event`, ausdrücklich geschützte manuelle Backups und
  AP9.4-Legacy-Backups unabhängig vom Alter behalten.

Grundlage ist das reale Backup vom 17. September 2026 mit 209.290.150 Bytes. Die
maximal 22 regulären Daily-/Weekly-Punkte belegen bei unveränderter Größe rund
4.604.383.300 Bytes (4,60 GB beziehungsweise 4,29 GiB), zuzüglich ausdrücklich
geschützter Backups. Der Store hatte vor AP9.6 204 Objekte und 400,22 MB. Das
Vercel-Team läuft auf Pro; der Store ist Private/FRA1. Vercel berechnet Blobstorage
nach durchschnittlicher GB-Monatsgröße, `list()` als Advanced Operation und
`del()` ohne nutzungsabhängige Löschgebühr, aber innerhalb der Operationslimits.
Die aktuellen Providerangaben stehen unter
<https://vercel.com/docs/vercel-blob/usage-and-pricing>.

Eine monatliche Stufe würde bei sechs zusätzlichen Punkten bereits weitere
1.255.740.900 Bytes bei heutiger Größe belegen. Sie bleibt deshalb aus V1 heraus,
bis Wachstum und reale Kosten über mehrere Wochen vorliegen.

## Löschschutz und Dry Run

Die Bridge inventarisiert ausschließlich den festen Prefix
`production/acceptance/`. Der Runner gruppiert danach jede exakte Backupkennung und
liest ausschließlich deren `manifest.json`. Es gibt keine Prefix- oder
Wildcard-Löschung.

Vor jeder auswählbaren Löschung gelten alle folgenden Bedingungen:

1. Die Kennung entspricht exakt dem Production-Backupformat.
2. Das Manifest ist strukturell gültig und klassifiziert.
3. Manifest und vollständige Objektmenge stimmen in Namen und Größen überein.
4. Der Punkt ist weder neuestes gültiges noch aktuelles Backup.
5. Er ist ungeschützt und liegt nachweislich außerhalb der Policy oder ist ein
   älterer Duplikatpunkt derselben Wochenstufe.
6. Eine unmittelbar zweite Inventarisierung stimmt einschließlich ETags vollständig
   mit der Entscheidungsgrundlage überein.
7. Jedes Objekt wird einzeln und mit `ifMatch` auf seinen inventarisierten ETag
   gelöscht. Das Manifest wird zuerst entfernt, damit ein Abbruch keinen
   teilgelöschten Punkt als gültig erscheinen lässt.

Unvollständige, ungültige und fremde Pfade werden behalten und im Bericht
ausgewiesen. Sie werden nicht stillschweigend bereinigt.

Die Bridge bricht bei mehr als 4.096 inventarisierten Objekten sicher ab. Bei der
V1-Policy mit heute etwa 102 Objekten pro vollständigem Backup liegt der reguläre
Daily-/Weekly-Bestand deutlich darunter. Viele dauerhaft geschützte Backups müssen
vor Erreichen dieser Grenze betrieblich geprüft werden; der Grenzwert wird nicht
automatisch erweitert.

Solange `BACKUP_RETENTION_VERIFIED=false` ist, erstellt der Workflow nach einem
erfolgreichen Backup ausschließlich die Liste `keep/delete` mit Gründen, Alter,
Typ, Größe sowie Speicher vorher/nachher. Es wird keine Delete-Operation angefordert.
Nach dem ersten realen Dry Run gilt Gate 1: Löschliste prüfen und ausdrücklich
freigeben. Erst danach darf `BACKUP_RETENTION_VERIFIED=true` gesetzt werden.

Notfallstopp: den jeweiligen Schalter in `operations-backup` auf `false` setzen.
Das deaktiviert den nächsten Schedule beziehungsweise jede echte Retention, ohne
ein Backup oder den Store zu verändern.

## Datenvertrag für Monitoring V1.1

Jedes erfolgreiche Manifest Version 3 liefert ohne Secretwerte:

- Backupkennung, Typ, Schutzstatus und Trigger;
- Snapshot- und Abschlusszeit;
- Production- und Operations-SHA;
- Dauer für Gesamtbackup und Medien;
- exakte Artefaktnamen, Größen und SHA-256;
- Authausschluss und erwarteten Katalog-/Row-Count-Zustand.

Der GitHub-Run ergänzt den Laufstatus, die feste Fehlerkategorie bei Fehlschlag und
die Retention-Zusammenfassung. Monitoring V1.1 kann daraus letzten erfolgreichen
Zeitpunkt, Alter, Dauer, Größe, Integrität, Typ und letzten Fehler ableiten. Die
Production-Anwendung erhält dafür in AP9.6 keine Store-, GitHub- oder
Operationscredentials; eine spätere read-only Aggregationsschnittstelle bleibt
Aufgabe von Monitoring V1.1. Die veraltete V1-Kachel wird in diesem AP nicht
visuell verändert.

## Betriebliche Gates

Vor Gate 1 und Gate 2 bleiben beide Schalter `false`. Phase 1 umfasst nach
Main-Integration und Bridge-Deployment:

1. vollständigen manuellen Backup-Lauf mit Manifest Version 3;
2. unveränderte AP9.4-Integritätsnachweise;
3. Retention-Dry-Run gegen den realen Store;
4. secretsichere synthetische Fehler- und Sicherheitsregression.

Gate 1 gibt ausschließlich echte Retention frei. Gate 2 gibt ausschließlich den
täglichen Schedule frei. Restore, Required Reviewer, isoliertes Ziel und sämtliche
Production-Hostausschlüsse bleiben davon unberührt.
