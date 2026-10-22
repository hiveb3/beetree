// Shared, verified leaderboard (roadmap step 3): a player who has already broadcast a score on-chain via
// HBPAuth.postScore() can submit it here too. The server independently fetches that transaction from the
// chain and checks it actually contains the claimed custom_json before trusting it — the client reporting
// "I posted this score" is never taken at face value. No monetary value attached (see project memory:
// token/HP-reserve idea is announcement-only for now, not implemented).
const fs = require('fs');
const path = require('path');
const { defaultClient } = require('./hive-verify');

const FILE = path.join(__dirname, 'leaderboard.json');
const APP_ID = 'hive_block_producer'; // must match HBPAuth.APP_ID in net/hive-auth.js
const MAX_ENTRIES = 50;

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data.entries) ? data.entries : [];
  } catch (e) { return []; }
}
function save(entries) {
  fs.writeFileSync(FILE, JSON.stringify({ updatedAt: new Date().toISOString(), entries }, null, 1));
}

// Verifies a transaction id actually exists on chain, was signed by `username`, and contains a
// hive_block_producer custom_json whose payload matches the claimed stats (so a player can't just make up
// a txId or inflate the score they report alongside a real-but-different transaction).
async function verifyOnChainScore({ username, txId, score }, client = defaultClient()) {
  if (!username || !txId || typeof score !== 'number') return { ok: false, reason: 'missing-fields' };
  let tx;
  try { tx = await client.call('condenser_api', 'get_transaction', [txId]); }
  catch (e) { return { ok: false, reason: 'tx-not-found' }; }
  if (!tx || !Array.isArray(tx.operations)) return { ok: false, reason: 'tx-not-found' };

  const op = tx.operations.find(([type, data]) =>
    type === 'custom_json' && data.id === APP_ID &&
    Array.isArray(data.required_posting_auths) && data.required_posting_auths.includes(username));
  if (!op) return { ok: false, reason: 'no-matching-custom-json' };

  let payload;
  try { payload = JSON.parse(op[1].json); } catch (e) { return { ok: false, reason: 'bad-payload' }; }
  // the client rounds score to 3dp when it builds postScore()'s payload (see net/hive-auth.js) — match that
  if (Math.abs(Number(payload.score) - score) > 0.0005) return { ok: false, reason: 'score-mismatch' };

  return { ok: true, payload };
}

async function submitScore({ username, txId, score }, client) {
  const v = await verifyOnChainScore({ username, txId, score }, client).catch(() => ({ ok: false, reason: 'node-error' }));
  if (!v.ok) return v;

  const entries = load();
  const existingIdx = entries.findIndex(e => e.username === username);
  const entry = { username, score, txId, at: new Date().toISOString() };
  if (existingIdx === -1) entries.push(entry);
  else if (entries[existingIdx].score < score) entries[existingIdx] = entry; // only replace with a better run
  else return { ok: true, replaced: false }; // valid submission, just not a personal best — nothing to change

  entries.sort((a, b) => b.score - a.score);
  save(entries.slice(0, MAX_ENTRIES));
  return { ok: true, replaced: true };
}

function getLeaderboard(limit = 20) {
  return load().slice(0, limit).map(({ username, score, at }) => ({ username, score, at }));
}

module.exports = { submitScore, getLeaderboard, verifyOnChainScore, APP_ID };
