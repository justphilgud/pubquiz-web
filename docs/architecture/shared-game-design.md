# Gemeinsames Design für Eventarten (AP3)

## Entscheidung und Grenzen

Die bestehende presentation_templates-Verwaltung bleibt die einzige Designquelle. Der versionierte SharedDesign-V1-Adapter projiziert geprüfte BrandTokens und die bestehende Quizkomposition; Formatlayouts erhalten getrennte typisierte Daten. Unterstützt werden zunächst EDITORIAL-/CORPORATE-Vorlagen ohne Storybook (Phil Gud, LOVD und gültige aktive Ableitungen). Andere Vorlagen sind weiterhin Quizvorlagen, werden aber nicht als formatübergreifend angeboten. Unterstützte Flächen: Quiz-Frage/Auflösung, Bingo-Zahl/Phrase/Verlauf, Karaoke-Titel/Inhalt. Keine Teilnehmer-, Moderations- oder Liveverträge für Bingo/Karaoke.

Vorhandene Renderer und Stammdaten-/Teamformulare bleiben zuständig. Neue reine Designauflösung und autorisierte Auswahlseiten verantworten gemeinsame Gestaltung; keine zweite Vorlagenverwaltung. Kein Widerspruch zum Designmanifest: Wiederholung der Markenbasis, Variation der Inhaltskomposition.

## Persistenz und Auflösung

Additive nullable shared_design_template_id an Eventreihe und Spielentwurf. Spiel null bedeutet echte Reihenvererbung, Reihe null den Systemstandard Phil Gud. Am Quiz bedeutet null ausdrücklich Legacy, INHERIT neue Reihenvererbung, sonst explizite Vorlage. Alte quizspezifische Standards/Zuweisungen bleiben unangetastet. Antwortformularauswahl bleibt unabhängig; gemeinsame Gestaltung verändert nur die bewusst aktivierte Präsentationsbasis.

Nur das vorhandene Reihenlogo überlagert feldweise das Vorlagenlogo (geprüfte Assetreferenz); null verwendet das Vorlagenlogo. Farben, Schriften, Hintergrund, Radien und Abstände kommen ausschließlich aus der Vorlage, keine Vermischung alter quizspezifischer Standards. Keine Kopie bei Vererbung.

Vorbereitung/Vorschauen lösen beim Öffnen aktuell auf; bereits offene Ansichten ändern sich nicht automatisch. Beim expliziten Quizstart wird unter der bestehenden Quizsperre ein geprüfter Design-Snapshot eingefroren. Laufende/beendete Quizze verwenden ihn; Änderungen an Reihe/Vorlage wirken erst nach bewusstem neuen Durchlauf. Auswahl nur in Vorbereitung. Alte Quizze ohne Opt-in erhalten weder Snapshot noch neue Gestaltung. Reset löscht ausschließlich den neuen Snapshot innerhalb des bestehenden ausdrücklich bestätigten Resetvertrags; AP3 bietet selbst keinen Reset an.

Auswahlseiten sind eigene Unterseiten bestehender Objekte mit vorhandenem Navigationsguard. Reihenverwaltung nach canManageEventSeries, Spielauswahl nach Produkt/Reihenrolle (kein Karaoke-Editor), Quiz nach bestehendem Quiz-Verwaltungsrecht. Jede Lese-/Schreibaktion prüft tatsächliche IDs, aktive Produkte, aktuelle Rechte und CAS-Auswahl. Keine Rechte durch Vorlagenauswahl.

## Betrieb und Tests

Die spätere formatspezifische Liveintegration ist für Bingo in
[Bingo Live AP3](bingo-live.md) beschrieben. Sie nutzt diesen Resolver und friert
ihn beim bewussten Durchlaufstart ein. Der gemeinsame Designvertrag selbst bleibt
unverändert; Karaoke erhält dadurch keine Laufzeit.

