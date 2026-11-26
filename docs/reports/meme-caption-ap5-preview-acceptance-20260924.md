# AP5 – Preview-Abnahme Caption-Renderer und Auto-Fit

Stand: 24. September 2026

## Gegenstand

AP5 ersetzt die bisherige Text-über-Bild-Darstellung von `MEME_CAPTION` durch
den gemeinsamen Aufbau optionale obere Caption, Bild und optionale untere
Caption. Lifecycle, Auswahl, Review, Voting, Bewertung, Speicherung und die
Payload `{topText,bottomText}` aus AP1 bis AP4 bleiben unverändert.

## Artefakte

- Feature-Branch: `codex/ap5-meme-caption-autofit`
- Feature-Commit: `3b43dd3`
- Draft-PR: <https://github.com/justphilgud/pubquiz-web/pull/31>
- getesteter Preview-Integrationscommit:
  `ba64ce853f35e254a92c8d2da8dfcf1f3ac3b6b5`
- Deployment-ID: `dpl_AFBGG6zzjvmKjNgugA7qvB4oEKE6`
- unveränderliche Deployment-URL:
  <https://pubquiz-82j5qubom-just-phil-gud.vercel.app>
- stabile Branch-URL:
  <https://pubquiz-web-git-preview-content-and-quiz-flow-just-phil-gud.vercel.app>
- Preview-CI: Run `35968050566`, erfolgreich
- Preview-Deploy: Run `35968316732`, erfolgreich; der Deploy-Job checkte den
  Integrationscommit explizit aus und meldete READY.

## Layoutvertrag

- gemeinsamer `MemeRenderer` in Teamvorschau, Moderation,
  Einzelpräsentation, Übersicht, Voting und Ergebnis;
- festes 4:3-Raster mit `object-contain` für das Bild;
- je vorhandener Caption höchstens 21 Prozent Höhe;
- Bildanteil mindestens 58 Prozent mit zwei Captions, 79 Prozent mit einer
  Caption und 100 Prozent ohne Caption;
- höchstens drei Zeilen je Caption;
- bevorzugte Schriftgröße 7,5 cqw, Mindestgröße 4,5 cqw und zusätzliche
  Untergrenze von 12 px auf sehr kleinen Renderflächen;
- achtstufige DOM-basierte Binärsuche innerhalb derselben Grenzen;
- deterministische serverseitige Prüfung mit gewichtetem Glyphenmodell,
  Wortumbruch und Aufteilung langer Einzelwörter;
- unlesbarer Text bleibt als Draft erhalten, wird aber weder explizit noch
  beim Schließen automatisch finalisiert.

## Automatisierte Prüfung

- `npm test`: vollständig erfolgreich, einschließlich AP1 bis AP4,
  AP5-Unit-, Architektur- und Browserregressionen;
- AP5-Browserregression: 360×800, 390×844, 430×932, 1280×720 und
  1920×1080; breite und hochformatige Bilder; obere, untere, beide und keine
  Caption; Umbruch, Mindestgröße und Overflow;
- `npm run typecheck`: erfolgreich;
- ESLint für alle geänderten TypeScript-/TSX-Dateien: erfolgreich;
- Production-Build: erfolgreich, 49 Seiten;
- `git diff --check`: erfolgreich;
- Draft-PR-CI: beide Pflichtläufe einschließlich Prisma, TypeScript, Tests,
  Changed-file-ESLint und Build erfolgreich.

## Echte Preview-Browserabnahme

Testquiz: `AP5 Caption Renderer Abnahme 2026-09-24`, Quiz-ID 66. Das Quiz
wurde aus einem bestehenden Preview-Quiz kopiert, nach der Abnahme beendet
und nicht gelöscht.

1. Eine absichtlich breite, unter 80 Zeichen lange Caption wurde trotz
   erfüllter Zeichenbegrenzung als layoutseitig unlesbar erkannt. Der konkrete
   Warntext wurde angezeigt und die verbindliche Abgabe blieb gesperrt.
2. `Größen? Passen!` und `ÄÖÜ, ß & Emoji 😄 bleiben gut lesbar` wurden live
   ohne Überlauf gerendert und verbindlich gespeichert.
3. Ein echter Reload der Teilnehmeransicht lieferte beide Texte unverändert
   mit dem bestätigten Speicherstatus zurück.
4. Bei 390×844 blieb die Caption-Darstellung ohne horizontalen oder vertikalen
   Überlauf. Die Eingabe reagierte unmittelbar; die Auto-Fit-Komponente führt
   keine Netzwerkrequests aus.
5. Die Moderation zeigte denselben Aufbau in der Kandidatenkarte, erlaubte den
   regulären AP2-Review und behielt Inhalt und Reihenfolge nach der Freigabe.
6. AP3-Einzelpräsentation, Übersicht und Voting verwendeten denselben Renderer.
7. Nach geschlossenem Voting und Finalisierung zeigte die AP4-Ergebnisfolie
   dieselben Texte, dasselbe Bild und dieselbe Bandaufteilung.
8. Ein echter Reload der Präsentation bei 1280×720 zeigte das finalisierte
   Ergebnis unverändert und ohne Overflow.
9. Teilnehmer- und Präsentationskonsole blieben während der AP5-Strecke ohne
   Fehler.

Die visuelle Browserabnahme deckt zusätzlich eine kurze Zeile, mehrzeiligen
Umbruch, einen bewusst zu langen Text, breite Einzelwörter, Umlaute,
Sonderzeichen und Emoji ab. Weitere Bildformate sowie zwei- und dreizeilige
Grenzfälle sind durch die echte Chromium-Browserregression abgedeckt.

## Performance

`AutoFitText` arbeitet ausschließlich lokal. Die Messung startet
deterministisch, verwendet höchstens acht Suchschritte, reagiert über einen
`ResizeObserver` auf tatsächliche Größenänderungen und misst nach geladenen
Fonts genau einmal erneut. Die Caption-Eingabe erzeugt keinen zusätzlichen
Serverrequest pro Tastendruck; die bestehende Draft-Speicherung bleibt
unverändert. In der Preview-Abnahme waren weder sichtbare Eingabelags noch
Messschleifen feststellbar.

## Abgrenzung und Restpunkt

Es gibt keine Datenbankmigration, keine Änderung vorhandener Antworten und
keine Änderung an AP1 bis AP4. `main` und Production wurden nicht verändert.

Eine frisch geladene Moderationsseite protokolliert einmalig den bereits aus
dem Live-Timer-SSR bekannten React-Hydration-Hinweis `#418`. Teilnehmer- und
Präsentationsseite sind sauber; Rendering und Moderationsfunktion bleiben
korrekt. AP5 ändert weder `LiveTimer`, `TimePanel`, `ProgressPanel` noch deren
Zeitinitialisierung. Der Hinweis ist daher ein bestehender, nicht durch AP5
eingeführter Moderationsrestpunkt und kein AP5-Blocker.

## Ergebnis

Alle AP5-Abnahmekriterien sind erfüllt. Der gemeinsame Caption-Renderer,
Auto-Fit, Layoutblockierung, Persistenz, Moderation, Präsentation, Ergebnis,
Responsive-Verhalten und AP1-bis-AP4-Regression sind auf Preview abgenommen.
Production blieb unverändert.
