# Media Concept for Questions

## Zweck
Medien unterstützen Fragentypen und Auflösungen. Vorgesehen sind Bild, Audio und Video.

## Leitprinzipien
- Kein zentraler Medien-Sammelbereich
- Fragenmedien direkt beim Fragetext
- Antwortmedien direkt bei der Antwort
- Templates können Medien-Slots vorgeben
- Mobile Nutzung berücksichtigt Kamera, Galerie und Dateiauswahl
- Upload, Vorschau, Ersetzen und Entfernen müssen klar sein

## Medien-Slots
### Question Media Slot
Beispiele:
- FaceMorph-Bild
- rückwärts abgespielte Audiodatei
- Videoausschnitt
- Pixelbild

### Answer Media Slot
Beispiele:
- Bild einer Person
- Flagge eines Landes
- Albumcover
- Auflösungsbild

## Template-gesteuerte Medien
Ein Template kann definieren:
- Medium erforderlich oder optional
- erlaubte Medientypen
- Ziel: Frage oder Antwort
- Hilfetext
- Anzahl erlaubter Medien

## Mobile UX
Bild:
- Kamera
- Galerie
- Datei auswählen

Audio:
- vorhandene Datei
- später optional Aufnahme

Video:
- Galerie
- Datei auswählen
- später optional Kamera

Nach Auswahl:
- Vorschau
- Uploadstatus
- Ersetzen
- Entfernen
- Fehler direkt am Slot

## Desktop UX
- Drag & Drop
- Dateiauswahl
- Einfügen aus Zwischenablage bei Bildern
- Uploadfortschritt

## Validierung
- erlaubter Dateityp
- maximale Größe
- erforderliches Medium vorhanden
- Upload erfolgreich
- eindeutige Zuordnung
- keine verwaisten Uploads

## Sichtbarkeit
Medien können später sichtbar sein:
- während der Frage
- erst während der Auflösung
- nur in Moderationsansicht

## Performance
- keine unnötig großen Originaldateien ausliefern
- Vorschaubilder verwenden
- Audio/Video nicht unnötig vorladen
- mobile Datenverbindungen berücksichtigen

## Vorerst nicht
- eigene Medienbibliothek
- Bildbearbeitung
- Audioaufnahme
- Transcoding
- KI-generierte Medien
- komplexe Lizenzverwaltung
- Medienversionierung

## Offene Entscheidungen
- aktueller Speicherort
- maximale Dateigrößen
- mehrere Medien pro Frage oder Antwort
- Reihenfolge von Medien
- Auflösungsmedien
- unterstützte Formate in Präsentation und Moderation
