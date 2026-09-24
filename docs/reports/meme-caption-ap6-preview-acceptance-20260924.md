# AP6 – What the Meme!: Preview-Abnahme Caption-Zonen

Datum: 24. September 2026  
Feature-Branch: `codex/ap6-meme-caption-zones`  
Feature-Commits: `b44326b7d74ae9b13dd1aa071977da36b20b3b5a`, `cc3844c`  
Preview-Integrationscommit: `c5bf980af4d2bce0e9e8f2a29a7c1416df9df62a`  
Preview-Deployment: `dpl_4gh1jj4nmG1oBqyCYS1tX3Fv6jBH`  
Preview: <https://pubquiz-gfu6ybhma-just-phil-gud.vercel.app>  
Branch-Alias: <https://pubquiz-web-git-preview-content-and-quiz-flow-just-phil-gud.vercel.app>

## Ergebnis

AP6 ist auf Preview vollständig abgenommen. Meme-Fragen unterstützen ein bis vier
konfigurierte Caption-Zonen. Der AP5-Standardmodus mit Text oben und Text unten
bleibt der Default. Autor, Team, Moderation, Präsentation, Voting und Ergebnis
verwenden dieselbe Layoutdefinition und denselben Renderer. Production und `main`
wurden nicht verändert.

Während der Browserabnahme wurde ein Fehler im Teilnehmer-Read-Model gefunden:
Das gespeicherte Custom-Layout war im Editor vorhanden, aber das Teilnehmerformular
rekonstruierte zunächst den AP5-Standard. Ursache war, dass `app/quiz/actions.ts`
das `memeCaptionLayout` und den unveränderlichen Interaction-Snapshot nicht in den
Teilnehmervertrag übernahm. Der minimale Fix reicht das Layout durch und bevorzugt
für `MEME_CAPTION` den bestehenden Run-Snapshot. Nach erneutem Deployment wurde
der vollständige Durchlauf erfolgreich wiederholt.

## Architektur und Kompatibilität

1. **Gemeinsamer Renderer und Auto-Fit:** `MemeRenderer` bleibt die einzige
   Rendering-Pipeline. Jede Zone verwendet `AutoFitText`; die deterministische
   Analyse in `memeCaptionLayout.ts` verwendet dieselben Breiten-, Höhen-,
   Zeilen- und Schriftgrößenregeln für die serverseitige Finalprüfung.
2. **AP5-Default:** Eine fehlende Konfiguration wird zu `STANDARD` mit den beiden
   optionalen Zonen `top` und `bottom` aufgelöst. Die beiden externen Bänder bleiben
   21 Prozent hoch; bei beiden sichtbaren Bändern verbleiben rund 58 Prozent für
   das Bild.
3. **Modell:** Die versionierte Konfiguration liegt additiv unter
   `fragen.template_config_json.memeCaptionLayout`. `CUSTOM` enthält ein bis vier
   Zonen mit stabiler ID, Label, Placement, Reihenfolge, `maxLines` und
   Pflichtkennzeichen.
4. **Relative Geometrie:** `x`, `y`, `width` und `height` sind Prozentwerte.
   Bildzonen beziehen sich auf die Bildfläche; `EXTERNAL_TOP` und
   `EXTERNAL_BOTTOM` bilden die bestehenden Außenbereiche ab.
5. **Autorenwerkzeug:** Im Abschnitt „Caption-Layout“ kann der Autor Standard oder
   benutzerdefinierte Zonen wählen, Zonen hinzufügen, löschen, sortieren, benennen,
   als optional/erforderlich markieren, auf ein bis drei Zeilen begrenzen sowie
   direkt auf dem Motiv verschieben und skalieren. Testtext und der gemeinsame
   Renderer zeigen die spätere Darstellung. Ungültige Geometrie blockiert die
   Freigabe; starke Überlappung erzeugt eine Warnung.
6. **Presets:** Oben außerhalb, unten außerhalb, oben im Bild, unten im Bild,
   oben links, oben rechts, unten links und unten rechts.
7. **Bedienung ohne Drag & Drop:** Prozentfelder für X, Y, Breite und Höhe sowie
   die acht Presets. Damit bleibt die Konfiguration auch ohne präzise Maus- oder
   Touch-Gesten möglich.
8. **Teamformular:** Die Eingabefelder werden nach `order` aus dem aufgelösten
   Run-Snapshot erzeugt. Teams sehen Labels, Pflichtkennzeichen und Live-Vorschau,
   können aber weder Geometrie noch Typografie verändern.
9. **Antwortformat:** Custom-Layouts speichern strukturiert
   `{ "captions": { "zone-id": "Text" } }`.
10. **Legacy-Kompatibilität:** Im Standardmodus bleiben
    `{ "topText": "…", "bottomText": "…" }` vollständig les- und schreibbar.
    Bestehende Fragen ohne Layout benötigen keine Migration.
11. **Servervalidierung:** Pflichtzonen, fremde IDs, Feldlänge und Lesbarkeit werden
    gegen dieselbe aufgelöste Zonengeometrie geprüft. Die AP5-Grenzen von maximal
    drei Zeilen, Start bei 7,5 cqw und Absenkung bis 4,5 cqw beziehungsweise
    mindestens 12 px bleiben erhalten.
