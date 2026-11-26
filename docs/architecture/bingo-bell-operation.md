# Bingoglöckchen: Anzeige, Kartenprüfung, Content und Abenddruck

Erweiterung 26.11.2026: [Bingoabend und Veranstaltungsdramaturgie](bingo-evening-dramaturgy.md) ersetzt für die neue Bedienung das Moderationsraster durch die sortierbare Historie, entkoppelt Ziehungen von offenen Rufen und ergänzt Rundenfarben, Wahrscheinlichkeit, Veranstaltungsrahmen und Lose. Die nachfolgenden Abschnitte beschreiben den bisherigen Ausgangsvertrag.

Stand: 25.11.2026. Ergänzt die AP1-, Vorbereitungs-, V2-Event-, Matching- und
Druckverträge. Production und Änderungen an vorhandenen produktiven Karten sind
nicht Bestandteil der Implementierungsabnahme.

## Verantwortlichkeiten

AP1 bleibt die einzige Quelle für 75er-Spalten, Freifeld, zwölf geometrische
Linien und Gewinnstufen. `numberDisplay` validiert die Schreibweise der Eingabe
und leitet B/I/N/G/O ab. `BingoBoard` besitzt weiterhin Messung, Darstellung,
Originalassets und reduzierte Bewegung. Numerische Präsentation zeigt die aktuelle
Zahl oben mittig; Matching behält seinen eigenständigen Medien-/Auflösungsvertrag.
Bei Bild, Video und Audio liegen Zahlenanzeige, begrenzter Medienbereich und Board
in getrennten Zeilen. Die Größenmessung verwendet den tatsächlich verbleibenden
Boardbereich; große Medien dürfen Zahlenanzeige und Zahlenraster nicht überlagern.

`EventModerationPanel` behält Polling, Verbindungssperre, CAS, technische Retries,
explizite Bestätigung und Rundenzustände. `CardChecksPanel`, `DrawCorrection` und
`LiveTimes` übernehmen jeweils Kartenarbeitsplatz, Korrekturentwurf und rein lokale
Uhrdarstellung. Diese Komponenten erzeugen keine zweite Laufzeitquelle.

## Anzeige und Eingabe

| Bereich | Verbindliches Verhalten |
| --- | --- |
| Zahl | B 1–15, I 16–30, N 31–45, G 46–60, O 61–75; ohne Ziehung nur „–“ |
| Board | Fünf feste Zeilen mit jeweiligem Buchstaben links; 75 stabile Zahlenpositionen |
| Zustände | Ungezogen neutral; gezogen betont; aktuell kontrastierende Fläche und kräftige Kontur. Phil-Gud-Standard behält Pink/Gelb, fremde Farbkonfigurationen bleiben wirksam. |
| Eingabe | Ausschließlich dezimale Ganzzahlschreibweise 1–75; keine Vorzeichen, Dezimalstellen, Buchstaben oder Exponenten. Serverseitig zusätzlich AP1-Bereich und Dubletten. |
| Zeit | Serverdauer als Basis, lokal per monotoner Browserzeit fortgeschrieben; Pause, Rundenwechsel, Ende und Verbindungsfehler stoppen die Fortschreibung. Keine Datenbankschreibvorgänge durch Uhranzeigen. |

## Gespeicherte Kartenprüfung und Entscheidungen

V2 ergänzt das vorhandene unveränderliche Journal um `check` und `decideCheck`.
Alte Events und AP3-Replays bleiben unverändert. `check` bindet an den gehashten
Rufkontext, den serverseitigen Zeitpunkt, die Karte und die damaligen Ziehungen.
Die Karte muss zum autorisierten Abend gehören; auch andere Runden dieses Abends
sind auflösbar. UUID, vollständige Kennung und Kurzkennung werden ohne Beachtung
der Groß-/Kleinschreibung verglichen. Mehrdeutigkeit wird abgewiesen.

Eine Prüfung berechnet null/eine/zwei/mindestens drei Linien als Kein Bingo/Bingo/
Doppel-Bingo/Triple-Bingo. Sie bestätigt keinen Gewinn und blockiert allein keine
weitere Ziehung. Die Moderation kann ausdrücklich mit Begründung bestätigen,
ablehnen oder widerrufen; dabei werden bestehende AP1-Rufe/Entscheidungen benutzt.
Wirksam bestätigte gleiche Karte/Runde/Stufe bleibt höchstens einmal zulässig.
Nach Korrekturen bleiben Bestätigungen erhalten und werden erforderlichenfalls
nachzuprüfen; diese Sperre kann nur ausdrücklich geklärt werden.

