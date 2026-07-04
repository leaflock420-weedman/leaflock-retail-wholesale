# LeafLock Retail Stockist Wholesale

Retail stockist wholesale portal for LeafLock humidity packs and DIY gummy mix — **separate from** [med.leaflock.com.au](https://med.leaflock.com.au) (pharmacy wholesale).

**GitHub:** https://github.com/leaflock420-weedman/leaflock-retail-wholesale

**Render (deploy target):** https://leaflock-retail-wholesale.onrender.com

## Local dev

```bash
cd C:\Users\wordo\LL-Wholesale
npm install
npm start
```

Default port: `4280` (set `PORT` to override).

## Deploy (new Render service)

1. Open [Render Deploy Blueprint](https://render.com/deploy?repo=https://github.com/leaflock420-weedman/leaflock-retail-wholesale)
2. Create a **new** web service — do **not** connect to `leaflock-pharmacy-wholesale` or `med.leaflock.com.au`
3. Set secrets in Render: `SMTP_PASS`, `PORTAL_SESSION_SECRET`, `ADMIN_SESSION_SECRET`, `ANALYTICS_ADMIN_PASSWORD`, etc.
4. Add a custom domain when ready (separate DNS from `med`)

## Important

- This repo must never deploy to the pharmacy Render service (`srv-d93nossvikkc73amkvv0`)
- `project.config.json` documents the isolation rules