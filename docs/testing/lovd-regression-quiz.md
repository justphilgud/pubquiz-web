# LOVD Produktdemo und wiederverwendbares Regressionstest-Quiz

Stand: 10.09.2026. Redaktionelle Einrichtung abgeschlossen; vollständige LOVD-Sichtabnahme wegen der unten beschriebenen bestehenden Grenzen noch offen. Keine Live-Abnahme durchgeführt.

## Quizze und Ausgangszustand

| Umgebung | Quiz | URL | Struktur |
| --- | --- | --- | --- |
| Production | **9 – Produktdemo – LOVD PubQuiz** | https://pubquiz-web.vercel.app/quiz/9 | Ein Block, sechs Fragen |
| Preview | **34 – Regression – LOVD Kernfunktionen** | https://pubquiz-8s8c338vw-just-phil-gud.vercel.app/quiz/34 | Zwei Blöcke, acht Fragen, eine Story, eine Umfrage |

Beide Quizze wurden neu angelegt, nicht aus einem Durchlauf kopiert. LOVD × ungegoogelt ist ausdrücklich ausgewählt. Beide bleiben **PREPARATION / Slide 1 / nicht gestartet / 0 Teams / 0 Antworten**. Die Punktestandtabellen sind leer. Es wurden keine Antworten, Bewertungen oder Interaction-Runs durch einen Testlauf erzeugt, keine Start-/Stop-/Reset-Aktionen ausgeführt.

Die Oberfläche verlangt Eventreihe und Datum. Deshalb: interne Eventreihe **Bestandsquizze (1)**, Datum **2026-09-10**, keine Uhrzeit, kein öffentlicher Eventlink. Die öffentliche LOVD-Eventreihe wurde nicht verwendet. Die ausgewählte interne Reihe wird vom öffentlichen Kalenderfeed ausgeschlossen.

Preview ist ausdrücklich zur Wiederverwendung für AP9 bestimmt, **nicht versehentlich löschen**. Interne Quiznotiz: „Wiederverwendbarer Regressionstest für AP9. Nicht löschen. Ausgangszustand: PREPARATION, Slide 1, keine Teams, Antworten oder Bewertungen.“

## Production: Reihenfolge und Lösungen

Intro-Abschnitt 33, Fragenblock 34, Outro-Abschnitt 35. Alle Fragen sind bereits freigegebene Bestandsfragen. Keine globale Frage wurde bearbeitet.

| Position | Frage / Quizzuordnung | Inhalt | Vorlage / Lösung | Punkte laut Redaktion |
| --- | --- | --- | --- | --- |
| 1 | Q82 / 65 | Bei welchem Sport-Event geht es wortwörtlich um die goldene Ananas? | Standard, im neuen Quiz auf offene Antwort gestellt; Wimbledon (Tennis) | 1 |
| 2 | Q127 / 66 | Japanische Kunst, Zerbrochenes mit Gold zu reparieren | Auswahl; Kintsugi | 1 |
| 3 | Q113 / 67 | Lebewesen aufsteigend nach Zahnzahl sortieren | Ordering; Blauwal → Elefant → Maus → Mensch → Weinbergschnecke | 1,25; vollständige Reihenfolge |
| 4 | Q118 / 69 | Was ist auf diesem Pixelbild zu sehen? | Pixel **Challenge**, Joaquin Phoenix; 15/15/15 Sekunden | Oberfläche: 1–3 Punkte |
| 5 | Q115 / 68 | Welche beiden Personen sind auf diesem Bild zu sehen? | FaceMorph; Heidi Klum / Angela Merkel | 1 gesamt |
| 6 | Q121 / 70 | Rückwärts abgespielter Song: Interpret und Titel | Musik rückwärts; Billie Eilish / Bad Guy | 1 gesamt |

Die Anzeige summiert 6,25 Basispunkte; dies ist wegen Pixel nicht als maximale Laufpunktzahl zu verwenden. Offene Antworten können fachlich eine manuelle Prüfung erfordern. Keine Bewertungs-Neuberechnung ausgeführt.

Q82 enthält im unveränderten Bestand den Schreibfehler **„Wimbeldon (Tennis)“**. Bei einer Demoantwort „Wimbledon“ fachlich richtig bewerten. Die globale Korrektur liegt außerhalb dieses Auftrags.

### Medien

- Q82: Auflösungsbild erfolgreich geladen, 1200 × 1200.
- Q127: Fragenbild erfolgreich geladen.
- Q118: Original und alle drei Pixelstufen erfolgreich geladen.
- Q115: FaceMorph und beide Auflösungsbilder erfolgreich geladen.
- Q121: Original-WAV und Reverse-MP3 im Browser verfügbar; jeweils 29,184 Sekunden, `readyState = 4`, kein Mediafehler. Kein Live-Audiokommando gesendet.
- Alle verwendeten Production-Medien liegen auf dem vorhandenen Blob-Host unter `/prod/`. Keine Preview-Medienreferenzen, keine neuen Production-Uploads.

