# Monitoring

Als Administrator rechts oben das **Benutzermenü → Monitoring** öffnen.
Direktadresse: `/admin/monitoring`. Editor- und Eventmanagerrollen reichen nicht aus.

Oben stehen Umgebung, Gesamtstatus und Prüfzeitpunkt. Darunter Anwendung, Datenbank,
Live-Quiz, Antworten, Backup und Deployment. **Quelle und Einordnung** erklärt jeden
Befund. **Messbudget und Grenzen** zeigt Erhebungszeit, Queryanzahl und Browserlast.

Die Seite aktualisiert alle 30 Sekunden, solange der Tab sichtbar ist. Der Schalter
pausiert automatische Abfragen. Nach mehr als 60 Sekunden wird der Stand als veraltet
markiert. Ein lange unveränderter Quizstand bedeutet dagegen keinen Clientausfall.

- Grün: die jeweilige Prüfung war erfolgreich.
- Gelb: Warnung, alte Quelle oder fehlende Messung. In V1 verhindern unbekannte
  Save-Zuverlässigkeit und ein nur historischer Backupbeleg bewusst einen grünen
  Gesamtstatus. Nicht jede gelbe Karte bezeichnet einen Fehler.
- Rot: eine konkrete Leseprüfung/Umgebungsprüfung scheitert oder der Monitor ist
  nicht erreichbar. Netzwerk und Anmeldung prüfen, danach technische Betreuung.
  Das Dashboard führt keine Reparatur, Finalisierung oder Wiederherstellung aus.

Registrierte Teams sind keine Präsenzmessung. Antwortzahlen zählen Datensätze des
aktuellen Antwortlaufs, keine HTTP-Saves. Fehlerquoten, Retries und aktive Clients
werden mangels zentraler Datenquelle nicht geschätzt.

Die Backupkarte ist ein datierter AP9.4-Beleg, kein automatischer Statusabruf. Vor
einem Event den aktuellen Operationsnachweis zusätzlich prüfen. Kein Restorebutton.

In Preview kann ein Admin unter **Preview-Abnahme · synthetische Tests** feste
Testszenarien auswählen. Ein auffälliger SIMULATION-Hinweis trennt diese von echten
Messungen. Die Auswahl verändert weder Quiz noch Datenbank. Auch gesunde Testwerte
beseitigen keine tatsächlich fehlenden Messquellen.

Die Ereignisliste gilt nur für dieses geöffnete Dashboard und verschwindet beim
Neuladen. Es gibt keinen Alarmversand. Die Betreiberansicht muss beaufsichtigt werden;
ein Ausfall der gesamten Anwendung kann nicht unabhängig durch sie erkannt werden.
