# What the Meme! – UX-, Renderer- und Moderations-Polish

Stand: 24. September 2026

## Artefakte

- Feature-Branch: `codex/meme-ux-renderer-polish`
- Feature-Commits:
  - `72d94c5be065d64fc56b9ef222dcd105476f7959`
  - `b982635bc7b4e96e092d07b856c8b157fcb52f4d`
- Preview-Integrationscommits:
  - `485e74bc105c0f7a7333b6f219f34940ecf7e2b3`
  - `7a7904c7d18020c9a801f6c4c7c6effa1070bb0b`
- unveränderliche Preview:
  <https://pubquiz-5ct0f7xuu-just-phil-gud.vercel.app>
- stabile Branch-Preview:
  <https://pubquiz-web-git-preview-content-and-quiz-flow-just-phil-gud.vercel.app>
- Preview-Deployment-ID: `dpl_5TneGNA5Qmv5ZkwjyPh4X7dc64Lu`
- Feature-CI: Runs `35985544025` und `35988967847`, erfolgreich
- Preview-CI: Runs `35985935304` und `35989053349`, erfolgreich
- Preview-Deploy: Runs `35986281368` und `35989371018`, erfolgreich

`main` und das Production-Deployment blieben unverändert.

## Architektur

Die bestehende Meme-State-Machine bleibt für Draft, Finalisierung, Auswahl,
Voting und Ergebnis verantwortlich. Der zentrale `MemeRenderer` übernimmt die
Darstellung in Teamvorschau, Moderation, Kandidatenansicht, Präsentation, Voting
und Ergebnis. Die Präsentationsrahmen beziehen Farben, Typografie und Flächen
ausschließlich aus dem gewählten Quiz-Template.

Die zentrale Moderationsnavigation entscheidet aus dem persistierten Meme-State,
welchen fachlichen Übergang der normale `Weiter`-Befehl auslöst. Button und Hotkey
verwenden dieselbe Funktion. Tastaturereignisse auf `input`, `textarea` und
`contentEditable` werden von globalen Shortcuts nicht verarbeitet.

Das Schließen einer Antwortphase bleibt fachlich im vorhandenen Server-Service.
Seine Run-Auswahl akzeptiert neben dem bisherigen Live-Ergebnismodus nun gezielt
`MEME_CAPTION`. Dadurch werden Meme-Fragen mit gesammelt dargestellter Auflösung
geschlossen, ohne andere Interaktionstypen oder Ergebnisarten zu erweitern.

Die Vorabmoderation speichert Freigabe und Präsentationsauswahl getrennt. Finale
Einreichungen erscheinen bereits während der Eingabephase anonym in der
Moderation. Erst nach dem Schließen wird aus den freigegebenen Einreichungen eine
persistente Reihenfolge gebildet. Reload und parallele Moderationsclients erzeugen
keine zweite Reihenfolge. Eine spätere Ablehnung führt weiterhin nicht zu einer
automatischen Nachbesetzung.

## Sichtbarer Standardtext

Für neue leere Fragen mit der Vorlage `What the Meme!` lautet der sichtbare
Standard-Fragetext exakt `What the Meme!`. Die interne Template-ID bleibt
`meme_beschriften`, der Interaction-Type bleibt `MEME_CAPTION`.

Die Anwendung setzt den Standard nur ein, wenn der bisherige Fragetext leer ist.
Ein bestehender individueller Text wie `Gebt diesem Montag ein Motto.` bleibt beim
Vorlagenwechsel erhalten. Automatisierte Tests und ein echter Preview-Browsertest
decken beide Fälle ab. Es findet keine Bestandsdatenmigration und kein blindes
Umschreiben vorhandener Fragen statt.

## Eingabe und Renderer

- Mehrwortige Texte einschließlich Leerzeichen, Satzzeichen, Umlaute und Emoji
  werden nicht mehr von Präsentations- oder Moderationshotkeys blockiert.
- Oberer und unterer Standardbereich bleiben auf jeweils 80 Zeichen begrenzt.
- Jeder Standardbereich rendert höchstens zwei Zeilen.
- Eine Zeile verwendet einen 13-Prozent-Balken, zwei Zeilen einen
  21-Prozent-Balken; die Bildfläche bleibt stabil und verwendet `object-contain`.
- `AutoFitText` misst den tatsächlichen Renderbereich. Unlesbare finale Texte
  werden abgewiesen, statt abgeschnitten zu werden.
- Der generische Medienlayer wird für Meme-Frage und Meme-Auflösung nicht
  zusätzlich gerendert. Dadurch erscheint ausschließlich das vorgesehene Motiv.

## Moderation und allgemeine Korrekturen

