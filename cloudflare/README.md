# Cloudflare Worker: relay proxy

`relay-proxy-worker.js` is deployed as the Cloudflare Worker named `relay`
on the `Hive.b.three@gmail.com` account, publicly reachable at
`relay.hive-b-three.workers.dev`.

It reverse-proxies both plain HTTP (Hive login challenge/verify) and
WebSocket (versus multiplayer) traffic to the VPS origin server, hiding
the origin IP behind Cloudflare.

Not auto-deployed from this repo (no CI wiring) — redeploy manually via the
Cloudflare API if this file changes:

```
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/relay" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -F "metadata={\"main_module\":\"worker.js\",\"compatibility_date\":\"2026-10-01\"};type=application/json" \
  -F "worker.js=@relay-proxy-worker.js;type=application/javascript+module"
```
