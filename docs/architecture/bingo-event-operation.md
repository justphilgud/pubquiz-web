# Bingo V3.1 – Umsetzung und Abnahmevertrag

Arbeitsbranch `codex/bingo-event-operation`, Basis Main `8fa60b68`.
Die menschliche Freigabe gilt exakt diesem Branch für die isolierte Preview.
Kein Merge/Production. Die generische Preview-Migrationsroute ist für diesen
Branch explizit gesperrt; nur der geprüfte administrative Git-Preview-Weg mit
eigener synthetischer Datenbank und eigenem Medienpräfix ist vorgesehen.

## Verantwortlichkeiten

AP1 bleibt Regel-/Zeitquelle, AP2 Besitzer der unveränderlichen Karten und
Druckversionen. AP3-Alt-Durchläufe behalten ihren bisherigen Replayvertrag.
Neue Eventdurchläufe erhalten einen expliziten V2-Vertrag; initiale Altsnapshots
werden nicht umgeschrieben. Ereignisse bleiben unveränderlich und rundenbezogen.
Gemeinsame Eventzeilen sind reine Darstellung; Objektreader und Policies bleiben
serverseitige Autorität. Listen und Öffnen erzeugen keine Laufzustände.

Reiheneinstellungen: Metadaten und autorisierte Produktänderungen in einer
Transaktion mit CAS. Binärdateien vor Referenzspeicherung bereitstellen; keine
Behauptung einer atomaren externen Blob-/Datenbanktransaktion. Laufendes oder
pausiertes Bingo sperrt Produktdeaktivierung unter demselben Reihengate wie Start.

## Rufkontext und Wiederholung

Neue bewusste Rufe behalten eigene Request-/Ruf-IDs auch an identischer Grenze.
Technischer Retry wiederholt dieselbe ID und denselben Inhalt. Ein serverseitig
ausgegebenes Kontextmerkmal bindet Runde, Laufstatus, Ziehungen und Korrekturen;
zusätzliche Rufe verschieben die Grenze nicht. Veralteter fachlicher Kontext
führt zu sichtbarem Konflikt, niemals zu einer neuen Grenze/Client-Rufzeit.

## Liefergrenze