Der Arbeitsplatz steht unmittelbar unter dem Board. Eine erfolgreiche Prüfung
leert/fokussiert die Eingabe. Gleiche Karte/Runde erhält eine Kachel mit zusätzlicher
Prüfhistorie, keine zweite neue Kartenkachel. Die Reihenfolge folgt der ersten
Prüfung. Sieben Spalten, vier Zeilen im 610-px-Fenster; zusätzliche Ergebnisse
bleiben im Journal und durch Scrollen erreichbar. Kein/Ein/Doppel/Triple:
Rot/Grün/Blau/Gelb plus Klartext/Symbole. Die ausdrücklich verlangten semantischen
Ergebnisfarben erweitern bewusst die sonst reduzierte Moderationspalette.

Vollständige Beschriftungen werden nur beim Öffnen eines Kartennachweises geladen,
nicht im Statuspolling. Jede Prüfung öffnet in einem neuen Tab den ursprünglichen Ziehungsstand, Zeitpunkt,
Kennung, vollständige Karte einschließlich Textzuordnung und markierte Treffer.
Die nach aktuellen Korrekturen neu berechnete Auswertung an derselben Prüfgrenze
steht getrennt daneben. Spätere Ziehungen verändern keine frühere Prüfgrenze.
Historische Rufe und ihre Entscheidungen bleiben separat bedienbar.

Bekannte frühere Karten derselben berechtigten Eventreihe erhalten die Meldung
„Alte Bingokarte – gehört nicht zum aktuellen Bingo-Abend“, unbekannte Kennungen
„Karte im aktuellen Bingo-Abend nicht gefunden“. Fremde Reihenmetadaten werden
nicht offengelegt. Kurzkennungen waren und bleiben abendweit, nicht global
eindeutig; bei einem alten Karton mit gleichlautender Kurzkennung eines anderen
Abends muss die ebenfalls gedruckte global eindeutige vollständige Kennung benutzt
werden. Bestehende Kennungen werden nicht umgeschrieben.

## Frühere Ziehungen korrigieren

Chronologische Schaltflächen benennen Ziehungsposition und Buchstabe/Zahl.
Der Entwurf zeigt Alt → Neu, Begründung, Konfliktmeldung, Speichern und Abbrechen.
Der vorhandene serverseitige Korrekturbefehl behält Ziehungs-ID und Position.
Alte/neue Zahl und Begründung liegen im AP1-Audit, Actor und Zeitpunkt im Journal.
Publikum und aktuelle Zahl lesen denselben korrigierten Lauf; Prüfungen werden
an ihrer bisherigen Grenze neu berechnet. Keine Korrektursteuerung im Publikum.

## Wiederverwendbarer Content

`bingo_round_templates` speichert Reihe, Namen, Ziehungsziel, geprüfte Zuordnung,
Quellenkontext und Revision. Standard-/Textvorlagen lassen sich direkt unabhängig
von einer Runde erstellen/bearbeiten. Gespeicherte Runden können als eigene
Content-Vorlage publiziert werden. Der bestehende Matching-Editor kann eine
Content-Vorlage bearbeiten, ohne die Quellrunde oder deren Vorbereitung zu ändern.
Speichern ist explizit und revisionsgesichert. Bingo-Navigation trennt Content/Bingos.

Für neue Musik-/Medienauswahl wird ausdrücklich ein bestehender Quellenkontext
derselben Reihe gewählt. Dies verwendet die bestehenden Quiz-Quellenrechte und
die unveränderliche Medienablage. Es erzeugt kein künstliches Event und ändert
keinen Rundensnapshot des gewählten Abends. Der referenzierte Kontext bleibt für
die Medien erhalten; Löschen/Reihenwechsel ist bei solchen Referenzen geschützt.

