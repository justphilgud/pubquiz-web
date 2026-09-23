# Mobile PWA für Fragen und Quizze

## Architektur

Die installierbare App ist dieselbe Next.js-Anwendung wie die Desktopansicht. Es
gibt keinen zweiten mobilen Client, kein eigenes Backend und keine duplizierte
Fachlogik. `app/manifest.ts` beschreibt Name, Start-URL, Farben und die beiden
aus demselben Gudi-Motiv erzeugten App-Icons. Production verwendet den Namen
`PubQuiz` und das pinke Icon. Vercel Preview verwendet den Namen
`PubQuiz Preview` und ein cyanblaues Icon. Die Trennung wird ausschließlich aus
`VERCEL_ENV` abgeleitet; je Deployment existiert weiterhin genau ein Manifest
und eine installierbare App. Die bestehende Startseite stellt
abhängig von den vorhandenen Berechtigungen die Einstiege in Fragen und Quizze
bereit.

Der erste mobile Umfang umfasst:

- Fragen suchen, anlegen und bearbeiten;
- Vorlagen, Kategorien, Medien, Sponsorinformationen und den vorhandenen
  Speicher- und Freigabeworkflow;
- Quizze suchen, anlegen und bearbeiten;
- Quizfragen hinzufügen, entfernen, konfigurieren und sortieren.

Drag-and-drop bleibt erhalten. Für Touchgeräte stehen an Fragen zusätzlich
44-Pixel-Schaltflächen zum schrittweisen Verschieben bereit. Beide Wege rufen
dieselben Serveraktionen und dieselbe persistierte Elementsequenz auf.

## Sicherheit und Berechtigungen

Die PWA öffnet die vorhandenen Routen. Session, direkte URL-Aufrufe,
Rollenprüfung, Mandanten- beziehungsweise Eventreihen-Scope und Freigabestatus
werden weiterhin serverseitig geprüft. Das Manifest eröffnet keinen neuen
Zugriffspfad. Eine Installation speichert keine zusätzlichen fachlichen Daten
auf dem Gerät.

## Online-Verhalten und Updates

Die Anwendung ist bewusst onlinepflichtig. Für diesen Umfang wird kein Service
Worker registriert: Es gibt keinen Offline-Cache, keine Hintergrundsynchronisation
und keine Push-Nachrichten. Neue Versionen werden deshalb wie bisher beim Laden
vom Server bezogen; es existiert kein zweiter Updatekanal.

Moderation und Präsentationssteuerung gehören nicht zum ersten mobilen Umfang.
Ihre bestehenden Webrouten und Berechtigungen werden durch die PWA-Arbeit nicht
verändert.

## Technische Eckdaten

- Manifest: `/manifest.webmanifest`
- Start-URL und Scope: `/`
- Anzeige: `standalone`
- Theme- und Hintergrundfarbe: Schwarz
- Production-Icons: `/pwa/icon-192.png` und `/pwa/icon-512.png`
- Preview-Icons: `/pwa/preview-icon-192.png` und
  `/pwa/preview-icon-512.png`
- Die jeweils aktiven Icons werden für `any` und `maskable` mit demselben Motiv
  ausgewiesen
- Datenbank- oder Schemaveränderung: keine
