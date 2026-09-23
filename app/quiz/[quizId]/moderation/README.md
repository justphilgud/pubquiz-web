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
- Persistente Auswahl und Review abgeschlossener Meme-Einreichungen

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

- den gemeinsamen `PresentationSlideRenderer` im stummen Vorschaumodus

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

## MemeModerationReview

Nach dem serverseitigen Ende einer Meme-Antwortphase öffnet die Moderationsseite
die genau einmal erzeugte, persistierte Auswahl. Die Komponente verwendet den
gemeinsamen `MemeRenderer`, zeigt keine Teamnamen und erlaubt ausschließlich
„Freigeben“ oder „Ausschließen“. Ein Ausschluss zieht keinen Ersatzkandidaten
nach. Der Reviewabschluss verlangt vollständige Entscheidungen und mindestens
einen freigegebenen Kandidaten; eine leere Einreichungsmenge kann explizit
übersprungen werden. Optimistische Kandidaten- und Auswahlrevisionen verhindern
stille Überschreibungen zwischen mehreren Moderatoren.

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