In der Vorbereitung kann jede neue oder noch unbenutzte Runde ausdrücklich zwischen
Standard und Content-Vorlage wechseln. Runden mit Karten-/Ausgabehistorie weisen
diesen Austausch ab; vorhandene Entwürfe werden nicht durch Polling überschrieben.
Übernahme einer Vorlage erzeugt eine eigene Rundenzuordnung und kopiert benötigte
Medienbytes in den Zielabend, mit neuen Referenzen bzw. geprüfter Wiederverwendung
identischer dort bereits gespeicherter Assets. Spätere Content-Änderungen ändern
weder Runde noch Karten. Der Spezialkartenhinweis blockiert keine Anlage; die
bisherige strenge Übereinstimmung von Karten und Matching beim Start bleibt.
Leere unreferenzierte Runden können entfernt werden. Karten, Ausgabehistorie und
Durchlauf-/Planreferenzen sperren Entfernen mit Erklärung; keine Kaskadenlöschung.

## Gesamtabend erzeugen und drucken

`generateEvening` verwendet dieselbe Spiel-/Reihen-/Rollen-/Archiv-Sperre,
Vorbereitungsrevision, Anfrageidentität und denselben Kartengenerator wie die
Einzelrunde. Menge 1–1000 gilt je Runde; alle Runden verwenden ausdrücklich NEW.
Während laufender/pausierter Abende ist Sammelerzeugung gesperrt. Matching und
Druckeinstellungen werden pro Runde übernommen. Fehler rollen den gesamten Auftrag
zurück. Wiederholung derselben Anfrage liefert denselben Auftrag.

`bingo_print_jobs` und `bingo_print_job_items` binden die erzeugten Serien an Abend
und Runde einschließlich damaliger Reihenfolge/Bezeichnung. Weitere Aufträge
löschen/ersetzen nichts, alte Serien bleiben ausdrücklich zusätzlich zugeordnet.
Der neueste Auftrag steht zuerst, ältere Aufträge in der Historie. Alle Einzelserien
und Druckversionen bleiben im selben Abendkontext erreichbar.

Eine gemeinsame PDF enthält ausschließlich Serien des ausdrücklich gewählten
Auftrags dieses Abends. Rundendecks beginnen getrennt mit einem beschrifteten
Duplex-Trennblattpaar. Kartenzeichnung, Originalfonts/-logos, Matching-Beschriftung,
Papierformat und lange-Kante-Rückseiten bleiben im bestehenden Renderer.
Einzelrenderer erhalten weiterhin höchstens 200 Karten; Gesamtdatei höchstens
20 MB, sonst ausdrücklicher Fehler statt unvollständigem Download. 100 Karten
je Standard-/Spezialrunde bedeuten jeweils 100 unterschiedliche Karten, keine
zusätzliche erfundene Kopienregel. Druck mit tatsächlicher Größe; kein physischer
Drucker-/Schnitt-/Duplexregistrierungsnachweis durch Softwaretests.

Die gespeicherten Karten lassen sich im Kartenbereich ausdrücklich nur lesend
prüfen: paginierte Validierung von Spaltenbereichen, Freifeld, Dubletten und
Layoutchecksumme. Fehler werden gezählt/benannt, niemals still repariert.

## Migration, Rückweg und Nachweise

`20261125120000_bingo_round_content` fügt ausschließlich drei Tabellen, ihre
restriktiven Fremdschlüssel, CHECKs und einen Index hinzu. Keine Datenumstellung,
neue ausführbare Datenbankfunktion oder Änderung bestehender Migrationen.
Prisma-Schema und generierter Client werden gemeinsam aktualisiert.
Die schemaweite Sicherungs-/Restoreinventur erfasst die neuen Tabellen; der enge
Zeilenvalidator prüft Content-Konfigurationen zusätzlich mit dem vorhandenen Parser.
Vorhandene Secret-/Medien-/Routinenprüfungen bleiben erhalten.

Rollback auf alten Code ist nach neuen `check`-/`decideCheck`-Journalen nicht sicher:
alte Parser kennen die Befehle nicht. Ein Rückweg benötigt kompatiblen Readercode;
keine Löschung von Prüfhistorie oder automatischer Down-Migration.

Tests: `cardChecks.test.ts`, bestehende AP1/V2-/Board-/Matching-Regressionen,
`bingo-bell.acceptance.ts` im echten PostgreSQL-Gesamttest mit unveränderten alten
Karten und vollständigem isolierten Dump/Restore. Aktueller tatsächlicher Stand,
Browser-/PDF-Nachweise und Grenzen stehen im Abnahmebericht.
