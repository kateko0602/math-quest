/* 선생님 PIN 인증 v0.8 — PIN을 코드·화면에서 없애고, 이 기기에서 해시로만 보관합니다.
   ─────────────────────────────────────────────────────────────
   · 첫 선생님 접속 때 새 PIN(4~6자리)을 직접 정합니다 → SHA-256(소금) 해시만 저장 (ema.teacher.v2)
   · 분실 대비 '비상 복구 키'(예: K7FD-2MQD)를 함께 만들어 화면에 딱 1번 보여 줍니다.
   · 선생님 로그인 세션은 12시간이 지나면 만료되어 PIN을 다시 묻습니다 (ema.session.v2.at).
*/
window.EMA = window.EMA || {};
(function () {
  const TKEY = 'ema.teacher.v2';
  const TTL_MS = 12 * 60 * 60 * 1000;      // 선생님·학생 세션 유효시간 12시간

  /* ---------- SHA-256 ---------- */
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function sha256js(msg) {
    const bytes = [];
    for (let i = 0; i < msg.length; i++) {
      const c = msg.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    bytes.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
      h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Array(64);
    const ror = (x, n) => (x >>> n) | (x << (32 - n));
    for (let i = 0; i < bytes.length; i += 64) {
      for (let t = 0; t < 16; t++) {
        w[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) | (bytes[i + t * 4 + 2] << 8) | bytes[i + t * 4 + 3];
      }
      for (let t = 16; t < 64; t++) {
        const s0 = ror(w[t - 15], 7) ^ ror(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = ror(w[t - 2], 17) ^ ror(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let t = 0; t < 64; t++) {
        const S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        const S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
        const mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  const enc = new TextEncoder();
  async function sha256hex(str) {
    try {
      if (window.crypto && crypto.subtle && crypto.subtle.digest) {
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* 아래 JS 구현으로 */ }
    return sha256js(str);
  }

  /* ---------- 무작위 ---------- */
  function randHex(n) {
    const a = new Uint8Array(n);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); }
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const RC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 헷갈리는 0·O·1·I 뺀 복구 키 글자
  function recoveryCode() {
    const a = new Uint8Array(8);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256); }
    const s = Array.from(a).map(b => RC[b % RC.length]).join('');
    return s.slice(0, 4) + '-' + s.slice(4);
  }

  /* ---------- 선생님 PIN 저장/검증 ---------- */
  function read() {
    try { return JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch (e) { return null; }
  }
  function write(o) {
    try { localStorage.setItem(TKEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  }

  const auth = {
    TTL_MS,
    REUP_KEY: 'ema.recoveryNotice.v1',

    /** 선생님 PIN을 아직 정하지 않았는지 */
    needsSetup() { const r = read(); return !(r && r.hash); },
    config() { return read(); },

    /** 새 PIN 설정 — PIN 원문은 저장하지 않습니다 */
    async setPin(pin) {
      const salt = randHex(16);
      const hash = await sha256hex(salt + ':' + String(pin));
      const old = read() || {};
      const rec = Object.assign({}, old, { salt, hash, len: String(pin).length, setAt: new Date().toISOString(), v: 1 });
      write(rec);
      return true;
    },
    async verifyPin(pin) {
      const r = read();
      if (!r || !r.hash) return false;
      const h = await sha256hex((r.salt || '') + ':' + String(pin));
      return h === r.hash;
    },
    /** 새 비상 복구 키 발급 — 화면에 1번 보여 주고, 저장은 해시로 */
    async issueRecovery() {
      const code = recoveryCode();
      const salt = randHex(16);
      const hash = await sha256hex(salt + ':' + code.replace(/[-\s]/g, '').toUpperCase());
      const r = read() || {};
      r.rsalt = salt; r.rhash = hash; r.rSetAt = new Date().toISOString();
      write(r);
      try { localStorage.setItem(auth.REUP_KEY, new Date().toISOString()); } catch (e) { }
      return code;
    },
    async verifyRecovery(code) {
      const r = read();
      if (!r || !r.rhash) return false;
      const clean = String(code || '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
      if (clean.length < 6) return false;
      const h = await sha256hex((r.rsalt || '') + ':' + clean);
      return h === r.rhash;
    },
    hasRecovery() { const r = read(); return !!(r && r.rhash); },

    /** 세션 — 12시간 지나면 없는 것으로 봅니다 */
    fresh(s) {
      if (!s) return false;
      const at = Number(s.at || 0);
      if (!at) return true;                  // 옛 세션(시간 없음)은 버립니다
      return (Date.now() - at) < TTL_MS;
    },
    stamp(s) { return s ? Object.assign({}, s, { at: Date.now() }) : s; },

    /** PIN을 잊었을 때: 복구 키 확인 → 새 PIN → 새 복구 키 */
    async resetWithRecovery(code, pin) {
      if (!(await auth.verifyRecovery(code))) return { error: '복구 키가 달라요' };
      await auth.setPin(pin);
      const rc = await auth.issueRecovery();
      return { ok: true, recovery: rc };
    }
  };

  EMA.auth = auth;
  EMA.sha256hex = sha256hex;
})();
