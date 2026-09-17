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

Die Bereitstellung erfolgt ausschließlich auf der separaten Branch-Preview. Production und die bisherige gemeinsame Preview bleiben unverändert. Die abschließende authentifizierte Prüfung ist unten dokumentiert.

Bildnachweis: Der 1920×1080-Viewport wurde im DOM geprüft. Der direkte Screenshotexport der Browsersteuerung liefert dazu 1874×1080 Pixel (rechter Rand begrenzt); dies ist eine dokumentierte Werkzeuggrenze, kein skaliertes Ersatzbild. Full-Page-/Kachelexporte waren fehlerhaft und werden nicht als Belege verwendet. 1280×720 und 960×540 wurden mit exakten Bildmaßen gesichert. Die JPEG-Dateiendungen entsprechen dem Ausgabeformat.

Erster Preview-Deploy: https://pubquiz-n07oucgyb-just-phil-gud.vercel.app – READY, Commit 6ca91fad5ed33484431881585942a796123e49e5. GitHub CI #232 erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35123810084 . Dieser historische Zwischenstand wurde anschließend um die Korrektur kleiner Auflösungsvorschauen ergänzt.

## Geänderte Verantwortlichkeiten / Dateien

- `app/rendering/templateRegistry.ts` und `presentationTemplates/`: bestehende LOVD-Markentokens, zulässiges Regular-Schriftgewicht und Presetvorschau; zugehörige Erwartungstests.
- `app/globals.css`: ausschließlich LOVD-Präsentationsstil und kompakte Vorschaukorrekturen.
- `app/rendering/presentation/questionSponsor.ts` / `QuestionSponsorMark.tsx`: reine Metadatenvalidierung und passive Anzeige.
- `PresentationDesignSystem.tsx` / `PresentationSlideRenderer.tsx`: optionale Kennzeichnung im bestehenden LOVD-Frageheader.
- `app/fragen/editor/`: kleiner optionaler Sponsorbereich, Typ und Metadatenerhalt im vorhandenen Konfigurationsvertrag.
- `presentationQualityFixtures.ts` / `questionSponsor.test.tsx`: synthetische Referenzen und Sponsorregressionen.
- `public/branding/`: unverändertes offizielles LOVD-RGB-PNG samt Herkunft und klar markierter Sponsorplatzhalter.
- `package.json`: neue Sponsorregression in vorhandenes Testkommando aufgenommen; keine Abhängigkeitsänderung.
- `docs/design/lovd-brand-refinement.md` und dieser Bericht mit Screenshots: Bestandsvergleich, Gestaltungsvertrag und Abnahmebelege.

## Finaler Bereitstellungsnachweis

- Deployment: `2Wo9qMFyEmNKvRJK6Hn4AuVQhTvc`, Status **READY**, Ziel **Preview**.
- Code-Commit: `99de0c8c4af06b8dfd64d3ff7b3471de410121a8`.
- Unveränderliche URL: https://pubquiz-p4196w17t-just-phil-gud.vercel.app
- Branch-Preview: https://pubquiz-web-git-codex-lovd-brand-refinement-just-phil-gud.vercel.app
- GitHub CI #233: **erfolgreich**, https://github.com/justphilgud/pubquiz-web/actions/runs/35124673967
- Lokaler Build nach letzter CSS-Korrektur erneut erfolgreich.
- Referenzansicht: `/templates/presentation-quality`; im aufklappbaren Bereich „Interne Präsentationsreferenz“ Vorlage **LOVD** und Inhalt z.B. `sponsor-choice` oder `sponsor-intro` wählen.
- Die Branch-Preview verwendet die bestehende Preview-Konfiguration. Lesend verifiziert: separate Preview-DATABASE_URL und Nonprod-Blob-Binding `store_VzfNwjccgkzhc9bi`; Production-Blob separat `store_bIx6H2j23vJzi240`. Keine Environmentvariable geändert oder Secrets ausgelesen.
- Die bestehende gemeinsame Preview `pubquiz-qowmwx1ez-just-phil-gud.vercel.app` und Production `pubquiz-duckwlqkj-just-phil-gud.vercel.app` blieben READY und unverändert in der Deploymentliste. Kein Main-Merge, keine Production-Bereitstellung.
- Lokaler Fixture-Server auf Port 55460 beendet.

## Authentifizierte Preview-Nachprüfung

