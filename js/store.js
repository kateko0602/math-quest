/* 저장소 v0.3 — 로컬(브라우저) 모드와 시트 API 모드를 같은 인터페이스로 씁니다.
   로컬 모드: localStorage (지금 바로 테스트)
   API 모드  : Apps Script Web App / 모의 서버 (관리시트 연동)

   v0.3 채점 모델 — 문제마다 ⭕/❌ 를 직접 고릅니다.
     marks[키]   : 'o'(맞음) | 'x'(틀림) | 없음(미풀이 → 다음 날 밀린문제)
     cleanup[키] : 'fixed'(⚔️ 고쳤어요) | 'star'(⭐ 또 틀림·질문) | 없음
   문제 키는 교재까지 포함합니다: '6-1 발전책|8:0' (8쪽 0번째 문제)
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
  const shiftISO = (iso, d) => {
    const dt = new Date(iso + 'T12:00:00');
    dt.setDate(dt.getDate() + d);
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  };
  const KEY = 'ema.state.v4';
  const SESSION = 'ema.session.v2';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  EMA.util = { todayISO, nowHHMM, DOW, pad, shiftISO };

  const CAP_XP = 200;       // 일일 XP 상한 (몰아치기 방지)
  const FLAME_MIN = 3;      // 불꽃 인정 최소 문제 수
  const GAME = () => window.EMA_GAME || { pets: [], shop: [], bosses: [], titles: [], monsters: [], rarity: {}, dailyTitles: [] };

  function K(c, d, s) { return c + '|' + d + '|' + s; }
  function SK(c, d, s, kind) { return kind === 'print' ? K(c, d, s) + '|print' : K(c, d, s); }
  function tileKey(book, page, i) { return book + '|' + page + ':' + i; }
  function hash(str) {
    let h = 0;
    for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 100003;
    return h;
  }

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
        Object.keys(unit.쪽).forEach(p => out.push({
          page: parseInt(p, 10), unit: parseInt(u, 10), unitName: unit.이름,
          type: unit.쪽[p].유형, problems: unit.쪽[p].문제
        }));
      });
      return out.sort((a, b2) => a.page - b2.page);
    }
    pageInfo(bookName, page) {
      const b = this.book(bookName);
      if (!b) return null;
      let hit = null;
      Object.keys(b.단원).forEach(u => { if (b.단원[u].쪽[String(page)]) hit = b.단원[u].쪽[String(page)]; });
      return hit;
    }
    /** 교재 + 쪽수 → 문제 타일 목록 (키에 교재 포함) */
    tilesOf(bookName, pages) {
      const out = [];
      (pages || []).forEach(p => {
        const info = this.pageInfo(bookName, p);
        if (!info) {
          out.push({ key: tileKey(bookName, p, 0), label: '?', page: p, num: null, book: bookName, type: '표없음', missing: true });
          return;
        }
        info.문제.forEach((num, i) => out.push({
          key: tileKey(bookName, p, i), label: num, page: p, num, book: bookName, type: info.유형
        }));
      });
      return out;
    }
    lesson(classId) { return (this.state.lessons || {})[classId] || null; }

    /** 오늘 숙제의 교재 목록 — 진도북+셀프북 2권 동시 지원 */
    books(classId) {
      const l = this.lesson(classId);
      if (!l) return [];
      if (l.books && l.books.length) return l.books;
      if (l.book) return [{ book: l.book, pages: l.pages || [] }];
      return [];
    }
    /** 숙제 타일 (bookName 생략 시 모든 교재) */
    tiles(classId, bookName) {
      const bs = this.books(classId);
      if (bookName) {
        const one = bs.find(b => b.book === bookName);
        return one ? this.tilesOf(one.book, one.pages) : [];
      }
      const out = [];
      bs.forEach(b => { this.tilesOf(b.book, b.pages).forEach(t => out.push(t)); });
      return out;
    }
    /** 개별 오답프린트 타일 1~N번 */
    printInfo(classId, sid) { return (this.state.prints || {})[K(classId, this.state.today, sid)] || null; }
    printTiles(classId, sid) {
      const p = this.printInfo(classId, sid);
      if (!p || !p.count) return [];
      const out = [];
      for (let i = 1; i <= p.count; i++) {
        out.push({ key: '프린트|' + i + ':0', label: String(i), page: '프린트', num: String(i), book: '프린트', type: '오답프린트' });
      }
      return out;
    }
    hasPrint(classId, sid) { return this.printTiles(classId, sid).length > 0; }

    /** 숙제 나간 날 / 마감일 기준 몰아치기 판정 */
    timing(classId, date) {
      const l = this.lesson(classId);
      const d = date || this.state.today;
      const start = (l && l.assignedAt) || (l && l.date) || d;
      const due = (l && l.dueDate) || null;
      if (l && l.done) return { kind: 'done', label: '제출 완료' };
      if (d <= shiftISO(start, 1)) return { kind: 'early', label: '얼리버드' };
      if (due && d >= due) return { kind: 'shield', label: '몰아치기' };
      return { kind: 'normal', label: '제때 제출' };
    }
    /** 사진 인증 — 오늘 숙제 범위에서 '이 학생'에게 뽑힌 1쪽 */
    verifyTarget(classId, sid) {
      const bs = this.books(classId);
      const pages = [];
      bs.forEach(b => (b.pages || []).forEach(p => pages.push({ book: b.book, page: p })));
      if (!pages.length) return null;
      const i = hash(sid + '|' + this.state.today + '|verify') % pages.length;
      return pages[i];
    }

    /* ---------- 채점 ---------- */
    grade(classId, sid, date) {
      const d = date || this.state.today;
      const g = this.state.grades[K(classId, d, sid)];
      if (!g) return { marks: {}, cleanup: {}, updatedAt: null };
      if (!g.marks) g.marks = {};
      if (!g.cleanup) g.cleanup = {};
      return g;
    }
    gradeOf(classId, sid, kind) {
      const k = kind === 'print' ? K(classId, this.state.today, sid) + '|print' : K(classId, this.state.today, sid);
      const g = this.state.grades[k];
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

    /** 타일 묶음의 다섯 상태 집계 */
    _count(tiles, g) {
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
      return { c1, c2, c3, c4, c5, correct: c1, wrongLeft: c2, fixed: c3, question: c4, carry: c5, marked: c1 + c2 + c3 + c4, total: tiles.length };
    }
    counts(classId, sid, date) {
      const g = this.grade(classId, sid, date);
      return this._count(this.tiles(classId), g);
    }
    printCounts(classId, sid) {
      return this._count(this.printTiles(classId, sid), this.gradeOf(classId, sid, 'print'));
    }
    /** 숙제 + 프린트 합친 오늘 푼 문제 수 */
    solvedToday(classId, sid) {
      return this.counts(classId, sid).marked + this.printCounts(classId, sid).marked;
    }
    stats(classId, sid) {
      const c = this.counts(classId, sid);
      return this._withXP(c, true);
    }
    printStats(classId, sid) {
      const c = this.printCounts(classId, sid);
      return this._withXP(c, false);
    }
    _withXP(cnt, includeFlame) {
      let xp = cnt.marked * 5 + cnt.c3 * 10;
      if (includeFlame && cnt.marked >= FLAME_MIN) xp += 15;   // 불꽃 보너스
      xp = Math.min(xp, CAP_XP);
      return Object.assign({}, cnt, {
        solved: cnt.marked,
        wrong: cnt.c2 + cnt.c4,
        fixedCount: cnt.c3,
        rightCount: cnt.c1,
        carried: cnt.c5,
        xp
      });
    }
    streak(classId, sid) {
      const s = this.student(classId, sid);
      const todaySolved = this.solvedToday(classId, sid);
      const protectedDay = s && s.sick;
      return (s ? s.streak : 0) + ((todaySolved >= FLAME_MIN || protectedDay) ? 1 : 0);
    }
    totalXP(classId, sid) {
      const s = this.student(classId, sid);
      return (s ? (s.xp || 0) + (s.bonusXp || 0) : 0) + this.stats(classId, sid).xp;
    }
    level(classId, sid) {
      const xp = this.totalXP(classId, sid);
      return { lv: Math.floor(xp / 100) + 1, into: xp % 100, need: 100 };
    }

    /* ---------- 제출·도장 ---------- */
    submission(classId, sid, date, kind) {
      const d = date || this.state.today;
      return this.state.submissions[SK(classId, d, sid, kind)] || null;
    }
    stampOrder(classId, date) {
      const d = date || this.state.today;
      const c = this.getClass(classId);
      return c.students.map(s => ({ s, sub: this.submission(classId, s.id, d) }))
        .filter(r => r.sub && r.sub.stampAt)
        .sort((a, b) => a.sub.stampAt < b.sub.stampAt ? -1 : 1);
    }

    /* ---------- 보스 ---------- */
    weekIndex(iso) {
      const d = new Date((iso || this.state.today) + 'T12:00:00');
      const epoch = new Date(2026, 0, 5); // 월요일 기준
      return Math.floor((d - epoch) / (7 * 86400000));
    }
    bossDef(classId) {
      const list = GAME().bosses || [];
      if (!list.length) return { em: '👾', name: '보스', taunts: [], title: '' };
      return list[((this.weekIndex() % list.length) + list.length) % list.length];
    }
    bossBoost(classId) {
      const k = classId + '|' + this.weekIndex();
      return (this.state.bossBoosts || {})[k] || 0;
    }
    boss(classId) {
      const rows = this.classDay(classId);
      const total = rows.length || 1;
      const stamped = rows.filter(r => r.sub && r.sub.stampAt).length;
      const submitted = rows.filter(r => r.sub || r.printSub).length;
      const fixed = rows.reduce((a, r) => a + r.c3 + r.p3, 0);
      const dmg = (stamped / total) * 0.8 + Math.min(0.2, (fixed / (total * 3)) * 0.2);
      const hp = Math.max(0, Math.round((1 - dmg) * 100 - this.bossBoost(classId)));
      const killed = hp <= 0;
      return {
        total, stamped, submitted, fixed,
        hp, left: total - stamped, def: this.bossDef(classId), killed,
        myShare: 0
      };
    }
    /** 내가 깎은 HP (%) — 반 전체 데미지 중 내 몫 */
    myDamage(classId, sid) {
      const total = (this.getClass(classId).students.length) || 1;
      const st = this.stats(classId, sid);
      const p = this.printStats(classId, sid);
      const row = this.submission(classId, sid);
      const stampPt = (row && row.stampAt) ? 0.8 / total : 0;
      const fixedPt = Math.min(0.2, ((st.c3 + p.c3) / (total * 3)) * 0.2);
      return Math.round((stampPt + fixedPt) * 100 * 10) / 10;
    }
    myBombShare(classId, sid) {
      const st = this.student(classId, sid);
      return (st && st.bombGiven) ? st.bombGiven : 0;
    }

    /* ---------- 오답·몬스터 ---------- */
    monsterOf(label) {
      const list = GAME().monsters || [];
      if (!list.length) return { name: '오답 몬스터', em: '👾' };
      const h = hash(label);
      return list[h % list.length];
    }
    todayMonsters(classId, sid) {
      const g = this.grade(classId, sid);
      const out = [];
      this.tiles(classId).forEach(t => {
        if (g.marks[t.key] !== 'x') return;
        out.push({
          id: 'today_' + t.key, label: t.page + '쪽 ' + t.num + '번',
          book: t.book, page: t.page, num: t.num,
          date: this.state.today, captured: g.cleanup[t.key] === 'fixed', today: true, key: t.key
        });
      });
      return out;
    }
    monsters(classId, sid) {
      const past = (this.state.monsters[sid] || []).slice();
      return past.concat(this.todayMonsters(classId, sid)).map(m => Object.assign({}, m, this.monsterOf(m.label || (m.page + '쪽 ' + m.num))));
    }
    captureMonster(sid, id) {
      const m = (this.state.monsters[sid] || []).find(x => x.id === id);
      if (!m) return false;
      m.captured = true;
      if (this.save) this.save();
      return true;
    }

    /** 밀린 오답·이월 (아직 해결 안 한 것) */
    carried(classId, sid) {
      return ((this.state.carried || {})[sid] || []).slice()
        .sort((a, b) => a.date < b.date ? 1 : -1)
        .map(m => Object.assign({}, m, this.monsterOf(m.label)));
    }
    solvedCarried(sid) { return ((this.state.solvedCarried || {})[sid] || []).slice(); }

    /* ---------- 오늘 집계 ---------- */
    classDay(classId, date) {
      const d = date || this.state.today;
      const c = this.getClass(classId);
      return c.students.map(s => {
        const st = this.stats(classId, s.id);
        const ps = this.printStats(classId, s.id);
        return Object.assign({
          student: s,
          sub: this.submission(classId, s.id, d),
          printSub: this.submission(classId, s.id, d, 'print'),
          p3: ps.c3
        }, st);
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
        return scored.map((x, i) => ({
          rank: i + 1, student: x.r.student, label: x.label, cls: x.cls,
          value: x.r.c3 ? '오답 ' + x.r.c3 + '개 고침' : ''
        }));
      }
      return rows.filter(r => r.solved > 0)
        .sort((a, b) => (b.solved - a.solved) || (b.c3 - a.c3))
        .map((r, i) => ({ rank: i + 1, student: r.student, label: r.solved + '문제 풀이', cls: 'king', value: r.c3 ? '⚔️' + r.c3 : '' }));
    }

    gradeRanking(mode) {
      const all = [];
      this.state.classes.forEach(c => c.students.forEach(s => {
        all.push({ student: s, cls: c, xp: this.totalXP(c.id, s.id), solved: this.solvedToday(c.id, s.id) });
      }));
      all.sort((a, b) => mode === 'king' ? (b.solved - a.solved) || (b.xp - a.xp) : b.xp - a.xp);
      return all.slice(0, 10).map((x, i) => ({
        rank: i + 1, student: x.student, cls: x.cls,
        label: x.cls.name, value: mode === 'king' ? x.solved + '문제' : x.xp + ' XP'
      }));
    }

    top5(classId, date) {
      const d = date || this.state.today;
      const c = this.getClass(classId);
      const tiles = this.tiles(classId);
      const map = {};
      const add = (s, k) => { map[k] = map[k] || { key: k, students: [] }; if (!map[k].students.find(x => x.id === s.id)) map[k].students.push(s); };
      c.students.forEach(s => {
        const g = this.grade(classId, s.id, d);
        Object.keys(g.marks).forEach(k => {
          if (g.marks[k] === 'x' && g.cleanup[k] === 'star') add(s, k);
        });
      });
      if (Object.keys(map).length === 0) {
        c.students.forEach(s => {
          const g = this.grade(classId, s.id, d);
          Object.keys(g.marks).forEach(k => { if (g.marks[k] === 'x') add(s, k); });
        });
      }
      return Object.values(map).map(m => {
        const t = tiles.find(x => x.key === m.key) || { page: '?', num: '?', type: '', book: '' };
        return Object.assign(m, { page: t.page, num: t.num, type: t.type, book: t.book, count: m.students.length });
      }).sort((a, b) => b.count - a.count).slice(0, 5);
    }
    top5All() {
      const out = [];
      this.state.classes.forEach(c => {
        const t = this.top5(c.id);
        if (t.length) out.push({ cls: c, rows: t });
      });
      return out;
    }

    /* ---------- 단원평가 ---------- */
    exam(classId, sid) {
      const list = (this.state.exams || {})[classId] || [];
      return list.map(e => {
        const row = (e.rows || []).find(r => r.studentId === sid);
        const rt = (e.retest || []).find(r => r.studentId === sid);
        return {
          date: e.date, unit: e.unit, full: e.full, retestLine: e.retestLine,
          score: row ? row.score : null,
          retest: rt ? rt.score : null, retestDate: rt ? rt.date : null
        };
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
      const late = (this.state.lateUploads || {});
      const cells = [];
      for (let i = 0; i < startPad; i++) cells.push({ empty: true });
      for (let d = 1; d <= days; d++) {
        const iso = y + '-' + pad(m) + '-' + pad(d);
        let solved = 0;
        const h = hist.find(x => x.date === iso);
        if (h) solved = h.solved;
        if (iso === today) solved = this.solvedToday(classId, sid);
        const isLate = Object.keys(late).some(k => k === K(classId, iso, sid));
        cells.push({ day: d, iso, solved, flame: solved >= FLAME_MIN, late: isLate, today: iso === today, future: iso > today });
      }
      return cells;
    }

    /* ---------- 수학 펫 · 상점 ---------- */
    petCatalog() { return GAME().pets || []; }
    petDef(id) { return (GAME().pets || []).find(p => p.id === id) || null; }
    myPets(classId, sid) {
      const s = this.student(classId, sid);
      return ((s && s.pets) || []).map(p => Object.assign({}, this.petDef(p.id) || {}, p));
    }
    eggOf(classId, sid) {
      const s = this.student(classId, sid);
      return s ? (s.egg || null) : null;
    }
    bagOf(classId, sid) {
      const s = this.student(classId, sid);
      return (s && s.bag) || { snack: 0, shield: 0, bomb: 0 };
    }
    coins(classId, sid) {
      const s = this.student(classId, sid);
      return s ? (s.coins || 0) : 0;
    }
    shopItems() {
      const on = this.state.shop ? this.state.shop.rewardsOn !== false : true;
      return (GAME().shop || []).filter(i => i.kind !== 'coupon' || on);
    }
    myClaims(classId, sid) {
      return ((this.state.shop && this.state.shop.claims) || []).filter(c => c.sid === sid && c.cid === classId);
    }

    /* ---------- 성취도 리포트 (주간·월간·학기) ---------- */
    achievement(classId, sid, range) {
      const today = this.state.today;
      const days = range === 'week' ? 7 : range === 'month' ? 30 : 120;
      const from = shiftISO(today, -(days - 1));
      const hist = (this.state.history[sid] || []).filter(h => h.date >= from && h.date <= today);
      const todaySolved = this.solvedToday(classId, sid);
      const daysWith = hist.filter(h => h.solved >= FLAME_MIN).length + (todaySolved >= FLAME_MIN ? 1 : 0);
      const totalSolved = hist.reduce((a, h) => a + h.solved, 0) + todaySolved;
      const st = this.stats(classId, sid);
      const ps = this.printStats(classId, sid);
      const owned = this.myPets(classId, sid).length;
      const exams = this.exam(classId, sid).filter(e => e.date >= from);
      const avg = exams.length ? Math.round(exams.reduce((a, e) => a + (e.score || 0), 0) / exams.length) : null;
      const subDays = hist.filter(h => h.solved > 0).length + (todaySolved > 0 ? 1 : 0);
      return {
        range, label: range === 'week' ? '이번 주' : range === 'month' ? '이번 달' : '이번 학기',
        days, activeDays: subDays, flameDays: daysWith, totalSolved,
        todayFixed: st.c3 + ps.c3, todayWrong: st.c2 + st.c4, todayQuestion: st.c4,
        avgExam: avg, exams: exams.length, owned,
        rate: Math.round(daysWith / Math.max(1, Math.min(days, hist.length + 1)) * 100)
      };
    }
    kakaoSummary(classId, sid, range) {
      const s = this.student(classId, sid);
      const a = this.achievement(classId, sid, range);
      const ex = this.exam(classId, sid).filter(e => e.score != null).slice(-2);
      const exTxt = ex.length ? ex.map(e => `${e.unit.replace(' 평가', '')} ${e.score}점${e.retest ? `(재시 ${e.retest}점)` : ''}`).join(' · ') : '아직 없음';
      const todayLine = (a.todayWrong + a.todayFixed + a.todayQuestion)
        ? `오늘은 틀린 문제 ${a.todayWrong}개 중 ${a.todayFixed}개를 스스로 고쳤고, 질문 ${a.todayQuestion}개를 정리했어요.`
        : '오늘은 앱에 새 기록이 없어요(숙제 확인 후 업데이트됩니다).';
      return `안녕하세요 어머님, ${s.name} 어머니입니다 :)
${a.label} 숙제 성실도는 ${a.flameDays}일 불꽃(하루 3문제 이상) · 모두 ${a.totalSolved}문제를 풀었어요.
${todayLine}
단원평가: ${exTxt}
수학 펫은 ${a.owned}마리 모았어요. 집에서도 "오늘 숙제 먼저" 습관 응원 부탁드려요! 감사합니다.`;
    }
  }

  /* ================= 로컬 저장소 ================= */
  class LocalStore extends BaseStore {
    constructor(seedFn) { super(); this.seedFn = seedFn; this.mode = 'local'; }
    async init() {
      let st = null;
      try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { st = null; }
      const today = todayISO();
      if (!st || st.version !== 4) {
        // v0.2(v3) 기록은 구조가 달라 그대로 쓸 수 없어 예시 데이터로 다시 시작합니다.
        let keep = null;
        try {
          const old = JSON.parse(localStorage.getItem('ema.state.v3') || 'null');
          if (old && old.pageMaps) keep = old.pageMaps;
        } catch (e) { }
        st = this.seedFn(today);
        if (keep && keep.교재 && Object.keys(keep.교재).length) st.pageMaps = keep;
      } else if (st.today !== today) {
        // 데모: 날짜가 바뀌면 예시 데이터를 그날 기준으로 다시 맞춘다 (쪽수표 수정은 보존)
        const keep = st.pageMaps;
        const keepLesson = st.lessons;
        const keepClaims = (st.shop || {}).claims;
        st = this.seedFn(today);
        if (keep) st.pageMaps = keep;
        if (keepLesson && Object.keys(keepLesson).length) st.lessons = keepLesson;
        if (keepClaims) st.shop.claims = keepClaims;
      }
      if (!st.carried) st.carried = {};
      if (!st.prints) st.prints = {};
      if (!st.solvedCarried) st.solvedCarried = {};
      if (!st.lateUploads) st.lateUploads = {};
      if (!st.bossBoosts) st.bossBoosts = {};
      if (!st.bossKills) st.bossKills = {};
      if (!st.shop) st.shop = { rewardsOn: true, claims: [] };
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
        localStorage.removeItem('ema.state.v3');
        localStorage.removeItem(SESSION);
      } catch (e) { }
      return this.init();
    }
    session() {
      try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { return null; }
    }
    setSession(s) { s ? localStorage.setItem(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION); }

    gradeRow(classId, sid, kind) {
      const k = kind === 'print' ? K(classId, this.state.today, sid) + '|print' : K(classId, this.state.today, sid);
      const g = this.state.grades[k] || (this.state.grades[k] = { marks: {}, cleanup: {}, updatedAt: null });
      if (!g.marks) g.marks = {};
      if (!g.cleanup) g.cleanup = {};
      return g;
    }

    /* 쓰기 — 채점 */
    /** mark: 'o' | 'x' | '' (같은 것을 다시 누르면 해제 → 미풀이) */
    setMark(classId, sid, key, mark, kind) {
      const g = this.gradeRow(classId, sid, kind);
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
    markAllCorrect(classId, sid, kind, bookName) {
      const g = this.gradeRow(classId, sid, kind);
      const tiles = kind === 'print' ? this.printTiles(classId, sid) : this.tiles(classId, bookName || viewBook(this, classId));
      tiles.forEach(t => { if (!t.missing) { g.marks[t.key] = 'o'; delete g.cleanup[t.key]; } });
      g.updatedAt = nowHHMM();
      this.save();
      return true;
    }
    setCleanup(classId, sid, key, kind2, kind) {
      const g = this.gradeRow(classId, sid, kind);
      if (g.marks[key] !== 'x') return '';
      if (!kind2 || g.cleanup[key] === kind2) delete g.cleanup[key];
      else g.cleanup[key] = kind2;
      g.updatedAt = nowHHMM();
      this.save();
      return g.cleanup[key] || '';
    }

    /* ---------- 제출 ---------- */
    /** 보상 계산 — 제출 시점 기준 */
    previewReward(classId, sid, kind) {
      const st = kind === 'print' ? this.printStats(classId, sid) : this.stats(classId, sid);
      const t = this.timing(classId);
      let coins = st.c1 * 1 + st.c3 * 3;
      if (st.marked >= 3) coins += 2;               // 참여 보너스
      let xp = st.xp;
      if (t.kind === 'early') { coins *= 2; xp += 20; }
      if (t.kind === 'shield') { coins = Math.round(coins * 0.5); }
      if (kind === 'print') { coins = Math.round(coins * 0.5); xp = Math.round(xp * 0.5); }
      return { coins, xp, timing: t, problems: st.marked, fixed: st.c3, questions: st.c4 };
    }
    _awardTitles(classId, sid, ctx) {
      const s = this.student(classId, sid);
      if (!s) return [];
      if (!s.titles) s.titles = [];
      const have = new Set(s.titles.map(t => t.id));
      const got = [];
      const give = (id) => {
        if (have.has(id)) return;
        const def = (GAME().titles || []).find(t => t.id === id);
        if (!def) return;
        s.titles.push({ id: def.id, name: def.name, em: def.em, at: this.state.today });
        have.add(id); got.push(def);
      };
      if (ctx.bulldozer) give('bulldozer');
      if (ctx.cleaner) give('cleaner');
      if (ctx.early) give('earlybird');
      if (ctx.lastattack) give('lastattack');
      if (ctx.legendary) give('legendary');
      if (this.streak(classId, sid) >= 5) give('flamekeeper');
      if (got.length) this.save();
      return got;
    }
    /** 보스 처치 확인 — 반 전원 보너스 코인 + 한정판 칭호 */
    checkBossKill(classId) {
      const b = this.boss(classId);
      const wk = String(this.weekIndex());
      const prev = this.state.bossKills[classId];
      if (b.hp > 0 || (prev && prev.week === wk)) return null;
      this.state.bossKills[classId] = { week: wk, bossId: b.def.id, at: nowHHMM() };
      const c = this.getClass(classId);
      c.students.forEach(s => {
        s.coins = (s.coins || 0) + 30;
        if (!s.titles) s.titles = [];
        if (!s.titles.find(t => t.id === 'boss_' + b.def.id)) {
          s.titles.push({ id: 'boss_' + b.def.id, name: b.def.title || '보스 처치', em: b.def.em, at: this.state.today, once: true });
        }
      });
      this.save();
      return { boss: b.def, coins: 30 };
    }

    submitPhoto(classId, sid, dataUrl, kind) {
      const t = this.timing(classId);
      const rw = this.previewReward(classId, sid, kind);
      const pid = 'ph_' + Date.now().toString(36) + Math.floor(Math.random() * 99);
      this.state.photos[pid] = { data: dataUrl, at: nowHHMM(), owner: sid };
      const prev = this.submission(classId, sid, null, kind);
      const already = !!(prev && prev.rewarded);
      const sub = {
        status: 'submitted', at: nowHHMM(), photoId: pid, stampAt: null,
        verify: this.verifyTarget(classId, sid), kind: kind || 'hw',
        early: t.kind === 'early', shield: t.kind === 'shield',
        coins: already ? 0 : rw.coins, xp: already ? 0 : rw.xp, rewarded: true
      };
      this.state.submissions[SK(classId, this.state.today, sid, kind)] = sub;
      const s = this.student(classId, sid);
      if (!already && s) { s.coins = (s.coins || 0) + rw.coins; }
      const st = kind === 'print' ? this.printStats(classId, sid) : this.stats(classId, sid);
      const titles = this._awardTitles(classId, sid, {
        early: t.kind === 'early',
        cleaner: st.c3 >= 3,
        bulldozer: kind !== 'print' && st.c5 === 0 && st.marked >= 8
      });
      const killed = this.checkBossKill(classId);
      this.save();
      return Object.assign({}, rw, { sub, titles, killed, coins: already ? 0 : rw.coins, photoId: pid });
    }
    touchSubmission(classId, sid, kind) {
      const k = SK(classId, this.state.today, sid, kind);
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

    stamp(classId, sid, kind) {
      const k = SK(classId, this.state.today, sid, kind);
      const sub = this.state.submissions[k];
      if (!sub) return false;
      sub.status = 'stamped'; sub.stampAt = nowHHMM();
      const killed = this.checkBossKill(classId);
      this.save();
      return killed || true;
    }
    stampAllPending(classId) {
      const c = this.getClass(classId);
      let n = 0;
      c.students.forEach(s => {
        ['hw', 'print'].forEach(kind => {
          const sub = this.submission(classId, s.id, null, kind);
          if (sub && sub.status === 'submitted') {
            sub.status = 'stamped'; sub.stampAt = nowHHMM(); n++;
          }
        });
      });
      const killed = this.checkBossKill(classId);
      this.save();
      return { count: n, killed };
    }
    requestResubmit(classId, sid, kind) {
      const k = SK(classId, this.state.today, sid, kind);
      const sub = this.state.submissions[k];
      if (!sub) return false;
      sub.status = 'resubmit'; sub.note = '사진 다시 찍어 주세요'; sub.stampAt = null;
      this.save(); return true;
    }
    unlockSubmission(classId, sid, kind) {
      const k = SK(classId, this.state.today, sid, kind);
      const sub = this.state.submissions[k];
      if (!sub) return false;
      sub.status = 'unlocked'; sub.stampAt = null;
      this.save(); return true;
    }
    toggleSick(classId, sid) {
      const s = this.student(classId, sid);
      if (!s) return null;
      s.sick = !s.sick;
      this.save();
      return s.sick;
    }

    /* ---------- 어제분 올리기 ---------- */
    submitYesterday(classId, sid, dataUrl, solved) {
      const y = shiftISO(this.state.today, -1);
      const pid = 'ph_y_' + Date.now().toString(36);
      this.state.photos[pid] = { data: dataUrl, at: nowHHMM(), owner: sid };
      this.state.lateUploads[K(classId, y, sid)] = { at: nowHHMM(), photoId: pid, solved: Math.max(FLAME_MIN, solved || FLAME_MIN) };
      const hist = this.state.history[sid] || (this.state.history[sid] = []);
      const row = hist.find(h => h.date === y);
      if (row) { row.solved = Math.max(row.solved, FLAME_MIN); row.late = true; }
      else hist.push({ date: y, solved: FLAME_MIN, late: true });
      const s = this.student(classId, sid);
      if (s) s.coins = (s.coins || 0) + 5;
      this.save();
      return true;
    }
    /** 어제 '어제분 올리기' 기록 */
    lateUpload(classId, sid) {
      const y = shiftISO(this.state.today, -1);
      return ((this.state.lateUploads || {})[K(classId, y, sid)]) || null;
    }
    yesterdayFlameMissing(classId, sid) {
      const y = shiftISO(this.state.today, -1);
      const hist = this.state.history[sid] || [];
      const row = hist.find(h => h.date === y);
      const up = (this.state.lateUploads || {})[K(classId, y, sid)];
      return !up && (!row || row.solved < FLAME_MIN);
    }

    /* ---------- 상점 ---------- */
    buy(classId, sid, itemId) {
      const item = (GAME().shop || []).find(i => i.id === itemId);
      const s = this.student(classId, sid);
      if (!item || !s) return { error: '상품을 찾지 못했어요' };
      const rewardsOn = this.state.shop ? this.state.shop.rewardsOn !== false : true;
      if (item.kind === 'coupon' && !rewardsOn) return { error: '선생님이 현실 보상 쿠폰을 잠시 꺼 두었어요' };
      if ((s.coins || 0) < item.price) return { error: `코인이 ${item.price - s.coins}개 부족해요` };
      if (item.kind === 'snack' && !s.egg) return { error: '먼저 랜덤 펫 알을 뽑아 주세요 🥚' };
      if (item.kind === 'egg' && s.egg) return { error: '지금 알을 키우는 중이에요. 부화하면 새 알을 뽑을 수 있어요' };
      s.coins -= item.price;
      const out = { item, coins: s.coins };
      if (item.kind === 'egg') {
        s.egg = { pct: 20, gotAt: this.state.today };
        out.egg = s.egg;
        out.msg = '알을 받았어요! 간식으로 키워 보세요 🥚';
      } else if (item.kind === 'snack') {
        s.egg.pct = Math.min(100, (s.egg.pct || 0) + 25);
        out.egg = s.egg;
        if (s.egg.pct >= 100) {
          out.hatch = this._hatch(classId, sid);
          out.msg = out.hatch.pet.rarity === 'legend'
            ? `전설! ${out.hatch.pet.name} 탄생! 🎉`
            : `${out.hatch.pet.name} 부화! 도감에 등록됐어요 🎉`;
        } else {
          out.msg = `냠냠! 부화 ${s.egg.pct}%`;
        }
      } else if (item.kind === 'shield') {
        s.bag = s.bag || {}; s.bag.shield = (s.bag.shield || 0) + 1;
        out.bag = s.bag; out.msg = '불꽃 방어권 1장을 샀어요 🛡️';
      } else if (item.kind === 'bomb') {
        s.bag = s.bag || {}; s.bag.bomb = (s.bag.bomb || 0) + 1;
        const bk = classId + '|' + this.weekIndex();
        this.state.bossBoosts[bk] = (this.state.bossBoosts[bk] || 0) + 15;
        s.bombGiven = (s.bombGiven || 0) + 15;
        out.bag = s.bag; out.msg = '보스에게 폭탄을 던졌어요! HP 15% 감소 💣';
        out.killed = this.checkBossKill(classId);
      } else if (item.kind === 'coupon') {
        const claim = { id: 'cl_' + Date.now().toString(36), cid: classId, sid, itemId, name: item.name, em: item.em, at: this.state.today, used: false };
        this.state.shop.claims.push(claim);
        out.claim = claim; out.msg = `${item.name} 쿠폰을 받았어요! 선생님께 보여 주세요 🎟️`;
      }
      this.save();
      return out;
    }
    _hatch(classId, sid) {
      const s = this.student(classId, sid);
      const rarityMeta = GAME().rarity || {};
      const roll = Math.random() * 100;
      let rarity = 'common';
      if (roll < (rarityMeta.legend || { rate: 5 }).rate) rarity = 'legend';
      else if (roll < (rarityMeta.legend || { rate: 5 }).rate + (rarityMeta.rare || { rate: 25 }).rate) rarity = 'rare';
      let pool = (GAME().pets || []).filter(p => p.rarity === rarity);
      // 이미 가진 펫은 덜 나오게: 한 번만 걸러서 새 펫 우선
      const owned = new Set(((s && s.pets) || []).map(p => p.id));
      const fresh = pool.filter(p => !owned.has(p.id));
      if (fresh.length) pool = fresh;
      else {
        // 도감을 다 채웠으면 다른 등급에서도 뽑는다
        let all = (GAME().pets || []).filter(p => !owned.has(p.id));
        if (all.length) { pool = all; rarity = all[0].rarity; }
      }
      const pick = pool[Math.floor(Math.random() * pool.length)] || { id: 'rootcat', name: '아기 루트냥', rarity: 'common', em: '🐱' };
      s.pets = s.pets || [];
      s.pets.push({ id: pick.id, name: pick.name, rarity: pick.rarity, em: pick.em, at: this.state.today });
      s.egg = null;
      const titles = this._awardTitles(classId, sid, { legendary: pick.rarity === 'legend' });
      this.save();
      return { pet: pick, titles };
    }
    feed(classId, sid) {
      const s = this.student(classId, sid);
      if (!s || !s.egg) return { error: '먼저 알을 뽑아 주세요 🥚' };
      if ((s.coins || 0) < 20) return { error: '코인이 20개 필요해요 (간식 1개)' };
      return this.buy(classId, sid, 'snack');
    }

    /* ---------- 개별 오답프린트 ---------- */
    setPrint(classId, sid, count) {
      const n = Math.max(0, Math.min(60, parseInt(count, 10) || 0));
      if (!n) { delete this.state.prints[K(classId, this.state.today, sid)]; this.save(); return null; }
      this.state.prints[K(classId, this.state.today, sid)] = { count: n, lastNo: null, setBy: 'teacher', at: this.state.today };
      this.save();
      return this.state.prints[K(classId, this.state.today, sid)];
    }
    setPrintLastNo(classId, sid, lastNo) {
      const n = Math.max(1, Math.min(60, parseInt(lastNo, 10) || 0));
      const key = K(classId, this.state.today, sid);
      this.state.prints[key] = Object.assign(this.state.prints[key] || {}, { count: n, lastNo: n, setBy: 'student' });
      this.save();
      return this.state.prints[key];
    }

    /* ---------- 밀린 오답 해결 ---------- */
    resolveCarried(classId, sid, id) {
      const list = (this.state.carried || {})[sid] || [];
      const i = list.findIndex(x => x.id === id);
      if (i < 0) return null;
      const item = list.splice(i, 1)[0];
      item.solvedAt = this.state.today;
      (this.state.solvedCarried[sid] = this.state.solvedCarried[sid] || []).push(item);
      // 몬스터 도감에 포획 기록
      (this.state.monsters[sid] = this.state.monsters[sid] || []).push({
        id: 'm_' + id, book: item.book, page: item.page, num: item.num, label: item.label,
        date: this.state.today, captured: true, fromCarry: true, origin: item.date
      });
      const s = this.student(classId, sid);
      if (s) { s.coins = (s.coins || 0) + 5; s.bonusXp = (s.bonusXp || 0) + 10; }
      const killed = this.checkBossKill(classId);
      this.save();
      return { item, coins: 5, xp: 10, killed };
    }

    /* ---------- 선생님 설정 ---------- */
    setRewardsOn(on) {
      if (!this.state.shop) this.state.shop = { rewardsOn: true, claims: [] };
      this.state.shop.rewardsOn = !!on;
      this.save();
    }
    useClaim(claimId) {
      const c = ((this.state.shop || {}).claims || []).find(x => x.id === claimId);
      if (!c) return false;
      c.used = true; c.usedAt = nowHHMM();
      this.save(); return true;
    }

    /* ---------- 프로필·쪽수표 ---------- */
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
  }

  /* 한 교재만 골라 '모두 ⭕'를 누를 때 쓰는 현재 교재 (없으면 전체) */
  function viewBook(store, classId) {
    const bs = store.books(classId);
    return bs.length === 1 ? bs[0].book : null;
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
    /* 연동 모드에서도 화면이 그대로 돌도록 로컬 계산은 Base/로컬 로직을 재사용하고,
       서버가 아는 동작은 서버에 먼저 보냅니다. */
    session() { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { return null; } }
    setSession(s) { s ? localStorage.setItem(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION); }
    async setMark(c, s, key, mark, kind) { await this.call('setMark', { classId: c, studentId: s, key, mark, kind }); return this.markOf(c, s, key); }
    async markAllCorrect(c, s, kind) { await this.call('markAll', { classId: c, studentId: s, kind }); return true; }
    async setCleanup(c, s, key, kind2, kind) { await this.call('cleanup', { classId: c, studentId: s, key, kind: kind2 }); return this.cleanupOf(c, s, key); }
    async submitPhoto(c, s, dataUrl, kind) { const r = await this.call('submitPhoto', { classId: c, studentId: s, photo: dataUrl, kind }); return r.photoId; }
    async touchSubmission(c, s, kind) { await this.call('touchSubmission', { classId: c, studentId: s, kind }); return true; }
    photo(id) { return this.state.photos[id] || null; }
    putPhoto() { /* 운영 모드에서는 서버(드라이브)에 저장 */ }
    async stamp(c, s, kind) { await this.call('stamp', { classId: c, studentId: s, kind }); return true; }
    async stampAllPending(c) { const r = await this.call('stampAll', { classId: c }); return { count: r.count || 0, killed: null }; }
    async requestResubmit(c, s, kind) { await this.call('resubmit', { classId: c, studentId: s, kind }); return true; }
    async unlockSubmission(c, s, kind) { await this.call('unlock', { classId: c, studentId: s, kind }); return true; }
    async toggleSick(c, s) { const r = await this.call('sick', { classId: c, studentId: s }); return r.sick; }
    async saveProfile(c, s, patch) { await this.call('profile', { classId: c, studentId: s, patch }); }
    async regenPin(c, s) { const r = await this.call('regenPin', { classId: c, studentId: s }); return r.pin; }
    async setPageProblem(book, page, list) { await this.call('pageProblem', { book, page, problems: list }); }
    async saveLesson(c, patch) { await this.call('lesson', { classId: c, patch }); }
    buy() { return { error: '시트 연동 모드에서는 상점 기능을 준비 중이에요' }; }
    feed() { return { error: '시트 연동 모드에서는 상점 기능을 준비 중이에요' }; }
    setPrint() { return null; }
    setPrintLastNo() { return null; }
    resolveCarried() { return null; }
    setRewardsOn() { }
    useClaim() { return false; }
    submitYesterday() { return false; }
    async reset() { await this.call('reset'); return this.init(); }
  }

  EMA.createStore = function () {
    const cfg = window.EMA_CONFIG || { mode: 'local' };
    if (cfg.mode === 'api' && cfg.apiUrl) return new ApiStore(cfg.apiUrl);
    return new LocalStore(EMA.buildSeed);
  };
  EMA.FLAME_MIN = FLAME_MIN;
  EMA.CAP_XP = CAP_XP;
  EMA.tileKey = tileKey;
})();