Erreichbarkeit und redaktionelle Medienansicht sind geprüft; die korrekte Einbettung jedes Mediums im LOVD-Live-Renderer ist noch nicht vollständig visuell abgenommen.

### Bewusste Abweichungen vom Wunschaufbau

- **Pixel-Stufenwertung fehlt in Production:** Der geeignete freigegebene Bestand Q118 verwendet Challenge. Die quizbezogene Konfiguration bietet keinen Modus-Override. Ein Umstellen würde die globale Frage verändern. Daher ein einziger vorhandener Challenge-Fall als zulässiger Fallback.
- Keine geeignete freigegebene Schätzfrage und kein geeignetes Anagramm im geprüften Production-Bestand. Keine fachlichen Production-Fragen neu erfunden.
- Keine zusätzliche Story oder Umfrage, damit die Demo bei sechs abwechslungsreichen Interaktionen bleibt.
- Google-Rezensionen und übersetzt vorgelesen nicht aufgenommen; keine Vollmatrix beabsichtigt.

## Preview: Reihenfolge und AP9-Abdeckung

Intro-Abschnitt 115, Block 1 Abschnitt 116, Block 2 Abschnitt 118, Outro-Abschnitt 117. Alle zehn Inhalte sind zugeordnet; keine offene Zuordnung unter „Kein Block“.

| Block / Position | Referenz / Zuordnung | Herkunft | Inhalt und erwartete Lösung | AP9-Prüfung |
| --- | --- | --- | --- | --- |
| 1 / 1 | Q83 / 113 | Bestand | Schumacher: 7 Weltmeistertitel; offene Antwort, 1 Punkt | Draft, Reload, Submit, manuelle Antwortprüfung |
| 1 / 2 | Q99 / 118 | Neu | Eine Stunde hat 60 Minuten: wahr; 1 Punkt | Wahr/Falsch, Auswahlwechsel, Doppelsubmit |
| 1 / 3 | Q100 / 119 | Neu | Sekunden einer Woche: 604800 Sekunden; 1 Punkt für nächstliegenden Wert | Zahleneingabe, Schätzung und Gleichstände |
| 1 / 4 | Q101 / 120 | Neu | TEN ELITE BRAINS → Albert Einstein; 1 Punkt | Anagramm, Texteingabe, Auflösung |
| 1 / 5 | Q104 / 123 | Neu | Zeiteinheiten aufsteigend: Sekunde → Minute → Stunde → Tag; 1 Punkt | Ordering, gespeicherte Reihenfolge, ganz richtig/falsch |
| 2 / 1 | Story 6 / Placement 125 | Neu | Regression – Bilder sagen mehr; Kapitelintro | Story ohne Antwortformular; Revisionsbindung beachten |
| 2 / 2 | Q103 / 122 | Neu | Größter Planet: Jupiter; Alternativen Mars/Venus; 1 Punkt | Klassische Auswahl mit mehreren Optionen |
| 2 / 3 | Q96 / 115 | Vorhandener eigener AP3-Test | Frosch; Pixel-Stufenwertung | 20 s / 20 s / unbegrenzt; 3/2/1 Punkte, manuelles Ende Stufe 1 |
| 2 / 4 | Q102 / 121 | Neue Kopie von Q96 | Frosch; Pixel-Challenge, 15/15/15 s | Challenge-Versuche, Stufenwechsel, Auswertung und Bonusvertrag |
| 2 / 5 | Poll 4 / Placement 126 | Neu | Welcher Fragetyp hat euch am meisten Spaß gemacht? | Auswahl-Umfrage, automatisches Ergebnis, 0 Punkte |

Die sechs neuen Fragen Q99–Q104 sind ausdrücklich als Regression gekennzeichnet und für Bestandsquizze freigegeben. Keine bestehende Frage wurde überschrieben. Q96 behält ihren vorhandenen AP3-Testtitel; sie wird ausschließlich als technischer Preview-Test verwendet.

Die neue Challenge-Kopie konnte zunächst wegen fehlender Generatorprovenienz nicht freigegeben werden. Über den vorhandenen Generator wurden **nur an Q102** alle drei Pixelstufen neu erzeugt; anschließend erfolgreich freigegeben. Das vorhandene Originalmotiv wurde wiederverwendet, kein neues Original hochgeladen. Original und drei Stufen beider verwendeten Pixel-Fragen laden erfolgreich.