Implementierte Module und bisherige Nachweise stehen unten. Kein lokaler oder statischer Nachweis ersetzt die verlangte
gehostete Abnahme, echten PostgreSQL-Nebenläufigkeitstest oder Snapshot/Restore.
Der jeweils aktuelle gehostete Prüfstand und die Reviewbereitschaft werden in [PR #147](https://github.com/justphilgud/pubquiz-web/pull/147) geführt; bis zur vollständigen Abnahme bleibt er Draft. Fachliche Grundlage:
[event-operation-standard.md](event-operation-standard.md).

## Persistenz und vorbereitete Runden

`bingo_event_runs.version=2` entscheidet explizit über den neuen Replaypfad.
`bingo_event_round_plan` bindet die geplante Reihenfolge, `bingo_event_rounds`
und `bingo_event_round_cards` frieren die tatsächlich gestartete Runde ein.
Journalereignisse tragen eine passende Rundenzuordnung; initiale AP3-Daten
bleiben unverändert und über die bestehende Run-ID lesbar. Ein neuer Durchlauf
ist eine ausdrückliche Aktion, kein Reset. Nach Eventabschluss kann die spätere
Vorbereitung geändert werden; die früher eingefrorenen Daten bleiben erhalten.

Die Anlage akzeptiert bis zu 10.000 vorbereitete Runden pro Transaktion als
technisches Ressourcenbudget. Dies ist keine fachliche Gesamtbegrenzung;
Zusatzrunden werden einzeln bewusst angelegt. Karten entstehen ausschließlich
bei ausdrücklicher Erzeugung oder Zuordnung. Variante bleibt Zahlen-Bingo 75.

## Gemeinsame Reiheneinstellungen

Bestehende Reihen speichern autorisierte Stammdaten, Produktwahl und geänderte
Logo-Referenz gemeinsam mit einer Revision über Zeitstempel, Logo und Produkte.
Binärdaten werden davor hochgeladen. Ein fehlgeschlagener CAS/Validierungsschritt
ändert keine Datenbankfelder; ein bereits hochgeladener eigener Blob kann dabei
unreferenziert bleiben. Es erfolgt keine fremde Medienbereinigung.

Bei einer **neuen** Reihe erfordert der bestehende Logo-Upload eine bereits
persistierte, autorisierte Reihen-ID. Diese bestehende zweistufige Anlage bleibt
erhalten: Nach Anlage darf ein Logo-Fehler die ID niemals verlieren oder ein
zweites Eventreihenobjekt erzeugen. Die Oberfläche benennt diesen Teilstand
explizit. Erneutes Speichern verwendet dieselbe ID und die gemeinsame CAS-Aktion.
Die Produkt-/Metadatenanlage selbst erfolgt zusammen. Das ist keine behauptete
atomare Blob-/Datenbanktransaktion.

## Tatsächliche bisherige Nachweise

- Eigene lokale PostgreSQL-Instanz: AP2/AP3-Bestandsablauf und V2-Mehr-Runden-
  Ablauf einschließlich neuer Vorbereitung nach einem abgeschlossenen Run.
- Reale konkurrierende Anlage/Retries, unabhängige Rufe, stale Kontextabweisung,
  historische Korrektur, Nachprüfung, drei Runden und Zusatzrunde, CAS und Rennen
  zwischen Start und Produktdeaktivierung. Pausiertes Bingo blockiert ebenfalls.
- Vollständige `collectSnapshot`-Integrität und tatsächlicher isolierter Dump/
  Restore vor und nach der Erweiterung; keine Production-Operation.
- Echter lokaler Chromium-Ablauf: Eventanlage über Formular, drei Runden,
  explizite Kartenanlage/-wiederverwendung, getrennte Admin-/Manager-/Präsentations-
  Fenster, unabhängige Rufe mit erhaltenem Entwurf, Entscheidungen, Korrektur,
  Nachprüfung, Pause/Fortsetzen, Offline/Reconnect, Reload, Zusatzrunde, Abschluss
  und Editor-Abweisung. Screenshots bei 1280×720, 1366×768, 390×844 sowie
  Präsentation bei 1280×600 und 1920×1080. Dies ersetzt keine gehostete Abnahme.

Die synthetischen Datenbanken nutzen die offen dokumentierte historische
Modellbasis plus exakt geprüfte additive SQL-Migrationen und ausführbare
Referenzdefinitionen. Dies ist keine vollständige Reparatur oder Replay-Abnahme
aller historischen Bootstrap-Migrationen. Keine historischen Checksummen werden
auf Production geändert. Der gehostete Prüfbericht wird vor Reviewbereitschaft
mit tatsächlichem Commit, Alias und Ergebnissen ergänzt.

## Konkrete Verantwortung und Grenzen

- `app/events/EventRow.tsx`, `readEvents.server.ts` und `statusReader.server.ts`:
  gemeinsame Zeile/formatübergreifende Reader; keine Start- oder Statusanlage.
- `app/eventreihen/settingsRepository.server.ts`, `settingsRevision.ts` und
  `productSafety.server.ts`: gemeinsame atomare Änderung, CAS und Start-/Produktgate.
- `app/bingo/eventCreation.server.ts`: atomare/idempotente Event-/Rundenanlage;
  `GameDraftForm` behält nach unklarem Ergebnis dieselbe Anfrage bis zur Klärung.
- `PreparationPanel`/`RoundEditor`: kompakte Darstellung, ausdrückliche Kartenwahl,
  eigener Entwurf und Revision beim Bearbeitungsbeginn; kein Polling-Draftverlust.
- `EventModerationPanel`/CSS-Modul: V3.1-Oberfläche ausschließlich für V2-Runs;
  `eventRepository.server.ts`/`eventRun.ts` verantworten Transaktion und Replay.
- `scripts/testing/bingo-event.browser.mjs` und `event-settings.browser.mjs`:
  wiederholbare Browserabnahme mit neu angelegten synthetischen Fällen.

Ein Rundenschluss/Start/Ende verwirft nach ausdrücklicher Bestätigung nur lokale
unveröffentlichte Rundeneingaben; niemals Rufe oder gespeicherte Daten. Ein
noch nicht zugeordneter Ruf bleibt blockierend, bis eine zugeordnete Karte
geprüft und entschieden ist. Es gibt keine stille Ruflöschung.

Die bestehende Archivregel bleibt unverändert: archivierte Reihen sind
schreibgeschützt. Diese Umsetzung erweitert die gesondert beauftragte
Produktdeaktivierungssperre; sie führt keine neue allgemeine Archivpolitik ein.
Bingo-/Quiz-Fragesteuerung, gemeinsame Publikum-/Drucktemplates, weitere Varianten,
OCR/Pi/Offline und Team-Selbstanmeldung sind kein zusätzlicher Umfang.

## Korrektur nach direktem V3.1-Vergleich (30.10.2026)

Die frühere Preview war funktional geprüft, erfüllte aber die bestätigte visuelle Komposition nicht. Die fachliche Abnahme der Darstellung ist weiterhin offen; Offline/Reconnect wird erst danach wieder aufgenommen.

Nachgewiesene Abweichungen und gezielte Korrektur:
- Die Moderationsroute war entgegen der vorgesehenen Livegrenze in `isAdministrationPath` aufgenommen. Dadurch überschrieben globale Verwaltungstitel die funktionale V3.1-Typografie. Route wieder ausgeschlossen; ausdrücklicher Regressionstest.
- Zentrale Arbeitsfläche, Kopf, Ruftastenleiste und rechte Runden-/Statusspalte waren voneinander abweichend angeordnet. `EventModerationPanel` ordnet ausschließlich die bestehenden Aktionen/Reader neu. Zahl/Board bilden eine Fläche; nichtmodale unabhängige Kartenprüfungen bleiben darunter erhalten. Die mobile Ruftastenleiste ist fixiert und hat reservierten Inhaltsabstand.
- Das öffentliche Board dehnte Zellen zu hohen Streifen. Die bestehende beidimensionale Messung setzt zusätzlich eine gemeinsame quadratische Zellkante. Stabile Positionen, vollständige Zahlen, Originalschriften, Laden/Resize/Vollbild und alte Pollantwortsperren bleiben geprüft.
- Gelb/Pink als Flächen mit dunkler Beschriftung nur im ausdrücklich ausgewählten Phil-Gud-Publikumstemplate. LOVD und andere Templates behalten ihre gespeicherten Farbwerte; keine Zuweisung, kein Standard, kein eingefrorenes Asset geändert.

Die V3.1-Datei verweist als Präsentation auf `praesentation-entwurf.html`, einen ausdrücklich statischen V2-Platzhalter ohne Zahlenboard. Daraus wird keine vollständig bestätigte neue Publikums-Komposition behauptet. Die Korrektur erhält das vorhandene AP3-Zahlenboard und den getrennten Publikumstemplate-Vertrag.

Zusätzliche Browserregressionen prüfen die tatsächliche zentrale Fläche, funktionale Schrift ohne Verwaltungswrapper, rechte Seitenleiste, Leiste unter dem Board und fixierte mobile Hauptaktionen. Karten sind auf dem Board wie im Entwurf reine Zustandsanzeige; frühere Ziehungen bleiben im separaten Korrektur-/Historienbereich auswählbar. Fachbefehle, CAS, Rufgrenzen, Speicherung und Rollen bleiben unverändert.

Vorbereitung, Rundenpause und Abschluss verwenden ebenfalls die zentrale V3.1-Zustandsfläche: bewusster Erststart im Kopf, keine aktive Zahlenarbeitsfläche zwischen oder nach Runden. Runden-/Ergebnisdaten bleiben in der Seitenübersicht lesbar. Die Browserabnahme prüft ausdrücklich, dass dort kein aktives Board angeboten wird. Die öffentliche Präsentation behält ihren davon getrennten vollständigen Zahlenboardvertrag.

Gestalterische Nutzerabnahme 30.10.2026: Der korrigierte Aufbau gefällt; der kleine Haken in rosa Zahlenfeldern wird ausdrücklich entfernt. Gezogene Zahlen bleiben über Fläche, Schriftgewicht und zugängliche Zustandsbezeichnung unterscheidbar; die aktuelle Zahl behält ihre eigene Kontur. Keine zusätzliche Symbolbelegung der Zahlenfelder.
