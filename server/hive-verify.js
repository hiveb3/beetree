// Verifies a Hive Keychain requestSignBuffer() login: the signature over sha256(challenge) must recover to one
// of the account's current posting public keys on chain. No private key ever leaves the player's wallet.
const fs = require('fs');
const path = require('path');
const { Client, Signature, cryptoUtils } = require('@hiveio/dhive');

// Resilience over a single-provider dependency, not a local node (a full/low-mem hived node needs 400-600GB+
// for the block log alone and days to sync — the VPS has 241GB free, so public RPC fallbacks was the
// practical choice; see project_hbp_tetris_deploy memory for the trade-off discussion).
// This list is a last-resort fallback if nodes.json (kept fresh by update-nodes.js from the community
// beacon.peakd.com health service, see its own comments) is missing, empty or unreadable.
// anyx.io dropped 2026-10-22: HTTP 502, destabilized dhive's failover across the timeout window.
// hive-api.arcange.eu and rpc.ausbit.dev tested 2026-10-22 and dropped: timeout / HTTP 521 (origin down).
const STATIC_FALLBACK_NODES = [
  'https://api.hive.blog', 'https://api.deathwing.me', 'https://api.syncad.com',
  'https://api.openhive.network', 'https://techcoderx.com', 'https://api.c0ff33a.uk',
];
const NODES_FILE = path.join(__dirname, 'nodes.json');

function currentNodes() {
  let nodes;
  try {
    const data = JSON.parse(fs.readFileSync(NODES_FILE, 'utf8'));
    nodes = (Array.isArray(data.nodes) && data.nodes.length >= 2) ? data.nodes : STATIC_FALLBACK_NODES;
  } catch (e) { nodes = STATIC_FALLBACK_NODES; } // missing/corrupt nodes.json: fall through to the static list
  // Deployment-specific, not part of the generic project: if this particular server happens to be running
  // alongside its own full hived node (e.g. a witness node on the same host, reachable over localhost with
  // near-zero latency and no external dependency at all), set LOCAL_HIVE_NODE and it's always tried first.
  // Not hardcoded here, since most people running this server elsewhere won't have one.
  if (process.env.LOCAL_HIVE_NODE) return [process.env.LOCAL_HIVE_NODE, ...nodes];
  return nodes;
}

const defaultClient = () => new Client(currentNodes(), { timeout: 15000, failoverThreshold: 3 });

async function verifyLogin({ username, challenge, signature }, client = defaultClient()) {
  if (!username || !challenge || !signature) return { ok: false, reason: 'missing-fields' };
  let recovered;
  try { recovered = Signature.fromString(signature).recover(cryptoUtils.sha256(challenge)).toString(); }
  catch (e) { return { ok: false, reason: 'bad-signature' }; }
  const [account] = await client.database.getAccounts([username]);
  if (!account) return { ok: false, reason: 'no-account' };
  const postingKeys = account.posting.key_auths.map(([key]) => String(key));
  return postingKeys.includes(recovered) ? { ok: true, publicKey: recovered } : { ok: false, reason: 'key-mismatch' };
}

module.exports = { verifyLogin, defaultClient };