Nach regulärer Betreiberanmeldung wurde die echte hydratisierte Next.js-Ansicht geprüft:

- Elf Kernfolien jeweils bei 1280×720 und 1920×1080, einschließlich Intro, Frage, Choice, Reveal, Countdown, Zwischen-/Endstand, Sponsor-Intro, Sponsorfragen und Outro.
- Inhaltswechsel über die echten React-Selects; Screenshots `preview-720-*` und `preview-1080-*`.
- Tatsächliche Schriftfamilie: Montserrat. Keine Inhaltsüberläufe in diesen 22 Prüffällen.
- Sponsor-Intro-Bild beim ersten DOM-Messpunkt einmal noch ladend; anschließend vollständig geladen und im Screenshot korrekt sichtbar. Kein defektes Asset.
- Kleine 960×540-Ansicht: lange Auflösung und Sponsor-Choice ohne Überlauf oder Überlagerung.
- Vorlagenwechsel derselben Sponsorfrage: Kennzeichnung ausschließlich in LOVD; nicht in Standard, Corporate oder Storybook.
- Editor: optionalen Bereich öffnen, Logo-Adresse setzen, Default „Präsentiert von“ prüfen, zu „Unterstützt von“ ändern, Logo entfernen. Danach Sponsorzeile wieder deaktiviert und Default wiederhergestellt. Keine Frage gespeichert, kein Upload und keine Lifecycleaktion ausgeführt.
- Keine Browserkonsolenfehler während dieser Prüfung.

Die abschließende Computed-Style-Prüfung erkannte sechs ältere LOVD-Labelregeln mit 500/600/700. Sie verwenden nun ebenfalls das vorhandene Displaygewicht 400. Reiner CSS-Fix, keine neue Komponente oder Verhaltensänderung. Die vollständigen 1.098 Tests, Typecheck und lokale Buildprüfung wurden danach erfolgreich wiederholt; der bestehende ESLint-Befund für die unveränderten TS/TSX-Dateien bleibt gültig.

Die erneute finale Aufnahme zeigt dieselbe Exportbegrenzung wie zuvor: Der DOM-Viewport ist 1920×1080, die 11 direkten JPEG-Exporte sind 1874×1080. Die 11 720p- und 2 540p-Dateien besitzen ihre exakten Zielmaße. Keine Bilder wurden künstlich verbreitert; die 1080p-Layoutprüfung ist zusätzlich in `preview-metrics.json` belegt.

## Abschluss

**LOVD-Refinement und generische Sponsor-Darstellung auf Preview abgenommen: Ja**, im ausdrücklich freigegebenen Umfang mit austauschbarem Platzhalter.

- Finaler Code-Commit: `7e831a7bcb83af4d5de1f36b0346344b47b0b3bf`.
- Finale Preview: https://pubquiz-qeehuqqts-just-phil-gud.vercel.app
- Stabile Abnahmeansicht: https://pubquiz-web-git-codex-lovd-brand-refinement-just-phil-gud.vercel.app/templates/presentation-quality
- Deployment `BziyEZNKujgLc459D8CQRF4m5hN3`: READY, Preview.
- CI #235 erfolgreich: https://github.com/justphilgud/pubquiz-web/actions/runs/35125769878
- Alle 22 Kernansichten nach dem letzten CSS-Fix erneut interaktiv ausgewählt und aufgenommen: kein Überlauf, alle Bilder geladen, sämtliche sichtbaren Textknoten mit Schriftgewicht 400. [Messwerte](preview-metrics.json).
- Kleine Vorschauen nach dem Fix erneut aufgenommen; Vorlagen- und Editorprüfung zuvor erfolgreich, vom Schriftgewichtsfix funktional unberührt.
- Keine Änderung an Production, Authentifizierung, fachlichem Ablauf oder anderen Templates. Keine Frage gespeichert. Kein weiterer Produktfix offen.
- Das eigenständige offizielle STELP-Sponsorasset ist weiterhin optional nachzuliefern; gemäß Betreiberentscheidung kein Blocker für die austauschbare Platzhalterlösung.
- Screenshot-Exportgrenze bei 1080p dokumentiert; kein Layoutüberlauf. Browsergröße nach Prüfung zurückgesetzt, Abnahmeansicht offen gelassen.

STOPP nach Preview-Abnahme. Keine Production-Integration.
