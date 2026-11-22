/* 저장소 v1.1 — 로컬(브라우저) 모드와 시트 API 모드를 같은 인터페이스로 씁니다.

   ★ v1.1 4단계에서 더한 것 ★
     ① 쪽수표 자동 갱신 — window.EMA_PAGE_MAPS.version 이 다르면 학생 기록은 그대로 두고 pageMaps만 교체
        (예전엔 st.pageMaps = st.pageMaps || … 라서 옛 55쪽 예시 표가 영원히 남았습니다)
     ② 숙제 범위 모드 [전체 / 유제만(-1) / 홀수 / 짓수] — 선생님 화면·시트 파서 모두 `19~22 (유제만)` 표기 지원
     ③ 🔥 오늘의 열정 학생 — 숙제 완료·밀린문제 3개 해결 시 선생님께 알림
     ④ ✅ 책으로 완료 (밀린문제 제외) — 앱 오류 때 선생님이 한 번에 완료 처리
     ⑤ 어머님 리포트 규칙 — 이번 주 최근 2회 · 이번 달 1줄 요약 · 이번 학기 목록 제외 · 오답 비율(%)

   ★ v1.0 3단계에서 더한 것 ★
     ① 하루 3문제 미션(+10) · 연속 🔥 · 주간 목표(주 5일, +30) · 복귀 보상(+15)
     ② 펫 경험치 → 3단계 성장(아기 → 성장 → 완성 + 칭호)
     ③ 수업에서 푼 문제(대표문제·시작번호)를 '제외'로 표시 — 밀린문제·오답 통계에 안 섞임
     ④ 맞은 문제도 ⭐ 질문 · 선생님 전용 질문/오답 TOP 5 · 학생별 못 고친 오답
   ★ v0.9 2단계에서 더한 것 ★
     ① 숙제 제출 기한(lesson.dueAt) — 기한 전은 '📘 진행 중', 기한이 지나야 미푼 문제만 '⚔️ 밀린문제'로
     ② 오답 3단 구분(전체 틀린 문제 / 아직 고치지 않은 / 다시 풀어 고친) + 선생님 반 대시보드
     ③ 학생 반 이동(기록 유지) · 퇴원(보관) · 숙제/프린트 설정 복사
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
  const KEY = 'ema.state.v5';           // 저장 칸 이름은 v0.8 그대로 — 기록을 옮기지 않아도 됩니다
  const DEMO_KEY = 'ema.state.demo.v5';       // 연습(?mode=demo)은 실제 운영 데이터와 다른 칸에 쌓입니다
  const LEGACY_KEYS = ['ema.state.v4', 'ema.state.v3'];
  const SCHEMA = 9;                     // 구조 버전 9 — v1.2: 유령 타일(쪽수표에 없는 쪽) 정리 · 내 공부방(1인 반) 추가
  const PAGE_MAPS_BACKUP = '.pageMaps.old';   // 쪽수표를 갈아 끼우기 전 옛 표를 백업해 두는 칸
  const SESSION = 'ema.session.v2';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  /** 숙제 범위 모드 — '' (전체) · 'yooh' (유제만/-1) · 'odd' (홀수) · 'even' (짝수) */
  const HW_MODES = ['', 'yooh', 'odd', 'even'];
  const HW_MODE_LABEL = { '': '전체', yooh: '유제만', odd: '홀수', even: '짝수' };
  const HW_MODE_SUFFIX = { '': '', yooh: ' (유제만)', odd: ' (홀수만)', even: ' (짝수만)' };
  /** 글 안에 적힌 모드 표기 — `(유제만)`, `[홀수]`, `(유제만 -1)`, `유제만` */
  function modeOfText(text) {
    const t = String(text || '');
    const paren = t.match(/[(\[]([^)\]]*)[)\]]/g) || [];
    for (let i = 0; i < paren.length; i++) {
      const inner = paren[i];
      if (/유제/.test(inner) || /-\s*1/.test(inner)) return 'yooh';
      if (/홀수/.test(inner)) return 'odd';
      if (/짝수/.test(inner)) return 'even';
    }
    if (/유제만/.test(t)) return 'yooh';
    if (/홀수만?/.test(t)) return 'odd';
    if (/짝수만?/.test(t)) return 'even';
    return '';
  }
  /** 쪽수 입력 파서 — '8~10쪽', '8 ∼ 10', '8,9,10', '8-10쪽' 모두 받습니다
      ★ v1.0: 전각 쉼표(，、；)도 보통 쉼표로 바꿔 '2，4，5，6'을 개별 숫자로 읽습니다
      ★ v1.1: 괄호 안 모드 표기 `(유제만)`·`(홀수만)`·`(유제만 -1)`은 쪽수로 읽지 않습니다 */
  function parsePages(raw) {
    const out = [];
    const push = n => { const v = parseInt(n, 10); if (v > 0 && v < 1000 && out.indexOf(v) < 0) out.push(v); };
    /* ★ 교재명에 들어 있는 숫자('6-1 발전책')가 쪽수로 읽히지 않게 교재명을 먼저 지웁니다 */
    const stripBooks = t => {
      let s = String(t || '').replace(/[(\[][^)\]]*[)\]]/g, ' ');   // 괄호 안은 모드 표기
      try {
        const books = Object.keys((window.EMA_PAGE_MAPS || {}).교재 || {});
        books.forEach(b => { s = s.split(b).join(' '); });
      } catch (e) { }
      return s.replace(/발전책|발전진도북|응용심화 ?셀프북|응용심화책|셀프북|진도북/g, ' ');
    };
    const txt = stripBooks(raw)
      .replace(/[，、；;]/g, ',')
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

  /** 문제번호 파서 — '2,4,5,6' · '2，4' · '1~14번, 15~28번' · '1-1' 모두 개별 번호로
      ★ v1.0: 공백 없는 쉼표·전각 쉼표·'번'이 섞여도 한 칸에 몰리지 않습니다 */
  function parseProblemNos(raw) {
    const out = [];
    const push = v => { const s = String(v).trim(); if (s && out.indexOf(s) < 0) out.push(s); };
    String(raw == null ? '' : raw)
      .replace(/[，、；;]/g, ',')
      .replace(/번/g, ' ')
      .split(/[,\s]+/).filter(Boolean).forEach(part => {
        const m = part.match(/^(\d+)\s*[~∼〜]\s*(\d+)$/);
        if (m) {
          const a = +m[1], b = +m[2];
          for (let i = Math.min(a, b); i <= Math.max(a, b); i++) push(String(i));
        } else if (/^\d+(-\d+)*$/.test(part)) push(part);
      });
    return out;
  }

  /** '6-1 발전책 19~22쪽 (유제만)' → { pages:[19,20,21,22], mode:'yooh' } */
  function parsePagesMode(raw) {
    return { pages: parsePages(raw), mode: modeOfText(raw) };
  }
  /** 숙제 타일에서 모드를 적용 — 대표번호(1,2,3…)를 뺀 '유제만', 홀수·짝수 번호만 */
  function modeFilter(t, mode) {
    if (!mode || HW_MODES.indexOf(mode) < 0) return true;
    if (!t || t.missing) return true;            // 표에 없는 쪽(?)은 숨기지 않고 그대로 알립니다
    const num = String(t.num == null ? t.label : t.num).trim();
    if (mode === 'yooh') return !/^\d+$/.test(num);   // 1-1·2-0·확인1 … (대표번호만 제외)
    const m = num.match(/\d+/);
    if (!m) return false;
    const n = parseInt(m[0], 10);
    return mode === 'odd' ? n % 2 === 1 : n % 2 === 0;
  }

  EMA.util = { todayISO, nowHHMM, DOW, pad, shiftISO, parsePages, parseProblemNos, parsePagesMode, modeOfText, modeFilter, HW_MODES, HW_MODE_LABEL, HW_MODE_SUFFIX };

  const CAP_XP = 200;       // 일일 XP 상한 (몰아치기 방지)
  const FLAME_MIN = 3;      // 불꽃 인정 최소 문제 수
  /* v1.0 3단계 — 미션·주간 목표·복귀 보상·펫 성장 */
  const MISSION = { need: 3, coins: 10, weekNeed: 5, weekCoins: 30, comeback: 15, comebackDays: 2 };
  const PET_XP = { need2: 12, need3: 30, dayCap: 15 };   // 펫 경험치: 12 → 2단계, 30 → 3단계(완성) · 하루 15까지
  const PET_STAGES = [
    null,
    { stage: 1, name: '아기', em: '🐣' },
    { stage: 2, name: '성장', em: '🌱' },
    { stage: 3, name: '완성', em: '👑' }
  ];
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
  /** '2026-11-25 16:00' → Date (시간이 없으면 그날 23:59까지) */
  function parseDueAt(v) {
    const m = String(v || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], m[4] == null ? 23 : +m[4], m[5] == null ? 59 : +m[5], 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  /** 남은/지난 시간을 사람 말로 — '2일', '3시간', '25분' */
  function spanText(ms) {
    const min = Math.max(0, Math.abs(ms)) / 60000;
    if (min >= 1440) return Math.floor(min / 1440) + '일';
    if (min >= 60) return Math.floor(min / 60) + '시간';
    return Math.max(1, Math.floor(min)) + '분';
  }
  /** '2026-11-25 16:00' → '11월 25일(화) 16:00' */
  function dueLabelOf(v) {
    const d = parseDueAt(v);
    if (!d) return '';
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + DOW[d.getDay()] + ') ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  EMA.util.parseDueAt = parseDueAt;
  EMA.util.dueLabelOf = dueLabelOf;
  EMA.util.spanText = spanText;

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
    /** 교재 + 쪽수 → 문제 타일 목록 (키에 교재 포함 · 단원명까지 붙임)
        mode: '' | 'yooh' | 'odd' | 'even' — 선생님이 고른 숙제 범위 모드 */
    tilesOf(bookName, pages, mode) {
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
        // ★ v1.2: 쪽수표에 아예 없는 쪽은 타일을 만들지 않습니다(예전엔 '?'·num null 타일이 생겨 '58null'로 보였어요).
        //        선생님 모드 상단 알림(⚠️ 쪽수표에 없는 N쪽)에서 번호를 넣으면 그때 타일이 생깁니다.
        if (!info) return;
        // ★ v1.0: 문제가 없는 개념 설명 쪽(예: 응용심화 58·59쪽)은 '58쪽 ?번' 타일을 만들지 않습니다
        const nums = (info.문제 || []).filter(n => String(n == null ? '' : n).trim() !== '');
        if (!nums.length) return;
        nums.forEach((num, i) => out.push({
          key: tileKey(bookName, p, i), label: num, page: p, num, book: bookName, type: info.유형, unitName: unitOf(p)
        }));
      });
      return mode ? out.filter(t => modeFilter(t, mode)) : out;
    }
    /** 문제가 하나도 없는 쪽(개념 설명만 있는 쪽) — 숙제 범위에 들어와도 자동으로 빠집니다 */
    conceptPages(bookName) {
      return this.pagesOfBook(bookName).filter(p => !(p.problems || []).length).map(p => p.page);
    }
    /** 쪽수표에 아예 없는 쪽 — 선생님 모드 '⚠️ 쪽수표에 없는 N쪽' 알림용 */
    missingPages(classId) {
      const out = [];
      this.books(classId).forEach(b => {
        (b.pages || []).forEach(p => {
          if (!this.pageInfo(b.book, p)) out.push({ book: b.book, page: p });
        });
      });
      return out;
    }
    /** 쪽이 속한 단원 번호·이름 — 오늘의 학습맵이 실제 숙제 타일만 보고 단원을 그릴 때 씁니다 */
    unitInfoOf(bookName, page) {
      const b = this.book(bookName);
      if (!b) return null;
      const p = parseInt(page, 10);
      for (const u of Object.keys(b.단원 || {})) {
        const unit = b.단원[u] || {};
        if ((unit.쪽 || {})[String(p)]) return { no: u, 이름: unit.이름 || (u + '단원') };
      }
      return null;
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

    /** 오늘 숙제의 교재 목록 — 진도북+셀프북 2권 동시 지원 (mode: 전체/유제만/홀수/짝수) */
    books(classId) {
      const l = this.lesson(classId);
      if (!l) return [];
      const norm = b => Object.assign({}, b, { mode: HW_MODES.indexOf(b.mode) > 0 ? b.mode : '' });
      if (l.books && l.books.length) return l.books.map(norm);
      if (l.book) return [norm({ book: l.book, pages: l.pages || [] })];
      return [];
    }
    /* ---------- 반·학생 (v0.9: 퇴원 보관 · 반 이동) ---------- */
    /** 재원 학생만 — 숙제·보스·랭킹·대시보드는 퇴원생을 빼고 셉니다 */
    activeStudents(classId) {
      const c = this.getClass(classId);
      return c ? c.students.filter(s => s.status !== 'left') : [];
    }
    leftStudents(classId) {
      const c = this.getClass(classId);
      return c ? c.students.filter(s => s.status === 'left') : [];
    }
    /** 숙제 채점·제출이 묶이는 날짜 — 숙제가 나간 날(lesson.date). 기한 전에는 날이 바뀌어도 같은 숙제로 이어집니다 */
    hwDate(classId) {
      const l = this.lesson(classId);
      return (l && l.date) || this.state.today;
    }
    /** 반 수업 시작 시각 '18:00' (없으면 16:00) */
    classStart(cls) {
      const m = String((cls && cls.time) || '').match(/(\d{1,2}):(\d{2})/);
      return m ? pad(+m[1]) + ':' + m[2] : '16:00';
    }
    /** fromISO 다음 수업일 (반 요일 기준) */
    nextClassDate(classId, fromISO) {
      const c = this.getClass(classId);
      const from = fromISO || this.state.today;
      const dowMap = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
      const ds = [];
      String((c && c.days) || '').split(/[^가-힣]+/).forEach(tok => String(tok).split('').forEach(ch => { if (dowMap[ch] != null && ds.indexOf(dowMap[ch]) < 0) ds.push(dowMap[ch]); }));
      if (!ds.length) return shiftISO(from, 1);
      for (let i = 1; i <= 14; i++) {
        const d = shiftISO(from, i);
        if (ds.indexOf(new Date(d + 'T12:00:00').getDay()) >= 0) return d;
      }
      return shiftISO(from, 1);
    }
    /** 기본 마감 = 다음 수업일 그 반 수업 시작 시각 */
    defaultDueAt(classId) {
      const l = this.lesson(classId);
      const base = (l && l.date) || this.state.today;
      return this.nextClassDate(classId, base) + ' ' + this.classStart(this.getClass(classId));
    }
    /** 이 숙제의 마감 시각 — 선생님이 넣은 dueAt → 시트 dueDate → 기본값 */
    dueAtOf(classId) {
      const l = this.lesson(classId);
      if (!l) return '';
      if (l.noDue) return '';
      if (l.dueAt) return l.dueAt;
      if (l.dueDate) return /^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}$/.test(l.dueDate) ? l.dueDate : l.dueDate + ' ' + this.classStart(this.getClass(classId));
      return this.defaultDueAt(classId);
    }
    /** 숙제 기한 상태 — open(진행 중) / late(기한 지남) / closed(선생님 마감) / none */
    dueInfo(classId, nowMs) {
      const l = this.lesson(classId);
      if (!l) return { has: false, state: 'none', dueAt: '', label: '', leftText: '', lateText: '', ms: 0, passed: false };
      const dueAt = this.dueAtOf(classId);
      const dt = parseDueAt(dueAt);
      const now = nowMs == null ? Date.now() : nowMs;
      const closed = !!l.dueClosed;
      const passed = closed || (dt ? now > dt.getTime() : false);
      const ms = dt ? dt.getTime() - now : 0;
      return {
        has: true, dueAt, label: dueLabelOf(dueAt) || '기한 없음', closed, passed, ms,
        state: closed ? 'closed' : passed ? 'late' : 'open',
        leftText: !passed && dt ? '제출 기한까지 ' + spanText(ms) + ' 남았어요' : (!passed && !dt ? '기한 없이 진행 중이에요' : ''),
        lateText: passed ? (closed ? '선생님이 오늘 숙제를 마감했어요' : '제출 기한이 ' + spanText(ms) + ' 지났어요') : ''
      };
    }
    /** 학생 1명의 오늘 숙제 진행 상황 (기한 전 '진행 중' 표시용) */
    progressInfo(classId, sid) {
      const st = this.stats(classId, sid);
      const ps = this.printStats(classId, sid);
      const sub = this.submission(classId, sid);
      const due = this.dueInfo(classId);
      const marked = st.marked + ps.marked;
      const total = st.total + ps.total;
      return {
        due, marked, total, pct: total ? Math.round(marked / total * 100) : 0,
        hwMarked: st.marked, hwTotal: st.total, printMarked: ps.marked, printTotal: ps.total,
        sub, stamped: !!(sub && (sub.stampAt || sub.status === 'stamped')),
        state: !st.total && !ps.total ? 'none' : sub && sub.stampAt ? 'stamped' : sub ? 'submitted' : due.passed ? 'late' : 'open',
        line: due.has ? due.label + '까지' : ''
      };
    }
    /** 선생님이 마감일·시간을 바꿉니다 */
    setDue(classId, dueAt) {
      const l = this.state.lessons[classId] || (this.state.lessons[classId] = {});
      if (dueAt) { l.dueAt = String(dueAt).trim(); l.dueDate = l.dueAt.slice(0, 10); delete l.noDue; }
      else { delete l.dueAt; delete l.dueDate; l.noDue = true; }
      delete l.dueClosed;
      delete l.carriedFor;
      this.save();
      return this.dueInfo(classId);
    }
    /** 지금 바로 마감 — 기한 전이라도 미푼 문제를 밀린문제로 넘깁니다 */
    closeDue(classId) {
      const l = this.state.lessons[classId];
      if (!l) return 0;
      l.dueClosed = true;
      const r = this.sweepDueOne(classId);
      this.save();
      return r;
    }

    /** 숙제 타일 (bookName 생략 시 모든 교재) */
    tiles(classId, bookName) {
      const bs = this.books(classId);
      /* ★ v2.0 — 선생님이 '🏫 수업 때 같이 푼 문제'로 빼 둔 문제는 반 전체에서 빠집니다
         (채점 화면·안 누른 문제·밀린문제·학습맵 모두 tiles()를 거칩니다) */
      const skip = this.classExclKeys(classId);
      const keep = t => !skip[t.key];
      if (bookName) {
        const one = bs.find(b => b.book === bookName);
        return one ? this.tilesOf(one.book, one.pages, one.mode).filter(keep) : [];
      }
      const out = [];
      bs.forEach(b => { this.tilesOf(b.book, b.pages, b.mode).forEach(t => { if (keep(t)) out.push(t); }); });
      return out;
    }

    /* ---------- 🏫 수업 때 같이 푼 문제 — 반 전체 제외 (v2.0) ---------- */
    /** 이번 숙제(lesson.date)에 묶인 반 전체 제외 목록 — 새 숙제가 나가면 자동으로 비어 있습니다 */
    classExclInfo(classId) {
      const l = (this.state.lessons || {})[classId];
      const date = (l && l.date) || this.state.today;
      const box = l && l.classExcl;
      if (!box || box.date !== date) return { date, keys: {} };
      return { date, keys: box.keys || {} };
    }
    classExclKeys(classId) { return this.classExclInfo(classId).keys; }
    classExclCount(classId) {
      const k = this.classExclKeys(classId);
      return Object.keys(k).filter(x => k[x]).length;
    }
    /** 한 문제 빼기/되돌리기 — on=false면 그 문제가 다시 학생 화면에 나옵니다 */
    setClassExcl(classId, key, on) {
      if (!key) return this.classExclCount(classId);
      const l = this.state.lessons[classId] || (this.state.lessons[classId] = {});
      const date = l.date || this.state.today;
      if (!l.classExcl || l.classExcl.date !== date) l.classExcl = { date, keys: {} };
      if (on) l.classExcl.keys[key] = true;
      else {
        delete l.classExcl.keys[key];
        this._dropClassCarry(classId, key);        // 이미 넘어간 밀린문제도 같이 뺍니다
      }
      this.save();
      return this.classExclCount(classId);
    }
    clearClassExcl(classId) {
      const l = this.state.lessons[classId];
      if (!l || !l.classExcl) return 0;
      Object.keys(l.classExcl.keys || {}).forEach(k => this._dropClassCarry(classId, k));
      l.classExcl = { date: l.date || this.state.today, keys: {} };
      this.save();
      return 0;
    }
    /** 제외한 문제를 이미 밀린문제로 넘겨 둔 학생이 있으면 목록에서 뺍니다 */
    _dropClassCarry(classId, key) {
      const date = this.hwDate(classId);
      const all = this.state.carried || {};
      let changed = false;
      Object.keys(all).forEach(sid => {
        const before = all[sid] || [];
        const after = before.filter(m => !(m.origin && m.origin.key === key && m.origin.date === date));
        if (after.length !== before.length) { all[sid] = after; changed = true; }
      });
      return changed;
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
      // 아직 아무것도 안 눌렀으면 문제가 있는 쪽 중에서 (개념 설명만 있는 쪽은 빼고)
      const seen = {};
      const all = [];
      this.tiles(classId).forEach(t => {
        const k = t.book + '|' + t.page;
        if (seen[k] || t.missing) return;
        seen[k] = true;
        all.push({ book: t.book, page: t.page });
      });
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
    /** 채점 행 날짜 — 숙제는 '숙제 나간 날'(hwDate), 프린트는 오늘 */
    grade(classId, sid, date) {
      const d = date || this.hwDate(classId);
      const g = this.state.grades[K(classId, d, sid)];
      if (!g) return { marks: {}, cleanup: {}, tags: {}, excl: {}, updatedAt: null };
      if (!g.marks) g.marks = {};
      if (!g.cleanup) g.cleanup = {};
      if (!g.tags) g.tags = {};
      if (!g.excl) g.excl = {};
      return g;
    }
    gradeOf(classId, sid, kind) {
      const k = SK(classId, kind === 'print' ? this.state.today : this.hwDate(classId), sid, kind);
      const g = this.state.grades[k];
      if (!g) return { marks: {}, cleanup: {}, tags: {}, excl: {}, updatedAt: null };
      if (!g.marks) g.marks = {};
      if (!g.cleanup) g.cleanup = {};
      if (!g.tags) g.tags = {};
      if (!g.excl) g.excl = {};
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

    /** 타일 묶음의 다섯 상태 집계 (+ 수업에서 품·안 낸 문제 c6) */
    _count(tiles, g) {
      let c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0, c6 = 0, starO = 0;
      const excl = (g && g.excl) || {};
      tiles.forEach(t => {
        const m = g.marks[t.key];
        if (!m && excl[t.key]) { c6++; return; }          // 🏫 수업에서 푼 문제 · 안 낸 문제 — 채점·밀린문제·미션에서 빼요
        if (m === 'o') { c1++; if (g.cleanup[t.key] === 'star') starO++; return; }
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
        c1, c2, c3, c4, c5, c6, starO,
        correct: c1, wrongLeft: c2, fixed: c3, question: c4 + starO, carry: c5,
        marked: c1 + c2 + c3 + c4, total: c1 + c2 + c3 + c4 + c5, all: tiles.length
      };
    }
    counts(classId, sid, date) {
      const g = this.grade(classId, sid, date);
      return this._count(this.tiles(classId), g);
    }
    printCounts(classId, sid) {
      return this._count(this.printTiles(classId, sid), this.gradeOf(classId, sid, 'print'));
    }
    /** 오늘 숙제(또는 프린트)에서 '⭐ 질문'으로 고른 문제 수 — 최대 5개 */
    starCount(classId, sid, kind) {
      const g = this.gradeOf(classId, sid, kind);
      return Object.keys(g.cleanup || {}).filter(k => g.cleanup[k] === 'star').length;
    }
    /** 숙제 + 프린트 합친 오늘 푼 문제 수 */
    solvedToday(classId, sid) {
      return this.counts(classId, sid).marked + this.printCounts(classId, sid).marked;
    }

    /* =========================================================
       v1.0 3단계 — 하루 3문제 미션 · 주간 목표 · 복귀 보상
    ========================================================= */
    /** 이번 주 월요일 (주간 목표는 월~일 한 주 단위) */
    weekStart(iso) {
      const d = iso || this.state.today;
      const dow = new Date(d + 'T12:00:00').getDay();
      return shiftISO(d, -(dow === 0 ? 6 : dow - 1));
    }
    _daysBetween(a, b) {
      const ms = new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00');
      return Math.round(ms / 86400000);
    }
    /** 오늘 '해결'한 밀린문제 수 (⏭️ 안 푼 문제는 제외) */
    carrySolvedToday(sid) {
      return ((this.state.solvedCarried || {})[sid] || [])
        .filter(m => m && m.solvedAt === this.state.today && !m.skip).length;
    }
    /** 오늘 미션에 세는 문제 수 — 숙제·오답프린트 채점 + 밀린문제 해결 */
    missionCount(classId, sid) {
      return this.solvedToday(classId, sid) + this.carrySolvedToday(sid);
    }
    /** 오늘 미션 기록 (완료했을 때만 있음) */
    missionRecord(sid, date) {
      return (((this.state.missions || {})[sid] || {})[date || this.state.today]) || null;
    }
    /** 이번 주에 미션을 마친 날 수 */
    weekMissionDays(sid) {
      const from = this.weekStart(this.state.today);
      const rec = (this.state.missions || {})[sid] || {};
      return Object.keys(rec).filter(d => d >= from && d <= this.state.today).length;
    }
    /** 마지막으로 뭐라도 한 날 (오늘 이전) — 복귀 보상 판정 */
    lastActiveBefore(sid, date) {
      const today = date || this.state.today;
      let last = '';
      const A = (this.state.activity || {})[sid] || {};
      Object.keys(A).forEach(d => { if (d < today && Number(A[d] || 0) > 0 && d > last) last = d; });
      ((this.state.history || {})[sid] || []).forEach(r => {
        if (r && r.date && r.date < today && Number(r.solved || 0) > 0 && r.date > last) last = r.date;
      });
      ((this.state.solvedCarried || {})[sid] || []).forEach(m => {
        if (m && m.solvedAt && m.solvedAt < today && m.solvedAt > last) last = m.solvedAt;
      });
      Object.keys((this.state.missions || {})[sid] || {}).forEach(d => { if (d < today && d > last) last = d; });
      return last;
    }
    /** 미션·주간 목표·복귀 상태 (화면용) */
    missionInfo(classId, sid) {
      const today = this.state.today;
      const count = this.missionCount(classId, sid);
      const rec = this.missionRecord(sid, today);
      const ws = this.weekStart(today);
      const days = this.weekMissionDays(sid);
      const wk = (((this.state.weekBonus || {})[sid] || {})[ws]) || null;
      const last = this.lastActiveBefore(sid, today);
      const gap = last ? this._daysBetween(last, today) : 0;
      const comeback = !rec && gap >= MISSION.comebackDays;
      return {
        today, count, need: MISSION.need, left: Math.max(0, MISSION.need - count),
        done: count >= MISSION.need, rewarded: !!rec, scored: rec ? rec.coins : 0,
        coins: MISSION.coins,
        weekStart: ws, weekDays: days, weekNeed: MISSION.weekNeed, weekCoins: MISSION.weekCoins,
        weekDone: days >= MISSION.weekNeed, weekRewarded: !!wk,
        comeback, comebackDays: gap, comebackCoins: MISSION.comeback
      };
    }
    /** 3문제를 채우면 — 오늘 미션(+10) · 주간 목표(+30) · 복귀 보상(+15) 코인을 한 번만 넣습니다 */
    ensureMission(classId, sid) {
      const info = this.missionInfo(classId, sid);
      if (!info.done || info.rewarded) return null;
      const s = this.student(classId, sid);
      if (!s) return null;
      const rec = { coins: MISSION.coins, at: nowHHMM(), count: info.count };
      let coins = MISSION.coins;
      if (info.comeback) { rec.comeback = MISSION.comeback; coins += MISSION.comeback; }
      // 오늘 기록은 아직 안 들어가 있으니 '오늘까지'로 한 번 더 셉니다
      const daysNow = info.weekDays + (info.rewarded ? 0 : 1);
      if (daysNow >= MISSION.weekNeed && !info.weekRewarded) {
        rec.weekly = MISSION.weekCoins;
        coins += MISSION.weekCoins;
        this.state.weekBonus = this.state.weekBonus || {};
        const w = this.state.weekBonus[sid] = this.state.weekBonus[sid] || {};
        w[info.weekStart] = { at: this.state.today, coins: MISSION.weekCoins };
      }
      rec.coins = coins;
      this.state.missions = this.state.missions || {};
      const mine = this.state.missions[sid] = this.state.missions[sid] || {};
      mine[this.state.today] = rec;
      s.coins = (s.coins || 0) + coins;
      this.save();
      return {
        awarded: true, coins, mission: MISSION.coins,
        comeback: info.comeback ? MISSION.comeback : 0,
        weekly: rec.weekly || 0, count: info.count,
        weekDays: this.weekMissionDays(sid), weekNeed: MISSION.weekNeed
      };
    }

    /* ---------- 펫 경험치 · 3단계 성장 ---------- */
    petStageOf(p) {
      const xp = Number((p && p.xp) || 0);
      const xpStage = xp >= PET_XP.need3 ? 3 : xp >= PET_XP.need2 ? 2 : 1;
      return Math.max(Number((p && p.lv) || 1), xpStage);
    }
    /** 다음 단계까지 필요한 경험치 */
    petNextNeed(p) {
      const st = this.petStageOf(p);
      if (st >= 3) return { need: null, have: Number((p && p.xp) || 0), pct: 100 };
      const need = st === 1 ? PET_XP.need2 : PET_XP.need3;
      const have = Number((p && p.xp) || 0);
      const from = st === 1 ? 0 : PET_XP.need2;
      return { need: need - from, have: have - from, pct: Math.round(Math.max(0, Math.min(1, (have - from) / (need - from))) * 100) };
    }
    petStageLabel(p) { return PET_STAGES[this.petStageOf(p)] || PET_STAGES[1]; }
    /** 문제를 풀 때마다 보유 펫들이 경험치를 얻습니다 (하루 15까지 · 3단계엔 칭호) */
    addPetXp(classId, sid, n) {
      const s = this.student(classId, sid);
      if (!s) return 0;
      const pets = s.pets || [];
      if (!pets.length) return 0;
      const add0 = Number(n) || 0;
      if (add0 <= 0) return 0;
      this.state.petXp = this.state.petXp || {};
      const row = this.state.petXp[sid] = this.state.petXp[sid] || {};
      const today = this.state.today;
      const used = Number(row[today] || 0);
      const add = Math.max(0, Math.min(add0, PET_XP.dayCap - used));
      if (!add) return 0;
      row[today] = used + add;
      let up = [];
      pets.forEach(p => {
        const before = this.petStageOf(p);
        p.xp = Number(p.xp || 0) + add;
        const after = this.petStageOf(p);
        if (after > before) p.lv = after;
        if (after >= 3) {
          // 3단계(완성)가 되면 그 펫의 칭호가 열립니다 (이미 있으면 두 번 넣지 않음)
          s.titles = s.titles || [];
          const tid = 'pet_' + p.id;
          if (!s.titles.find(t => t.id === tid)) {
            const def = this.petDef(p.id) || {};
            s.titles.push({ id: tid, name: (def.name || p.name || '펫') + ' 대장', em: def.em || p.em || '🐾', at: today });
          }
        }
        if (after > before) up.push({ id: p.id, name: p.name, stage: after, title: (this.petDef(p.id) || {}).name || p.name });
      });
      this.save();
      return add;
    }

    /* ---------- 수업에서 푼 문제(제외) ---------- */
    /** reason: 'class'(수업에서 품) / 'filter'(홀·짝 보기) — 미채점 타일을 '제외'로 표시합니다. 채점한 문제는 그대로
        keys 는 ['키', …] 또는 [{key, reason}, …] 둘 다 받습니다 */
    setExcl(classId, sid, keys, kind, reason) {
      const g = this.gradeRow(classId, sid, kind);
      g.excl = g.excl || {};
      let n = 0;
      (keys || []).forEach(item => {
        const k = typeof item === 'string' ? item : String((item && item.key) || '');
        const why = typeof item === 'string' ? String(reason || '') : String((item && item.reason) || reason || '');
        if (!k) return;
        if (g.marks[k]) return;                       // 이미 채점한 문제는 건드리지 않습니다
        if (why) { if (g.excl[k] !== why) n++; g.excl[k] = why; }
        else if (g.excl[k]) { delete g.excl[k]; n++; }
      });
      g.updatedAt = nowHHMM();
      this.save();
      return n;
    }
    clearExcl(classId, sid, kind, onlyReason) {
      const g = this.gradeRow(classId, sid, kind);
      if (!g.excl) return 0;
      let n = 0;
      Object.keys(g.excl).forEach(k => {
        if (onlyReason && g.excl[k] !== onlyReason) return;
        delete g.excl[k]; n++;
      });
      if (n) this.save();
      return n;
    }
    exclOf(classId, sid, key, kind) {
      const g = this.gradeOf(classId, sid, kind);
      return (g.excl || {})[key] || '';
    }
    /** ✨ 나머지 전부 ⭕ — 아직 안 누른 칸만 ⭕로 (❌ 틀린 문제는 그대로)
        반환: { n, keys } — keys는 방금 채운 문제라 [↩️ 되돌리기]로 바로 되돌릴 수 있습니다 */
    fillRestCorrect(classId, sid, kind, bookName, keys) {
      const g = this.gradeRow(classId, sid, kind);
      const tiles = kind === 'print' ? this.printTiles(classId, sid) : this.tiles(classId, bookName || null);
      const set = keys && keys.length ? new Set(keys) : null;
      const filled = [];
      tiles.forEach(t => {
        if (t.missing) return;
        if (set && !set.has(t.key)) return;
        if (g.marks[t.key]) return;
        if ((g.excl || {})[t.key]) return;
        g.marks[t.key] = 'o';
        delete g.cleanup[t.key];
        filled.push(t.key);
      });
      if (filled.length) {
        this._touchActivity(classId, sid, filled.length);
        this.addPetXp(classId, sid, filled.length);
      }
      g.updatedAt = nowHHMM();
      this.save();
      return { n: filled.length, keys: filled };
    }
    /** [↩️ 방금 채운 거 되돌리기] — fillRestCorrect 가 채운 칸만 지웁니다 (직접 누른 ⭕/❌는 그대로) */
    undoFill(classId, sid, keys, kind) {
      const g = this.gradeRow(classId, sid, kind);
      let n = 0;
      (keys || []).forEach(k => {
        if (g.marks[k] === 'o') { delete g.marks[k]; delete g.tags[k]; n++; }
      });
      if (n) { g.updatedAt = nowHHMM(); this.save(); }
      return n;
    }

    /* ---------- 선생님 전용: 질문 · 많이 틀린 문제 · 못 고친 오답 ---------- */
    /** 문제 키('교재|쪽:순번') → 화면용 타일 — 오늘 숙제 범위 밖의 기록도 제대로 보여 줍니다 */
    tileOfKey(key) {
      const parts = String(key || '').split(':');
      const bp = parts[0] || '';
      const i = Number(parts[1] || 0) || 0;
      const cut = bp.indexOf('|');
      const book = cut >= 0 ? bp.slice(0, cut) : bp;
      const page = cut >= 0 ? bp.slice(cut + 1) : '';
      if (!book || !page) return null;
      if (book === '프린트') return { book: '프린트', page: '프린트', num: String(page), type: '오답프린트', unitName: '' };
      const info = this.pageInfo(book, parseInt(page, 10));
      const num = info && info.문제 && info.문제[i] != null ? info.문제[i] : '?';
      return { book, page: parseInt(page, 10), num, type: info ? info.유형 : '', unitName: this.unitNameOf(book, page) };
    }
    /** ⭐ 질문 TOP — 맞은 문제의 질문(⭕+⭐)도 포함합니다 */
    questionTop(classId, date, limit) {
      const d = date || this.state.today;
      const tiles = this.tiles(classId);
      const map = {};
      const add = (s, k, m) => {
        const row = map[k] || (map[k] = { key: k, students: [], kinds: { x: 0, o: 0 } });
        if (!row.students.find(x => x.id === s.id)) row.students.push(s);
        row.kinds[m === 'o' ? 'o' : 'x']++;
      };
      this.activeStudents(classId).forEach(s => {
        const g = this.grade(classId, s.id, d);
        Object.keys(g.marks).forEach(k => {
          if (g.cleanup[k] === 'star') add(s, k, g.marks[k]);
        });
      });
      return Object.values(map).map(m => {
        const t = tiles.find(x => x.key === m.key) || this.tileOfKey(m.key) || { page: '?', num: '?', type: '', book: '' };
        return Object.assign(m, { page: t.page, num: t.num, type: t.type, book: t.book, count: m.students.length });
      }).sort((a, b) => b.count - a.count).slice(0, limit || 5);
    }
    /** ❌ 반 전체 많이 틀린 문제 TOP — 질문을 안 눌렀어도 다수가 틀리면 올라옵니다 */
    wrongTop(classId, date, limit) {
      const d = date || this.state.today;
      const tiles = this.tiles(classId);
      const map = {};
      this.activeStudents(classId).forEach(s => {
        const g = this.grade(classId, s.id, d);
        Object.keys(g.marks).forEach(k => {
          if (g.marks[k] !== 'x') return;
          const row = map[k] || (map[k] = { key: k, students: [], fixed: 0, star: 0 });
          if (!row.students.find(x => x.id === s.id)) row.students.push(s);
          if (g.cleanup[k] === 'fixed') row.fixed++;
          if (g.cleanup[k] === 'star') row.star++;
        });
      });
      return Object.values(map).map(m => {
        const t = tiles.find(x => x.key === m.key) || this.tileOfKey(m.key) || { page: '?', num: '?', type: '', book: '' };
        return Object.assign(m, { page: t.page, num: t.num, type: t.type, book: t.book, count: m.students.length });
      }).sort((a, b) => (b.count - a.count) || (a.page - b.page)).slice(0, limit || 5);
    }
    /** 📋 학생별 아직 고치지 않은 오답 목록 — 누가 어느 쪽 몇 번을 못 고쳤는지 */
    openWrongByStudent(classId) {
      return this.activeStudents(classId).map(s => {
        const g = this.grade(classId, s.id);
        const rows = [];
        this.tiles(classId).forEach(t => {
          if (g.marks[t.key] !== 'x' || g.cleanup[t.key] === 'fixed') return;
          rows.push({ book: t.book, page: t.page, num: t.num, label: (t.page + '쪽 ' + t.num + '번'), star: g.cleanup[t.key] === 'star', today: true });
        });
        this.carried(classId, s.id).forEach(m => {
          if ((m.reason || 'x') === 'skip') return;
          rows.push({ book: m.book, page: m.page, num: m.num, label: (m.label || (m.page + '쪽 ' + m.num + '번')), star: m.reason === 'star', carried: true });
        });
        return { student: s, rows };
      });
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
      [K(classId, this.hwDate(classId), sid), K(classId, this.state.today, sid) + '|print'].forEach(k => {
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
      let d = date;
      if (!d) d = kind === 'print' ? this.state.today : this.hwDate(classId);
      return this.state.submissions[SK(classId, d, sid, kind)] || null;
    }
    stampOrder(classId, date) {
      const d = date || this.hwDate(classId);
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
      /* ★ v1.1 — 보스 최대 체력이 반 인원에 비례해 저절로 조절됩니다.
         1명 60% · 2명 70% · 3명 80% · 4명 90% · 5명 이상 100%.
         1~2명 반은 도장 한 번에 100% 데미지라 혼자서도 주간 보스를 격파할 수 있어요. */
      const hpMax = Math.min(100, 50 + total * 10);
      const stampW = total <= 2 ? 1 : 0.8;
      const dmg = (stamped / total) * stampW + Math.min(0.2, (fixed / (total * 3)) * 0.2) + petDmg;
      const hp = Math.max(0, Math.round(hpMax * (1 - dmg) - this.bossBoost(classId)));
      const killed = hp <= 0;
      return {
        total, stamped, submitted, fixed, power, petDmg: Math.round(petDmg * 100), hpMax, stampW,
        hp, left: total - stamped, def: this.bossDef(classId), killed,
        myShare: 0
      };
    }
    /** 내가 깎은 HP (%) — 반 전체 데미지 중 내 몫 (도장 + 오답 수정 + 내 동료 공격력) */
    myDamage(classId, sid) {
      const total = (this.activeStudents(classId).length) || 1;
      const st = this.stats(classId, sid);
      const p = this.printStats(classId, sid);
      const row = this.submission(classId, sid);
      const hpMax = Math.min(100, 50 + total * 10);
      const stampW = total <= 2 ? 1 : 0.8;
      const stampPt = (row && row.stampAt) ? stampW / total : 0;
      const fixedPt = Math.min(0.2, ((st.c3 + p.c3) / (total * 3)) * 0.2);
      const compPt = this.companionPower(classId, sid) * 0.01;   // 동료 1 = 1%p
      return Math.round((stampPt + fixedPt + compPt) * hpMax * 10) / 10;
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
      const list = c ? c.students.filter(s => s.status !== 'left') : [];
      return list.map(s => {
        const st = this.stats(classId, s.id);
        const ps = this.printStats(classId, s.id);
        return Object.assign({
          student: s,
          sub: this.submission(classId, s.id),
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
      this.state.classes.forEach(c => c.students.filter(s => s.status !== 'left').forEach(s => {
        all.push({ student: s, cls: c, xp: this.totalXP(c.id, s.id), solved: this.solvedToday(c.id, s.id) });
      }));
      all.sort((a, b) => mode === 'king' ? (b.solved - a.solved) || (b.xp - a.xp) : b.xp - a.xp);
      return all.slice(0, 10).map((x, i) => ({
        rank: i + 1, student: x.student, cls: x.cls,
        label: x.cls.name, value: mode === 'king' ? x.solved + '문제' : x.xp + ' XP'
      }));
    }

    top5(classId, date) {
      // ★ v1.0: 맞은 문제에 단 질문(⭕+⭐)도 함께 올립니다. 없으면 예전처럼 ❌ 많은 문제로
      const list = this.questionTop(classId, date, 5);
      if (list.length) return list;
      const d = date || this.state.today;
      const tiles = this.tiles(classId);
      const map = {};
      const add = (s, k) => { map[k] = map[k] || { key: k, students: [] }; if (!map[k].students.find(x => x.id === s.id)) map[k].students.push(s); };
      this.activeStudents(classId).forEach(s => {
        const g = this.grade(classId, s.id, d);
        Object.keys(g.marks).forEach(k => {
          if (g.marks[k] === 'x' && g.cleanup[k] === 'star') add(s, k);
        });
      });
      if (Object.keys(map).length === 0) {
        this.activeStudents(classId).forEach(s => {
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

    /* ---------- 오답 3단 구분 · 반 대시보드 (v0.9) ---------- */
    /** 기간 안 오답을 문제 하나 단위로 모음니다 — 고쳐서 맞힌 문제가 '미해결'로 잡히지 않게 */
    wrongSets(classId, sid, from, to) {
      const map = {};
      const add = (id, fixed) => { const r = map[id] || (map[id] = { fixed: false }); if (fixed) r.fixed = true; };
      Object.keys(this.state.grades || {}).forEach(k => {
        const p = String(k).split('|');
        if (p[0] !== classId || p[2] !== sid || p[3] === 'print') return;
        if (from && p[1] < from) return;
        if (to && p[1] > to) return;
        const row = this.state.grades[k] || {};
        Object.keys(row.marks || {}).forEach(mk => {
          if (row.marks[mk] !== 'x') return;
          add(p[1] + '|' + mk, (row.cleanup || {})[mk] === 'fixed');
        });
      });
      const tagOf = m => m.origin ? (m.origin.date + '|' + m.origin.key) : ('c|' + m.date + '|' + m.book + '|' + m.page + '|' + m.num);
      const inR = d => (!from || !d || d >= from) && (!to || !d || d <= to);
      ((this.state.carried || {})[sid] || []).forEach(m => {
        if ((m.reason || 'x') === 'skip') return;
        const d = m.origin ? m.origin.date : m.date;
        if (!inR(d)) return;
        add(tagOf(m), false);
      });
      ((this.state.solvedCarried || {})[sid] || []).forEach(m => {
        if ((m.reason || 'x') === 'skip' || m.skip) return;
        const d = m.origin ? m.origin.date : m.date;
        if (!inR(d)) return;
        add(tagOf(m), true);
      });
      ((this.state.monsters || {})[sid] || []).forEach(m => {
        if (m.fromCarry || m.skip) return;
        if (!inR(m.date)) return;
        add('m|' + m.date + '|' + m.book + '|' + m.page + '|' + m.num, !!m.captured);
      });
      const ids = Object.keys(map);
      let fixed = 0;
      ids.forEach(id => { if (map[id].fixed) fixed++; });
      return { total: ids.length, fixed, open: ids.length - fixed };
    }
    /** 오늘 숙제만의 오답 3단 — 전체 틀린 / 아직 안 고친 / 고쳐서 맞힌 */
    wrongStats(classId, sid) {
      const c = this.counts(classId, sid);
      const fixed = c.c3;
      return { total: c.c2 + c.c3 + c.c4, open: c.c2 + c.c4, fixed };
    }
    /** 선생님 반 대시보드 — 제출률·미제출·오답 수정률·학습량·학생별 비교 */
    dashboard(classId, range) {
      range = range || 'month';
      const days = range === 'week' ? 7 : range === 'month' ? 30 : 120;
      const to = this.state.today;
      const from = shiftISO(to, -(days - 1));
      const rows = this.activeStudents(classId).map(s => {
        const ws = this.wrongSets(classId, s.id, from, to);
        const r = this.parentReport(classId, s.id, range);
        const sub = this.submission(classId, s.id);
        const ps = this.submission(classId, s.id, null, 'print');
        const st = this.stats(classId, s.id);
        return {
          student: s,
          submitted: !!sub, stamped: !!(sub && sub.stampAt), printSubmitted: !!ps,
          market: st.marked, marked: st.marked, total: st.total,
          wrongTotal: ws.total, wrongOpen: ws.open, wrongFixed: ws.fixed,
          fixRate: ws.total ? Math.round(ws.fixed / ws.total * 100) : 0,
          hwRate: r.hwRate, classDays: r.classDays, doneClassDays: r.doneClassDays,
          solved: r.solved, streak: r.streak,
          lastAt: sub ? sub.at : ps ? ps.at : ''
        };
      });
      const total = rows.length || 1;
      const submitted = rows.filter(r => r.submitted || r.printSubmitted).length;
      const missing = rows.filter(r => !r.submitted && !r.printSubmitted);
      const wt = rows.reduce((a, r) => a + r.wrongTotal, 0);
      const wf = rows.reduce((a, r) => a + r.wrongFixed, 0);
      const wo = rows.reduce((a, r) => a + r.wrongOpen, 0);
      const solved = rows.reduce((a, r) => a + r.solved, 0);
      return {
        range, from, to, rows, total, submitted, stamped: rows.filter(r => r.stamped).length,
        submitRate: Math.round(submitted / total * 100),
        missing, wrongTotal: wt, wrongOpen: wo, wrongFixed: wf,
        fixRate: wt ? Math.round(wf / wt * 100) : 0,
        solved, avgHw: Math.round(rows.reduce((a, r) => a + r.hwRate, 0) / total),
        due: this.dueInfo(classId), lesson: this.lesson(classId) || {}
      };
    }

    /* ---------- 반 이동 · 퇴원(보관) (v0.9) ---------- */
    moveStudent(classId, sid, toClassId) {
      const from = this.getClass(classId), to = this.getClass(toClassId);
      if (!from || !to || classId === toClassId) return null;
      const i = from.students.findIndex(s => s.id === sid);
      if (i < 0) return null;
      if (to.students.some(x => x.id === sid)) return null;
      const s = from.students.splice(i, 1)[0];
      s.status = 'active'; s.leftAt = null;
      s.movedFrom = (s.movedFrom || []).concat([{ from: classId, to: toClassId, at: this.state.today }]);
      to.students.push(s);
      // 채점·제출·프린트 기록의 반 이름을 새 반으로 옮겨 붙입니다 (펫·코인·XP는 학생 객체 그대로)
      const rekey = obj => {
        Object.keys(obj || {}).forEach(k => {
          const p = String(k).split('|');
          if (p[0] !== classId || p[2] !== sid) return;
          const nk = [toClassId].concat(p.slice(1)).join('|');
          if (!obj[nk]) obj[nk] = obj[k];
          delete obj[k];
        });
      };
      rekey(this.state.grades); rekey(this.state.submissions); rekey(this.state.prints); rekey(this.state.lateUploads);
      this.save();
      return s;
    }
    retireStudent(classId, sid) {
      const s = this.student(classId, sid);
      if (!s) return null;
      s.status = 'left'; s.leftAt = this.state.today;
      this.save();
      return s;
    }
    restoreStudent(classId, sid) {
      const s = this.student(classId, sid);
      if (!s) return null;
      s.status = 'active'; s.leftAt = null;
      this.save();
      return s;
    }

    /* ---------- 숙제·쪽수 설정 복사 (v0.9) ---------- */
    copyLesson(fromClassId, toClassId, opts) {
      const src = this.lesson(fromClassId);
      const dst = this.getClass(toClassId);
      if (!src || !dst || fromClassId === toClassId) return null;
      const books = (src.books || []).map(b => ({ book: b.book, pages: (b.pages || []).slice() }));
      const dueAt = (opts && opts.dueAt) || this.defaultDueAt(toClassId);
      this.saveLesson(toClassId, {
        date: this.state.today,
        lesson: (opts && opts.lesson != null) ? opts.lesson : (src.lesson || ''),
        homework: (opts && opts.homework) || books.map(b => b.book + ' ' + pageSpan(b.pages) + '쪽').join(', '),
        books, assignedAt: this.state.today, dueAt, dueDate: dueAt.slice(0, 10),
        due: '다음 수업(' + dueAt.slice(5) + ') 전까지'
      });
      delete this.state.lessons[toClassId].dueClosed;
      delete this.state.lessons[toClassId].carriedFor;
      this.save();
      return this.lesson(toClassId);
    }
    /** 오답프린트 문제 수를 다른 학생(들)에게도 복사 */
    copyPrint(classId, fromSid, toSids) {
      const info = this.printInfo(classId, fromSid);
      if (!info || !info.count) return 0;
      let n = 0;
      (toSids || []).filter(sid => sid && sid !== fromSid).forEach(sid => {
        this.state.prints[K(classId, this.state.today, sid)] = { count: info.count, lastNo: null, setBy: 'teacher', at: this.state.today };
        n++;
      });
      if (n) this.save();
      return n;
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
      const self = this;
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

      /* ⑥ 취약 단원 · 단원평가 — 오답 수와 함께 전체 오답 대비 비율(%)도 같이 적습니다 */
      const unitBase = Object.keys(unitMap).reduce((a, k) => a + (unitMap[k].wrong || 0), 0);
      const units = Object.keys(unitMap)
        .map(name => {
          const u = unitMap[name];
          return Object.assign({}, u, { pct: unitBase ? Math.round(u.wrong / unitBase * 100) : 0 });
        })
        .sort((a, b) => (b.wrong - a.wrong) || (b.fixed - a.fixed))
        .slice(0, 3);
      const exams = this.exam(classId, sid).filter(e => e.score != null && e.date >= from);
      const avgExam = exams.length ? Math.round(exams.reduce((a, e) => a + (e.score || 0), 0) / exams.length) : null;

      /* ⑦ 진도·숙제 — 이번 주 = 최근 2회분 / 이번 달 = 단원명+쪽수 1줄 요약 / 이번 학기 = 목록 없음 */
      const dayMap = Object.assign({}, ((this.state.dayLessons || {})[classId] || {}));
      const todayLesson = this.lesson(classId);
      if (todayLesson && todayLesson.date) {
        dayMap[todayLesson.date] = Object.assign({}, dayMap[todayLesson.date], todayLesson);
      }
      const cleanLine = t => String(t || '').replace(/\s+/g, ' ').trim();
      const allDays = Object.keys(dayMap)
        .filter(d => inRange(d))
        .sort()
        .reverse()
        .map(d => {
          const L = dayMap[d] || {};
          const books = (L.books || []).map(b => (b.book || '') + (b.pages && b.pages.length ? ' ' + pageSpan(b.pages) + '쪽' : '')).filter(Boolean);
          return {
            date: d, dow: dowName(d), label: shortLabel(d),
            lesson: cleanLine(L.lesson) || '',
            homework: cleanLine(L.homework) || (books.length ? books.join(', ') : ''),
            books: L.books || []
          };
        })
        .filter(d => d.lesson || d.homework);
      const dayList = range === 'week' ? allDays.slice(0, 2) : [];     // 이번 주 = 최근 2회분까지만
      /* 이번 달 — 단원명 + 전체 쪽수 한 줄 */
      let monthSummary = null;
      if (range === 'month') {
        const names = [], pageSet = {};
        let pages = 0;
        allDays.forEach(d => {
          (d.books || []).forEach(b => {
            (b.pages || []).forEach(p => {
              keySeen(b.book, p);
            });
          });
          if (!(d.books || []).length && /단원|쪽/.test(d.lesson || '')) names.push(cleanLine(d.lesson));
        });
        function keySeen(book, p) {
          const id = book + '|' + p;
          if (pageSet[id]) return;
          pageSet[id] = true; pages++;
          let u = '';
          try { u = self.unitNameOf(book, p) || ''; } catch (e) { u = ''; }
          if (u && names.indexOf(u) < 0) names.push(u);
        }
        if (names.length || pages) {
          const shown = names.slice(0, 3);
          monthSummary = {
            units: names, pages,
            text: (shown.join(' · ') || '진도 기록 없음') + (names.length > 3 ? ' 외 ' + (names.length - 3) + '단원' : '') + (pages ? ' · 전체 ' + pages + '쪽' : '')
          };
        }
      }

      /* 개별 오답프린트 — 이번 주는 최근 2회분까지만 */
      const printList = Object.keys(this.state.prints || {})
        .map(k => { const p = String(k).split('|'); return { p, v: (this.state.prints || {})[k] || {} }; })
        .filter(x => x.p[0] === classId && x.p[2] === sid && inRange(x.p[1]) && (x.v.count || 0) > 0)
        .map(x => ({ date: x.p[1], label: shortLabel(x.p[1]), md: (+x.p[1].slice(5, 7)) + '.' + x.p[1].slice(8, 10), count: x.v.count }))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, range === 'week' ? 2 : 3);

      return {
        range,
        label: range === 'week' ? '이번 주' : range === 'month' ? '이번 달' : '이번 학기',
        from, to: today, days,
        streak, hwRate, classDays, doneClassDays,
        solved: totalSolved, wrong, fixed,
        fixRate: wrong ? Math.round(fixed / wrong * 100) : 0,
        units, tags, tagTotal,
        exams, avgExam,
        dayList, printList, monthSummary,
        growth: this.growth(classId, sid, 7),
        activeDays: histActive + Object.keys(gradedDates).length
      };
    }
    /** 학부모 카카오톡 안내 — 숙제 수행 · 오답 수정 · 취약 단원 · 추가 안내만 짧게.
        자세한 문제별 기록·일자별 진도는 PNG 성적표 이미지/상세 화면에서만 보여 줍니다.
        카톡은 한 줄의 '~' 사이를 취소선으로 그어서 범위는 '-'로 씁니다. */
    kakaoSummary(classId, sid, range) {
      const s = this.student(classId, sid) || {};
      const c = this.getClass(classId) || {};
      const r = this.parentReport(classId, sid, range);
      const pct = id => { const t = r.tags.find(x => x.id === id); return t ? t.pct : 0; };
      const kd = iso => iso.slice(5).replace('-', '.');
      const lines = [];
      lines.push(`안녕하세요 어머님, ${c.name || ''} 담임입니다.`);
      lines.push(`${s.name} 학생의 ${r.label} 학습 현황을 보내 드립니다. (${kd(r.from)} - ${kd(r.to)})`);
      lines.push('');
      lines.push('■ 숙제 수행');
      if (r.classDays) lines.push(`· 숙제 ${r.classDays}회 중 ${r.doneClassDays}회 완료 (${r.hwRate}%)`);
      else lines.push('· 이번 기간 숙제 기록이 없습니다.');
      lines.push(`· 총 ${r.solved}문항 풀이 · 연속 ${r.streak}일 학습`);
      lines.push('');
      lines.push('■ 오답 수정');
      if (r.wrong) {
        lines.push(`· 틀린 문제 ${r.wrong}개 중 ${r.fixed}개 다시 풀어 해결 (${r.fixRate}%)`);
        if (r.wrong - r.fixed > 0) lines.push(`· 아직 남은 오답 ${r.wrong - r.fixed}개`);
        else lines.push('· 남은 오답 없이 전부 다시 풀었습니다 👏');
      } else {
        lines.push('· 틀린 문제 없이 완벽하게 해결했습니다! (오답 0개 👏)');
      }
      lines.push('');
      lines.push('■ 취약 단원');
      if (r.units.length) {
        r.units.slice(0, 2).forEach(u => lines.push(`· ${u.name} · 오답 ${u.wrong}개 (${u.pct || 0}%)${u.fixed ? ` · ${u.fixed}개 해결` : ''}`));
      } else {
        lines.push('· 이번 기간에는 다시 볼 단원이 없습니다 👍');
      }
      /* 추가 안내 — 전할 내용이 없으면 어색한 문구를 넣지 않고 그 묶음 자체를 빼 둡니다 */
      const extra = [];
      if (r.exams.length && r.avgExam != null) {
        extra.push(`· 단원평가 평균 ${r.avgExam}점 (${r.exams.length}회 응시)`);
        const low = r.exams.filter(e => e.score != null && e.score < 80).slice(-1)[0];
        if (low) extra.push(`· ${low.unit.replace(' 평가', '')} ${low.score}점 - 해당 단원 복습을 부탁드려요`);
      } else if (r.wrong > 0 && r.tagTotal > 0) {
        extra.push(`· 오답 원인은 계산 실수 ${pct('calc')}% · 문제 잘못 읽음 ${pct('read')}% · 개념 보완 ${pct('concept')}% 순이에요`);
      }
      if (extra.length) {
        lines.push('');
        lines.push('■ 추가 안내');
        extra.forEach(x => lines.push(x));
      }
      lines.push('');
      if (r.wrong === 0) lines.push('다음 단원도 이 기세로 즐겁게 풀어 보자고 응원해 주세요.');
      else lines.push('가정에서도 꾸준한 복습을 응원해 주시면 좋겠습니다.');
      lines.push(`문제별 기록은 함께 보내 드린 ${r.label} 성취도 리포트 이미지에서 자세히 보실 수 있어요. 감사합니다.`);
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
      /* ★ v1.1 쪽수표 자동 갱신 — 예전엔 `st.pageMaps = st.pageMaps || …` 라서
         localStorage에 옛 예시 표(v0.9 55쪽)가 한 번 들어가면 새 책(226쪽)이 영원히 반영되지 않았습니다.
         version이 다르면 학생 기록(xp·coins·pets·logs·prints·backlog·streak …)은 그대로 두고 pageMaps만 교체합니다. */
      const pm = window.EMA_PAGE_MAPS;
      if (pm && pm.교재 && Object.keys(pm.교재).length) {
        const mine = st.pageMaps && st.pageMaps.version;
        if (!st.pageMaps || !st.pageMaps.교재 || !Object.keys(st.pageMaps.교재).length) {
          st.pageMaps = pm;
        } else if (String(mine || '') !== String(pm.version || '')) {
          this._write(this.key + PAGE_MAPS_BACKUP, st.pageMaps);   // 옛 표는 백업 (되돌릴 수 있게)
          st.pageMaps = pm;
          st.meta = Object.assign({}, st.meta, { pageMapsAt: new Date().toISOString(), pageMapsFrom: String(mine || '') });
          console.info('쪽수표 자동 갱신:', mine || '(없음)', '→', pm.version);
        }
      } else {
        st.pageMaps = st.pageMaps || { 교재: {} };
      }
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
      st.activity = st.activity || {};          // v0.9 — 날짜별 실제로 누른 문제 수
      st.missions = st.missions || {};          // v1.0 — 날짜별 미션 완료 기록
      st.weekBonus = st.weekBonus || {};        // v1.0 — 주간 목표 보너스 지급 기록
      st.petXp = st.petXp || {};                // v1.0 — 펫 경험치 하루 상한 기록
      st.effort = st.effort || {};              // v1.1 — 🔥 오늘의 열정 학생 알림 (날짜|학생 → {at, reason})
      if (!st.shop) st.shop = { rewardsOn: true, claims: [] };
      if (!st.gallery) st.gallery = { mode: 'auto' };
      if (!st.bossBoosts) st.bossBoosts = {};
      if (!st.bossKills) st.bossKills = {};
      if (!st.meta) st.meta = {};
      if (this.demo) { st.meta.demo = true; st.meta.origin = 'demo'; }
      /* ★ v1.2 — 내 공부방(중1-1 응용심화 1인 반)은 기존 기기에도 한 번만 자동으로 더합니다.
         localOnly: 학원 관리시트·다른 반과 절대 섞이지 않게 표시해 둡니다. */
      if (window.EMA.buildStudyRoom && !st.classes.some(c => c.id === 'study1')) {
        st.classes.push(window.EMA.buildStudyRoom(st.today || todayISO()));
      }
      const studyCls = st.classes.find(c => c.id === 'study1');
      if (studyCls && !st.lessons['study1']) {
        const base = st.today || todayISO();
        const dows = [1, 3, 5];                       // 월·수·금
        let dueDay = '';
        for (let i = 1; i <= 14; i++) {
          const cand = shiftISO(base, i);
          if (dows.indexOf(new Date(cand + 'T12:00:00').getDay()) >= 0) { dueDay = cand; break; }
        }
        dueDay = dueDay || shiftISO(base, 1);
        const dueAt = dueDay + ' 20:30';
        st.lessons['study1'] = {
          date: base,
          lesson: '중1-1 응용심화 : 1단원 소수와 거듭제곱 (4-6쪽)',
          homework: '중1-1 응용심화 4-6쪽',
          books: [{ book: '중1-1 응용심화', pages: [4, 5, 6] }],
          assignedAt: base, dueAt, dueDate: dueAt.slice(0, 10),
          due: '다음 수업(' + dueAt.slice(5) + ') 전까지'
        };
      }
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
          if (!s.status) s.status = 'active';        // v0.9 — 재원 / left(퇴원·보관)
        });
        const l = st.lessons[c.id];
        if (l && !l.dueAt) {
          // v0.8까지는 dueDate(날짜)만 있었습니다 — 그 반 수업 시작 시각을 붙여 마감 시각으로
          let d = l.dueDate || '';
          if (!d) {
            const dowMap = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
            const ds = [];
            String(c.days || '').split(/[^가-힣]+/).forEach(tok => String(tok).split('').forEach(ch => { if (dowMap[ch] != null && ds.indexOf(dowMap[ch]) < 0) ds.push(dowMap[ch]); }));
            d = shiftISO(st.today, 1);
            for (let i = 1; i <= 14 && ds.length; i++) {
              const cand = shiftISO(st.today, i);
              if (ds.indexOf(new Date(cand + 'T12:00:00').getDay()) >= 0) { d = cand; break; }
            }
          }
          l.dueAt = /^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}$/.test(d) ? d : d + ' ' + this.classStart(c);
          l.dueDate = l.dueAt.slice(0, 10);
        }
      });
      Object.keys(st.grades).forEach(k => {
        const g = st.grades[k];
        if (!g) return;
        if (!g.marks) g.marks = {};
        if (!g.cleanup) g.cleanup = {};
        if (!g.tags) g.tags = {};
        if (!g.excl) g.excl = {};
      });
      // 사진은 지워져도 '사진을 냈다'는 사실은 영구히 남깁니다
      Object.keys(st.submissions).forEach(k => {
        const sub = st.submissions[k];
        if (!sub) return;
        if (sub.photoId) { sub.photoSubmitted = true; if (!sub.photoAt) sub.photoAt = sub.at || ''; }
      });
      /* ★ v1.2 — 예전에 생긴 유령 기록(쪽수표에 없는 쪽 · 문제 없는 개념쪽 · num null)을 자동 정리 */
      this._cleanPhantom(st);
      return st;
    }

    /** v1.2 — '58쪽 ?번'·'58null' 같은 유령 기록 정리.
        쪽수표에 없는 쪽, 문제가 없는 개념 설명 쪽에서 만들어진 밀린문제·몬스터·채점 키를 지웁니다.
        (지우기 전 원본은 migrate 가 ema.state.v5.migrate.v<이전버전> 으로 백업합니다) */
    _cleanPhantom(st) {
      const MAP = (st.pageMaps && st.pageMaps.교재) || {};
      const pageInfo = (book, page) => {
        const b = MAP[book];
        if (!b) return null;
        const key = String(page);
        for (const u of Object.keys(b.단원 || {})) {
          const cell = (b.단원[u].쪽 || {})[key];
          if (cell) return cell;
        }
        return null;
      };
      const numBad = n => n == null || String(n).trim() === '' || String(n) === 'null' || String(n) === 'undefined';
      const valid = (book, page, num) => {
        if (book === '프린트') return !numBad(num);
        if (numBad(num)) return false;
        const inf = pageInfo(book, page);
        return !!(inf && (inf.문제 || []).length);
      };
      let dropped = 0;
      ['carried', 'solvedCarried', 'monsters'].forEach(field => {
        const M = st[field];
        if (!M) return;
        Object.keys(M).forEach(sid => {
          const list = M[sid] || [];
          M[sid] = list.filter(m => {
            const keep = valid(m && m.book, m && m.page, m && m.num);
            if (!keep) dropped++;
            return keep;
          });
        });
      });
      Object.keys(st.grades || {}).forEach(k => {
        const g = st.grades[k];
        if (!g) return;
        ['marks', 'cleanup', 'tags', 'excl'].forEach(f => {
          const obj = g[f];
          if (!obj) return;
          Object.keys(obj).forEach(key => {
            const parts = String(key).split(':');
            const bp = parts[0] || '';
            const cut = bp.indexOf('|');
            if (cut < 0) return;                     // 옛 형식 키는 손대지 않습니다
            const book = bp.slice(0, cut), page = bp.slice(cut + 1);
            if (book === '프린트') return;
            const inf = pageInfo(book, page);
            const idx = Number(parts[1] || 0);
            if (!inf || !(inf.문제 || []).length || idx >= (inf.문제 || []).length) { delete obj[key]; dropped++; }
          });
        });
      });
      if (dropped) console.info('v1.2 유령 기록 정리:', dropped, '건');
      return dropped;
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
      // v0.9 — 숙제가 여러 날에 걸쳐 이어질 때 '그날 실제로 누른 문제 수'를 따로 기록
      const A = st.activity || {};
      Object.keys(A).forEach(sid => {
        const n = Number((A[sid] || {})[date] || 0);
        if (!n) return;
        const hist = st.history[sid] = st.history[sid] || [];
        const row = hist.find(h => h.date === date);
        if (row) row.solved = Math.max(row.solved || 0, n);
        else hist.push({ date, solved: n });
      });
    }
    /** 오늘 실제로 누른 문제 수를 기록 (여러 날 숙제의 날짜별 학습량) */
    _touchActivity(classId, sid, n) {
      const cnt = Number(n) || 0;
      if (!cnt) return;
      const A = this.state.activity || (this.state.activity = {});
      const row = A[sid] || (A[sid] = {});
      row[this.state.today] = (Number(row[this.state.today] || 0)) + cnt;
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
        if (!this.demo) LEGACY_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { } });   // 연습 칸은 운영 기록을 건드리지 않음
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
      const k = SK(classId, kind === 'print' ? this.state.today : this.hwDate(classId), sid, kind);
      const g = this.state.grades[k] || (this.state.grades[k] = { marks: {}, cleanup: {}, tags: {}, excl: {}, updatedAt: null });
      if (!g.marks) g.marks = {};
      if (!g.cleanup) g.cleanup = {};
      if (!g.tags) g.tags = {};
      if (!g.excl) g.excl = {};
      return g;
    }

    /* 쓰기 — 채점 */
    /** mark: 'o' | 'x' | '' (같은 것을 다시 누르면 해제 → 미풀이) */
    setMark(classId, sid, key, mark, kind) {
      const g = this.gradeRow(classId, sid, kind);
      const had = g.marks[key] || '';
      if (!mark || g.marks[key] === mark) {
        delete g.marks[key];
        delete g.cleanup[key];
        delete g.tags[key];
      } else {
        g.marks[key] = mark;
        if (mark === 'o') { delete g.cleanup[key]; delete g.tags[key]; }
        if (!had) { this._touchActivity(classId, sid, 1); this.addPetXp(classId, sid, 1); }     // 오늘 새로 누른 문제 · 펫 경험치
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
      // ★ v1.0: '✨ 나머지 전부 ⭕' — 아직 안 누른 칸만 채우고, ❌ 틀린 문제는 그대로 둡니다
      return this.fillRestCorrect(classId, sid, kind, bookName) > 0;
    }
    setCleanup(classId, sid, key, kind2, kind) {
      const g = this.gradeRow(classId, sid, kind);
      const m = g.marks[key];
      // ★ v1.0: ⭕ 맞았어요에도 ⭐ 질문을 달 수 있습니다(엄마 도움받아 풀었거나 찜찜한 경우)
      if (m !== 'x' && m !== 'o') return '';
      // ❌ 틀린 문제는 '해결 / 질문'만, ⭕ 맞은 문제는 '질문'만
      if (m === 'o' && kind2 !== 'star') return '';
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
    /** 제출할 때 '안 누른 문제'를 밀린문제로 넘깁니다 — ★ 기한이 지난 뒤에만!
        기한 전(진행 중)에는 넘기지 않고 그대로 오늘 숙제에 남겨 두었습니다. */
    carryOverUnmarked(classId, sid, kind) {
      if (kind === 'print') return 0;
      const due = this.dueInfo(classId);
      if (!due.passed) return 0;                     // ★ 기한 전 부분 제출·임시 저장은 밀린문제가 아님
      const g = this.grade(classId, sid);
      let n = 0;
      this.tiles(classId).forEach(t => {
        if (t.missing || t.num == null) return;        // v1.2 — 쪽수표에 없는 쪽은 밀린문제로 넘기지 않습니다
        if (g.marks[t.key]) return;
        if ((g.excl || {})[t.key]) return;             // 🏫 수업에서 푼 문제는 밀린문제가 아닙니다
        if (this._hasCarry(sid, this.hwDate(classId), t.key)) return;
        this._addCarry(sid, {
          book: t.book, page: t.page, num: t.num, label: (t.page + '쪽 ' + t.num + '번'),
          date: this.hwDate(classId), reason: 'skip', overdue: true, dueAt: due.dueAt,
          origin: { date: this.hwDate(classId), key: t.key }
        });
        n++;
      });
      if (n) this.save();
      return n;
    }
    /** 임시 저장 — 지금까지 누른 채점을 그대로 저장만 합니다 (기한 전이면 이월 없음) */
    saveProgress(classId, sid) {
      this.save();
      return true;
    }
    /** 기한이 지난 숙제 하나를 훑어 미푼 문제를 이월합니다 */
    sweepDueOne(classId) {
      const l = this.lesson(classId);
      if (!l) return 0;
      const due = this.dueInfo(classId);
      if (!due.passed) return 0;
      let n = 0;
      this.activeStudents(classId).forEach(s => { n += this.carryOverUnmarked(classId, s.id, 'hw'); });
      l.carriedFor = due.dueAt;
      return n;
    }
    /** 앱을 열 때마다: 기한이 지난 숙제의 미푼 문제를 한 번만 이월 */
    sweepDue() {
      const out = [];
      Object.keys(this.state.lessons || {}).forEach(cid => {
        const l = this.state.lessons[cid];
        if (!l || !this.getClass(cid)) return;
        const due = this.dueInfo(cid);
        if (!due.passed) return;
        if (l.carriedFor === due.dueAt) return;
        out.push({ classId: cid, added: this.sweepDueOne(cid), dueAt: due.dueAt });
      });
      if (out.length) this.save();
      return out;
    }
    /** 테스트용: '다음 날로 넘겨보기' — 반 전원의 오늘 미풀이·안 고친 오답을 밀린문제로 */
    nextDayPreview(classId) {
      const c = this.getClass(classId);
      const rows = [];
      let total = 0;
      this.activeStudents(classId).forEach(s => {
        const g = this.grade(classId, s.id);
        let n = 0;
        this.tiles(classId).forEach(t => {
          if (t.missing || t.num == null) return;      // v1.2 — 유령 타일 제외
          const mark = g.marks[t.key];
          if (mark === 'o') return;
          if (mark === 'x' && g.cleanup[t.key] === 'fixed') return;
          if ((g.excl || {})[t.key]) return;             // 수업에서 푼 문제는 밀린문제가 아님
          if (this._hasCarry(s.id, this.state.today, t.key)) return;
          this._addCarry(s.id, {
            book: t.book, page: t.page, num: t.num, label: (t.page + '쪽 ' + t.num + '번'),
            date: this.hwDate(classId),
            reason: mark === 'x' ? (g.cleanup[t.key] === 'star' ? 'star' : 'x') : 'skip',
            overdue: true, dueAt: this.dueAtOf(classId),
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
      this.activeStudents(classId).forEach(s => {
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
      this.state.submissions[SK(classId, kind === 'print' ? this.state.today : this.hwDate(classId), sid, kind)] = sub;
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
      if (!already) this.markEffort(classId, sid, 'homework');   // 🔥 선생님께 '오늘 열심히 했어요!' 알림
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
      const k = SK(classId, kind === 'print' ? this.state.today : this.hwDate(classId), sid, kind);
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
      // IndexedDB를 못 쓰는 브라우저(폴백 저장)에서는 localStorage 쪽도 같이 정리
      if (EMA.photos.failed) {
        const limit = shiftISO(todayISO(), -((EMA.photos.KEEP_DAYS || 7) - 1));
        Object.keys(this.state.photos || {}).forEach(id => {
          const d = (this.state.photos[id] || {}).date || '';
          if (d && d < limit) { delete this.state.photos[id]; gone.push(id); }
        });
      }
      if (gone.length) console.info('7일 지난 사진 자동 삭제:', gone.length, '장');
      return gone;
    }

    stamp(classId, sid, kind) {
      const k = SK(classId, kind === 'print' ? this.state.today : this.hwDate(classId), sid, kind);
      const sub = this.state.submissions[k];
      if (!sub) return false;
      sub.status = 'stamped'; sub.stampAt = nowHHMM();
      const killed = this.checkBossKill(classId);
      this.save();
      return killed || true;
    }
    stampAllPending(classId) {
      let n = 0;
      this.activeStudents(classId).forEach(s => {
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
      const k = SK(classId, kind === 'print' ? this.state.today : this.hwDate(classId), sid, kind);
      const sub = this.state.submissions[k];
      if (!sub) return false;
      sub.status = 'resubmit'; sub.note = '사진 다시 찍어 주세요'; sub.stampAt = null;
      this.save(); return true;
    }
    unlockSubmission(classId, sid, kind) {
      const k = SK(classId, kind === 'print' ? this.state.today : this.hwDate(classId), sid, kind);
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
      /* v1.2 — 아직 한 번도 쓴 적 없는 학생(새 반·새 기기)에게는 '어제 불꽃' 안내를 띄우지 않습니다 */
      const any = (this.state.history[sid] || []).length || Object.keys((this.state.activity || {})[sid] || {}).length;
      if (!any) return false;
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
      const before = p.lv || 1;
      p.lv = before + 1;
      p.xp = Math.max(Number(p.xp || 0), p.lv === 2 ? PET_XP.need2 : PET_XP.need3);
      let title = null;
      if (p.lv >= 3) {
        s.titles = s.titles || [];
        if (!s.titles.find(t => t.id === 'grown_' + p.id)) {
          title = { id: 'grown_' + p.id, name: p.name + ' 대장', em: '👑' };
          s.titles.push(Object.assign({ at: this.state.today }, title));
        }
      }
      this.save();
      /* stageUp: 간식으로 한 단계 자랖을 때 앱이 전체 화면 축하를 보여 줍니다 */
      return { ok: true, pet: p, stageUp: true, title, msg: `${p.name} ⭐${p.lv}로 성장! 공격력 +1` };
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
        if (!isSkip) this.addPetXp(classId, sid, 3);      // 오답을 고치면 펫이 크게 자라요
        if (!isSkip && n <= 5) join = this.purifyEgg(classId, sid, 'carry|' + id);
      }
      const killed = this.checkBossKill(classId);
      this.save();
      /* 🔥 오늘의 열정 학생 — 숙제 완료 또는 밀린문제 3개 이상 해결 */
      const effort = !isSkip && n === 3 ? this.markEffort(classId, sid, 'carry3') : null;
      return { item, coins, xp, killed, join, skip: isSkip, count: n, capped: !isSkip && n > 5, effort };
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

    /* =========================================================
       v1.1 4단계 — 🔥 오늘의 열정 학생 · ✅ 책으로 완료 · 성장 그래프
    ========================================================= */
    /** 🔥 오늘의 열정 학생 알림 — 숙제 완료 / 밀린문제 3개 이상 해결 / 선생님 책으로 완료
        reason: homework | carry3 | book */
    markEffort(classId, sid, reason) {
      const s = this.student(classId, sid);
      if (!s) return null;
      const day = this.state.today;
      const key = day + '|' + sid;
      const E = this.state.effort = this.state.effort || {};
      const cur = E[key] || { at: nowHHMM(), reason: reason || 'homework', count: 0 };
      cur.at = nowHHMM();
      cur.count = (cur.count || 0) + 1;
      cur.reason = reason || cur.reason || 'homework';
      cur.label = s.nickname || s.name;
      E[key] = cur;
      this.save();
      return cur;
    }
    /** 선생님 대시보드 상단 — 오늘 열정을 보인 학생 (최근 순) */
    effortToday(classId) {
      const day = this.state.today;
      const E = this.state.effort || {};
      const out = [];
      this.activeStudents(classId).forEach(s => {
        const row = E[day + '|' + s.id];
        if (row) out.push({ student: s, at: row.at || '', reason: row.reason || 'homework', count: row.count || 1 });
      });
      return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    }
    /** 오늘 열정 알림 기록 지우기 (선생님이 확인한 뒤) */
    clearEffort(classId, sid) {
      const day = this.state.today;
      const E = this.state.effort || {};
      if (sid) delete E[day + '|' + sid];
      else Object.keys(E).forEach(k => { if (k.indexOf(day + '|') === 0) delete E[k]; });
      this.save();
      return true;
    }
    /** ✅ 책으로 완료 (밀린문제 제외) — 앱 오류·사진 문제로 제출이 막혔을 때 선생님이 한 번에 완료 처리
        오늘 숙제는 '도장'으로 마무리하고, 아직 안 누른 문제는 새로 밀린문제로 넘기지 않습니다. */
    markBookDone(classId, sid, kind) {
      const k2 = kind === 'print' ? 'print' : 'hw';
      const date = k2 === 'print' ? this.state.today : this.hwDate(classId);
      const key = SK(classId, date, sid, k2);
      const S = this.state.submissions = this.state.submissions || {};
      const sub = S[key] || (S[key] = { coins: 0, xp: 0, rewarded: false });
      const already = !!(sub.stampAt || sub.status === 'stamped');
      sub.at = sub.at || nowHHMM();
      sub.status = 'stamped';
      sub.stampAt = sub.stampAt || nowHHMM();
      sub.bookDone = true;
      sub.bookDoneAt = nowHHMM();
      sub.note = '책으로 완료 (선생님 확인)';
      const s = this.student(classId, sid);
      if (s) this.markEffort(classId, sid, 'book');
      this.save();
      return { ok: true, already, sub };
    }
    /** 📈 성장 그래프 — 최근 N일 학습량·오답 해결 수 (내 도감·리포트용) */
    growth(classId, sid, days) {
      const n = Math.max(3, Math.min(14, days || 7));
      const today = this.state.today;
      const hist = (this.state.history || {})[sid] || [];
      const act = (this.state.activity || {})[sid] || {};
      const fixedBy = {};
      ((this.state.solvedCarried || {})[sid] || []).forEach(m => {
        if (!m || m.skip) return;
        const d = m.solvedAt || m.date;
        if (d) fixedBy[d] = (fixedBy[d] || 0) + 1;
      });
      Object.keys(this.state.grades || {}).forEach(k => {
        const p = String(k).split('|');
        if (p[0] !== classId || p[2] !== sid) return;
        const row = this.state.grades[k] || {};
        const nf = Object.keys(row.cleanup || {}).filter(x => row.cleanup[x] === 'fixed').length;
        if (nf) fixedBy[p[1]] = (fixedBy[p[1]] || 0) + nf;
      });
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const date = shiftISO(today, -i);
        const h = hist.find(x => x && x.date === date);
        const solved = Math.max(Number((h && h.solved) || 0), Number(act[date] || 0));
        out.push({
          date, dow: DOW[new Date(date + 'T12:00:00').getDay()],
          day: +date.slice(8, 10), solved, fixed: fixedBy[date] || 0, today: date === today
        });
      }
      return out;
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
    /** 🔄 이 학생 기록 초기화 (선생님 PIN 확인 뒤) — 이 학생의 학습 기록만 지우고 이름·PIN·반은 유지
        채점·제출·도장·오답·밀린문제·프린트·미션·펫·코인·XP·출석 기록이 모두 처음 상태가 됩니다. */
    resetStudentRecords(classId, sid) {
      const s = this.student(classId, sid);
      if (!s) return null;
      const before = {
        coins: s.coins || 0, xp: (s.xp || 0) + (s.bonusXp || 0),
        pets: (s.pets || []).length, streak: s.streak || 0,
        carried: ((this.state.carried || {})[sid] || []).length
      };
      const st = this.state;
      const drop = obj => Object.keys(obj || {}).forEach(k => {
        const p = String(k).split('|');
        if (p[0] === classId && p[2] === sid) delete obj[k];
      });
      drop(st.grades); drop(st.submissions); drop(st.prints); drop(st.lateUploads);
      Object.keys(st.carryResolve || {}).forEach(k => { const p = String(k).split('|'); if (p[1] === sid) delete st.carryResolve[k]; });
      Object.keys(st.effort || {}).forEach(k => { if (String(k).split('|')[1] === sid) delete st.effort[k]; });
      st.carried[sid] = [];
      st.solvedCarried[sid] = [];
      st.monsters[sid] = [];
      st.history[sid] = [];
      if (st.activity) st.activity[sid] = {};
      if (st.missions) delete st.missions[sid];
      if (st.weekBonus) delete st.weekBonus[sid];
      if (st.petXp) delete st.petXp[sid];
      s.xp = 0; s.bonusXp = 0; s.coins = 0; s.streak = 0;
      s.pets = []; s.egg = null; s.purified = {}; s.titles = [];
      s.bag = { snack: 0, shield: 0, bomb: 0 };
      s.sick = false; s.bombGiven = 0;
      this.save();
      return { name: s.name, before };
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
      const old = this.state.lessons[classId];
      const newAssignment = !!(old && old.date && patch && patch.date && old.date !== patch.date);
      // 새 숙제로 넘어가면? 이전 숙제는 그 자리에서 마감되고 미푼 문제만 밀린문제로 (v0.9)
      if (newAssignment) {
        old.dueClosed = true;
        try { this.sweepDueOne(classId); } catch (e) { }
      }
      const l = this.state.lessons[classId] || (this.state.lessons[classId] = {});
      Object.assign(l, patch);
      if (newAssignment) { delete l.dueClosed; delete l.carriedFor; }
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
  /*  Code.gs 의 action 이름과 1:1로 맞춥니다 (아래 표가 곧 계약).
      bootstrap · seed · setMark · markAll · fillRest · excl · exclClear · mission · cleanup · setTag · submitPhoto · touchSubmission
      stamp · stampAll · resubmit · unlock · sick · profile · regenPin · pageProblem · lesson
      setDue · closeDue · print · printLastNo · saveProgress · resolveCarried · retryCarried
      buy · feed · growCompanion · rewardsOn · useClaim · galleryMode · lateUpload · submitYesterday
      moveStudent · retireStudent · restoreStudent · copyLesson · copyPrint · teacherStatus
      teacherSetup · teacherVerify · reset                                                  */
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
    save() { /* 서버가 진짜 저장소입니다 */ }
    session() { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch (e) { return null; } }
    setSession(s) { s ? localStorage.setItem(SESSION, JSON.stringify(s)) : localStorage.removeItem(SESSION); }

    /* 채점 */
    async setMark(c, s, key, mark, kind) { await this.call('setMark', { classId: c, studentId: s, key, mark, kind }); return this.markOf(c, s, key); }
    async markAllCorrect(c, s, kind) { const r = await this.call('markAll', { classId: c, studentId: s, kind }); return (r.count || 0) > 0; }
    async setCleanup(c, s, key, kind2, kind) { await this.call('cleanup', { classId: c, studentId: s, key, kind: kind2, source: kind }); return this.cleanupOf(c, s, key, kind); }
    async setTag(c, s, key, tag, kind) { await this.call('setTag', { classId: c, studentId: s, key, tag, kind }); return tag; }

    /* v1.0 — 미션 · 수업에서 푼 문제(제외) · 나머지 전부 ⭕ */
    async ensureMission(c, s) {
      const info = this.missionInfo(c, s);
      if (!info.done || info.rewarded) return null;
      const r = await this.call('mission', { classId: c, studentId: s });
      return r.result || null;
    }
    async setExcl(c, s, keys, kind, reason) { await this.call('excl', { classId: c, studentId: s, keys, kind, reason }); return true; }
    async clearExcl(c, s, kind, onlyReason) { await this.call('exclClear', { classId: c, studentId: s, kind, only: onlyReason || '' }); return true; }
    async fillRestCorrect(c, s, kind, bookName, keys) {
      const r = await this.call('fillRest', { classId: c, studentId: s, kind, keys: keys || [] });
      return { n: r.count || 0, keys: (r.filled || keys || []) };
    }
    async undoFill(c, s, keys, kind) {
      const r = await this.call('undoFill', { classId: c, studentId: s, kind, keys: keys || [] });
      return r.count || 0;
    }
    async markBookDone(c, s, kind) {
      const r = await this.call('bookDone', { classId: c, studentId: s, kind: kind || 'hw' });
      return { ok: true, already: !!r.already };
    }
    addPetXp() { return 0; }        // 서버(setMark·markAll)가 같이 넣습니다

    /* 제출·도장·사진 */
    async submitPhoto(c, s, dataUrl, kind) {
      const rw = this.previewReward(c, s, kind);          // 보상은 그 기기에서 계산해 서버에 같이 보냅니다
      const stu = this.student(c, s) || {};
      const patch = { coins: (stu.coins || 0) + rw.coins, xp: (stu.xp || 0) + rw.xp };
      const r = await this.call('submitPhoto', {
        classId: c, studentId: s, photo: dataUrl, kind, reward: rw, patch,
        verify: kind === 'print' ? { book: '오답프린트', page: '프린트' } : this.verifyTarget(c, s)
      });
      return Object.assign({}, r.result || {}, { photoId: r.photoId || null, sub: (r.result || {}).sub });
    }
    async touchSubmission(c, s, kind) { await this.call('touchSubmission', { classId: c, studentId: s, kind }); return true; }
    /** 임시 저장 — 사진 없이 채점만 남겨 둡니다(기한 전 진행 중) */
    async saveProgress(c, s, kind) { await this.call('saveProgress', { classId: c, studentId: s, kind }); return true; }
    photo(id) { return this.state.photos[id] || null; }
    putPhoto() { /* 운영 모드에서는 서버(드라이브)에 저장 */ }
    async deletePhoto(id) { await this.call('deletePhoto', { photoId: id }); return true; }
    async stamp(c, s, kind) { await this.call('stamp', { classId: c, studentId: s, kind }); return true; }
    async stampAllPending(c) { const r = await this.call('stampAll', { classId: c }); return { count: r.count || 0, killed: null }; }
    async requestResubmit(c, s, kind) { await this.call('resubmit', { classId: c, studentId: s, kind }); return true; }
    async unlockSubmission(c, s, kind) { await this.call('unlock', { classId: c, studentId: s, kind }); return true; }
    async submitYesterday(c, s, dataUrl, solved) { await this.call('submitYesterday', { classId: c, studentId: s, photo: dataUrl, solved }); return true; }

    /* 학생·반 */
    async toggleSick(c, s) { const r = await this.call('sick', { classId: c, studentId: s }); return r.sick; }
    async saveProfile(c, s, patch) { await this.call('profile', { classId: c, studentId: s, patch }); }
    async regenPin(c, s) { const r = await this.call('regenPin', { classId: c, studentId: s }); return r.pin; }
    async moveStudent(c, s, to) { await this.call('moveStudent', { classId: c, studentId: s, toClassId: to }); return true; }
    async retireStudent(c, s) { await this.call('retireStudent', { classId: c, studentId: s }); return true; }
    async restoreStudent(c, s) { await this.call('restoreStudent', { classId: c, studentId: s }); return true; }

    /* 숙제·쪽수표·프린트 */
    async setPageProblem(book, page, list) { await this.call('pageProblem', { book, page, problems: list }); }
    async saveLesson(c, patch) { await this.call('lesson', { classId: c, patch }); }
    async setDue(c, dueAt) { const r = await this.call('setDue', { classId: c, dueAt }); return r.due || null; }
    async closeDue(c) { const r = await this.call('closeDue', { classId: c }); return r.carried || 0; }
    async copyLesson(from, to, opts) { await this.call('copyLesson', { classId: from, toClassId: to, patch: opts || {} }); return true; }
    async copyPrint(c, fromSid, toSids) { const r = await this.call('copyPrint', { classId: c, studentId: fromSid, toSids }); return r.count || 0; }
    async setPrint(c, s, count) { await this.call('print', { classId: c, studentId: s, count }); return count; }
    async setPrintLastNo(c, s, n) { await this.call('printLastNo', { classId: c, studentId: s, lastNo: n }); return n; }

    /* 밀린문제·상점 */
    async resolveCarried(c, s, id, why) { return await this.call('resolveCarried', { classId: c, studentId: s, id, why }); }
    async retryCarried(c, s, id, tag) { return await this.call('retryCarried', { classId: c, studentId: s, id, tag }); }
    buy(c, s, itemId) { return this.call('buy', { classId: c, studentId: s, itemId }); }
    feed(c, s) { return this.call('feed', { classId: c, studentId: s }); }
    growCompanion(c, s, petId) { return this.call('growCompanion', { classId: c, studentId: s, petId }); }
    async setRewardsOn(on) { await this.call('rewardsOn', { on: !!on }); }
    async useClaim(id) { await this.call('useClaim', { id }); return true; }
    async setGalleryMode(mode) { await this.call('galleryMode', { mode }); }
    async lateUpload(c, s) { await this.call('lateUpload', { classId: c, studentId: s }); return true; }

    /* 선생님 PIN 서버 검증 (선택) */
    async teacherStatus() { const r = await this.call('teacherStatus'); return r; }
    async teacherSetup(pin) { return await this.call('teacherSetup', { pin }); }
    async teacherVerify(pin) { return await this.call('teacherVerify', { pin }); }

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
