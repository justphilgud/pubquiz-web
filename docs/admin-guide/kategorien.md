# Kategorien verwalten

Die zentrale Kategorienverwaltung ist für Administratoren unter
`/admin/kategorien` erreichbar. Der Frageneditor enthält bewusst keine
administrativen Kategorienfunktionen.

## Statusmodell

- `ACTIVE`: für neue Fragen auswählbar.
- `PENDING`: Vorschlag eines Editors. Der Vorschlag kann bereits an der gerade
  bearbeiteten Frage verwendet werden, ist aber für andere Neuzuordnungen nicht
  freigegeben.
- `ARCHIVED`: nicht mehr für neue Zuordnungen auswählbar. Bestehende
  Fragezuordnungen bleiben erhalten und sichtbar.

Bestehende Kategorien werden durch die additive Migration als `ACTIVE`
übernommen. Neben Status und Zeitstempeln wird – soweit vorhanden – der
erstellende Benutzer als Auditinformation gespeichert.

## Verwaltungsaktionen

Administratoren können aktive Kategorien anlegen, Kategorien umbenennen,
archivieren und reaktivieren sowie offene Vorschläge freigeben oder durch
Archivierung ablehnen. Eine Namensänderung bewahrt alle bestehenden
Fragezuordnungen.

Beim Zusammenführen werden die Fragezuordnungen der Quellkategorie atomar auf
eine aktive Zielkategorie übertragen. Doppelte Zuordnungen werden vermieden,
danach wird die Quelle archiviert. Verwendete Kategorien werden nie hart
gelöscht.

Eine vollständig ungenutzte Kategorie darf als einzige Ausnahme dauerhaft
gelöscht werden. Status und eine zuvor angezeigte Zuordnungszahl reichen dafür
nicht aus: Die Server Action prüft die Referenzen innerhalb der
Löschtransaktion erneut. Sobald eine Frage die Kategorie verwendet, wird das
Löschen abgelehnt und Archivieren oder Zusammenführen angeboten.

Vor Archivierung und Zusammenführung zeigt die Oberfläche die Zahl der
betroffenen Fragen und verlangt eine Bestätigung. Schlägt ein Schritt fehl,
wird die gesamte Transaktion zurückgerollt.

## Frageneditor und Import

Die mobile Auswahl unterstützt Tastaturbedienung und Live-Suche nach exakten,
beginnenden, enthaltenen und ähnlichen Namen. Administratoren erzeugen aus dem
Feld eine aktive Kategorie; Editoren erzeugen einen offenen Vorschlag.

Der Administrator-Import bleibt kompatibel: unbekannte Kategorien werden aktiv
angelegt, bereits vorhandene Kategorien und Zuordnungen werden wiederverwendet.
Archivierte oder offene Kategorien werden dabei nicht stillschweigend
reaktiviert. Klonen bewahrt die vorhandenen Kategoriezuordnungen.

## Freigabe einer Frage mit offenen Kategorien

Beim Freigeben einer Frage muss ein Administrator jede zugeordnete offene
Kategorie entweder bestätigen oder verwerfen. Bestätigung und Fragenfreigabe
laufen in derselben Transaktion.

Beim Verwerfen wird die Zuordnung der freizugebenden Frage entfernt. Ist der
Vorschlag danach ungenutzt, wird er gelöscht. Wird er von weiteren Fragen
verwendet, wird er archiviert und deren Zuordnung bleibt bestehen. Abbrechen
verändert weder Frage noch Kategorie. Die zentrale Kategorienverwaltung bleibt
unabhängig davon vollständig verfügbar.
