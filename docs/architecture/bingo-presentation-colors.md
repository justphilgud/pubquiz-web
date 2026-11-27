# Bingo: Rundenfarben, Zahlenbühne und Folienpflege

Stand: 27.11.2026. Dieser Vertrag ersetzt ausdrücklich die bisherigen zehn
Standardfarben, die dunkleren ungezogenen Zellen und die zweispaltige Historie
aus `bingo-intro-navigation.md`. Die bestehenden Bingo-Regeln, Laufzustände,
Gewinnentscheidungen und unveränderlichen Druckstände bleiben maßgeblich.

## Zweck und Oberflächen

Die aktuelle Zahl steht links, das vollständige B/I/N/G/O-Raster rechts. Die
letzten zehn Ziehungen stehen absteigend in einer einzigen Zeile unter dem
Raster. Die Zahl mit Buchstabe bleibt einzeilig und wird zweidimensional
eingepasst. Das Raster bleibt positionsstabil; gezogene und aktuelle Zellen
besitzen zusätzliche Konturen bzw. Inversion. Ungezogene Zellen erhalten eine
helle Nuance der Rundenfarbe und zurückhaltendere, kontrastreiche Schrift.
Kleine Fenster zeigen weiterhin den vorhandenen Hinweis statt eines unlesbaren
75er-Boards. Medien-/Textbingo behält seine eigenen begrenzten Inhaltsflächen.

## Verbindliche Standardpalette

| Runde | Name | HEX |
| --- | --- | --- |
| 1 | LOVD Red | `#6A241C` |
| 2 | Caramel Rust | `#C64D3B` |
| 3 | Creme Catalana | `#FFF9E9` |
| 4 | STELP Events Pure Matcha | `#307065` |
| 5 | STELP Events Matcha Latte | `#6FBEAC` |
| 6 | STELP Dunkelblau | `#062C3D` |
| 7 | STELP Hellblau | `#68BBCB` |

Vom Nutzer ausdrücklich bestätigt: Runde 8–10 wiederholen die Palette ab Runde 1.
Die bestehende Grenze von zehn Runden bleibt erhalten. Schwarz ist keine
Standardrundenfarbe. Eine eigene sechsstellige HEX-Farbe darf im vorhandenen
Rundenformular ausdrücklich gespeichert werden; ein leeres Feld stellt auf die
Standardfarbe zurück. Ein alter Client ohne Farbfeld setzt eine gespeicherte
Überschreibung beim Speichern anderer Felder nicht zurück.

`roundColors.ts` ist die gemeinsame reine Quelle. Sie bestimmt eine Schriftfarbe
mit mindestens 4,5:1 Kontrast; auf Creme Catalana ist diese dunkel. Konturen,
Zahlen, Laufstatus und Beschriftungen bleiben zusätzlich zur Farbe erkennbar.
Auf hellen Runden werden die unveränderten Logo-Silhouetten als dunkle
Kontrastvariante gerendert. Quellen/Proportionen werden nicht verändert; bei
neuen Druckständen wird diese Rückseitenvariante mit eingefroren. Kartenfront,
Layout, Zahlen, Kurzkennungen und Originaldateien werden dafür nicht geändert.

## Persistenz, Ein-/Ausgaben und Invarianten

`bingo_rounds.presentation_color` ist nullable `varchar(7)` mit HEX-Check.
Die additive Migration führt kein Backfill und keine Datenumschreibung aus.
Die bestehenden Vorbereitungs-Actions prüfen Rechte, Reihenbezug, Archiv,
Revision und gestartete Runden unverändert. Farbe ist Vorbereitung, keine
neue Live-Aktion. Beim Start/ersten Öffnen friert `FrozenRound.color` die
wirksame Farbe ein. Audience liest ausschließlich diesen Snapshot; spätere
Vorbereitungsänderungen dürfen den laufenden Kontext nicht umgestalten.
Historische Snapshots ohne Farbwert bleiben lesbar und verwenden die neue
Standardpalette ihrer Rundennummer; ihre gespeicherten Druckdateien bleiben
ausdrücklich unverändert.

Neue Karten-/Sammeldruckstände übernehmen die wirksame Rundenfarbe nur für die
Rückseite. Ein Farbwechsel färbt bestehende Serien oder Druckversionen nicht
rückwirkend um. Vorhandene Karten behalten ihre Identität, Vorderseite,
Verteilung, Kennungen und Hashes. Die bisherigen ausdrücklichen Wege zu neuen
Druckständen gelten weiterhin; kein automatisches Redesign oder Reprint.

## Vorbereitung und Folienpflege

