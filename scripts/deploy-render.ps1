# Deploy LeafLock Pharmacy Wholesale to Render from GitHub
# 1. Push latest code: git push
# 2. Open Render Blueprint deploy (connects GitHub repo):
$repo = "https://github.com/leaflock420-weedman/leaflock-pharmacy-wholesale"
$deployUrl = "https://render.com/deploy?repo=$([uri]::EscapeDataString($repo))"
Write-Host "Opening Render deploy for: $repo"
Start-Process $deployUrl
Write-Host ""
Write-Host "After deploy:"
Write-Host "  Staging:  https://leaflock-pharmacy-wholesale.onrender.com"
Write-Host "  Admin:    https://leaflock-pharmacy-wholesale.onrender.com/admin/"
Write-Host "  Production (after DNS): https://med.leaflock.com.au"
Write-Host "  Admin:    set ANALYTICS_ADMIN_PASSWORD on Render (not in repo)"
Write-Host ""
Write-Host "DNS cutover: run scripts/check-dns-cutover.ps1"
Write-Host "When ready: CNAME med -> leaflock-pharmacy-wholesale.onrender.com (remove Wix pointing)"