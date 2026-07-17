# Environment Architecture

Stand: 17. Juli 2026

Dieses Dokument beschreibt die verbindliche Trennung von Local Development,
Preview und Production. Es enthält keine Secretwerte. Aussagen sind als
Repository-Nachweis, bestätigte externe Vorgabe oder noch offene manuelle
Prüfung gekennzeichnet.

## 1. Zielbild

| Umgebung | Anwendung | Datenbank | Medien |
| --- | --- | --- | --- |
| Local Development | lokales `next dev`, Vercel-Kontext Development | Neon `pubquiz-dev` | Blob `pubquiz-media-nonprod`, Präfix `question-media/dev/` |
| Preview | Preview-Deployment im Vercel-Projekt `pubquiz-web` | Neon `pubquiz-preview` | Blob `pubquiz-media-nonprod`, Präfix `question-media/preview/` |
| Production | Production-Deployment im Vercel-Projekt `pubquiz-web` | Neon `production` | Blob `pubquiz-media-public`, Präfix `question-media/prod/` |

Jede Laufzeit darf ausschließlich auf die ihr zugeordnete Neon-Datenbank und
den ihr zugeordneten Blob-Store zugreifen. Das Vercel-Projekt
`pubquiz-web-qvps` bleibt während der kontrollierten Migration unverändert und
wird erst nach erfolgreicher Abnahme aller drei Zielumgebungen aus dem
Deploymentfluss genommen.

## 2. Infrastrukturmatrix

| Bereich | Local Development | Preview | Production |
| --- | --- | --- | --- |
| Vercel-Projekt | kein Deployment; Konfiguration logisch wie Development | `pubquiz-web` | `pubquiz-web` |
| Vercel-Environment | Development beziehungsweise lokal | Preview | Production |
| Git-Branch / Deployment-Typ | lokaler Arbeitsbranch | Vercel Preview für Nicht-Production-Branches und Pull Requests; genaue Branchregeln manuell prüfen | Production Branch; Soll `main`, in Vercel manuell prüfen |
| Neon-Branch | `pubquiz-dev` | `pubquiz-preview` | `production` |
| Blob-Store | `pubquiz-media-nonprod` | `pubquiz-media-nonprod` | `pubquiz-media-public` |
| Blob-Pfadpräfix für neue Fragenmedien | `question-media/dev/` | `question-media/preview/` | `question-media/prod/` |
| Auth-Konfiguration | eigener lokaler `AUTH_SECRET`; Hostvertrauen nur lokal | eigener Preview-Secret; Vercel-Hostableitung | eigener Production-Secret; Production-Domain |
| Erlaubter Datenzugriff | nur Neon `pubquiz-dev` und Blob nonprod | nur Neon `pubquiz-preview` und Blob nonprod | nur Neon `production` und Blob production |

Die Store-Zuordnungen und Neon-Branches sind bestätigte externe Vorgaben. Ob
die entsprechenden Vercel-Variablen und Connection Strings bereits exakt so
gesetzt sind, ist nicht aus dem Repository ablesbar.

## 3. Environment-Variablenmatrix

Legende: **Pflicht** bedeutet für die genannte Funktion erforderlich;
**optional** bedeutet Fallback, Anzeige oder nur bei Nutzung eines bestimmten
Credential-Pfads. Plattformvariablen werden nicht als manuell zu pflegende
Secrets behandelt.

