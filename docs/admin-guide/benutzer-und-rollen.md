# Benutzer und Rollen

Administratoren können Benutzer anlegen, bearbeiten, Rollen vergeben und Passwörter zurücksetzen. Das produktive Rollenmodell umfasst Administrator, globalen oder eventreihenbezogenen Editor sowie Eventmanager einer Eventreihe.

## Teamverwaltung

- Administrator: globale Teamverwaltung, Zugangswörter, Archivieren und Löschen.
- Eventmanager: Zugangshilfe und Teamansicht ausschließlich für zugewiesene Eventreihen.
- Editor: keine Teamverwaltung.

Die Übersicht `/admin/users/roles` wird direkt aus den produktiven Authorization-Policies berechnet und zeigt diesen Team-Scope ebenfalls an.

Globale Editoren dürfen eigene globale Entwürfe und Rückgaben bearbeiten. Eine
Reihenrolle verleiht dagegen keine globalen Schreib- oder Kopierrechte. Eventmanager
können freigegebene globale Fragen in eigenen Quiz verwenden; das Original bleibt
geschützt. Mehrfach zugeordnete Reihenfragen benötigen zum Bearbeiten/Freigeben die
jeweiligen Rechte für alle zugeordneten Reihen.

Deaktivierte Konten und entfernte Zuweisungen verlieren beim nächsten Serveraufruf
ihren bisherigen Zugriff, auch wenn die Sitzung noch besteht. Bereits dargestellte
Inhalte verschwinden dadurch nicht rückwirkend aus einem geöffneten Browser.
Benutzerlöschung wird hier nicht neu spezifiziert.

Ein Wechsel der Quiz-Eventreihe wird abgelehnt, wenn Fragen, relevante Story-Elemente
oder Umfragen in der Zielreihe nicht zulässig sind. Es werden dabei keine Inhalte
entfernt oder automatisch freigegeben. Globale Rechte, Rollenverwaltung und
Produktsichtbarkeit bleiben unverändert. Technische Regeln und Prüfbelege:
[Scope-basierte Rollenzuweisungen](../architecture/role-assignments.md).