12. **Draft/Final und Historie:** Unlesbare Zwischenstände dürfen Draft bleiben;
    finale und automatische Finalisierung werden abgewiesen. Der vollständig
    aufgelöste Interaction-Vertrag liegt in
    `quiz_interaction_runs.config_snapshot.interaction`. Spätere Änderungen an der
    Frage verändern laufende oder historische Runs nicht. Fragenkopien übernehmen
    `template_config_json` und damit das Caption-Layout.
13. **Migration:** Keine. Die vorhandenen strukturierten JSON-Felder für
    Fragenkonfiguration und Run-Snapshot reichen aus.

## Automatisierte Prüfung

- gezielte AP6-/Read-Model-Regression nach dem Browserfund: 36/36 erfolgreich
- Architektur- und Verdrahtungstests: 16/16 erfolgreich
- vollständiges `npm test`: alle Testgruppen einschließlich AP1–AP5,
  Interaktions-, Moderations-, Präsentations-, Voting-, Ergebnis- und
  Browserregression erfolgreich
- TypeScript: `npm run typecheck` erfolgreich
- ESLint der geänderten Dateien: erfolgreich
- Production-Build: erfolgreich; der erste Sandboxlauf konnte ausschließlich die
  Google-Fonts nicht laden, der reguläre Netzwerklauf kompilierte, prüfte Typen und
  erzeugte alle statischen Seiten erfolgreich
- Preview-CI Run `35976285467`: erfolgreich
- Preview-Deploy Run `35976542663`: erfolgreich

Die Browser-Layoutregression prüft Standard, nur Bild, nur oben, nur unten,
oben/unten, Umbruch, absichtlich unlesbaren Text, zwei frei platzierte Zonen,
Zwei-Personen-Meme, Zwei-Panel-Meme, kleine Sprechblasen-/Labelzone und vier
Zonen. Für jede Variante werden horizontaler und vertikaler Overflow,
Text-Fit-Status und Bildflächenpriorität gemessen.

Geprüfte Größen: `360×800`, `390×844`, `430×932`, `1280×720` und `1920×1080`.

## Reale Preview-Browserabnahme

Testfrage: `AP6 Caption-Zonen E2E 2026-09-24`, Fragen-ID 120  
Testquiz: `AP6 Vier-Zonen Regression 2026-09-24`, Quiz-ID 69

- Standardlayout oben/unten als unveränderter Default geprüft.
- Wechsel auf Custom, ein bis vier Zonen, Drag/Resize, Prozentfelder, Presets,
  eigenes Label, Standardlabel, Reihenfolge, Pflichtzone, `maxLines`,
  Geometrie-Clamping und Überlappungswarnung geprüft.
- Speichern, Reload und Duplizieren erhalten das Layout.
- Vier reale Felder `Links oben`, `Text unten`, `Rechts oben` und
  `Rechts unten` wurden im Teilnehmerformular aus dem Run-Snapshot erzeugt.
- Lokale Vorschau zeigte alle vier Texte einschließlich Umlaut, Sonderzeichen und
  Emoji. Speichern wechselte von „Antwort wird gespeichert …“ zu
  „Aktuelle Antwort gespeichert.“
- Nach einem echten Reload erschienen alle vier Texte und Labels wieder; die
  Pflichtprüfung blieb korrekt und die Antwort konnte final abgegeben werden.
- AP2-Review zeigte denselben Kandidaten in denselben vier Zonen; Auswahl und
  Reviewabschluss funktionierten unverändert.
- AP3-Einzelpräsentation, Übersicht und Voting zeigten dasselbe Layout. Das eigene
  Meme war wie bisher gesperrt; es wurde keine künstliche Selbststimme erzeugt.
- Nach Votingabschluss zeigte AP4 die Ergebnisfolie mit demselben Layout. Bei nur
  einem teilnehmenden Team wurden korrekt null gültige Stimmen und null Punkte
  ausgewiesen.
- Moderation, separates Leinwandfenster und Teilnehmeransicht meldeten keine
  Browserkonsolenfehler.

## AP1–AP5-Regression und Performance

- Legacy-`topText`/`bottomText`, AP1-Submission, AP2-Auswahl/Review,
  AP3-Präsentation/Übersicht/Voting/Selbstwahl-Sperre und AP4-Ergebnis/Punkte
  blieben unverändert.
- AP5-Auto-Fit, Leerbereich-Ausblendung, Bildflächenpriorität, lange Einzelwörter,
  Umlaute, Sonderzeichen, Emoji, Draft-Zulässigkeit und Final-Blockade bei
  unlesbarem Text wurden automatisiert erneut geprüft.
- Vier Zonen aktualisieren lokal. Es gibt keinen Serverrequest pro Tastendruck und
  keine serverseitige Bildgenerierung oder Antwort-Blobs.
- Auto-Fit arbeitet je Zone in einer festen linearen Schrittfolge; eine
  exponentielle Berechnung wurde nicht eingeführt.
- Im Editor-, Teilnehmer-, Moderations-, Präsentations-, Voting- und Ergebnislauf
  trat kein wahrnehmbarer Eingabelag oder Darstellungsruckler auf.

## Restpunkte

- Der bekannte, unabhängige Hydration-Hinweis des Live-Timers wurde nicht AP6
  zugerechnet und entsprechend dem Auftrag nicht verändert.
- Die Preview-Testfrage und die Testquizze bleiben als nachvollziehbare
  Abnahmedaten bestehen; es wurde keine Löschung beauftragt.
- Es erfolgte keine Main-Integration und kein Production-Deployment.

**Production unverändert: Ja.**
