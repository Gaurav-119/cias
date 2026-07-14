# Free disk space used by Docker build cache and dangling images on C:
# Safe: keeps running containers, named volumes (PostgreSQL/MinIO data), and tagged images in use.
#
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts\cleanup-docker-disk.ps1
#
# Aggressive (also removes unused images + stopped containers):
#   powershell -ExecutionPolicy Bypass -File scripts\cleanup-docker-disk.ps1 -Aggressive

param([switch]$Aggressive)

Write-Host "=== Docker disk cleanup ===" -ForegroundColor Cyan
docker system df

Write-Host "`nPruning build cache (main cause of repeated downloads)..." -ForegroundColor Yellow
docker builder prune -af

if ($Aggressive) {
    Write-Host "Pruning unused images and stopped containers..." -ForegroundColor Yellow
    docker image prune -af
    docker container prune -f
} else {
    Write-Host "Pruning dangling images only (use -Aggressive for more)..." -ForegroundColor Yellow
    docker image prune -f
}

Write-Host "`nAfter cleanup:" -ForegroundColor Cyan
docker system df

Write-Host "`nTip: use 'docker compose up -d' without --build after the first successful build." -ForegroundColor Green
Write-Host "Tip: skip AI image unless needed: docker compose up -d  (no --profile ai)" -ForegroundColor Green
