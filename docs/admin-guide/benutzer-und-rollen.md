# Benutzer, Eventarten und Rollen

Administratoren verwalten Konten, globale Rollen, Eventartrechte und
Produktfreischaltungen. Alle anderen Rollen erhalten keine Benutzerverwaltung.
Die technische [Berechtigungsmatrix](../architecture/role-assignments.md) ist verbindlich.

## Globale Rollen

Im Kontoformular stehen **Administrator** und **Globaler Quiz-Editor**.
Admin bleibt global zuständig. Der globale Editor darf eigene globale
Quizentwürfe/Rückgaben im bisherigen Workflow bearbeiten und erhält keine
Bingo-/Karaoke- oder Eventreihenrechte. Neue Konten können zunächst ohne Rechte
angelegt werden. Kontoänderungen überschreiben keine Matrixrechte.

## Rechte je Eventreihe und Eventart

In der Benutzerverwaltung unter **Eventartrechte** den Benutzer auswählen.
Je Eventreihe für Quiz, Bingo und PowerPoint-Karaoke **Kein Zugriff**, **Editor** oder
**Eventmanager** einstellen, anschließend **Eventartrechte speichern**.
Nicht freigeschaltete Produkte sind gekennzeichnet. Gespeicherte Rollen bleiben
wirkungslos, solange das Produkt gesperrt ist. Bingo und Karaoke sind noch keine
verfügbaren Spiele; die Zuweisung bereitet lediglich ihre Administration vor.

**Eventreihe verwalten** ist eine separate Checkbox: Stammdaten und gemeinsames
Branding, keine zusätzlichen Spielrechte, keine Benutzerverwaltung und keine
Produktfreischaltung. Neue Eventmanager erhalten sie nicht automatisch. Bisherige
Quizmanager behalten sie über die Migration. Die Benutzerliste unter der Matrix
fasst nur die wirksamen Quizrollen zusammen; alle gespeicherten Rechte stehen darüber.

## Produkte freischalten und deaktivieren

In der Eventreihe unter **Freigeschaltete Eventarten** als Admin aktivieren oder
deaktivieren. Während eines laufenden Quiz wird dessen Produktdeaktivierung
abgelehnt. Das Quiz zuerst regulär beenden; kein Reset nötig.
Bei Deaktivierung bleiben Inhalte und Rollen erhalten, ihr Zugriff wird gesperrt.
Nach erneuter Aktivierung gelten die erhaltenen Zuweisungen wieder. Andere Rollen
sehen den Produktstatus, dürfen ihn aber nicht ändern.

## Bisherige Quizregeln bleiben bestehen

Quiz-Eventmanager verwalten Quiz, Moderation, Auswertung und Teams nur in ihren
wirksamen Quizreihen. Quiz-Editoren erhalten keine Quiz-/Teamverwaltung. Die globale
Teamlöschung, Zugangswörter und globale Lifecycle-Aktionen bleiben beim Admin.
Freigegebene globale Fragen können im erlaubten Quiz verwendet werden; das globale
Original und bestehende Kopierverbote bleiben geschützt. Bearbeitung/Freigabe
mehrfach zugeordneter Reihenfragen verlangt die bisherigen Rechte in allen Reihen.
Ein Quizwechsel mit unzulässigen Fragen/Storys/Umfragen wird ohne Inhaltsänderung
abgewiesen.

Rechteentzug/Kontodeaktivierung greifen beim nächsten Serveraufruf auch mit offenem
Fenster. Bereits ausgelieferte Inhalte lassen sich nicht zurückrufen. Nach einer
Berechtigungsänderung Ansichten neu laden; die Präsentation danach lokal freigeben.
Keine bestehende Quizsession zurücksetzen.
