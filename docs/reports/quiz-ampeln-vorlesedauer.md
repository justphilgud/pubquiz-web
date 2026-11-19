# Gemeinsame Preview: Quiz-Ampeln und Vorlesedauer

Basis: main `e456764a` nach PR #171 und #172. AP5 bleibt unverändert und wird
nicht erneut implementiert. Keine neue Abhängigkeit oder Änderung
von Spielbetrieb, Antworten oder Bewertung. **Kein Production-Backup und kein
Production-Deployment in diesem Auftrag.** Ein gemeinsamer Release folgt erst
nach gemeinsamer Preview-Abnahme und gesonderter Autorisierung.

## Architektur und Umfang

- `readingDuration.ts` schätzt ausschließlich aus aktuellem Übersetzungstext und
  Geschwindigkeit. Der gemeinsame Editor zeigt die Dauer bei Neuanlage und
  Bearbeiten. Original, Übersetzung, Generatoren und Speichern bleiben unverändert.
- `quizBalance.ts` berechnet die verbindlichen Gruppen und Grenzen, blockweise und
  ohne vorherige Rundung. Die Registry-Zuordnung ist exhaustiv. Der Serverleser
  verwendet nur bereits autorisierte Quiz-IDs und Stammdaten, keine Spielergebnisse.
- `QuizBalanceSummary` zeigt einen kompakten Einstieg in Quizliste und Vorbereitung;
  der vorhandene Modal übernimmt Fokus, Escape und Scrollgrenzen. Detailansicht:
  Gruppenring, Textwerte, Sachkategorien, Regeln und Empfehlungen je Block.
- Die aktive Inhaltssuche nutzt die bestehende Mehrfach-Combobox und wiederholte
  Template-URL-Parameter. Empfehlungen öffnen echte neue Tabs; sie kombinieren
  benötigte Kategorie- und Templatefilter und ordnen nichts automatisch zu.
- Notwendige Suchkorrekturen: Standard filtert tatsächlich Standard, ohne zusätzliche
  MC-/Wahr-Falsch-Treffer. MC und 8-Bit sind nun selbst filterbar, bleiben im Editor
  aber wie zuvor nicht eigenständig auswählbar. Die Empfehlungen erzwingen keinen
  Eventreihenfilter, der globale Fragen ausschließen würde.

