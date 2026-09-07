# Releaseprozess

```text
Feature -> Tests -> Dokumentation -> Testumgebung -> Abnahme -> Produktion -> Release Notes
```

Vor Produktion: kritische Regression, Migrationen, Backup, bekannte Einschränkungen und Rollback prüfen.

Vor einer Production-Veröffentlichung ein erfolgreiches Production-Backup bzw.
ein eindeutig verfügbares projektspezifisches Provider-Restore-Fenster prüfen.
Sobald aktiviert, ist der separate Release-Backup-Workflow fester Preflight-Schritt;
sein erfolgreicher Lauf ersetzt nicht den tatsächlichen Restore-Test.
Siehe [Operations-Vertrag](../operations/environments-and-backups.md).
