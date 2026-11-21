/* 화면 공통 도구 */
window.EMA = window.EMA || {};
(function () {
  const ui = EMA.ui = {};
  ui.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  ui.toast = function (msg, ms) {
    const app = document.getElementById('app');
    const old = app.querySelector('.toast');
    if (old) old.remove();
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = msg;
    app.appendChild(d);
    setTimeout(() => d.remove(), ms || 2300);
  };

  ui.haptic = function () {
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { }
  };

  ui.kdate = function (iso) {
    const d = new Date(iso + 'T12:00:00');
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  };
  ui.kdow = function (iso) {
    const d = new Date(iso + 'T12:00:00');
    return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] + '요일';
  };

  /** 문제집을 찍은 듯한 플레이스홀더 사진 (예시 데이터용) */
  ui.fakePhoto = function (name, label) {
    const W = 480, H = 640;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#EFE7D8'; x.fillRect(0, 0, W, H);
    // 종이
    const m = 26;
    x.fillStyle = '#FFFDF6'; x.fillRect(m, m, W - m * 2, H - m * 2);
    x.strokeStyle = '#E8DFCB'; x.lineWidth = 1; x.strokeRect(m + .5, m + .5, W - m * 2 - 1, H - m * 2 - 1);
    // 제목
    x.fillStyle = '#3A4A6B'; x.font = 'bold 22px sans-serif';
    x.fillText(label || '6-1 발전책', m + 22, m + 44);
    x.font = '14px sans-serif'; x.fillStyle = '#7A8AA5';
    x.fillText('분수의 나눗셈', m + 22, m + 66);
    // 줄
    x.strokeStyle = '#DCE6F0';
    for (let y = m + 96; y < H - m - 40; y += 30) {
      x.beginPath(); x.moveTo(m + 16, y); x.lineTo(W - m - 16, y); x.stroke();
    }
    x.strokeStyle = '#F3C9C9';
    x.beginPath(); x.moveTo(m + 44, m + 80); x.lineTo(m + 44, H - m - 30); x.stroke();
    // 문제 번호 + 필기 흉내
    x.fillStyle = '#334155'; x.font = 'bold 16px sans-serif';
    let row = 0;
    for (let i = 1; i <= 9; i++) {
      const y = m + 118 + row * 60;
      if (y > H - m - 70) break;
      x.fillStyle = '#334155'; x.font = 'bold 16px sans-serif';
      x.fillText(String(i), m + 20, y);
      x.fillStyle = '#2B4A8B'; x.font = 'italic 19px "Comic Sans MS", sans-serif';
      const ans = ['2', '1/3', '4', '7', '3/5', '2', '5', '1/2', '6'][i - 1];
      x.fillText('= ' + ans, m + 70, y);
      // 풀이 흔적
      x.strokeStyle = 'rgba(43,74,139,.35)'; x.lineWidth = 1.4;
      x.beginPath();
      x.moveTo(m + 150, y - 8);
      x.bezierCurveTo(m + 190, y - 16, m + 210, y + 6, m + 250, y - 6);
      x.stroke();
      // 채점 표시
      if (i % 3 === 0) {
        x.strokeStyle = '#E05A5A'; x.lineWidth = 2.4;
        x.beginPath(); x.moveTo(W - m - 60, y - 12); x.lineTo(W - m - 50, y); x.lineTo(W - m - 34, y - 16); x.stroke();
      }
      row += (i % 4 === 0) ? 2 : 1;
    }
    // 이름표
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.fillRect(m + 14, H - m - 34, 210, 24);
    x.fillStyle = '#6B7280'; x.font = 'bold 13px sans-serif';
    x.fillText(name + ' · ' + new Date().toTimeString().slice(0, 5), m + 22, H - m - 17);
    return c.toDataURL('image/jpeg', 0.72);
  };

  /** 업로드 사진 자동 압축 (긴 변 900px, JPEG 62%) */
  ui.compress = function (file, maxSide, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const max = maxSide || 900;
        let w = img.width, h = img.height;
        const r = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * r); h = Math.round(h * r);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality || 0.62));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
      img.src = url;
    });
  };

  ui.download = function (filename, text) {
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  };

  /* ---------- 게임 감성 효과 ---------- */
  ui.fx = {
    hit(el, text, kind) {
      const app = document.getElementById('app');
      if (!app || !el) return;
      const r = el.getBoundingClientRect(), ar = app.getBoundingClientRect();
      const d = document.createElement('div');
      d.className = 'fx-hit ' + (kind || '');
      d.textContent = text;
      d.style.left = (r.left - ar.left + r.width / 2) + 'px';
      d.style.top = (r.top - ar.top + r.height / 2) + 'px';
      app.appendChild(d);
      setTimeout(() => d.remove(), 950);
    },
    bounce(el) {
      if (!el) return;
      el.classList.add('bounce');
      setTimeout(() => el.classList.remove('bounce'), 320);
    },
    shake(sel) {
      const el = document.querySelector(sel);
      if (!el) return;
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 460);
    },
    confetti(n) {
      const app = document.getElementById('app');
      if (!app) return;
      const c = document.createElement('canvas');
      c.className = 'fx-confetti';
      const r = app.getBoundingClientRect();
      c.width = r.width; c.height = r.height;
      app.appendChild(c);
      const ctx = c.getContext('2d');
      const cols = ['#FF7A45', '#FFCF4D', '#2FD3A6', '#7C6CF0', '#5AB8F0', '#FF6B8A'];
      const ps = [];
      for (let i = 0; i < (n || 60); i++) {
        ps.push({ x: r.width / 2 + (Math.random() - .5) * 110, y: r.height * .42, vx: (Math.random() - .5) * 7, vy: -Math.random() * 9 - 2, s: 4 + Math.random() * 5, c: cols[i % cols.length], a: Math.random() * 6 });
      }
      let t = 0;
      (function loop() {
        t += 1;
        ctx.clearRect(0, 0, c.width, c.height);
        ps.forEach(p => { p.vy += .38; p.x += p.vx; p.y += p.vy; p.a += .2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .7); ctx.restore(); });
        if (t < 90) requestAnimationFrame(loop); else c.remove();
      })();
    }
  };
})();
