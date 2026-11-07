# Matching-Editor: optische Überarbeitung

Basis: PR #158, `6915ec447bde62a8b7d2a63efb53633c8edb44fd`.
Separater Arbeitsstand; keine Änderung der freigegebenen Release-Branch.

## Ergebnis

- Einstellungen, Bereichsauswahl und Tabellenzeilen sind getrennt gegliedert.
- Die vorhandene Icon-Lupe ist 44 × 44 px groß und bündig in die Medienauswahl integriert.
- Aktive individuelle Zuordnungen sind gelb markiert; Pink kennzeichnet Auswahlaktionen.
- Auf kleinen Bildschirmen stehen die Felder einer Kugel untereinander.
- Speicherstatus, Fehler und Konflikte stehen in der sichtbaren unteren Aktionsleiste.
- „Fragevorlage“ ist eine durchsuchbare Einzelauswahl mit tatsächlichen Vorlagennamen.
  Der frühere Stand hatte dort ein Freitextfeld, keine befüllte Dropdownbox.

## Ansichten

Diese Bilder zeigen die tatsächlichen React-Komponenten mit den bestehenden globalen
Styles, der Phil-Gud-Schrift und dem neuen lokalen CSS. Die Oberfläche ist für die
Prüfung mit synthetischen Beispieldaten und simulierten Serveraktionen gebündelt.
Der globale AppHeader ist in dieser isolierten Komponentenprüfung nicht montiert.
Die Bilder sind keine gehostete Preview oder Production-Aufnahmen.

| Ansicht | Bild |
| --- | --- |
| Desktop 1366 × 768 | [Editor](./editor-1366.png) |
| Desktop 1280 × 720 | [Editor](./editor-1280.png) |
| Mobil 390 × 844 | [Einstellungen](./editor-390.png) · [Zuordnungen](./rows-mobile.png) |
| Zuordnungen im Desktop-Scrollzustand | [Tabelle](./rows-desktop.png) |
| Vorlagensuche | [Dialog](./template-picker.png) |

## Prüfungen

- Typecheck und strikter ESLint der geänderten TypeScript-Dateien.
- Production-Build erfolgreich mit synthetischen CI-Prozessvariablen und lokalem
  Datenbankziel; keine echte Datenbank verbunden.
- `test:bingo-preparation`: 31 Tests einschließlich neuer Vorlagen- und Browserregression.
- `test:bingo`: 37 Tests.
- Lokaler Chromium-Komponentenablauf: alle drei Größen ohne horizontalen Überlauf,
  sichtbare Speicheraktion, Suchauswahl per Tastatur, exakter Vorlagencode an Suche,
  Escape schließt zuerst die Liste, Fokus kehrt zur Lupe zurück.
- Interpret/Titel unabhängig, Dubletten sperren Speichern, Textkopplung,
  verworfenes Abbrechen erhält Entwurf, simulierte Konfliktantwort erhält Eingaben,
  Speichern übergibt weiterhin 90 Einträge, Bereich 15–26, Sammelaktionen,
  Hinweis für 76–90 und gesperrte Runde geprüft. [Ergebnis](./local-results.json).
- Neue Serverregression verwendet simulierte Persistenz mit echter Quellenrechte-Policy:
  mehr als 200 Quellen, Vorlagen-Deduplizierung, Quellvorlagen-Priorität, Rechteentzug,
  verweigerter Spielzugriff, minimale Feldprojektion und exakter Codefilter.

Gezielte Tests sind reproduzierbar mit:

```sh
node --import tsx --test app/bingo/matching/sourceOptions.test.ts
CHROME_BIN=/path/to/chromium node --import tsx --test app/bingo/matching/MatchingTemplateSelect.browser.test.ts
```

## Dateigruppen und Architektur

- `app/bingo/[gameId]/matching/page.tsx`, `MatchingEditor.tsx`,
  `MatchingEditor.module.css`: Header, Gruppierung, mobile Zeilen und Speicherleiste.
- `SourcePicker.tsx`, `MatchingTemplateSelect.tsx`: lokale durchsuchbare Vorlagenauswahl.
- `actions.ts`, `source.server.ts`, `templateOptions.ts`: einmaliger, frisch autorisierter
  Metadatenabruf beim Dialogöffnen; Suche nach stabilem Code. Keine Mediendaten im
  Optionsabruf und kein zusätzlicher Pollingpfad.
- Zwei neue Regressionstests, Einbindung in `test:bingo-preparation`, aktualisierter
  [Fachvertrag](../../architecture/bingo-matching.md).

Bestehende gemeinsame UI-Komponenten werden benutzt, nicht geändert. Quiz, Liveplayer,
Druckrenderer, Datenmodell und Migrationen sind unverändert. Keine neue Projektabhängigkeit.

## Noch erforderliche gehostete Abnahme

1. Mit berechtigtem Konto Matching öffnen; Desktop und Mobilansicht vergleichen.
2. Lupe öffnen, tatsächliche Vorlagen auswählen und Treffer prüfen; globale und
   reihenspezifische Quellen sowie Konto ohne Quizzugriff gegenprüfen.
3. Original/Rückwärts und Interpret/Titel unabhängig zuweisen, speichern und neu laden.
4. Eine ungespeicherte Änderung abbrechen und den Abbruch verwerfen; anschließend
   einen echten Zwei-Fenster-Konflikt prüfen.

Keine echte Datenbank-, Hosting-, Upload-, Audio- oder Druckabnahme dieses Deltas.
Kein Production-Zugriff, Merge, Deployment, Session-Reset oder Änderung gespeicherter Karten.
