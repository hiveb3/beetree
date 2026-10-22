/* Hive Block Producer: Hive login module (not wired into the UI yet).
 *
 * What it does: proves a player controls a Hive account by having their wallet sign a one-time challenge
 * with the account's posting key. The game never sees a private key.
 *
 * Today: Hive Keychain (browser extension, and the Keychain mobile app's in-app browser).
 * Next:  HiveSigner and HiveAuth through the Aioha library, behind the same login() call.
 *
 * Trust model: the signature only counts once a server has checked it (server/hive-verify.js). Without a
 * server the session is marked verified:false and must be treated like a self-chosen nickname.
 *
 * Usage:
 *   await HBPAuth.login('alice', { server: 'https://api.example.com' });
 *   HBPAuth.current();   // { username, method, verified, token, at } or null
 *   HBPAuth.logout();
 *   await HBPAuth.postScore({ total, lines, hf, seconds, seed });   // optional on-chain record, see docs/ARCHITECTURE.md
 */
(function () {
  'use strict';
  const SESSION_KEY = 'hbp-session';
  const APP_ID = 'hive_block_producer'; // custom_json id for on-chain score records
  // Hive account names: 3 to 16 chars, lowercase, dot-separated segments that start with a letter
  const NAME_RE = /^(?=.{3,16}$)[a-z][a-z0-9-]*[a-z0-9](\.[a-z][a-z0-9-]*[a-z0-9])*$/;
  const listeners = [];

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; } },
    set(v) { try { if (v) localStorage.setItem(SESSION_KEY, JSON.stringify(v)); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* storage unavailable */ } },
  };
  const changed = s => listeners.forEach(fn => { try { fn(s); } catch (e) { /* ignore */ } });
  const isValidName = name => NAME_RE.test(String(name || '').trim().toLowerCase());
  // anonymous event counts through the game's analytics (event name only, never the account name)
  const report = name => { try { if (window.HBP && window.HBP.track) window.HBP.track(name); } catch (e) { /* ignore */ } };
  const hasKeychain = () => typeof window !== 'undefined' && !!window.hive_keychain;

  function keychainSign(username, message) {
    return new Promise((resolve, reject) => {
      if (!hasKeychain()) { reject(new Error('keychain-missing')); return; }
      window.hive_keychain.requestSignBuffer(username, message, 'Posting', res => {
        if (res && res.success) resolve({ signature: res.result, publicKey: res.publicKey || (res.data && res.data.publicKey) || null });
        else reject(new Error((res && (res.error || res.message)) || 'sign-rejected'));
      });
    });
  }

  async function getChallenge(username, server) {
    if (server) {
      const r = await fetch(`${server}/auth/challenge?user=${encodeURIComponent(username)}`, { credentials: 'omit' });
      if (!r.ok) throw new Error('challenge-failed');
      return (await r.json()).challenge;
    }
    // offline fallback: still signed by the wallet, but nobody checks it, so the session stays unverified
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
    return `hive-block-producer login\naccount: ${username}\ntime: ${new Date().toISOString()}\nnonce: ${nonce}`;
  }

  async function login(username, opts = {}) {
    try { const session = await doLogin(username, opts); report('hive-login'); return session; } catch (e) { report('hive-login-fail'); throw e; }
  }
  async function doLogin(username, opts) {
    const name = String(username || '').trim().toLowerCase().replace(/^@/, '');
    if (!isValidName(name)) throw new Error('invalid-name');
    const method = opts.method || 'keychain';
    if (method !== 'keychain') throw new Error('method-not-ready'); // HiveSigner / HiveAuth arrive with Aioha
    const challenge = await getChallenge(name, opts.server);
    const { signature, publicKey } = await keychainSign(name, challenge);
    let session = { username: name, method, verified: false, token: null, at: Date.now() };
    if (opts.server) {
      const r = await fetch(`${opts.server}/auth/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
        body: JSON.stringify({ username: name, challenge, signature, publicKey }),
      });
      let v; try { v = await r.json(); } catch (e) { v = {}; }
      if (!r.ok || !v.ok) throw new Error(`verify-failed: ${v.reason || r.status}`);
      session = { ...session, verified: true, token: v.token || null };
    }
    store.set(session); changed(session);
    return session;
  }

  function logout() { store.set(null); changed(null); }
  function current() { return store.get(); }
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

  // Optional on-chain score record. Posting authority only, costs Resource Credits, not HIVE.
  // Always ask the player first: chain data is public and permanent.
  function postScore(stats) {
    const s = current();
    return new Promise((resolve, reject) => {
      if (!s) { reject(new Error('not-logged-in')); return; }
      if (!hasKeychain()) { reject(new Error('keychain-missing')); return; }
      const payload = {
        app: `hive-block-producer/${(window.HBP && window.HBP.version()) || 'dev'}`,
        score: Number((stats.total / 1000).toFixed(3)), lines: stats.lines | 0, hf: stats.hf | 0,
        seconds: stats.seconds | 0, seed: stats.seed >>> 0,
      };
      window.hive_keychain.requestCustomJson(s.username, APP_ID, 'Posting', JSON.stringify(payload), 'Hive Block Producer score', res => {
        if (res && res.success) report('hive-score-post');
        if (res && res.success) resolve({ txId: res.result && (res.result.id || res.result.tx_id), payload });
        else reject(new Error((res && (res.error || res.message)) || 'broadcast-rejected'));
      });
    });
  }

  window.HBPAuth = { APP_ID, isValidName, hasKeychain, login, logout, current, onChange, postScore };
})();