Reihenfolge: kompaktes Intro, Rundenblöcke, kompaktes Outro. Die Blöcke verwenden
die vorhandene Quiz-Struktur als Vorbild: abgerundete äußere Hülle, farblich
abgesetzte feste Blöcke, Nummer/Titel, Griff links sowie Auf-/Ab-Aktionen im
Rundenkopf. Drag-and-drop, Tastatur und Pfeilaktionen nutzen die bestehenden
revisionierten Sortierbefehle. Laufende, archivierte oder schmutzige Kontexte
bleiben gesperrt. Intro/Outro sind fixiert und nicht Teil der Rundensortierung.

`CeremonySummary` öffnet `/bingo/[gameId]/slides/intro` bzw. `outro`.
Die eigene Konfigurationsseite zeigt Seitennavigation, Aktivierung und zentrale
Einstellungen der gewählten Folie sowie Speichern/Abbrechen. Ein erfolgreicher
Save kehrt zur kompakten Vorbereitung zurück; Fehler/Konflikte erhalten den
Entwurf und zeigen eine Meldung. Abbrechen und Verlassen schützen ungespeicherte
Änderungen mit dem vorhandenen Navigation-Guard. Archivierte Reihen sind lesend.
Intro-/Outro-Konfiguration bleiben unabhängig und verwenden die bisherigen
Ceremony-Rechte, CAS und Medienfelder. Outro-Sperre und bewusste Enthüllungen
bleiben unverändert. Keine besondere neue Outro-Ansicht im Spielbetrieb.

`EventPreparationBlock` und `EventSlideEditor` besitzen ausschließlich
Darstellungsslots; Bingo behält Actions und fachliche Zustandsquellen. Sie
sind für eine spätere Verwendung anderer Formate anschlussfähig. Keine Änderung
an Quiz-Oberflächen, Quiz-Actions oder PowerPoint-Karaoke.

## Release, Rückweg und Prüfung

Der Plan liegt im Feature-PR. `BINGO_ROUND_COLOR` ist eine enge zusätzliche
Planart: fest gepinnte vollständige 81er-Basis, genau eine bekannte additive
Migration, unveränderliche SQL-Prüfsumme und exakt begrenzte Prisma-Erweiterung.
Kein weiterer SQL-Plan wird dadurch freigegeben. Der bestehende geschützte
Preflight baut die unabhängige Baseline in netzisoliertem PostgreSQL auf,
prüft Delta, Katalogprojektion, alte Zeilen, HEX-Check und transaktionalen
Rückweg. Der Reader verlangt danach den exakten einen offenen Schritt,
vollständige alte Historie, unveränderte Schema-Basis, Rechte und READ ONLY.
Historischer Neuinstallations-Replay bleibt ausdrücklich NOT_RUN.

Vor Verwendung neuer Rundensnapshots ist die nullable Spalte für alte Reader
additiv kompatibel. Neue Druckstände speichern zusätzlich die kontrastsichere Rundentitelfarbe
`roundInk`; alte Stände ohne Feld behalten ihr bisheriges Rendering. Nach
Persistenz von `FrozenRound.color` oder Druckständen mit `roundInk` ist ein blindes
Rollback auf einen Parser ohne Farbfeld nicht zulässig. Kein automatischer
Spalten-Drop, keine Journalreparatur und keine Rückmigration von Nutzerdaten.
Ein späterer Release benötigt die bestehenden ausdrücklichen Freigaben und
den dokumentierten Backup-Ablauf; diese Implementierung veröffentlicht nichts.

Regressionen: `roundColors.test.ts`, `bingo-color-release-plan.test.ts`,
`bingo-round-color.integration.test.ts`, `bingo-preparation.integration.test.ts`,
`bingo-evening.acceptance.ts`, `bingo-evening.browser.test.ts` und bestehende
Bingo-/Board-/Matching-/PDF-Tests. Reale Ergebnisse und Grenzen stehen im
[Abnahmebericht](../acceptance/bingo-colors-intro-outro-2026-11-27.md).


### Besonderheit der isolierten synthetischen Preview

Die vorhandene Datenbank `bingo_evening_review` wurde als Schema ohne
Prisma-Historie importiert. Das wurde lesend bestätigt; die Farbfeld-Migration
war beim Befund noch nicht angewandt. Der exakte Preview-Helper erwartet deshalb
ausdrücklich keine Migrationstabelle und prüft die festgehaltene vollständige
Struktur von `bingo_rounds` (Spalten, Constraints, Indizes). Nach exakter
Commit-/Planprüfung führt er ausschließlich die freigegebenen SQL-Bytes der
Farbfeld-Migration transaktional aus, prüft die erwartete additive Struktur und
denselben Hash aller bisherigen Rundenfelder und rollt bei Abweichung zurück.
Ein bereits korrekt erweitertes Schema ist idempotent. Keine erfundene Baseline,
kein historischer Replay, kein allgemeines `migrate deploy` auf dieser Preview.
Production verwendet weiterhin die vollständige Historien- und Schemaprüfung.
