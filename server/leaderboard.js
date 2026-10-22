// Shared, verified leaderboard (roadmap step 3): a player who has already broadcast a score on-chain via
// HBPAuth.postScore() can submit it here too. The server independently fetches that transaction from the
// chain and checks it actually contains the claimed custom_json before trusting it — the client reporting
// "I posted this score" is never taken at face value. No monetary value attached (see project memory:
// token/HP-reserve idea is announcement-only for now, not implemented).
const fs = require('fs');
const path = require('path');
const { defaultClient } = require('./hive-verify');

const FILE = path.join(__dirname, 'leaderboard.json');
const HISTORY_FILE = path.join(__dirname, 'leaderboard-history.json');
const APP_ID = 'hive_block_producer'; // must match HBPAuth.APP_ID in net/hive-auth.js
const MAX_ENTRIES = 50;
const MAX_HISTORY = 5000; // every valid submission, not just personal bests — powers period filters below

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data.entries) ? data.entries : [];
  } catch (e) { return []; }
}
function save(entries) {
  fs.writeFileSync(FILE, JSON.stringify({ updatedAt: new Date().toISOString(), entries }, null, 1));
}

// Every valid submission is appended here (unlike leaderboard.json, which only keeps each player's
// personal best). This is what lets 'daily'/'weekly' leaderboards reflect runs from that window, not just
// an all-time best that may be weeks old. Capped at MAX_HISTORY, oldest dropped first.
function loadHistory() {
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    return Array.isArray(data.entries) ? data.entries : [];
  } catch (e) { return []; }
}
function saveHistory(entries) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), entries: entries.slice(-MAX_HISTORY) }, null, 1));
}

const PERIOD_MS = { daily: 24 * 3600e3, weekly: 7 * 24 * 3600e3 };
function periodCutoffISO(period) {
  const ms = PERIOD_MS[period];
  return ms ? new Date(Date.now() - ms).toISOString() : null; // null = no cutoff (alltime)
}

// Reduces a list of (possibly repeated) submissions down to each player's best score within that list.
function bestPerUser(list) {
  const best = new Map();
  for (const e of list) {
    const cur = best.get(e.username);
    if (!cur || cur.score < e.score) best.set(e.username, e);
  }
  return Array.from(best.values()).sort((a, b) => b.score - a.score);
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

  const entry = { username, score, txId, at: new Date().toISOString() };

  // every valid submission counts toward period leaderboards, regardless of whether it's an all-time best
  const hist = loadHistory();
  hist.push(entry);
  saveHistory(hist);

  const entries = load();
  const existingIdx = entries.findIndex(e => e.username === username);
  if (existingIdx === -1) entries.push(entry);
  else if (entries[existingIdx].score < score) entries[existingIdx] = entry; // only replace with a better run
  else return { ok: true, replaced: false }; // valid submission, just not a personal best — nothing to change

  entries.sort((a, b) => b.score - a.score);
  save(entries.slice(0, MAX_ENTRIES));
  return { ok: true, replaced: true };
}

// Unchanged on purpose: existing callers (relay.js's plain GET /leaderboard, the original test suite) use
// this for the all-time personal-best board exactly as before.
function getLeaderboard(limit = 20) {
  return load().slice(0, limit).map(({ username, score, at }) => ({ username, score, at }));
}

// New: a period-aware board ('daily' | 'weekly' | 'alltime', default 'alltime'), with pagination.
// 'alltime' reuses the same personal-best entries as getLeaderboard() above, just paginated differently;
// 'daily'/'weekly' recompute each player's best *within that window* from the full submission history.
function getLeaderboardPeriod({ period = 'alltime', limit = 20, offset = 0 } = {}) {
  const list = period === 'alltime' ? load() : bestPerUser(filterSince(loadHistory(), periodCutoffISO(period)));
  return {
    period,
    total: list.length,
    entries: list.slice(offset, offset + limit).map(({ username, score, at }) => ({ username, score, at })),
  };
}
function filterSince(list, cutoffISO) {
  return cutoffISO ? list.filter(e => e.at >= cutoffISO) : list;
}

// A specific player's rank within a period, even if they're outside the page a client happened to fetch.
// Returns null if that player has no qualifying submission in that window.
function getRank(username, period = 'alltime') {
  const list = period === 'alltime' ? load() : bestPerUser(filterSince(loadHistory(), periodCutoffISO(period)));
  const idx = list.findIndex(e => e.username === username);
  if (idx === -1) return null;
  return { rank: idx + 1, score: list[idx].score, total: list.length };
}

module.exports = { submitScore, getLeaderboard, getLeaderboardPeriod, getRank, verifyOnChainScore, APP_ID };
