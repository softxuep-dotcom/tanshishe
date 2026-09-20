param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot '.openai/hosting.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Sites manifest is missing.' }
$site = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($site.project_id -ne 'appgprj_6a9e5a400a1c8191ba133176fe258acd') { throw 'This launcher is configured for a different Site. Update the publishing guide first.' }
$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
if (-not $codexCommand) { throw 'Codex CLI was not found. Open Codex and use docs/PUBLISHING.md.' }
$message = "Publish the latest Nanqiao game in $projectRoot to its existing Sites project. Read docs/PUBLISHING.md and follow its release checklist. This is authorization to validate, commit the game changes, push to the existing Sites source repository, package, save and deploy while preserving current access. Do not redesign gameplay, create another Site, change the URL, expose credentials, or treat GitHub push as deployment. Report success only after deployment succeeds, then open the verified production URL. If blocked, report the exact failure."
if ($CheckOnly) { Write-Host "Launcher configuration OK. No publish request sent. Codex: $($codexCommand.Source)"; exit 0 }
Push-Location $projectRoot
try {
  & $codexCommand.Source queue --thread '01a07a72-52c1-7ac1-b309-bc14d8d5f3a2' --message $message
  if ($LASTEXITCODE -ne 0) { throw 'Codex did not accept the request. See docs/PUBLISHING.md.' }
  Write-Host 'Request queued. Open this project conversation in Codex to follow the release. Queued does not mean deployed.'
} finally { Pop-Location }
