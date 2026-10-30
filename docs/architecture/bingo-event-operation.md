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

Noch in Arbeit. Kein lokaler oder statischer Nachweis ersetzt die verlangte
gehostete Abnahme, echten PostgreSQL-Nebenläufigkeitstest oder Snapshot/Restore.
Der PR bleibt bis zur vollständigen Abnahme Draft. Fachliche Grundlage:
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
