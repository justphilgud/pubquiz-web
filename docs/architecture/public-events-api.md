# Öffentliche Eventreihen und Termine

## Verantwortung und Freigabe

Die Pubquiz-Software ist die einzige Quelle für Reihen, Logos und Termine. Externe
Webseiten wählen Reihen anhand ihrer numerischen `id`; sie pflegen keine Kopien der
Veranstaltungsdaten. `slug` wird zusätzlich geliefert und bleibt bei Umbenennungen
unverändert. Interne Reihennamen sind kein Fallback für öffentliche Anzeigenamen.

`publicEventsRepository.ts` liest ausschließlich freigegebene, nicht archivierte
Reihen und nicht archivierte, datierte Quizzes mit einer expliziten Feldliste.
`publicEvents.ts` projiziert die öffentliche Antwort und prüft Sichtbarkeit erneut.
Interne Bemerkungen, Mitglieder, Fragen, Antworten und interne Reihennamen werden
nicht ausgegeben. Es gibt derzeit keine separate öffentliche Freigabe pro Quiz:
Alle aktiven, datierten Quizzes einer öffentlichen Reihe sind öffentlich.

## JSON-Vertrag, Version 1

Anonymer GET (auch HEAD und OPTIONS):

```text
https://quiz.philgud.events/api/public/events
https://quiz.philgud.events/api/public/events?series=1,2
https://quiz.philgud.events/api/public/events?series=1&series=2&upcoming=false
```

Ohne Reihenfilter: alle öffentlichen Reihen. `series`: bis zu 50 positive numerische
IDs, kommasepariert oder wiederholt; Duplikate werden zusammengeführt. Unbekannte,
private und archivierte IDs liefern keine Einträge. Ungültige Filter: HTTP 400.
`upcoming` ist standardmäßig `true`; `false` schließt vergangene Termine ein.
Reihen ohne zukünftige Termine bleiben in `series` auswählbar.

Beispiel (IDs und Daten sind illustrative Testdaten):

```json
{
  "version": 1,
  "timeZone": "Europe/Berlin",
  "series": [{
    "id": 1,
    "slug": "quizabend",
    "name": "Unser Quizabend",
    "description": "Gemeinsam rätseln",
    "logoUrl": "https://store.public.blob.vercel-storage.com/prod/event-series/1/logo/logo.png",
    "calendarPath": "/calendar/event-series/1.ics"
  }],
  "events": [{
    "id": 11,
    "seriesId": 1,
    "title": "Oktoberquiz",
    "date": "2026-10-24",
    "time": "19:00",
    "timeZone": "Europe/Berlin",
    "startsAt": "2026-10-24T19:00:00+02:00",
    "endsAt": null,
    "allDay": false,
    "location": "Café Paule",
    "mapUrl": "https://maps.example/venue",
    "eventUrl": "https://example.org/quiz"
  }]
}
```

`logoUrl`, Beschreibung, Ort und Links dürfen null sein. Links sind ausschließlich
HTTP(S) ohne Zugangsdaten. Fehlender öffentlicher Reihenname wird als „Quizkalender“
ausgegeben, fehlender Quiztitel als „Quiz <ID>“. Fehlende/ungültige Uhrzeit:
`time: null`, `startsAt: null`, `allDay: true`; `date` bleibt verbindlich.
Zeitpunkte enthalten einen expliziten Berliner UTC-Offset. Während der herbstlichen
Zeitumstellung wird bei doppelt vorkommender Uhrzeit die erste Instanz gewählt.
Eine nicht existierende lokale Uhrzeit in der Frühlingsumstellung wird nicht als
falscher Zeitpunkt veröffentlicht; der betroffene Termin fehlt in JSON und muss
in den Stammdaten korrigiert werden. Das bestehende ICS-Verhalten bleibt erhalten.

Sortierung: Datum, lokale Uhrzeit (ganztägige zuerst), ID. Da keine Endzeit gepflegt
wird, bleibt ein Termin bis zum Ende seines Veranstaltungstags in Europe/Berlin
anstehend (auch an 23-/25-Stunden-Tagen). Es wird keine Endzeit erfunden.

CORS erlaubt öffentliche Browserabrufe von jeder Origin ohne Cookies/Credentials:

```js
const response = await fetch(
  'https://quiz.philgud.events/api/public/events?series=1,2',
  { credentials: 'omit' }
);
if (!response.ok) throw new Error('Termine konnten nicht geladen werden');
const { series, events } = await response.json();
```

