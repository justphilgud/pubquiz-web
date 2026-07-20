# CI/CD mit GitHub Actions, Prisma und Vercel

Stand: 20. Juli 2026

## Zielarchitektur

GitHub Actions ist der einzige Orchestrator für Qualitätsprüfung, Migration und
Deployment. Vercel bleibt Build- und Hostingplattform. Automatische
Git-Deployments sind im Repository durch `vercel.json` für alle Branches
deaktiviert.

```text
Push / Pull Request
├── verbindliche CI: Generate → Validate → TypeScript → Tests → Diff-ESLint → Next Build
└── Information: vollständiger Repository-ESLint (vorübergehend nicht blockierend)

erfolgreicher Push auf Feature-Branch
└── Preview-Freigabeschalter → DB-Prüfung → Migration → Vercel Build/Deploy → Smoke-Test

erfolgreicher Push auf main
└── Production-Environment → Required Reviewer → DB-Prüfung → Migration
    → Vercel Production Build/Deploy → Smoke-Test
```

Die beiden Deployment-Workflows starten nur, wenn die Repository-Variable
`ACTIONS_DEPLOYMENTS_ENABLED` exakt `true` ist. Sie bleibt während Einrichtung
und Cutover ungesetzt oder `false`. Ein Commit der Pipeline allein kann deshalb
kein Actions-Deployment auslösen.

## Repository-Bestand

- Produktionsbranch: `main`
- GitHub-Repository: `justphilgud/pubquiz-web`
- Vercel-Projekt: `pubquiz-web`
- altes Vercel-Projekt: `pubquiz-web-qvps` (nicht verändern)
- Node.js: 24
- npm mit `npm ci`
- Prisma: 7.8, Migrationen bis `20260722120000_add_rendering_templates`
- Vercel CLI: exakt `56.3.2` über `npx`, keine lokale globale Installation
- lokale Entwicklung: `.env.development.local`

Vor Einführung gab es keine GitHub-Actions-Workflows. Vercel war per Git
Integration verbunden, automatische Deployments waren nicht nachweislich
deaktiviert und Deployment Checks waren nicht eingerichtet. Migrationen für
Preview und Production wurden manuell angestoßen.

## Workflows

### CI

`.github/workflows/ci.yml` läuft bei jedem Push und Pull Request. Der
verbindliche Qualitätsjob hat nur `contents: read`, erhält keine Preview- oder
Production-Secrets und verwendet für Prisma und den Build ausschließlich eine
nicht erreichbare Dummy-URL. Generate, Validate und der Next-Build benötigen
damit keine Cloud-Datenbank.

Der verbindliche ESLint-Schritt prüft alle neu angelegten oder geänderten
JavaScript-/TypeScript-Dateien vollständig. Seine Vergleichsbasis für die
Dateiauswahl ist:

- Pull Request: Merge-Base aus PR-Basis-SHA und Head-SHA;
- Push auf Feature-Branch: Merge-Base aus Head-SHA und `origin/main`;
- Push auf `main`: vorheriger Push-SHA; beim initialen Push der leere Git-Tree.

Berücksichtigt werden hinzugefügte, kopierte, geänderte und umbenannte Dateien
mit den Endungen `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts` und
`.cts`. Gelöschte Dateien werden nicht an ESLint übergeben. Die Dateiliste wird
nullterminiert verarbeitet, sodass Leerzeichen und Sonderzeichen sicher sind.
Wenn keine relevante Datei geändert wurde, meldet der Schritt dies und endet
kontrolliert erfolgreich.

Weil der aktuelle Feature-Stand bereits vor Einführung der Pipeline Findings
in drei gegenüber `main` geänderten Quiz-Dateien enthielt, verwendet der
Diff-Lint eine eng begrenzte Übergangsbasis aus
`config/eslint-transition-baseline.json`. Sie enthält keine ignorierten Dateien
und keine abgeschalteten Regeln, sondern ausschließlich die bekannte Anzahl je
Datei, Schweregrad und ESLint-Regel. Jede Überschreitung, jede neue Regel und
jeder Befund in einer neuen Datei blockiert. Das Budget darf nur verkleinert,
niemals erhöht werden.

Die fünf TypeScript-Dateien dieses CI/CD-Pakets werden zusätzlich explizit mit
`--max-warnings=0` geprüft. Da neue Dateien in der Übergangsbasis grundsätzlich
Budget null besitzen, gilt dieselbe Strenge außerdem automatisch für alle
künftigen neuen JavaScript-/TypeScript-Dateien.

