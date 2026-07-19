param()

$ErrorActionPreference = "Stop"
$pythonVersion = "3.11.9"
$pythonArchiveSha256 = "009D6BF7E3B2DDCA3D784FA09F90FE54336D5B60F0E0F305C37F400BF83CFD3B"
$getPipSha256 = "A341E1A43E38001C551A1508A73FF23636A11970B61D901D9A1CAD2A18F57055"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeRoot = Join-Path $scriptRoot ".runtime"
$downloadsRoot = Join-Path $scriptRoot ".downloads"
$pythonExe = Join-Path $runtimeRoot "python.exe"
$requirements = Join-Path $scriptRoot "requirements-basic-pitch.lock.txt"

function Assert-Hash([string]$path, [string]$expected) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash
  if ($actual -ne $expected) {
    throw "Die SHA-256-Prüfung für eine Setup-Datei ist fehlgeschlagen."
  }
}

New-Item -ItemType Directory -Force -Path $downloadsRoot | Out-Null

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
  throw "Die isolierte Runtime ist nicht Python 3.11."
}

$pipPackage = Join-Path $runtimeRoot "Lib\site-packages\pip"
if (-not (Test-Path -LiteralPath $pipPackage)) {
  $getPip = Join-Path $downloadsRoot "get-pip.py"
  Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip
  Assert-Hash $getPip $getPipSha256
  & $pythonExe $getPip "pip==25.1.1" "setuptools==75.6.0" "wheel==0.45.1"
  if ($LASTEXITCODE -ne 0) { throw "pip konnte nicht in der isolierten Runtime installiert werden." }
}

& $pythonExe -m pip install --disable-pip-version-check --no-deps -r $requirements
if ($LASTEXITCODE -ne 0) { throw "Die ONNX-Runtime-Abhängigkeiten konnten nicht installiert werden." }

& $pythonExe -c "import basic_pitch, onnxruntime; from basic_pitch import ICASSP_2022_MODEL_PATH; print('Python=' + '$actualVersion'); print('BasicPitch=0.4.0'); print('ONNXRuntime=' + onnxruntime.__version__); print('Model=' + str(ICASSP_2022_MODEL_PATH.name))"
if ($LASTEXITCODE -ne 0) { throw "Die isolierte Basic-Pitch-Installation konnte nicht verifiziert werden." }
