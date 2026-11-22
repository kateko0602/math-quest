/* 저장소 v0.8 — 로컬(브라우저) 모드와 시트 API 모드를 같은 인터페이스로 씁니다.

   ★ v0.8 안정화의 핵심 세 가지 ★
     ① 날짜가 바뀌어도 데이터가 사라지지 않습니다 (예전엔 자정이 지나면 seed로 통째 재생성).
        · state.today만 오늘로 넘기고(roll_forward), 그날의 학습 기록·XP를 확정해 쌓습니다.
        · 스키마 버전이 올라가도 migrate()가 기존 데이터를 살려서 옮깁니다.
     ② 선생님 PIN은 코드·화면에 없습니다. 이 기기에 해시로만 저장합니다(js/auth.js).
     ③ 사진은 localStorage가 아니라 IndexedDB(js/photos.js)에 저장하고 7일 뒤 자동 삭제합니다.
   로컬 모드: localStorage (지금 바로 테스트)
   API 모드  : Apps Script Web App / 모의 서버 (관리시트 연동)

   v0.4 채점 모델 — 문제마다 ⭕/❌ 를 직접 고릅니다.
     marks[키]   : 'o'(맞음) | 'x'(틀림) | 없음(미풀이 → 바로 밀린문제로)
     cleanup[키] : 'fixed'(⚔️ 해결 → 펫 알 부화, 펫 합류) | 'star'(⭐ 질문) | 없음
     tags[키]    : 'calc' | 'read' | 'concept' (1초 이유 태그 · 선택)
   문제 키는 교재까지 포함합니다: '6-1 발전책|8:0' (8쪽 0번째 문제)

   세계관: 못 고친 오답을 고치면 펫 알이 부화해 펫이 합류.
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
  const KEY = 'ema.state.v5';
  const DEMO_KEY = 'ema.state.demo.v5';       // 연습(?mode=demo)은 실제 운영 데이터와 다른 칸에 쌓입니다
  const LEGACY_KEYS = ['ema.state.v4', 'ema.state.v3'];
  const SCHEMA = 5;
  const SESSION = 'ema.session.v2';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  /** 쪽수 입력 파서 — '8~10쪽', '8 ∼ 10', '8,9,10', '8-10쪽' 모두 받습니다 */
  function parsePages(raw) {
    const out = [];
    const push = n => { const v = parseInt(n, 10); if (v > 0 && v < 1000 && out.indexOf(v) < 0) out.push(v); };
    const txt = String(raw == null ? '' : raw)
      .replace(/쪽/g, ' ')
      .replace(/[∼〜～]/g, '~')
      .replace(/[–—－]/g, '-')
      .replace(/[^0-9,\s~-]/g, ' ')
      .replace(/\s*([~-])\s*/g, '$1')     // '8 ∼ 10', '8 - 10' → '8~10'
      .trim();
    txt.split(/[,\s]+/).filter(Boolean).forEach(part => {
      const m = part.match(/^(\d+)\s*[~-]\s*(\d+)$/);
      if (m) {
        const a = +m[1], b = +m[2];
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) push(i);
      } else if (/^\d+$/.test(part)) push(part);
    });
    return out.sort((a, b) => a - b);
  }

  EMA.util = { todayISO, nowHHMM, DOW, pad, shiftISO, parsePages };

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
  /** [6,7,8] → '6-8' · [8] → '8' (연속이 아니면 쉼표)
      카톡은 한 줄의 '~ ~' 사이 전체에 취소선을 그어서, 범위는 하이픈으로 씁니다. */
  function pageSpan(pages) {
    const ps = (pages || []).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (!ps.length) return '';
    if (ps.length === 1) return String(ps[0]);
    let run = true;
    for (let i = 1; i < ps.length; i++) if (ps[i] !== ps[i - 1] + 1) run = false;
    return run ? ps[0] + '-' + ps[ps.length - 1] : ps.join(', ');
  }
  /** '2026-11-19' → '목' */
  function dowName(iso) {
    const d = new Date(iso + 'T12:00:00');
    return isNaN(d.getTime()) ? '' : DOW[d.getDay()];
  }
  /** '2026-11-19' → '11.19(목)' */
  function shortLabel(iso) {
    const m = String(iso || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
    return m ? (+m[1] + '.' + m[2] + '(' + dowName(iso) + ')') : String(iso || '');
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
    /** 교재 + 쪽수 → 문제 타일 목록 (키에 교재 포함 · 단원명까지 붙임) */
    tilesOf(bookName, pages) {
      const out = [];
      const b = this.book(bookName);
      const unitOf = (p) => {
        if (!b) return '';
        for (const u of Object.keys(b.단원 || {})) {
          if (b.단원[u].쪽 && b.단원[u].쪽[String(p)]) return b.단원[u].이름 || '';
        }
        return '';
      };
      (pages || []).forEach(p => {
        const info = this.pageInfo(bookName, p);
        if (!info) {
          out.push({ key: tileKey(bookName, p, 0), label: '?', page: p, num: null, book: bookName, type: '표없음', unitName: '', missing: true });
          return;
        }
        info.문제.forEach((num, i) => out.push({
          key: tileKey(bookName, p, i), label: num, page: p, num, book: bookName, type: info.유형, unitName: unitOf(p)
        }));
      });
      return out;
    }
    /** 문제(교재·쪽)가 속한 단원 이름 — 쪽수표에 없는 쪽은 가장 가까운 단원으로 */
    unitNameOf(bookName, page) {
      const b = this.book(bookName);
      if (!b) return '';
      const p = parseInt(page, 10);
      let best = '', bestDist = Infinity;
      for (const u of Object.keys(b.단원 || {})) {
        const unit = b.단원[u] || {};
        const pages = Object.keys(unit.쪽 || {}).map(Number).sort((x, y) => x - y);
        if (pages.indexOf(p) >= 0) return unit.이름 || '';
        if (!pages.length) continue;
        const d = Math.min.apply(null, pages.map(x => Math.abs(x - p)));
        if (d < bestDist) { bestDist = d; best = unit.이름 || ''; }
      }
      return best;
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
    /** 개별 오답프린트 타일 1~N번 — 제출 완료 전에는 자정이 지나도 이어집니다 */
    printInfo(classId, sid) {
      const P = this.state.prints || {};
      const key = K(classId, this.state.today, sid);
      if (P[key] && P[key].count) return P[key];
      const past = Object.keys(P)
        .map(k => { const p = String(k).split('|'); return { p, v: P[k] }; })
        .filter(x => x.p[0] === classId && x.p[2] === sid && x.v && x.v.count && !x.v.cleared && x.p[1] < this.state.today)
        .sort((a, b) => (a.p[1] < b.p[1] ? 1 : -1));
      for (const x of past) {
        if (!this.printSubmittedSince(classId, sid, x.p[1])) return x.v;
      }
      return null;
    }
    /** 그 날짜 이후로 이 학생의 오답프린트 제출(도장 포함)이 있었는지 */
    printSubmittedSince(classId, sid, fromDate) {
      const S = this.state.submissions || {};
      return Object.keys(S).some(k => {
        const p = String(k).split('|');
        if (p[0] !== classId || p[2] !== sid || p[3] !== 'print' || !(p[1] >= fromDate)) return false;
        const st = S[k] || {};
        return st.status === 'submitted' || st.status === 'stamped' || !!st.stampAt;
      });
    }
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
    /** 사진 인증 — '이 학생이 실제로 ⭕/❌를 누른 쪽'에서만 뽑습니다.
        (전체 숙제 쪽에서 뽑으면 안 푼 쪽을 찍어 오라는 안내가 나갔습니다)
        아직 아무것도 안 눌렀으면 문제가 많은 쪽 → 그래도 없으면 숙제 첫 쪽. */
    verifyTarget(classId, sid) {
      const bs = this.books(classId);
      if (!bs.length) return null;
      const g = this.grade(classId, sid);
      const marks = {};
      this.tiles(classId).forEach(t => {
        if (!g.marks[t.key] || t.missing) return;
        const k = t.book + '|' + t.page;
        const row = marks[k] || (marks[k] = { book: t.book, page: t.page, count: 0 });
        row.count++;
      });
      let pool = Object.keys(marks).map(k => marks[k]);
      if (pool.length) {
        pool.sort((a, b) => (b.count - a.count) || (a.page - b.page));
        const i = hash(sid + '|' + this.state.today + '|verify') % pool.length;
        return { book: pool[i].book, page: pool[i].page };
      }
      const all = [];
      bs.forEach(b => (b.pages || []).forEach(p => all.push({ book: b.book, page: p })));
      if (!all.length) return null;
      const i = hash(sid + '|' + this.state.today + '|verify') % all.length;
      return all[i];
    }
    /** 지금 ② 정리 화면에서 안내할 쪽 — 이미 낸 제출이 있으면 그때 뽑힌 쪽을 그대로 */
    verifyHint(classId, sid, kind) {
      const sub = this.submission(classId, sid, null, kind);
      if (sub && sub.verify) return sub.verify;
      if (kind === 'print') return { book: '오답프린트', page: '프린트' };
      return this.verifyTarget(classId, sid);
    }

    /* ---------- 채점 ---------- */
    grade(classId, sid, date) {
      const d = date || this.state.today;
      const g = this.state.grades[K(classId, d, sid)];
      if (!g) return { marks: {}, cleanup: {}, tags: {}, updatedAt: null };
      if (!g.marks) g.marks = {};
      if (!g.cleanup) g.cleanup = {};
      if (!g.tags) g.tags = {};
      return g;
    }
    gradeOf(classId, sid, kind) {
      const k = kind === 'print' ? K(classId, this.state.today, sid) + '|print' : K(classId, this.state.today, sid);
      const g = this.state.grades[k];
      if (!g) return { marks: {}, cleanup: {}, tags: {}, updatedAt: null };
      if (!g.marks) g.marks = {};
      if (!g.cleanup) g.cleanup = {};
      if (!g.tags) g.tags = {};
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
    /** 오늘 숙제(또는 프린트)에서 '⭐ 질문'으로 고른 문제 수 — 최대 7개 */
    starCount(classId, sid, kind) {
      const g = this.gradeOf(classId, sid, kind);
      return Object.keys(g.cleanup || {}).filter(k => g.cleanup[k] === 'star').length;
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
    /** 오늘 낸 숙제(숙제·프린트)에 이미 '확정'된 XP — 두 번 더하지 않으려고 뺍니다 */
    todayBankedXp(classId, sid) {
      const S = this.state.submissions || {};
      let n = 0;
      [K(classId, this.state.today, sid), K(classId, this.state.today, sid) + '|print'].forEach(k => {
        const sub = S[k];
        if (sub && sub.xp) n += Number(sub.xp) || 0;
      });
      return n;
    }
    /** 누적 XP = 지금까지 확정된 XP + 오늘 아직 확정 전인 몫 (레벨이 진짜로 오릅니다) */
    totalXP(classId, sid) {
      const s = this.student(classId, sid);
      const banked = s ? (s.xp || 0) + (s.bonusXp || 0) : 0;
      const live = this.stats(classId, sid).xp + this.printStats(classId, sid).xp;
      const delta = Math.max(0, live - this.todayBankedXp(classId, sid));
      return banked + delta;
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
    /** 보스 HP — 도장 80% · 오답 수정 20% + 동료(펫) 공격력(반 전체 최대 15%p).
        예전엔 화면에만 '공격력 +n%'라고 쓰고 실제 데미지에는 한 글자도 안 들어갔습니다. */
    boss(classId) {
      const rows = this.classDay(classId);
      const total = rows.length || 1;
      const stamped = rows.filter(r => r.sub && r.sub.stampAt).length;
      const submitted = rows.filter(r => r.sub || r.printSub).length;
      const fixed = rows.reduce((a, r) => a + r.c3 + r.p3, 0);
      const power = rows.reduce((a, r) => a + (this.companionPower(classId, r.student.id) || 0), 0);
      const petDmg = Math.min(0.15, power * 0.01);          // 동료 1 = 보스 HP 1%p
      const dmg = (stamped / total) * 0.8 + Math.min(0.2, (fixed / (total * 3)) * 0.2) + petDmg;
      const hp = Math.max(0, Math.round((1 - dmg) * 100 - this.bossBoost(classId)));
      const killed = hp <= 0;
      return {
        total, stamped, submitted, fixed, power, petDmg: Math.round(petDmg * 100),
        hp, left: total - stamped, def: this.bossDef(classId), killed,
        myShare: 0
      };
    }
    /** 내가 깎은 HP (%) — 반 전체 데미지 중 내 몫 (도장 + 오답 수정 + 내 동료 공격력) */
    myDamage(classId, sid) {
      const total = (this.getClass(classId).students.length) || 1;
      const st = this.stats(classId, sid);
      const p = this.printStats(classId, sid);
      const row = this.submission(classId, sid);
      const stampPt = (row && row.stampAt) ? 0.8 / total : 0;
      const fixedPt = Math.min(0.2, ((st.c3 + p.c3) / (total * 3)) * 0.2);
      const compPt = this.companionPower(classId, sid) * 0.01;   // 동료 1 = 1%p
      return Math.round((stampPt + fixedPt + compPt) * 100 * 10) / 10;
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

    /* ---------- 수학 동료 (v0.4 세계관) ---------- */
    /** 동료 공격력 — 동료 수 + 성장(lv) 합계, 최대 15 (= 보스 HP 15%p까지) */
    companionPower(classId, sid) {
      const pets = this.myPets(classId, sid);
      let p = 0;
      pets.forEach(x => { p += Math.max(1, Math.min(3, x.lv || 1)); });
      return Math.min(15, p);
    }
    /** 화면 표기용 — 동료 공격력 1당 보스 HP 1%p (표시와 실제 데미지가 같습니다) */
    companionPct(classId, sid) {
      return this.companionPower(classId, sid);
    }
    /** 지금 화면에 보여 줄 '어둠의 오답 알' — 오늘 안 고친 ❌ + 밀린문제 */
    darkEggs(classId, sid) {
      const out = [];
      const g = this.grade(classId, sid);
      this.tiles(classId).forEach(t => {
        if (g.marks[t.key] !== 'x' || g.cleanup[t.key] === 'fixed') return;
        out.push({
          id: 'today_' + t.key, key: t.key, book: t.book, page: t.page, num: t.num,
          label: (t.page + '쪽 ' + t.num + '번'), unitName: t.unitName || this.unitNameOf(t.book, t.page),
          date: this.state.today, today: true, reason: g.cleanup[t.key] === 'star' ? 'star' : 'x',
          name: this.monsterOf(t.page + '쪽 ' + t.num + '번').name
        });
      });
      this.carried(classId, sid).forEach(m => {
        out.push(Object.assign({}, m, { reason: m.reason || 'x' }));
      });
      return out;
    }
    /** 지금까지 정화한 알 수 (동료가 된 알 + 밀린문제 해결) */
    purifiedCount(classId, sid) {
      const mons = (this.state.monsters[sid] || []).filter(m => m.captured).length;
      return mons + this.solvedCarried(sid).length;
    }

    /** 📊 약점 단원 & 실수 패턴 리포트 (아이·선생님 공통) */
    weakReport(classId, sid) {
      const wrongByUnit = {}, fixByUnit = {};
      const add = (book, page, fixed) => {
        const u = this.unitNameOf(book, page) || book || '기타';
        wrongByUnit[u] = (wrongByUnit[u] || 0) + 1;
        if (fixed) fixByUnit[u] = (fixByUnit[u] || 0) + 1;
      };
      const g = this.grade(classId, sid);
      this.tiles(classId).forEach(t => {
        if (g.marks[t.key] !== 'x') return;
        add(t.book, t.page, g.cleanup[t.key] === 'fixed');
      });
      ((this.state.carried || {})[sid] || []).forEach(m => {
        if ((m.reason || 'x') === 'skip') return;      // ⏭️ 안 푼 문제는 오답 통계가 아닙니다
        add(m.book, m.page, false);
      });
      ((this.state.solvedCarried || {})[sid] || []).forEach(m => {
        if ((m.reason || 'x') === 'skip' || m.skip) return;
        add(m.book, m.page, true);
      });
      ((this.state.monsters || {})[sid] || []).forEach(m => { if (m.fromCarry) return; add(m.book, m.page, !!m.captured); });

      const units = Object.keys(wrongByUnit)
        .map(name => ({ name, wrong: wrongByUnit[name], fixed: fixByUnit[name] || 0 }))
        .sort((a, b) => (b.wrong - a.wrong) || (b.fixed - a.fixed));

      const counts = { calc: 0, read: 0, concept: 0 };
      Object.keys(this.state.grades || {}).forEach(k => {
        const parts = k.split('|');
        if (parts[0] !== classId || parts[2] !== sid) return;
        const row = this.state.grades[k];
        Object.keys((row && row.tags) || {}).forEach(tk => { const v = row.tags[tk]; if (counts[v] != null) counts[v]++; });
      });
      const defs = GAME().tags || [];
      const tagTotal = counts.calc + counts.read + counts.concept;
      const tags = defs.map(d => ({
        id: d.id, label: d.label, em: d.em, count: counts[d.id] || 0,
        pct: tagTotal ? Math.round((counts[d.id] || 0) / tagTotal * 100) : 0
      })).sort((a, b) => b.count - a.count);

      const totalWrong = units.reduce((a, u) => a + u.wrong, 0);
      return { units: units.slice(0, 3), allUnits: units, tags, tagTotal, totalWrong };
    }

    /* ---------- 친구들 풀이 공개 (v0.4 규칙) ----------
       · 본인도 제출 완료한 학생만
       · 수업 시작 시각 이후 (또는 선생님이 공개로 열었을 때) 만
       · 점수·맞은 개수·좋아요는 절대 보여 주지 않는다 */
    classStartMin(c) {
      const m = String((c && c.time) || '').match(/(\d{1,2}):(\d{2})/);
      return m ? (+m[1]) * 60 + (+m[2]) : null;
    }
    galleryInfo(classId, sid) {
      const c = this.getClass(classId);
      const sub = this.submission(classId, sid);
      const mine = !!(sub && (sub.status === 'submitted' || sub.status === 'stamped'));
      const mode = (this.state.gallery && this.state.gallery.mode) || 'auto';
      const start = this.classStartMin(c);
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const timeOk = start == null ? true : nowMin >= start;
      const startLabel = start == null ? '수업 시작' : (String(Math.floor(start / 60)).padStart(2, '0') + ':' + String(start % 60).padStart(2, '0'));
      let open = true, reason = '';
      if (!mine) { open = false; reason = 'mine'; }
      else if (mode === 'closed') { open = false; reason = 'closed'; }
      else if (mode === 'open') { open = true; }
      else if (!timeOk) { open = false; reason = 'before'; }
      return { open, reason, mine, mode, start, startLabel, timeOk };
    }
    setGalleryMode(mode) {
      this.state.gallery = Object.assign({ open: null, claims: [] }, this.state.gallery || {}, { mode });
      this.save();
    }

    /* ---------- 사진 다시 올리기 (제출 후 1시간) ---------- */
    reuploadInfo(classId, sid, kind) {
      const sub = this.submission(classId, sid, null, kind);
      if (!sub) return { ok: false, mins: 0 };
      if (sub.stampAt || sub.status === 'stamped') return { ok: false, mins: 0, stamped: true };
      const ts = sub.ts || 0;
      const left = ts ? (ts + 3600000 - Date.now()) : 0;
      if (left <= 0) return { ok: false, mins: 0, expired: true };
      return { ok: true, mins: Math.max(1, Math.ceil(left / 60000)), left };
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
    /* ---------- 어머님용 전문 성취도 리포트 ----------
       학원 성적표 톤: 게임 용어(펫·불꽃·보스·XP·코인) 없이
       기간 안의 채점 기록·제출 기록·단원평가만 모아 정리합니다.
       → 학습 성실도 / 풀이·오답 해결 / 오답 원인 3비율 / 취약 단원 / 단원평가 */
    parentReport(classId, sid, range) {
      const today = this.state.today;
      const days = range === 'week' ? 7 : range === 'month' ? 30 : 120;
      const from = shiftISO(today, -(days - 1));
      const c = this.getClass(classId) || {};
      const s = this.student(classId, sid) || {};
      const inRange = d => !!d && d >= from && d <= today;

      /* ① 기간 안 채점 기록 — 날짜별 키: classId|date|sid (프린트는 뒤에 |print) */
      let solved = 0, wrong = 0, fixed = 0;
      const unitMap = {};
      const tagCounts = { calc: 0, read: 0, concept: 0 };
      const gradedDates = {};
      const addUnit = (book, page, isFixed) => {
        const unit = this.unitNameOf(book, page) || book || '기타';
        const u = unitMap[unit] || (unitMap[unit] = { name: unit, wrong: 0, fixed: 0 });
        u.wrong++;
        if (isFixed) u.fixed++;
        return u;
      };
      Object.keys(this.state.grades || {}).forEach(k => {
        const p = String(k).split('|');
        if (p[0] !== classId || p[2] !== sid) return;
        const d = p[1];
        if (!inRange(d)) return;
        gradedDates[d] = true;
        const row = this.state.grades[k] || {};
        Object.keys(row.marks || {}).forEach(mk => {
          const m = row.marks[mk];
          if (m !== 'o' && m !== 'x') return;
          solved++;
          if (m !== 'x') return;
          wrong++;
          const isFixed = (row.cleanup || {})[mk] === 'fixed';
          if (isFixed) fixed++;
          const mp = String(mk).split('|');
          addUnit(mp[0], parseInt(String(mp[1] || '').split(':')[0], 10), isFixed);
          const tg = (row.tags || {})[mk];
          if (tg && tagCounts[tg] != null) tagCounts[tg]++;
        });
      });

      /* ② 아직 못 고친 오답 (밀린문제) / 재풀이 완료 기록 */
      ((this.state.carried || {})[sid] || []).forEach(m => {
        if (!inRange(m.date)) return;
        if ((m.reason || 'x') === 'skip') return;       // 안 푼 문제는 오답이 아님
        wrong++;
        addUnit(m.book, m.page, false);
      });
      ((this.state.solvedCarried || {})[sid] || []).forEach(m => {
        if (!inRange(m.date)) return;
        if ((m.reason || 'x') === 'skip' || m.skip) return;   // ⏭️ 안 푼 문제 해결은 '오답을 고친 것'이 아닙니다
        wrong++; fixed++;
        addUnit(m.book, m.page, true);
      });
      ((this.state.monsters || {})[sid] || []).forEach(m => {
        if (m.fromCarry || m.skip) return;                        // 밀린문제 해결분은 위에서 셈
        if (!inRange(m.date)) return;
        wrong++;
        if (m.captured) fixed++;
        addUnit(m.book, m.page, !!m.captured);
      });

      /* ③ 풀이 문항 수 — 채점 기록이 없는 날은 기존 학습 기록으로 보충 */
      const hist = (this.state.history[sid] || []).filter(h => inRange(h.date) && !gradedDates[h.date]);
      const histSolved = hist.reduce((a, h) => a + (h.solved || 0), 0);
      const histActive = hist.filter(h => (h.solved || 0) > 0).length;
      const totalSolved = solved + histSolved;

      /* ④ 학습 성실도 — 연속 학습일 · 숙제 완료율(수업일 기준) */
      const streak = this.streak(classId, sid);
      const dowMap = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
      let dowSet = [];
      String(c.days || '').split(/[^가-힣]+/).forEach(tok => {
        String(tok).split('').forEach(ch => { if (dowMap[ch] != null && dowSet.indexOf(dowMap[ch]) < 0) dowSet.push(dowMap[ch]); });
      });
      if (!dowSet.length) dowSet = [2, 3, 4, 5, 6];      // 수업일 정보가 없으면 화~토
      const doneDays = {};
      Object.keys(this.state.submissions || {}).forEach(k => {
        const p = String(k).split('|');
        if (p[0] !== classId || p[2] !== sid) return;
        const st = this.state.submissions[k];
        if (st && inRange(p[1]) && (st.status === 'submitted' || st.status === 'stamped')) doneDays[p[1]] = true;
      });
      (this.state.history[sid] || []).forEach(h => {
        if (inRange(h.date) && (h.solved || 0) >= FLAME_MIN) doneDays[h.date] = true;
      });
      let classDays = 0, doneClassDays = 0;
      // 기록이 시작되기 전 날은 '숙제가 나간 날'인지 알 수 없으니 분모에서 뺍니다
      let startFrom = from;
      const recordDates = Object.keys(gradedDates).concat(((this.state.history[sid] || []).filter(h => inRange(h.date)).map(h => h.date)));
      if (recordDates.length) {
        const first = recordDates.sort()[0];
        if (first > startFrom) startFrom = first;
      }
      for (let d = startFrom; d <= today; d = shiftISO(d, 1)) {
        const wd = new Date(d + 'T12:00:00').getDay();
        if (dowSet.indexOf(wd) < 0) continue;
        classDays++;
        if (doneDays[d]) doneClassDays++;
      }
      const hwRate = classDays ? Math.round(doneClassDays / classDays * 100) : 0;

      /* ⑤ 오답 원인 3비율 (항상 세 가지를 모두 표시) */
      const defs = GAME().tags || [];
      const tagTotal = tagCounts.calc + tagCounts.read + tagCounts.concept;
      const tags = defs.map(d => ({
        id: d.id,
        label: d.id === 'concept' ? '개념 보완 필요' : d.label,
        em: d.em, count: tagCounts[d.id] || 0,
        pct: tagTotal ? Math.round((tagCounts[d.id] || 0) / tagTotal * 100) : 0
      }));

      /* ⑥ 취약 단원 · 단원평가 */
      const units = Object.keys(unitMap)
        .map(name => unitMap[name])
        .sort((a, b) => (b.wrong - a.wrong) || (b.fixed - a.fixed))
        .slice(0, 3);
      const exams = this.exam(classId, sid).filter(e => e.score != null && e.date >= from);
      const avgExam = exams.length ? Math.round(exams.reduce((a, e) => a + (e.score || 0), 0) / exams.length) : null;

      /* ⑦ 이번 주 일자별 진도·숙제 + 개별 오답프린트 */
      const dayMap = Object.assign({}, ((this.state.dayLessons || {})[classId] || {}));
      const todayLesson = this.lesson(classId);
      if (todayLesson && todayLesson.date) {
        dayMap[todayLesson.date] = Object.assign({}, dayMap[todayLesson.date], todayLesson);
      }
      const cleanLine = t => String(t || '').replace(/\s+/g, ' ').trim();
      const dayList = Object.keys(dayMap)
        .filter(d => inRange(d))
        .sort()
        .reverse()
        .slice(0, range === 'week' ? 7 : 5)
        .map(d => {
          const L = dayMap[d] || {};
          const books = (L.books || []).map(b => (b.book || '') + (b.pages && b.pages.length ? ' ' + pageSpan(b.pages) + '쪽' : '')).filter(Boolean);
          return {
            date: d, dow: dowName(d), label: shortLabel(d),
            lesson: cleanLine(L.lesson) || '',
            homework: cleanLine(L.homework) || (books.length ? books.join(', ') : '')
          };
        })
        .filter(d => d.lesson || d.homework);
      const printList = Object.keys(this.state.prints || {})
        .map(k => { const p = String(k).split('|'); return { p, v: (this.state.prints || {})[k] || {} }; })
        .filter(x => x.p[0] === classId && x.p[2] === sid && inRange(x.p[1]) && (x.v.count || 0) > 0)
        .map(x => ({ date: x.p[1], label: shortLabel(x.p[1]), md: (+x.p[1].slice(5, 7)) + '.' + x.p[1].slice(8, 10), count: x.v.count }))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, range === 'week' ? 7 : 3);

      return {
        range,
        label: range === 'week' ? '이번 주' : range === 'month' ? '이번 달' : '이번 학기',
        from, to: today, days,
        streak, hwRate, classDays, doneClassDays,
        solved: totalSolved, wrong, fixed,
        fixRate: wrong ? Math.round(fixed / wrong * 100) : 0,
        units, tags, tagTotal,
        exams, avgExam,
        dayList, printList,
        activeDays: histActive + Object.keys(gradedDates).length
      };
    }
    kakaoSummary(classId, sid, range) {
      const s = this.student(classId, sid) || {};
      const c = this.getClass(classId) || {};
      const r = this.parentReport(classId, sid, range);
      const pct = id => { const t = r.tags.find(x => x.id === id); return t ? t.pct : 0; };
      const kd = iso => iso.slice(5).replace('-', '.');
      const lines = [];
      lines.push(`안녕하세요 어머님, ${c.name || ''} 담임입니다.`);
      lines.push(`${s.name} 학생의 ${r.label} 학습 리포트를 보내 드립니다. (${kd(r.from)} - ${kd(r.to)})`);
      lines.push('');
      if (r.dayList.length || r.printList.length) {
        lines.push(`■ ${r.label} 진도 및 숙제`);
        r.dayList.forEach(d => {
          const parts = [];
          if (d.lesson) parts.push(`진도: ${d.lesson}`);
          if (d.homework) parts.push(`숙제: ${d.homework}`);
          lines.push(`· ${d.label} ${parts.join(' / ')}`);
        });
        r.printList.forEach(p => lines.push(`· 추가 과제: 개별 오답프린트 ${p.count}문항 배부 (${p.md})`));
        lines.push('');
      }
      lines.push('■ 학습 성실도');
      lines.push(`· 연속 ${r.streak}일 학습${r.classDays ? ` · 숙제 ${r.classDays}회 중 ${r.doneClassDays}회 완료 (${r.hwRate}%)` : ''}`);
      lines.push('');
      lines.push('■ 풀이 및 오답 해결');
      lines.push(`· 총 ${r.solved}문항 풀이 · 오답 ${r.wrong}개 중 ${r.fixed}개 재풀이 완료 (${r.fixRate}%)`);
      lines.push('');
      if (r.wrong === 0) {
        lines.push('■ 오답 원인 분석');
        lines.push('· 이번 기간 오답 없음');
        lines.push('');
      } else if (r.tagTotal > 0) {
        lines.push('■ 오답 원인 분석');
        lines.push(`· 계산 실수 ${pct('calc')}% · 문제 잘못 읽음 ${pct('read')}% · 개념 보완 필요 ${pct('concept')}%`);
        lines.push('');
      }
      lines.push('■ 취약 단원');
      if (r.units.length) {
        r.units.forEach(u => lines.push(`· ${u.name} — 오답 ${u.wrong}개${u.fixed ? ` (재풀이 ${u.fixed}개)` : ''}`));
      } else {
        lines.push('· 이 기간에 오답 기록이 없습니다.');
      }
      lines.push('');
      lines.push('■ 학원 단원평가');
      if (r.exams.length) {
        r.exams.slice(-3).forEach(e => {
          lines.push(`· ${e.unit.replace(' 평가', '')} ${e.score}점${e.retest != null ? ` (재시험 ${e.retest}점)` : ''}`);
        });
        if (r.avgExam != null) lines.push(`· 평균 ${r.avgExam}점`);
      } else {
        lines.push('· 이 기간에 응시한 단원평가가 없습니다.');
      }
      lines.push('');
      lines.push('가정에서도 꾸준한 복습을 응원해 주시면 좋겠습니다. 감사합니다.');
      return lines.join('\n');
    }
  }

  /* ================= 로컬 저장소 ================= */
  class LocalStore extends BaseStore {
    constructor(seedFn, opts) {
      super();
      this.seedFn = seedFn;
      this.mode = 'local';
      this.demo = !!(opts && opts.demo);
      this.key = this.demo ? DEMO_KEY : KEY;
    }
    _read(key) {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
    }
    _write(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
    }
    /** 스키마 마이그레이션 — 버전이 달라도 데이터를 버리지 않고 빠진 칸만 채웁니다 */
    migrate(st) {
      if (!st || typeof st !== 'object') return this.seedFn(todayISO());
      const from = Number(st.version || 0);
      if (from > SCHEMA) console.warn('저장 구조가 앱보다 새 버전입니다(데이터는 그대로 사용):', from);
      if (from < SCHEMA) this._write(this.key + '.migrate.v' + from, st);   // 옮기기 전 원본 백업
      if (st.teacherPin) delete st.teacherPin;          // 옛 선생님 PIN은 저장 구조에서 삭제
      st.version = SCHEMA;
      st.classes = st.classes || [];
      st.lessons = st.lessons || {};
      st.dayLessons = st.dayLessons || {};
      st.exams = st.exams || {};
      st.pageMaps = st.pageMaps || window.EMA_PAGE_MAPS || { 교재: {} };
      st.grades = st.grades || {};
      st.submissions = st.submissions || {};
      st.history = st.history || {};
      st.monsters = st.monsters || {};
      st.carried = st.carried || {};
      st.solvedCarried = st.solvedCarried || {};
      st.prints = st.prints || {};
      st.lateUploads = st.lateUploads || {};
      st.photos = st.photos || {};
      st.carryResolve = st.carryResolve || {};
      if (!st.shop) st.shop = { rewardsOn: true, claims: [] };
      if (!st.gallery) st.gallery = { mode: 'auto' };
      if (!st.bossBoosts) st.bossBoosts = {};
      if (!st.bossKills) st.bossKills = {};
      if (!st.meta) st.meta = {};
      if (this.demo) { st.meta.demo = true; st.meta.origin = 'demo'; }
      st.classes.forEach(c => {
        c.students = c.students || [];
        c.textbooks = c.textbooks || [];
        c.students.forEach(s => {
          if (!s.purified) s.purified = {};
          s.pets = (s.pets || []).map(p => Object.assign({ lv: 1 }, p));
          s.bag = s.bag || { snack: 0, shield: 0, bomb: 0 };
          s.titles = s.titles || [];
          if (typeof s.xp !== 'number') s.xp = 0;
          if (typeof s.bonusXp !== 'number') s.bonusXp = 0;
          if (typeof s.coins !== 'number') s.coins = 0;
          if (!s.pin) s.pin = '1234';
        });
      });
      Object.keys(st.grades).forEach(k => {
        const g = st.grades[k];
        if (!g) return;
        if (!g.marks) g.marks = {};
        if (!g.cleanup) g.cleanup = {};
        if (!g.tags) g.tags = {};
      });
      // 사진은 지워져도 '사진을 냈다'는 사실은 영구히 남깁니다
      Object.keys(st.submissions).forEach(k => {
        const sub = st.submissions[k];
        if (!sub) return;
        if (sub.photoId) { sub.photoSubmitted = true; if (!sub.photoAt) sub.photoAt = sub.at || ''; }
      });
      return st;
    }

    async init() {
      const today = todayISO();
      if (window.EMA.photos) await EMA.photos.load();
      let st = this._read(this.key);
      if (!st && !this.demo) {
        // v0.7 이하(ema.state.v4) 데이터가 있으면 통째로 살려서 옮깁니다 — 버리지 않습니다
        for (const k of LEGACY_KEYS) {
          const old = this._read(k);
          if (old && (old.classes || old.grades || old.submissions)) {
            st = old;
            this._write(this.key + '.legacy.' + k.split('.').pop(), old);
            break;
          }
        }
      }
      if (!st) {
        st = this.seedFn(today);
        if (this.demo) st.meta = Object.assign({}, st.meta, { demo: true, origin: 'demo' });
      }
      st = this.migrate(st);
      this.state = st;
      await this._afterLoad(today);
      this.save();
      return this.state;
    }

    /** 부팅 뒤처리 — ① 날짜 넘기기 ② 사진 이전 ③ 7일 지난 사진 삭제 */
    async _afterLoad(today) {
      const st = this.state;
      const rolled = this._rollForward(today);
      if (rolled.moved) console.info('날짜 넘김 — 기록 유지:', rolled.from, '→', rolled.to);
      if (window.EMA.photos && Object.keys(st.photos || {}).length) {
        const r = await EMA.photos.migrateFrom(st.photos, st.today || today);
        if (r.moved) console.info('사진을 IndexedDB로 옮겼습니다:', r.moved, '장');
        if (r.failed) console.warn('사진 이전 실패:', r.failed, '장');
      }
      await this.purgePhotos();
    }

    /** 날짜 넘기기 — 펬·코인·XP·모음·채점·도장·기록은 그대로 두고 '오늘'만 옮깁니다 */
    _rollForward(today) {
      const st = this.state;
      const from = st.today;
      if (!from) { st.today = today; return { moved: 0 }; }
      if (from === today) return { moved: 0 };
      if (from > today) { st.today = today; return { moved: 0, back: true }; }   // 기기 시계를 되돌린 경우
      let d = from, n = 0, guard = 0;
      while (d < today && guard++ < 800) {
        this._bankDay(d);
        d = shiftISO(d, 1);
        n++;
      }
      st.today = today;
      st.meta = Object.assign({}, st.meta, { rolledAt: new Date().toISOString() });
      return { moved: n, from, to: today };
    }
    /** 지나간 날의 기록을 확정합니다 — XP 적립 + 그날 학습 기록(달력·성취도에 쓰임) */
    _bankDay(date) {
      const st = this.state;
      const S = st.submissions || {};
      Object.keys(S).forEach(k => {
        const p = String(k).split('|');
        if (p[1] !== date) return;
        const sub = S[k];
        if (!sub || sub.xpBanked) return;
        const xp = Number(sub.xp || 0);
        const hit = this.studentById(p[2]);
        if (hit && xp) hit.stu.xp = (hit.stu.xp || 0) + xp;
        sub.xpBanked = true;
        sub.xpBankedAt = date;
      });
      const G = st.grades || {};
      Object.keys(G).forEach(k => {
        const p = String(k).split('|');
        if (p[1] !== date) return;
        const g = G[k] || {};
        const marks = Object.keys(g.marks || {}).length;
        if (!marks) return;
        const sid = p[2];
        const hist = st.history[sid] = st.history[sid] || [];
        const row = hist.find(h => h.date === date);
        if (row) row.solved = Math.max(row.solved || 0, marks);
        else hist.push({ date, solved: marks });
      });
    }

    save() {
      try {
        localStorage.setItem(this.key, JSON.stringify(this.state));
        this.saveFailed = false;
        return true;
      } catch (e) {
        this.saveFailed = true;
        console.warn('저장 실패(용량?)', e);
        if (!this._warnAt || Date.now() - this._warnAt > 60000) {
          this._warnAt = Date.now();
          if (window.EMA && EMA.ui && EMA.ui.toast) EMA.ui.toast('⚠️ 기기 저장 공간이 부족해요. 선생님께 알려 주세요', 3600);
        }
        return false;
      }
    }
    /** 초기화 — 지우기 전에 반드시 백업하고 현재 칸(연습/운영)만 비웁니다 */
    reset() {
      try { localStorage.setItem(this.key + '.backup', JSON.stringify({ at: new Date().toISOString(), state: this.state })); } catch (e) { }
      try {
        localStorage.removeItem(this.key);
        LEGACY_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { } });
        localStorage.removeItem(SESSION);
      } catch (e) { }
      return this.init();
    }
    session() {
      let s = null;
      try { s = JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { s = null; }
      if (!s) return null;
      const ok = window.EMA.auth ? EMA.auth.fresh(s) : true;
      if (!ok) { try { localStorage.removeItem(SESSION); } catch (e) { } return null; }
      return s;
    }
    setSession(s) {
      if (!s) { try { localStorage.removeItem(SESSION); } catch (e) { } return; }
      const row = window.EMA.auth ? EMA.auth.stamp(s) : s;
      try { localStorage.setItem(SESSION, JSON.stringify(row)); } catch (e) { }
    }

    gradeRow(classId, sid, kind) {
      const k = kind === 'print' ? K(classId, this.state.today, sid) + '|print' : K(classId, this.state.today, sid);
      const g = this.state.grades[k] || (this.state.grades[k] = { marks: {}, cleanup: {}, tags: {}, updatedAt: null });
      if (!g.marks) g.marks = {};
      if (!g.cleanup) g.cleanup = {};
      if (!g.tags) g.tags = {};
      return g;
    }

    /* 쓰기 — 채점 */
    /** mark: 'o' | 'x' | '' (같은 것을 다시 누르면 해제 → 미풀이) */
    setMark(classId, sid, key, mark, kind) {
      const g = this.gradeRow(classId, sid, kind);
      if (!mark || g.marks[key] === mark) {
        delete g.marks[key];
        delete g.cleanup[key];
        delete g.tags[key];
      } else {
        g.marks[key] = mark;
        if (mark === 'o') { delete g.cleanup[key]; delete g.tags[key]; }
      }
      // 다시 채점한 문제는 '밀린문제'에서 뺀다 (오늘 넘긴 것만)
      if (mark) this.dropTodayCarry(sid, key);
      g.updatedAt = nowHHMM();
      this.save();
      return g.marks[key] || '';
    }
    /** 1초 이유 태그 — 선택 사항(강제 아님) */
    setTag(classId, sid, key, tag, kind) {
      const g = this.gradeRow(classId, sid, kind);
      if (g.marks[key] !== 'x') return '';
      if (!tag || g.tags[key] === tag) delete g.tags[key];
      else g.tags[key] = tag;
      g.updatedAt = nowHHMM();
      this.save();
      return g.tags[key] || '';
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

    /* ---------- 어둠의 알 정화 → 수학 동료 합류 (v0.4) ---------- */
    /** 같은 알을 두 번 정화하지 않습니다(seedKey 로 기억). */
    purifyEgg(classId, sid, seedKey) {
      const s = this.student(classId, sid);
      if (!s) return null;
      s.pets = s.pets || [];
      s.purified = s.purified || {};
      if (s.purified[seedKey]) return null;
      const cat = (GAME().pets || []);
      if (!cat.length) return null;
      const owned = new Set(s.pets.map(p => p.id));
      const h = hash(seedKey);
      let pool = [];
      // 오답을 고쳐 만나는 펫도 상점 알과 '같은 확률' — 일반 78% · 희귀 19% · 전설 3% (pets.js rarity.rate)
      const rc = GAME().rarity || {};
      const rLegend = (rc.legend && rc.legend.rate) || 3;
      const rRare = (rc.rare && rc.rare.rate) || 19;
      const roll = h % 100;
      if (roll < rLegend) pool = cat.filter(p => p.rarity === 'legend' && !owned.has(p.id));
      if (!pool.length && roll < rLegend + rRare) pool = cat.filter(p => p.rarity === 'rare' && !owned.has(p.id));
      if (!pool.length) pool = cat.filter(p => p.rarity === 'common' && !owned.has(p.id));
      if (!pool.length) pool = cat.filter(p => !owned.has(p.id));
      if (!pool.length) {
        // 도감을 다 채웠으면 동료가 힘을 보태 코인을 준다
        s.purified[seedKey] = { at: this.state.today, bonus: 5 };
        s.coins = (s.coins || 0) + 5;
        this.save();
        return { coins: 5 };
      }
      const pick = pool[h % pool.length];
      s.pets.push({ id: pick.id, name: pick.name, rarity: pick.rarity, em: pick.em, at: this.state.today, lv: 1, from: 'purify' });
      s.purified[seedKey] = { at: this.state.today, petId: pick.id };
      const titles = this._awardTitles(classId, sid, { legendary: pick.rarity === 'legend' });
      this.save();
      return { pet: pick, titles };
    }

    /* ---------- 밀린문제(이월) — 제출 즉시 넘기기 ---------- */
    _addCarry(sid, item) {
      const list = this.state.carried[sid] = this.state.carried[sid] || [];
      item.id = item.id || ('c_' + Date.now().toString(36) + Math.floor(Math.random() * 900));
      list.push(item);
      return item;
    }
    _hasCarry(sid, date, key) {
      const hit = list => (list || []).some(m => m.origin && m.origin.date === date && m.origin.key === key);
      return hit(this.state.carried[sid]) || hit(this.state.solvedCarried[sid]);
    }
    dropTodayCarry(sid, key) {
      const list = (this.state.carried || {})[sid] || [];
      const i = list.findIndex(m => m.origin && m.origin.date === this.state.today && m.origin.key === key);
      if (i < 0) return false;
      list.splice(i, 1);
      this.save();
      return true;
    }
    /** 제출할 때 '안 누른 문제'를 바로 밀린문제로 넘깁니다 (자정 기다리지 않음) */
    carryOverUnmarked(classId, sid, kind) {
      if (kind === 'print') return 0;
      const g = this.grade(classId, sid);
      let n = 0;
      this.tiles(classId).forEach(t => {
        if (g.marks[t.key]) return;
        if (this._hasCarry(sid, this.state.today, t.key)) return;
        this._addCarry(sid, {
          book: t.book, page: t.page, num: t.num, label: (t.page + '쪽 ' + t.num + '번'),
          date: this.state.today, reason: 'skip', origin: { date: this.state.today, key: t.key }
        });
        n++;
      });
      if (n) this.save();
      return n;
    }
    /** 테스트용: '다음 날로 넘겨보기' — 반 전원의 오늘 미풀이·안 고친 오답을 밀린문제로 */
    nextDayPreview(classId) {
      const c = this.getClass(classId);
      const rows = [];
      let total = 0;
      c.students.forEach(s => {
        const g = this.grade(classId, s.id);
        let n = 0;
        this.tiles(classId).forEach(t => {
          const mark = g.marks[t.key];
          if (mark === 'o') return;
          if (mark === 'x' && g.cleanup[t.key] === 'fixed') return;
          if (this._hasCarry(s.id, this.state.today, t.key)) return;
          this._addCarry(s.id, {
            book: t.book, page: t.page, num: t.num, label: (t.page + '쪽 ' + t.num + '번'),
            date: this.state.today,
            reason: mark === 'x' ? (g.cleanup[t.key] === 'star' ? 'star' : 'x') : 'skip',
            origin: { date: this.state.today, key: t.key }
          });
          n++;
        });
        total += n;
        rows.push({ student: s, added: n, total: this.carried(classId, s.id).length });
      });
      this.save();
      return { rows, total };
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
      return this._submitPhoto(classId, sid, dataUrl, kind);
    }
    async _submitPhoto(classId, sid, dataUrl, kind) {
      const t = this.timing(classId);
      const rw = this.previewReward(classId, sid, kind);
      const pid = 'ph_' + Date.now().toString(36) + Math.floor(Math.random() * 99);
      const put = await this._savePhoto(pid, dataUrl, sid, kind);
      const prev = this.submission(classId, sid, null, kind);
      const already = !!(prev && prev.rewarded);
      const sub = {
        status: 'submitted', at: nowHHMM(), ts: Date.now(),
        photoId: put.ok ? pid : null, photoAt: nowHHMM(), photoSubmitted: true,
        stampAt: null,
        verify: kind === 'print' ? { book: '오답프린트', page: '프린트' } : this.verifyTarget(classId, sid),
        kind: kind || 'hw',
        early: t.kind === 'early', shield: t.kind === 'shield',
        coins: already ? 0 : rw.coins, xp: already ? 0 : rw.xp, rewarded: true,
        xpBanked: false
      };
      const prevPhoto = prev && prev.photoId;
      this.state.submissions[SK(classId, this.state.today, sid, kind)] = sub;
      const s = this.student(classId, sid);
      if (!already && s) {
        s.coins = (s.coins || 0) + rw.coins;
        s.xp = (s.xp || 0) + rw.xp;              // ★ XP가 실제로 쌓여 레벨에 반영됩니다
        sub.xpBanked = true;
      }
      if (already && put.ok && prevPhoto && prevPhoto !== sub.photoId) await this.deletePhoto(prevPhoto);
      // 안 누른 문제는 바로 밀린문제로 (v0.4)
      const carried = this.carryOverUnmarked(classId, sid, kind);
      const st = kind === 'print' ? this.printStats(classId, sid) : this.stats(classId, sid);
      const titles = this._awardTitles(classId, sid, {
        early: t.kind === 'early',
        cleaner: st.c3 >= 3,
        bulldozer: kind !== 'print' && st.c5 === 0 && st.marked >= 8
      });
      const killed = this.checkBossKill(classId);
      this.save();
      return Object.assign({}, rw, {
        sub, titles, killed, carried, already,
        coins: already ? 0 : rw.coins, photoId: sub.photoId, photoError: !put.ok
      });
    }

    /** 제출 후 1시간 안 · 선생님 도장 전이면 사진만 교체 (보상은 그대로) */
    reuploadPhoto(classId, sid, dataUrl, kind) {
      return this._reuploadPhoto(classId, sid, dataUrl, kind);
    }
    async _reuploadPhoto(classId, sid, dataUrl, kind) {
      const info = this.reuploadInfo(classId, sid, kind);
      if (!info.ok) return { error: info.stamped ? '선생님이 이미 도장을 찍었어요. 선생님께 말씀드려 주세요' : '사진을 바꿀 수 있는 1시간이 지났어요' };
      const sub = this.submission(classId, sid, null, kind);
      if (!sub) return { error: '먼저 제출해 주세요' };
      const pid = 'ph_' + Date.now().toString(36) + Math.floor(Math.random() * 99);
      const put = await this._savePhoto(pid, dataUrl, sid, kind);
      const old = sub.photoId;
      if (put.ok) {
        sub.photoId = pid;
        sub.photoAt = nowHHMM();
        sub.photoSubmitted = true;
      }
      sub.status = 'submitted';
      sub.at = nowHHMM();
      sub.ts = Date.now();
      sub.reup = (sub.reup || 0) + 1;
      if (put.ok && old && old !== pid) await this.deletePhoto(old);
      this.save();
      return { ok: put.ok, sub, mins: 60, photoError: !put.ok };
    }
    /** ② 화면 '고친 내용 저장' — 도장이 찍힌 제출은 절대 건드리지 않습니다 (도장 보호) */
    touchSubmission(classId, sid, kind) {
      const k = SK(classId, this.state.today, sid, kind);
      const sub = this.state.submissions[k];
      if (!sub) return false;
      if (sub.stampAt || sub.status === 'stamped') return false;   // ⛔ 도장 보호
      sub.at = nowHHMM();
      if (sub.status === 'resubmit') sub.status = 'submitted';
      // 사진 없이 '고친 내용 저장'만 해도 그날 받은 XP를 확정 (날짜가 바뀌어도 사라지지 않게)
      const s = this.student(classId, sid);
      if (s && sub.rewarded) {
        const rw = this.previewReward(classId, sid, kind);
        const prev = Number(sub.xp || 0);
        if (rw.xp > prev) {
          s.xp = (s.xp || 0) + (rw.xp - prev);
          sub.xp = rw.xp;
          sub.xpBanked = true;
        }
      }
      this.save();
      return true;
    }
    putPhoto(id, dataUrl, owner) {
      return this._savePhoto(id, dataUrl, owner, 'demo');
    }

    /* ---------- 사진 저장소 (IndexedDB · 7일 자동 삭제) ---------- */
    /** 사진 1장 저장 — IndexedDB 우선, 안 되는 브라우저만 localStorage로 폴백 */
    async _savePhoto(id, dataUrl, owner, kind) {
      const rec = { id, data: dataUrl, owner: owner || '', at: nowHHMM(), date: this.state.today, kind: kind || 'hw' };
      if (window.EMA.photos && !EMA.photos.failed) {
        const ok = await EMA.photos.put(id, rec);
        if (ok) return { ok: true, id };
        console.warn('사진 저장 실패(IndexedDB) — localStorage로 대신 저장합니다');
      }
      this.state.photos = this.state.photos || {};
      this.state.photos[id] = rec;
      const saved = this.save();
      return { ok: saved, id, fallback: true };
    }
    photo(id) {
      if (!id) return null;
      if (window.EMA.photos) { const r = EMA.photos.get(id); if (r) return r; }
      return (this.state.photos || {})[id] || null;
    }
    /** 사진이 이미 지워졌는지(7일 경과·선생님 삭제) */
    photoGone(id) { return !!id && !this.photo(id); }
    /** 선생님이 확인한 뒤 직접 삭제 — 제출 기록은 남습니다 */
    async deletePhoto(id) {
      if (!id) return false;
      if (window.EMA.photos) await EMA.photos.del(id);
      if (this.state.photos && this.state.photos[id]) { delete this.state.photos[id]; this.save(); }
      return true;
    }
    /** 7일 지난 사진 자동 삭제 — 제출 시각·채점·사진 제출 여부는 영구 유지 */
    async purgePhotos() {
      if (!window.EMA.photos) return [];
      let gone = [];
      try { gone = await EMA.photos.purge(EMA.photos.KEEP_DAYS || 7); } catch (e) { gone = []; }
      if (gone.length) console.info('7일 지난 사진 자동 삭제:', gone.length, '장');
      return gone;
    }

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
      return this._submitYesterday(classId, sid, dataUrl, solved);
    }
    async _submitYesterday(classId, sid, dataUrl, solved) {
      const y = shiftISO(this.state.today, -1);
      const pid = 'ph_y_' + Date.now().toString(36);
      const put = await this._savePhoto(pid, dataUrl, sid, 'yesterday');
      this.state.lateUploads[K(classId, y, sid)] = {
        at: nowHHMM(), photoId: put.ok ? pid : null, photoSubmitted: true,
        solved: Math.max(FLAME_MIN, solved || FLAME_MIN)
      };
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
      const pets = (s.pets || []);
      if (item.kind === 'snack' && !s.egg && !pets.length) return { error: '먼저 펫 알을 사 주세요 🥚' };
      if (item.kind === 'egg' && s.egg) return { error: '이미 펫 알을 키우는 중이에요' };
      s.coins -= item.price;
      const out = { item, coins: s.coins };
      if (item.kind === 'egg') {
        s.egg = { pct: 20, gotAt: this.state.today };
        out.egg = s.egg;
        out.msg = '펫 알을 받았어요! 간식으로 키우면 부화해요 🥚';
      } else if (item.kind === 'snack') {
        if (s.egg) {
          const add = item.pct || 25;
          s.egg.pct = Math.min(100, (s.egg.pct || 0) + add);
          out.egg = s.egg;
          if (s.egg.pct >= 100) {
            out.hatch = this._hatch(classId, sid);
            out.msg = out.hatch.pet.rarity === 'legend'
              ? `전설! ${out.hatch.pet.name} 나왔어요! 🎉`
              : `${out.hatch.pet.name} 나왔어요! 도감에 담았어요 🎉`;
          } else {
            out.msg = `냠냠! 알 부화 ${s.egg.pct}%`;
          }
        } else {
          // 알이 없으면 가장 최근 동료를 성장시킨다 (동료 진화)
          const last = pets[pets.length - 1];
          const before = last.lv || 1;
          last.lv = Math.min(3, before + 1);
          out.pet = last;
          out.bag = s.bag;
          out.msg = last.lv === before
            ? `${last.name}는 이미 최고로 자랐어요!`
            : `${last.name}가 자랐어요! ⭐${last.lv} · 공격력 +1`;
        }
      } else if (item.kind === 'shield') {
        s.bag = s.bag || {}; s.bag.shield = (s.bag.shield || 0) + 1;
        out.bag = s.bag; out.msg = '불꽃 방어권 1장을 샀어요 🛡️';
      } else if (item.kind === 'bomb' || item.kind === 'potion') {
        const dmg = item.dmg || 15;
        s.bag = s.bag || {}; s.bag[item.kind] = (s.bag[item.kind] || 0) + 1;
        const bk = classId + '|' + this.weekIndex();
        this.state.bossBoosts[bk] = (this.state.bossBoosts[bk] || 0) + dmg;
        s.bombGiven = (s.bombGiven || 0) + dmg;
        out.bag = s.bag;
        out.msg = item.kind === 'potion'
          ? `펫들이 힘을 냈어요! 보스 HP -${dmg}% ⚡`
          : `보스에게 폭탄을 던졌어요! HP -${dmg}% 💣`;
        out.killed = this.checkBossKill(classId);
      } else if (item.kind === 'coupon') {
        const claim = { id: 'cl_' + Date.now().toString(36), cid: classId, sid, itemId, name: item.name, em: item.em, tag: item.tag || '', at: this.state.today, used: false };
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
      const rLegend = (rarityMeta.legend || { rate: 3 }).rate;
      const rRare = (rarityMeta.rare || { rate: 19 }).rate;
      if (roll < rLegend) rarity = 'legend';
      else if (roll < rLegend + rRare) rarity = 'rare';
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
      s.pets.push({ id: pick.id, name: pick.name, rarity: pick.rarity, em: pick.em, at: this.state.today, lv: 1, from: 'lightegg' });
      s.egg = null;
      const titles = this._awardTitles(classId, sid, { legendary: pick.rarity === 'legend' });
      this.save();
      return { pet: pick, titles };
    }
    feed(classId, sid) {
      const s = this.student(classId, sid);
      if (!s) return { error: '학생을 찾지 못했어요' };
      if (!s.egg && !(s.pets || []).length) return { error: '먼저 펫 알을 사 주세요 🥚' };
      if ((s.coins || 0) < 20) return { error: '코인이 20개 필요해요 (간식 1개)' };
      return this.buy(classId, sid, 'snack');
    }

    /** 특정 동료를 간식으로 성장 (알을 키우는 중이 아닐 때) */
    growCompanion(classId, sid, petId) {
      const s = this.student(classId, sid);
      if (!s) return { error: '학생을 찾지 못했어요' };
      if (s.egg) return { error: '지금은 펫 알을 키우는 중이에요. 부화한 뒤에 펫을 키울 수 있어요' };
      const pets = s.pets || [];
      const p = pets.find(x => x.id === petId) || pets[pets.length - 1];
      if (!p) return { error: '아직 펫이 없어요' };
      if ((s.coins || 0) < 20) return { error: '코인이 20개 필요해요 (간식 1개)' };
      if ((p.lv || 1) >= 3) return { error: p.name + '는 이미 최고로 자랐어요 ⭐⭐⭐' };
      s.coins -= 20;
      p.lv = (p.lv || 1) + 1;
      this.save();
      return { ok: true, pet: p, msg: `${p.name} ⭐${p.lv}로 성장! 공격력 +1` };
    }

    /* ---------- 개별 오답프린트 ---------- */
    setPrint(classId, sid, count) {
      const n = Math.max(0, Math.min(60, parseInt(count, 10) || 0));
      if (!n) {
        delete this.state.prints[K(classId, this.state.today, sid)];
        // 어제에서 넘어온 미제출 프린트도 같이 없앱니다
        Object.keys(this.state.prints || {}).forEach(k => {
          const p = String(k).split('|');
          if (p[0] === classId && p[2] === sid && p[1] < this.state.today && !this.printSubmittedSince(classId, sid, p[1])) {
            this.state.prints[k].cleared = true;
          }
        });
        this.save(); return null;
      }
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

    /* ---------- 밀린 오답 해결 → 알 정화 ---------- */
    /** ⭕ 맞았어요 → 해결. ⏭️ 안 푼 문제는 보상·통계를 분리하고, 하루 정식 보상은 5개까지 */
    resolveCarried(classId, sid, id, whyTag) {
      const list = (this.state.carried || {})[sid] || [];
      const i = list.findIndex(x => x.id === id);
      if (i < 0) return null;
      const item = list.splice(i, 1)[0];
      item.solvedAt = this.state.today;
      if (whyTag) item.why = whyTag;
      const isSkip = (item.reason || 'x') === 'skip';
      if (isSkip) item.skip = true;
      (this.state.solvedCarried[sid] = this.state.solvedCarried[sid] || []).push(item);
      // 몬스터 도감에 포획 기록
      (this.state.monsters[sid] = this.state.monsters[sid] || []).push({
        id: 'm_' + id, book: item.book, page: item.page, num: item.num, label: item.label,
        date: this.state.today, captured: true, fromCarry: true, skip: isSkip, origin: item.date
      });
      // 하루 인정 개수 — 정식 보상(코인·XP·펫 알)은 5개까지
      this.state.carryResolve = this.state.carryResolve || {};
      const dk = this.state.today + '|' + sid;
      const n = (this.state.carryResolve[dk] || 0) + 1;
      this.state.carryResolve[dk] = n;
      let coins = 0, xp = 0, join = null;
      const s = this.student(classId, sid);
      if (s) {
        if (isSkip) coins = 1;                       // ⏭️ 안 푼 문제: 코인 1개만 (펫 알·XP 없음)
        else if (n <= 5) { coins = 3; xp = 8; }
        else coins = 1;                              // 6개째부터는 소액
        s.coins = (s.coins || 0) + coins;
        if (xp) s.bonusXp = (s.bonusXp || 0) + xp;
        if (!isSkip && n <= 5) join = this.purifyEgg(classId, sid, 'carry|' + id);
      }
      const killed = this.checkBossKill(classId);
      this.save();
      return { item, coins, xp, killed, join, skip: isSkip, count: n, capped: !isSkip && n > 5 };
    }
    /** ❌ 틀렸어요 — 이유를 골라 두고 목록에는 그대로 남깁니다(다시 도전) */
    retryCarried(classId, sid, id, tag) {
      const list = (this.state.carried || {})[sid] || [];
      const item = list.find(x => x.id === id);
      if (!item) return null;
      item.why = tag || 'x';
      item.tries = (item.tries || 0) + 1;
      item.lastTry = this.state.today;
      this.save();
      return item;
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
      // 날짜별 진도 기록 — 어머님 리포트의 '일자별 진도·숙제'에 쓰입니다
      const date = l.date || this.state.today;
      if (!this.state.dayLessons) this.state.dayLessons = {};
      const dl = this.state.dayLessons[classId] || (this.state.dayLessons[classId] = {});
      dl[date] = Object.assign({}, dl[date], {
        date, lesson: l.lesson || '', homework: l.homework || '', books: l.books || []
      });
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
    return new LocalStore(EMA.buildSeed, { demo: !!cfg.demo });
  };
  EMA.SCHEMA = SCHEMA;
  EMA.STATE_KEY = KEY;
  EMA.STATE_KEY_DEMO = DEMO_KEY;
  EMA.FLAME_MIN = FLAME_MIN;
  EMA.CAP_XP = CAP_XP;
  EMA.tileKey = tileKey;
})();
