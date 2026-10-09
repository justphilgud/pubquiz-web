# Frische temporäre Restore-Datenbank je Test

## Architektur und Grenzen

Neue Datenbank je Test im bereits verifizierten isolierten Projekt
`icy-leaf-46256271`, Branch `br-bitter-paper-b20sx4lu`, Endpoint
`ep-small-poetry-b2jfzg9w`. Endpointkonfiguration und vorhandenes `neondb`
bleiben unverändert. Keine neue Neon-Branchkopie, kein Schema-only-Branch:
auch dessen Tabellen würden den vorgeschriebenen Leerzustand verletzen.
Neon unterstützt mehrere Datenbanken pro Branch:
https://api-docs.neon.tech/reference/createprojectbranchdatabase

Dieser Ansatz isoliert Datenbanken, nicht Compute oder administrative Rollen.
Der existierende Nonprod-Owner bleibt administrativ breit berechtigt. Er darf
keine Produktionsrolle sein; die Projekt-/Endpointpins bleiben unverändert.
Restorecode verbindet sich ausschließlich mit der freigegebenen temporären
Datenbank. Die vorhandenen Nonprod-Credentials werden nicht ausgegeben,
kopiert, verändert oder durch neue ersetzt. Keine Provisionierungs-API oder
automatische Löschung hinzugefügt. Der vorhandene Zugang zur Neon-Konsole
ist der aktuell nachgewiesene autorisierte Provisionierungsweg; eine
automatisierte Neon-Provisionierungsberechtigung ist nicht nachgewiesen.

## Zielnachweis

Geschützte Environment-Variable `RESTORE_TEMPORARY_TARGET` in
`operations-restore`, keine öffentliche workflow_dispatch-Zieleingabe:

```json
{
  "version": 1,
  "id": "<32 zufaellige lowercase Hexzeichen>",
  "project": "icy-leaf-46256271",
  "branch": "br-bitter-paper-b20sx4lu",
  "endpoint": "ep-small-poetry-b2jfzg9w",
  "database": "ap94_restore_<dieselbe ID>",
  "createdAt": "<ISO-Zeitpunkt der frischen Erstellung>",
  "expiresAt": "<ISO-Zeitpunkt, maximal 24 Stunden spaeter>",
  "backupId": "production/acceptance/run-37971426600-1",
  "manifestSha256": "5dfa4924e283a354376716f6e03c8924fb401eaa28d5580dc572afdd006d6720"
}
```

Der Nachweis ist eine reviewer-geschützte administrative Freigabe, kein
kryptographischer Neon-API-Nachweis. Vor Konfiguration muss die Konsole die
Zuordnung von Projekt/Branch/Endpoint unabhängig bestätigen. Der bestehende
Secret `RESTORE_TEST_DATABASE_URL` dient nur als gepinnter Nonprod-Transport;
der Code ersetzt ausschließlich den Datenbanknamen. Fehlender Nachweis
blockiert jeden realen Restore, einschließlich des älteren acceptance-Modus.
Das nicht leere `neondb` kann nicht als temporäres Ziel benannt werden.

Das frische Ziel erhält ausschließlich folgenden Datenbankkommentar:
`ap94:restore-test:<ID>:<expiresAt>`.
Der Vergleich erfolgt READ ONLY über `pg_catalog` und in der einzigen
Schreibtransaktion erneut. Es werden keine vorhandenen Schemas, Rollen oder
Datenbanken vorbereitet oder zurückgesetzt. Ein unerwartetes Objekt blockiert.
Laufzeitende sperrt neue Restores, löscht jedoch keine Daten automatisch.
Keine Test-ID/Datenbank nach erfolgreichem Restore wiederverwenden.

## Ablauf nach gesonderter Freigabe

1. PR integrieren; CI und tatsächlich übersprungenen Appdeployjob bestätigen.
2. Neuerstellung ausschließlich in der vorhandenen isolierten Neon-Konsole
   genehmigen. Zufällige neue Test-ID, Name und Lebensdauer dokumentieren.
   Projekt, Branch, Endpoint, PostgreSQL17 und Rolle kontrollieren. Eine
   neue leere Datenbank mit Owner `neondb_owner` erstellen; falls SQL-Weg
   autorisiert/verfügbar, `TEMPLATE template0` verwenden. Nicht `neondb`
   klonen. Kommentar nur auf dieser neu erstellten Datenbank setzen.
   CONNECT/TEMPORARY f�r PUBLIC ausschlie�lich auf der neuen Datenbank
   entziehen. Keine anderen gew�hnlichen Loginrollen d�rfen effektives CONNECT
   haben; der Read-only-Preflight pr�ft das. Neon-Provideradministration und
   Superuser bleiben eine dokumentierte administrative Vertrauensgrenze.
