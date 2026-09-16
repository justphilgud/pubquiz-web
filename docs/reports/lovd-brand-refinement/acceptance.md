# LOVD Brand-Refinement – Abnahme

Stand: 16.09.2026. Arbeitsbranch: `codex/lovd-brand-refinement`.

## Ergebnis und Architektur

Das bestehende LOVD-/EDITORIAL-Preset, Renderer, Folien und Abläufe bleiben die Basis.
Farben: LOVD Red `#6A241C`, Caramel Rust `#C64D3B`, Creme Catalana `#FFF9E9`, Type Black `#141414`.
Montserrat Regular 400 ersetzt die bisherige Plus-Jakarta-Darstellung. Das unveränderte offizielle RGB-Primärlogo erhält proportionale Darstellung und Außenraum.
Quellen, Bestandsinventar, Lizenzgrenzen und genaue Umsetzung: [Designbericht](../../design/lovd-brand-refinement.md).

Sponsorinformationen liegen optional im bestehenden Frage-JSON. Der kleine Editorbereich erfasst Logo-Adresse und Sponsorzeile. Default: „Präsentiert von“; eine leere Zeile ist erlaubt. Offene und geschlossene LOVD-Fragen zeigen die Kennzeichnung im Header. Der austauschbare Platzhalter ist ausdrücklich vom Betreiber freigegeben. Ein eigenständiges offizielles STELP-Logo bleibt als später austauschbares Asset offen.
Die Vorfolie ist ein bestehendes Story-Bildelement unmittelbar vor der Frage. Keine automatische Deck-Erweiterung, keine neue Frageart.

## Technische Prüfungen

- Vollständiges `npm test`: **1.098 Tests bestanden**, 0 fehlgeschlagen (400 + 511 + 11 + 176), einschließlich der drei neuen Sponsorregressionen.
- TypeScript `tsc --noEmit`: bestanden.
- ESLint aller geänderten TS/TSX-Dateien: bestanden.
- Next.js Production-Build: bestanden, ausschließlich lokal mit synthetischer CI-Konfiguration; kein Zugriff auf eine echte Datenbank.
- Keine neuen Dependencies; keine Migrationen.
- Keine Änderungen an Antwortannahme, Bewertung, Punkten, Deadline-/Lifecycle-/Countdownlogik, Moderation, Polling oder Snapshotlogik.
- Andere Preset-Tokens unverändert; Sponsor wird dort nicht gerendert. CSS ausschließlich auf EDITORIAL-Präsentation begrenzt. Antwortformularpalette unverändert.

## Reale Browserprüfung

Screenshots stammen aus dem echten Browser mit produktivem React-Renderer, kompiliertem Projekt-CSS und offizieller Montserrat-Regular-Datei. Lokale synthetische, statisch gerenderte Fixtures; diese Prüfung ersetzt keinen vollständigen interaktiven Quizablauf. Kein Quiz-/Team-/Antwortbestand wurde dafür verändert.

**1920×1080 und 1280×720:** Intro, normale Frage, geschlossene Frage, lange Auflösung, Countdown, Zwischenstand, Endstand, Sponsor-Vorfolie, gesponserte offene und geschlossene Frage, Outro.

**1280×720 zusätzlich:** kurze/lange Frage, sechs Optionen, lange/gemischte Antworten, Medienfrage, Reihenfolge, Pixelbild, QR, Regeln, Story. Kein Überlauf im Inhaltsviewport und keine defekten Bilder in diesen Prüffällen.

**960×540:** normale Frage, gesponserte geschlossene Frage, Sponsor-Vorfolie, Endstand und lange Auflösung. Choice und lange Auflösung erhielten eine LOVD-spezifische Korrektur gegen Überlagerung: natürliche Fragehöhe, kompakter Header und zwei Antwortspalten. Die lange Auflösung bleibt in dieser kleinen Vorschau zweispaltig mit angepasster Schriftgröße. Extrem lange Inhalte behalten den bestehenden zugänglichen Scroll-Fallback.

**Logoformate:** breite (10:1), hohe (4:15) und große quadratische synthetische Testgrafiken auf Frage/Vorfolie. `object-fit: contain`, keine Verzerrung oder Beschneidung. Für echte spätere Partnerassets ist die jeweilige individuelle Schutzzone zusätzlich zu prüfen.

Im Browsertest korrigierte Darstellungspunkte: überlagerte globale Hintergrundstile, Story-Bildhöhenüberlauf und kleine Choice-Vorschau. Keine funktionale Änderung.

## Vorher/Nachher

Vorher: Original-CSS und Original-LOVD-Tokens aus Main `49ee7b68173ee574ed98c0912efbd8a187ef13ad`; derselbe produktive Renderer und dieselben synthetischen Inhalte.

| Folie | Vorher | Nachher |
| --- | --- | --- |
| Frage | [JPEG](screenshots/before-1080-normal.jpg) | [JPEG](screenshots/1080-normal.jpg) |
| Reveal | [JPEG](screenshots/before-1080-solution-long.jpg) | [JPEG](screenshots/1080-solution-long.jpg) |
| Zwischenstand | [JPEG](screenshots/before-1080-lovd-ranking.jpg) | [JPEG](screenshots/1080-lovd-ranking.jpg) |
| Intro | [JPEG](screenshots/before-1080-lovd-intro.jpg) | [JPEG](screenshots/1080-lovd-intro.jpg) |

[Alle Screenshots](screenshots/). Dateipräfixe `1080`, `720`, `540` bezeichnen die geprüfte Höhe.

## Bereitstellung

Preview-Bereitstellung und Prüfung der authentifizierten Referenzansicht stehen zum Zeitpunkt dieses Implementierungscommits noch aus. Production wird nicht integriert oder deployt. Die bestehende gemeinsame Preview wird nicht auf einen älteren Branchstand zurückgesetzt.

Bildnachweis: Der 1920×1080-Viewport wurde im DOM geprüft. Der direkte Screenshotexport der Browsersteuerung liefert dazu 1874×1080 Pixel (rechter Rand begrenzt); dies ist eine dokumentierte Werkzeuggrenze, kein skaliertes Ersatzbild. Full-Page-/Kachelexporte waren fehlerhaft und werden nicht als Belege verwendet. 1280×720 und 960×540 wurden mit exakten Bildmaßen gesichert. Die JPEG-Dateiendungen entsprechen dem Ausgabeformat.

Erster Preview-Deploy: https://pubquiz-n07oucgyb-just-phil-gud.vercel.app – READY, Commit 6ca91fad5ed33484431881585942a796123e49e5. GitHub CI #232 erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35123810084 . Anwendungsauthentifizierung für die interaktive Referenzansicht noch ausstehend. Eine anschließende reine LOVD-CSS-Korrektur für kleine Auflösungsvorschauen wird separat bereitgestellt.
