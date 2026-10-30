# Bingo AP3 – persistierter Ein-Runden-Durchlauf

## Zuständigkeit und Bestandsgrenze

AP1 bleibt unverändert die Quelle für Ziehungen, Linien, Gewinnstufen,
Korrekturen, Entscheidungen und Laufzeitübergänge. AP2 erzeugt und verwaltet
weiterhin unveränderliche Karten und unabhängige Druckstände. Neu ist die
Integration in einen autorisierten, dauerhaft gespeicherten Durchlauf unter
app/bingo/live/: Fachadapter, Repository, Moderation und Zahlenboard.
Keine Quizdatensätze, Teamteilnahmen oder zweite Templateverwaltung.

game_drafts.status=DRAFT bezeichnet weiterhin Stammdaten. Laufzustände gehören
ausschließlich zum separaten Durchlauf. AP3 bedient genau eine ausgewählte
vorbereitete Runde je Durchlauf. Der reine AP1-Mehr-Runden-Vertrag bleibt
unverändert; Mehr-Runden-Bedienung ist nicht implementiert.

## Daten und atomare Befehle

Migration 20261028090000_bingo_live ist ausschließlich additiv:

- bingo_live_runs: dauerhafte Lauf-ID, Spiel/Runde/Reihe, Status, Revision,
  Startzeit/Actor, eingefrorene Runde und Livegestaltung, Start-Idempotenz.
- bingo_live_cards: ausschließlich Referenzen auf bestehende AP2-Karten.
  Zusammengesetzte Fremdschlüssel sichern Spiel, Serie und Kartenidentität.
- bingo_live_events: geordnete unveränderliche Befehle mit Revision, Request-ID,
  Inhaltshash, Datenbankzeit und Actor.
- Ein zusätzlicher eindeutiger Index auf bestehenden Karten ermöglicht den
  zusammengesetzten Fremdschlüssel; keine Kartenbelegung wird geändert.

Der partielle eindeutige Index bingo_live_one_active verbietet auch unabhängig
vom Dienst zwei laufende/pausierte Durchläufe desselben Spiels. Sperrreihenfolge:
Spiel → Produkt-Advisory-Lock → Reihe → Benutzer/Rollen → Durchlauf.
Jede Schreibaktion prüft aktive Anmeldung, aktuelle Reihenrolle, Bingo-Freischaltung
und Archivgrenze erneut. Admin umgeht das Produktgate nicht.
Editoren und reine Reihenverwalter erhalten keine neuen Bingo-Funktionen.

Die Spielzeile serialisiert Vorbereitung und Livebefehle. Revision/CAS verhindert
verlorene Änderungen zwischen Moderationsfenstern. Erst aktuelle Autorisierung,
dann Request-ID/Hash, danach Revision und Fachzustand: identische Wiederholung
liefert dasselbe Ergebnis; widersprüchliche Wiederverwendung wird abgewiesen.
Ein unklar beantworteter Clientrequest kann ausdrücklich unverändert wiederholt
werden. Zustand und Auditereignis werden in einer Transaktion geschrieben.

Gespeicherte Aggregate werden nicht als beliebiges Zustands-JSON übernommen:
Rundensnapshot, Karten und geordnete Befehle werden validiert und mit AP1
deterministisch wiederholt. Status, lückenlose Revisionen und Requesthashes
müssen zum Ergebnis passen. Beendete Läufe weisen neue Befehle ab. Ein späterer
neuer Durchlauf erhält eine neue ID; es gibt keinen Resetbefehl.

## Zeit, Ruf und Korrektur

Zeit stammt aus PostgreSQL clock_timestamp() in Millisekunden. Bei rückläufiger
Wanduhr wird mindestens die letzte gespeicherte Serverzeit verwendet.
AP1 speichert aktive Abschnitte und Pausen. Lesen/Polling/Uhranzeige schreibt
nichts. Browserzeiten werden weder angenommen noch fachlich verwendet.