3. Benötigte Rechte: autorisierte Neon-Projektverwaltung für die neue
   Datenbank; alternativ tatsächlich wirksames CREATEDB für einen gesondert
   freigegebenen SQL-Provisionierungsweg. Schema-Owner/CREATE für Restore.
   Rollenrechte werden nicht erweitert. Fehlt eine Berechtigung: BLOCKED.
4. Nachweis als geschützte Variable hinterlegen; vorhandene Secrets und
   Hostkonfiguration unverändert lassen. Freigabe für diese Konfiguration
   ist separat erforderlich. Nur ein aktiver Zielnachweis gleichzeitig.
5. `mode=restore-preflight`, oben genanntes Backup und Manifest-SHA dispatchen.
   Provenienzjob validiert den erfolgreichen alten Backup-Run. Der separat
   reviewer-geschützte Job prüft private Manifest-/Artefakthashes, vollständige
   DB-/Medienbestandteile, Marker, Rollen-/DB-/PG-Identität, READ ONLY,
   Leerzustand und Berechtigungen. PASS enthält `restoreExecuted=false`.
   Jeder Fehler blockiert, kein neues Backup und keine Zieländerung.
6. Nur nach ausdrücklicher Schreibrestore-Freigabe denselben Nachweis mit
   `mode=restore-only` verwenden. Alle Prüfungen erneut; Lease, Kommentar
   und Leerzustand zusätzlich innerhalb der Schreibtransaktion. Ablauf
   oder Objekte seit Preflight blockieren. Restore single-transaction;
   SQL-Abbruch rollt zurück. Nach Commit prüft der bestehende Kern alle
   Daten-/Schema-/Sequenz-/Mediennachweise. Bei Validierungsfehler keine
   automatische Reparatur, Wiederholung oder Löschung.
7. Ergebnis manifestieren: tatsächliche Ziel-ID, Datenbank, Ablaufzeit,
   Backup-ID/Hash, Restorestatus und Integritätsstatus. Keine Inhalte,
   Passwörter, SQL-Fehlertexte oder Connectionstrings veröffentlichen.
8. Bereinigung nur nach gesonderter Freigabe: exakt Projekt/Branch/Endpoint,
   Datenbankname und Marker erneut prüfen, keine laufenden Jobs/Verbindungen,
   Nachweis vorher sichern. `temporaryCleanupPlan` erzeugt nur einen Plan.
   In Neon ausschließlich diese neue temporäre Datenbank löschen. Kein
   FORCE, kein Session-Abbruch, kein Branch-/Endpoint-/neondb-Löschen.
   Geschützten Nachweis anschließend deaktivieren. Keine Retention- oder
   Backuplöschung. Bei unterbrochenem Restore zuerst Zielstatus prüfen;
   keine unbekannten Daten beseitigen.

## Ressourcen, Schutz und Tests

Compute wird mit dem vorhandenen Nonprod-Branch geteilt; kein zusätzlicher
Branch/Endpoint nötig. Restore und Prüfungen verbrauchen Computezeit,
Speicher/History und Transfers; temporäre Daten müssen nach dokumentierter
Abnahme kontrolliert entfernt werden. Vor Provisionierung aktuelle
Kontingente/Abrechnung prüfen, keine kostenlose Ausführung zusagen.
Kostenmodell: https://neon.com/blog/new-usage-based-pricing

Echte PostgreSQL17-CI: neue template0-Datenbank, READ-ONLY-Leerprüfung,
fehlende Rechte, falscher Marker, nicht leeres Ziel ohne Datenverlust,
atomarer Abbruch, erfolgreicher vollständiger Restore, kontrollierte
Fixture-Bereinigung ohne FORCE. Die vorhandene Datenbank sowie die Quelle
werden vor/nach Restore und Bereinigung per Snapshot verglichen.
Policytests: falsches Projekt/Branch/Endpoint, persistenter oder Production-
Host, unbekannte Metadaten, Backupabweichung, ungültige/abgelaufene Lease,
fehlende/zu breite Bereinigungsfreigabe und kein öffentlicher Zieleingang.

Keine Production-Verbindung, -Migration oder -Anwendungsbereitstellung
hinzugefügt. Bestehende Backup-Manifeste unverändert: deren historisches
Zielfeld bleibt ein überprüfter Herkunftsnachweis, nicht die neue Restore-
Destination. Die Zielidentität steht separat im Restore-Evidence.
PR95 bleibt bis zur genehmigten realen Wiederherstellung und vollständigen
Integritätsprüfung gesperrt. Diese Änderung ist Vorbereitung, kein Restore.
