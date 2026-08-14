# Medien-Uploads nach Umgebung

Stand: 17. Juli 2026

## Verbindliches Modell

Alle aktiven Upload-Routen verwenden dieselbe serverseitige Auflösung für
Umgebung, Blob-Credential und Pfade. Das Credential ist in jeder Umgebung ein
explizit gesetzter `BLOB_READ_WRITE_TOKEN` des jeweils zugeordneten Stores.
`VERCEL_OIDC_TOKEN` und `BLOB_STORE_ID` werden von der Anwendung nicht als
Blob-Credentials verwendet; insbesondere gibt es lokal keinen OIDC-Fallback.

| Umgebung | Blob-Store | Präfix für neue Dateien |
| --- | --- | --- |
| Development | `pubquiz-media-nonprod` | `dev/` |
| Preview | `pubquiz-media-nonprod` | `preview/` |
| Production | `pubquiz-media-public` | `prod/` |

Die fachliche Kategorie folgt direkt auf das Environment-Präfix:

- Fragenmedium: `dev/question-media/image/...`
- Antwortbild: `preview/answer-media/image/...`
- Präsentationstemplate-Asset: `dev/template-media/<template-id>/<assetrolle>/...`
- Intro-/Outro-Medium: `prod/media/audio/intro/...`

Bereits vorhandene Blobs und gespeicherte URLs werden weder verschoben noch
umbenannt. Die neue Regel gilt ausschließlich für neu erzeugte Pfade.

## Serverseitige Auflösung

Die logische Umgebung ist genau `development`, `preview` oder `production`.
Die Priorität lautet:

1. `MEDIA_UPLOAD_ENV` als expliziter serverseitiger Override für kontrollierte
   lokale Tests,
2. `VERCEL_ENV` auf Vercel,
3. `NODE_ENV` als Fallback (`production` → Production, sonst Development).

`NEXT_PUBLIC_APP_ENV` ist nur ein sichtbares Label und niemals Eingabe für
Credential-, Datenbank- oder Pfadentscheidungen.

Der Browser erhält nur das nicht geheime Präfix `dev`, `preview` oder `prod`.
Die gemeinsame `MediaUploadSlot`-Komponente baut daraus einen Pfad; die Route
berechnet die erlaubte Umgebung unabhängig erneut und prüft den vollständigen
Pfad. Tokens, Cookies, signierte URLs und andere Secrets werden weder als Props
übergeben noch in Diagnose-Logs ausgegeben.

## Aktive Upload-Routen

| Route | Verwendung | Status |
| --- | --- | --- |
| `/api/question-media-upload` | gemeinsamer signierter Upload für `QuestionMediaSlot`, `AnswerMediaSlot`, Quiz-Intro/Outro und freigegebene Template-Assets | aktiv; Template-Assets zusätzlich opt-in |
| `/api/upload-medium` | altes Fragenformular | aktiv, Legacy-API |

Intro- und Outro-Medien verwenden denselben authentifizierten Presigned-Upload
wie Fragen- und Template-Medien. Der Uploadkontext bindet den Pfad an das Quiz,
den Medienslot und die aktuelle Umgebung. Alle Routen beziehen ihren
`BLOB_READ_WRITE_TOKEN` ausdrücklich aus derselben zentralen Serverfunktion;
das Blob-SDK darf kein Credential implizit auswählen.

Template-Assets verwenden dieselbe Route, Credential-Auflösung und
Environment-Präfixlogik. Weil sich die konkrete Store-Zuordnung nicht allein
aus einem Tokenstatus ableiten lässt, bleibt dieser Teil ohne die zusätzliche
serverseitige Bestätigung `TEMPLATE_MEDIA_UPLOAD_ENABLED=true` deaktiviert.
Repository-relative Assets und sämtliche Designvorschauen funktionieren davon
unabhängig. Die Route akzeptiert Template-Bilder ausschließlich für
administrativ autorisierte, persistierte Entwürfe; aktive, archivierte und
Systemtemplates bleiben unveränderlich.

## Optionale Validierung

Die Basisvalidierung prüft `DATABASE_URL`, `AUTH_SECRET` (oder den erlaubten
Alias `NEXTAUTH_SECRET`), die logische Umgebung und das daraus folgende Präfix.
Uploadfunktionen prüfen bei ihrem Aufruf zusätzlich `BLOB_READ_WRITE_TOKEN`.
Der Presigned-Upload prüft außerdem `BLOB_WEBHOOK_PUBLIC_KEY`.

Diagnosen melden ausschließlich Status, Phase, Fehlerklasse, bereinigte
Fehlermeldung, internen Code, erwartete Authentifizierungsart und das
Vorhandensein der Variablen. Werte, Hosts und Secrets bleiben verborgen.

## Smoke-Test je Umgebung

1. `npm run env:check` beziehungsweise die gleichwertige Vercel-Prüfung ohne
   Ausgabe von Werten durchführen.
2. Je ein kleines Fragenbild und Antwortbild hochladen, speichern und neu laden.
3. Intro-Audio oder Intro-Video über die Legacy-Oberfläche hochladen.
4. Prüfen, dass der neue Blobpfad mit `dev/`, `preview/` beziehungsweise
   `prod/` beginnt.
5. Function-Logs auf Fehlerphasen prüfen; keine Secretwerte kopieren.
