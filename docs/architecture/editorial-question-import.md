# Sicherer redaktioneller Fragenimport

## Prüfung vor Schemaänderung

Das bestehende `fragen.schwierigkeitslevel` ist ein numerischer, aus Ergebnissen abgeleiteter Wert. Redaktionelle LEICHT/MITTEL/SCHWER dürfen ihn nicht ersetzen. Geplant ist ausschließlich `fragen.redaktionelle_schwierigkeit`, nullable Text mit CHECK für diese drei Werte. Keine Backfills, keine Umdeutung bestehender Werte, keine Änderung vorhandener Fragen. Ein zusätzliches nullable Feld ist kompatibel mit bestehenden Schreibern; alle bestehenden Zeilen erhalten NULL. Der CHECK wird erst NOT VALID angelegt und anschließend validiert. Der ALTER-Schritt benötigt einen kurzen Tabellenlock; Preview-Migration vor Deployment kontrolliert ausführen, Production bleibt ausgeschlossen. Rücknahme nur nach Prüfung neu importierter Inhalte, nicht durch Löschen anderer Daten.

Die vorhandenen `external_question_import_batches` und `external_question_import_items` werden als Importjournal wiederverwendet. Deren Unique-Key `(provider, external_reference)` sichert stabile Quelldatensatzkennungen. Kein zusätzlicher Import-Ledger. Checksummen, unveränderte Quellenpayloads, Entscheidungen und ID-Manifest werden in bestehenden JSON-/Reportfeldern gespeichert. Ein anderer Payload unter derselben Kennung ist ein Konflikt, kein Update.

## Verantwortlichkeiten

Die bestehende Importoberfläche behält Dateiauswahl und Benutzerinteraktion; Server Actions behalten die zentrale Administratorprüfung. Ein gemeinsamer redaktioneller Service unter dem vorhandenen Importmodul kapselt Normalisierung, vollständige Templatevalidierung, Kandidatenentscheidungen, Transaktion und Manifest. Bestehende Template-Parser, Antwortableitung, Dublettenheuristik und Berechtigungsregeln werden verwendet. Der OpenTDB-Pilot bleibt unverändert; seine Multiple-Choice-Annahmen dürfen diese Pools nicht verändern.

## Sicherheitsvertrag

Dry-Run verwendet eine REPEATABLE READ READ ONLY-Transaktion mit festem SQL und ohne Journal-/Entwurfsanlage. Unbekannte Templates, fehlende Kategorien und unklare Sachkonflikte sind MANUELL PRÜFEN beziehungsweise ÜBERSPRINGEN. Semantische Ähnlichkeit ist eine konservative Heuristik, keine fachliche Gleichheitsbehauptung. Für spätere Pools können explizite Messgrößen- und Zeitraum-Metadaten geliefert werden; ungeklärte bestehende Metadaten begründen niemals eine automatische Freigabe.

Der Writer ist Preview-only, prüft zusätzlich die verifizierte Datenbankidentität und Berechtigung, verwendet einen transaktionalen Advisory Lock und den vorhandenen Unique-Key. Er prüft den Zielbestand unmittelbar erneut. Ein veralteter Dry-Run darf nicht ungeprüft geschrieben werden. Neue Fragen bleiben DRAFT und freigegeben=false. Kein Bestandsupdate, kein Quizbezug. Bestandstabellen werden für die kurze Batchtransaktion gegen konkurrierende Schreibänderungen gesperrt, damit Integritätsvergleiche nicht durch fremde Writes verfälscht werden. Fehler einschließlich Integritätsabweichungen rollen den gesamten Batch samt Journal zurück.

Integritätsnachweise speichern ausschließlich aggregierte Zähler/Hashes, keine personenbezogenen Antwortinhalte. Vorhandene Fragen und zugehörige Metadaten, Quizzuordnungen, Teilnehmerantworten/Submissions und Bewertungen müssen unverändert bleiben. Erwartete neue Fragen, Antworten, Kategoriezuordnungen und Journalzeilen werden exakt gegen das Manifest geprüft. Bestehende Kategorien werden nur referenziert; fehlende Kategorien nicht automatisch erzeugt.

## Abnahmegrenzen

PR #93, Commit `52b0729152a4e4d12947e1cee0961fe2293fc73a`, bleibt unverändert. Nur Preview ist zum Schreiben freigegeben. Echte PostgreSQL-Tests müssen Parallelität, Wiederholung und Rollback prüfen. Ein übersprungener Integrationstest ist keine Abnahme. Preview-Dry-Run, Import und Browser-End-to-End folgen erst erfolgreicher CI und kontrollierter Bereitstellung. Production-Import/-Deployment und Merge sind ausgeschlossen.
