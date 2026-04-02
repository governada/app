param(
  [string]$Name,
  [string]$Branch,
  [switch]$NoNodeModulesLink,
  [switch]$SkipCodexLaunch
)

$ErrorActionPreference = 'Stop'

function Get-Slug([string]$Value) {
  $slug = $Value.ToLowerInvariant() -replace '[^a-z0-9]+', '-'
  $slug = $slug.Trim('-')
  if ([string]::IsNullOrWhiteSpace($slug)) {
    throw "Name must contain at least one alphanumeric character."
  }
  return $slug
}

function Get-AppUserModelId() {
  $pkg = Get-AppxPackage OpenAI.Codex -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $pkg) {
    return $null
  }

  return "$($pkg.PackageFamilyName)!App"
}

if (-not $Name) {
  Add-Type -AssemblyName Microsoft.VisualBasic
  $Name = [Microsoft.VisualBasic.Interaction]::InputBox(
    'Feature name for the new Codex worktree',
    'Launch Codex Worktree',
    ''
  )
}

if ([string]::IsNullOrWhiteSpace($Name)) {
  Write-Host 'Cancelled.'
  exit 0
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
$slug = Get-Slug $Name
$worktreePath = Join-Path (Split-Path -Parent $repoRoot) "governada-$slug"

$newWorktreeArgs = @{
  Name = $Name
}
if ($Branch) {
  $newWorktreeArgs.Branch = $Branch
}
if ($NoNodeModulesLink) {
  $newWorktreeArgs.NoNodeModulesLink = $true
}

& (Join-Path $PSScriptRoot 'new-worktree.ps1') @newWorktreeArgs

Set-Clipboard -Value $worktreePath
Start-Process explorer.exe $worktreePath

if (-not $SkipCodexLaunch) {
  $appUserModelId = Get-AppUserModelId
  if ($appUserModelId) {
    Start-Process explorer.exe "shell:AppsFolder\$appUserModelId"
  }
}

Write-Host ''
Write-Host 'Codex worktree launcher complete.'
Write-Host "Worktree path copied to clipboard: $worktreePath"
Write-Host 'If Codex did not open directly into that folder, use the pasted path when the app asks for a project.'
