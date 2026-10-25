# Benutzer, Eventreihen und Rollen

## Benutzer anlegen oder bearbeiten

Als Administrator in **Benutzer** auf **Benutzer anlegen** oder beim betreffenden
Benutzer auf **Bearbeiten** klicken. Im selben Formular:

1. Kontodaten und gegebenenfalls globale Rolle einstellen. **Globaler Quiz-Editor**
   gilt nur für Quiz; **Administrator** bleibt global.
2. Unter **Rollen je Eventreihe** für jede gewünschte Reihe **Editor** oder
   **Eventmanager** wählen; **Kein Zugriff** entfernt die Reihenrolle.
3. Bei Bedarf separat **Eventreihe verwalten** erlauben: gemeinsame Stammdaten und
   Branding, keine zusätzlichen Spielrechte, Benutzerverwaltung oder Produktfreigabe.
4. Mit **Speichern** übernehmen. Auch beim Anlegen können Reihenrollen sofort
   vergeben werden. Keine zusätzliche Eventartrechte-Matrix nötig.

Eine Rolle gilt für die aktivierten Produkte der Reihe, auch bei späterer
Freischaltung. Editor pflegt Quizinhalte und künftig Bingo-Begriffe/Feldinhalte.
Für PowerPoint-Karaoke sind keine Editorfunktionen vorgesehen; Editor erhält dort
keinen Format-Zugriff. Eventmanager führen Veranstaltungen durch. Bingo und Karaoke
sind weiterhin keine spielbaren Funktionen dieser Version.

## Eventarten der Reihe

Beim Anlegen einer Eventreihe unter **Freigeschaltete Eventarten** auswählen.
Es gibt keine automatische Vorauswahl. Spätere Änderungen sind auf der Detailseite
unter demselben Titel möglich; ausschließlich Administratoren dürfen sie ändern.
Ohne Freischaltung bleibt der Format-Zugriff gesperrt, selbst bei vorhandener Rolle.

Deaktivierung erhält Inhalte, Reihenrollen und gemeinsame Verwaltung. Nach erneuter
Aktivierung gilt die bestehende Rolle wieder. Laufende Quizze müssen vor einer
Quiz-Deaktivierung regulär beendet werden; keine Session zurücksetzen.

## Bestehende Regeln und Übernahme

Quiz-Editoren pflegen Inhalte, erhalten aber keine Quiz-/Teamverwaltung. Globale
Fragen bleiben im bisherigen Freigabe-/Kopierworkflow geschützt. Mehrfach verwendete
Inhalte verlangen die bisherigen Rechte in allen betroffenen Reihen.

Die neue additive Übernahme erhält bestehende Quizrollen und individuelle Werte.
Widersprüchliche alte Preview-Formatrollen werden nicht automatisch vereinheitlicht;
in diesem Ausnahmefall stoppt die Migration mit konkreter Meldung. Es ist kein
Konflikt des neuen Formularmodells, das nur eine Rolle je Reihe zulässt.

Nach Berechtigungsänderungen geöffnete Ansichten neu laden und die Präsentation
lokal freigeben. Rechteentzug greift bereits beim nächsten Serveraufruf. Kein Reset.
Technische Details: [Rollenmodell](../architecture/role-assignments.md).
