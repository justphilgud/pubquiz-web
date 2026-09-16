# AP9.4 – OIDC Bridge: Vorbereitung am manuellen Gate

Stand 16.09.2026. Basis: main e78099d150f9366b09f08fe250c20e0f0339c44f.
Branch: codex/ap94-oidc-bridge. Keine Integration oder externe Konfiguration vorgenommen.

## Ergebnis

Vorbereitung abgeschlossen; externer OIDC-/Blob-Nachweis ausstehend. Maßgebliche
[Klickanleitung und Claims-Vertrag](../operations/ap94-oidc-bridge-setup.md).
Kein neues Vercel-Projekt provisioniert, keine Storeverbindung/Trusted Source angelegt,
keine Rotation/Secretlöschung, kein echter Backup-/Restorelauf und keine Productionänderung.

## Änderungen und Verantwortlichkeiten

- scripts/operations/bridge/: eigenständiges Vercel-Paket, eine API, JOSE-Identitätsprüfung,
  Rollen-/Objektpolicy, Blob-OIDC-Signed-URL-Ausgabe. Keine App-/DB-Imports.
- scripts/operations/bridge-client.ts: kurzlebige GitHub-OIDC-Abfrage, geheime URL nur
  im Speicher, feste Ziel-/Objektprüfung, begrenzte Streams und feste Fehlercodes.
- private-artifacts.ts: neuer Transport hinter bestehender Hash-/Readback-Schnittstelle.
- acceptance-backup.ts: Run-/Attemptgebundener Pfad und Bridge-Preflight vor DB-Verbindung.
- acceptance-restore.ts: reine Blob-Leseberechtigung; Validierungsbericht im geschützten
  GitHub-Run statt neuem Blob-Upload. DB-Restore und Vergleich unverändert.
- transport-probe.ts / print-claims.ts: explizite datenbankfreie externe Prüfpfade vorbereitet,
  noch nicht ausgeführt. Nur erlaubte signaturgeprüfte Claims werden ausgegeben.
- ap94-acceptance.yml: id-token:write nur in den beiden Environment-Jobs; synthetischer
  Standardmodus, claims-only und explizit gegatete acceptance. Kein static Blob-Secret mehr
  referenziert. Alte Secrets extern unverändert vorhanden.
- ap94-bridge-ci.yml und deployment-scope*: neue isolierte Tests, eng begrenzte
  Operations-Deployausnahme; keine App-Konfiguration geändert.
- Runbook aktualisiert. Root package.json/package-lock.json, App, Prisma und Root-vercel.json
  unverändert. Gleiche bestehende Blob-/JOSE-Bibliotheken im isolierten Paket fest gepinnt.

## Prüfung

- 37/37 lokale Tests: 17 bestehende Operations-/Scopeprüfungen, 8 neue Bridgeprüfungen
  mit mehreren Negativfällen je Test, 12 bestehende CI-/Prisma-Verbindungsprüfungen.
- Repository-Typecheck und eigenständiger Bridge-Typecheck bestanden.
- ESLint aller geänderten TS-Dateien mit --max-warnings=0 bestanden.
- Isoliertes npm ci aus eigenem Lockfile bestanden; kein Root-Abhängigkeitswechsel.
- git diff --check bestanden.

Neue Tests verwenden echte RSA-signierte JWTs und JOSE-Signaturprüfung mit lokalen
Testschlüsseln: falscher Owner/Repo/IDs/ref/Environment/Workflow/Issuer/Audience/Subject,
abgelaufenes/frühes/zu altes JWT und fremde Signatur abgewiesen. Operation, Store,
Run/Attempt, Objektart, Dateiname, Traversal, Wildcard, Größe und Zusatzfelder werden
vor dem Providerzugriff geprüft. Restoreupload sowie Backup→Restore und Restore→Backup
abgewiesen. Provideradapter prüft die konkreten SDK-Argumente für Pfad/Operation/TTL/
Größe/Private/no-overwrite. Runner/HTTP/Signed-URL-Integration nutzt echtes SDK-Signing
mit synthetischer Delegation. Fehlerantworten enthalten keine rohen Providerfehler.

Die lokale Ablauf-/Overwrite-/Roundtripprüfung verwendet ein kontrolliertes
Providermodell. Sie beweist **nicht**, dass Vercels CDN die Parameter tatsächlich
durchsetzt. Genau dafür ist der externe synthetische Probeweg vorbereitet:
Upload/Hash-Readback, Übergröße, Replay, Methoden-/Pfadwechsel und echte Ablaufzeit.
Echte GitHub-Claims, Trusted Sources, Deployment Protection und Provider-OIDC wurden
in dieser Vorbereitung nicht aktiviert oder live abgenommen.

## Verbleibende Gates

1. Reguläres Review/Integration und CI, ohne Schutzregeln zu umgehen.
2. Claims-only-Lauf auf main; am Restore-Reviewer stoppen. Tatsächliche sichere Claims
   abgleichen, bevor die zwei engen Trusted Sources aktiviert werden.
3. Isoliertes Projekt/Production-only Storebindung/OIDC/Deployment Protection manuell
   einrichten. Keinerlei Datenbankcredentials oder Appverbindung.
4. Synthetische externe Abnahme; R04 um den neuen Operations-Isolationsnachweis ergänzen.
5. Erst danach separate Transportfreigabe, acceptance-Bridge-Konfiguration und echter
   AP9.4-Lauf. Bestehende Automatisierungs-/Retentionsflags bleiben false.

Synthetische Probeobjekte bleiben liegen. Kein Delete/Retention aktiviert.
Read-URLs sind innerhalb ihrer kurzen Lebensdauer wiederverwendbar. Keine Einmal-URL-Zusage.
Ein Restore für einen anderen Run oder alten Attempt ist bewusst nicht freigegeben.

R03 Backup/Restore geschlossen: **Nein**.
R04: bestehender App-Isolationsnachweis unverändert; neue Bridge extern noch zu bestätigen.
AP9.4 vollständig abgenommen: **Nein**. RPO/RTO weiterhin offen.
