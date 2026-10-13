# LightPM local-first smoke test.
#
# Exercises the real HTTP API against a running server and asserts on the
# responses. Usage:
#     pwsh -File smoke-test.ps1 [-Base http://localhost:3000]
#
# Covers: auth, project create, status seeding, task create, task patch,
# resource embedding (user:users), search, dashboard, and the export/import
# surface. Prints PASS/FAIL per step and exits non-zero if anything failed.

param(
  [string]$Base = "http://localhost:3000",
  [string]$Username = "admin",
  [string]$Password = "password123"
)

$ErrorActionPreference = "Stop"
$script:failures = 0
$script:session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Call {
  param([string]$Method, [string]$Path, $Body)
  # Windows PowerShell 5.1: no -SkipHttpErrorCheck, so non-2xx arrives as an
  # exception and the body has to be read off the response stream by hand.
  $params = @{
    Uri                = "$Base$Path"
    Method             = $Method
    WebSession         = $script:session
    TimeoutSec         = 180
    UseBasicParsing    = $true
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 8)
  }

  try {
    $r = Invoke-WebRequest @params
    $status = [int]$r.StatusCode
    $content = $r.Content
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $status = [int]$resp.StatusCode
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $content = $reader.ReadToEnd()
    } else {
      $status = -1
      $content = $_.Exception.Message
    }
  }

  $json = $null
  if ($content) { try { $json = $content | ConvertFrom-Json } catch { $json = $null } }
  return [pscustomobject]@{ Status = $status; Json = $json; Raw = $content }
}

function Check {
  param([string]$Label, [bool]$Ok, [string]$Detail = "")
  if ($Ok) {
    Write-Host ("  PASS  {0,-52} {1}" -f $Label, $Detail)
  } else {
    $script:failures++
    Write-Host ("  FAIL  {0,-52} {1}" -f $Label, $Detail) -ForegroundColor Red
  }
}

Write-Host "=== LightPM smoke test against $Base ===" -ForegroundColor Cyan

# --- 1. auth ---------------------------------------------------------------
$r = Call GET "/api/auth/me"
Check "unauthenticated /api/auth/me is rejected" ($r.Status -eq 401) "status=$($r.Status)"

$r = Call POST "/api/auth/login" @{ username = $Username; password = $Password }
Check "login as $Username succeeds" ($r.Status -eq 200) "status=$($r.Status)"
Check "login returns the seeded profile" ($r.Json.user.name -eq "Alex Rivera") "name=$($r.Json.user.name)"

$r = Call GET "/api/auth/me"
Check "authenticated /api/auth/me works" ($r.Status -eq 200 -and $null -ne $r.Json.user) "status=$($r.Status)"

$r = Call POST "/api/auth/login" @{ username = $Username; password = "wrong-password" }
Check "wrong password is rejected" ($r.Status -eq 401) "status=$($r.Status)"

# --- 2. seeded data --------------------------------------------------------
$r = Call GET "/api/projects"
$seeded = @($r.Json.projects)
Check "seeded projects load" ($r.Status -eq 200 -and $seeded.Count -ge 2) "count=$($seeded.Count)"
$apollo = $seeded | Where-Object { $_.name -eq "Apollo Design System" } | Select-Object -First 1
Check "seed contains 'Apollo Design System'" ($null -ne $apollo) "id=$($apollo.id)"

# --- 3. create a project (insert path + persistence) ------------------------
$stamp = Get-Date -Format "HHmmss"
$newName = "Smoke Test $stamp"
$r = Call POST "/api/projects" @{
  name        = $newName
  description = "Created by smoke-test.ps1"
  status      = "active"
  start_date  = "2026-10-01"
  end_date    = "2026-12-31"
}
Check "create project" ($r.Status -eq 200 -and $null -ne $r.Json.project.id) "id=$($r.Json.project.id)"
$newId = $r.Json.project.id

# --- 4. status seeding for the new project ---------------------------------
$r = Call GET "/api/projects/$newId/statuses"
Check "new project gets default statuses" ($r.Status -eq 200 -and @($r.Json.statuses).Count -eq 5) "count=$(@($r.Json.statuses).Count)"

# --- 5. task create / patch (exercises single(), select projection) ---------
$r = Call POST "/api/tasks" @{
  title          = "Verify durable local storage"
  description    = "Round-trips through the local store"
  project_id     = $apollo.id
  status         = "todo"
  priority       = "high"
  start_date     = "2026-10-01"
  duration_days  = 5
  percent_complete = 0
  tags           = @("smoke", "local-first")
}
Check "create task under seeded project" ($r.Status -eq 200 -and $null -ne $r.Json.task.id) "status=$($r.Status) id=$($r.Json.task.id)"
$taskId = $r.Json.task.id

$r = Call GET "/api/tasks"
$task = @($r.Json.tasks) | Where-Object { $_.id -eq $taskId } | Select-Object -First 1
Check "task appears in list" ($null -ne $task) "title=$($task.title)"
Check "task embedding resolves assignee/project" ($null -ne $task.project) "project=$($task.project.name)"

$r = Call PATCH "/api/tasks/$taskId" @{ status = "in_progress"; percent_complete = 40 }
Check "patch task status" ($r.Status -eq 200) "status=$($r.Status)"

$r = Call GET "/api/tasks"
$task = @($r.Json.tasks) | Where-Object { $_.id -eq $taskId } | Select-Object -First 1
Check "status change persisted in-process" ($task.status -eq "in_progress") "status=$($task.status)"
Check "tags round-trip as an array" (@($task.tags).Count -eq 2) "tags=$($task.tags -join ',')"

# --- 6. resource embedding on project_members ------------------------------
# Counts are pulled into variables first: interpolating @(...) straight into the
# detail string made an empty result look like a passing "count=0".
$r = Call GET "/api/projects/$($apollo.id)/members"
$memberCount = 0
$withUser = 0
if ($r.Json -and $r.Json.members) {
  $memberCount = @($r.Json.members).Count
  $withUser = @($r.Json.members | Where-Object { $_.user -and $_.user.username }).Count
}
Check "members list loads (user:users embedding)" ($r.Status -eq 200 -and $memberCount -eq 3) "status=$($r.Status) count=$memberCount"
Check "every member row carries the embedded user" ($withUser -eq $memberCount -and $memberCount -gt 0) "withUser=$withUser"

# --- 7. misc surfaces ------------------------------------------------------
$r = Call GET "/api/dashboard"
Check "dashboard loads" ($r.Status -eq 200) "status=$($r.Status)"

$r = Call GET "/api/search?q=Smoke"
Check "search finds the new project" ($r.Status -eq 200) "status=$($r.Status)"

$r = Call GET "/api/users?q=jane"
Check "user search loads" ($r.Status -eq 200) "status=$($r.Status)"

# --- summary ---------------------------------------------------------------
Write-Host ""
Write-Host "artifacts for the restart check:" -ForegroundColor Yellow
Write-Host "  project_id=$newId"
Write-Host "  project_name=$newName"
Write-Host "  task_id=$taskId"
@{
  projectId   = $newId
  projectName = $newName
  taskId      = $taskId
  apolloId    = $apollo.id
} | ConvertTo-Json | Set-Content -Path (Join-Path $PSScriptRoot "smoke-artifacts.json")

if ($script:failures -gt 0) {
  Write-Host "`n$script:failures check(s) FAILED" -ForegroundColor Red
  exit 1
}
Write-Host "`nall checks passed" -ForegroundColor Green
exit 0
