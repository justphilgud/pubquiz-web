# AP9.4 – Implementierung und erneuter Preflight, 14.09.2026

**R03 Backup/Restore geschlossen: Nein**  
**R04 Preview-/Production-Isolation geschlossen: Nein**  
**AP9.4 vollständig abgenommen: Nein**

Operations-Code: `52615034ac96076c403c4b429f1ced93d7403da2`, ausgehend von
main `1d4c703e068c0752a10757620d1f7fe03d47b20a`.
[Entwurf PR #2](https://github.com/justphilgud/pubquiz-web/pull/2).
Keine Anwendung, Prisma-Datei, Paketdatei oder Vercel-Konfiguration verändert.
Main wurde nicht verändert; kein echter Backup-/Restorelauf gestartet.

## Implementierung und Architektur

[Ausführungsvertrag und Grenzen](../operations/ap94-manual-acceptance.md).
Der native PostgreSQL-Dump behält seine Aufgabe für Schema und gewöhnliche Daten.
Eine SQL-Projektion ersetzt users.password_hash und teams.team_passwort bereits
vor dem Transfer. Ein geprüftes Overlay erhält die übrigen Spalten und Beziehungen.
Schema- und Inhaltsprüfungen sperren weitere erkannte Auth-/Secretfelder; beliebige
Secrets in unstrukturiertem Freitext sind damit nicht universell erkennbar.

Neue Operations-Module übernehmen Snapshot, private Artefakte/Medien, Restore und
Vergleich. Der Restore ist auf den j-Host des isolierten Projekts fest gebunden,
prüft ein leeres Ziel und läuft transaktional. Readback prüft Größe und SHA-256.
Der manuelle Workflow verlangt beide Schalter false und trennt den Restore durch
operations-restore mit unveränderter Reviewer-Protection. Eine zusätzliche
Pfadprüfung unterdrückt Production-Deployment bei reinen Operations-Änderungen.

Geänderte Bereiche: scripts/operations (Adapter, CLI und Tests),
.github/workflows/ap94-acceptance.yml, .github/workflows/deploy-production.yml,
Operations-Runbook und dieser Bericht. Keine neuen Abhängigkeiten.

## Tests

- Typecheck erfolgreich; ESLint der Operations-Dateien erfolgreich.
- 22 gezielte Operations-/CI-Tests erfolgreich, beide Workflow-YAMLs geparst.
- Lokaler PostgreSQL-18.4-Integrationstest mit TLS/SCRAM Channel Binding bestanden:
  konsistenter Snapshot bei paralleler Änderung, Authausschluss, Standard-Dump und
  Restore, Unicode/Quotes/Dezimalwerte, FKs, Migrationen, Row Counts und Hashes,
  Ergebnisvergleich sowie Abweisung eines bereits gefüllten Ziels.
- Medien-Roundtrip inklusive Mapping und Korruptionsfall lokal geprüft.

Die Tests verwenden synthetische Daten. Echte Neon-17-/Blob-Credentials wurden
damit nicht validiert. Browser-Anwendungssmoke steht nach dem geschützten Restore
aus; implementierter Domain-Smoke verwendet Rang-/Punkteformatierungsfunktionen.
Persistierte Endpunkte werden verglichen, nicht sämtliche Antworttypen neu bewertet.

## Lesender Preflight und verbleibende Gates

- GitHub RESTORE_TEST_EXPECTED_HOST zeigt den korrigierten
  ep-small-poetry-b2jfzg9w.c-6.eu-central-1.aws.neon.tech. URL-Secret wurde vom
  Betreiber neu gesetzt; sein maskierter Inhalt ist nicht rücklesbar.
- Separates Neon-Projekt icy-leaf-46256271 / br-bitter-paper-b20sx4lu ist gegenüber
  Production, Preview und Development eindeutig verschieden. Keine Appbindung.
- Beide Automatisierungs-/Retention-Schalter bleiben false. Kein automatisches
  Löschen, keine Secretrotation und keine Änderung von Schutzregeln.
- Nonprod-Blob-Projektbindung zeigt nur Preview. Allgemeine Preview-Variablen
  verweisen auf den Nonprod-Store. Ein Development BLOB_READ_WRITE_TOKEN existiert
  als maskierte Config ohne angezeigte Storebindung; dessen Identität ist unbewiesen.
- Ältere Preview-Deployments stehen weiterhin auf Ready. Ein Nachweis, dass dort
  keine früheren Production-Mediencredentials nutzbar sind, fehlt weiterhin.
- Private Store-Konfiguration ist vorbereitet; tatsächlicher Tokenzugriff,
  Upload, privater Readback und Restore bleiben Teil der nicht gestarteten Abnahme.

Die automatische Sicherheitsprüfung lehnte den direkten Push nach main wegen
möglicher CI-/Deployment-Auswirkungen und fehlender ausdrücklicher Freigabe für
diesen konkreten Push ab. Kein alternativer Merge wurde versucht. Stattdessen
liegt die Operations-Änderung auf einem separaten Branch als Draft PR #2 vor.
Nächster externer Schritt: ausdrückliche Freigabe der geprüften Main-Integration;
zusätzlich bleiben die genannten R04-Credentialnachweise erforderlich.

Erst nach diesen Gates erneuter Preflight und manueller Abnahmelauf. Am GitHub
Required-Reviewer-Gate stoppen und den konkreten Run nennen. Aktuell existiert
kein AP9.4-Abnahmerun zur Freigabe. Backup-/Restorezeiten und RPO/RTO sind noch
nicht gemessen und werden nicht aus den lokalen Tests abgeleitet.