| Name | Zweck | Local | Preview | Production | Sichtbarkeit | Pflicht / optional | Aktuelle Quelle im Code |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL/Neon für Next-Runtime, Prisma CLI, Seed und Benutzerskript | Neon `pubquiz-dev` | Neon `pubquiz-preview` | Neon `production` | Server | Pflicht | `app/lib/prisma.ts`, `lib/prisma.ts`, `prisma.config.ts`, `prisma/seed.ts`, `scripts/create-user.ts` |
| `AUTH_SECRET` | Signatur/Verschlüsselung der Auth.js-JWT-Sitzung; zusätzlich Upload-Konfigurationsprüfung | eigener lokaler Secret | eigener Preview-Secret | eigener Production-Secret | Server | Pflicht | Auth.js-Umgebungsauflösung; explizit `mediaUploadEnvironment.ts` |
| `AUTH_TRUST_HOST` | Hostheader für Auth.js vertrauen | optional; lokal vorhanden | normalerweise durch `VERCEL=1` abgedeckt | normalerweise durch `VERCEL=1` abgedeckt | Server | Optional | Auth.js-Umgebungsauflösung |
| `AUTH_URL` | explizite kanonische Auth-Basis-URL | optional | optional | optional, Production-Domain | Server | Optional | Auth.js; URL-Prüfung in `mediaUploadEnvironment.ts` |
| `NEXTAUTH_URL` | älterer Alias für `AUTH_URL` | optional | optional | optional | Server | Optional / Kompatibilität | Auth.js; Fallback in `mediaUploadEnvironment.ts` |
| `NEXTAUTH_SECRET` | älterer Alias für Auth.js-Secret | nicht als alleiniger Secret verwenden | nicht als alleiniger Secret verwenden | nicht als alleiniger Secret verwenden | Server | Optional / Kompatibilität | Auth.js; die Upload-Konfiguration verlangt weiterhin ausdrücklich `AUTH_SECRET` |
| `AUSWERTUNG_PASSWORT` | Zugriffsschutz mehrerer Quiz-, Show- und Slide-Routen | eigener lokaler Wert | eigener Preview-Wert | eigener Production-Wert | Server | Pflicht für diese Routen | `app/quiz/**/page.tsx` |
| `NEXT_PUBLIC_APP_ENV` | sichtbares Umgebungslabel in der Versionsanzeige | logisches Label Development | logisches Label Preview | logisches Label Production | Client, beim Build eingebettet | Optional; Default `development` | `app/lib/appVersion.ts`, dargestellt durch `AppVersion.tsx` |
| `NODE_ENV` | Next-Modus, Prisma-Client-Caching und lokaler Fallback des Medienpräfixes | von `next dev` als `development` gesetzt | von Next/Vercel als `production` gesetzt | von Next/Vercel als `production` gesetzt | Server / Build | Frameworkverwaltet | Prisma-Module, Quizroute, `mediaUploadEnvironment.ts` |
| `VERCEL_ENV` | unterscheidet Vercel Development, Preview und Production; bestimmt Medienpräfix | bei Vercel Development automatisch, lokal meist nicht gesetzt | automatisch `preview` | automatisch `production` | Server | Auf Vercel plattformverwaltet | `mediaUploadEnvironment.ts`; Blob-SDK-Callbackauflösung |
| `VERCEL` | erkennt Vercel-Laufzeit und aktiviert Auth.js-Hostvertrauen | normalerweise nicht gesetzt | automatisch | automatisch | Server | Plattformverwaltet | `mediaUploadEnvironment.ts`; Auth.js; Blob-SDK |
| `MEDIA_UPLOAD_ENV` | expliziter Medienumgebungs-Override außerhalb Vercels | optional `dev` | nicht auf Vercel erforderlich | nur bei anderer Hostinglaufzeit erforderlich | Server | Optional | `mediaUploadEnvironment.ts` |
| `BLOB_READ_WRITE_TOKEN` | Read/Write-Credential; zwingend für den alten Client-Token-Upload | Blob nonprod | Blob nonprod, solange alter Upload genutzt wird | Blob production, solange alter Upload genutzt wird | Server | Bedingt Pflicht | `mediaUploadEnvironment.ts`; implizit `handleUpload` und `put` im Blob-SDK |
| `VERCEL_OIDC_TOKEN` | kurzlebiges Vercel-Credential für Store-spezifische Blob-Operationen | optional und kurzlebig | bevorzugt, automatisch bereitzustellen | bevorzugt, automatisch bereitzustellen | Server | Optional lokal; auf Vercel für OIDC-Pfad erforderlich | `mediaUploadEnvironment.ts`; Blob-SDK |
| `BLOB_STORE_ID` | ordnet OIDC einer Blob-Store-ID zu | Store nonprod bei OIDC | Store nonprod bei OIDC | Store production bei OIDC | Server | Pflicht zusammen mit OIDC, sonst optional | `mediaUploadEnvironment.ts`; Blob-SDK |
| `BLOB_WEBHOOK_PUBLIC_KEY` | verifiziert Presigned-Upload-Events | Schlüssel des Zielstores | Schlüssel des Nonprod-Stores | Schlüssel des Production-Stores | Server; Public Key, dennoch nicht in Client-Bundle | Pflicht für `/api/question-media-upload` | `mediaUploadEnvironment.ts`; `handleUploadPresigned` |
| `VERCEL_BLOB_CALLBACK_URL` | optionaler Callback-URL-Override des alten Blob-Uploads | optional | optional | optional | Server | Optional | Blob-SDK, ausgelöst durch `/api/blob-upload-token` |
| `VERCEL_BRANCH_URL` | Preview-Callback-URL für alten Blob-Upload | nicht benötigt | automatisch | nicht benötigt | Server | Plattformverwaltet | Blob-SDK |
| `VERCEL_URL` | Fallback-Deployment-URL für alten Blob-Upload | nicht benötigt | automatisch | automatisch | Server | Plattformverwaltet | Blob-SDK |
| `VERCEL_PROJECT_PRODUCTION_URL` | Production-Callback-URL für alten Blob-Upload | nicht benötigt | nicht benötigt | automatisch | Server | Plattformverwaltet | Blob-SDK |

