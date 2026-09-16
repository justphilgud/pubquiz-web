# LOVD: Brand-Refinement und optionale Sponsoren

Stand: 16. September 2026. Grundlage: bestehendes Preset `lovd-ungegoogelt` / `EDITORIAL`, Main `49ee7b68173ee574ed98c0912efbd8a187ef13ad`.

## Verbindliche Quellen und Bestandsvergleich

Der öffentliche [Brand Guide](https://www.branddoq.io/stelp/start), die Seiten
[Farben](https://www.branddoq.io/stelp/farben),
[Typografie](https://www.branddoq.io/stelp/typografie),
[Logo](https://www.branddoq.io/stelp/logo) und der vollständige
[Downloadbereich](https://www.branddoq.io/stelp/downloads) wurden im Browser gelesen.
Der Design-Check ist ein Uploadformular, keine zusätzliche veröffentlichte Spezifikation.

| Rolle | Bisher | Offizieller Wert |
| --- | --- | --- |
| Hintergrund / LOVD Red | `#74291d` | `#6A241C` / RGB 106, 36, 28 |
| Primärer Akzent / Caramel Rust | `#d45a3d`, `#c84d34` | `#C64D3B` / RGB 198, 77, 59 |
| Heller Text / Creme Catalana | `#f6efe4` | `#FFF9E9` / RGB 255, 249, 233 |
| Type Black | dunkle abgeleitete Brauntöne | `#141414` / RGB 20, 20, 20 |
| Hausschrift | Plus Jakarta Sans, Display 700 | Montserrat Regular 400 |
| Logo | `lovd-stelp.png`, CSS-Cropping | unverändertes offizielles RGB-PNG, `contain` |

Sekundärfarben im Guide: Pure Matcha `#307065`, Matcha Latte `#6FBEAC`, STELP
Dunkelblau `#062C3D`, Hellblau `#68BBCB`. Sie werden **nicht** als neue LOVD-Farbwelt
eingeführt. Der Guide reserviert Blau für STELP-Anwendungen und nennt eine grobe
Verteilung 65% Primär-/35% Sekundärfarben. Dies ist keine Vorgabe, jede Farbe auf
jeder Folie einzusetzen.

Montserrat ist bereits über `next/font/google` selbst gehostet verfügbar. Der
Guide bietet ebenfalls eine kommerziell nutzbare Regular-TTF an. FF Providence
Sans ist eine Adobe-Schmuckschrift; mangels nachgewiesener Webfont-Lizenz wird sie
nicht eingebunden. Montserrat übernimmt die vorhandenen typografischen Rollen.
Fragen/Antworten bleiben als längere funktionale Texte lesbar in normaler Schreibweise;
kurze vorhandene Versalüberschriften bleiben erhalten. Schriftgrößen des Guides
sind Webbeispiele, keine auf Beamer unverändert zu übertragenden 14px-Fließtexte.

Das Primärlogo verbindet LOVD und STELP für externe Kommunikation. Sekundärlogo
mit Bildmarke dient Café/Merchandise, das Kleinformatlogo knappem Raum. Es besteht
keine Vorgabe, alle Varianten in einer Präsentation zu verwenden. Die Schutzzone
ist die Länge des L umlaufend. Das unveränderte Primärlogo erhält dafür Außenraum;
es wird weder nachgezeichnet, umgefärbt noch verzerrt oder beschnitten. Der Abschnitt
„Logo-Layout“ ist im Guide ausdrücklich noch `Tbd.`. Weitere konkrete Raster-,
Animations- oder Bildsprachregeln werden nicht erfunden.

## Bestehende Architektur und bewusste Grenzen

`templateRegistry.ts` liefert die LOVD-Tokens; `presentationTemplatePresets.ts`
die vorhandene Generatorauswahl; `quizTheme.ts` löst sie auf.
`PresentationDesignSystem.tsx` behält Header, Hintergrund, Bühne und Footer.
`PresentationSlideRenderer.tsx` behält alle produktiven Slides. LOVD-CSS bleibt
auf Präsentationsflächen mit `data-design-style="EDITORIAL"` begrenzt.

Offene Fläche, vorhandene Anordnung, seitliche Frageakzente, Antwortzeilen,
Auflösungsband, Typogrößen-/Dichtelogik und Rankingstruktur bleiben die Basis.
Richtig/Falsch-/Warnfarben bleiben semantisch unverändert. Andere Designwelten
und die gesonderte zugängliche Antwortformularpalette werden nicht umgestaltet.
Gespeicherte individualisierte Templates werden nicht migriert oder überschrieben.
Das aktualisierte Systempreset kann regulär ausgewählt/als Vorlage verwendet werden.

## Sponsorvertrag

Optionales `templateConfig.sponsor = { logo, line }` ist reine Präsentationsmetadaten
im vorhandenen JSON-Feld. Keine Migration, neue Frageart oder STELP-Sonderlogik.
Die bestehende Speichervalidierung prüft die verwaltete Assetreferenz und eine
einzeilige Sponsorzeile bis 80 Zeichen. Default bei fehlender Zeile: „Präsentiert von“;
eine ausdrücklich leere Zeile ist möglich. Entfernen der Logo-Adresse entfernt
die Sponsorinformationen. Im Editor existiert ein kleiner optionaler Bereich.

Der LOVD-Header zeigt die Kennzeichnung nur in der Fragephase. Unterstützt sind
offene und geschlossene Fragen; die generische Darstellung benötigt keine besondere
Antwortart. Auflösung, übrige Presets, Fragen ohne Sponsor und sämtliche
Interaktionsdaten bleiben davon unabhängig. `QuestionSponsorMark` rendert nur
Text und Logo, ohne Aktionen oder Effekte. Die Fragefläche wird nicht verkleinert.

### Optionale Vorfolie ohne Lifecycle-Eingriff

1. Bestehendes Story-Element vom Typ **Bild** erstellen.
2. Titel „Diese Frage wird präsentiert von“, Logo als Bild, passenden Alt-Text setzen.
3. Element im vorhandenen Quizablauf unmittelbar vor der betreffenden Frage platzieren.
4. Bei Bedarf über die bestehenden Ablaufkontrollen ausblenden/entfernen.

Dies verwendet die vorhandene Story-Platzierung vollständig. Ein automatischer
Checkbox-Mechanismus mit zusätzlicher Deck-/Navigationslogik wird bewusst nicht
eingeführt. Es gibt keinen neuen Start, Run, Countdown oder Submission-Kontext.
LOVD-Bildfolien zeigen das gesamte Bild mit Freiraum statt Logos zu beschneiden.

Der Nutzer hat einen klar erkennbaren austauschbaren **Platzhalter** freigegeben:
`/branding/sponsors/placeholder.svg`. Der öffentliche Guide enthält kein separates
STELP-Sponsorlogo. Das konkrete STELP-Asset und dessen abschließende Sichtprüfung
bleiben deshalb offen; der Platzhalter wird nicht als offizielles Logo bezeichnet.

## Invarianten und Regression

Keine Änderungen an Antwortannahme, Draft/Save-Verhalten, Bewertung, Punkten,
Deadline-/Countdownlogik, Lifecycle, Moderation, Polling, Snapshotlogik, Teams,
Authentifizierung, Backup/Restore oder Monitoring. Kein Production-Deployment.

`questionSponsor.test.tsx` schützt Persistenz/Validierung, offene/geschlossene
Darstellung, Abwesenheit auf anderen Presets/Auflösungen, unveränderte Deckschlüssel
und die Nicht-Fragen-Identität der normalen Story-Vorfolie.
Bestehende Präsentations-, Lifecycle- und Theme-Regressionen bleiben erforderlich.

Die interne, authentifizierte `/templates/presentation-quality`-Ansicht enthält
zusätzlich LOVD-/Sponsor-Referenzen. Sie verwendet den produktiven Renderer und
synthetische Daten ohne Speicherung. Vorher/Nachher, reale Browserprüfung,
Testergebnisse und Preview werden im Abnahmebericht separat dokumentiert.
