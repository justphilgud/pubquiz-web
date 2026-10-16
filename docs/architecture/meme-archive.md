# Bestätigte Meme-Abgaben und dauerhaftes Archiv

## Schemaentscheidung und Auswirkungen (vor der Migration dokumentiert)

Zwei additive Tabellen trennen Medienquellen und bestätigte Versionen vom
wegwerfbaren Quizlauf. Eine Quelle gehört zum Quiz (RESTRICT bei vollständiger
Quizlöschung), aber nicht per Fremdschlüssel zur Frage oder zum Interaction-Run.
Ein Eintrag hat ebenfalls keine löschende Beziehung zu Team, Session oder Abgabe.
Durchlauf ist die bestehende `lifecycle_revision`, zusätzlich bleibt die ursprüngliche
Interaction-Run-ID erhalten. Teamname, Frage, Texte und Layout sind Snapshots.

Ein AFTER-INSERT-Trigger auf bestätigten MEME_CAPTION-Abgaben erfasst explizite und
automatisch finalisierte Versionen atomar. Abgabe und Archivmetadaten rollen gemeinsam
zurück. Kein Netzwerkzugriff im Trigger; kein Backfill bei Installation. Die bestehende
Sperrfolge Quiz → Run → Draft bleibt verbindlich. Reset prüft unter derselben Quizsperre,
dass keine bestätigte Abgabe fehlt und jede nicht gelöschte Quelle bereits als Bildbytes
gesichert ist. Andernfalls bleibt der komplette Lauf erhalten. Ein fehlgeschlagener
PNG-Upload ändert den Erfolg der Antwort nicht.

## Medien und Wiederholung

Die dauerhafte DB-Outbox enthält PENDING/READY/ERROR/DELETING/DELETED. Ein begrenzter
Worker sichert zuerst die Basisbildbytes und erzeugt daraus mit `sharp` ein PNG.
Lokale Bildquellen bleiben im Server-Dateitrace enthalten. Audio-/Videodateien
unter `public/medien` werden ausschließlich statisch ausgeliefert und aus diesem
Trace ausgeschlossen; der Archivrenderer verarbeitet keine Audio-/Videoquellen.
Der Renderer lädt die unveränderte, unter OFL 1.1 mitgelieferte Arimo-TTF explizit.
Damit entstehen auch ohne installierte Systemfonts lesbare Glyphen; CI führt die
PNG-Regression mit leerer Fontconfig aus. Quelle, Lizenz und Prüfsumme liegen beim
Asset unter `assets/fonts/arimo`; keine Schrift wird zur Laufzeit heruntergeladen.
`after()` beschleunigt die Verarbeitung nach einer Antwort; Archiv- und Teamabrufe
können ausstehende Arbeit wiederholen. Eine eigene PostgreSQL-Advisory-Sperre
serialisiert Archivworker und Archivlöschung pro Quiz. Worker verwenden Try-Lock
und kehren bei Konkurrenz sofort zurück. Netzwerk-/PNG-Arbeit belegt nie die
Quiz-Lifecycle-Sperre; normale Team-Abgaben bleiben unabhängig. Reset prüft unter
seiner Quizsperre ausschließlich die bereits festgeschriebenen Quellbytes und bleibt
bei ausstehender Sicherung unverändert stehen. Ein Prozessabbruch lässt
wiederholbare Arbeit in der Datenbank, keine bloße Speicherwarteschlange.

Der vorhandene Blob-Store liefert öffentliche Objekte. Deshalb enthält er ausschließlich
AES-256-GCM-verschlüsselte PNGs mit zufälligem Schlüssel pro Eintrag; Schlüssel und
Objektadresse bleiben serverseitig in der DB. Authentifizierte Downloads entschlüsseln
das PNG. Keine neuen Zugangsdaten, keine Ableitung von rotierenden Session-Secrets.
Die vorhandene Umgebungs- und Branchtrennung für Blob-Pfade bleibt bestehen.
Verschlüsseltes PNG und Schlüssel werden vor dem Upload gemeinsam festgeschrieben.
Upload-Wiederholungen verwenden dieselben Bytes; nach READY wird die temporäre
DB-Datei entfernt. Ein abgebrochener Upload kann dadurch weder einen fremden Schlüssel
noch eine veraltete CDN-Datei hinterlassen.

Die neueste bestätigte Version wird pro Team-ID, Quizfragenzuordnung und
Lifecycle-Revision anhand der höchsten Submission-ID bestimmt. Submission-IDs
werden beim bestätigten Schreiben unter der Quizsperre monoton vergeben; so sind
auch erneut gestartete interne Question-Runs eindeutig. Bei fehlender Zuordnung
bleibt der Source-Run ein eigener Fallback-Schlüssel. Die Auswahl erfolgt vor dem
Statusfilter; ein gelöschtes
Meme lässt keine ältere Version wieder erscheinen. Explizites Löschen betrifft alle
Versionen dieses Teams für dieselbe Frage und denselben Durchlauf: zuerst Zugriff sperren, Blob-Dateien
löschen, dann Inhalte und Schlüssel entfernen. Bei Blobfehler bleibt DELETING für
gezielte Wiederholung bestehen. Technische Tombstones verhindern Wiederauferstehung.

## Zugriff und Lebenszyklus

Teams verwenden ausschließlich die vorhandene signierte Session im Request-Header;
keine Tokens in URLs. Ein Session-Reset entzieht den alten Teamzugriff. Veranstalter
verwenden MANAGE_QUIZZES auch bei archivierten Quizzen. Keine öffentliche Galerie.
ZIP-Export wird begrenzt und dateiweise gestreamt, nicht als zweiter Blob gespeichert.

Reset löscht keine Archive. Änderungen oder Löschung des Basisbilds berühren gesicherte
Bytes/PNGs nicht. Vollständige Quizlöschung wird durch den Archiv-Fremdschlüssel
verhindert, bis die Archive bewusst gelöscht wurden. Teamlöschung löscht keine
Archivdaten; der bei Abgabe gespeicherte Teamname bleibt Teil des Archivs. Keine
Schwierigkeit, Bewertung, Votingfreigabe oder öffentliche Projektion wird geändert.

Bereits gelöschte historische Abgaben sind nicht rekonstruierbar. Vor Installation
vorhandene Abgaben werden nicht automatisch importiert; der Reset meldet fehlende
Sicherung, statt sie stillschweigend zu löschen. „Bestehende bestätigte Abgaben sichern“
ist eine separate, bestätigungspflichtige Manageraktion pro Quiz, die denselben
idempotenten Capture-Vertrag benutzt. Kein automatischer Production-Backfill.
