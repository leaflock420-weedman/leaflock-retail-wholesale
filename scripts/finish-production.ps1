# LeafLock wholesale — production finish checklist (run after each step)
param([switch]$Deploy)

$ErrorActionPreference = "Continue"
$svcId = "srv-d93ivefaqgkc73c239ig"

Write-Host "`n=== LeafLock Production Checklist ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "CORRECT URL (live now):" -ForegroundColor Green
Write-Host "  https://med.leaflock.com.au"
Write-Host ""
Write-Host "NOT configured (no DNS):" -ForegroundColor Yellow
Write-Host "  https://www.med.leaflock.com.au  <- different subdomain; use med.leaflock.com.au instead"
Write-Host "  Optional: GoDaddy CNAME name=www.med value=leaflock-med-wholesale.onrender.com"
Write-Host ""

Write-Host "--- DNS ---" -ForegroundColor Cyan
nslookup -type=CNAME med.leaflock.com.au ns43.domaincontrol.com 2>$null | Select-String "canonical"

Write-Host "`n--- Live site ---" -ForegroundColor Cyan
foreach ($url in @("https://med.leaflock.com.au/", "https://leaflock-med-wholesale.onrender.com/")) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
        Write-Host "  OK $url ($($r.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL $url" -ForegroundColor Red
    }
}

Write-Host "`n--- YOU must complete (dashboard) ---" -ForegroundColor Yellow
Write-Host "  1. Render billing: add card -> upgrade service to Starter (~`$7/mo) = no cold starts"
Write-Host "     https://dashboard.render.com/web/$svcId/settings"
Write-Host "  2. Render disk: Settings -> Disks -> add 1GB at /var/data (keeps retail/order data)"
Write-Host "  3. GitHub: https://github.com/settings/installations -> Render -> add leaflock-med-wholesale"
Write-Host "  4. PayPal Live (real payments):"
Write-Host "     https://developer.paypal.com/dashboard/applications/live"
Write-Host "     Create Live app -> set on Render:"
Write-Host "     PAYPAL_CLIENT_ID=<live client id>"
Write-Host "     PAYPAL_CLIENT_SECRET=<live secret>"
Write-Host "     PAYPAL_MODE=live"
Write-Host "     (Currently sandbox — test only, no real money)"
Write-Host "  5. SMTP (Google Workspace med@):"
Write-Host "     SMTP_HOST=smtp.gmail.com  SMTP_PORT=587"
Write-Host "     SMTP_USER=med@leaflock.com.au"
Write-Host "     SMTP_PASS=<Google app password for med@>"
Write-Host "     WHOLESALE_EMAIL_TO=med@leaflock.com.au"
Write-Host "     ANALYTICS_EMAIL_TO=med@leaflock.com.au"
Write-Host "     ANALYTICS_EMAIL_FROM=med@leaflock.com.au"
Write-Host "  6. Render custom domain: verify med.leaflock.com.au (click Verify in Custom Domains)"
Write-Host ""

if ($Deploy) {
    Write-Host "Triggering deploy..." -ForegroundColor Cyan
    $key = (Get-Content "$env:USERPROFILE\.render\cli.yaml" -Raw | Select-String -Pattern 'key:\s*(rnd_[^\s]+)').Matches.Groups[1].Value
    $headers = @{ Authorization = "Bearer $key"; "Content-Type" = "application/json" }
    try {
        $d = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$svcId/deploys" -Headers $headers -Method Post -Body '{"clearCache":"clear"}'
        Write-Host "Deploy started: $($d.id) status=$($d.status)" -ForegroundColor Green
    } catch {
        Write-Host "Deploy failed: $($_.ErrorDetails.Message)" -ForegroundColor Red
        Write-Host "If private repo: grant Render GitHub access or temporarily make repo public."
    }
}