# PR116: neuer Head mit ausschließlich korrigierten CI-Kommentaren

Der neue PR116-Head ist `23c0b130e1cd6772fb8e1d98498a09f432d0ec08`. Gegenüber
dem bereits geprüften `41f3c2a87fd320757f158c2854e76cab3dac8d6a` unterscheidet
er sich ausschließlich in zwei Kommentarzeilen der `.github/workflows/ci.yml`:
[vollständiger Vergleich](https://github.com/justphilgud/pubquiz-web/compare/41f3c2a87fd320757f158c2854e76cab3dac8d6a...23c0b130e1cd6772fb8e1d98498a09f432d0ec08).
Beide Branches nutzten bereits dasselbe offizielle PostgreSQL17-Image. Die
unterschiedlichen Kommentare kollidierten bei der Zusammenführung. Der neue
Head gleicht nur die Formulierung an; alle neuen Meme-CI-Teststufen bleiben
erhalten. Kein ausgeführter Anwendungscode, SQL oder Workflowbefehl geändert.

Der bestehende Preflight behält seine Verantwortung. Die feste Liste ergänzt
genau dieses unveränderliche Kandidatenpaar zur unveränderten Production-Basis
`baedd479615d33a7eb7b5e15f18f36450061dc5b`. Alte geprüfte Paare bleiben erhalten;
beliebige andere Commits werden weiterhin abgelehnt. Nur die bisher genehmigte
Archivmigration ist zulässig, mit unveränderter SHA256
`99a4b9d18e55d2294383a31cf35fb30973e6a30f9750c3c5da752f102818f641`.
Keine neue Komponente, keine Inferenz eines zulässigen Deltas und keine
Abschwächung der Reader-/Schema-/Alias-/Environment-/Backup-Gates.

Die Safety-CI prüft den Legacy-Difficulty-Plan und den finalen Archiv-Head mit
echtem PostgreSQL17. Der vorherige Archiv-Head besitzt bereits die erfolgreichen
Nachweise 38928227766 und 38929819235; die reinen Plan-Tests prüfen weiterhin
alle drei exakten Paare sowie unbekannte Paare/Prüfsummen. Nach regulärer
Operations-Integration erfolgt die tatsächliche lesende Production-Vorprüfung
erneut mit dem neuen exakten Head. Kein Anwendungsdeploy durch diesen PR.

## Bereits abgeschlossene Sicherung

Der geschützte Vorab-Lauf
[38930389548](https://github.com/justphilgud/pubquiz-web/actions/runs/38930389548)
ist insgesamt erfolgreich, einschließlich nachgelagertem Retention-Dry-Run.
Backup-ID `production/acceptance/run-38930389548-1`, Source-Snapshot
16.10.2026 18:15:43 MESZ, vollständig erstellt 18:53:36 MESZ. Manifest-SHA256:
`3ea0b3b3e38c78e1a0608cbbcdc33a9326b1d82b0071b5880ad0bdb9b814b72e`.
Evidence bestätigt Manifest, privaten Readback und Integrität für das tatsächlich
weiterhin ausgelieferte Release `baedd479615d33a7eb7b5e15f18f36450061dc5b`.
Keine Löschung, kein Restore, keine Production-Migration und kein App-Deployment.

Der nur bedingt vorbereitete Laufzeit-PR119 wurde ohne Merge geschlossen.
Das bestehende 45-Minuten-Limit bleibt unverändert. Die neue Vorprüfung und
der App-Release verwenden die bereits vollständig geprüfte Sicherung; die
Production-Anwendung und das zu sichernde Schema haben sich nicht verändert.
