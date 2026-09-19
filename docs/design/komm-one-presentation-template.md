# Komm.ONE Presentation Template

Stand: 17. September 2026.

## Referenzanalyse

Die bereitgestellte Folienbibliothek wurde vollständig mit allen 50 Folien, beiden
Folienmastern und den eingebetteten Medien geprüft. Sie dient ausschließlich als
visuelle Corporate-Design-Referenz. Fachliche Inhalte, Platzhalter, interne
Hinweise, Klassifizierungen und PowerPoint-spezifische Layouts werden nicht in das
Produkt übernommen.

Die Referenz arbeitet im Format 16:9 mit zwei klaren Flächenwelten:

- helle, großzügige Inhaltsflächen mit Midnight-Schrift, viel Weißraum und einem
  kleinen Markenanker oben rechts;
- dunkle Midnight-Kapitelbühnen mit weißen Titeln und wenigen großen,
  überlagernden Lagoon-Bändern.

Die wiederkehrende Formsprache besteht aus präzisen Linien, breiten gerichteten
Bändern, Chevrons, Kreisen und großzügigen geometrischen Flächen. Amarillo wird
nur punktuell eingesetzt. Die magentafarbenen Autorenhinweise der Bibliothek sind
kein Bestandteil der Markenpalette für das Quiz und werden nicht übernommen.

Visuell besonders relevant sind die Titelfolie, die Farbübersicht, die dunklen
Kapiteltrenner und die Beispiele für große lineare bzw. kreisförmige
Flächenkompositionen. Dichte Zeitstrahlen, Karten, Diagramme und
Projektfolien dienen nur zur Bestätigung der Grundgeometrie und werden nicht als
Quizlayouts kopiert.

### Logo

Die PowerPoint enthält zwei technisch saubere, vektorielle Originalvarianten der
Komm.ONE-Wortmarke:

- dunkle Schrift für helle Hintergründe;
- weiße Schrift für dunkle Hintergründe.

Beide Varianten enthalten ihre definierte Schutzzone und werden unverändert als
SVG verwendet. Es findet keine Rekonstruktion, Umfärbung oder Suche nach externen
Logoquellen statt.

### Typografie

Die PowerPoint-Themes nennen DM Sans als Corporate-Schrift. DM Sans ist im
Projekt nicht eingebunden. Entsprechend dem vorgegebenen Lizenz- und
Verfügbarkeitsvertrag werden keine Fontdateien aus der PowerPoint extrahiert und
keine neue Schrift beschafft. Das Preset verwendet die bereits technisch
vorhandene Plus Jakarta Sans. Ihre offene, geometrische Form und gut lesbaren
Ziffern bewahren den Charakter bei deutlich größeren Quizschriftgraden.

## Designprinzip

Das neue Preset übersetzt die Markenwelt in eine eigenständige Quizbühne. Es
übernimmt Logo, Kernfarben, Kontrastlogik und geometrische Präzision, erhöht aber
Schriftgrößen, Weißraum, Rhythmus und Dramaturgie für Beamer und große Displays.

Das zentrale Raster besteht aus einem ruhigen, kompakten Markenheader, einer
großen Inhaltsbühne und einem rein visuellen Fortschrittsanker. Es gibt keine
klassische Corporate-Fußzeile. Intro, Countdown, Reveal, Finale und Outro nutzen
eine dunkle Midnight-Bühne. Fragen, Regeln, Zwischenstände und ausgewählte
Informationsfolien nutzen ein warmes, helles Canvas mit Midnight-Text.

### Repräsentative Varianten

- **Intro:** Midnight-Grundfläche, große asymmetrische Lagoon-Bänder, deutliche
  weiße Wortmarke, große Quizidentität und ein einzelner Amarillo-Akzent.
- **Offene Frage:** warmes helles Canvas, starke Midnight-Frage, Lagoon-Leitlinie
  und großzügiger Freiraum ohne Softwarepanel-Optik.
- **Auswahlfrage:** zwei Spalten mit großen ruhigen Quizkarten, klarer
  Lagoon-Hierarchie und kleinen Amarillo-Optionsmarken.
- **Reveal:** Wechsel auf die dunkle Markenbühne, Lösung als großer fokussierter
  Moment mit Basil für die fachlich positive Bedeutung.
- **Countdown:** Midnight und eine sehr große Amarillo-Zahl; Lagoon bleibt
  sekundär und die Ziffer ist auch aus großer Entfernung dominant.
- **Zwischenstand:** helles Canvas und klare Tabellenhierarchie; die Top 3 werden
  über Fläche und Akzent differenziert, ohne Dekor zu überladen.
- **Endstand:** dunkle Bühne mit gestuftem Podium, Amarillo für Platz eins und
  Lagoon-Abstufungen für die weiteren Positionen.

Medien erhalten maximalen Raum und rechteckige, ruhige Rahmen. Pixelstufen,
Audiozustände, Umfragen und alle bestehenden Statusanzeigen behalten ihre
fachliche Bedeutung. Sponsorlogos werden nicht eingefärbt und erhalten auf
Sponsor- sowie Fragefolie dieselbe neutrale, großzügige Darstellung.

## Tokens

Das Preset nutzt die vorhandenen Brand-Token-Verträge:

- Background: Midnight `#003A40`
- Surface: ein warmer, nahezu weißer Präsentationsgrund
- Surface strong: Midnight
- Text: Weiß auf dunkler Bühne; Midnight als helle Bühnenfarbe
- Muted text: Lagoon 40 % bzw. Midnight 60 % je nach Fläche
- Primary: Lagoon `#00B2A9`
- Primary dark / Secondary: Dark Lagoon `#008481`
- Highlight: Amarillo `#F1C400`
- Positive: Basil `#00965E`
- Warning: Dark Amarillo `#F0AD00`
- Negative: Dark Red `#DE3400`
- Borders: Lagoon 80 % `#33C1BA`
- Typography: Plus Jakarta Sans, Display 800, Body 400
- Radii: kompakt und präzise
- Spacing: großzügig

Weitere Markentöne werden ausschließlich als zentral definierte, auf
`data-design-style="KOMM_ONE"` begrenzte CSS-Variablen verwendet. Komponenten
enthalten keine verteilten Inline-Farbwerte.

## Architektur

Das Preset erweitert die bestehende Template-Registry. Alle fachlichen Inhalte
laufen weiterhin durch `PresentationSlideRenderer`. Neue reine
Präsentationsverantwortung liegt in:

- dem Komm.ONE-Preset und seinen Tokens;
- Komm.ONE-spezifischem Header, Backdrop, Stage und Footer innerhalb des
  bestehenden `PresentationDesignSystem`;
- einem strikt auf das neue Design gekapselten Stylesheet.

Lifecycle, Antworten, Deadlines, Bewertung, Moderation, Polling, Rankings,
Pixelmechanik, Sponsor- und Outro-Daten bleiben unverändert.

## Bewegung und Barrierefreiheit

Ein kurzer Fade unterstützt Folienwechsel und ein ruhiges Einblenden großer
Flächen. Keine Funktion hängt vom Ende einer
Animation ab. Unter `prefers-reduced-motion: reduce` werden die Bewegungen
vollständig entfernt. QR-Flächen bleiben weiß, Medien werden nicht zugunsten des
Brandings verkleinert, und relevante Text-/Flächenkombinationen werden gegen die
tatsächlichen Webfarben geprüft.