### Variablen, die vorhanden oder angefragt sind, aber nicht aktiv verwendet werden

| Name | Befund |
| --- | --- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | In lokalen Env-Dateien vorhanden, aber kein Codezugriff im Repository. Offenbar Altlasten. |
| `DIRECT_URL` | Weder vorhanden noch im Prisma-Schema oder in `prisma.config.ts` gelesen. |
| `APP_ENV` | Kein Codezugriff; die Anwendung verwendet stattdessen `NEXT_PUBLIC_APP_ENV`. |
| `AUTH_SECRET_1`, `AUTH_SECRET_2`, `AUTH_SECRET_3` | Von Auth.js für Rotation unterstützt, aber nicht Projektkonvention; als alleinige Werte würden sie an der expliziten `AUTH_SECRET`-Prüfung des Medienuploads scheitern. |
| `AUTH_REDIRECT_PROXY_URL` | Von Auth.js unterstützt, aber bei Credentials-Login ohne OAuth-Proxy aktuell nicht benötigt. |

### Client-Sicherheit

Im Projekt wird nur `NEXT_PUBLIC_APP_ENV` mit `NEXT_PUBLIC_` gelesen. Dieser
Wert ist ein nicht geheimer Anzeigetext und wird beim Build in das Client-Bundle
eingebettet. Datenbank-, Auth- und Blob-Secrets tragen kein `NEXT_PUBLIC_` und
werden vom Anwendungscode nicht an den Browser übergeben.

## 4. IST-Zustand

### Im Repository nachgewiesen

- Git-Remote ist `justphilgud/pubquiz-web`; der aktuelle Branch ist `main`.
- Lokal existieren `.env`, `.env.local` und `.env.local.backup`.
- Nicht vorhanden sind `.env.development`, `.env.development.local`,
  `.env.production` und `.env.production.local`. Vor diesem Auftrag gab es
  keine Example-Datei; die neue `.env.example` enthält ausschließlich
  Variablennamen, Kommentare und Platzhalter.
- `.env.local.backup` ist weder eine Next.js- noch eine dotenv-Standardquelle.
- `.gitignore` ignoriert lokale `.env*`-Dateien und `.vercel`; ausschließlich
  die wertfreie `.env.example` ist ausdrücklich ausgenommen.