- Kandidatenkarten verwenden denselben Renderer kompakt skaliert.
- Primäre Aktionen liegen direkt unter der Slide-Vorschau und bleiben im
  Moderationsbereich erreichbar.
- Der normale `Weiter`-Button und der zugehörige Hotkey steuern Eingabeende,
  Kandidaten, Voting, Ergebnis und den anschließenden Quizflow.
- Die Vorabmoderation ist während der laufenden Eingabephase anonym verfügbar.
- Team-Passwortfelder verwenden den gemeinsamen maskierten Passwortbaustein mit
  zugänglichem Anzeigen-/Verbergen-Schalter.
- Blockintros zählen tatsächliche Fragen und Umfragen und verwenden korrekte
  Singular-/Pluralformen.

## Automatisierte Prüfung

- vollständiges `npm test`: erfolgreich, einschließlich 568 Haupttests,
  14 Browser-Regressionen, der Präsentations-Viewporttests und 182 Posttests;
- TypeScript: `npm run typecheck` erfolgreich;
- ESLint: erfolgreich;
- Prisma: `npm run db:validate` erfolgreich;
- Production-Build: erfolgreich, Next.js 16.2.5, 49 statische Seiten;
- `git diff --check`: erfolgreich;
- Feature- und Preview-CI: vollständig erfolgreich.

Die Regression umfasst Eingabelimits, Leerzeichen, Shortcuts in editierbaren
Elementen, ein- und zweizeilige Captions, sehr lange Wörter, Umlaute, Emoji,
Overflow, Draft/Final, Vorabmoderation, parallele Finalisierung, stabile
Randomisierung, Voting, Punkte, direkte und verzögerte Auflösung sowie normale
Fragen, Kunstwerk, Pixel, Umfragen und die bestehende Präsentationsarchitektur.

## Echte Preview-Browserabnahme

- Ein neuer leerer Meme-Entwurf zeigte exakt `What the Meme!`.
- Ein individueller Text `Gebt diesem Montag ein Motto.` blieb beim Wechsel auf
  `What the Meme!` unverändert.
- Die Meme-Darstellung wurde bei 1280×720 und in einer mobilen 390×844-Ansicht
  ohne horizontalen Textüberlauf geprüft.
- Die zentrale Moderationsleiste mit `Weiter` lag direkt unter der
  Präsentationsvorschau.
- Derselbe bestehende Meme-Inhalt wurde nacheinander in ungegoogelt Neon,
  Storybook, LOVD × Phil Gud und Komm.ONE dargestellt. Rahmen, Logo, Farben und
  Typografie folgten jeweils ausschließlich dem ausgewählten Template. Danach
  wurde das Quiz auf seinen ursprünglichen Eventreihenstandard zurückgestellt.
- Editor- und Präsentationskonsole blieben ohne Fehler. Die Moderationsseite
  protokollierte einmalig den bereits aus AP5/AP6 bekannten React-Hydration-Hinweis
  `#418` des Live-Timers. Der Hinweis ist durch diese Änderung weder neu
  entstanden noch funktional verändert worden.
- In Quiz 70 wurde `Das ist mein Meme` mit Leerzeichen eingegeben, automatisch
  gespeichert, nach Reload identisch rekonstruiert und final abgegeben. Die
  Submission erschien während der Eingabephase anonym, wurde freigegeben und
  durch Kandidatenansicht, Voting, Ergebnis und Reload geführt. Teamidentität und
  Avatar wurden erst im Ergebnis sichtbar.
- Bei einer zweiten Meme-Frage ohne Submission deckte die Browserabnahme eine
  zu enge Serverabfrage auf: Der normale `Weiter`-Befehl konnte eine
  `MEME_CAPTION`-Antwortphase mit gesammelt dargestellter Auflösung nicht
  schließen. Der minimale Fix erweitert ausschließlich diese Run-Auswahl und ist
  mit einer Server-Regression abgesichert.
- Der korrigierte Fall wurde mit dem frischen Quiz 71 auf Deployment
  `dpl_5TneGNA5Qmv5ZkwjyPh4X7dc64Lu` vollständig wiederholt: Der zentrale
  `Weiter`-Button schloss den leeren Meme-Lauf ohne Fehler, der folgende
  `Weiter`-Befehl übersprang Kandidatenpräsentation und Voting und führte direkt
  zum nächsten Quiz-Slide. Der globale Leertasten-Hotkey verwendete denselben
  Navigationspfad. Die Browserkonsole blieb in dieser Wiederholung leer.

## Ergebnis

Die automatisierte Abnahme, CI, Deployment-Identität, Standardtextprüfung,
Custom-Text-Erhaltung, Theme-Regression und die vollständige Live-Runde mit und
ohne Kandidaten sind erfolgreich. Es erfolgte keine Main-Integration und kein
Production-Deployment.
