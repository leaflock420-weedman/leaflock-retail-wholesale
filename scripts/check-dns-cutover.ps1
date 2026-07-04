# Checks whether med.leaflock.com.au points to Render (ready for cutover) or still Wix.
$domain = "med.leaflock.com.au"
$renderTarget = "leaflock-pharmacy-wholesale-9kbz.onrender.com"
$renderA = "216.24.57.1"

Write-Host "DNS check for $domain"
Write-Host ""

try {
  $a = Resolve-DnsName $domain -Type A -ErrorAction SilentlyContinue
  if ($a) {
    $ips = ($a | ForEach-Object { $_.IPAddress }) -join ", "
    Write-Host "A records: $ips"
    if ($ips -match [regex]::Escape($renderA)) {
      Write-Host ""
      Write-Host "STATUS: Points to Render (A $renderA) — cutover complete."
      exit 0
    }
  }

  $cname = Resolve-DnsName $domain -Type CNAME -ErrorAction Stop
  $chain = ($cname | ForEach-Object { $_.NameHost }) -join " -> "
  Write-Host "CNAME chain: $chain"

  if ($chain -match "wixdns|wix") {
    Write-Host ""
    Write-Host "STATUS: Still on Wix — not ready for production cutover."
    Write-Host "When ready, change DNS record:"
    Write-Host "  Host: med"
    Write-Host "  Type: CNAME"
    Write-Host "  Value: $renderTarget"
    exit 1
  }

  if ($chain -match "onrender") {
    Write-Host ""
    Write-Host "STATUS: Points to Render — cutover complete."
    try {
      $login = Invoke-RestMethod -Uri "https://$domain/api/analytics/login" -Method POST -ContentType "application/json" -Body '{"password":"__ping__"}' -ErrorAction Stop
    } catch {
      $code = $_.Exception.Response.StatusCode.value__
      if ($code -eq 401) {
        Write-Host "API: Admin login endpoint responding on https://$domain"
        Write-Host "You can use https://$domain/admin/"
        exit 0
      }
    }
    Write-Host "API: DNS ok but admin API not responding yet — wait a few minutes for SSL."
    exit 2
  }

  Write-Host ""
  Write-Host "STATUS: Unknown DNS target — verify manually."
  exit 2
} catch {
  Write-Host "Could not resolve CNAME for $domain"
  Write-Host $_.Exception.Message
  exit 2
}