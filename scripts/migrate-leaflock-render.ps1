# Copy env vars into Leaf Lock Render service (srv-d93nossvikkc73amkvv0)
# Prereq: run render login as leaflock420@gmail.com OR paste vars manually in dashboard
param(
    [string]$NewServiceId = "srv-d93nossvikkc73amkvv0",
    [string]$EnvFile = "$PSScriptRoot\..\data\.leaflock-render-env.json"
)

if (-not (Test-Path $EnvFile)) {
    Write-Host "Missing $EnvFile — export from old service first." -ForegroundColor Red
    exit 1
}

$envMap = Get-Content $EnvFile -Raw | ConvertFrom-Json
$key = $env:RENDER_API_KEY
if (-not $key) {
    $key = (Get-Content "$env:USERPROFILE\.render\cli.yaml" -Raw | Select-String -Pattern 'key:\s*(rnd_[^\s]+)').Matches.Groups[1].Value
}
if (-not $key) { Write-Host "Set RENDER_API_KEY from leaflock420 Render Account Settings, or run render login" -ForegroundColor Yellow; exit 1 }

$headers = @{
    Authorization = "Bearer $key"
    Accept        = "application/json"
    "Content-Type" = "application/json"
}

Write-Host "Target: https://dashboard.render.com/web/$NewServiceId" -ForegroundColor Cyan
Write-Host ""

foreach ($prop in $envMap.PSObject.Properties) {
    $name = $prop.Name
    $value = [string]$prop.Value
    $body = (@{ key = $name; value = $value } | ConvertTo-Json -Compress)
    try {
        Invoke-RestMethod -Uri "https://api.render.com/v1/services/$NewServiceId/env-vars/$name" -Headers $headers -Method Put -Body (@{ value = $value } | ConvertTo-Json) | Out-Null
        Write-Host "OK $name" -ForegroundColor Green
    } catch {
        try {
            Invoke-RestMethod -Uri "https://api.render.com/v1/services/$NewServiceId/env-vars" -Headers $headers -Method Post -Body $body | Out-Null
            Write-Host "Added $name" -ForegroundColor Green
        } catch {
            Write-Host "FAIL $name — paste manually in Render Environment" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  1. Custom Domains: add med.leaflock.com.au"
Write-Host "  2. GoDaddy DNS: med CNAME -> leaflock-pharmacy-wholesale-9kbz.onrender.com"
Write-Host "  3. Manual Deploy -> verify https://med.leaflock.com.au"
Write-Host "  4. Delete old service on Pride's workspace (srv-d93ivefaqgkc73c239ig)"