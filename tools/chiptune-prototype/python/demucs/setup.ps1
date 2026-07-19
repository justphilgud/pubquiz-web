param()

$ErrorActionPreference = "Stop"
$pythonVersion = "3.11.9"
$pythonArchiveSha256 = "009D6BF7E3B2DDCA3D784FA09F90FE54336D5B60F0E0F305C37F400BF83CFD3B"
$getPipSha256 = "A341E1A43E38001C551A1508A73FF23636A11970B61D901D9A1CAD2A18F57055"
$modelSha256 = "D9FA14133CFCC034A6758923BB3A8CA9F8DFD0B582134643BBF83F72C17576DD"
$modelConfigSha256 = "239C445D0B14454D541AD8BD9BB271C9E536D267E8A4625208744CBB2E7BB66C"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeRoot = Join-Path $scriptRoot ".runtime"
$downloadsRoot = Join-Path $scriptRoot ".downloads"
$modelsRoot = Join-Path $scriptRoot ".models"
$pythonExe = Join-Path $runtimeRoot "python.exe"
$requirements = Join-Path $scriptRoot "requirements-demucs.lock.txt"
$modelManifest = Join-Path $modelsRoot "model-manifest.json"

function Assert-Hash([string]$path, [string]$expected) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash
  if ($actual -ne $expected) {
    throw "Die SHA-256-Prüfung für $([IO.Path]::GetFileName($path)) ist fehlgeschlagen (erwartet: $expected, erhalten: $actual)."
  }
}

New-Item -ItemType Directory -Force -Path $downloadsRoot, $modelsRoot | Out-Null

if (-not (Test-Path -LiteralPath $pythonExe)) {
  $archive = Join-Path $downloadsRoot "python-$pythonVersion-embed-amd64.zip"
  Invoke-WebRequest -Uri "https://www.python.org/ftp/python/$pythonVersion/python-$pythonVersion-embed-amd64.zip" -OutFile $archive
  Assert-Hash $archive $pythonArchiveSha256
  New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
  Expand-Archive -LiteralPath $archive -DestinationPath $runtimeRoot -Force
  $pthFile = Join-Path $runtimeRoot "python311._pth"
  $pth = (Get-Content -Raw -LiteralPath $pthFile).Replace("#import site", "import site")
  Set-Content -LiteralPath $pthFile -Value $pth -Encoding ascii -NoNewline
}

$actualVersion = & $pythonExe -c "import sys; print('.'.join(map(str, sys.version_info[:3])))"
if (-not $actualVersion.StartsWith("3.11.")) {
  throw "Die isolierte Demucs-Runtime ist nicht Python 3.11."
}

$pipPackage = Join-Path $runtimeRoot "Lib\site-packages\pip"
if (-not (Test-Path -LiteralPath $pipPackage)) {
  $getPip = Join-Path $downloadsRoot "get-pip.py"
  Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip
  Assert-Hash $getPip $getPipSha256
  & $pythonExe $getPip "pip==25.1.1" "setuptools==75.6.0" "wheel==0.45.1"
  if ($LASTEXITCODE -ne 0) { throw "pip konnte nicht in der isolierten Demucs-Runtime installiert werden." }
}

& $pythonExe -m pip install --disable-pip-version-check --no-deps -r $requirements
if ($LASTEXITCODE -ne 0) { throw "Die gepinnten Demucs-Abhängigkeiten konnten nicht installiert werden." }

$env:HF_HOME = $modelsRoot
$env:HF_HUB_DISABLE_TELEMETRY = "1"
& $pythonExe -c "import demucs, torch; from demucs.pretrained import get_model; model=get_model('htdemucs'); print('Python=$actualVersion'); print('Demucs=' + demucs.__version__); print('Torch=' + torch.__version__); print('Model=htdemucs'); print('Sources=' + ','.join(model.sources))"
if ($LASTEXITCODE -ne 0) { throw "Demucs oder das Modell htdemucs konnten nicht vorbereitet werden." }

$modelFile = Get-ChildItem -LiteralPath $modelsRoot -Recurse -File -Filter "955717e8.safetensors" | Select-Object -First 1
$modelConfigFile = Get-ChildItem -LiteralPath $modelsRoot -Recurse -File -Filter "htdemucs.yaml" | Select-Object -First 1
if (-not $modelFile -or -not $modelConfigFile) { throw "Das vorbereitete Demucs-Modell ist unvollständig." }
Assert-Hash $modelFile.FullName $modelSha256
Assert-Hash $modelConfigFile.FullName $modelConfigSha256

& $pythonExe -c "import hashlib,json,pathlib; root=pathlib.Path(r'$modelsRoot'); files=[p for p in root.rglob('*') if p.is_file() and p.name != 'model-manifest.json']; payload={'model':'htdemucs','demucsVersion':'4.1.0','files':[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)]}; pathlib.Path(r'$modelManifest').write_text(json.dumps(payload,indent=2),encoding='utf-8')"
if ($LASTEXITCODE -ne 0) { throw "Das lokale Demucs-Modellmanifest konnte nicht erstellt werden." }
