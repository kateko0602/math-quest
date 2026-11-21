/* 저장소 — 로컬(브라우저) 모드와 시트 API 모드를 같은 인터페이스로 씁니다.
   로컬 모드: localStorage (지금 바로 테스트)
   API 모드  : Apps Script Web App / 모의 서버 (관리시트 연동)

   v0.2 채점 모델 — 문제마다 ⭕/❌ 를 직접 고릅니다.
     marks[키]   : 'o'(맞음) | 'x'(틀림) | 없음(미풀이 → 내일 이월)
     cleanup[키] : 'fixed'(⚔️ 고쳤어요) | 'star'(⭐ 또 틀림·질문) | 없음
*/
window.EMA = window.EMA || {};
(function () {
  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  const nowHHMM = () => {
    const d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  const KEY = 'ema.state.v3';
  const LEGACY_KEYS = ['ema.state.v2'];
  const SESSION = 'ema.session.v1';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  EMA.util = { todayISO, nowHHMM, DOW, pad };

  const CAP_XP = 200;       // 일일 XP 상한 (몰아치기 방지)
  const FLAME_MIN = 3;      // 불꽃 인정 최소 문제 수

  function K(c, d, s) { return c + '|' + d + '|' + s; }

  class BaseStore {
    constructor() { this.state = null; this.mode = 'local'; }

    /* ---------- 반·학생 ---------- */
    classes() { return this.state.classes; }
    getClass(id) { return this.state.classes.find(c => c.id === id) || null; }
    student(classId, sid) {
      const c = this.getClass(classId);
      return c ? (c.students.find(s => s.id === sid) || null) : null;
    }
    studentById(sid) {
      for (const c of this.state.classes) {
        const s = c.students.find(x => x.id === sid);
        if (s) return { cls: c, stu: s };
      }
      return null;
    }
    displayName(student) { return student.nickname || student.name; }

    /* ---------- 숙제·쪽수표 ---------- */
    pageMaps() { return this.state.pageMaps || { 교재: {} }; }
    bookList() { return Object.keys(this.pageMaps().교재 || {}); }
    book(name) { return (this.pageMaps().교재 || {})[name] || null; }
    pagesOfBook(name) {
      const b = this.book(name);
      if (!b) return [];
      const out = [];
      Object.keys(b.단원).forEach(u => {
        const unit = b.단원[u];
        Object.keys(unit.쪽).forEach(p => out.push({ page: parseInt(p, 10), unit: parseInt(u, 10), unitName: unit.이름, type: unit.쪽[p].유형, problems: unit.쪽[p].문제 }));
      });
      return out.sort((a, b) => a.page - b.page);
    }
    /** 교재 + 쪽수 → 문제 타일 목록. 쪽수표에 없는 쪽은 '쪽수표 필요' 표시용으로 null */
    tilesFor(bookName, pages) {
      const b = this.book(bookName);
      if (!b) return [];
      const byPage = {};
      Object.keys(b.단원).forEach(u => {
        const unit = b.단원[u];
        Object.keys(unit.쪽).forEach(p => { byPage[p] = unit.쪽[p]; });
      });
      const out = [];
      (pages || []).forEach(p => {
        const info = byPage[String(p)];
        if (!info) {
          out.push({ key: p + ':?', label: '?', page: p, num: null, type: '표없음', missing: true });
          return;
        }
        info.문제.forEach((num, i) => out.push({ key: p + ':' + i, label: num, page: p, num, type: info.유형 }));
      });
      return out;
    }
    lesson(classId) { return (this.state.lessons || {})[classId] || null; }
    learningUnits(classId) {
      const l = this.lesson(classId);
      if (!l) return [];
      return this.pagesOfBook(l.book).filter(p => (l.pages || []).indexOf(p.page) >= 0)
        .map(p => p.unit).filter((v, i, a) => a.indexOf(v) === i);
    }
    tiles(classId) {
      const l = this.lesson(classId);
      return l ? this.tilesFor(l.book, l.pages) : [];
    }

    /* ---------- 채점 (v0.2: ⭕ / ❌) ---------- */
    grade(classId, sid, date) {
      const d = date || this.state.today;
      const g = this.state.grades[K(classId, d, sid)];
      if (!g) return { marks: {}, cleanup: {}, updatedAt: null };
      if (!g.marks) g.marks = {};
      if (!g.cleanup) g.cleanup = {};
      return g;
    }
    markOf(classId, sid, key, date) { return this.grade(classId, sid, date).marks[key] || ''; }
    cleanupOf(classId, sid, key, date) { return this.grade(classId, sid, date).cleanup[key] || ''; }

    /** 문제 타일의 화면 상태: 'o' | 'x' | 'fixed' | 'star' | ''(미풀이) */
    stateOf(classId, sid, key, date) {
      const g = this.grade(classId, sid, date);
      const m = g.marks[key];
      if (m === 'o') return 'o';
      if (m === 'x') return g.cleanup[key] === 'fixed' ? 'fixed' : (g.cleanup[key] === 'star' ? 'star' : 'x');
      return '';
    }

    /* ---------- 제출·도장 ---------- */
    submission(classId, sid, date) {
      const d = date || this.state.today;
      return this.state.submissions[K(classId, d, sid)] || null;
    }
    stampOrder(classId, date) {
      const d = date || this.state.today;
      const c = this.getClass(classId);
      const rows = c.students.map(s => ({ s, sub: this.submission(classId, s.id, d) }))
        .filter(r => r.sub && r.sub.stampAt)
        .sort((a, b) => a.sub.stampAt < b.sub.stampAt ? -1 : 1);
      return rows;
    }

    /* ---------- 오답·몬스터 ---------- */
    todayMonsters(classId, sid) {
      const g = this.grade(classId, sid);
      const tiles = this.tiles(classId);
      const out = [];
      tiles.forEach(t => {
        if (g.marks[t.key] !== 'x') return;
        const fixed = g.cleanup[t.key] === 'fixed';
        out.push({
          id: 'today_' + t.key,
          label: t.page + '쪽 ' + t.num + '번',
          date: this.state.today, captured: fixed, today: true, key: t.key
        });
      });
      return out;
    }
    captureMonster(sid, id) {
      const m = (this.state.monsters[sid] || []).find(x => x.id === id);
      if (!m) return false;
      m.captured = true;
      if (this.save) this.save();
      return true;
    }
    monsters(classId, sid) {
      const past = (this.state.monsters[sid] || []).slice();
      return past.concat(this.todayMonsters(classId, sid));
    }
    /** 미해결 오답(어제 이월) — 아직 안 고친 문제 */
    carriedMisconceptions(classId, sid) {
      return (this.state.monsters[sid] || []).filter(m => !m.captured && m.date < this.state.today);
    }

    /* ---------- 오늘 집계 ---------- */
    starsOf(classId, sid, date) {
      const g = this.grade(classId, sid, date);
      return Object.keys(g.marks).filter(k => g.marks[k] === 'x' && g.cleanup[k] === 'star');
    }
    /** 미풀이 = ⭕·❌ 둘 다 안 누른 문제 → 내일 이월 */
    missedOf(classId, sid, date) {
      const g = this.grade(classId, sid, date);
      return this.tiles(classId).filter(t => !g.marks[t.key]).map(t => t.key);
    }
    /** ⭕/❌/⚔️/⭐/⏭️ 다섯 가지 상태 */
    counts(classId, sid, date) {
      const d = date || this.state.today;
      const g = this.grade(classId, sid, d);
      const tiles = this.tiles(classId);
      let c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0;
      tiles.forEach(t => {
        const m = g.marks[t.key];
        if (m === 'o') { c1++; return; }
        if (m === 'x') {
          const cl = g.cleanup[t.key];
          if (cl === 'fixed') c3++;
          else if (cl === 'star') c4++;
          else c2++;
          return;
        }
        c5++;
      });
      return {
        c1, c2, c3, c4, c5,
        correct: c1, wrongLeft: c2, fixed: c3, question: c4, carry: c5,
        marked: c1 + c2 + c3 + c4,
        total: tiles.length,
        stars: Object.keys(g.marks).filter(k => g.cleanup[k] === 'star'),
        missed: tiles.filter(t => !g.marks[t.key]).map(t => t.key)
      };
    }
    stats(classId, sid, date) {
      const d = date || this.state.today;
      const cnt = this.counts(classId, sid, d);
      const sub = this.submission(classId, sid, d);
      const attempted = cnt.marked;
      let xp = attempted * 5 + cnt.c3 * 10;
      if (attempted >= FLAME_MIN) xp += 15;   // 불꽃 보너스
      xp = Math.min(xp, CAP_XP);
      return Object.assign({}, cnt, {
        solved: attempted,
        wrong: cnt.c2 + cnt.c4,
        fixedCount: cnt.c3,
        rightCount: cnt.c1,
        carried: cnt.c5,
        sub, xp
      });
    }
    streak(classId, sid) {
      const s = this.student(classId, sid);
      const todaySolved = this.stats(classId, sid).solved;
      return (s ? s.streak : 0) + (todaySolved >= FLAME_MIN ? 1 : 0);
    }
    totalXP(classId, sid) {
      const s = this.student(classId, sid);
      return (s ? s.xp : 0) + this.stats(classId, sid).xp;
    }
    level(classId, sid) {
      const xp = this.totalXP(classId, sid);
      return { lv: Math.floor(xp / 100) + 1, into: xp % 100, need: 100 };
    }

    classDay(classId, date) {
      const d = date || this.state.today;
      const c = this.getClass(classId);
      return c.students.map(s => {
        const st = this.stats(classId, s.id, d);
        return Object.assign({ student: s }, st);
      });
    }

    /** 랭킹: first = 도장 확정 순(없으면 제출 순), king = 오늘 푼 문제 수 */
    ranking(classId, mode) {
      const rows = this.classDay(classId);
      if (mode === 'first') {
        const scored = rows.map(r => {
          const sub = r.sub;
          let rankKey = null, label = '아직 안 냄', cls = 'none';
          if (sub && sub.stampAt) { rankKey = '0' + sub.stampAt; label = '도장 ' + sub.stampAt; cls = 'stamped'; }
          else if (sub && sub.status === 'submitted') { rankKey = '1' + sub.at; label = '제출 ' + sub.at + ' · 도장 대기'; cls = 'wait'; }
          else if (sub && sub.status === 'resubmit') { rankKey = '2' + sub.at; label = '재제출 요청'; cls = 'resubmit'; }
          return { r, rankKey, label, cls };
        }).filter(x => x.rankKey);
        scored.sort((a, b) => a.rankKey < b.rankKey ? -1 : 1);
        return scored.map((x, i) => ({ rank: i + 1, student: x.r.student, label: x.label, cls: x.cls, value: x.r.c3 ? '오답 ' + x.r.c3 + '개 고침' : '' }));
      }
      // 공부 왕: 푼 문제 수 → 고친 오답 수
      return rows.filter(r => r.solved > 0)
        .sort((a, b) => (b.solved - a.solved) || (b.c3 - a.c3))
        .map((r, i) => ({ rank: i + 1, student: r.student, label: r.solved + '문제 풀이', cls: 'king', value: r.c3 ? '⚔️' + r.c3 : '' }));
    }

    /** 전체 학년 랭킹 (지금은 XP 기준) */
    gradeRanking(mode) {
      const all = [];
      this.state.classes.forEach(c => c.students.forEach(s => {
        all.push({ student: s, cls: c, xp: this.totalXP(c.id, s.id), solved: this.stats(c.id, s.id).solved });
      }));
      all.sort((a, b) => mode === 'king' ? (b.solved - a.solved) || (b.xp - a.xp) : b.xp - a.xp);
      return all.slice(0, 10).map((x, i) => ({
        rank: i + 1, student: x.student, cls: x.cls,
        label: x.cls.name, value: mode === 'king' ? x.solved + '문제' : x.xp + ' XP'
      }));
    }

    boss(classId) {
      const rows = this.classDay(classId);
      const total = rows.length;
      const stamped = rows.filter(r => r.sub && r.sub.stampAt).length;
      const submitted = rows.filter(r => r.sub).length;
      const fixed = rows.reduce((a, r) => a + r.c3, 0);
      const dmg = (stamped / total) * 0.8 + Math.min(0.2, (fixed / (total * 3)) * 0.2);
      return {
        total, stamped, submitted, fixed,
        hp: Math.max(0, Math.round((1 - dmg) * 100)),
        left: total - stamped
      };
    }

    top5(classId, date) {
      const d = date || this.state.today;
      const c = this.getClass(classId);
      const tiles = this.tiles(classId);
      const map = {};
      const add = (s, k) => { map[k] = map[k] || { key: k, students: [] }; map[k].students.push(s); };
      c.students.forEach(s => {
        const g = this.grade(classId, s.id, d);
        Object.keys(g.marks).forEach(k => {
          if (g.marks[k] === 'x' && g.cleanup[k] === 'star') add(s, k);
        });
      });
      // ⭐를 아무도 안 골랐으면 ❌ 틀린 문제로 대신 집계
      if (Object.keys(map).length === 0) {
        c.students.forEach(s => {
          const g = this.grade(classId, s.id, d);
          Object.keys(g.marks).forEach(k => { if (g.marks[k] === 'x') add(s, k); });
        });
      }
      return Object.values(map).map(m => {
        const t = tiles.find(x => x.key === m.key) || { page: '?', num: '?', type: '' };
        return Object.assign(m, { page: t.page, num: t.num, type: t.type, count: m.students.length });
      }).sort((a, b) => b.count - a.count).slice(0, 5);
    }

    /* ---------- 단원평가 ---------- */
    exam(classId, sid) {
      const list = (this.state.exams || {})[classId] || [];
      return list.map(e => {
        const row = (e.rows || []).find(r => r.studentId === sid);
        return { date: e.date, unit: e.unit, full: e.full, retestLine: e.retestLine, score: row ? row.score : null };
      });
    }

    /* ---------- 달력 ---------- */
    calendar(classId, sid, ym) {
      const [y, m] = ym.split('-').map(Number);
      const first = new Date(y, m - 1, 1);
      const days = new Date(y, m, 0).getDate();
      const startPad = first.getDay();
      const hist = this.state.history[sid] || [];
      const today = this.state.today;
      const cells = [];
      for (let i = 0; i < startPad; i++) cells.push({ empty: true });
      for (let d = 1; d <= days; d++) {
        const iso = y + '-' + pad(m) + '-' + pad(d);
        let solved = 0;
        const h = hist.find(x => x.date === iso);
        if (h) solved = h.solved;
        if (iso === today) solved = this.stats(classId, sid).solved;
        cells.push({ day: d, iso, solved, flame: solved >= FLAME_MIN, today: iso === today });
      }
      return cells;
    }
  }

  /* ================= 로컬 저장소 ================= */
  class LocalStore extends BaseStore {
    constructor(seedFn) { super(); this.seedFn = seedFn; this.mode = 'local'; }
    async init() {
      let st = null;
      try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { st = null; }
      const today = todayISO();
      if (!st || st.version !== 3) {
        // v0.1(v2) 기록은 형식이 달라 그대로 쓸 수 없어 예시 데이터로 다시 시작합니다.
        let keep = null;
        try {
          for (const lk of LEGACY_KEYS) {
            const old = JSON.parse(localStorage.getItem(lk) || 'null');
            if (old && old.pageMaps) { keep = old.pageMaps; break; }
          }
        } catch (e) { }
        st = this.seedFn(today);
        if (keep && keep.교재 && Object.keys(keep.교재).length) st.pageMaps = keep;
      } else if (st.today !== today) {
        // 데모: 날짜가 바뀌면 예시 데이터를 그날 기준으로 다시 맞춘다 (쪽수표 수정은 보존)
        const keep = st.pageMaps;
        const keepLesson = st.lessons;
        st = this.seedFn(today);
        if (keep) st.pageMaps = keep;
        if (keepLesson) st.lessons = keepLesson;
      }
      this.state = st;
      this.save();
      return this.state;
    }
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); }
      catch (e) { console.warn('저장 실패(용량?)', e); }
    }
    reset() {
      try {
        localStorage.removeItem(KEY);
        LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
        localStorage.removeItem(SESSION);
      } catch (e) { }
      return this.init();
    }
    /* 세션 */
    session() {
      try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { return null; }
    }
    setSession(s) { s ? localStorage.setItem(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION); }

    gradeRow(classId, sid) {
      const k = K(classId, this.state.today, sid);
      const g = this.state.grades[k] || (this.state.grades[k] = { marks: {}, cleanup: {}, updatedAt: null });
      if (!g.marks) g.marks = {};
      if (!g.cleanup) g.cleanup = {};
      return g;
    }

    /* 쓰기 — 채점 */
    /** mark: 'o' | 'x' | '' (같은 것을 다시 누르면 해제 → 미풀이) */
    setMark(classId, sid, key, mark) {
      const g = this.gradeRow(classId, sid);
      if (!mark || g.marks[key] === mark) {
        delete g.marks[key];
        delete g.cleanup[key];
      } else {
        g.marks[key] = mark;
        if (mark === 'o') delete g.cleanup[key];
      }
      g.updatedAt = nowHHMM();
      this.save();
      return g.marks[key] || '';
    }
    /** 모두 ⭕ — 전부 다 풀었을 때 한 번에 */
    markAllCorrect(classId, sid) {
      const g = this.gradeRow(classId, sid);
      this.tiles(classId).forEach(t => { if (!t.missing) { g.marks[t.key] = 'o'; delete g.cleanup[t.key]; } });
      g.updatedAt = nowHHMM();
      this.save();
      return true;
    }
    /** ⚔️ 고쳤어요 / ⭐ 또 틀림·질문 (같은 것을 다시 누르면 해제) */
    setCleanup(classId, sid, key, kind) {
      const g = this.gradeRow(classId, sid);
      if (g.marks[key] !== 'x') return '';
      if (!kind || g.cleanup[key] === kind) delete g.cleanup[key];
      else g.cleanup[key] = kind;
      g.updatedAt = nowHHMM();
      this.save();
      return g.cleanup[key] || '';
    }

    submitPhoto(classId, sid, dataUrl) {
      const pid = 'ph_' + Date.now().toString(36);
      this.state.photos[pid] = { data: dataUrl, at: nowHHMM(), owner: sid };
      this.state.submissions[K(classId, this.state.today, sid)] = { status: 'submitted', at: nowHHMM(), photoId: pid, stampAt: null };
      this.save();
      return pid;
    }
    touchSubmission(classId, sid) {
      const k = K(classId, this.state.today, sid);
      const sub = this.state.submissions[k];
      if (!sub) return false;
      sub.at = nowHHMM();
      if (sub.status === 'resubmit') sub.status = 'submitted';
      sub.stampAt = null;
      this.save();
      return true;
    }
    putPhoto(id, dataUrl, owner) {
      if (this.state.photos[id]) return;
      this.state.photos[id] = { data: dataUrl, at: '17:05', owner };
      this.save();
    }
    photo(id) { return this.state.photos[id] || null; }

    stamp(classId, sid) {
      const k = K(classId, this.state.today, sid);
      const sub = this.state.submissions[k];
      if (!sub) return false;
      sub.status = 'stamped'; sub.stampAt = nowHHMM();
      this.save(); return true;
    }
    requestResubmit(classId, sid) {
      const k = K(classId, this.state.today, sid);
      const sub = this.state.submissions[k];
      if (!sub) return false;
      sub.status = 'resubmit'; sub.note = '사진 다시 찍어 주세요';
      this.save(); return true;
    }
    saveProfile(classId, sid, patch) {
      const s = this.student(classId, sid);
      if (!s) return;
      if (patch.nickname != null) s.nickname = patch.nickname;
      if (patch.avatar != null) s.avatar = patch.avatar;
      this.save();
    }
    regenPin(classId, sid) {
      const s = this.student(classId, sid);
      if (!s) return null;
      s.pin = String(Math.floor(1000 + Math.random() * 9000));
      this.save(); return s.pin;
    }
    setPageProblem(book, page, list) {
      const b = this.book(book);
      if (!b) return;
      let hit = null, unitKey = null;
      Object.keys(b.단원).forEach(u => { if (b.단원[u].쪽[page]) { hit = b.단원[u].쪽[page]; unitKey = u; } });
      if (hit) { hit.문제 = list; }
      else {
        // 새 쪽: 마지막 단원에 추가
        const us = Object.keys(b.단원);
        unitKey = us[us.length - 1];
        b.단원[unitKey].쪽[page] = { 유형: '연습', 문제: list };
      }
      this.save();
    }
    saveLesson(classId, patch) {
      const l = this.state.lessons[classId] || (this.state.lessons[classId] = {});
      Object.assign(l, patch);
      this.save();
    }
    top5All() {
      const out = [];
      this.state.classes.forEach(c => {
        const t = this.top5(c.id);
        if (t.length) out.push({ cls: c, rows: t });
      });
      return out;
    }
  }

  /* ================= API(시트 연동) 저장소 ================= */
  class ApiStore extends BaseStore {
    constructor(url) { super(); this.url = url; this.mode = 'api'; this.lastSync = null; }
    async call(action, payload) {
      const res = await fetch(this.url, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action }, payload || {}))
      });
      if (!res.ok) throw new Error('API ' + res.status);
      const json = await res.json();
      if (json.state) this.state = json.state;
      this.lastSync = nowHHMM();
      return json;
    }
    async init() {
      const res = await this.call('bootstrap');
      if (res.empty) {
        const seed = EMA.buildSeed(todayISO());
        const r2 = await this.call('seed', { state: seed });
        this.state = r2.state || seed;
      }
      return this.state;
    }
    session() { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { return null; } }
    setSession(s) { s ? localStorage.setItem(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION); }
    async setMark(c, s, key, mark) { await this.call('setMark', { classId: c, studentId: s, key, mark }); return this.markOf(c, s, key); }
    async markAllCorrect(c, s) { await this.call('markAll', { classId: c, studentId: s, tiles: this.tiles(c).map(t => t.key) }); return true; }
    async setCleanup(c, s, key, kind) { await this.call('cleanup', { classId: c, studentId: s, key, kind }); return this.cleanupOf(c, s, key); }
    async submitPhoto(c, s, dataUrl) { const r = await this.call('submitPhoto', { classId: c, studentId: s, photo: dataUrl }); return r.photoId; }
    async touchSubmission(c, s) { await this.call('touchSubmission', { classId: c, studentId: s }); return true; }
    photo(id) { return this.state.photos[id] || null; }
    putPhoto() { /* 운영 모드에서는 서버(드라이브)에 저장 */ }
    async stamp(c, s) { await this.call('stamp', { classId: c, studentId: s }); return true; }
    async requestResubmit(c, s) { await this.call('resubmit', { classId: c, studentId: s }); return true; }
    async saveProfile(c, s, patch) { await this.call('profile', { classId: c, studentId: s, patch }); }
    async regenPin(c, s) { const r = await this.call('regenPin', { classId: c, studentId: s }); return r.pin; }
    async setPageProblem(book, page, list) { await this.call('pageProblem', { book, page, problems: list }); }
    async saveLesson(c, patch) { await this.call('lesson', { classId: c, patch }); }
    async reset() { await this.call('reset'); return this.init(); }
  }

  EMA.createStore = function () {
    const cfg = window.EMA_CONFIG || { mode: 'local' };
    if (cfg.mode === 'api' && cfg.apiUrl) return new ApiStore(cfg.apiUrl);
    return new LocalStore(EMA.buildSeed);
  };
  EMA.FLAME_MIN = FLAME_MIN;
  EMA.CAP_XP = CAP_XP;
})();
