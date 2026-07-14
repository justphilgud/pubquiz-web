# Medien-Uploads in Entwicklungs-, Preview- und Produktionsumgebungen

## Zielbild

Der Question Editor verwendet für Fragenmedien und Antwortbilder denselben
Browser-zu-Blob-Ablauf:

1. Der Browser validiert Dateiendung, MIME-Typ und Größe.
2. Der Browser fordert relativ über `/api/question-media-upload` eine
   Upload-Autorisierung an. Dadurch gelten dieselbe Origin und die bestehende
   Auth.js-Sitzung.
3. Die Route prüft Benutzer, Frage- beziehungsweise Antwortzuordnung und den
   serverseitig bestimmten Dateipfad.
4. Die Route stellt mit explizit aufgelösten Blob-Zugangsdaten einen kurzlebigen
   signierten Token aus.
5. Der Browser überträgt die Datei direkt zu Vercel Blob und übernimmt die URL
   in den Entwurf.
6. Beim Speichern verifiziert der Server URL, Pfad, MIME-Typ und Größe mit
   denselben Blob-Zugangsdaten, bevor er die Zuordnung in der Datenbank speichert.

Die Umgebung kommt nie aus `clientPayload`. Der Server leitet sie auf Vercel
aus `VERCEL_ENV` und außerhalb Vercels optional aus `MEDIA_UPLOAD_ENV` ab.

## Umgebungen und Pfade

| Laufzeit | Auflösung | Präfix für neue Dateien |
| --- | --- | --- |
| lokales `next dev` | Standard `dev` | `question-media/dev/` |
| Vercel Development | `VERCEL_ENV=development` | `question-media/dev/` |
| Vercel Preview | `VERCEL_ENV=preview` | `question-media/preview/` |
| Vercel Production | `VERCEL_ENV=production` | `question-media/prod/` |
| andere Serverlaufzeit | `MEDIA_UPLOAD_ENV=dev\|preview\|prod`, sonst anhand `NODE_ENV` | entsprechendes Präfix |

Darunter folgen Ziel und Typ, zum Beispiel
`question-media/preview/question/image/...` oder
`question-media/prod/answer/image/...`.

Bereits gespeicherte URLs und alte Präfixe bleiben lesbar. Die strengere
Pfadprüfung gilt nur für neu hochgeladene Dateien.

## Benötigte Server-Konfiguration

Die zentrale Prüfung in `mediaUploadEnvironment.ts` erwartet:

- `AUTH_SECRET`
- eine gültige PostgreSQL-`DATABASE_URL`
- optional eine gültige `AUTH_URL` oder `NEXTAUTH_URL`, falls gesetzt
- `BLOB_WEBHOOK_PUBLIC_KEY`
- entweder `BLOB_READ_WRITE_TOKEN`
- oder ein noch gültiges Paar aus `VERCEL_OIDC_TOKEN` und `BLOB_STORE_ID`

`BLOB_READ_WRITE_TOKEN` wird, wenn vorhanden, explizit bevorzugt. Damit kann ein
zusätzlich vorhandener, aber abgelaufener lokaler OIDC-Token die lokale
Entwicklung nicht überschreiben. Zugangsdaten dürfen weder mit
`NEXT_PUBLIC_` beginnen noch geloggt oder an den Browser übergeben werden.

### Lokale Entwicklung

Für einen stabilen lokalen Betrieb wird `BLOB_READ_WRITE_TOKEN` in der nicht
eingecheckten `.env.local` empfohlen. Alternativ kann eine aktuelle, vom
Vercel-CLI bezogene OIDC-Konfiguration verwendet werden; ein lokal kopierter
OIDC-Token ist kurzlebig und muss nach Ablauf erneuert werden.

Die vorhandene lokale Fehlersituation entstand vor der Dateiübertragung: Es
gab keinen Read/Write-Token, während `VERCEL_OIDC_TOKEN` bereits abgelaufen war.
Die Blob-API verweigerte deshalb die Ausstellung des signierten Tokens mit
`Access denied`.

### Vercel Preview und Production

Auf Vercel ist OIDC die bevorzugte Konfiguration, weil Vercel den kurzlebigen
Token für Functions automatisch bereitstellt und rotiert. Blob-Store und
Projekt müssen korrekt verbunden sein; `BLOB_STORE_ID` und der Webhook Public
Key müssen in Preview beziehungsweise Production verfügbar sein. Ein
Read/Write-Token bleibt als explizite kompatible Alternative unterstützt.

Referenzen:

- [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk)
- [OIDC-Unterstützung für Vercel Blob](https://vercel.com/changelog/vercel-blob-now-supports-oidc-authentication)
- [Blob-Speicher verwalten](https://vercel.com/docs/vercel-blob/manage-blob-storage)

## Diagnose

Serverlogs nennen eine sichere Phase, aber keine Tokens:

- `authentication`: Auth.js-Sitzung konnte nicht gelesen werden
- `user-authorization`: Benutzerstatus oder Datenbankzugriff
- `configuration`: fehlende oder abgelaufene Server-Konfiguration
- `request-processing`: ungültige Anfrage oder Webhook-Verarbeitung
- `context-authorization`: Frage, Antwortzuordnung oder Pfad nicht erlaubt
- `signed-token`: Blob verweigert die Token-Ausstellung
- `blob-verification`: Blob-Metadaten konnten beim Speichern nicht geprüft werden

Die Browseroberfläche unterscheidet mindestens Autorisierung von der
eigentlichen Dateiübertragung. Die genaue Serverphase steht im Function-Log.

## Deployment-Checkliste

1. Blob-Store mit dem richtigen Vercel-Projekt und allen benötigten Targets verbinden.
2. Servervariablen pro Preview und Production prüfen; keine Blob-Geheimnisse als `NEXT_PUBLIC_*` setzen.
3. Sicherstellen, dass `VERCEL_ENV` nicht manuell aus dem Browser überschrieben wird.
4. Je Umgebung ein kleines Bild hochladen, speichern, neu laden, ersetzen und entfernen.
5. Function-Logs auf die Phasen `signed-token` und `blob-verification` prüfen.