- Die lokale `.vercel/repo.json` nennt `pubquiz-web-qvps`; eine
  `.vercel/project.json` und eine `vercel.json` existieren nicht.
- `package.json` enthält nur `dev`, `build`, `start` und `lint`. Es gibt keine
  Upload- oder Deploymentskripte und kein Vercel-CLI-Skript.
- `prisma.config.ts` definiert Migrationen und Seed und liest ausschließlich
  `DATABASE_URL`; `DIRECT_URL` wird nicht verwendet.
- Next-Runtime und beide Prisma-Client-Module lesen `DATABASE_URL`.
- Drei Blob-Uploadpfade existieren:
  - `/api/question-media-upload`: Presigned Upload, runtimeabhängig explizites
    Read/Write-Token oder OIDC plus Store-ID, zusätzlich Webhook Public Key.
  - `/api/blob-upload-token`: alter Client-Token-Upload, benötigt zwingend
    `BLOB_READ_WRITE_TOKEN` und nutzt keine OIDC-Alternative.
  - `/api/upload-medium`: serverseitiges `put`, lässt das SDK implizit OIDC
    vor Read/Write-Token wählen.
- Nur neue Fragen- und Antwortmedien haben verlässliche Präfixe
  `question-media/dev|preview|prod/...`. Die älteren Routen schreiben unter
  `medien/...` ohne Environment-Präfix.

### Lokale Env-Dateien – nur Variablennamen

