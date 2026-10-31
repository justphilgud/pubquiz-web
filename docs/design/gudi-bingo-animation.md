# Gudi – Bingo-Zahleninszenierung V1.1

## Figurenmodell und Stil

Bearbeitbare Quelle: `app/bingo/animation/artwork.tsx`. Die Kontur und das unveränderte
Augen-/Zwinker-Motiv sind aus den beiden identischen Original-PNGs abgeleitet:
`public/branding/phil-gud/{gudi,website-gudi}.png`, je 660×720, transparenter Alphakanal,
SHA256 `dca783730a6689ec6c189c7befd3365a9b22140a5b86b4fc723df5b9dc977cdb`.
Im überprüften Assetbestand liegt kein bearbeitbares Gudi-Vektororiginal vor.
Originale werden weder ersetzt noch überschrieben. Keine Arme, Beine oder neue Figur.
Die neue Kontur ist eine dokumentierte manuelle Vektorableitung, kein behauptetes
Original-Vektormaster und keine pixelidentische Kopie der feinen PNG-Textur.

Pink `#F6C4DC`, Papier `#FAF8F2`, Ink `#171717` stammen aus `PHIL_GUD`.
Kugel und Requisitenakzente verwenden die eingefrorenen aktiven Bingo-Design-Tokens.
Gudi selbst bleibt markenrosa. Rot im kleinen Ketchup-Piktogramm ist eine inhaltliche
Requisitenfarbe, keine neue Akzentwelt. Zahlen bleiben Arial/Helvetica für eindeutige
Ziffern; bestehende Kopf-/Logopositionen und Designschriften werden nicht verändert.

Die Bildsprache ist eine bewusst reduzierte, zweidimensionale Theaterbühne: klare
Vektorkonturen, konsistente Requisiten, weicher Bodenschatten, mäßige Verformung,
gezielte Antizipation und nachlaufende Reaktion. Es wird kein 3D-Filmlook behauptet.
Die sechs Referenzen 3/9/24/42/66/75 besitzen feinere explizite Zeitmarken; die übrigen
Szenen haben eigene sechsphasige Bewegungsdaten und unabhängige Requisitenspuren.
Gemeinsame Interpolation bedeutet nicht dieselbe vollständige Choreografie.

Alle Motive dauern 4,6 Sekunden, Referenzen 5 Sekunden. Die Kugel trägt ausschließlich
die gerade bestätigte Zahl; keine fremden nummerierten Kugeln erscheinen. Am Ende
folgt derselbe ruhige Zahlenausgang über eine kurze Überblendung. Diese verändert
keinen Spielzustand. Auch 75 beendet weder Runde noch Veranstaltung und bestätigt
keinen Gewinn. Konfetti ist hier ausdrücklich beauftragter Inhalt der Szene 75,
kein allgemeines Belohnungssystem oder dauernder Hintergrundeffekt.

## Quellen und gestalterischer zweiter Durchgang

Der verbindliche Motivkatalog des Übernachtauftrags ist vollständig übernommen.
Die erwähnte ältere ausführlichere Tabelle ist im überprüften Checkout nicht vorhanden;
zusätzliche Zahlenbedeutungen werden nicht erfunden. Freie Gags sind gekennzeichnet.

Der zweite Durchgang korrigiert konkret Kugelverdeckung durch Requisiten (24/42/75),
Fahrzeugkontakt und Brillenposition (18/66), Überstände bei Wurf/Kegeln/König,
kontrastarme Linien auf dunklen Flächen sowie Kalender-/Schachdetails. Wasserstand,
Modem-Lichter und Uhrzeiger haben gezielte innere Bewegung. Die fertige Qualitäts-
bewertung bleibt eine nachvollziehbare visuelle Abnahme, keine Ableitung aus grünem CI.

## Bearbeitung

- `catalog.ts`: Motiv, Zahlenbezug, Vorbereitung, Aktion, Pointe, Reaktion, Abschluss.
- `choreography.ts`: Bewegungsspuren; Positionen in der logischen 720×720-Bühne,
  normalisierte Zeit, Neigung, elastische Skalierung und Deckkraft.
- `timeline.ts`: reine Interpolation ohne Browser, Timer oder fachliche Zustände.
- `artwork.tsx`: gemeinsam genutzte Vektor-Requisiten und Figurenkontur.
- `GudiScene.tsx`: ausschließlich aktuelle SVG-Attribute, ein RAF, begrenzte Laufzeit.

Veränderte Motive müssen ihren vollständigen Ablauf und den Schluss erneut prüfen.
Die Galerie `/templates/bingo-animations` nutzt den tatsächlichen `BingoBoard`.
Es gibt keine neue Templateverwaltung, keinen separaten Publikumsrenderer und keine
zusätzlichen Moderationsbuttons. Galerieaktionen sind rein lokale Referenzereignisse.

## Abnahme und Grenzen

Der Prüfbericht trennt automatisierte Geometrie-/Identitäts-/Ressourcenprüfungen,
zeitaufgelöste Sichtprüfung, Echtzeitmitschnitte und menschliche gestalterische Abnahme.
Ein erfolgreiches Skript ist kein Beweis, dass jede Pointe hochwertig oder lustig wirkt.
Keine physische Beamer-/Geräteprüfung behaupten. Hosting nur mit der getrennten
Branch-Vertrauensfreigabe und isolierter Umgebung; kein Production-Release.

## Präsentationsweite Bühne V1.1

Freigegebene Weiterentwicklung vom 31.10.2026: dieselben Szenen laufen groß und
zentriert über der gesamten Präsentation. Eine schwarze Fläche mit 35 % Deckkraft
trennt den kurzen neuen Ziehungsmoment vom weiterhin vorhandenen Zahlenboard.
Anordnung, Markenfarben und Quellen bleiben erhalten; kein Wechsel des Templates.
Szene und Abdunklung verschwinden gemeinsam, anschließend gilt wieder die normale
Zahlenansicht. Die alte Begrenzung auf die linke Zahlenspur ist bewusst aufgehoben.

Das bleibt eine kurze, ursächlich an die bestätigte Veröffentlichung gebundene
Inszenierung im Sinne des Manifests, kein Dauerhintergrund. Reduzierte Bewegung
überspringt sowohl Szene als auch Abdunklung.
