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

### Logo im Anlage- und Bearbeitungsformular

Das gemeinsame Formular für neue und bestehende Eventreihen zeigt ebenfalls ein
optionales Logo mit lokaler Vorschau, Ersetzen und Entfernen. Dort sind Änderungen
bis zum Speichern vorgemerkt; Abbrechen verwirft sie. Erst nach erfolgreicher
Stammdatenspeicherung wird ein ausgewähltes Bild über den gemeinsamen signierten
Upload hochgeladen und an die feste Reihen-ID gebunden. Ein Uploadfehler lässt die
bereits gespeicherte Reihe bestehen, hält deren ID im Bearbeitungsformular und
meldet ausdrücklich den Teilerfolg: erneutes Speichern aktualisiert dieselbe Reihe.
Während des Speicherns sind Formular und Reihenwechsel gesperrt. Die zusätzliche
Logo-Funktion auf der Detailseite bleibt direkt speichernd erhalten.
Regression: `eventSeriesLogo.test.ts` prüft Formularintegration, ID-Erhalt bei
Teilfehlern, Entwurfszustand, Dateiprüfung und gemeinsamen Uploadpfad.

## Öffentliche Terminwerte und Vererbung (24.10.2026)

`resolvePublicEventContent` ist die gemeinsame Fachfunktion für Editorvorschau und
API. Version 1 erhält **additiv pro `events[]`**:

| Feld | Vertrag |
| --- | --- |
| `imageUrl` | Eigenes `quiz.veranstaltungsbild_url`, sonst aktuelles `eventreihen.logo_url`, sonst null. |
| `reservationUrl` | Eigene `quiz.reservierungs_url`, sonst aktuelle `eventreihen.reservierungs_url`, sonst null. Ausschließlich HTTP(S) ohne Zugangsdaten. |
| `description` | Wirksamer öffentlicher Text, sonst null; siehe Modi unten. |
| `imageSource`, `reservationSource` | `QUIZ` bei wirksamer eigener Überschreibung, sonst `SERIES`. Der effektive Wert kann bei fehlendem Reihenstandard null sein. |

Bestehende Felder, IDs, `version`, Reihenfilter, Freigabe, Zeitzone, Kalenderpfade und
ICS-UIDs bleiben erhalten. `eventUrl` und `mapUrl` behalten ihre bisherige Bedeutung;
sie werden niemals zu Reservierungslinks umgedeutet. Interne Bemerkungen bleiben
aus der expliziten öffentlichen Datenbankauswahl ausgeschlossen.

Neue nullable Spalten: `eventreihen.reservierungs_url` sowie
`quiz.reservierungs_url`, `quiz.veranstaltungsbild_url`,
`quiz.oeffentliche_beschreibung`. `quiz.oeffentliche_beschreibung_modus` ist
`APPEND` (Standard/„Ergänzen“) oder `REPLACE` („Ersetzen“), mit Datenbank-Constraint.
Öffentliche Quizbeschreibung und Reihenbeschreibung sind auf je 2000 Zeichen
begrenzt. Leerer/Whitespace-Quiztext verwendet in beiden Modi den Reihenstandard.
APPEND verbindet nicht leere Texte mit exakt zwei Zeilenumbrüchen; REPLACE liefert
nur den nicht leeren Quiztext. Es gibt keine redaktionelle Umformulierung.

Es werden nur Überschreibungen gespeichert, keine Kopien der Reihenstandards.
Entfernen/Leeren stellt die Vererbung wieder her. Änderungen an der Reihe erreichen
erbende Termine mit dem nächsten Abruf. Die API liest weiterhin frisch und erzeugt
den ETag aus der gesamten öffentlichen Antwort; kein zusätzlicher Cache und keine
pauschale Cache-Deaktivierung. Website: bestehender sichtbarkeitsabhängiger
Minutenabruf und Abruf nach Rückkehr zum Tab.