„Bingo-Ruf jetzt erfassen“ speichert sofort Stufe, feste Ziehungsgrenze und die
damaligen Zahlen. Erst danach wird die Karte gesucht. Kurzkennung, vollständige
Kennung und UUID werden ausschließlich innerhalb des eingefrorenen Bestands
aufgelöst. Die ursprüngliche geometrische Auswertung verwendet den Rufstand;
heutige Nachprüfung berücksichtigt AP1-Korrekturen, niemals spätere Ziehungen.

Bestätigen, Ablehnen und Zurücknehmen sind ausdrückliche Befehle mit Begründung.
Eine Bestätigung beendet nicht das Spiel. Ausgabe null und Ausgabe 0 bleiben
verschieden; geometrische Deckung beweist weder Verkauf, Zahlung noch Teilnahme.
AP3 erlaubt nur die letzte Ziehung einer offenen Runde zu korrigieren, im
laufenden oder pausierten Durchlauf. Bestätigungen bleiben erhalten und werden
gemäß AP1 gegebenenfalls als nachzuprüfen markiert. Historische AP1-Korrekturen
werden nicht eingeschränkt; ihre Bedienung bleibt außerhalb AP3.

## Einfrieren, Design und Zugriff

Beim bewussten Start werden Rundentitel, Ziel, Ausgabeangabe, Serien-/Kartenbestand
und die aufgelöste gemeinsame Vorlage festgehalten. Änderungen der Vorbereitung
ändern den Lauf nicht. Die vorhandene Vererbung Spiel → Reihe → Phil Gud bleibt.
Originale Schrift- und Bildbytes werden separat für Live eingefroren. Druckblock,
PDF, Druckversionen und Livegestaltung bleiben getrennte Verträge. Die vorhandene
begrenzte Assetaufnahme wird wiederverwendet, nicht der Druckdesignvertrag.

Die vorhandene Original-Displaydatei bleibt erhalten. Arial wird für die
eingefrorene portable Zahlen-/Leseschrift wie im vorhandenen Assetloader durch
den mitgelieferten Arial-kompatiblen Arimo-Schnitt abgedeckt. Bilder werden durch
denselben begrenzten Loader proportional nach PNG normalisiert; es wird keine
bytegleiche Kopie der ursprünglichen Bilddatei behauptet.

Die Präsentation folgt dem bestehenden Controller-Zugriff: Anmeldung und aktuelle
Bingo-Reihenrechte sind auch für Polling und Assets erforderlich. Der zusätzliche
URL-Schlüssel ist eine Anzeigeidentität und verleiht selbst keine Berechtigung.
Anzeigedaten enthalten Zahlen, Status, Rundenfortschritt und einfache Rufrückmeldung;
keine vollständigen Karten, internen Begründungen oder personenbezogenen Daten.
GETs bleiben schreibfrei. Die Moderation zeigt denselben Boardrenderer skaliert.

Der stabile angemeldete Spieleinstieg lässt sich bereits vor Start öffnen und
zeigt dann „Vorbereitet · noch nicht gestartet“. Er übernimmt einen bewusst
gestarteten neuen Durchlauf automatisch. Eigene Durchlauf-URLs behalten die
historische Referenz. Die Startzeit wird unter der Spielsperre strikt monoton
vergeben; alte Antworten eines früheren Durchlaufs können einen neueren nicht
überschreiben, auch wenn dessen lokale Revision wieder bei null beginnt.

Polling ist seriell und behält bei Verbindungsfehlern den letzten bestätigten
Stand. Innerhalb desselben Durchlaufs werden ältere Revisionen verworfen.
Eine unbeantwortete Pollanfrage wird nach acht Sekunden abgebrochen; der
Verbindungsfehler wird sichtbar und die nächste Anfrage erneut versucht.
Animationen hängen an der Ziehungsidentität, nicht an Pollantworten, und enden
selbstständig; reduzierte Bewegung deaktiviert sie.

