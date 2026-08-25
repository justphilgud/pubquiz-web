# Teamverwaltung

Die Teamverwaltung unter `/admin/teams` dient vor allem der schnellen Zugangshilfe vor Ort. Teamnamen lassen sich suchen und nach Status oder Eventreihe filtern. Die Detailseite zeigt Teilnahmen, letzte Aktivität und die im jeweiligen Berechtigungsscope sichtbaren Eventreihen.

## Zugangswort helfen

Das Zugangswort ist zunächst verdeckt. `Passwort anzeigen` lädt es erst nach einer erneuten serverseitigen Berechtigungsprüfung. Berechtigte Nutzer können ein neues Wort manuell setzen oder ein zufälliges Wort aus der vorhandenen Team-Wortliste erzeugen. Das neue Wort gilt sofort; das vorherige funktioniert danach nicht mehr.

## Rollen

- Administratoren verwalten alle Teams global, einschließlich Archivierung und Löschung.
- Eventmanager sehen nur Teams, die in einer ihrer zugewiesenen Eventreihen teilgenommen haben. Sie dürfen deren Zugangswort anzeigen oder ändern, aber die globale Identität weder archivieren noch löschen.
- Editoren erhalten keine Teamverwaltungsrechte.

## Foto, Avatar und Upload-Sperre

Das Teamprofil ist global: Foto, Avatar und Upload-Sperre gelten in allen Eventreihen. Administratoren können Foto und Avatar ändern, das Foto entfernen sowie Uploads sperren oder wieder freigeben. Eventmanager können innerhalb ihres Eventreihen-Scopes ausschließlich ein vorhandenes Foto entfernen und die Upload-Sperre ändern. Sie können weder ein Foto hochladen noch einen Avatar auswählen. Editoren erhalten keine Profilaktionen.

Die Sperre verhindert neue Foto-Uploads durch das Team. Die Auswahl eines Systemavatars bleibt möglich. Beim Entfernen eines Fotos fällt die Darstellung sofort auf den gespeicherten oder stabil aus der Team-ID abgeleiteten Avatar zurück.

## Archivieren und Löschen

Archivieren erhält sämtliche Historie und ist bei nicht mehr aktiven Teams die bevorzugte Aktion. Archivierte Teams bleiben auffindbar und können durch Administratoren reaktiviert werden.

Nur Teams ohne Quizteilnahme lassen sich normal löschen. Für ein Team mit Historie gibt es ausschließlich für Administratoren die getrennte Aktion `Team endgültig löschen`. Sie verlangt den exakten Teamnamen und entfernt Sessions, Antworten, Bewertungen, Punkte und Quizzuordnungen. Diese Aktion ist nicht rückgängig zu machen.
