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
