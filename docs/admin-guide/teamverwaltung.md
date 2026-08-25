# Teamverwaltung

Die Teamverwaltung unter `/admin/teams` dient vor allem der schnellen Zugangshilfe vor Ort. Teamnamen lassen sich suchen und nach Status oder Eventreihe filtern. Die Detailseite zeigt Teilnahmen, letzte Aktivität und die im jeweiligen Berechtigungsscope sichtbaren Eventreihen.

## Zugangswort helfen

Das Zugangswort ist zunächst verdeckt. `Passwort anzeigen` lädt es erst nach einer erneuten serverseitigen Berechtigungsprüfung. Berechtigte Nutzer können ein neues Wort manuell setzen oder ein zufälliges Wort aus der vorhandenen Team-Wortliste erzeugen. Das neue Wort gilt sofort; das vorherige funktioniert danach nicht mehr.

## Rollen

- Administratoren verwalten alle Teams global, einschließlich Archivierung und Löschung.
- Eventmanager sehen nur Teams, die in einer ihrer zugewiesenen Eventreihen teilgenommen haben. Sie dürfen deren Zugangswort anzeigen oder ändern, aber die globale Identität weder archivieren noch löschen.
- Editoren erhalten keine Teamverwaltungsrechte.

## Archivieren und Löschen

Archivieren erhält sämtliche Historie und ist bei nicht mehr aktiven Teams die bevorzugte Aktion. Archivierte Teams bleiben auffindbar und können durch Administratoren reaktiviert werden.

Nur Teams ohne Quizteilnahme lassen sich normal löschen. Für ein Team mit Historie gibt es ausschließlich für Administratoren die getrennte Aktion `Team endgültig löschen`. Sie verlangt den exakten Teamnamen und entfernt Sessions, Antworten, Bewertungen, Punkte und Quizzuordnungen. Diese Aktion ist nicht rückgängig zu machen.