Cache-Control: `public, max-age=0, must-revalidate`, ETag und bedingtes GET/304.
Die Datenbank-Freigabe wird vor jedem 304 erneut geprüft; kein langlebiger CDN-Cache
für zurückgezogene Reihen. Konsumenten dürfen Inhalte nicht ungeprüft dauerhaft
weiterveröffentlichen. Texte als Text rendern, nicht als vertrauenswürdiges HTML.

## Bestehende Kalender-Abos

Bestehende URLs und `UID:quiz-<ID>@pubquiz` bleiben unverändert:

```text
/calendar/public.ics
/calendar/event-series/1.ics
/calendar/public.ics?series=1,2
```

ICS liefert weiterhin ausschließlich anstehende Termine. `upcoming=false` ändert
diesen bestehenden Abovertrag nicht. Einzelreihen bleiben bei privater/archivierter
Reihe HTTP 404. Pro VEVENT ergänzen wir optional `X-PHILGUD-SERIES-ID` und
`X-PHILGUD-SERIES-NAME` mit bestehenden Escape-/Faltungsregeln. Standardclients
können diese Erweiterungen ignorieren. Logos sind kein ICS-Darstellungsvertrag.

## Titel und Ort ohne Datenumdeutung

- `quiz.titel` → JSON `title`, ICS `SUMMARY`.
- `quiz.veranstaltungsname` → JSON `location`, ICS `LOCATION`; UI jetzt
  **Veranstaltungsort**. Der bestehende technische Spaltenname bleibt erhalten.
- `quiz.karten_url` → JSON `mapUrl`: Orts-/Google-Maps-Link, kein Ticketlink.
- `quiz.oeffentliche_url` → JSON `eventUrl`, bisherige ICS-Verwendung bleibt.
- `eventreihen.oeffentlicher_name` → öffentlicher Reihenname.

Keine automatische Änderung oder Verschiebung vorhandener Werte. Falls dort in
Einzelfällen tatsächlich Titel gespeichert wurden, können Redakteure sie bewusst
in den Quizstammdaten korrigieren.

## Logo-Persistenz und Betrieb

Optionales `eventreihen.logo_url`, additive Migration
`20261024090000_event_series_logo`; bestehende Reihen erhalten null. Vor Betrieb
wie üblich `npm run db:deploy` in der freigegebenen Zielumgebung und
`npm run db:generate` ausführen. Dieser PR führt keine Produktionsmigration aus.

Upload/Vorschau/Ersetzen/Entfernen auf der Reihendetailseite. Bestehender signierter
Vercel-Blob-Upload über `/api/question-media-upload`, neues Target
`EVENT_SERIES_LOGO`. Bestehende Blob-Umgebungskonfiguration genügt, keine neue
Abhängigkeit und keine neue Umgebungsvariable. PNG/JPEG/WebP, maximal 5 MiB;
Dateiname/MIME/Größe client- und serverseitig, tatsächliches Bildformat/Dimensionen
serverseitig mit sharp geprüft (maximal 40 Millionen Pixel). Originaldatei bleibt
unverändert, dadurch bleiben Seitenverhältnis und Alpha erhalten.

Berechtigung und Archivzustand werden beim Token und beim Speichern geprüft.
Speichern bindet URL/Pfad an Umgebung und Reihe; Vergleich mit bisheriger URL
verhindert versehentliches Überschreiben paralleler Bearbeitungen. Entfernen setzt
nur die Referenz auf null. Alte oder abgebrochene Uploads werden nicht automatisch
gelöscht (bestehende Medien können Referenzen haben). Wie bei bisherigen Medien
sind Blob-URLs öffentlich: Ein privates Reihenlogo ist kein vertraulicher Upload.
Die API veröffentlicht seine URL erst nach Reihenfreigabe.

## Regressionen

`publicEvents.test.ts`: zwei öffentliche Reihen, Logo/null, private und archivierte
Reihe, vergangene/undatierte/archivierte Termine, Mehrfachfilter, Feld-Allowlist,
Berlin-Mitternacht und Sommer-/Winterzeit, CORS/ETag/Rücknahme, ICS-UID/Metadaten.
`eventSeriesLogo.test.ts`: Pfad-/Umgebungsbindung, Typ-/Größenlimits, tatsächliches
Bildformat, Transparenz/Seitenverhältnis, additive Persistenz/Berechtigungsvertrag.
Zusätzlich bestehende `eventCalendar.test.ts`, `quizMasterData.test.ts` und
`blobPath.test.ts`. Alle Fixtures sind lokal; keine Produktions-Testveranstaltungen.