| Datei | Vorhandene Namen | Wird automatisch geladen von |
| --- | --- | --- |
| `.env` | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUSWERTUNG_PASSWORT`, `DATABASE_URL` | Next.js als niedrigste Priorität; `dotenv/config` in Prisma-Konfiguration und Benutzerskript |
| `.env.local` | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_APP_ENV`, `VERCEL_OIDC_TOKEN` | Next.js; nicht vom einfachen `dotenv/config` |
| `.env.local.backup` | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_APP_ENV`, `VERCEL_OIDC_TOKEN` | von keiner vorhandenen Standardkonfiguration |

### Next.js-Priorität im Development-Modus

Die installierte Next.js-Version 16.2.5 dokumentiert folgende Reihenfolge. Pro
Variable gilt der erste Fund:

1. bereits gesetztes `process.env`
2. `.env.development.local`
3. `.env.local`
4. `.env.development`
5. `.env`

Von diesen Dateien existieren derzeit nur `.env.local` und `.env`. Damit
überschreibt `.env.local` in `next dev` gleichnamige Variablen aus `.env`.
`dotenv/config` lädt dagegen standardmäßig `.env`, nicht `.env.local`.

### Als externe Ausgangslage bestätigt

- Neon besitzt die Branches `production`, `pubquiz-dev` und `pubquiz-preview`
  mit den im Auftrag genannten Eltern-/Zielbeziehungen.
- `pubquiz-media-public` ist mit `pubquiz-web` verbunden und soll Production
  bedienen.
- `pubquiz-media-nonprod` existiert und soll Development und Preview bedienen.
- `pubquiz-media` ist privat und bleibt vorerst unverbunden und unangetastet.
- `pubquiz-web` und `pubquiz-web-qvps` sind mit demselben Git-Repository
  verbunden. Das alte Projekt bleibt in diesem Auftrag unverändert.

### Noch manuell zu prüfen

- Welche Environment-Variablen in beiden Vercel-Projekten je Target gesetzt
  oder durch Integrationen injiziert werden.
- Welcher Blob-Store in jedem Vercel-Target tatsächlich verbunden ist.
- Welche Neon-Connection hinter jeder `DATABASE_URL` liegt.
- Production Branch, Preview-Branchregeln, Domains und Git-Integration in
  Vercel.
- Schema- und Migrationsstand aller drei Neon-Branches.

## 5. SOLL-Zustand

Die verbindliche Zielkonfiguration ist:

- **Local:** Neon `pubquiz-dev`, Blob `pubquiz-media-nonprod`, Präfix `dev`,
  ausschließlich ignorierte lokale Secrets.
- **Preview:** Vercel-Projekt `pubquiz-web`, Neon `pubquiz-preview`, Blob
  `pubquiz-media-nonprod`, Präfix `preview`, eigener Auth-Secret.
- **Production:** Vercel-Projekt `pubquiz-web`, Neon `production`, Blob
  `pubquiz-media-public`, Präfix `prod`, eigener Auth-Secret.
- **Projekt:** Nach Abnahme ist `pubquiz-web` das einzige aktive
  Git-Deploymentprojekt. `pubquiz-web-qvps` wird erst anschließend kontrolliert
  deaktiviert und noch später gelöscht.

## 6. Abweichungen IST zu SOLL

| Bereich | IST | SOLL | Risiko | Notwendige Maßnahme | Art |
| --- | --- | --- | --- | --- | --- |
| Lokale Vercel-Verknüpfung | `.vercel/repo.json` nennt `pubquiz-web-qvps` | Hauptprojekt `pubquiz-web` | Diagnose oder CLI-Befehle könnten das alte Projekt betreffen | Erst nach vollständiger Vercel-Prüfung kontrolliert neu verknüpfen | Manuell, später |
| Lokale Datenbankquelle | Next nutzt vorrangig `.env.local`; Prisma CLI und `create-user` laden über `dotenv/config` `.env` | alle lokalen Werkzeuge auf Neon `pubquiz-dev` | App, Seed, Benutzeranlage und Migrationen können verschiedene Datenbanken treffen | Variablennamen und Zielbranch vor jedem Prisma-/Skriptaufruf vergleichen; spätere einheitliche Ladeweise separat planen | Teilweise Code, teilweise manuell |
| Blob-Credentials | Drei Routen verwenden unterschiedliche Credentialauflösungen | ein konsistenter Store je Umgebung | OIDC kann bei `put` ein vorhandenes Read/Write-Token übersteuern; alter Token-Upload kann ohne Read/Write-Token ausfallen | Vercel-Variablen je Target inventarisieren; Routenvereinheitlichung in eigenem Auftrag | Teilweise Code, teilweise manuell |
| Blob-Pfade | Nur Question Editor trennt dev/preview/prod | alle umgebungsübergreifend genutzten Stores sicher getrennt | alte Präfixe können im gemeinsamen Nonprod-Store kollidieren | Betroffene alte Uploads inventarisieren und später migrieren | Code, später |
| Blob-Store-Verbindungen | Repository zeigt keine Target-Zuordnung | nonprod für Local/Preview, public für Production | Schreiben in falschen Store | Integrationsvariablen und Store-ID je Vercel-Target manuell prüfen | Manuell |
| Vercel-Projekte | Zwei Projekte deployen dasselbe Repository | nur `pubquiz-web` | doppelte Deployments, abweichende Secrets und Domains | Erst Zielprojekt abnehmen, dann altes Projekt aus Git-Deployments nehmen | Manuell, später |
| Auth-Secrets | tatsächliche Vercel-Werte nicht sichtbar | getrennte Secrets je Umgebung | Umgebungsübergreifende Sessions oder Login-Ausfall | Vorhandensein und Trennung je Target prüfen, Werte nicht kopieren oder anzeigen | Manuell |
| Environment-Label | `NEXT_PUBLIC_APP_ENV` hat Default `development` | korrektes sichtbares Label je Build | Production/Preview kann als Development erscheinen | Nicht geheimen Wert je Build-Target prüfen | Manuell |
| Prisma `DIRECT_URL` | nicht verwendet | derzeit kein Muss; Entscheidung dokumentieren | Pooling-/Migrationsanforderungen könnten unberücksichtigt sein | Neon-/Prisma-Verbindungsstrategie manuell bestätigen, erst dann Code ändern | Manuell |

## 7. Manuelle Prüfcheckliste

### Vercel – ohne Werte anzuzeigen

- [ ] Projekt `pubquiz-web`: Git-Repository und Production Branch prüfen.
- [ ] Production-Domain `pubquiz-web.vercel.app` und Preview-Domains prüfen.
- [ ] Für Development, Preview und Production jeweils nur Namen, Scope und
      Vorhandensein der erforderlichen Variablen prüfen.
- [ ] `DATABASE_URL` je Target dem richtigen Neon-Branch zuordnen.
- [ ] Blob-Verbindung: Development/Preview → `pubquiz-media-nonprod`.
- [ ] Blob-Verbindung: Production → `pubquiz-media-public`.
- [ ] Je Target prüfen, ob OIDC plus `BLOB_STORE_ID` und
      `BLOB_WEBHOOK_PUBLIC_KEY` konsistent zum verbundenen Store gehören.
- [ ] Solange `/api/blob-upload-token` genutzt wird, das Vorhandensein eines
      zum Store passenden `BLOB_READ_WRITE_TOKEN` prüfen.
- [ ] Preview-Deployment aus einem Nicht-Production-Branch auslösen und erst
      nach Freigabe die fachlichen Smoke-Tests durchführen.
- [ ] Im Projekt `pubquiz-web-qvps` nur Bestand aufnehmen; nichts trennen,
      löschen oder überschreiben.

### Neon – ohne Connection Strings anzuzeigen

- [ ] Branches `production`, `pubquiz-dev`, `pubquiz-preview` und ihre
      Parent-Zuordnung bestätigen.
- [ ] Vercel-Targets anhand Branchname/Connection-Identität zuordnen.
- [ ] Prisma-Migrationsstand auf allen drei Branches vergleichen.
- [ ] Prüfen, ob Runtime und Migrationen Pooling beziehungsweise direkte
      Verbindung unterschiedlich benötigen.
- [ ] Schreibrechte so begrenzen, dass jede Umgebung nur ihren Zielbranch
      erreicht.

## 8. Sicherer Migrationsplan

Noch keine dieser Maßnahmen wird durch diesen Auftrag ausgeführt.

1. `pubquiz-web` für Local, Preview und Production vollständig inventarisieren
   und gemäß SOLL konfigurieren.
2. Local gegen Neon `pubquiz-dev` und Blob nonprod prüfen.
3. Preview gegen Neon `pubquiz-preview` und Blob nonprod prüfen.
4. Production gegen Neon `production` und Blob production prüfen.
5. Erst nach erfolgreicher Abnahme `pubquiz-web-qvps` aus weiteren
   Git-Deployments nehmen.
6. Rückfallmöglichkeit festhalten: altes Projekt unverändert und deaktivierbar
   erhalten, bis mehrere erfolgreiche Zieldeployments bestätigt sind.
7. Das alte Projekt erst in einem späteren, ausdrücklich freigegebenen Schritt
   löschen.

## 9. Offene Fragen

1. Welche Variablennamen und Scopes sind aktuell in `pubquiz-web` und
   `pubquiz-web-qvps` für Development, Preview und Production gesetzt?
2. Welche Store-ID und welcher Webhook Public Key gehören in jedem Target zum
   tatsächlich verbundenen Blob-Store?
3. Wird `/api/blob-upload-token` noch produktiv für Intro-Audio/-Video genutzt?
   Davon hängt ab, wie lange `BLOB_READ_WRITE_TOKEN` zwingend bleibt.
4. Welche `DATABASE_URL` zeigt derzeit in jedem Vercel-Target auf welchen
   Neon-Branch?
5. Soll Prisma für Migrationen künftig eine separate direkte Verbindung
   verwenden, obwohl `DIRECT_URL` aktuell nicht implementiert ist?
6. Ist `main` im Projekt `pubquiz-web` bereits der konfigurierte Production
   Branch, und welche Branches erzeugen Preview-Deployments?
7. Sind `ADMIN_EMAIL` und `ADMIN_PASSWORD` endgültig entbehrliche Altlasten?
