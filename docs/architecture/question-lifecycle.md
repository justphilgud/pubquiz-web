# Question Lifecycle

## Zweck
Dieses Dokument beschreibt den fachlichen Lebenszyklus einer Quizfrage in „ungegoogelt“.

## Leitprinzipien
- Fragen können schnell als Entwurf gespeichert werden.
- Editoren dürfen Fragen erfassen, aber nicht automatisch veröffentlichen.
- Freigaben werden über Berechtigungen gesteuert, nicht über fest codierte Rollen.
- Eine spätere Rolle „Redakteur“ muss ohne grundlegenden Umbau ergänzt werden können.
- Nutzer sehen nur sinnvolle Aktionen für Status und Fähigkeiten.

## Status
### DRAFT
Unvollständig oder bewusst als Entwurf gespeichert. Reduzierte Validierung, nicht für Quizverwendung freigegeben.

### IN_REVIEW
Zur Prüfung eingereicht. Vollständige fachliche Validierung erforderlich.

### CHANGES_REQUESTED
Änderungen wurden angefordert. Rückmeldung an Ersteller oder Bearbeiter erforderlich.

### APPROVED
Fachlich freigegeben und für Quizverwendung zugelassen.

### OUTDATED
Fachlich oder zeitlich nicht mehr aktuell. Bleibt suchbar und bewusst verwendbar, wird aber nicht automatisch vorgeschlagen.

### ARCHIVED
Im normalen Arbeitsbestand ausgeblendet, aber weiterhin gespeichert und reaktivierbar.

## Übergänge
- DRAFT → DRAFT: Entwurf speichern
- DRAFT → IN_REVIEW: Zur Prüfung einreichen
- IN_REVIEW → CHANGES_REQUESTED: Änderungen anfordern
- CHANGES_REQUESTED → IN_REVIEW: Erneut einreichen
- IN_REVIEW → APPROVED: Freigeben
- DRAFT → APPROVED: Direkte Freigabe durch berechtigte Nutzer
- APPROVED → OUTDATED: Ablaufdatum oder manuelle Veraltung
- DRAFT / CHANGES_REQUESTED / APPROVED / OUTDATED → ARCHIVED
- ARCHIVED → DRAFT oder OUTDATED: Reaktivieren

## Fähigkeiten
Beispielhafte Berechtigungen:
- QUESTION_CREATE
- QUESTION_EDIT_OWN
- QUESTION_EDIT_ALL
- QUESTION_SUBMIT_FOR_REVIEW
- QUESTION_REQUEST_CHANGES
- QUESTION_APPROVE
- QUESTION_ARCHIVE
- QUESTION_REACTIVATE
- QUESTION_USE_IN_QUIZ
- QUESTION_TEMPLATE_CREATE

## Rollenbeispiele
### Editor
- Fragen erstellen und eigene bearbeiten
- Entwürfe speichern
- zur Prüfung einreichen
- bestehende Kategorien auswählen
- keine Freigabe
- keine Template-Erstellung

### Admin
- alle Fragen bearbeiten
- freigeben und Änderungen anfordern
- Kategorien verwalten
- Templates erstellen
- archivieren und reaktivieren

### Redakteur – später
- fachlich prüfen
- Änderungen anfordern
- freigeben
- optional Templates erstellen

## Sichtbare Aktionen
### Editor
- Entwurf speichern
- Zur Prüfung einreichen

### Admin oder Redakteur
- Entwurf speichern
- Freigeben
- Änderungen anfordern
- optional „Aus dieser Frage eine Vorlage erstellen“

Keine universelle Statusauswahl im Formular.

## Validierung
### Entwurf speichern
- irgendein sinnvoller Inhalt
- technische Grenzen eingehalten

### Zur Prüfung einreichen
- Fragetext vorhanden
- mindestens eine richtige Antwort
- Template-Pflichtfelder erfüllt
- erforderliche Medien vorhanden
- Ablaufdatum vollständig, sofern aktiviert

### Freigeben
- vollständige fachliche Prüfung
- keine offenen Rückmeldungen
- alle Pflichtbereiche vollständig

## Outdated-Logik
Ab dem Tag nach „gültig bis“ gilt die Frage als veraltet:
- bleibt gespeichert
- bleibt suchbar
- wird nicht automatisch vorgeschlagen
- kann bewusst weiterhin verwendet werden

## Offene Entscheidungen
- Müssen freigegebene Fragen nach fachlichen Änderungen erneut geprüft werden?
- Darf ein Editor eine eingereichte Frage noch direkt bearbeiten?
- Soll OUTDATED gespeichert oder aus dem Datum abgeleitet werden?
- Brauchen Reviewer feldbezogene Kommentare?