Der separate Job `Informational only — full repository ESLint debt` führt
weiterhin den vollständigen Lauf mit `--max-warnings=0` aus. Er veröffentlicht
Ergebnis und vorhandenen Rückstand sichtbar als Warning und Job Summary, ist
aber ausdrücklich nicht blockierend. Ein grüner Workflow bedeutet während
dieser Übergangsphase deshalb nicht, dass das gesamte Repository lintfrei ist.
Der lokale Sammelbefehl `npm run ci:validate` verwendet denselben Diff-Lint. In
GitHub bestimmen Ereignis-SHAs die Vergleichsbasis; lokal wird der Merge-Base
mit `origin/main` verwendet. Der vollständige Informationslauf kann lokal mit
`npm run lint -- --max-warnings=0` ausgeführt werden.

Der Build lädt `next/font`-Ressourcen aus dem Internet. GitHub-hosted Runner
stellen diesen Netzwerkzugang bereit.

### Preview

`.github/workflows/deploy-preview.yml` reagiert auf einen erfolgreichen
Push-CI-Lauf im Hauptrepository oder auf einen manuellen Start außerhalb von
`main`. Pull-Request-Ereignisse und Fork-Repositories werden abgewiesen.

Der Job verwendet das GitHub Environment `preview`, validiert zuerst dessen
`DATABASE_URL`, führt ausschließlich committed Migrationen aus und prüft danach
die von `vercel pull --environment=preview` geladene Vercel-Datenbankvariable
gegen dieselbe Whitelist. Erst anschließend erfolgen Build und Deployment ohne
`--prod`.

### Production

`.github/workflows/deploy-production.yml` akzeptiert ausschließlich einen
erfolgreichen Push-CI-Lauf auf `main` oder einen manuellen Start auf `main`. Der
Job verweist auf das Environment `production`; dessen Required Reviewer muss
Migration und Secrets vor Jobstart freigeben. Build und Deployment verwenden
`--prod` ausdrücklich.

## Datenbankvalidierung

`scripts/validate-deployment-environment.ts` prüft vor jeder Migration:

- `DEPLOYMENT_ENV` ist exakt `preview` oder `production`;
- Repository, Branch und Ereignistyp sind erlaubt;
- `DATABASE_URL` ist eine parsebare PostgreSQL-URL;
- Host und Datenbankname stimmen exakt mit der Environment-Whitelist überein;
- eine optionale Branch-/Endpoint-Kennung kommt im Host vor;
- Production läuft ausschließlich von `main`, Preview niemals von `main`.

Die Ausgabe enthält nur Umgebung, Repository, Branch, freigegebenen Host und
Datenbanknamen. Benutzername, Passwort, vollständige URL und Query-Parameter
werden nie ausgegeben. Dieselbe Prüfung läuft ein zweites Mal gegen die durch
Vercel gepullte Environment-Datei. Damit müssen GitHub Migration und Vercel
Runtime auf dieselbe freigegebene Datenbankidentität zeigen.

## Prisma-Ablauf

Jedes Deployment führt in dieser Reihenfolge aus:

1. `prisma migrate status` als informative Vorprüfung;
2. `prisma migrate deploy`;
3. `prisma migrate status` als verbindliche Nachprüfung;
4. erst danach Vercel Build und Deployment.

Die Vorprüfung darf einen Fehlerstatus liefern, weil ausstehende committed
Migrationen genau der erwartete Deploymentfall sind. `migrate deploy` und die
Nachprüfung müssen erfolgreich sein. Die Pipeline erzeugt keine Migration,
verwendet kein `migrate dev`, `db push`, `migrate reset` oder `migrate resolve`
und behauptet keinen automatischen Rollback.

Migrationen müssen rückwärtskompatibel sein. Bevorzugt werden additive
Änderungen; destruktive Änderungen benötigen Expand-and-Contract über mehrere
Releases.

## Concurrency

Preview und Production besitzen getrennte, feste Concurrency-Gruppen mit
`cancel-in-progress: false`. Dadurch laufen nie zwei Migrationen gleichzeitig
gegen dieselbe Zielumgebung und ein laufendes Production-Deployment wird nicht
abgebrochen. GitHub hält pro Gruppe höchstens einen wartenden Lauf; bei vielen
schnellen Pushes kann ein älterer noch wartender Lauf durch einen neueren ersetzt
werden. Laufende Migrationen bleiben davon unberührt.

## GitHub-Einrichtung

### Repository-Variable

Zunächst anlegen und auf `false` belassen:

| Name | Scope | Zweck |
| --- | --- | --- |
| `ACTIONS_DEPLOYMENTS_ENABLED` | Repository variable | globaler Cutover-Schalter |

