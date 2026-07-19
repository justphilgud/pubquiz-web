# Environment-Architektur

Stand: 17. Juli 2026

## Zielmatrix

| Umgebung | Anwendung | Datenbank | Medien |
| --- | --- | --- | --- |
| Local Development | lokales `next dev` | Neon `pubquiz-dev` | `pubquiz-media-nonprod`, Präfix `dev/` |
| Preview | Vercel-Projekt `pubquiz-web` | Neon `pubquiz-preview` | `pubquiz-media-nonprod`, Präfix `preview/` |
| Production | Vercel-Projekt `pubquiz-web` | Neon `production` | `pubquiz-media-public`, Präfix `prod/` |

Das alte Vercel-Projekt `pubquiz-web-qvps` bleibt bis zu einer separat
freigegebenen Umschaltung unverändert. Dieser Repository-Stand trennt oder
deaktiviert keine Infrastruktur.

## Lokale Konfiguration

`.env.development.local` ist die verbindliche lokale Standardquelle. Bereits
explizit gesetzte Prozessvariablen besitzen entsprechend der Next.js-Laderegel
immer Vorrang. Prisma CLI, Seed, `scripts/create-user.ts` und
`npm run env:check` verwenden denselben Loader. Relevante Werte werden nicht
still aus `.env` oder `.env.local` ergänzt. `.env.example` enthält die
benötigten Namen und wertfreie Platzhalter; alle echten `.env*`-Dateien bleiben
ignoriert.

Ein kontrollierter einmaliger Prisma-Aufruf kann deshalb ein explizites Ziel
verwenden, ohne die lokale Datei umzuschreiben:

```powershell
$env:DATABASE_URL='<explizite-url>'
npx prisma migrate status
Remove-Item Env:DATABASE_URL
```

`prisma.config.ts` meldet dabei ausschließlich, ob die URL aus der
Prozessumgebung, der lokalen Datei oder der Plattform stammt. Prisma zeigt bei
Migrationsbefehlen Host, Datenbank und Schema des Ziels. Die URL und
Zugangsdaten werden nicht durch eigene Diagnoseausgaben protokolliert.

Einrichtung:

1. `.env.example` nach `.env.development.local` kopieren.
2. `DATABASE_URL` ausschließlich auf Neon `pubquiz-dev` setzen.
3. stabile, nur lokal verwendete Werte für Auth und den nonprod Blob-Store
   eintragen; keinen kurzlebigen OIDC-Token verwenden.
4. `npm run env:check` ausführen. Der Befehl zeigt nur Statusangaben, verbindet
   sich weder mit Neon noch mit Blob und endet bei Fehlern ungleich null.

## Auflösung der Serverumgebung

Die Anwendung kennt exakt `development`, `preview` und `production`. Die
Priorität ist `MEDIA_UPLOAD_ENV`, danach `VERCEL_ENV`, danach `NODE_ENV`.
`MEDIA_UPLOAD_ENV` ist für kontrollierte serverseitige Tests vorgesehen und
darf nur einen der drei exakten Werte enthalten. `NEXT_PUBLIC_APP_ENV` ist ein
nicht geheimes UI-Label und niemals eine Sicherheitsentscheidung.

| Variable | Local | Preview | Production |
| --- | --- | --- | --- |
| `DATABASE_URL` | Pflicht, Neon `pubquiz-dev` | Pflicht, Neon `pubquiz-preview` | Pflicht, Neon `production` |
| `AUTH_SECRET` oder `NEXTAUTH_SECRET` | eigener stabiler Wert | eigener Preview-Wert | eigener Production-Wert |
| `MEDIA_UPLOAD_ENV` | `development` empfohlen | normalerweise nicht setzen | normalerweise nicht setzen |
| `VERCEL_ENV` | nicht erforderlich | Plattformwert `preview` | Plattformwert `production` |
| `BLOB_READ_WRITE_TOKEN` | Pflicht, nonprod | Pflicht, nonprod | Pflicht, public |
| `BLOB_WEBHOOK_PUBLIC_KEY` | für Presigned-Upload Pflicht | für Presigned-Upload Pflicht | für Presigned-Upload Pflicht |
| `NEXT_PUBLIC_APP_ENV` | optionales Label | optionales Label | optionales Label |

`VERCEL_OIDC_TOKEN` und `BLOB_STORE_ID` sind keine Anwendungskonfiguration für
Uploads. Falls Vercel sie als Plattformvariablen bereitstellt, ignoriert die
Credential-Auflösung sie bewusst. Kein Server-Secret darf mit `NEXT_PUBLIC_`
beginnen oder an Client-Komponenten übergeben werden.

## Prisma und Datenbanksicherheit

Vor jedem lokalen Prisma-Befehl muss `npm run env:check` erfolgreich sein.

- Nur gegen Neon `pubquiz-dev`: `npx prisma migrate dev`.
- Gegen Preview und Production ausschließlich in einem kontrollierten
  Deploymentprozess: `npx prisma migrate deploy`.
- `prisma db push`, `prisma migrate reset` und vergleichbare Reset-/Push-Wege
  sind für Preview und Production verboten.
- `npm run dev` führt keine Migration automatisch aus.
- `npm run build` und Vercel-Builds führen ebenfalls keine Migration aus.
- Vor `migrate dev` oder `migrate deploy` immer zuerst `migrate status` mit
  exakt derselben `DATABASE_URL` ausführen und das angezeigte Ziel prüfen.
- `20260718170000_add_question_template_config` enthält die Spalte
  `pubquiz.fragen.template_config_json`. Ein P2022 in einer Zielumgebung zeigt,
  dass diese vorhandene Migration dort noch nicht ausgerollt wurde; die
  Anwendung ersetzt keinen kontrollierten `migrate deploy`-Schritt.

Der gemeinsame Loader stellt sicher, dass Prisma-Konfiguration, Seed und
Benutzeranlage lokal dieselbe `DATABASE_URL` wie Next.js sehen. Er prüft keine
Verbindung und gibt weder Connection String noch Host aus.

## Vercel-Projektverknüpfung

`.vercel/repo.json` wird nicht automatisch geändert. Nach vollständiger
Inventur und ausdrücklicher Freigabe kann die lokale CLI-Verknüpfung manuell
neu aufgebaut werden:

```powershell
vercel link --project pubquiz-web
```

Vor Bestätigung des Zielprojekts dürfen keine Environment-Variablen gepullt,
Deployments ausgelöst oder Verknüpfungen des alten Projekts entfernt werden.

## Manuelle Abnahme

- Vercel `pubquiz-web`: Production Branch, Preview-Regeln und Domains prüfen.
- Je Target nur Vorhandensein und Scope der Variablennamen prüfen, nie Werte in
  Tickets oder Logs kopieren.
- `DATABASE_URL` je Target dem vorgesehenen Neon-Branch zuordnen.
- Development/Preview mit `pubquiz-media-nonprod`, Production mit
  `pubquiz-media-public` verbinden.
- Local, Preview und Production separat mit Login, Datenbank-Lesezugriff und
  den drei aktiven Uploadpfaden testen.
- `pubquiz-web-qvps` bis zur späteren, separat genehmigten Stilllegung nicht
  verändern.