Das Board hat 75 feste Positionen, keine individuelle 5×5-Karte. Breite und Höhe
bestimmen die einheitliche Zahlengröße. Die große aktuelle Zahl wird zusätzlich
anhand tatsächlicher Glyphenmaße eingepasst. ResizeObserver, Schriftladung und
Vollbildwechsel messen neu; keine dauerhafte Messschleife. Layoutpixel schützen
skalierte Vorschauen. Unzureichende Fläche erhält einen verständlichen Hinweis.

## Backup und Wiederherstellung

Dynamische Inventur und schemaweiter Dump erfassen alle drei Tabellen,
Referenzen, Ereignisse und eingefrorenen Bytes. Vier neue Trigger verwenden
ausschließlich die bereits exakt geprüfte Funktion bingo_immutable_record.
scripts/operations/schema-reference/bingo-live-routines.json bindet exakte
Tabellen und vollständige Triggerattribute an den Hash der neuen Migration.
Bestehende AP2-, Rollen- und Meme-Prüfungen bleiben erhalten. Keine Präfixausnahme.

Der enge Liveasset-Validator prüft Struktur, Binärformat, kanonisches Base64 und
SHA-256; danach gelten die bestehenden Design-/Secretprüfungen.
Eingefrorene Bytes werden vollständig im Dump bewahrt. Eine entfernte
ursprüngliche Bilddatei muss nicht erneut heruntergeladen werden.

Der echte PostgreSQL-Test baut eine ausdrücklich historische Modellbaseline auf,
wendet unveränderte AP2-Migrationen sowie AP3 an und installiert ausschließlich
hashgeprüfte historische ausführbare Objekte. Das ist **kein vollständiger
chronologischer Replay aller historischen Migrationen**. Vollständiges
collectSnapshot prüft anschließend alle Zeilen/Kataloge, AP2-Druckassets und
synthetische Livezustände. Ein schemaweiter Dump wird in eine neu angelegte
entbehrliche Datenbank restauriert und vollständig verglichen. PostgreSQL stellt
Referenzen/Trigger im Post-Data-Abschnitt nach den Zeilen wieder her.

Diese isolierten Prüfungen sind weder Production-Backup/Restore noch Wochenlauf-
Nachweis und behaupten keinen Fix für das historische PRIVATE_READBACK_FAILED.

## Verifikation und Grenzen

- npm run test:bingo: unveränderte AP1-Tests, Liveadapter und echtes Board im
  Chromium bei 1280×600, 1366×768 und 1920×1080, beiden Marken und Skalierung.
- scripts/testing/bingo-preparation.integration.test.ts: bestehende AP2-Prüfungen
  plus echter AP3-Dienst, Konkurrenz/Idempotenz/Rechte, Integrität und Dump/Restore.
- scripts/operations/meme-archive-backup.test.ts: bestehende Prüfungen plus
  fehlende/zusätzliche/veränderte AP3-Objekte und exakte Migrationsbindung.
- Typecheck, geänderte Dateien linten, reguläre Repository-CI und Build.

Der konkrete lokale/gehostete Abnahmestand, Screenshots, CI und geprüfte SHAs
werden im Prüfbericht und PR dokumentiert. Kein Preview-Erfolg vor Nachweis
von READY, Alias, Runtime und echtem gehosteten Ablauf.
Kein physischer Beamertest; kein OCR, Offline/Pi, digitale Karten, Teambeitritt,
Statistikmodell oder Mehr-Runden-Komfort.

## Begrenzte Gudi-Inszenierung
Die rein visuelle Erweiterung für bestätigte Ziehungen ist in [Gudi-Animationsvertrag](bingo-gudi-animation.md) dokumentiert. Sie ändert keine Fachbefehle, Snapshots oder Gewinnregeln und löst beim Öffnen, Reload oder Reconnect keine historischen Szenen aus.