### Environment `preview`

Secrets:

- `DATABASE_URL`
- `VERCEL_TOKEN`

Variables:

- `EXPECTED_DATABASE_HOST`
- `EXPECTED_DATABASE_NAME`
- `EXPECTED_DATABASE_BRANCH` (empfohlen; stabiler Neon Endpoint-Identifier)
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Nur vertrauenswürdige Branches des Hauptrepositorys zulassen. Kein Fork erhält
diese Secrets.

### Environment `production`

Dieselben Namen mit ausschließlich Production-Werten anlegen. Zusätzlich:

1. Required Reviewer konfigurieren;
2. Selbstfreigabe verhindern, wenn organisatorisch möglich;
3. Deployment Branch auf `main` beschränken;
4. Bypass durch Administratoren deaktivieren, wenn der GitHub-Plan dies erlaubt.

Required Reviewers sind laut GitHub bei Free, Pro und Team nur für öffentliche
Repositories verfügbar. Ist dieses Repository privat und bietet der aktuelle
Plan keinen Required Reviewer, ist der Production-Cutover gestoppt. Der globale
Schalter bleibt `false`; eine schwächere automatische Freigabe ist nicht erlaubt.

### Branch Protection

Für `main` mindestens einrichten:

- Pull Request vor Merge;
- erfolgreicher Statuscheck
  `Prisma, TypeScript, Tests, Changed-file ESLint and Build`;
- Branch muss vor Merge aktuell sein;
- direkte Pushes soweit organisatorisch möglich sperren.

## Vercel-Einrichtung

`vercel.json` enthält `git.deploymentEnabled: false`. Das ist die von Vercel
dokumentierte Projekteinstellung zum Abschalten automatischer Deployments aller
Git-Branches. Die Git-Verbindung kann für Status- und Kommentar-Funktionen
bestehen bleiben. Ein `Ignored Build Step` ist dafür nicht nötig und wäre
weniger eindeutig.

Im Projekt `pubquiz-web` manuell prüfen:

1. Production Branch ist `main`;
2. Node.js ist 24.x;
3. Preview- und Production-Variablen besitzen den richtigen Scope;
4. `DATABASE_URL` zeigt je Scope auf die erwartete Neon-Identität;
5. Domains und Preview-Schutz erlauben den technischen Smoke-Test;
6. ein Push erzeugt nach Übernahme von `vercel.json` kein Git-Deployment mehr.

Das Projekt `pubquiz-web-qvps` weder trennen noch verändern. `.vercel` bleibt
ignoriert; Org- und Project-ID werden als GitHub-Environment-Variablen gesetzt.

Der Vercel Token soll minimalen Zugriff auf Team und Projekt besitzen. Werte
werden weder in Befehlsausgaben noch in Job Summaries geschrieben.

## Neon-Prüfung

Für Preview und Production getrennt und ohne Connection-Strings zu kopieren:

1. Endpoint-Host feststellen;
2. Datenbanknamen feststellen;
3. stabilen Endpoint-Identifier als `EXPECTED_DATABASE_BRANCH` verwenden;
4. GitHub `DATABASE_URL` und Vercel `DATABASE_URL` demselben Ziel zuordnen;
5. Development weiterhin ausschließlich auf `pubquiz-dev` belassen.

## Cutover-Plan

### Phase 1 – Code übernehmen

1. Workflows, Validator, Tests, Dokumentation und `vercel.json` reviewen.
2. `ACTIONS_DEPLOYMENTS_ENABLED` fehlt oder ist `false`.
3. Änderungen committen und pushen. Es darf kein Actions-Deployment laufen.
4. In Vercel bestätigen, dass `vercel.json` den Git-Deploymentversuch überspringt.

### Phase 2 – GitHub und Infrastruktur vorbereiten

1. Environments, Secrets und Variables anlegen.
2. Required Reviewer und `main`-Beschränkung verifizieren.
3. Branch Protection aktivieren.
4. Neon- und Vercel-Identitäten anhand der wertfreien Namen prüfen.
5. Prüfen, dass der verbindliche Diff-Lint grün und der vollständige
   Informationsjob weiterhin deutlich als vorhandener Rückstand sichtbar ist.

### Phase 3 – Preview abnehmen

1. Weiter bestätigen, dass Git-Pushes keine Vercel-Deployments erzeugen.
2. `ACTIONS_DEPLOYMENTS_ENABLED=true` setzen.
3. Preview-Workflow auf einem vertrauenswürdigen Feature-Branch manuell starten.
4. Validierung, Migration, Deployment und Smoke-Test prüfen.
5. Bei Fehler Schalter sofort wieder auf `false` setzen; keine Migration
   zurückrollen oder automatisch auflösen.

