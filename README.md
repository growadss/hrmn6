# Tamil Harmonic Trader Raj — Vercel + Meta Pixel/CAPI

## Deploy
1. Upload this **entire folder** to GitHub (keep `index.html`, `api/capi.js`, and `vercel.json` in the repository root).
2. Import the GitHub repository in Vercel. Framework Preset: **Other**; no build command required.
3. In Vercel → Project → Settings → Environment Variables, add `META_CAPI_TOKEN` with your Meta Events Manager Conversions API access token. Do not put the token in HTML or GitHub.
4. Redeploy after adding the variable.
5. In Meta Events Manager → Test Events, test PageView and a manual button click. For test mode, temporarily set `META_TEST_EVENT_CODE` in Vercel, redeploy, and remove it afterward.

## Tracking behavior
- Page load: Pixel PageView + server CAPI PageView (same event_id).
- Manual JOIN FREE TELEGRAM CHANNEL click: Pixel Subscribe + server CAPI Subscribe (same event_id).
- 10-second automatic redirect: **no Subscribe event**. The initial PageView still counts.
- Subscribe measures CTA clicks, not confirmed Telegram joins.
- Server sends IP/user agent and browser `_fbp`/`_fbc` when available; Meta deduplicates using event name + event ID.

## Notes
- Keep `/api/capi.js` server-side. Never expose `META_CAPI_TOKEN` publicly.
- This is not a guarantee of Meta ad approval or accurate attribution for all browsers.
- Vercel must deploy the entire project, not just `index.html`, for CAPI to work.
