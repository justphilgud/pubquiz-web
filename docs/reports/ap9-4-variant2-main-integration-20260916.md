# AP9.4 Variante 2 – Main-Integration am 16.09.2026

## Integration

- Freigegebener Commit: `94e24c106f11445b3f2d204933f589129c4be9a9`.
- Regulärer Merge: https://github.com/justphilgud/pubquiz-web/pull/9
- Main: `4bb6168ebf49a9ed058d7e45360eb0d42db54de1`.
- Main-Dateibaum identisch zum freigegebenen Commit (git diff leer).
- Keine Schutzregel geändert oder umgangen; kein Force-Push.

## Prüfungen auf Main

- Security-/Operations-/Deployment-/Workflow-Regression: 66/66 bestanden.
- Root-Typecheck, Bridge-Typecheck und ESLint der vier geänderten TS-Dateien bestanden.
- Main-CI erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35081605524
- Bridge-CI erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35081605455
- Production-Workflow: Scope-Prüfung erfolgreich; **Approve, migrate and deploy Production skipped**:
  https://github.com/justphilgud/pubquiz-web/actions/runs/35081776417
- Preview-Workflow skipped: https://github.com/justphilgud/pubquiz-web/actions/runs/35081776373
- Damit kein Anwendungsdeployment durch diese Integration. Kein Produktcode geändert.
- Bestehende CI-Warnung: checkout/setup-node v4 verwenden deklarativ Node 20; GitHub erzwingt Node 24. Kein Testfehler; außerhalb dieser Integration nicht geändert.

## Manueller Stopp

Nur im Projekt `pubquiz-backup-operations`:

1. Settings → Deployment Protection → Vercel Authentication. Require Log In aktiv lassen.
2. Standard Protection → All Deployments (Protect all domains) → Save.
3. Trusted Sources → Add trusted source → External Service → GitHub Actions.
4. Genau eine Regel: Account `justphilgud`, Repository `pubquiz-web`, Workflow
   `ap94-acceptance.yml`, Branch `main`, Audience `urn:pubquiz:ap94:blob-bridge`.
5. Applies to environments: ausschließlich Production des Operations-Projekts → Add.

Kein GitHub-Environment-Feld voraussetzen: Die Bridge prüft Environment und die zwei
gemessenen Subjects sowie feste IDs und alle übrigen Claims aus dem verifizierten JWT.
Vor Providerabnahme muss das Operations-Deployment den oben genannten Main-Stand
enthalten; ein Main-Merge belegt noch keinen aktualisierten Operations-Runtimestand.

Keine Trusted Source angelegt, keine Providerkonfiguration geändert, kein Backup oder
Restore gestartet. Beide Automatisierungs-/Retention-Schalter unverändert false.
Keine Production-Credentials, Datenbank oder PubQuiz-Anwendung geändert.

Echte Provider-OIDC-/Signed-URL-/Readback-/Restore-Lese-/Negativ-/Ablauftests stehen
nach manueller Konfiguration noch aus. Lokale Tests ersetzen diese Abnahme nicht.
AP9.4 ist deshalb noch nicht vollständig abgenommen.

Dieser Integrationsnachweis und die aktualisierte Gate-Notiz sind lokale
Dokumentationsnachträge; sie gehören nicht zum oben genannten Main-Commit.
