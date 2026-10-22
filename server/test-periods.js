const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'leaderboard.json');
const HISTORY_FILE = path.join(__dirname, 'leaderboard-history.json');
for (const f of [FILE, HISTORY_FILE]) if (fs.existsSync(f)) fs.unlinkSync(f);

(async () => {
  const fakeTxs = {
    't1': { operations: [['custom_json', { id: 'hive_block_producer', required_posting_auths: ['alice'], json: JSON.stringify({ score: 0.3 }) }]] },
    't2': { operations: [['custom_json', { id: 'hive_block_producer', required_posting_auths: ['bob'], json: JSON.stringify({ score: 0.9 }) }]] },
  };
  const fakeClient = { call: async (api, method, params) => { const tx = fakeTxs[params[0]]; if (!tx) throw new Error('not found'); return tx; } };

  delete require.cache[require.resolve('./leaderboard')];
  const { submitScore, getLeaderboardPeriod, getRank } = require('./leaderboard');

  await submitScore({ username: 'alice', txId: 't1', score: 0.3 }, fakeClient);
  await submitScore({ username: 'bob', txId: 't2', score: 0.9 }, fakeClient);

  // alltime board has both, sorted by score
  let board = getLeaderboardPeriod({ period: 'alltime' });
  assert.deepStrictEqual(board.entries.map(e => e.username), ['bob', 'alice'], 'alltime should rank bob first');
  assert.strictEqual(board.total, 2);

  // daily board should also have both (just submitted)
  board = getLeaderboardPeriod({ period: 'daily' });
  assert.deepStrictEqual(board.entries.map(e => e.username), ['bob', 'alice'], 'daily should include recent submissions');

  // pagination: limit 1, offset 1 should return just alice
  board = getLeaderboardPeriod({ period: 'alltime', limit: 1, offset: 1 });
  assert.deepStrictEqual(board.entries.map(e => e.username), ['alice'], 'pagination should skip the first entry');

  // rank lookups
  let r = getRank('bob', 'alltime');
  assert.deepStrictEqual(r, { rank: 1, score: 0.9, total: 2 });
  r = getRank('alice', 'alltime');
  assert.strictEqual(r.rank, 2);
  r = getRank('charlie', 'alltime');
  assert.strictEqual(r, null, 'unknown player should have no rank');

  // weekly period with an artificially old history entry should exclude it
  const histRaw = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  histRaw.entries.push({ username: 'oldtimer', score: 99, txId: 'old', at: new Date(Date.now() - 30 * 24 * 3600e3).toISOString() });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(histRaw));
  board = getLeaderboardPeriod({ period: 'weekly' });
  assert.ok(!board.entries.some(e => e.username === 'oldtimer'), 'a 30-day-old submission must not appear in the weekly board');

  for (const f of [FILE, HISTORY_FILE]) if (fs.existsSync(f)) fs.unlinkSync(f);
  console.log('period/rank tests passed');
})().catch(e => { console.error(e); for (const f of [FILE, HISTORY_FILE]) { try { fs.unlinkSync(f); } catch (_e) {} } process.exit(1); });