Migration ausschließlich neue nullable Spalten, keine Konvertierung/Backfill. Vorhandene dynamische Dump-/Kataloginventur erfasst Spalten. Snapshot-JSON wird eng anhand des regulären Konfigurationsvalidators geprüft, nicht pauschal von der Integritätsprüfung ausgenommen. displayFamily ist ausschließlich optional aus derselben Schrift-Whitelist zugelassen; unbekannte Felder bleiben Fehler. Historisches PRIVATE_READBACK_FAILED ungeklärt, kein Ursachenfix behauptet. Keine manuellen Backups/Restores.

Zu prüfen: Legacy-Regression, getrennte Antwortauswahl, echte Vererbung/Override/Reload, Snapshotstabilität, Rechte/Produkte/IDs/CAS, leere/befüllte additive Migration, Backupvalidator, reale Browser mit zwei Marken und drei Formaten, Laptop/groß/mobil inklusive Schrift/Überlauf. Historische Bootstrapgrenzen bleiben bestehen. Kein Merge/Production.


## Bewusst aufgelöster Bestandswiderspruch
Der bisherige Test quizLifecycle verlangt ausdrücklich nur eine gemeinsame Quiz-Vorlagenauswahl. AP3 fordert getrennte Auswahl. Legacyformulare und Legacyauflösung bleiben identisch; ausschließlich auf der neuen AP3-Designseite aktivierte Quizze nutzen das getrennte vorhandene Antwortformularfeld. Die Regression prüft beide Zweige statt den alten globalen Verbotsregex. Keine alte Zuweisung oder Reihenstandards werden umgeschrieben.

Der Quiz-Snapshot enthält getrennt die gemeinsame Designbasis und die aufgelöste Antwortformularvorlage. Beide bleiben nach Start stabil, auch bei Vorlagen-/Reihenänderung und Reload. Der bestehende Stammdaten-Schreibweg synchronisiert Antwortvorlagen nur im Legacyzweig; AP3-Auswahlen werden erhalten. Kopien übernehmen die ausdrückliche Auswahl, aber keinen Laufzeit-Snapshot.


Die vorhandene Verwendungsanzeige und Archivierungssperre zählen gemeinsame Reihen-/Quiz-/Spielreferenzen mit. AP3-Zuordnung sperrt die Vorlagenzeile lesend, Archivierung dieselbe Zeile vor ihrer Referenzprüfung schreibend; eine parallele neue AP3-Zuordnung darf keine archivierte Vorlage hinterlassen. Alte Schutzregeln bleiben bestehen.

## Synchronisation der Bildfehler-Regression

`scripts/testing/shared-design.visual.browser.test.ts` prüft weiterhin beide Marken
bei 343, 390, 1280 und 1920 Pixeln mit echten Formatrenderern. Ein Bildfehler ist
asynchron: HTTP-Fehler, Browser-Fehlerereignis und React-Commit müssen abgeschlossen
sein, bevor der sichtbare Ersatztext geprüft werden kann. Eine feste Wartezeit von
60 ms war dafür kein verlässlicher Bereitschaftsnachweis und verursachte den
CI-Fehler `missing image fallback`.

Die Fixture liefert für jede Marke/Breite eine eigene, nicht zwischengespeicherte
404-Antwort nach 250 ms. Der Test wartet höchstens fünf Sekunden auf den konkreten
Ersatztext im Karaoke-Renderer. Danach gelten alle bisherigen Layout-, Kontrast-,
Schrift- und Inhaltsassertionen unverändert. Zusätzlich müssen alle acht eigenen
Bildfehler tatsächlich angefragt und beantwortet worden sein. Der globale
Testablauf bleibt auf 30 Sekunden begrenzt; ein ausbleibender Fallback bleibt ein
Fehler, kein übersprungener Fall.

Nachweis der Testkorrektur: verzögerte Fixture mit alter Synchronisation schlägt
fehl, mit zustandsbasierter Synchronisation erfolgreich. Eine temporäre
Negativkontrolle mit deaktiviertem Bildfehler-Handler schlägt weiterhin gezielt
fehl; der Renderer wurde anschließend bytegleich wiederhergestellt. Die
Korrektur ändert ausschließlich Test und Spezifikation, kein Anwendungsverhalten.
