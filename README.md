# LeafLock Pharmacy Wholesale (med.leaflock.com.au)

Multi-page pharmacy wholesale site with gated pricing, TGA-conscious copy, SEO landing pages, and built-in analytics.

**GitHub:** https://github.com/leaflock420-weedman/leaflock-pharmacy-wholesale

**Render (live):** https://leaflock-pharmacy-wholesale.onrender.com  
**Analytics:** https://leaflock-pharmacy-wholesale.onrender.com/admin/ → password `LeafLock2026`

### Deploy / update on Render

1. Code is on GitHub — push updates: `git push`
2. First-time deploy: open [Render Deploy Blueprint](https://render.com/deploy?repo=https://github.com/leaflock420-weedman/leaflock-pharmacy-wholesale)
3. Connect your GitHub account → approve repo → Render builds automatically
4. Set optional env vars in Render dashboard: `ANALYTICS_EMAIL_TO`, `SMTP_*` for daily email reports
5. Custom domain: add `med.leaflock.com.au` in Render → DNS CNAME to `leaflock-pharmacy-wholesale.onrender.com`

## Analytics login

- URL: `/admin/`
- Password: **LeafLock2026** (edit `admin-settings.json`)
- Must run **`npm start`** — Python `http.server` will not work for login/analytics

## Preview

```powershell
Set-Location "C:\Users\wordo\Documents\Codex\2026-07-02\help-me-update-my-other-website"
python -m http.server 4173 --bind 127.0.0.1
```

Open: http://127.0.0.1:4173/

## Pages (SEO)

| Page | URL | Public? |
|------|-----|---------|
| Home hub | `index.html` | Yes |
| Humidity packs | `humidity-packs.html` | Yes — no pricing |
| Gummies (new) | `gummies.html` | Yes — no pricing |
| Request access | `request-access.html` | Yes — signup form |
| Wholesale portal | `portal.html` | Login required — pricing + orders |
| Lab disclosure | `lab-disclosure.html` | Yes — chart + disclaimers |

## Approval workflow

1. Pharmacy submits **Request Access** form → email to `med@leaflock.com.au`
2. You review ABN + pharmacy registration
3. Email the pharmacy an access code from `assets/config.js`
4. They enter the code at **portal.html** → pricing and order form unlock

### Adding access codes

Edit `assets/config.js`:

```js
ACCESS_CODES: [
  "LEAFLOCK-PHARM-2026",      // master code
  "MIDLAND-PHARM-A1B2",       // per-pharmacy code (optional)
],
```

Redeploy after adding codes. Test login code: `LEAFLOCK-PHARM-2026`

## Analytics (Wix-style traffic, on your site)

### Live dashboard
- URL: `/admin/`
- Password: **LeafLock2026** locally (`admin-settings.json`) or `ANALYTICS_ADMIN_PASSWORD` on Render
- Shows: **live visitors**, pageviews, sessions, Google/email/referrer sources, top pages, 7-day chart

### Daily email report
Automatic email every morning (~7am Brisbane if `TZ=Australia/Brisbane`).

Set these env vars on Render (or `.env` locally):

```env
ANALYTICS_ADMIN_PASSWORD=your-secure-password
ANALYTICS_EMAIL_TO=you@leaflock.com.au
ANALYTICS_EMAIL_FROM=med@leaflock.com.au
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=med@leaflock.com.au
SMTP_PASS=your-app-password
```

Use Gmail app password, Microsoft 365 SMTP, or your domain host's SMTP.

Optional: add `GA_MEASUREMENT_ID: "G-XXXX"` in `assets/config.js` for Google Analytics 4 alongside built-in tracking.

### Run with analytics (not plain Python server)

```powershell
npm install
npm start
```

## Files

- `server.js` — static site + analytics API + daily email cron
- `admin/` — live traffic dashboard
- `assets/analytics.js` — pageview + CTA tracking on every page
- `assets/layout.js` — shared header/footer
- `assets/access.js` — login gate (localStorage + access codes)
- `assets/signup.js` — request access form
- `assets/portal.js` — pricing calculator + order form
- `assets/charts.js` — lab disclosure chart
- `assets/config.js` — email + access codes (admin)