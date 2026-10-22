// Checks the leaderboard's core guarantee: a submission is only accepted if the server can independently
// verify the claimed transaction actually exists on chain, was signed by that username, and matches the
// claimed score — never just trusting what the client says it posted.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'leaderboard.json');
if (fs.existsSync(FILE)) fs.unlinkSync(FILE); // start clean, restore/remove at the end

(async () => {
  // a tiny fake chain: a map of txId -> transaction, and a .call() that serves get_transaction from it
  const fakeTxs = {
    'tx-alice-900': { operations: [['custom_json', { id: 'hive_block_producer', required_posting_auths: ['alice'], json: JSON.stringify({ score: 0.9, lines: 10 }) }]] },
    'tx-alice-500': { operations: [['custom_json', { id: 'hive_block_producer', required_posting_auths: ['alice'], json: JSON.stringify({ score: 0.5, lines: 5 }) }]] },
    'tx-bob-700': { operations: [['custom_json', { id: 'hive_block_producer', required_posting_auths: ['bob'], json: JSON.stringify({ score: 0.7, lines: 7 }) }]] },
    'tx-wrong-app': { operations: [['custom_json', { id: 'some_other_app', required_posting_auths: ['alice'], json: '{"score":0.9}' }]] },
    'tx-wrong-signer': { operations: [['custom_json', { id: 'hive_block_producer', required_posting_auths: ['mallory'], json: '{"score":0.9}' }]] },
    'tx-vote-only': { operations: [['vote', { voter: 'alice', author: 'bob', permlink: 'x' }]] },
  };
  const fakeClient = { call: async (api, method, params) => { if (method !== 'get_transaction') throw new Error('unexpected call'); const tx = fakeTxs[params[0]]; if (!tx) throw new Error('not found'); return tx; } };

  delete require.cache[require.resolve('./leaderboard')];
  const { submitScore, getLeaderboard, verifyOnChainScore } = require('./leaderboard');

  // happy path: a real matching transaction is accepted
  let r = await submitScore({ username: 'alice', txId: 'tx-alice-900', score: 0.9 }, fakeClient);
  assert.ok(r.ok && r.replaced, 'valid first submission should be accepted');
  assert.deepStrictEqual(getLeaderboard().map(e => e.username), ['alice'], 'alice should be on the board');

  // a second, LOWER score from the same player must not overwrite their personal best
  r = await submitScore({ username: 'alice', txId: 'tx-alice-500', score: 0.5 }, fakeClient);
  assert.ok(r.ok && !r.replaced, 'a worse run should be accepted as valid but not replace the best');
  assert.strictEqual(getLeaderboard().find(e => e.username === 'alice').score, 0.9, 'alices best score must stay 0.9');

  // a second player is added and the board sorts by score descending
  r = await submitScore({ username: 'bob', txId: 'tx-bob-700', score: 0.7 }, fakeClient);
  assert.ok(r.ok && r.replaced);
  assert.deepStrictEqual(getLeaderboard().map(e => e.username), ['alice', 'bob'], 'leaderboard must be sorted best-first');

  // a nonexistent transaction id is rejected
  r = await verifyOnChainScore({ username: 'alice', txId: 'tx-does-not-exist', score: 0.9 }, fakeClient);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'tx-not-found');

  // a real transaction, but for a different app (not hive_block_producer), is rejected
  r = await verifyOnChainScore({ username: 'alice', txId: 'tx-wrong-app', score: 0.9 }, fakeClient);
  assert.strictEqual(r.reason, 'no-matching-custom-json');

  // a real hive_block_producer custom_json, but not actually signed by the claimed username
  r = await verifyOnChainScore({ username: 'alice', txId: 'tx-wrong-signer', score: 0.9 }, fakeClient);
  assert.strictEqual(r.reason, 'no-matching-custom-json');

  // a transaction with no custom_json operation at all (e.g. just a vote)
  r = await verifyOnChainScore({ username: 'alice', txId: 'tx-vote-only', score: 0.9 }, fakeClient);
  assert.strictEqual(r.reason, 'no-matching-custom-json');

  // claiming a score that doesn't match what the transaction actually contains
  r = await verifyOnChainScore({ username: 'alice', txId: 'tx-alice-900', score: 99.9 }, fakeClient);
  assert.strictEqual(r.reason, 'score-mismatch', 'inflating the claimed score vs. the real on-chain payload must be rejected');

  fs.unlinkSync(FILE);
  console.log('leaderboard tests passed');
})().catch(e => { console.error(e); try { fs.unlinkSync(FILE); } catch (_e) {} process.exit(1); });
