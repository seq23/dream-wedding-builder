# Environment Variables

## APPS_SCRIPT_TREND_ENDPOINT
Optional Apps Script Web App URL for bride-submitted trend intake. If absent, `/api/submit-trend` returns a local contract success without forwarding. This is not a fake live integration claim; it is contract-ready behavior.

## APPS_SCRIPT_TREND_SECRET
Optional shared secret sent as `x-dwb-secret` to Apps Script.
