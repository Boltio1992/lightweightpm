# Proves the local store survives a process restart.
#
# Run AFTER restarting the dev server: reads smoke-artifacts.json (written by
# smoke-test.ps1) and asserts the project and task created in the previous
# process are still there, with the same field values.

param(
  [string]$Base = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$failures = 0

function Check {
  param([string]$Label, [bool]$Ok, [string]$Detail = "")
  if ($Ok) {
    Write-Host ("  PASS  {0,-52} {1}" -f $Label, $Detail)
  } else {
    $script:failures++
    Write-Host ("  FAIL  {0,-52} {1}" -f $Label, $Detail) -ForegroundColor Red
  }
}

$artifactsPath = Join-Path $PSScriptRoot "smoke-artifacts.json"
if (-not (Test-Path $artifactsPath)) {
  Write-Host "smoke-artifacts.json not found - run smoke-test.ps1 first" -ForegroundColor Red
  exit 2
}
$a = Get-Content $artifactsPath -Raw | ConvertFrom-Json

Write-Host "=== restart persistence check against $Base ===" -ForegroundColor Cyan
Write-Host "expecting project $($a.projectName) ($($a.projectId))"
Write-Host "expecting task $($a.taskId)`n"

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Invoke-WebRequest -Uri "$Base/api/auth/login" -Method POST -WebSession $session `
  -UseBasicParsing -ContentType "application/json" `
  -Body (@{ username = "admin"; password = "password123" } | ConvertTo-Json)
Check "login still works after restart" ([int]$login.StatusCode -eq 200) "status=$([int]$login.StatusCode)"

# The seeded user's bcrypt hash must have survived too: a wiped/blank hash would
# still let the row exist but would fail the password check above, so this also
# covers the password_hash regression.
$projects = (Invoke-WebRequest -Uri "$Base/api/projects" -Method GET -WebSession $session -UseBasicParsing).Content | ConvertFrom-Json
$project = @($projects.projects) | Where-Object { $_.id -eq $a.projectId } | Select-Object -First 1
Check "created project survived the restart" ($null -ne $project) "found=$([bool]$project)"
Check "project kept its name" ($project.name -eq $a.projectName) "name=$($project.name)"

$tasks = (Invoke-WebRequest -Uri "$Base/api/tasks" -Method GET -WebSession $session -UseBasicParsing).Content | ConvertFrom-Json
$task = @($tasks.tasks) | Where-Object { $_.id -eq $a.taskId } | Select-Object -First 1
Check "created task survived the restart" ($null -ne $task) "found=$([bool]$task)"
Check "task kept its patched status" ($task.status -eq "in_progress") "status=$($task.status)"
Check "task kept percent_complete=40" ($task.percent_complete -eq 40) "percent=$($task.percent_complete)"
Check "task kept its tags" (@($task.tags).Count -eq 2) "tags=$($task.tags -join ',')"
Check "task still resolves its project" ($null -ne $task.project) "project=$($task.project.name)"

Write-Host ""
if ($failures -gt 0) {
  Write-Host "$failures check(s) FAILED - the store did not persist" -ForegroundColor Red
  exit 1
}
Write-Host "persistence across restart confirmed" -ForegroundColor Green
exit 0
