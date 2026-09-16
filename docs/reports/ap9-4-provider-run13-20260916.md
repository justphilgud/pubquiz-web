# AP9.4 – Lauf #13: Trusted Source korrigiert, Node-ESM-Startfehler

16.09.2026. Main und Operations-Deployment weiterhin
`e903d4dc1d1f0e7b905a14a3e65270070b79c6d5`.

## Providerkonfiguration

Nach Betreiberkorrektur ausschließlich lesend über offiziellen CLI/API-Aufruf geprüft:
GET /v9/projects/prj_vlY35Hljx5kGaMvEuFixATxn5bzv, Scope just-phil-gud.
Nur nicht geheime Schutzfelder ausgegeben. Eine externe Regel für GitHub:

- aud urn:pubquiz:ap94:blob-bridge
- repository justphilgud/pubquiz-web
- ref refs/heads/main
- workflow **AP9.4 Manual Backup and Isolated Restore**
- Ziel nur production dieses Operations-Projekts.

All Deployments unverändert; Runtime-OIDC enabled, Team-Issuer.
Keine Regel/Schutzkonfiguration geändert, keine zweite Regel, keine Credentials rotiert.

## Echter Lauf und belegte Ursache

https://github.com/justphilgud/pubquiz-web/actions/runs/35086038114
Backupjob 104760973865, 49 Sekunden, gescheitert; Restore 104761228211 skipped.

`SYNTHETIC_CASE_1_HTTP_500_BODY_UNRECOGNIZED`

Fall 1 ist weiterhin die falsche Store-ID. Die Function wird nun aufgerufen; das
Vercel-Runtimelog zeigt POST /api/access HTTP 500 mit:

`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/lib/handler' imported from /var/task/api/access.js`

Node beendet sich vor Eintritt in den Handler. Damit ist das vorherige Trusted-Source-
Gate überwunden, aber noch keine erfolgreiche Bridge-/Blob-Autorisierung nachgewiesen.
Kein Upload/Readback/Signed-URL-Test; keine Production-Daten, kein Restore.

## Minimale Korrektur

Die isolierte Bridge ist ein Node-ESM-Paket (`type: module`). Relative Imports ohne
Dateiendung wurden von TypeScript im Bundler-Modus und dem tsx-Testloader toleriert,
sind im erzeugten JavaScript unter Node jedoch nicht auflösbar.

- Fünf Bridge-Dateien: relative Runtime-/Type-Imports verwenden explizit `.js`.
- Bridge-tsconfig: module und moduleResolution auf NodeNext; strict/noEmit erhalten.
- Neuer Regressionstest kompiliert die echte Bridge in ein temporäres Unterverzeichnis
  und lädt api/access.js in einem separaten Node-Prozess **ohne tsx/TS-Loader**.
  Ohne Credentials muss POST die vorgesehene 503/CONFIG_REJECTED-Antwort erreichen.
  Kein Netzwerk-/Blob-/DB-Zugriff nötig; temporäre Ausgabe wird entfernt.
- Dieser Test scheitert vor dem Fix mit demselben ERR_MODULE_NOT_FOUND und besteht danach.

Verantwortungen unverändert: Function delegiert an Handler, Handler prüft Konfiguration
und JWT, Service autorisiert, Provider signiert. Keine Claims-/Scope-/Sicherheitslockerung,
keine App-, Datenbank-, Dependency- oder Workflowänderung.

## Prüfungen und Gate

- Regression: 69/69 bestanden.
- Root-Typecheck und isolierter Bridge-Typecheck bestanden.
- ESLint Bridge und Bridge-Test ohne Warnungen.
- Main-Integration erfordert ausdrückliche Freigabe des neuen PR; hier stoppen.
- Nach Merge/CI ausschließlich Operations auf neuen SHA deployen und synthetische
  Providerabnahme erneut ausführen. Keine echten Backupdaten vor vollständiger Abnahme.
- Restore-Reviewer auch beim synthetischen Lauf nicht umgehen.

Alle Automatisierungs-/Retention-/Transportfreigabeschalter bleiben false; synthetic
bleibt aktiv. PubQuiz-Production unverändert. Keine Bereinigung erforderlich.
R03 Nein. R04 einschließlich neuer Operations-Providerabnahme Nein; alter App-
Isolationsnachweis unverändert. AP9.4 vollständig Nein.
