# Point med.leaflock.com.au at Render (replaces Wix CNAME)
param(
    [string]$ApiKey = $env:GODADDY_API_KEY,
    [string]$ApiSecret = $env:GODADDY_API_SECRET
)

$domain = "leaflock.com.au"
$name = "med"
$value = "leaflock-pharmacy-wholesale.onrender.com"

if (-not $ApiKey -or -not $ApiSecret) {
    Write-Host "No GoDaddy API keys. Set GODADDY_API_KEY and GODADDY_API_SECRET, or run:" -ForegroundColor Yellow
    Write-Host "  node scripts/setup-med-godaddy-dns.mjs" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual GoDaddy DNS (after disconnecting med from Wix):" -ForegroundColor Cyan
    Write-Host "  Type:  CNAME"
    Write-Host "  Name:  med"
    Write-Host "  Value: $value"
    Write-Host "  TTL:   600"
    exit 1
}

$headers = @{
    Authorization = "sso-key ${ApiKey}:${ApiSecret}"
    Accept = "application/json"
}

$body = @(@{ type = "CNAME"; name = $name; data = $value; ttl = 600 }) | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "https://api.godaddy.com/v1/domains/$domain/records/CNAME/$name" -Headers $headers -Method Put -Body $body -ContentType "application/json"
    Write-Host "Updated CNAME $name.$domain -> $value" -ForegroundColor Green
} catch {
    try {
        Invoke-RestMethod -Uri "https://api.godaddy.com/v1/domains/$domain/records" -Headers $headers -Method Patch -Body $body -ContentType "application/json"
        Write-Host "Added CNAME $name.$domain -> $value" -ForegroundColor Green
    } catch {
        Write-Host "GoDaddy API failed:" $_.Exception.Message -ForegroundColor Red
        exit 1
    }
}