Die [verbindliche Tabelle](../architecture/quiz-balance.md#verbindliche-regeln)
führt alle Gruppen einschließlich Schätzfrage und Umfragen ohne Ampel auf.
Der Auftraggeber hat die disjunkte Zählung der Standard-/MC-/Wahr-Falsch-Gruppen
bestätigt. Nicht jedes einzelne Template muss vorkommen; Präsenzregeln gelten je
Gruppe. Leere Blöcke bleiben mangels Nenner neutral. Sachkategorien ohne Fragen
erscheinen nicht als Ampelzeile. Kategorien können sich überlappen.

## Isolierte Testdaten

Vorhandene synthetische Review-Datenbank `lovd_november_review_20261119`, bestehender
eingeschränkter Runtime-Benutzer, synthetischer Admin. Neue Fixtures wurden getrennt
angelegt, ohne die bisherigen AP1–5-Testdaten oder Production zu überschreiben:

| Testquiz | Zweck |
|---|---|
| #2, Verteilung und Vorlesedauer | Zwei Blöcke mit jeweils 20 Fragen; Audio 3/20 = 15 % grün und 2/20 = 10 % gelb; zusätzliche Drei-Audio-Regel grün. Alle Präsenzgruppen in Block 1, einige bewusst fehlend in Block 2. |
| #3, Drei Audio fehlen | Zwei Blöcke mit je zwei Audio-Fragen; gemeinsame Zusatzregel rot. |
| #4, Leere Blöcke | Neutrale Leerzustände ohne Division durch null. |

Gespeicherte Übersetzungsfrage #33: 150 Wörter, 1×, Original separat erhalten.
Suchpool mit Kategorie Film: normale Musik #82, rückwärts #83, 8-Bit #84,
Übersetzung #85 sowie Standard #86, MC #87 und Wahr/Falsch #88 zur Abgrenzung.
Eine anfangs unvollständige eigene Ordering-Fixture wurde vor der Detailprüfung
mit gültigen kanonischen Antworten und Teilnehmerreihenfolge ergänzt. Dafür wurde
keine Anwendungsregel geändert.

## Lokale Prüfungen

- TypeScript und ESLint der geänderten Quellen erfolgreich.
- 88 gezielte Vertragsregressionen zunächst erfolgreich, einschließlich aller
  Ampelgrenzen, Blocknenner, Registry-/Aliasabdeckung, Vorlesedauer und Suche.
  Zusätzlicher Test schützt geschlossene Empfehlungen gegen offene Standardfragen.
- Echter Browserregressionstest: Texteingabe, Geschwindigkeit, Original-/Textschutz,
  Ampeldialog, Fokusrückgabe, Kombinationslink und Mehrfachauswahl erfolgreich.
- Lokaler vollständiger Next-Production-Build: Liste und Vorbereitung mit kompakten
  Ampeln, Blockdetails und getrennten Kategorien geladen. Echte Neuanlage und
  Bearbeitung zeigen 150 Wörter → 1:00, 75 Wörter → 0:30; 150 Wörter bei 2× → 0:30.
  Weder Original noch Übersetzung automatisch geändert, keine Speicherung ausgelöst.
- Vollständiger Testlauf: 1923 Tests, keine Fehler. Abschließender Next-Build erfolgreich.
- Echte Suche nach vier Audio-Templates und Film: genau Fragen #82–85, vier ausgewählte
  Templates. Geschlossene Standard-/MC-Suche: genau #86 und #87, kein Wahr/Falsch #88.
  Der echte Empfehlungsklick öffnete einen neuen Tab; Quiz-URL und Dialog blieben erhalten.
- Desktop 1366×768 und 1920×1080 sowie Mobil 390×844 ohne Seitenüberlauf.
  Der mobile Dialog bleibt innerhalb der Bildschirmränder; die breite Regeltabelle
  scrollt intern. Leere Blöcke bleiben neutral; fehlende drei Audio-Fragen werden rot.
- Die bestehende Excel-/Quiz-Browserabnahme erwartete zunächst die alte breite
  Inline-Verteilung. Die Assertions prüfen nun die beauftragte Detailansicht per
  Ampelklick. Dauervergleich sowie Hinzufügen/Entfernen bleiben geprüft; Fragen ohne
  Block werden ausdrücklich ohne erfundene Blockprozente ausgewiesen.

## Gemeinsame Preview und technische Abnahme

- [Pull Request #173](https://github.com/justphilgud/pubquiz-web/pull/173).
- [Gemeinsame Preview / Quizliste](https://pubquiz-4ugu195wb-just-phil-gud.vercel.app/quiz).
- [Testquiz mit zwei Blöcken](https://pubquiz-4ugu195wb-just-phil-gud.vercel.app/quiz/2).
- Vercel-Deployment `dpl_F9UQh22vctLA4zpcGaEcJL69Zv3V`, Environment `preview`,
  Quellstand `37ddc4ed89b2964b7ce63812105c55f195a22ae2`, bereit am 19.11.2026.
- Vollständig erfolgreiche exakte [Push-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/44527800908)
  und [PR-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/44527811180):
  Prisma, TypeScript, Gesamttests, striktes Changed-file-ESLint, Build, HTTP-Prüfung,
  PostgreSQL-Integration und echte Excel-/Quiz-Browserabnahme.

Die folgenden Prüfungen wurden anschließend im gehosteten Deployment mit echtem
Next-Server, Datenbank und isoliertem Chromium erfolgreich wiederholt:

| Prüfung | Beobachtetes Ergebnis |
|---|---|
| Quizliste und Vorbereitung | Kompakter Status für beide Blöcke; Klick öffnet dieselbe Detailansicht. |
| Blockweise Werte | Audio 3/20 grün, 2/20 gelb; Politik 6/20 rot, Kultur 2/20 gelb; Präsenzgruppen ohne Gelb. Schätzfrage/Umfragen ohne Ampel. |
| Empfehlung mit zwei Filterarten | Audio + Film öffnet echten neuen Tab; vier Templateparameter und Kategorie 4. Genau #82–85, keine verlorenen MC-/8-Bit-Filter. |
| Geschlossene Suche | Standard + MC + Film + geschlossen liefert ausschließlich #86/#87; Wahr/Falsch #88 ausgeschlossen. |
| Quizzustand und Tastatur | Quiz-URL und offener Dialog bleiben nach Empfehlungsklick erhalten. Escape schließt, Fokus kehrt auf den Ampelbutton zurück. |
| Audio-Zusatzregel | Quiz #2 grün, weil ein Block drei Audio-Fragen enthält. Quiz #3 rot trotz 20 % Audio in beiden Blöcken, weil jeweils nur zwei vorhanden. |
| Leere Blöcke | Quiz #4 neutral, keine erfundenen Prozente oder NaN-Werte. |
| Bearbeiten | Frage #33: 150 Wörter → 1:00, Eingabe von 75 → 0:30; Original unverändert. |
| Neuanlage | Leerhinweis, dann 150 Wörter → 1:00; Geschwindigkeit 2× → 0:30 bei unverändertem Text. Kein Speichern/Generatoraufruf ausgelöst. |
| Größen und Sichtprüfung | 1366×768, 1920×1080, 390×844; kein Seitenüberlauf. Mobiler Dialog links/rechts 16 px, interne Scrollbereiche; Regeln horizontal scrollbar. |

Die vollständigen Grenzwerte und Nachbarbereiche einschließlich Rundungsfallen
werden durch die reinen Unit-Tests geprüft; die Browserprüfung ergänzt diese um
echte Datenanbindung, Interaktion und Darstellung. Es gibt keine offenen technischen
Abnahmefehler. Die gemeinsame fachliche Preview-Abnahme durch den Auftraggeber
steht vor einem späteren Production-Schritt noch aus.

### Bildnachweise

| Ansicht | Nachweis |
|---|---|
| Desktopdialog | [1366 px](assets/quiz-ampeln-vorlesedauer/ampel-preview-dialog-1366.png) |
| Mobiler Dialog | [390 px](assets/quiz-ampeln-vorlesedauer/ampel-preview-dialog-390.png) |
| Kompakte Quizkarte | [390 px](assets/quiz-ampeln-vorlesedauer/ampel-preview-compact-390.png) |
| Vorgefilterte echte Suche | [Vier Audio-Templates + Film](assets/quiz-ampeln-vorlesedauer/ampel-preview-search-1366.png) |
| Vorlesedauer bei Neuanlage | [150 Wörter, 2×, 0:30](assets/quiz-ampeln-vorlesedauer/reading-preview-create-1366.png) |

### Zugriff, Grenzen und Release

Ausdrücklich freigegeben waren die Wiederverwendung der synthetischen Review-DB,
branchbezogene Runtime-/AUTH-Variablen und genau dieser Preview-Branch. Der vorhandene
Automation-Bypass wurde ausschließlich per HTTP-Header benutzt; der Deployment-Schutz
bleibt aktiv. Tokens, Passwörter und Verbindungsstrings sind nicht Bestandteil dieses
Berichts oder des PR. Eine lokale temporäre Bypass-Kopie wurde nach der Prüfung entfernt.

Die Vorlesedauer bleibt eine Schätzung mit offen benannter 150-Wörter/Minute-Annahme,
keine gemessene Audiodauer. Die technische Abnahme verwendet synthetische Daten;
historische AP5-Aussagen und Production-Daten wurden nicht verändert. Kein Backup,
kein Production-Deployment und kein Merge wurden ausgeführt.

Der abschließende Dokumentationscommit ergänzt ausschließlich Bericht und Bildnachweise;
Anwendung, Tests und Konfiguration bleiben gegenüber dem geprüften Preview-Quellstand
identisch. Die finale PR-CI wird vor Übergabe ebenfalls abgewartet.

## Ergänzung: persistierter Quizmodus

Die Ergänzung zu PR #173 erweitert die oben dokumentierte ursprüngliche Abnahme.
Neuanlage und Bearbeitung bieten „Abwechslungsreiches Quiz“ (Standard) und
„Themenquiz“. Die additive Migration `20261119150000_add_quiz_mode` speichert den
Modus als nicht-nullbares Quiz-Stammdatum mit Default `VARIED` und Werte-Constraint;
Bestandsquiz erhalten den Standard. Kopien übernehmen den Modus, Updates ohne
Modusparameter erhalten ihn. Die bestehenden Rechte und Revalidierung bleiben aktiv.

Die reine Ampellogik setzt Kategoriebewertungen im Themenmodus auf neutral. Dadurch
entstehen weder schlechtere Gesamtstatus noch Kategorie-Ausgleichsempfehlungen oder
daraus abgeleitete Suchfilter. Kategorieanzahl und Blockanteile bleiben sichtbar;
Template-Ampeln, Empfehlungen und Drei-Audio-Regel bleiben aktiv. Kompaktanzeige,
Detailhinweis und Regeltabelle erklären den Modus.

Bereits lokal erfolgreich: alle 14 Ampeltests einschließlich Film-only bei grünen
Templates und unverändert roten unausgewogenen Templates; TypeScript, geändertes
ESLint und die vollständige Analysis-/Client-Browserregression. PostgreSQL-CI prüft
die echte Upgrade-Migration einschließlich Altbestand, Default, Wechsel, Erhalt bei
anderen Updates und ungültigen/NULL-Werten. Die echte Next-/Chromium-Abnahme prüft
Neuanlage mit Standardauswahl, Speichern als Themenquiz, Reload und Rückwechsel.

Der aktualisierte gemeinsame Preview-Link und die gehosteten Ergebnisse dieser
Ergänzung folgen nach erfolgreicher exakter CI. Die bisherige Preview oben belegt
bis dahin ausschließlich den ursprünglichen Stand. Kein Production-Schritt.