Poll 4 ist freigegeben, Revision 1, Veröffentlichung automatisch und auf **Quiz 34** beschränkt. Optionen: „Klassisches Quizwissen“, „Pixel und Bilder“, „Buchstaben und Reihenfolgen“.

### Nicht verwendeter Preview-Bestand

- Q94 wurde nach Lösungsprüfung aus dem neuen Quiz entfernt: gespeicherte Reihenfolge Hund → Katze → Maus → Mensch passt nicht zu „aufsteigend nach Zähnen“. Ersetzt durch Q104; Q94 selbst unverändert.
- Q73 und Q71 wurden aus dem neuen Quiz entfernt: nicht hinreichend nachvollziehbare Bestandslösungen („Hans Meier“ bzw. „Frida Gold / Hans Meier“).
- Q69: Audio-Bestand als Standardfrage mit null Antworten; Q80: übersetzt vorgelesen ohne Medium. Deshalb kein vollständiger Audiofall im Preview-Quiz.
- FaceMorph/Structured Audio werden in Production redaktionell demonstriert, sind **keine AP9-Abdeckung dieses Preview-Quiz**. Google-Rezensionen für den kompakten Umfang ausgelassen.

## Intro, Auflösungen und Outro

Beide Quizze: **Begrüßung → Regeln → QR-Code zuletzt im Intro**. Wartebildschirm, Start-Countdown und Preise deaktiviert. Kalender-Abo und öffentliche Frageeinreichung deaktiviert. Auflösungen **gesammelt am Blockende (`END_OF_BLOCK`)**. Standard-Rundenintro, Pause, Auflösungen und Abschlusswertung bleiben im bestehenden Flow.

Production-Flow lesend auf `/quiz/9/test` geprüft: 22 sichtbare von 27 gesamten Slides, Start auf WELCOME/Slide 1. Sichtbare Reihenfolge: Welcome, Rules, QR, Rundenintro, Q82, Q127, Q113, Pixelregeln, Q118, Q115, Q121, Pause, sechs Auflösungen, Podium, Endstand, Jahresstand, Abschluss. Die Moderation bestätigt Slide 1/22, Vorbereitung, nicht gestartet, 0 Teams/Antworten.

Preview-Moderation bestätigt Slide 1/32, Vorbereitung, nicht gestartet, 0 Teams/Antworten. Der Austausch von Q94 gegen Q104 ändert die Anzahl nicht.

Gespeicherte Regeln behandeln Teambeitritt per QR, eine antwortende Person je Team, gemeinsames Rätseln ohne Internet, Führung durch die Moderation und gesammelte Lösungen am Blockende. Eigene kurze Willkommen- und Dankestexte wurden in den jeweiligen Intro-/Outroeditoren gespeichert.

## Reale Prüfung und bestehende Grenzen

| Prüfung | Ergebnis |
| --- | --- |
| Quizübersicht, Titel, Zuordnungen, Reihenfolge, Auflösungsmodus | Im realen Browser geprüft |
| LOVD-Begrüßung Production | In tatsächlicher Präsentation nach lokaler Aktivierung gesehen; bei 1280 × 720 sauber |
| LOVD-Begrüßung Preview | In Moderationsvorschau gesehen; Titel vollständig, LOVD aktiv |
| Regeln und Outro | Gespeicherte redaktionelle Texte geprüft; Production zusätzlich in alten Einzelansichten gesehen |
| QR als letzter Intro-Slide | Reihenfolge bestätigt; keine vollständige visuelle LOVD-QR-Abnahme |
| Erste Frage, Spezialfragen, Pixel, Medien | Frageneditoren/Metadatenvorschauen, Lösungen und Medien geprüft; keine vollständige Sichtabnahme jeder LOVD-Folie |
| Antworten / Punktestände | Beide Auswertungen leer; keine Neuberechnung ausgelöst |

**Offener Renderer-Befund:** Die tatsächliche LOVD-Begrüßung zeigt trotz gespeicherten individuellen Textes weiterhin „Willkommen zum heutigen Quizabend!“. Lesende Codeprüfung zeigt: Der Fixed-Slide-Editor schreibt Legacy-Quizfelder, bestehende materialisierte Flow-Konfigurationen werden beim Speichern von Welcome/Rules/Closing nicht entsprechend aktualisiert. Die Abweichung ist für Welcome direkt beobachtet; Regeln und Outro müssen im wirklichen Flow noch geprüft werden. Nicht als erfolgreich übernommene individuelle Texte darstellen.

