# Remove legacy / duplicate folders from D:\CIAS (not used by rebuilt Docker app).
# Active stack: BackEnd/app, frontend/, ai-service/
#
# Run: powershell -ExecutionPolicy Bypass -File scripts\cleanup-project-legacy.ps1

$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Claim Nova legacy cleanup on $root ===" -ForegroundColor Cyan

$targets = @(
    "$root\BackEnd\api",           # ~1 GB legacy ML + old Flask (replaced by BackEnd/app + ai-service)
    "$root\BackEnd\uploads",
    "$root\BackEnd\models",
    "$root\blockchain",
    "$root\src",
    "$root\node_modules",
    "$root\public",
    "$root\deploy"
)

$files = @(
    "$root\package.json",
    "$root\package-lock.json",
    "$root\index.html",
    "$root\vite.config.js",
    "$root\eslint.config.js",
    "$root\BackEnd\firestore_rules.txt"
)

foreach ($t in $targets) {
    if (Test-Path $t) {
        $mb = [math]::Round((Get-ChildItem $t -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1)
        Write-Host "Removing $t ($mb MB)..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $t
    }
}

foreach ($f in $files) {
    if (Test-Path $f) {
        Write-Host "Removing $f" -ForegroundColor Yellow
        Remove-Item -Force $f
    }
}

Write-Host "`nOptional: delete local Python venv (Docker has its own packages):" -ForegroundColor Cyan
Write-Host "  Remove-Item -Recurse -Force $root\BackEnd\venv" -ForegroundColor DarkGray
Write-Host "Done." -ForegroundColor Green
