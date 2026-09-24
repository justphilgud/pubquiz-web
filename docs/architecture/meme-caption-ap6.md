# What the Meme! – Caption-Zonen (AP6)

## Architektur

AP6 erweitert den in AP5 eingeführten gemeinsamen `MemeRenderer`. Es gibt weiterhin
keinen zweiten Renderer für Team, Moderation, Präsentation, Voting oder Ergebnis.
`AutoFitText` misst jede Zone im Browser; `memeCaptionLayout.ts` prüft dieselbe
Geometrie vor einer finalen serverseitigen Abgabe deterministisch.

Das Autorenwerkzeug `MemeCaptionLayoutEditor` bearbeitet ausschließlich die
Fragenkonfiguration. Antwort-Lifecycle, Draft-/Final-Semantik, Reconnect und
Konfliktauflösung bleiben in der bestehenden Interaction-Schicht.

## Persistenz und Versionierung

Das Layout liegt additiv in `fragen.template_config_json.memeCaptionLayout`:

```json
{
  "version": 1,
  "mode": "CUSTOM",
  "zones": [
    {
      "id": "bubble",
      "label": "Sprechblase",
      "placement": "IMAGE",
      "x": 52,
      "y": 6,
      "width": 40,
      "height": 30,
      "order": 1,
      "maxLines": 2,
      "required": true
    }
  ]
}
```

Koordinaten und Größen sind Prozentwerte. Interne Zonen beziehen sich auf die
Bildfläche. `EXTERNAL_TOP` und `EXTERNAL_BOTTOM` bilden die beiden bestehenden
AP5-Bänder mit jeweils 21 Prozent Höhe ab.

Beim Öffnen eines Live-Runs wird das vollständig aufgelöste Layout Bestandteil
von `quiz_interaction_runs.config_snapshot.interaction`. Änderungen an der Frage
wirken deshalb nicht rückwirkend auf laufende oder historische Antworten. Die
bestehende Fragenkopie kopiert `template_config_json` und damit die Zonen.

Eine Datenbankmigration ist nicht erforderlich: Fragenkonfiguration und
Interaktions-Snapshot waren bereits strukturierte, versionierte JSON-Felder.

## Kompatibilität

- Ohne Layoutkonfiguration wird immer `STANDARD` mit `top` und `bottom` aufgelöst.
- Legacy-Antworten `{ "topText": "…", "bottomText": "…" }` bleiben lesbar und
  werden im Standardmodus weiterhin in exakt diesem Format gespeichert.
- Benutzerdefinierte Layouts speichern `{ "captions": { "zone-id": "…" } }`.
- Ein bis vier Zonen sind zulässig. IDs und Reihenfolgen müssen eindeutig sein.
- Fremde Zone-IDs, fehlende Pflichtzonen und unlesbare Texte werden serverseitig
  abgewiesen.

## Autor- und Teamoberfläche

Der Autor kann zwischen Standard und benutzerdefinierten Zonen wechseln. Interne
Zonen lassen sich per Maus oder Touch verschieben und skalieren. Prozentfelder und
acht Presets stellen die Bedienung ohne Drag & Drop sicher. Starke Überlappung
erzeugt eine Warnung; ungültige Geometrie blockiert das Speichern.

Teams sehen nur die geordneten, vom Autor benannten Textfelder sowie die lokale
Live-Vorschau. Farbe, Schrift, Größe, Position und Zonenanzahl sind nicht durch
Teams veränderbar.

## Grenzen V1

- maximal vier Zonen und maximal drei Zeilen je Zone
- höchstens je ein externer oberer und unterer Bereich
- ein gemeinsamer, kontrastreicher Overlay-Stil für interne Zonen
- keine freie Typografie- oder Farbauswahl