**Offene Sichtabnahme:** „Gespeicherten Stand ansehen“ führt bei Regeln/Outro auf alte neonfarbene Einzelansichten und nicht auf den LOVD-Renderer. In der alten Regelansicht war bei 720 Pixel Höhe der Titel angeschnitten. Daraus lässt sich weder ein LOVD-Fehler noch eine LOVD-Freigabe ableiten. Moderationsnavigation und der Schnellsprung unter `/test` schreiben den Laufzeitstatus und können Interaktionen/Blockfreigaben beeinflussen. Sie wurden für die reine Production-Redaktionsprüfung nicht verwendet. Eine vollständige Sichtabnahme ist daher noch offen und darf nicht als bestanden berichtet werden.

**Story-Revisionsbindung:** Story 6 wurde als Revision 1 zugeordnet. Anschließend wurde nur die eigene neue Story zu Revision 2 sprachlich passend auf zwei Pixelmodi umgestellt. Bestehende Platzierungen bleiben laut UI/Repository an der alten Revision; kein unterstütztes UI zum Aktualisieren/Entfernen dieser Story-Platzierung gefunden. AP9 muss deshalb mit Revision 1 rechnen („… erkennt das Motiv Schritt für Schritt und entdeckt bekannte Gesichter“), obwohl der Editor bereits Revision 2 anzeigt („… vergleicht zwei unterschiedliche Pixel-Spielmodi“). Funktional als Story-Test nutzbar, redaktionelle Anpassung der Platzierung offen. Keine globale Umgehung oder Produktcodeänderung vorgenommen.

## AP9: Geplanter Testablauf, noch nicht ausgeführt

1. Vor Start Quiz 34 und Preview-Umgebung eindeutig identifizieren; PREPARATION, Slide 1, 0 Teams/Antworten und leeren Punktestand prüfen. Quiz 9 nicht für Regression benutzen.
2. Die genannten Flow-/Story-Befunde prüfen; Intro, Regeln, QR, Story und Abschluss im tatsächlichen LOVD-Renderer visuell abnehmen.
3. Nur eigene autorisierte Testteams verwenden. Join per QR, Reload und erneuten Beitritt prüfen.
4. Block 1: offene Antwort, Wahr/Falsch, Schätzung, Anagramm und Ordering; lokale Entwürfe, Wiederanmeldung, Mehrfachklick und Grenzen der Antwortzeit prüfen.
5. Blockabschluss: gesammelte Auflösungen, Antwortprüfung und Übereinstimmung von Moderation, Teamansicht und Ergebnissen.
6. Block 2: Story ohne Eingabe, Choice, Pixel-Stufenwertung (Stufe 1 bleibt ohne Timer offen), Challenge und Umfrage. Beide Pixelmodi verwenden absichtlich dasselbe Motiv zur technischen Vergleichbarkeit.
7. Pixel-Challenge-Bonus und Stufenpunkte anhand des bestehenden AP3/B09-Vertrags auswerten; Basispunkt-Anzeige nicht mit Gesamtmaximum verwechseln.
8. STOPPED-Verhalten, Finalisierung, Rangliste und Outro prüfen. Audio-Stopp nicht als durch dieses Preview-Quiz abgedeckt ausweisen.
9. Nach späterer Abnahme nur den eigenen Durchlauf gemäß Resetvertrag und erforderlicher konkreter Freigabe zurücksetzen. Quizinhalt und globale Teamkonten erhalten. Wieder PREPARATION/Slide 1/0 Teams/0 Antworten/keine Bewertungen herstellen.

## Sicherheit, Architektur und lokale Prüfung

- Production-Schreibaktionen ausschließlich neues Quiz 9 und seine redaktionellen Zuordnungen/Konfigurationen. Keine bestehenden Production-Quizze, Fragen, Stories, Teams, Antworten oder Bewertungen verändert.
- Preview-Schreibaktionen ausschließlich neues Quiz 34, seine Zuordnungen und die oben bezeichneten neuen Regressionselemente. Entfernt wurden nur Zuordnungen aus diesem neuen Quiz.
- Bestehende UI, Vorlagen, Generatoren und Referenz-/Revisionsmodelle wiederverwendet. Keine Verantwortlichkeiten in Komponenten verschoben, kein Produktcode geändert, keine neue Abhängigkeit.
- Keine Migration, kein Schemaeingriff, kein Deployment, kein Push auf main/preview.
- Einzige neue Repository-Datei: `docs/testing/lovd-regression-quiz.md`.
- `npm run typecheck`: erfolgreich am 10.09.2026 im isolierten Arbeitsbaum.
- ESLint: nicht anwendbar auf die einzige geänderte Markdown-Datei; keine geänderten TypeScript-/JavaScript-Dateien.
- Kein Testlauf und keine synthetischen Runtime-Daten zur bloßen Erstellung erzeugt. Die offenen Punkte oben sind Bestands-/Abnahmegrenzen, keine in diesem Auftrag eingeführten Codeänderungen.