### Phase 4 – Production umstellen

1. Production Required Reviewer und `main`-Beschränkung erneut prüfen.
2. Einen Merge nach `main` durchführen.
3. Wartenden Production-Job manuell freigeben.
4. Migration, Deployment, Domainzuordnung und Smoke-Test beobachten.

### Phase 5 – Nachkontrolle

- keine zusätzlichen Vercel-Git-Deployments;
- CI als erforderlicher Statuscheck aktiv;
- Preview und Production serialisiert;
- lokale Preview-/Production-URLs im Regelbetrieb nicht mehr erforderlich;
- Logs enthalten keine Connection-Strings oder Tokens.

## ESLint-Übergangsmodell

Der repositoryweite Ausgangsstand enthält bereits ESLint-Fehler und Warnungen
in fachfremden Bestandsdateien. Diese Pipeline behebt sie nicht, schaltet keine
Regel ab und erweitert keine Ignore-Liste. Stattdessen gilt eine verbindliche
„no new debt“-Grenze: Jede gegenüber `main` geänderte JavaScript-/TypeScript-
Datei wird geprüft; nur exakt budgetierte Altfindings bleiben vorübergehend
zulässig. Neue Dateien und neue Findings müssen ohne Fehler und Warnungen
bestehen.

Der bei Einführung gemessene vollständige Repository-Lauf enthält 20 Fehler und
108 Warnungen. Davon liegen 6 Fehler und 23 Warnungen in den bereits vor diesem
CI/CD-Paket gegenüber `main` geänderten Quiz-Dateien. Nur diese 29 Findings sind
in der Übergangsbasis exakt nach Datei, Schweregrad und Regel budgetiert; der
restliche Rückstand erscheint ausschließlich im vollständigen Informationsjob.

Der vollständige Informationsjob bleibt bestehen, bis der Rückstand in einem
separaten, fachlich geprüften Auftrag vollständig beseitigt wurde. Danach wird
in einem eigenen Review:

1. `npm run lint -- --max-warnings=0` als verbindlicher Schritt in den
   Qualitätsjob verschoben;
2. die Übergangsbasis nach jeder Teilbereinigung verkleinert und schließlich
   entfernt;
3. der nicht blockierende Informationsjob entfernt;
4. der Workflowtest auf den vollständigen verbindlichen Lauf umgestellt;
5. die Branch-Protection weiterhin auf denselben Qualitätsjob ausgerichtet.

Bis zu diesem Umschaltpunkt blockiert nur neuer oder berührter Lint-Rückstand
Preview und Production. Der bekannte unberührte Altbestand bleibt sichtbar,
blockiert den Cutover aber nicht.

## Fehlerfälle

- **CI fehlgeschlagen:** Kein Deployment. Ursache im betroffenen Check beheben.
- **Identität fehlgeschlagen:** Schalter deaktivieren und Environment-Zuordnung
  prüfen; keine Migration ausführen.
- **Migration fehlgeschlagen:** Kein Deployment. Zustand und Prisma-Fehlerklasse
  untersuchen; kein automatisches `migrate resolve`.
- **Migration erfolgreich, Deployment fehlgeschlagen:** Datenbank nicht
  zurückrollen. Deploymentursache beheben und denselben Commit erneut deployen.
- **Smoke-Test fehlgeschlagen:** Deployment als fehlerhaft behandeln, Logs und
  Schutzregeln prüfen; keine schreibenden Smoke-Tests ausführen.
- **Paralleler Lauf:** Laufenden Job beenden lassen. Nicht durch einen manuellen
  lokalen Migrationslauf umgehen.

Ein lokaler Production-Migrationslauf ist nur ein ausdrücklich autorisiertes
Incident-Verfahren mit einem einzelnen Operator, bestätigter Datenbankidentität
und dokumentiertem Vier-Augen-Prinzip. Er ist kein regulärer Fallback.

## Regelbetrieb

```text
Feature entwickeln
→ Migration lokal gegen Development erstellen und committen
→ pushen
→ CI und Preview abwarten
→ Preview testen
→ Pull Request mergen
→ Production-Job freigeben
→ Migration, Deployment und Smoke-Test beobachten
```

## Externe Referenzen

- [Vercel: automatische Git-Deployments deaktivieren](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments)
- [Vercel CLI: pull](https://vercel.com/docs/cli/pull)
- [Vercel CLI: deploy und --prebuilt](https://vercel.com/docs/cli/deploy)
- [GitHub: Deployments und Environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub: Concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency)
