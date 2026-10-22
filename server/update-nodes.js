// Refreshes nodes.json from the community-run Hive node health beacon (beacon.peakd.com), so the login
// verifier's RPC fallback list stays current without a manual edit + redeploy every time a node goes down
// or a new reliable one appears. Run periodically (see cron setup in README); safe to run by hand too.
//
// Falls back to doing nothing (keeps the existing nodes.json / DEFAULT_NODES) if the beacon is unreachable
// or returns something unexpected — a stale-but-working list is always better than an empty one.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const BEACON_URL = 'https://beacon.peakd.com/api/nodes?limit=50';
const OUT_FILE = path.join(__dirname, 'nodes.json');
const MIN_SCORE = 90;       // beacon score 0-100; only trust nodes that are consistently healthy
const MAX_NODES = 6;        // enough for real redundancy without a long failover chain on every request
const REQUIRE_FEATURE = 'get_account_history'; // a reasonable proxy for "general-purpose node", not a bare witness/API-light node

// Both Node 18's native fetch() (undici) AND the plain https module hit intermittent connect timeouts to
// this particular host from this VPS, while curl consistently connects in well under a second every time
// tested. Shelling out to curl sidesteps whatever is going on at the Node HTTP-stack level entirely.
async function httpsGetJson(url, timeoutMs = 10000) {
  const { stdout } = await execFileAsync('curl', ['-s', '--max-time', String(Math.ceil(timeoutMs / 1000)), '-f', url]);
  return JSON.parse(stdout);
}

async function main() {
  let nodes;
  try {
    nodes = await httpsGetJson(BEACON_URL);
    if (!Array.isArray(nodes)) throw new Error('unexpected beacon response shape');
  } catch (e) {
    console.error('update-nodes: beacon fetch failed, leaving nodes.json untouched:', e.message);
    return;
  }

  const good = nodes
    .filter(n => n && typeof n.endpoint === 'string' && typeof n.score === 'number')
    .filter(n => n.score >= MIN_SCORE)
    .filter(n => !REQUIRE_FEATURE || (Array.isArray(n.features) && n.features.includes(REQUIRE_FEATURE)))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_NODES)
    .map(n => n.endpoint);

  if (good.length < 2) {
    console.error(`update-nodes: only ${good.length} node(s) met the bar, leaving nodes.json untouched (too risky to overwrite with a short list)`);
    return;
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), nodes: good }, null, 1));
  console.log(`update-nodes: wrote ${good.length} nodes to ${OUT_FILE}:`, good.join(', '));
}

main();
