param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
function Run-Git { & git @args; if ($LASTEXITCODE -ne 0) { throw "Git command failed: $($args[0])" } }
Push-Location $projectRoot
try {
  $remote = & git remote get-url origin
  if ($LASTEXITCODE -ne 0 -or $remote -notmatch '^https://github\.com/softxuep-dotcom/tanshishe(?:\.git)?$') { throw 'Unexpected origin. Check docs/PUBLISHING.md.' }
  $branch = & git branch --show-current
  if ($branch -ne 'main') { throw 'Switch to main before publishing. No changes were pushed.' }
  if ($CheckOnly) { Write-Host 'GitHub Pages launcher configuration OK. Nothing committed or pushed.'; exit 0 }
  Run-Git add --all
  & git diff --cached --quiet
  if ($LASTEXITCODE -eq 1) { Run-Git commit -m "Update Nanqiao game" } elseif ($LASTEXITCODE -ne 0) { throw 'Unable to inspect staged changes.' }
  Run-Git push origin main
  Write-Host 'Push succeeded. GitHub Actions will test, build and deploy. This does not mean deployment has finished.'
  Start-Process 'https://github.com/softxuep-dotcom/tanshishe/actions'
} finally { Pop-Location }
