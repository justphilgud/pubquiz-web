# AP9.6 – GitHub-OIDC-Token-Härtung

Stand vor Änderung: `ba3af46af8728f69e071208aa7602351f799288a`.

## Befund

`BridgeClient.access()` rief vor jedem Bridge-Zugriff `requestGithubToken()` auf.
Diese Funktion sprach den von GitHub Actions über
`ACTIONS_ID_TOKEN_REQUEST_URL` bereitgestellten Runner-Endpunkt direkt mit der
Audience `urn:pubquiz:ap94:blob-bridge` an. Jeder Grant, Upload-Grant, Readback,
Inventory- und Retention-Aufruf löste deshalb einen neuen Tokenabruf aus.

Netzwerk- und Providerfehler wurden zuletzt pauschal als
`BRIDGE_REQUEST_FAILED_DETAILS_WITHHELD` klassifiziert. Der fehlgeschlagene
Backup-Lauf `35836762821` hatte 178 vorherige HTTP-200-Bridge-Aufrufe und scheiterte
vor dem nächsten Bridge-Eingang. Blob-PUT, Signed Path und Bridge-Autorisierung
waren nicht die Fehlerquelle.

## Änderung

- Prozessinterner Cache mit separatem Eintrag je Audience.
- Lokales Lesen ausschließlich des `exp`-Claims zur Ablaufsteuerung.
- Refresh-Marge: 60 Sekunden.
- Ein laufender Tokenabruf je Audience (Single Flight).
- Höchstens vier Abrufversuche bei Netzwerkfehlern, HTTP 429 und HTTP 5xx.
- Exponentielles Backoff ab 500 ms, Jitter bis 249 ms und `Retry-After` höchstens
  30 Sekunden.
- Keine Retries für HTTP 400/401/403, ungültige Antwort, fehlendes Token oder
  ungültigen `exp`-Claim.
- Keine Wiederholung einer Bridge-401/403.
- Secretsichere Diagnosezähler in Backup-Ergebnis, Step Summary und Fehlerlog.

Die Bridge-Implementierung, Trusted Source, JWT-Signaturprüfung und alle
verpflichtenden Claims bleiben unverändert. Es wird kein Token persistiert oder
ausgegeben.

## Lokale Prüfung

- Operations-/Security-Regressionsuite: 86/86 bestanden.
- Vollständige Repository-Testkette: bestanden.
- TypeScript: bestanden.
- ESLint der geänderten TypeScript-Dateien: bestanden.
- Production-Build: bestanden (nach Wiederholung mit Netzwerkzugriff für die
  bereits eingebundenen Google-Fonts).
- Blob-Retry-, Signed-Path-, Identitäts-, Ablauf-, Rollen- und
  Bridge-Claim-Regressionen: bestanden.

CI, synthetische Provider-Matrix, OIDC-Livediagnose und der eine freigegebene
vollständige Production-Backup-Lauf werden nach Main-Integration ergänzt.

Der 193-Länderimport bleibt gesperrt (`writeAuthorized: false`).
