# Fakten-Templates

Stand: 4. Oktober 2026

## Zweck und Inhalt

`fakten_jahr`, `fakten_land` und `fakten_frei` teilen den `FACTS`-Datenvertrag.
Die Fragekonfiguration enthält eine geordnete Liste von 2 bis 7 Textfakten mit
stabilen IDs, Antwortart, Hauptlösung, interne Schreibvarianten und sichtbare Optionen.
Auf Nutzerentscheidung sind Fakten auf 300 Zeichen begrenzt. Anzahl, Reihenfolge,
Nicht-Leerheit und Zeichenlimit werden serverseitig auch bei Entwürfen geprüft.
Lösung und Optionen dürfen maximal 200 Zeichen enthalten, wie bestehende Antworten.

## Architektur und Persistenz

`FactsTemplateEditor` pflegt Inhalt und Lösung; `SortableTemplateList` übernimmt
Touch-, Tastatur- und Schaltflächensortierung. `QuestionEditor` behält Workflow,
Speichern und Kategorien. `factsTemplate.ts` enthält Parser, Regeln und Ableitung
der vorhandenen `antworten`-Datensätze. Der Server weist widersprüchliche
Lösungskonfiguration/Antwortdaten zurück. Fakten bleiben in `template_config_json`.
Die additive Migration registriert ausschließlich die drei Vorlagen. Keine neue
Tabelle und keine Änderung bestehender Datensätze oder des Submission-Lifecycles.

## Antwortvertrag und Bewertung

Jahre verwenden `NUMBER` mit `selection: YEAR`, Länder `TEXT` mit
`selection: COUNTRY`. Die UI bietet Auswahl statt Freitexteingabe. Jahre 1–9999
werden in Jahresbereich/Jahreszahl ausgewählt, ohne redaktionelle Jahreslisten.
Jahr 0 und vorchristliche Jahre sind nicht Bestandteil dieses Bereichs.
Länder verwenden ISO-3166-1-alpha-2-Codes; die Nutzerentscheidung beschränkt
`app/lib/countries.ts` auf 193 UN-Mitgliedstaaten. Deutsche Namen stammen aus
`Intl.DisplayNames`. Quelle: https://www.un.org/about-us/member-states.
`CountrySelect` ist eine gemeinsame suchbare, tastaturbedienbare UI-Komponente.
Territorien und UN-Beobachterstaaten gehören nicht zur Liste.

Jahr und Land werden binär exakt gegen die kanonische Antwort bewertet: 1 oder 0
Basispunkte. Freie Antworten übernehmen den bestehenden normalisierten Vergleich
gegen Hauptlösung und interne Varianten; abweichende Texte bleiben zur manuellen
Prüfung. Sichtbare Optionen ergeben `SINGLE_CHOICE` mit genau einer richtigen
Option. Varianten und sichtbare Optionen werden nie vermischt; die Teilnehmer
bekommen weder Lösung noch Varianten im ausführbaren Antwortcontract.
Autosave, Revisionen, Reload, Submission und manuelle Bewertung nutzen die
bestehenden Services unverändert.

## Präsentation

`FactsPresentation` zeigt dieselbe gespeicherte Faktenreihenfolge nummeriert.
Bei hoher Dichte nutzt sie zwei Spalten in zeilenweiser Lesereihenfolge und passt
die Schrift an den vorhandenen Präsentationsraum an. Lösungen verwenden weiterhin
den zentralen Runtime-Helper; Länder erscheinen dabei mit deutschem Namen.
Interne Freitextvarianten werden nicht als Lösungsliste präsentiert.

## Regression und Abnahme

`factsTemplate.test.ts` prüft 2/7 Fakten, ungültige Anzahlen, Leerwerte, doppelte IDs,
300/301 Zeichen, Reihenfolge/JSON-Reload, Jahresgrenzen, Länderbasis, gemeinsame
Payload-Rückwandlung, exakte Bewertung und Trennung von Varianten/Optionen.
Zusätzlich gelten Template-Contract-, Interaction-, Evaluation- und
Präsentationsregressionen aus `npm test`, Typecheck, Changed-file ESLint und Build.
Die Browser-Abnahme muss reale Frageanlage, Quizzuordnung, Öffnen/Schließen,
Absenden, Reload, Moderation und Ergebnisse auf Preview prüfen.

## Zusätzlicher Länderauftrag

Im statischen Register und in der abgefragten Development-Datenbank sind keine
Flaggen-/Länderumrissvorlagen vorhanden. Deren konkrete Identifikation auf Preview
ist vom Nutzer angefragt. Bis dahin wird keine fragetext- oder namensbasierte
Heuristik eingebaut und kein neues Flaggen-/Umrisstemplate erfunden.
