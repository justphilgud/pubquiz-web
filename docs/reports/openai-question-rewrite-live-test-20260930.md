# OpenAI-Formulierungshilfe: isolierter Echttest am 30.09.2026

## Testvertrag

- Kette: Testfrage → produktiver Endpoint-Handler → produktiver OpenAI-Provider
  → OpenAI Responses API → Structured Output → serverseitige Validierung
- Modell: `gpt-5.6-luna`
- Speicherung: `store: false`
- Datenbankzugriff: keiner
- Übertragene Fachdaten: ausschließlich der Fragetext
- Preismodell: 0,20 USD je 1 Mio. Input-Tokens und 1,20 USD je 1 Mio.
  Output-Tokens laut
  [offizieller Modellseite](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- Structured Output: striktes JSON-Schema mit genau `proposal: string`, gemäß
  [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

## Promptiteration

Runde 1 und 2 lieferten jeweils 19/20 gültige Ergebnisse. Der Wortspielfall
`Katerstimmung` wurde reproduzierbar durch die bestehende Fail-Closed-Prüfung
abgewiesen. Das Modell hatte Anlass, ein zuvor unzitiertes Wort typografisch zu
zitieren; hinzugefügte oder entfernte Zitate sind bewusst nicht erlaubt.

Die einzige Promptänderung vor Runde 3 lautete sinngemäß: keine
Anführungszeichen hinzufügen, entfernen oder ersetzen. Die deterministische
Zitatprüfung blieb unverändert streng. Runde 3 war anschließend mit 20/20
Ergebnissen technisch und redaktionell erfolgreich.

## Finale Qualitätsauswertung (Runde 3)

| Original | OpenAI-Vorschlag | technisch gültig | Zahlen/Eigennamen erhalten | Bedeutungsänderung | Bewertung |
|---|---|---:|---:|---:|---|
| Wer war Mozart? | Wer war Mozart? | Ja | Ja | Nein | gut |
| Welche Stadt ist es, die als Hauptstadt von Frankreich gilt und zugleich an dem Fluss Seine gelegen ist? | Welche Stadt ist die Hauptstadt Frankreichs und liegt an der Seine? | Ja | Ja | Nein | gut |
| Wie heißt denn eigentlich das Land, wo die Hauptstadt davon Ottawa ist? | Wie heißt das Land, dessen Hauptstadt Ottawa ist? | Ja | Ja | Nein | gut |
| Wie heißt die Hauptstadt von Japan? | Wie heißt die Hauptstadt von Japan? | Ja | Ja | Nein | gut |
| In welchem Jahr fiel die Berliner Mauer? | In welchem Jahr fiel die Berliner Mauer? | Ja | Ja | Nein | gut |
| Wie viele Minuten dauern 2 Stunden und 30 Minuten? | Wie viele Minuten sind 2 Stunden und 30 Minuten? | Ja | Ja | Nein | gut |
| Welches Werk schrieb Johann Wolfgang von Goethe? | Welches Werk schrieb Johann Wolfgang von Goethe? | Ja | Ja | Nein | gut |
| In welcher Stadt trafen sich John Lennon und Paul McCartney erstmals? | In welcher Stadt trafen sich John Lennon und Paul McCartney zum ersten Mal? | Ja | Ja | Nein | gut |
| Durch welche Stadt fließt die Seine? | Durch welche Stadt fließt die Seine? | Ja | Ja | Nein | gut |
| Welches Unternehmen gründete Ingvar Kamprad? | Welches Unternehmen gründete Ingvar Kamprad? | Ja | Ja | Nein | gut |
| Wer sagte „Ich denke, also bin ich“? | Wer sagte „Ich denke, also bin ich“? | Ja | Ja | Nein | gut |
| Welcher Planet ist der Sonne am nächsten (benannt nach einem römischen Gott)? | Welcher Planet ist der Sonne am nächsten (benannt nach einem römischen Gott)? | Ja | Ja | Nein | gut |
| Welche Insel ist die größte der Erde, wenn Australien als Kontinent gezählt wird? | Welche Insel ist die größte der Erde, wenn Australien als Kontinent gilt? | Ja | Ja | Nein | gut |
| Wie heißt der Prozess, bei dem Pflanzen Lichtenergie in chemische Energie umwandeln? | Wie heißt der Prozess, bei dem Pflanzen Lichtenergie in chemische Energie umwandeln? | Ja | Ja | Nein | gut |
| Welches Tier steckt im Wort Katerstimmung? | Welches Tier steckt im Wort Katerstimmung? | Ja | Ja | Nein | gut |
| Welche rote Frucht, die oft für Ketchup verwendet wird, gehört botanisch zu den Beeren? | Welche rote Frucht, die häufig für Ketchup verwendet wird, gehört botanisch zu den Beeren? | Ja | Ja | Nein | gut |
| Welches chemische Element trägt das Symbol W? | Welches chemische Element trägt das Symbol W? | Ja | Ja | Nein | gut |
| Wer malte die Mona Lisa? | Wer malte die Mona Lisa? | Ja | Ja | Nein | gut |
| Wie heißt der Roman, den George Orwell im Jahr 1949 veröffentlichte und dessen Titel aus einer umgestellten Jahreszahl besteht? | Wie heißt der Roman, den George Orwell 1949 veröffentlichte und dessen Titel aus einer umgestellten Jahreszahl besteht? | Ja | Ja | Nein | gut |
| Welcher Physiker formulierte 1905 die spezielle Relativitätstheorie und erhielt 1921 den Nobelpreis für Physik? | Welcher Physiker formulierte 1905 die spezielle Relativitätstheorie und erhielt 1921 den Nobelpreis für Physik? | Ja | Ja | Nein | gut |

Qualitätsmarkierungen in der finalen Runde:

- Fakten hinzugefügt: 0
- Fakten entfernt: 0
- Zahl verändert: 0
- Eigenname verändert: 0
- Zitat verändert: 0
- Bedeutung verändert: 0
- Schwierigkeit verändert: 0
- unbeabsichtigter Lösungshinweis: 0
- unnötige Umformulierung einer bereits guten Frage: 0
- gut: 20
- brauchbar mit Anpassung: 0
- nicht brauchbar: 0

## Performance und Kosten

| Kennzahl | Runde 1 | Runde 2 | Runde 3 (final) | Gesamt |
|---|---:|---:|---:|---:|
| API-Aufrufe | 20 | 20 | 20 | 60 |
| erfolgreiche Endpoint-Ergebnisse | 19 | 19 | 20 | 58 |
| fail-closed abgewiesen | 1 | 1 | 0 | 2 |
| bekannte Input-Tokens | 3.919 | 3.919 | 4.562 | 12.400 |
| bekannte Output-Tokens | 503 | 507 | 528 | 1.538 |
| bekannte Gesamttokens | 4.422 | 4.426 | 5.090 | 13.938 |
| mittlere Latenz | 2.306 ms | 1.271 ms | 1.126 ms | 1.568 ms |
| langsamster Aufruf | 8.849 ms | 2.111 ms | 1.532 ms | 8.849 ms |
| bekannte Kosten | 0,001387 USD | 0,001392 USD | 0,001546 USD | 0,004326 USD |

Bei den zwei vom Endpoint abgewiesenen Providerantworten wurde Usage absichtlich
nicht an den Client weitergegeben. Selbst mit dem konservativen Skriptmaximum
von 1.000 Input- und 220 Output-Tokens je abgewiesenem Aufruf betragen die
Gesamtkosten höchstens 0,005254 USD.

Auf Basis der finalen Runde:

- Kosten je Umformulierung: 0,0000773 USD
- 100 Umformulierungen: etwa 0,00773 USD
- 1.000 Umformulierungen: etwa 0,07730 USD

## Ergebnis

Die finale Konfiguration erfüllt den Testvertrag. Structured Output,
serverseitige Schema- und Literalvalidierung sowie das Fail-Closed-Verhalten
arbeiten zusammen. Kein Vorschlag wurde gespeichert oder in eine Datenbank
geschrieben.