Quizbilder werden in den Quiz-Einstellungen separat mit
„Veranstaltungsbild speichern“ gespeichert. Beim neuen Quiz zuerst anlegen, dann
Einstellungen öffnen. Die bestehende `EventSeriesLogoField`-Eingabe wird für Auswahl
und Vorschau wiederverwendet. Neues Uploadziel `QUIZ_EVENT_IMAGE` im bestehenden
signierten Uploadendpunkt: `MANAGE_QUIZZES`/Quiz-Editorberechtigung, Archivschutz,
Umgebungs-/Quizpfadbindung, PNG/JPEG/WebP, 5 MiB, echte Bildbytes/40-Megapixel-Limit
wie beim Reihenlogo. Originalpixel, Transparenz und Proportionen bleiben erhalten.
Vergleich mit gespeicherter URL schützt konkurrierende Bildänderungen. Entfernen
löst ausschließlich die Referenz; keine automatische Blob-Löschung.

Migration `20261024120000_public_event_content` ist rein additiv, ohne UPDATE,
Datenumdeutung oder Überschreiben vorhandener individueller Konfiguration. Neue
Quizkopien und Schnellquizze erben zunächst die Reihenstandards; terminspezifische
neue Überschreibungen werden nicht stillschweigend auf andere Termine kopiert.

### Reihen-Speicherfehler

Im Browser nachgewiesen: Reacts `<form action={...}>` führte nach erfolgreicher
Action einen nativen Reset aus. Checkbox und Select zeigten danach DOM-Defaults,
obwohl der React-State noch den gespeicherten Stand enthielt. Der zweite Submit
persistierte dadurch `false` und `ungegoogelt-default`. Der explizite `onSubmit`
verhindert den automatischen Reset und erzeugt `FormData` vor dem Sperren des
Formulars. Die vorhandene Checkbox-Semantik bleibt unverändert. Erfolg wird erst
nach vollständigem Speichern als „Änderungen gespeichert“ gemeldet; Uploadteilerfolg
und Fehler behalten ihre eigenen Meldungen. Änderungen löschen alte Erfolgsmeldungen.

Regression: `eventSeriesForm.browser.test.ts` rendert die echte Komponente mit
React/Chrome, speichert zweimal, lädt den bestätigten Stand neu und prüft bewusste
Deaktivierung, Templatewechsel und abgelehnte Speicherung. Die Serveradapter sind
dabei isolierte Fakes; die echte Datenbank/Uploads wurden zusätzlich bedient.

### Website und Veröffentlichungsreihenfolge

Bestehendes Sites-Projekt: `appgprj_6ad5d03a33248191995cffd177d41cc9`,
`philgud.events`, keine neue Website und keine neue Terminpflege in Sanity.
Die Website verwendet ausschließlich die effektiven Terminwerte. Ohne Link kein
Reservierungsbutton, ohne Text kein Beschreibungsblock. Bilder verwenden `contain`.
Datum/Uhrzeit/Ort/„Tisch reservieren“ stehen rechts auf Desktop, mobil untereinander.
Der sichtbare Zeitzonenhinweis entfällt; Berlin-Zeitverarbeitung bleibt bestehen.
„Kalenderdatei herunterladen“ steht klein direkt unter „Termine abonnieren“.

Die API liefert weiterhin alle benötigten Termine. Erst Reihenfilter anwenden,
dann zunächst vier zeigen; „Weitere Termine anzeigen“ ergänzt bis zu vier. Bei
Filterwechsel zurück auf vier. Kein Button bei höchstens vier/allen sichtbaren
Terminen. Abo und Download verwenden weiterhin alle Termine der ausgewählten
Reihen, unabhängig von der Anzeigegrenze.

Nach gesonderter Releasefreigabe: (1) additive Migration in freigegebener Umgebung,
(2) Backend/API bereitstellen und prüfen, (3) Websiteversion mit produktiven
Standardwerten veröffentlichen. Die bestätigte LOVD-Reservierungsadresse wird
zentral in der betreffenden Reihe gepflegt: `https://lovd.stelp.eu/reservieren/`.
Keine Datumsvorauswahl, keine zusätzlichen URL-Parameter, kein fest im Websitecode
eingetragener Reservierungslink. Dieser Auftrag ändert keine echten Reihendaten.

Sites-Veröffentlichungen sind Production; deshalb wird nur eine unveröffentlichte
Version vorbereitet. Für lokale/isolierte Abnahme kann der Website-Build
`NEXT_PUBLIC_EVENT_API_ORIGIN` und `NEXT_PUBLIC_EVENT_SERIES_IDS` verwenden.
Ohne Overrides bleiben `https://quiz.philgud.events` und Reihen 2,3 erhalten.
Testkonfiguration wird nicht eingecheckt oder in das Releasepaket übernommen.
