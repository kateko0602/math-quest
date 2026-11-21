/* 효과음 — Web Audio API (아이폰 사파리 포함)
   ─────────────────────────────────────────────────────
   · 첫 터치에서 오디오를 깨웁니다(iOS 정책). 그래서 첫 버튼부터 소리가 납니다.
   · 모든 소리는 코드로 합성 → 파일 0개, 용량 0KB.
   · 켜기/끄기는 localStorage('ema.sound.v1')에 저장.
   EMA.sfx.play('correct') / EMA.sfx.toggle() / EMA.sfx.on()
*/
window.EMA = window.EMA || {};
(function () {
  const KEY = 'ema.sound.v1';
  let ctx = null, master = null, unlocked = false;
  let lastGesture = 0;
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  /** 매 사용자 제스처마다 호출 — iOS 잠금 해제 + 잠긴 뒤 다시 살리기(v0.4)
      · 예전에는 unlocked=true 뒤로는 아무것도 안 해서, 다른 앱에 갔다 오거나
        전화를 받고 돌아와 ctx.state가 'suspended'가 되면 소리가 영영 안 났습니다.
      · 이제는 제스처마다 'suspended'면 resume()을 다시 부릅니다. */
  function unlock() {
    const c = ensure();
    if (!c) return;
    lastGesture = Date.now();
    try {
      if (c.state === 'suspended' && c.resume) {
        const p = c.resume();
        if (p && p.catch) p.catch(() => { });
      }
      if (!unlocked) {
        const b = c.createBuffer(1, 1, c.sampleRate);
        const src = c.createBufferSource();
        src.buffer = b;
        src.connect(master);
        src.start(0);
        unlocked = true;
      }
    } catch (e) { }
  }
  document.addEventListener('pointerdown', unlock, { once: false, passive: true });
  document.addEventListener('touchstart', unlock, { once: false, passive: true });
  document.addEventListener('keydown', unlock, { once: false });
  /* 백그라운드에서 돌아오면 다시 깨우기 (제스처 없이도 가능한 경우가 있어 시도) */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    const c = ensure();
    if (!c) return;
    try { if (c.state === 'suspended' && c.resume) { const p = c.resume(); if (p && p.catch) p.catch(() => { }); } } catch (e) { }
  });

  /** 기본음 */
  function tone(freq, dur, opt) {
    const c = ensure();
    if (!c || !enabled) return;
    try { if (c.state === 'suspended' && c.resume) { const p = c.resume(); if (p && p.catch) p.catch(() => { }); } } catch (e) { }
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + (opt.delay || 0);
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(30, opt.to), t + dur);
    const vol = (opt.gain == null ? 0.16 : opt.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  /** 잡음(타격감) */
  function noise(dur, gain, filterHz) {
    const c = ensure();
    if (!c || !enabled) return;
    try { if (c.state === 'suspended' && c.resume) { const p = c.resume(); if (p && p.catch) p.catch(() => { }); } } catch (e) { }
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterHz || 1200;
    const g = c.createGain();
    g.gain.value = gain == null ? 0.12 : gain;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  const recipes = {
    tap() { tone(660, 0.05, { type: 'triangle', gain: 0.06 }); },
    coin() { tone(988, 0.06, { type: 'square', gain: 0.05 }); tone(1319, 0.09, { type: 'square', gain: 0.045, delay: 0.05 }); },
    correct() { tone(784, 0.09, { type: 'triangle', gain: 0.16 }); tone(1175, 0.14, { type: 'triangle', gain: 0.14, delay: 0.08 }); },
    wrong() { tone(220, 0.16, { type: 'sawtooth', to: 120, gain: 0.13 }); noise(0.1, 0.06, 700); },
    hit() { noise(0.16, 0.16, 900); tone(140, 0.14, { type: 'square', to: 70, gain: 0.1 }); },
    crit() { noise(0.12, 0.14, 1600); tone(880, 0.1, { type: 'square', to: 1500, gain: 0.09 }); tone(1400, 0.14, { type: 'triangle', gain: 0.08, delay: 0.06 }); },
    shield() { tone(300, 0.35, { type: 'sine', to: 90, gain: 0.16 }); tone(150, 0.4, { type: 'sawtooth', to: 60, gain: 0.09 }); },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.14, delay: i * 0.09 }));
      tone(1568, 0.35, { type: 'triangle', gain: 0.1, delay: 0.38 });
    },
    hatch() {
      [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.12, { type: 'sine', gain: 0.11, delay: i * 0.06 }));
      noise(0.12, 0.05, 3000);
    },
    legendary() {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.13, delay: i * 0.08 }));
      tone(2093, 0.5, { type: 'sine', gain: 0.09, delay: 0.52 });
      noise(0.3, 0.05, 5000);
    },
    bossdown() {
      tone(180, 0.5, { type: 'sawtooth', to: 50, gain: 0.16 });
      noise(0.4, 0.14, 600);
      [392, 523, 659].forEach((f, i) => tone(f, 0.25, { type: 'triangle', gain: 0.1, delay: 0.3 + i * 0.1 }));
    },
    stamp() { noise(0.08, 0.14, 500); tone(180, 0.12, { type: 'square', to: 90, gain: 0.1 }); },
    levelup() { [523, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'sine', gain: 0.12, delay: i * 0.08 })); }
  };

  const sfx = {
    play(name) {
      if (!enabled) return;
      const fn = recipes[name];
      if (!fn) return;
      try { unlock(); fn(); } catch (e) { }
    },
    on() { return enabled; },
    state() { const c = ensure(); return c ? c.state : 'none'; },
    set(v) {
      enabled = !!v;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { }
      if (enabled) { unlock(); sfx.play('tap'); }
    },
    toggle() { sfx.set(!enabled); return enabled; }
  };
  EMA.sfx = sfx;
})();
