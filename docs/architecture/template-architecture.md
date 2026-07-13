# Template Architecture

## Zweck
Templates beschleunigen wiederkehrende Fragentypen wie FaceMorph, Musik rückwärts oder Pixelbild.

## Abgrenzung
- Template: Struktur, Standardtexte und benötigte Elemente
- Frage: konkrete Inhalte, Antworten, Medien und Notizen
- Quizverwendung: Reihenfolge, A/B/C/D und offen/geschlossen

## Einstieg
Beim Anlegen einer neuen Frage entscheidet der Nutzer zuerst:
- Ohne Vorlage starten
- Vorlage auswählen

Empfohlene UX:
- „Ohne Vorlage starten“ klar sichtbar
- häufige Templates direkt erreichbar
- weitere Templates über Suche
- nach Auswahl kompakte Anzeige „Vorlage: FaceMorph · Ändern“
- Warnung bei Template-Wechsel nach bereits erfolgter Eingabe

## Was ein Template speichert
- ID
- Name
- Beschreibung
- aktiv/archiviert
- Standard-Fragetext
- vorgesehene Antwortfelder
- fachliche Feldbezeichnungen
- Standardmarkierung als richtige Antwort
- benötigte Medien-Slots
- Pflichtfelder
- Hilfetexte
- optionale Standard-Moderationshinweise

## Was ein Template nicht speichert
- konkrete Antworttexte
- konkrete Medien
- konkrete Zusatzinformationen
- konkrete Quellen
- konkrete Moderationsnotizen
- Quizreihenfolge
- A/B/C/D-Kennzeichnung
- Freigabestatus der Ursprungsfrage

Kategorien werden zunächst nicht automatisch übernommen.

## Template aus einer Frage erstellen
Berechtigte Nutzer können beim Speichern oder Prüfen wählen:
„Aus dieser Frage eine Vorlage erstellen“

Danach:
- Template-Name
- optionale Beschreibung
- transparente Bestätigung der übernommenen Struktur

Übernommen:
- Fragetext
- Antwortstruktur
- Feldbezeichnungen
- Medien-Slots
- Pflichtfelder

Nicht übernommen:
- konkrete Antworten
- konkrete Medien
- konkrete Zusatzinformationen
- fragebezogene Notizen

Frage und Template bleiben getrennte Objekte.

## Berechtigungen
- QUESTION_TEMPLATE_USE
- QUESTION_TEMPLATE_CREATE
- QUESTION_TEMPLATE_EDIT
- QUESTION_TEMPLATE_ARCHIVE

Editor:
- verwenden, aber nicht erstellen

Admin:
- verwenden, erstellen, bearbeiten, archivieren

Redakteur – später:
- optional fachlich erstellen und pflegen

## Template-Editor
Eigener späterer Funktionsbereich:
- Name und Beschreibung
- Standard-Fragetext
- Antwortfelder
- Feldlabels
- richtige Antwortfelder
- Medien-Slots
- Pflichtfelder
- Vorschau
- aktivieren/archivieren
- duplizieren

Nicht Bestandteil der ersten Editor-Version.

## Versionierung
Template-Änderungen dürfen bestehende Fragen nicht rückwirkend verändern.
Beim Anwenden wird die Struktur in den Fragen-Draft kopiert.
Optionale spätere Referenz:
- sourceTemplateId
- sourceTemplateVersion

## Offene Entscheidungen
- Darf ein Template Standardkategorien enthalten?
- Brauchen Templates eine Vorschau?
- Muss ein neues Template selbst freigegeben werden?
- Soll ein Template aus einer bereits freigegebenen Frage erstellt werden können?
