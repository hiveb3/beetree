# Hive Block Producer reference server

Small Node service for versus play and Hive login. See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

- `relay.js`: HTTP endpoints `GET /auth/challenge` and `POST /auth/verify`, plus a WebSocket relay that forwards
  protocol v1 messages between players in the same room. Also applies basic anti-cheat plausibility checks
  to reported line clears (rate limits, not a full replay — see docs/ARCHITECTURE.md).
- `hive-verify.js`: checks that a Keychain signature recovers to one of the account's posting keys on chain,
  using the RPC node list from `nodes.json` if present (falls back to a small static list otherwise).
- `update-nodes.js`: refreshes `nodes.json` from the community-run node health beacon
  (beacon.peakd.com), keeping only nodes with a high health score. Run it periodically (see cron
  example below) so the fallback list self-heals without a manual edit + redeploy every time a public
  node goes down or a better one appears. `nodes.json` is gitignored — it's generated, not source.
- `leaderboard.js` + `GET /leaderboard` / `POST /leaderboard/submit`: a shared public leaderboard
  (roadmap step 3). A submission is never trusted at face value — the server independently fetches the
  claimed transaction from chain and checks it's really a `hive_block_producer` custom_json signed by
  that username with a matching score before accepting it. `leaderboard.json` is gitignored (generated).
  No monetary value is attached to leaderboard position (see project notes on the token idea — intentionally
  announcement-only for now, not implemented).
- `test.js` / `test-leaderboard.js`: end-to-end checks (`npm test` runs both) with a throwaway key and a
  fake chain lookup.

Environment: `PORT` (default 8787), `ALLOWED_ORIGIN` (default `https://d-bot-2026.github.io`),
`LOCAL_HIVE_NODE` (optional — if this server happens to run alongside its own full hived node on the
same host, e.g. a witness node, set this to its local RPC address and it's always tried first, before
the public fallback list).
Sessions and rooms live in memory; restart clears them. Use a database before running more than one instance.

### Keeping the node list fresh

Run once to generate the initial `nodes.json`, then schedule it periodically (every few hours is plenty —
node health doesn't change that fast):

```
node update-nodes.js
# crontab -e, then add a line like:
0 */6 * * * cd /opt/hive-block-producer/server && /usr/bin/node update-nodes.js >> /var/log/hbp-update-nodes.log 2>&1
```

No restart of `relay.js` is needed after an update — `hive-verify.js` reads `nodes.json` fresh on every
login verification, not once at startup.
