# Moderationsmodus

## Ziel

Der Moderationsmodus ist das zentrale Steuerungswerkzeug für die Durchführung eines PubQuiz. Er dient als Bedienoberfläche für den Moderator und steuert sowohl die Präsentation als auch den Status des Quiz.

## Hauptaufgaben

- Navigation durch alle Slides
- Steuerung der Präsentation
- Freigabe und Schließen von Fragenblöcken
- Countdown-Steuerung
- Medien- und Audiosteuerung
- Öffnen der Auswertung
- Live-Überwachung des Quizfortschritts

---

# Aufbau

```
ModerationClient
│
├── CurrentSlidePanel
├── ModerationSidebar
├── ModerationToolbar
├── SlideNotes
└── AuswertungOverlay
```

Der `ModerationClient` übernimmt die Orchestrierung aller Komponenten. Die eigentliche Darstellung befindet sich in eigenständigen Komponenten.

---

# Komponenten

## ModerationClient

Verantwortlich für:

- Laden des Quizstatus
- Navigation zwischen Slides
- Verwaltung des aktuellen Zustands
- Kommunikation mit den Server Actions
- Zusammensetzen der Oberfläche

---

## CurrentSlidePanel

Anzeige des aktuell präsentierten Slides.

Enthält:

- Slide-Nummer
- Titel
- Vorschau des aktuellen Slides

Verwendet intern:

- SlidePreview

---

## ModerationSidebar

Informationsbereich für den Moderator.

Enthält:

- nächste Präsentationsfolie
- Teamstatus
- Zeitinformationen
- Quizfortschritt
- Hotkey-Übersicht

---

## ModerationToolbar

Zentrale Steuerleiste.

Funktionen:

### Navigation

- Erste Folie
- Zurück
- Weiter

### Quizsteuerung

- Block freigeben
- Block schließen

### Medien

- Bild ein-/ausblenden
- Audio starten/pausieren

### Countdown

- Dauer einstellen
- Start
- Reset

### Schätzfrage

- Start
- Lösung anzeigen
- Zur Endstandsanzeige zurückkehren

### Sonstiges

- Auswertung öffnen
- Quiz beenden

---

## SlideNotes

Anzeige der Moderationsnotizen der aktuellen Frage.

---

## PresentationPreview

Vorschau der nächsten Folie.

---

## TeamStatusPanel

Liveinformationen:

- angemeldete Teams
- eingegangene Antworten
- Antwortquote

---

## TimePanel

Anzeige von

- Dauer der aktuellen Folie
- Gesamtdauer des Quiz

---

## ProgressPanel

Visualisierung des Quizfortschritts.

---

## AuswertungOverlay

Dialog nach Ablauf einer Frage.

Funktionen:

- Hinweis, dass Antworten eingefroren wurden
- Öffnen der Auswertung
- Vollbild-Auswertung per IFrame

---

# Hooks

## useModerationHotkeys

Verarbeitet sämtliche Tastaturkürzel.

Unterstützt u.a.:

- ← →
- Leertaste
- PageUp/PageDown
- F
- B
- S
- M
- I
- A

---

# Architekturprinzipien

- Darstellung und Logik sind getrennt.
- Komponenten besitzen jeweils genau eine Verantwortung.
- Der ModerationClient dient ausschließlich als Orchestrator.
- Wiederverwendbare UI-Elemente befinden sich im Ordner `components`.
- Wiederverwendbare Logik befindet sich im Ordner `hooks`.

---

# Geplante Erweiterungen

## Kurzfristig

- Header im Moderationsmodus ausblenden
- Dokumentation vervollständigen

## Mittelfristig

- Fernbedienung für den Moderator
- Konfigurierbare Hotkeys
- Moderationsmodus auf Tablet
- Mehrere Moderatoren

## Langfristig

- Moderator-App
- Stream Deck Unterstützung
- Presenter Remote
- Sprachsteuerung
