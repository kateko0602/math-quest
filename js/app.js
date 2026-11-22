/* 숙제 대소동 v1.1 — 화면과 동선 (4단계: UI/UX 마감 · 실사용 피드백 12건 반영)
   ─────────────────────────────────────────────────────────
   4단계에서 달라진 것
     · 쪽수표 자동 갱신 · 채점 쪽수 글씨 크게 · ⭐ 질문 5개까지
     · 하단 고정 바(나머지 전부 ⭕ + 다음) · ⬆️ 맨 위로 · 안 사라지는 ↩️ 되돌리기 배너
     · 숙제 범위 [전체/유제만/홀수/짝수]를 선생님 화면으로 (학생은 [🏫 몇 번부터] 하나만)
     · 밀린문제 ❌ 이유 배지 · 앱 오류 비상 안내 · 선생님 [✅ 책으로 완료]
     · 전체 화면 축하 팝업 + 자기 칭찬 + 🔥 오늘의 열정 학생
     · 어머님 리포트(주 2회·월 1줄·학기 목록 없음·오답 비율 %) · 성장 그래프 · 학습맵
   ─────────────────────────────────────────────────────────────
   세계관: 〈숫자 왕국 구출 대작전〉 — 알은 하나, '펫 알'뿐
     · 못 고친 오답 → 다시 풀어 ⚔️ 해결하면 '펫 알 부화!' → 펫 합류
     · 상점의 펫 알도 간식으로 키워 부화 · 펫이 많을수록 보스 공격력 +
   아이 동선(딱 3단계): 숙제 → ① 채점(⭕/❌) → ② 정리·사진 → ③ 제출 완료
   · 하단 탭 3개: 🔥 숙제 | 🐾 내 도감 | 🏆 랭킹
   · 소리·로그아웃·이야기는 우측 상단 ⚙️ 설정 시트로
   · 선생님: 첫 접속 때 직접 정한 PIN(4~6자리 · 해시 저장 · 세션 12시간)으로 들어갑니다.
     '오늘 제출 확인 & 한꺼번에 도장' + 학생 목록, 나머지 도구는 ⚙️ 관리
*/
window.EMA = window.EMA || {};
(function () {
  const esc = EMA.ui.esc;
  const GAME = () => window.EMA_GAME || { pets: [], shop: [], bosses: [], titles: [], rarity: {}, dailyTitles: [], monsters: [], tags: [], story: {} };
  const STORY = () => GAME().story || {};
  const MIN = 3;
  const REUP_MS = 3600000;
  const STAR_MAX = 5;          // ⭐ 질문은 숙제 1건당 5개까지 (나머지는 선생님께 직접)
  let store = null;

  const view = {
    role: 'login',            // login | student | teacher
    step: 'class',            // class | student | pin | teacherPin | teacherSetup | teacherSetup2 | teacherRecover
    classId: null, studentId: null,
    pin: '', pinTarget: 'student',
    newPin1: '', recoveryCode: '',
    tab: 'home', homeTab: 'today', teacherTab: 'today',
    rankMode: 'first', rankScope: 'class',
    sheet: null,
    flow: null,               // null | grade | clean | done
    gradeSource: 'homework',  // homework | print
    gradeBook: null,
    gradeStartKey: null,      // 🏫 몇 번부터 숙제?
    undoFill: null,           // ✨ 나머지 전부 ⭕ 직후 { keys:[…], n } — [↩️ 되돌리기] 배너가 유지됩니다
    pending: { photo: null, avatar: null, nickname: '', yphoto: null, tempPhoto: null, tempTarget: null, reupload: false },
    pmBook: null, pmPage: null, pmInput: '', pmNewPage: '', pmList: null,
    carryWhy: null,
    carryMode: 'list',       // v1.2 — 밀린문제 [📋 목록으로 | 🎯 한 문제씩] (기본값 = 목록으로)
    carryOne: null,          // 🎯 한 문제씩 이번 판 대기열 { sid, ids:[…], idx }
    lessonEditBook: null, lessonEditPages: null, lessonEditInput: '', lessonEditDue: '', lessonEditMode: '',
    baBook: null, baPages: null,
    dashRange: 'month', dashOpen: {},
    moveSid: null, moveTo: null, copyTo: null, copyFrom: null, copyPrintSid: null,
    pinReveal: null,
    reportSid: null, reportRange: 'week', reportImg: null, reportImgName: '',
    petDetail: null, monsterDetail: null, printSid: null, printInput: '',
    stuResetSid: null,                                         // v1.2 — 학생 기록 초기화
    lastResult: null,
    bigPhotoSid: null, bigPhotoAt: '', bigPhotoFrom: '',
    tOpen: {}, stuOpen: {},
    scrollTarget: null,
    resetScroll: false
  };
  const MAX_TEACHER_PIN = 4;          // ★ v1.2 — 선생님 PIN도 학생과 똑같이 '딱 4자리'
  const MIN_TEACHER_PIN = 4;

  /* =========================================================
     초안 저장 — 누른 즉시 남겨 두고, 다시 열면 그 자리로
  ========================================================= */
  const DRAFT = 'ema.draft.v2';
  const DRAFT_PHOTO = 'ema.draftphoto.v2';
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT, JSON.stringify({
        flow: view.flow, tab: view.tab, homeTab: view.homeTab,
        gradeSource: view.gradeSource, gradeBook: view.gradeBook,
        classId: view.classId, studentId: view.studentId, at: Date.now()
      }));
      if (view.pending.photo) localStorage.setItem(DRAFT_PHOTO, view.pending.photo);
      else localStorage.removeItem(DRAFT_PHOTO);
    } catch (e) { }
  }
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { return null; }
  }
  function readDraftPhoto() {
    try { return localStorage.getItem(DRAFT_PHOTO) || null; } catch (e) { return null; }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT); localStorage.removeItem(DRAFT_PHOTO); } catch (e) { }
  }

  /* =========================================================
     공통 조각
  ========================================================= */
  function topbar(o) {
    return `<div class="topbar">
      ${o.back ? `<button class="icon-btn" data-act="${o.backAct || 'back'}" aria-label="뒤로">←</button>` : ''}
      <div class="tbx"><div class="ttl">${esc(o.title)}</div>${o.sub ? `<div class="sub">${esc(o.sub)}</div>` : ''}</div>
      <div class="grow"></div>${o.right || ''}
    </div>`;
  }
  function sfxBtn() {
    const on = EMA.sfx.on();
    return `<button class="icon-btn sfx ${on ? '' : 'off'}" data-act="toggleSound" aria-label="${on ? '소리 끄기' : '소리 켜기'}" title="${on ? '소리 끄기' : '소리 켜기'}">${on ? '🔊' : '🔇'}</button>`;
  }
  function gearBtn() {
    return `<button class="icon-btn gear" data-act="settings" aria-label="설정">⚙️</button>`;
  }
  function coinChip(cid, sid) {
    return `<button class="chip coin" data-act="openShop" aria-label="상점 열기">🪙 ${store.coins(cid, sid)}코인<i>상점</i></button>`;
  }

  /* =========================================================
     v2.0 — 세계관 그림
     · 몬스터 수학 아카데미 마스코트: 100% 직접 그린 SVG(저작권 걱정 없음)
     · 펠트/천 느낌은 feTurbulence 변위(보송보송한 가장자리)로 냅니다.
  ========================================================= */
  function mascotSvg() {
    return `<svg class="hero-mascot" viewBox="0 0 120 136" role="img" aria-label="몬스터 수학 아카데미 마스코트">
  <defs>
    <linearGradient id="mcFur" x1="0.2" y1="0.05" x2="0.62" y2="1">
      <stop offset="0" stop-color="#5AA0FF"/><stop offset="0.45" stop-color="#3B7DE8"/><stop offset="1" stop-color="#2358BE"/>
    </linearGradient>
    <radialGradient id="mcHi" cx="0.32" cy="0.16" r="0.62">
      <stop offset="0" stop-color="#DDEEFF" stop-opacity="0.62"/><stop offset="1" stop-color="#DDEEFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mcHorn" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#FFF3D6"/><stop offset="0.55" stop-color="#F7D489"/><stop offset="1" stop-color="#DBA046"/>
    </linearGradient>
    <linearGradient id="mcPen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#F2B233"/>
    </linearGradient>
    <filter id="mcFuzz" x="-25%" y="-25%" width="150%" height="150%">
      <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="11" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="mcEye" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="1" stdDeviation="0.8" flood-color="#0B2A63" flood-opacity="0.22"/>
    </filter>
  </defs>
  <g class="bob">
    <ellipse cx="60" cy="131" rx="30" ry="4.2" fill="#0B2A63" opacity="0.24"/>
    <path d="M26 52 C14 40 13 22 24 10 C30 23 37 36 48 46 Z" fill="url(#mcHorn)" stroke="#C08A33" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M94 52 C106 40 107 22 96 10 C90 23 83 36 72 46 Z" fill="url(#mcHorn)" stroke="#C08A33" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M60 15 C90 15 107 37 107 68 C107 99 86 121 60 121 C34 121 13 99 13 68 C13 37 30 15 60 15 Z" fill="#2A64C9" opacity="0.75" filter="url(#mcFuzz)"/>
    <path d="M60 18 C88 18 104 39 104 68 C104 97 84 118 60 118 C36 118 16 97 16 68 C16 39 32 18 60 18 Z" fill="url(#mcFur)" stroke="#1B4AA8" stroke-width="1.1" filter="url(#mcFuzz)"/>
    <path d="M60 18 C88 18 104 39 104 68 C104 97 84 118 60 118 C36 118 16 97 16 68 C16 39 32 18 60 18 Z" fill="url(#mcHi)"/>
    <ellipse cx="60" cy="94" rx="25" ry="20" fill="#CFE5FF" opacity="0.32"/>
    <g filter="url(#mcEye)">
      <ellipse cx="44" cy="62" rx="13.5" ry="14.5" fill="#FFFFFF"/>
      <ellipse cx="76" cy="62" rx="13.5" ry="14.5" fill="#FFFFFF"/>
    </g>
    <ellipse cx="45.6" cy="64" rx="7.2" ry="8.2" fill="#0F2544"/>
    <ellipse cx="77.6" cy="64" rx="7.2" ry="8.2" fill="#0F2544"/>
    <circle cx="48.2" cy="60.6" r="2.6" fill="#FFFFFF"/>
    <circle cx="80.2" cy="60.6" r="2.6" fill="#FFFFFF"/>
    <circle cx="43.6" cy="68" r="1.2" fill="#FFFFFF" opacity="0.85"/>
    <circle cx="75.6" cy="68" r="1.2" fill="#FFFFFF" opacity="0.85"/>
    <path d="M31 74 C35 72 39 72 42 74" stroke="#17427F" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.5"/>
    <path d="M78 74 C81 72 85 72 89 74" stroke="#17427F" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.5"/>
    <ellipse cx="29" cy="79" rx="6.6" ry="4" fill="#FF9E86" opacity="0.5"/>
    <ellipse cx="91" cy="79" rx="6.6" ry="4" fill="#FF9E86" opacity="0.5"/>
    <path d="M50 83 C54 90 66 90 70 83 C70 91 66 96 60 96 C54 96 50 91 50 83 Z" fill="#12305C"/>
    <path d="M54 86 L58 86 L58 90.6 Z" fill="#FFFFFF"/>
    <path d="M62 86 L66 86 L62 90.6 Z" fill="#FFFFFF"/>
    <g transform="rotate(9 22 100)">
      <path d="M27 92 C20 91 15 95 16 100 C17 105 23 106 28 103" fill="url(#mcFur)" stroke="#1B4AA8" stroke-width="1.1"/>
      <g transform="rotate(-26 24 103)">
        <rect x="6" y="99" width="30" height="8.6" rx="2.2" fill="url(#mcPen)" stroke="#C08A33" stroke-width="1"/>
        <path d="M36 99 L43 103.3 L36 107.6 Z" fill="#F8E7C4" stroke="#C08A33" stroke-width="1"/>
        <path d="M40.6 101.5 L43 103.3 L40.6 105.1 Z" fill="#334155"/>
        <rect x="6" y="99" width="3.6" height="8.6" rx="1.1" fill="#FF8E7A"/>
      </g>
    </g>
    <path d="M93 92 C100 90 105 94 104 99 C103 104 97 106 92 103" fill="url(#mcFur)" stroke="#1B4AA8" stroke-width="1.1"/>
    <circle cx="103" cy="93" r="4.4" fill="#4E93F2" stroke="#1B4AA8" stroke-width="1.1"/>
    <g fill="#FFE9A8">
      <path d="M15 30 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" opacity="0.95"/>
      <path d="M104 26 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z" opacity="0.75"/>
    </g>
  </g></svg>`;
  }

  /** 원형 진행 링 — 오늘의 학습맵·진행 중인 숙제에 */
  function ringSvg(pct, opt) {
    const o = opt || {};
    const size = o.size || 56, sw = o.sw || 6;
    const r = (size - sw) / 2, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const col = o.color || 'var(--cobalt)';
    return `<div class="ring ${o.cls || ''}" style="width:${size}px;height:${size}px" aria-hidden="true">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#E7EDF7" stroke-width="${sw}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}"
          stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p / 100)).toFixed(1)}"/>
      </svg>
      <div class="rc"><b>${o.text != null ? o.text : p + '%'}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>
    </div>`;
  }

  /** 홈 히어로 — 몬스터 아카데미 아치 창 + 이번 주 목표 */
  function heroBanner(cid, sid) {
    const m = store.missionInfo(cid, sid);
    const pct = Math.round(Math.min(1, m.weekDays / Math.max(1, m.weekNeed)) * 100);
    const dots = Array.from({ length: m.weekNeed }, (_, i) => `<i class="${i < m.weekDays ? 'on' : ''}"></i>`).join('');
    return `<div class="hero">
      <div class="hero-in">
        <div class="hero-tx">
          <span class="hero-kicker">🐾 몬스터 수학 아카데미</span>
          <div class="hero-title">오늘도 <em>한 걸음</em><br>더 나아가요 👊</div>
          <div class="hero-sub">못 고친 오답을 고치면 펫이 진화해요</div>
          <div class="hero-goal">
            <div class="gl"><span>이번 주 목표</span><span class="grow"></span><b>${m.weekDays}/${m.weekNeed}일</b><span class="pct">${pct}%</span></div>
            <div class="hero-track"><i style="width:${pct}%"></i></div>
            <div class="hero-dots">${dots}</div>
          </div>
        </div>
        <div class="hero-art"><div class="hero-arch"></div>${mascotSvg()}</div>
      </div>
    </div>`;
  }

  /** 펫 진화 카드 — 대표 펫(가장 자란 펫)의 단계·게이지 + 펫 알 진행 */
  function petEvo(cid, sid) {
    const pets = store.myPets(cid, sid);
    const egg = store.eggOf(cid, sid);
    const best = pets.slice().sort((a, b) => {
      const sa = store.petStageOf(a), sb = store.petStageOf(b);
      if (sb !== sa) return sb - sa;
      return Number(b.xp || b.lv || 0) - Number(a.xp || a.lv || 0);
    })[0];
    const eggLine = egg
      ? `<div class="pe-egg">
          <span class="eggwig" style="font-size:19px">🥚</span>
          <span class="grow"><b style="font-size:11px;color:#5B6B80">펫 알 ${egg.pct}%</b>
            <span class="ebar"><i style="width:${Math.min(100, egg.pct)}%"></i></span></span>
          <span class="go">간식 주기 →</span></div>`
      : pets.length ? '' : `<div class="pe-egg"><span style="font-size:19px">🥚</span><span class="grow"><b style="font-size:11px;color:#5B6B80">펫 알이 없어요</b><span class="ebar"><i style="width:0%"></i></span></span><span class="go">상점 60코인</span></div>`;

    if (!best) {
      return `<button class="petevo" data-act="openShop" aria-label="펫 알 키우기">
        <div class="pe-hd"><span class="t">🐾 내 펫 진화</span><span class="stg">1단계부터</span><span class="grow"></span><span class="more">펫 만나기 →</span></div>
        <div class="pe-main">
          <span class="petorb" style="filter:grayscale(.2)">🥚</span>
          <div class="pe-info">
            <div class="pe-nm">아직 펫이 없어요</div>
            <div class="pe-sub">오답을 고치거나 펫 알을 키우면 <b>펫이 태어나요</b></div>
          </div>
        </div>
        ${eggLine}
      </button>`;
    }

    const stage = store.petStageOf(best);
    const lab = store.petStageLabel(best);
    const next = store.petNextNeed(best);
    const def = store.petDef(best.id) || {};
    const rar = (GAME().rarity || {})[best.rarity || (def && def.rarity)] || {};
    const left = next.need == null ? 0 : Math.max(0, next.need - next.have);
    return `<button class="petevo" data-act="petDetail" data-id="${best.id}" aria-label="내 펫 진화 보기">
      <div class="pe-hd"><span class="t">🐾 내 펫 진화</span>
        <span class="stg">${lab.em} ${stage}단계 ${lab.name}</span><span class="grow"></span><span class="more">도감 →</span></div>
      <div class="pe-main">
        <span class="petorb s${stage}">${best.em || def.em || '🐾'}</span>
        <div class="pe-info">
          <div class="pe-nm">${esc(best.name || def.name || '내 펫')}${rar.label ? `<span class="rar">${rar.label}</span>` : ''}</div>
          <div class="pe-stage">
            <i class="${stage >= 1 ? 'on' : ''}">🐣 아기</i><i class="${stage >= 2 ? 'on s2' : ''}">🌱 성장</i><i class="${stage >= 3 ? 'on s3' : ''}">👑 완전체</i>
          </div>
          <div class="pe-xp"><i style="width:${next.pct}%"></i></div>
          <div class="pe-sub">${stage >= 3 ? '완성! 칭호를 받았어요 👑' : `다음 단계까지 <b>${left} XP</b> · 문제를 풀면 자라요`}</div>
        </div>
      </div>
      ${eggLine}
    </button>`;
  }

  /** 🏰 나의 숫자 왕국 — 12월 오픈 예고 (한 곳에만) */
  function kingdomCard(coins) {
    return `<button class="kingdom" data-act="kingdom" aria-label="나의 숫자 왕국 미리보기">
      <span class="kcast">🏰</span>
      <span class="ktx">
        <span class="kt">나의 숫자 왕국 <span class="soon">12월 오픈</span></span>
        <span class="ks">지금 모은 <b>${coins}코인</b>이 건축 재료가 돼요</span>
      </span>
      <span class="kg">›</span>
    </button>`;
  }

  function sheetKingdom() {
    const cid = view.classId, sid = view.studentId;
    const coins = store.coins(cid, sid);
    const lv = store.level(cid, sid);
    return sheetWrap('🏰 나의 숫자 왕국', `
      <div class="kdm">
        <div class="kart">🏰</div>
        <div class="kt">아직 공사 중이에요</div>
        <div class="ks">왕국 건설은 <b>12월에 열려요!</b><br>지금 모은 코인이 그대로 건축 재료가 돼요.<br>오늘 숙제하고 코인을 모아 두면<br>왕국이 더 크게 지어져요.</div>
        <div class="kpill">곧 열려요</div>
        <div class="kcoins">🪙 내 코인 <b>${coins}</b>개 · Lv.${lv.lv}</div>
        <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="closeSheet">알겠어요!</button>
      </div>
    `);
  }
  function nav(items, active, act) {
    const kind = act || 'tab';
    return `<div class="nav ${items.length === 5 ? 'nav5' : ''}" style="grid-template-columns:repeat(${items.length},1fr)">${items.map(it =>
      `<button class="nav-item ${it.id === active ? 'on' : ''}" data-act="${kind}" ${kind === 'teacherTab' ? 'data-t="' + it.id + '"' : 'data-tab="' + it.id + '"'} aria-label="${it.label}">
        <span class="i">${it.em}</span>${it.label}</button>`).join('')}</div>`;
  }
  function avatarHtml(stu, size) {
    const sz = size || 36;
    return `<span class="rank-av" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * .52)}px">${esc(stu.avatar || '🙂')}</span>`;
  }
  function sheetWrap(title, inner, opt) {
    return `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="backdrop" data-act="closeSheet"></div>
      <div class="body ${opt && opt.wide ? 'wide' : ''} ${opt && opt.full ? 'full' : ''}">
        <div class="sheet-hd"><h3>${title}</h3>
          <button class="sheet-x" data-act="closeSheet" aria-label="닫기">✕</button></div>
        <div class="sheet-scroll">${inner}</div>
      </div>
    </div>`;
  }
  function stepper(now) {
    const steps = [['1', '채점'], ['2', '정리·사진'], ['3', '완료']];
    return `<div class="stepper">${steps.map((s, i) => {
      const n = i + 1;
      return `<div class="stp ${n === now ? 'now' : ''} ${n < now ? 'past' : ''}">
        <span class="no">${n < now ? '✓' : s[0]}</span><span class="lb">${s[1]}</span></div>
        ${n < 3 ? '<div class="bar"></div>' : ''}`;
    }).join('')}</div>`;
  }
  function countTiles(tiles, g) {
    let c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0, c6 = 0, starO = 0;
    const excl = (g && g.excl) || {};
    tiles.forEach(t => {
      const m = g.marks[t.key];
      if (!m && excl[t.key]) { c6++; return; }      // 🏫 수업에서 푼 문제 / 안 낸 문제
      if (m === 'o') { c1++; if (g.cleanup[t.key] === 'star') starO++; }
      else if (m === 'x') {
        const cl = g.cleanup[t.key];
        if (cl === 'fixed') c3++; else if (cl === 'star') c4++; else c2++;
      } else c5++;
    });
    return {
      c1, c2, c3, c4, c5, c6, starO,
      marked: c1 + c2 + c3 + c4, total: c1 + c2 + c3 + c4 + c5, all: tiles.length
    };
  }
  function oxSum(cnt) {
    const pct = cnt.total ? Math.round(cnt.marked / cnt.total * 100) : 0;
    return `<div class="oxsum">
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <div class="nums">
        <span class="s-o">⭕ ${cnt.c1}</span>
        <span class="s-x">❌ ${cnt.c2 + cnt.c4}</span>
        <span class="s-f">⚔️ ${cnt.c3}</span>
        <span class="s-none">아직 ${cnt.c5}</span>
        ${cnt.c6 ? `<span class="s-cls">🏫 ${cnt.c6}</span>` : ''}
      </div>
    </div>`;
  }
  /** 문제 번호에서 숫자만 — '1-1' → 1 (홀/짝 판정) */
  function tileNo(t) {
    const m = String(t && t.num != null ? t.num : '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  /** 대표문제 = '-1' 없는 기본 번호(1, 2, 3 …). 확인1·확인2 같은 개념확인은 대표가 아닙니다 */
  function isRepTile(t) {
    return /^\d+$/.test(String(t && t.num != null ? t.num : '').trim());
  }
  function parityOf(t) { const n = tileNo(t); return n == null ? '' : (n % 2 ? 'odd' : 'even'); }
  /** [8,9,10,12] → '8-10, 12' (칸 입력창에 되돌려 보여 줄 때) */
  function pagesText(list) {
    const ps = (list || []).map(Number).filter(n => n > 0).sort((a, b) => a - b);
    if (!ps.length) return '';
    const out = [];
    let a = ps[0], b = ps[0];
    for (let i = 1; i < ps.length; i++) {
      if (ps[i] === b + 1) { b = ps[i]; continue; }
      out.push(a === b ? String(a) : a + '-' + b);
      a = b = ps[i];
    }
    out.push(a === b ? String(a) : a + '-' + b);
    return out.join(', ');
  }
  /** '1~14번, 15~28번' · '2,4,5,6' · '2，4' → ['2','4','5','6'] — 하위 번호(1-1)는 그대로 */
  function rangeList(text) {
    if (EMA.util && EMA.util.parseProblemNos) return EMA.util.parseProblemNos(text);
    return [];
  }
  /** 기한이 지나 이월된 문제 — '제출 기한이 1일 지났어요' */
  function overdueText(m) {
    if (!m || !m.overdue || !m.dueAt) return '';
    const dt = EMA.util.parseDueAt(m.dueAt);
    if (!dt) return '';
    const ms = Date.now() - dt.getTime();
    return ms > 0 ? ' · 제출 기한이 ' + EMA.util.spanText(ms) + ' 지났어요' : '';
  }
  /** 🎯 미션·주간·복귀 보상 알림 — 하루 한 번, 과하지 않게 */
  function missionToast(r) {
    if (!r || !r.awarded) return;
    const bits = ['오늘 미션 +' + r.mission];
    if (r.comeback) bits.push('복귀 응원 +' + r.comeback);
    if (r.weekly) bits.push('주간 목표 +' + r.weekly);
    EMA.ui.sound('coin');
    EMA.ui.toast('🎯 ' + bits.join(' · ') + '코인!', 3400);
    if (r.weekly || r.comeback) {
      if (r.weekly) {
        bigCeleb({ kind: 'title', em: '🏅', title: '주간 목표 달성!', sub: '이번 주 ' + r.weekDays + '일 미션 완료 · +' + r.coins + '코인' });
      } else {
        EMA.ui.fx.celebrate({
          kind: 'title', em: '🌈',
          title: '다시 왔구나!',
          sub: '이틀 쉬었지만 다시 시작했어요 · +' + r.coins + '코인',
          ms: 2200
        });
        EMA.ui.fx.confetti(60);
      }
    }
  }
  /** 오늘 미션 한 줄 — ③ 제출 완료 화면용 */
  function missionLine(cid, sid) {
    const m = store.missionInfo(cid, sid);
    if (m.done) return `<b>완료</b> · 이번 주 ${m.weekDays}/${m.weekNeed}일${m.weekRewarded ? ' 🏅' : ''}`;
    return `${m.count}/${m.need} · ${m.left}문제 더 풀면 +${m.coins}코인`;
  }
  /** 홈의 미션 카드 — 오늘 미션 3문제 · 이번 주 5일 · 복귀 응원 */
  function missionCard(cid, sid) {
    const m = store.missionInfo(cid, sid);
    const dots = (n, total, on) => Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on ' + (on || '') : ''}"></i>`).join('');
    return `<div class="card tight mission ${m.done ? 'done' : ''}">
      <div class="mline">
        <span class="mt">${m.done ? '✅ 오늘 미션 완료' : '🎯 오늘 미션'}</span>
        <span class="mdots inline">${dots(Math.min(m.count, m.need), m.need, 'big')}</span>
        <span class="mnum">${Math.min(m.count, m.need)}/${m.need}</span>
        <span class="grow"></span>
        <span class="week">이번 주 <b>${m.weekDays}</b>/${m.weekNeed}일 ${m.weekRewarded ? '🏅' : '+30'}</span>
      </div>
      <div class="mline sub">
        <span>${m.done ? (m.scored ? '+' + m.scored + '코인 받았어요' : '3문제 채웠어요') : `${m.left}문제 더 풀면 +${m.coins}코인`}</span>
        <span class="grow"></span>
        <span class="mdots wk">${dots(m.weekDays, m.weekNeed)}</span>
      </div>
      ${m.comeback ? `<div class="mcome">🌈 이틀 쉬었어요 · 3문제 풀면 <b>+${m.comebackCoins}코인</b> 응원 보너스!</div>` : ''}
    </div>`;
  }
  /** 🗺️ 오늘의 학습맵 — 오늘 숙제한 단원을 막대 하나로 가볍게 (과하지 않게) */
  function learningMap(cid, sid) {
    const bs = store.books(cid);
    if (!bs.length) return '';
    const g = store.gradeOf(cid, sid, 'hw');
    /* ★ v1.2 — 교재의 모든 단원을 훑지 않고, '오늘 실제 숙제 타일'이 있는 단원만 그립니다.
       (예전엔 쪽수표 단원을 전부 돌며 이름으로 맞춰 1·2단원이 같이 뜨는 경우가 있었어요) */
    const map = {};
    bs.forEach(b => {
      store.tilesOf(b.book, b.pages, b.mode).forEach(t => {
        if (t.missing || t.num == null) return;
        const ui = store.unitInfoOf(t.book, t.page);
        if (!ui || !ui.이름) return;
        const row = map[ui.이름] || (map[ui.이름] = { u: ui.no, name: ui.이름, done: 0, total: 0 });
        row.total++;
        if (g.marks[t.key]) row.done++;
      });
    });
    const rows = Object.values(map)
      .filter(r => r.total > 0)
      .sort((a, b) => String(a.u).localeCompare(String(b.u), 'ko', { numeric: true }));
    if (!rows.length) return '';
    /* ★ v2.0 — 전체 진행을 원형 링으로 한눈에 (줄은 그대로) */
    const done = rows.reduce((n, r) => n + r.done, 0);
    const total = rows.reduce((n, r) => n + r.total, 0);
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div class="card tight mapcard">
      <div class="card-hd"><span class="t">🗺️ 오늘의 학습맵</span><span class="grow"></span><span class="hint">${done >= total && total ? '오늘 몫 완료! 🎉' : '채점하면 채워져요'}</span></div>
      <div class="maphead">
        ${ringSvg(pct, { size: 58, sw: 6, text: done + '/' + total, sub: '문제' })}
        <div class="mtx"><b>${rows.length}단원 · ${total}문제</b><span>${rows.map(x => x.u + '단원').join(' · ')} · 링이 다 차면 오늘 몫 완료!</span></div>
      </div>
      ${rows.map(x => `<div class="maprow ${x.done >= x.total ? 'done' : ''}">
        <span class="mn">${x.u}단원 <small>${esc(x.name)}</small></span>
        <span class="mbar"><i style="width:${Math.round(x.done / x.total * 100)}%"></i></span>
        <span class="mv">${x.done >= x.total ? '✓' : x.done + '/' + x.total}</span>
      </div>`).join('')}
    </div>`;
  }

  function todayTitle(cid, sid) {
    const st = store.stats(cid, sid);
    if (st.c3 >= 2) return '오답 사냥꾼 ⚔️';
    if (st.c1 >= 10) return '암산 폭주족 🏍️';
    if (st.c5 > st.c1) return '내일의 나에게 맡긴 자 🍀';
    const list = GAME().dailyTitles || ['오늘의 수학 용사 🦸'];
    return list[(new Date(store.state.today + 'T12:00:00').getDate()) % list.length];
  }
  function eggStrip(cid, sid) {
    const egg = store.eggOf(cid, sid);
    const pets = store.myPets(cid, sid);
    if (!egg) {
      return `<button class="eggstrip flat" data-act="openShop">
        <span class="em">🥚</span>
        <span class="grow"><b>펫 알이 없어요</b></span>
        <span class="go">상점 60코인</span></button>`;
    }
    return `<button class="eggstrip" data-act="openShop">
      <span class="em eggwig">🥚</span>
      <span class="grow"><b>펫 알 ${egg.pct}%</b>
        <span class="lvlbar"><i style="width:${egg.pct}%"></i></span></span>
      <span class="go">간식 주기 →</span></button>`;
  }
  /** 상점 버튼 — 상태(코인 부족·이미 키우는 중·알 없음)를 문구로 분명히 */
  function shopBtn(item, coins, s) {
    const egg = s.egg, pets = (s.pets || []);
    let label = item.price + '코인', dis = coins < item.price;
    if (item.kind === 'egg' && egg) { label = '키우는 중'; dis = true; }
    else if (item.kind === 'snack' && !egg && !pets.length) { label = '펫 알 먼저'; dis = true; }
    else if (coins < item.price) { label = (item.price - coins) + '코인 더'; }
    else if (item.kind === 'snack' && !egg) { label = '펫 키우기 ' + item.price; }
    if (item.kind === 'coupon') label = item.price + '코인';
    return `<button class="btn ${dis ? 'btn-ghost' : 'btn-primary'} btn-sm btn-block" data-act="buy" data-id="${item.id}" ${dis ? 'disabled' : ''}>${label}</button>`;
  }

  function storySheet() {
    const st = STORY();
    const lines = st.lines || [];
    const chapters = st.chapters || [];
    return sheetWrap('📖 ' + (st.title || '숫자 왕국 구출 대작전'), `
      <div class="storybox">
        <div class="s-em">🌑</div>
        ${lines.map(l => `<p class="s-line">${esc(l)}</p>`).join('')}
      </div>
      ${chapters.length ? `<div class="sect-t" style="margin-top:14px"><span>보스 스토리</span><span class="grow"></span><span class="hint">4장</span></div>
      <div class="chapters">
        ${chapters.map((ch, i) => `<div class="chap">
          <span class="ch-no">${i + 1}</span>
          <span class="ch-em">${ch.em}</span>
          <span class="grow"><b>${esc(ch.t)}</b><small>${esc(ch.d)}</small></span>
        </div>`).join('')}
      </div>` : ''}
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="openDex">내 도감 보기 →</button>
    `);
  }

  /* ⚙️ 설정 시트 — 소리·이야기·로그아웃은 전부 여기로 */
  function sheetSettings() {
    const cid = view.classId, sid = view.studentId;
    const me = sid ? store.student(cid, sid) : null;
    const on = EMA.sfx.on();
    return sheetWrap('⚙️ 설정', `
      ${me ? `<div class="setrow" data-act="editProfile">
        <span class="se">${esc(me.avatar || '🙂')}</span>
        <span class="st">${esc(me.nickname || me.name)}</span>
        <span class="sv">캐릭터 · 닉네임</span><span class="chev">›</span></div>` : ''}
      <button class="setrow" data-act="toggleSound">
        <span class="se">${on ? '🔊' : '🔇'}</span><span class="st">소리</span>
        <span class="toggle ${on ? 'on' : ''}"><i></i><b>${on ? '켜짐' : '꺼짐'}</b></span></button>
      <div class="hint" style="margin:-2px 6px 4px">아이폰은 옆면 무음 모드를 풀어야 소리가 나요</div>
      ${me ? `<button class="setrow" data-act="openPinChange"><span class="se">🔑</span><span class="st">PIN 바꾸기</span><span class="chev">›</span></button>` : ''}
      <button class="setrow" data-act="openStory"><span class="se">📖</span><span class="st">이야기 보기</span><span class="chev">›</span></button>
      <button class="setrow" data-act="appHelp"><span class="se">❓</span><span class="st">앱이 이상해요</span><span class="sv">비상 안내</span><span class="chev">›</span></button>
      <div class="sethd">선생님</div>
      <button class="setrow" data-act="teacherEntry"><span class="se">👩‍🏫</span><span class="st">선생님 모드</span><span class="chev">›</span></button>
      <div class="sethd">계정</div>
      <button class="setrow" data-act="logout"><span class="se">↩️</span><span class="st">로그아웃</span><span class="chev">›</span></button>
      <button class="setrow danger" data-act="resetDemo"><span class="se">🧹</span><span class="st">연습 데이터 초기화</span></button>
      <div class="hint wrap" style="margin:6px 6px 0">초기화하면 지금 데이터를 먼저 이 기기에 백업해 두고, 이 화면에서만 새로 시작해요.</div>
      <div class="hint center" style="margin-top:12px">숙제 대소동 v1.1 · 숫자 왕국 구출 대작전 ${demoChip()}</div>
    `);
  }

  /** ❓ 앱이 이상해요 — 앱이 멈춰도 숙제는 계속할 수 있다는 안내 (학생·어머님 모두 읽을 수 있게 쉬운 말) */
  function sheetAppHelp() {
    return sheetWrap('❓ 앱이 이상해요', `
      <div class="helpbox">
        <div class="hb-em">😌</div>
        <div class="hb-t">당황하지 않아도 돼요!</div>
        <div class="hb-l">앱이 멈추거나 안 열리면 <b>책에 직접</b> 채점하고 오답을 고친 뒤,<br>선생님께 그 책을 보여 주세요. <b>그걸로 숙제 완료</b>예요.</div>
      </div>
      <div class="card tight" style="margin-top:12px">
        <div class="hv"><span class="n">1</span><div><b>책에 ⭕·❌ 직접 표시</b><small>앱은 잠시 안 써도 괜찮아요</small></div></div>
        <div class="hv"><span class="n">2</span><div><b>틀린 문제는 책에 다시 풀기</b><small>고친 것까지 보여 주면 더 좋아요</small></div></div>
        <div class="hv"><span class="n">3</span><div><b>선생님께 책을 보여 주기</b><small>선생님이 [✅ 책으로 완료]로 처리해 주세요</small></div></div>
      </div>
      <div class="hint wrap" style="margin-top:10px">폰을 바꾸거나 앱을 지우기 전에도 선생님께 미리 말씀해 주세요. 기록은 이 기기에 저장되어 있어요.</div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="closeSheet">확인했어요</button>
    `);
  }

  /** 비상 복구 키 — 처음 설정할 때 딱 한 번 보여 줍니다 */
  function sheetRecovery() {
    const code = view.recoveryCode || '';
    return sheetWrap('🔑 비상 복구 키', `
      <div class="sub">PIN을 잊었을 때 쓰는 <b>한 번만 보여 주는 키</b>예요. 지금 적어 두세요.</div>
      <div class="recovery-code" id="recoveryCode">${esc(code)}</div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="copyRecovery">📋 복구 키 복사</button>
      <div class="hint wrap" style="margin-top:12px;white-space:normal">· 이 화면을 닫으면 다시 볼 수 없어요.<br>· PIN을 잊으면 첫 화면 → [선생님 모드] → [PIN을 잊었어요]에서 이 키로 다시 정할 수 있어요.<br>· 이 기기(브라우저)에만 저장되니, 기록을 지우거나 폰을 바꾸면 새로 정해야 해요.</div>
      <button class="btn btn-ghost btn-block" style="margin-top:10px" data-act="closeRecovery">적어 두었어요</button>
    `);
  }

  /* =========================================================
     로그인
  ========================================================= */
  function demoChip() {
    const d = store.state && store.state.meta && store.state.meta.demo;
    return d ? '<span class="pill warn">연습용 예시 데이터</span>' : '';
  }
  function pinDotsHtml(max) {
    return `<div class="pin-dots">${Array.from({ length: max }).map((_, i) => `<div class="pin-dot ${view.pin.length > i ? 'on' : ''}"></div>`).join('')}</div>`;
  }
  function keypadHtml() {
    return `<div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-act="pinKey" data-k="${n}">${n}</button>`).join('')}
      <button class="key fn" data-act="pinBack">지우기</button>
      <button class="key" data-act="pinKey" data-k="0">0</button>
      <button class="key fn" data-act="pinDel">⌫</button>
    </div>`;
  }

  function renderLogin() {
    if (view.step === 'teacherSetup' || view.step === 'teacherSetup2') {
      const second = view.step === 'teacherSetup2';
      return `<div class="screen no-nav login">
        ${topbar({ title: second ? '한 번 더 확인' : '선생님 PIN 만들기', sub: second ? '같은 번호를 한 번 더' : '4자리 숫자', back: true })}
        <div class="step" style="margin-top:0">
          <div class="step-t">${second ? '2단계 · 한 번 더 눌러 주세요' : '1단계 · 새 PIN을 정해요'}</div>
          ${pinDotsHtml(MAX_TEACHER_PIN)}
          <div class="hint center" style="margin:0 0 12px">${second ? '앞에서 정한 PIN과 같아야 해요' : (view.pinLegacy ? '<b>예전 PIN은 5~6자리였어요. 이제 4자리로 새로 정해 주세요.</b>' : 'PIN 원문은 저장하지 않고 암호(해시)로만 이 기기에 남아요')}</div>
          ${keypadHtml()}
          <button class="btn btn-primary btn-block btn-lg" style="margin-top:12px" data-act="${second ? 'confirmTeacherSetup2' : 'confirmTeacherSetup1'}" ${view.pin.length !== 4 ? 'disabled' : ''}>${second ? '이 PIN으로 시작하기' : '다음'}</button>
        </div>
        ${sheetHtml()}
      </div>`;
    }
    if (view.step === 'teacherRecover') {
      return `<div class="screen no-nav login">
        ${topbar({ title: '복구 키로 다시 설정', sub: '선생님 PIN 분실', back: true })}
        <div class="step" style="margin-top:0">
          <div class="step-t">1단계 · 비상 복구 키를 넣어 주세요</div>
          <input id="recoverInput" class="tinput" placeholder="예: K7FD-2MQD" autocomplete="off" autocapitalize="characters" style="text-transform:uppercase">
          <div class="step-t" style="margin-top:20px">2단계 · 새 PIN (4자리)</div>
          <input id="recoverPin" class="tinput pininput" inputmode="numeric" maxlength="4" placeholder="새 PIN 4자리">
          <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="teacherRecoverSave">이 PIN으로 바꾸기</button>
          <div class="hint center" style="margin-top:10px">바꾸면 새 복구 키가 나옵니다. 예전 키는 쓸 수 없어요.</div>
        </div>
        ${sheetHtml()}
      </div>`;
    }
    if (view.step === 'teacherPin') {
      return `<div class="screen no-nav login">
        ${topbar({ title: '선생님 PIN', sub: '4자리 숫자', back: true })}
        <div class="step" style="margin-top:0">
          <div class="step-t">선생님 PIN을 눌러 주세요</div>
          ${pinDotsHtml(MAX_TEACHER_PIN)}
          ${keypadHtml()}
          <button class="btn btn-primary btn-block btn-lg" style="margin-top:12px" data-act="teacherPinOk" ${view.pin.length !== 4 ? 'disabled' : ''}>확인</button>
          <button class="btn btn-ghost btn-block btn-sm" style="margin-top:10px" data-act="teacherRecoverOpen">PIN을 잊었어요 · 복구 키로 다시 설정</button>
        </div>
        ${sheetHtml()}
      </div>`;
    }
    if (view.step === 'class') {
      const classes = store.classes();
      const st = STORY();
      return `<div class="screen no-nav login">
        <div class="logo">🎮</div>
        <h1>숙제 대소동</h1>
        <div class="tagline"><b>${esc(st.title || '숫자 왕국 구출 대작전')}</b><br>못 고친 오답을 고치면 펫이 나와요!</div>
        <div class="step">
          <div class="step-t">1단계 · 우리 반을 골라요</div>
          ${classes.map(c => `
            <button class="class-card ${c.active ? 'on' : 'off'}" ${c.active ? `data-act="class" data-id="${c.id}"` : 'disabled'}>
              <span class="em">${c.emoji || '🏫'}</span>
              <span class="grow">
                <span class="nm">${esc(c.name)}</span>
                <span class="mt">${esc(c.semester)} 과정 · ${esc(c.days)} ${esc(c.time)}</span>
              </span>
              ${c.active ? (c.localOnly ? '<span class="pill ok">내 공부방</span>' : '<span class="pill ok">시범 반</span>') : '<span class="pill">준비중</span>'}
            </button>`).join('')}
        </div>
        <div class="grow"></div>
        <button class="btn btn-ghost btn-block" data-act="openStory">📖 이야기 보기</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="teacherEntry">👩‍🏫 선생님이세요? 선생님 모드</button>
        <div class="pin-hint">학생 PIN은 선생님께 물어보세요 · 내 PIN은 ⚙️ 설정에서 바꿀 수 있어요</div>
        <div class="verline">v2.0 ${demoChip()}</div>
      </div>
      ${sheetHtml()}`;
    }
    if (view.step === 'student') {
      const c = store.getClass(view.classId);
      return `<div class="screen no-nav login">
        ${topbar({ title: '누구세요?', sub: c.name, back: true })}
        <div class="step" style="margin-top:6px">
          <div class="step-t">2단계 · 내 이름을 골라요</div>
          <div class="student-grid">
            ${store.activeStudents(c.id).map(s => `
              <button class="student-btn" data-act="pickStudent" data-id="${s.id}">
                <span class="av">${esc(s.avatar || '🙂')}</span>
                <span class="nm">${esc(s.name)}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="grow"></div>
        <div class="pin-hint">명단은 선생님이 관리해요. 이름이 없으면 선생님께 말해 주세요.</div>
      </div>
      ${sheetHtml()}`;
    }
    const who = (store.student(view.classId, view.studentId) || {}).name;
    return `<div class="screen no-nav login">
      ${topbar({ title: '비밀번호 4자리', sub: who, back: true })}
      <div class="step" style="margin-top:0">
        <div class="step-t">3단계 · 내 PIN</div>
        ${pinDotsHtml(4)}
        ${keypadHtml()}
        <div class="pin-hint">PIN을 잊으면 선생님이 1초에 초기화해 줄 수 있어요.</div>
      </div>
      ${sheetHtml()}
    </div>`;
  }

  /* =========================================================
     학생 — 홈
  ========================================================= */
  function homeTabs(cid, sid) {
    const tabs = [{ id: 'today', label: '오늘 숙제' }];
    if (store.hasPrint(cid, sid)) tabs.push({ id: 'print', label: '오답프린트' });
    const n = store.carried(cid, sid).length;
    if (n) tabs.push({ id: 'carry', label: `밀린문제 ${n}` });
    if (!tabs.find(t => t.id === view.homeTab)) view.homeTab = 'today';
    if (tabs.length === 1) return '';
    return `<div class="htabs" style="--n:${tabs.length}">
      ${tabs.map(t => `<button class="htab ${view.homeTab === t.id ? 'on' : ''}" data-act="homeTab" data-t="${t.id}">${t.label}</button>`).join('')}
    </div>`;
  }

  function renderStudentHome() {
    const cid = view.classId, sid = view.studentId;
    const c = store.getClass(cid), me = store.student(cid, sid);
    const lv = store.level(cid, sid);
    const st = store.stats(cid, sid);
    const streak = store.streak(cid, sid);
    const sub = store.submission(cid, sid);

    let body = '';
    if (view.homeTab === 'print') body = homePrint(cid, sid);
    else if (view.homeTab === 'carry') body = homeCarry(cid, sid);
    else body = homeToday(cid, sid, c, lv, st, streak, sub);

    return `<div class="screen">
      ${topbar({
        title: '숙제',
        sub: `${c.name} · ${EMA.ui.kdate(store.state.today)} ${EMA.ui.kdow(store.state.today)}`,
        right: `${coinChip(cid, sid)}${gearBtn()}`
      })}
      <div class="hello">
        <div class="who"><span class="hi">안녕하세요!</span> ${esc(me.nickname || me.name)} <span class="lv">Lv.${lv.lv}</span></div>
        <div class="chips">
          <span class="chip streak">🔥 ${streak}일</span>
          <span class="chip xp">✨ ${st.xp}</span>
        </div>
      </div>
      ${homeTabs(cid, sid)}
      ${body}
      ${nav([
        { id: 'home', em: '🔥', label: '숙제' },
        { id: 'record', em: '🐾', label: '내 도감' },
        { id: 'rank', em: '🏆', label: '랭킹' }
      ], view.tab)}
      <input type="file" class="photo-input" data-target="clean" accept="image/*" aria-hidden="true">
      ${sheetHtml()}
    </div>`;
  }

  /** 홈 카드 `진도`·`숙제` 줄 — 바로 아래 책 아이콘 줄에 이미 책 이름이 있어서,
      맨 앞에 똑같이 반복되는 책 이름만 화면 표시에서 떼어 냅니다.
      (저장된 lesson/homework 원본은 건드리지 않고, 한 줄에 책이 2권 이상 섞여
       어느 책 쪽수인지 구분이 필요한 숙제는 그대로 둡니다.) */
  function stripBookLead(text, books) {
    let t = String(text == null ? '' : text).trim();
    if (!t) return t;
    const names = (books || [])
      .map(b => String((b && b.book) || '').trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (!names.length) return t;
    if (names.filter(n => t.indexOf(n) >= 0).length > 1) return t;   // 책 2권 이상 — 구분 유지
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of names) {
        if (t.indexOf(n) !== 0) continue;
        const rest = t.slice(n.length).replace(/^\s*(?:[:：·\-–—|,]\s*)?/, '').trim();
        if (rest) { t = rest; changed = true; break; }
      }
    }
    return t;
  }

  function homeToday(cid, sid, c, lv, st, streak, sub) {
    const l = store.lesson(cid);
    const bs = store.books(cid);
    const tiles = store.tiles(cid);
    const boss = store.boss(cid);
    const mine = store.myDamage(cid, sid);
    const carried = store.carried(cid, sid);
    const missingY = store.yesterdayFlameMissing(cid, sid);
    const timing = store.timing(cid);
    const due = store.dueInfo(cid);
    const prog = store.progressInfo(cid, sid);

    const lessonHtml = l ? `
      <div class="card lesson-card">
        <div class="ln"><div class="k">진도</div><div class="v">${esc(stripBookLead(l.lesson, bs))}</div></div>
        <div class="ln"><div class="k">숙제</div><div class="v">${esc(stripBookLead(l.homework, bs))}</div></div>
        <div class="booklist">
          ${bs.map(b => {
            const t = store.tiles(cid, b.book);
            return `<div class="bookrow"><span class="be">${b.book.indexOf('응용') >= 0 ? '📙' : '📘'}</span>
              <span class="bn">${esc(b.book)}</span>
              <span class="bp">${pagesText(b.pages)}쪽 · ${t.length}문제</span></div>`;
          }).join('')}
        </div>
        ${timing.kind === 'early' ? '<div class="timing early">⚡ 얼리버드 · 코인 2배</div>'
          : timing.kind === 'shield' ? '<div class="timing shield">🛡️ 수업 당일 · 보스·코인 50%</div>' : ''}
      </div>` : `<div class="card"><div class="empty">📭 오늘은 숙제가 없어요</div></div>`;

    /** 📘 진행 중 / ⏰ 기한 지남 — 남은 시간·지난 시간과 푼 문제 수 */
    const dueCard = (l && due.has) ? `
      <div class="card tight duecard ${due.passed ? 'late' : 'open'}">
        <div class="card-hd"><span class="t">${due.passed ? '⏰ 기한 지난 숙제' : '📘 진행 중인 숙제'}</span><span class="grow"></span>
          <span class="hint">${prog.hwMarked}/${prog.hwTotal}문제</span></div>
        <div class="dueflex">
          <div class="duetx">
            <div class="dueline">${esc(due.label)}까지</div>
            <div class="duesub ${due.passed ? 'late' : 'left'}">${due.passed ? esc(due.lateText) : esc(due.leftText)}</div>
          </div>
          ${ringSvg(prog.pct, { size: 62, sw: 6, text: prog.pct + '%', sub: '진행', cls: due.passed ? 'late' : '' })}
        </div>
        <div class="pbar"><i style="width:${prog.pct}%"></i></div>
        <div class="hint" style="margin-top:6px">${due.passed ? '기한 전에 못 푼 문제는 ⚔️ 밀린문제로 넘어갔어요' : '기한 전에는 못 푼 문제가 밀린문제로 넘어가지 않아요'}</div>
      </div>` : '';

    const hasHw = tiles.length > 0;
    const hasHwText = !!(l && String(l.homework || '').trim());
    const up = store.reuploadInfo(cid, sid, 'hw');
    let cta, ctaAct = 'startGrade';
    if (!hasHw) {
      cta = hasHwText ? '📘 숙제 쪽수를 선생님이 정하면 채점할 수 있어요' : '📭 오늘은 숙제가 없어요';
      ctaAct = 'noHomework';
    } else if (sub && sub.stampAt) {
      cta = '✅ 도장 완료 · 채점 보기';
    } else if (sub) {
      cta = st.marked ? '📸 제출 완료 · 다시 보기' : '📝 숙제 채점 시작';
    } else if (st.marked) {
      cta = `📝 채점 이어서 (⭕${st.c1} ❌${st.c2 + st.c4})`;
    } else {
      cta = '📝 숙제 채점 시작';
    }

    return `
      ${heroBanner(cid, sid)}
      ${missingY ? `<button class="yflame" data-act="yesterday">
        <span class="em">🔥</span>
        <span class="grow"><b>어제 불꽃 살리기</b><small>어제 푼 사진을 올리면 살아나요</small></span>
        <span class="go">올리기</span></button>` : ''}

      ${lessonHtml}
      ${learningMap(cid, sid)}
      ${dueCard}

      <div class="cta-wrap">
        <button class="btn btn-primary btn-block btn-xl" data-act="${ctaAct}" ${!hasHw ? 'style="filter:grayscale(.25);opacity:.8"' : ''}>${cta}</button>
        ${(due.has && !due.passed && st.marked && !sub) ? '<button class="btn btn-ghost btn-block btn-sm" style="margin-top:8px" data-act="saveTemp">💾 오늘 한 만큼 임시 저장 (기한까지 이어서)</button>' : ''}
        <div class="quickrow">
          <button class="btn btn-ghost btn-sm" data-act="gallery">👀 친구들 풀이</button>
          <button class="btn btn-ghost btn-sm" data-act="openShop">🛍️ 상점</button>
          <button class="btn btn-ghost btn-sm" data-act="appHelp">❓ 앱이 이상해요</button>
        </div>
      </div>

      ${missionCard(cid, sid)}

      <div class="boss">
        <div class="hd">
          <div class="boss-em">${boss.def.em || '👾'}</div>
          <div class="grow">
            <div class="nm">${esc(boss.def.name || '보스')}</div>
            <div class="taunt">${esc((boss.def.taunts || [''])[new Date(store.state.today + 'T12:00:00').getDate() % Math.max(1, (boss.def.taunts || ['']).length)])}</div>
          </div>
          <div class="hpn">${boss.hp}<span>%</span></div>
        </div>
        <div class="hpbar"><div class="fill" style="width:${boss.hp}%"></div></div>
        <div class="hplb"><span>도장 ${boss.stamped}/${boss.total}${boss.hpMax && boss.hpMax < 100 ? ` · 보스 체력 ${boss.hpMax}` : ''}</span><span>🎯 내가 ${mine}%</span></div>
        <div class="combat">🐾 내 펫 ${store.myPets(cid, sid).length}마리 · 공격력 +${store.companionPct(cid, sid)}%</div>
        ${(() => {
          const ch = (STORY().chapters || [])[new Date(store.state.today + 'T12:00:00').getDate() % Math.max(1, (STORY().chapters || [1]).length)];
          return ch ? `<button class="bossstory" data-act="openStory">📖 ${esc(ch.t)} <span class="chev">›</span></button>` : '';
        })()}
        ${boss.killed ? '<div class="bosskill">🏆 우리 반이 보스를 잡았어요!</div>' : ''}
      </div>

      ${petEvo(cid, sid)}

      ${kingdomCard(store.coins(cid, sid))}

      ${st.marked ? `<div class="card tight sumcard">
        <div class="sumline">
          <span class="sumc o">⭕ ${st.c1}</span>
          <span class="sumc x">❌ ${st.c2 + st.c4}</span>
          <span class="sumc f">⚔️ ${st.c3}</span>
          <span class="sumc q">⭐ ${st.c4}</span>
          <span class="sumc c">⏭️ ${st.c5}</span>
        </div>
      </div>` : ''}

      ${sub ? `<div class="card tight">
        <div class="card-hd"><span class="t">📸 낸 사진</span><span class="grow"></span>
          ${sub.stampAt ? `<span class="pill ok">✅ 도장 ${esc(sub.stampAt)}</span>` : sub.status === 'resubmit' ? `<span class="pill bad">재제출</span>` : sub.status === 'unlocked' ? `<span class="pill warn">🔓 다시 내기</span>` : `<span class="pill warn">🕒 도장 대기</span>`}
        </div>
        ${store.photo(sub.photoId) ? `<button class="photo-open" data-act="photoBig" data-sid="${sid}" data-at="${esc(sub.at)}"><img src="${store.photo(sub.photoId).data}" alt="내가 낸 사진"><span class="zoom">확대</span></button>`
          : `<div class="muted wrap" style="font-size:12px;white-space:normal">🗑 사진은 보관 기간(7일)이 지나 앱에서 지웠어요 · 제출·채점 기록은 그대로 있어요</div>`}
        <div class="row" style="margin-top:10px">
          <button class="btn btn-ghost grow" data-act="gallery">👀 친구들 풀이</button>
          ${up.ok ? `<button class="btn btn-primary grow" data-act="reupload">📸 사진 다시 (${up.mins}분)</button>`
            : sub.status === 'resubmit' || sub.status === 'unlocked' ? `<button class="btn btn-primary grow" data-act="startGrade">다시 내기</button>` : ''}
        </div>
      </div>` : ''}
      ${carried.length ? `<div class="card tight">
        <div class="card-hd"><span class="t">⚔️ 밀린문제 ${carried.length}개</span><span class="grow"></span>
          <button class="linkbtn" style="width:auto;padding:0" data-act="homeTab" data-t="carry">고치기 →</button></div>
        <div class="muted" style="font-size:12px">${carried.slice(0, 2).map(m => esc(m.label) + (m.overdue && m.dueAt ? ' · 기한 지남' : '')).join(' · ')}${carried.length > 2 ? ' 외 ' + (carried.length - 2) + '개' : ''}</div>
      </div>` : ''}`;
  }

  function homePrint(cid, sid) {
    const info = store.printInfo(cid, sid);
    const tiles = store.printTiles(cid, sid);
    const cnt = store.printCounts(cid, sid);
    const sub = store.submission(cid, sid, null, 'print');
    if (!info || !tiles.length) {
      return `<div class="card"><div class="empty">📝 오늘은 오답프린트가 없어요</div></div>`;
    }
    return `
      <div class="card">
        <div class="card-hd"><span class="t">📝 오답프린트</span><span class="grow"></span>
          <span class="hint">1~${info.count}번</span></div>
        <div class="printbig"><b>${info.count}</b>문제</div>
        <div class="oxsum" style="margin-top:10px">
          <div class="pbar"><i style="width:${cnt.total ? Math.round(cnt.marked / cnt.total * 100) : 0}%"></i></div>
          <div class="nums"><span class="s-o">⭕ ${cnt.c1}</span><span class="s-x">❌ ${cnt.c2 + cnt.c4}</span><span class="s-f">⚔️ ${cnt.c3}</span><span class="s-none">아직 ${cnt.c5}</span></div>
        </div>
      </div>
      <div class="cta-wrap">
        <button class="btn btn-primary btn-block btn-lg" data-act="startPrint">
          ${sub ? '📝 프린트 다시 보기' : cnt.marked ? '📝 프린트 채점 이어서' : '📝 프린트 채점 시작'}
        </button>
      </div>
      ${sub && store.photo(sub.photoId) ? `<div class="card tight"><button class="photo-open" data-act="photoBig" data-sid="${sid}" data-at="${esc(sub.at)}"><img src="${store.photo(sub.photoId).data}" alt="프린트 사진"><span class="zoom">확대</span></button></div>` : ''}`;
  }

  /** v1.2 — ⚔️ 밀린문제 [📋 목록으로 | 🎯 한 문제씩] 전환 스위치 (기본값 = 목록으로, 기존 화면 그대로) */
  function carryModeSw() {
    const mode = view.carryMode === 'one' ? 'one' : 'list';
    return `<div class="segmented carry-mode">
      <button class="${mode === 'list' ? 'on' : ''}" data-act="carryMode" data-m="list">📋 목록으로</button>
      <button class="${mode === 'one' ? 'on' : ''}" data-act="carryMode" data-m="one">🎯 한 문제씩</button>
    </div>`;
  }

  /** 🎯 한 문제씩 — 이번 판 대기열을 지금 남은 문제로 잡습니다 (⭕/❌ 로 하나씩 넘어감) */
  function carryQueue(sid, list) {
    if (!view.carryOne || view.carryOne.sid !== sid) {
      view.carryOne = { sid: sid, ids: list.map(m => m.id), idx: 0 };
    }
    const q = view.carryOne;
    // 새로 생긴 밀린문제는 대기열 뒤에 붙입니다
    list.forEach(m => { if (q.ids.indexOf(m.id) < 0) q.ids.push(m.id); });
    // 이미 해결한 문제는 건너뜁니다 → ⭕ 맞았어요 뒤에 다음 문제가 자연스럽게 나옵니다
    const alive = id => list.some(m => m.id === id);
    while (q.idx < q.ids.length && !alive(q.ids[q.idx])) q.idx++;
    return q;
  }

  /** 🎯 한 문제씩 — 이번 판이 끝났을 때 (완료 안내 + 목록/홈으로) */
  function carryOneDone(list, solved, q) {
    const left = q.ids.filter(id => list.some(m => m.id === id)).length;
    const done = q.ids.length - left;
    return `${carryModeSw()}
      <div class="card"><div class="empty">🎉 ${left ? '이번 판은 다 봤어요!' : '밀린 문제를 모두 해결했어요!'}
        <br><small>${left ? `해결 ${done}개 · 다시 도전 ${left}개는 목록에 남겨 뒀어요` : `해결 ${done}개${solved.length ? ` · 지금까지 ${solved.length}개 고쳤어요` : ''}`}</small></div>
        <div class="row" style="margin-top:10px">
          <button class="btn btn-ghost grow" data-act="carryMode" data-m="list">📋 목록으로 보기</button>
          <button class="btn btn-primary grow" data-act="goHome">🏠 홈으로</button>
        </div>
      </div>`;
  }

  /** 🎯 한 문제씩 — 남은 문제 1개만 크게 */
  function carryOneCard(cid, sid, list, solved, doneToday, reasonTxt, tagDefs) {
    const q = carryQueue(sid, list);
    if (q.idx >= q.ids.length) return carryOneDone(list, solved, q);
    const m = list.find(x => x.id === q.ids[q.idx]);
    if (!m) return carryOneDone(list, solved, q);
    const open = view.carryWhy === m.id;
    const tries = (m.tries || 0) > 0 ? ` · ${m.tries}번 다시 풀었어요` : '';
    const whyDef = tagDefs.find(td => td.id === m.why);
    return `${carryModeSw()}
      <div class="carryone">
        <div class="co-bar">
          <span class="co-step">${q.idx + 1} / ${q.ids.length}</span>
          <span class="co-left">남은 ${list.length}개</span>
        </div>
        <div class="co-em">${m.em || '👾'}</div>
        <div class="co-nm">${esc(m.name || '못 고친 오답')}${whyDef ? `<span class="whybadge">${whyDef.em} ${esc(whyDef.label)}</span>` : ''}</div>
        <div class="co-lb">${esc(m.book === '프린트' ? '' : m.book + ' ')}<b>${m.page}쪽 ${esc(m.num)}번</b></div>
        <div class="co-meta">${esc(m.date.slice(5))} · ${reasonTxt[m.reason] || '❌'}${tries}</div>
        ${overdueText(m) ? `<div class="co-late">⏰ ${esc(overdueText(m).replace(' · ', ''))}</div>` : ''}
        ${open
          ? `<div class="co-why">
            <div class="hint" style="margin-bottom:8px">왜 틀렸는지 하나 고르면 <b>다음 문제</b>로 넘어가요</div>
            <div class="tagrow co-tags" style="margin:0">
              ${tagDefs.map(td => `<button class="tag ${m.why === td.id ? 'on' : ''}" data-act="carryWhySet" data-id="${m.id}" data-t="${td.id}">${td.em} ${esc(td.label)}</button>`).join('')}
            </div>
          </div>`
          : `<button class="btn btn-mint btn-block btn-lg co-ok" data-act="resolveCarry" data-id="${m.id}">⭕ 맞았어요</button>
        <button class="btn btn-ghost btn-block co-no" data-act="carryWrong" data-id="${m.id}">❌ 또 틀림</button>`}
      </div>
      <div class="hint center" style="margin:0 16px 10px">다시 풀어 <b>⭕ 맞았어요</b>를 누르면 해결! · 오늘 정식 보상 <b>${Math.min(doneToday, 5)}/5</b>개</div>`;
  }

  function homeCarry(cid, sid) {
    const list = store.carried(cid, sid);
    const solved = store.solvedCarried(sid);
    const reasonTxt = { x: '❌ 틀림', star: '⭐ 질문', skip: '⏭️ 안 풀었음' };
    const tagDefs = GAME().tags || [];
    const todayKey = store.state.today;
    const doneToday = ((store.state.carryResolve || {})[todayKey + '|' + sid]) || 0;
    const one = view.carryMode === 'one';
    if (!list.length) {
      if (one && view.carryOne && view.carryOne.sid === sid && view.carryOne.ids.length) {
        // 🎯 한 문제씩으로 끝까지 본 직후 — 완료 안내 + 목록/홈
        return carryOneDone(list, solved, view.carryOne);
      }
      view.carryOne = null;
      return `<div class="card"><div class="empty">🎉 밀린 문제가 없어요!${solved.length ? `<br><small>지금까지 ${solved.length}개를 스스로 고쳤어요</small>` : ''}</div></div>`;
    }
    if (one) return carryOneCard(cid, sid, list, solved, doneToday, reasonTxt, tagDefs);
    return `${carryModeSw()}` +
      `<div class="card tight" style="margin-bottom:10px">
        <div class="muted wrap" style="font-size:12px;white-space:normal">다시 풀어 <b>⭕ 맞았어요</b>를 누르면 해결! · 오늘 정식 보상 <b>${Math.min(doneToday, 5)}/5</b>개</div>
      </div>
      ${list.map(m => {
        const open = view.carryWhy === m.id;
        const tries = (m.tries || 0) > 0 ? ` · ${m.tries}번 다시 풀었어요` : '';
        const whyDef = (GAME().tags || []).find(td => td.id === m.why);
        return `<div class="carrywrap">
          <div class="carrycard">
            <div class="cc-em">${m.em || '👾'}</div>
            <div class="grow">
              <div class="cc-nm">${esc(m.name || '못 고친 오답')}${whyDef ? `<span class="whybadge">${whyDef.em} ${esc(whyDef.label)}</span>` : ''}</div>
              <div class="cc-lb">${esc(m.book === '프린트' ? '' : m.book + ' ')}${m.page}쪽 ${esc(m.num)}번 <span class="dot">·</span> ${esc(m.date.slice(5))} <span class="dot">·</span> ${reasonTxt[m.reason] || '❌'}${tries}${overdueText(m) ? `<br><span class="late-note">⏰ ${esc(overdueText(m).replace(' · ', ''))}</span>` : ''}</div>
            </div>
            <div class="cc-do">
              <button class="btn btn-mint btn-sm" data-act="resolveCarry" data-id="${m.id}">⭕ 맞았어요</button>
              <button class="btn btn-ghost btn-sm" data-act="carryWrong" data-id="${m.id}">❌ 틀렸어요</button>
            </div>
          </div>
          ${open ? `<div class="card tight carry-why">
            <div class="hint" style="margin-bottom:8px">왜 틀렸는지 하나만 고르면 <b>다시 도전</b> 목록에 남겨 둘게요</div>
            <div class="tagrow" style="margin:0">
              <span class="tag-list">${tagDefs.map(td => `<button class="tag ${m.why === td.id ? 'on' : ''}" data-act="carryWhySet" data-id="${m.id}" data-t="${td.id}">${td.em} ${esc(td.label)}</button>`).join('')}</span>
            </div>
          </div>` : ''}
        </div>`;
      }).join('')}
      ${solved.length ? `<div class="hint center" style="margin:6px 16px">지금까지 ${solved.length}개 고쳤어요</div>` : ''}`;
  }

  /* =========================================================
     ① 채점 (숙제 · 프린트)
  ========================================================= */
  function sourceTiles() {
    const cid = view.classId, sid = view.studentId;
    if (view.gradeSource === 'print') return store.printTiles(cid, sid);
    return store.tiles(cid, view.gradeBook || undefined);
  }
  function sourceGrade() {
    return store.gradeOf(view.classId, view.studentId, view.gradeSource === 'print' ? 'print' : 'hw');
  }
  function sourceKind() { return view.gradeSource === 'print' ? 'print' : 'hw'; }
  /** 화면에 보이는 타일 — 🏫 수업에서 푼 문제(제외)는 접어 둡니다 */
  function shownTiles(tiles, g) {
    const excl = g.excl || {};
    return tiles.filter(t => !(excl[t.key] && !g.marks[t.key]));
  }
  /** 🏫 도구(몇 번부터)를 '제외' 표시로 반영 — 학생 화면에는 이 도구만 남깁니다 */
  function applyGradeView() {
    const cid = view.classId, sid = view.studentId, kind = sourceKind();
    const tiles = sourceTiles();
    const g = store.gradeOf(cid, sid, kind);
    const startIdx = view.gradeStartKey ? tiles.findIndex(t => t.key === view.gradeStartKey) : -1;
    const wanted = [];
    tiles.forEach((t, i) => {
      if (g.marks[t.key] || t.missing) return;      // 이미 채점한 문제는 절대 건드리지 않습니다
      if (startIdx >= 0 && i < startIdx) wanted.push({ key: t.key, reason: 'class' });
    });
    store.clearExcl(cid, sid, kind);
    store.setExcl(cid, sid, wanted, kind);
    return wanted.length;
  }
  function flowGrade() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid);
    const isPrint = view.gradeSource === 'print';
    const bs = store.books(cid);
    if (!isPrint && bs.length > 1 && !bs.find(b => b.book === view.gradeBook)) view.gradeBook = bs[0].book;

    const all = sourceTiles();
    const g = sourceGrade();
    const cnt = countTiles(all, g);
    const tiles = shownTiles(all, g);

    let rows = '', lastPage = null;
    const tagDefs = GAME().tags || [];
    tiles.forEach(t => {
      if (t.page !== lastPage) {
        rows += `<div class="pgroup">${isPrint ? '오답프린트' : t.page + '쪽'}${!isPrint && t.type && t.type !== '표없음' ? ' · ' + esc(t.type) : ''}</div>`;
        lastPage = t.page;
      }
      const m = g.marks[t.key] || '';
      const cur = g.tags[t.key] || '';
      const cls = g.cleanup[t.key] || '';
      rows += `<div class="ox-block">
        <div class="ox-row has-star ${isPrint ? 'compact' : ''} ${t.missing ? 'is-missing' : ''}">
          <div class="ox-label">${esc(t.label)}${/^확인/.test(String(t.label)) ? '' : '<span>번</span>'}</div>
          <button class="ox o ${m === 'o' ? 'on' : ''}" data-act="mark" data-key="${t.key}" data-m="o" ${t.missing ? 'disabled' : ''} aria-label="${esc(t.label)}번 맞음">⭕ 맞음</button>
          <button class="ox x ${m === 'x' ? 'on' : ''}" data-act="mark" data-key="${t.key}" data-m="x" ${t.missing ? 'disabled' : ''} aria-label="${esc(t.label)}번 틀림">❌ 틀림</button>
          <button class="ox-star ${m === 'o' && cls === 'star' ? 'on' : ''}" data-act="starO" data-key="${t.key}" ${m === 'o' ? '' : 'disabled'} aria-label="${esc(t.label)}번 질문" title="맞았지만 궁금해요">⭐</button>
        </div>
        ${m === 'x' ? `<div class="tagrow">
          <span class="tag-q">왜 틀렸나요?</span>
          <span class="tag-list">${tagDefs.map(td => `<button class="tag ${cur === td.id ? 'on' : ''}" data-act="tag" data-key="${t.key}" data-t="${td.id}">${td.em} ${esc(td.label)}</button>`).join('')}</span>
        </div>` : ''}
      </div>`;
    });

    const bookTabs = (!isPrint && bs.length > 1) ? `<div class="booktabs">
      ${bs.map(b => {
        const bc = countTiles(store.tiles(cid, b.book), g);
        return `<button class="booktab ${view.gradeBook === b.book ? 'on' : ''}" data-act="gradeBook" data-b="${esc(b.book)}">
          <span class="be">${b.book.indexOf('응용') >= 0 ? '📙' : '📘'}</span>${esc(b.book)}
          <small>${bc.marked}/${bc.total}</small></button>`;
      }).join('')}
    </div>` : '';

    /* 🏫 학생 화면에 남는 도구는 [몇 번부터 숙제?] 하나뿐 — 홀수·짝수·대표문제는 선생님이 숙제를 낼 때 정합니다 */
    const startTile = view.gradeStartKey ? all.find(t => t.key === view.gradeStartKey) : null;
    const curBook = !isPrint ? store.books(cid).find(b => b.book === view.gradeBook) : null;
    const modeLabel = curBook && curBook.mode ? EMA.util.HW_MODE_LABEL[curBook.mode] : '';
    const tools = isPrint ? '' : `
      <div class="gtools only-one">
        <button class="gtool big ${startTile ? 'on' : ''}" data-act="gradeStartOpen">🏫 ${startTile ? startTile.label + '번부터' : '몇 번부터 숙제?'}</button>
        ${modeLabel ? `<span class="modechip">${esc(modeLabel)}</span>` : ''}
      </div>
      ${cnt.c6 ? `<div class="gfold">🏫 수업에서 푼 문제 <b>${cnt.c6}</b>개는 빼뒀어요<button class="linkbtn2" data-act="gradeReset">되돌리기</button></div>` : ''}`;

    const untagged = tiles.filter(t => g.marks[t.key] === 'x' && !(g.tags || {})[t.key]).length;
    const missingN = all.filter(t => t.missing).length;
    const dueG = isPrint ? null : store.dueInfo(cid);
    const restN = cnt.c5;

    return `<div class="screen flow">
      ${topbar({
        title: isPrint ? '① 프린트 채점' : '① 채점',
        sub: isPrint ? `${all.length}문제` : `${view.gradeBook || '오늘 숙제'} · ${all.length}문제`,
        back: true, backAct: 'flowBack',
        right: avatarHtml(me, 32)
      })}
      ${stepper(1)}
      ${bookTabs}
      ${missingN ? `<div class="card tight missing-note"><div class="muted wrap" style="font-size:12px;white-space:normal">❓ <b>?</b> 칸 ${missingN}개는 쪽수표에 없는 쪽이에요. 선생님 <b>⚙️ 관리 → 쪽수표</b>에서 그 쪽 문제번호를 넣으면 채점할 수 있어요.</div></div>` : ''}
      ${tools}
      ${oxSum(cnt)}
      <div class="card oxcard">
        <div class="hint center" style="margin:0">❌ 틀린 것만 톡톡 누르고, 나머지는 아래 <b>✨ 나머지 전부 ⭕</b> 버튼 한 번!</div>
        <div class="rows ${isPrint ? 'gridrows' : ''}">${rows}</div>
      </div>
      <div class="flowfoot gradefoot">
        ${view.undoFill && view.undoFill.n ? `<button class="undobar" data-act="undoFill">↩️ 방금 채운 ${view.undoFill.n}문제 되돌리기</button>` : ''}
        ${untagged ? `<div class="tag-need">왜 틀렸는지 <b>${untagged}개</b> 더 골라야 해요</div>` : ''}
        <div class="ffrow">
          <button class="btn btn-mint ff-mint" data-act="markAll">✨ 나머지 전부 ⭕${restN ? ` <small>${restN}</small>` : ''}</button>
          <button class="btn btn-primary ff-next" data-act="toClean">다음 →</button>
        </div>
        ${(dueG && dueG.has && !dueG.passed && cnt.marked) ? `<button class="btn btn-ghost btn-block btn-sm" style="margin-top:8px" data-act="saveTemp">💾 여기까지만 임시 저장 (${cnt.marked}/${cnt.total})</button>` : ''}
      </div>
      ${sheetHtml()}
    </div>`;
  }

  /* =========================================================
     ② 정리 · 사진
  ========================================================= */
  function flowClean() {
    const cid = view.classId, sid = view.studentId;
    const isPrint = view.gradeSource === 'print';
    const kindNow = isPrint ? 'print' : 'hw';
    // ② 정리 화면은 '모든 교재'의 오답을 빠짐없이 보여 줍니다 (예전엔 첫 교재만 보여서 먹통처럼 느껴졌어요)
    const tiles = isPrint ? store.printTiles(cid, sid) : store.tiles(cid);
    const g = sourceGrade();
    const cnt = countTiles(tiles, g);
    const sub = store.submission(cid, sid, null, kindNow);
    const existingPhoto = sub ? store.photo(sub.photoId) : null;
    const up = store.reuploadInfo(cid, sid, kindNow);
    const stamped = !!(sub && (sub.stampAt || sub.status === 'stamped'));
    const locked = !!(sub && existingPhoto && !up.ok);
    const verify = store.verifyHint(cid, sid, kindNow);

    const wrong = tiles.filter(t => g.marks[t.key] === 'x');
    const rest = tiles.filter(t => !g.marks[t.key] && !(g.excl || {})[t.key]);
    const starOs = tiles.filter(t => g.marks[t.key] === 'o' && g.cleanup[t.key] === 'star');
    const starCnt = store.starCount(cid, sid, kindNow);
    const multi = store.books(cid).length > 1 && !isPrint;
    const bkLabel = t => (multi ? `<span class="bk">${esc(t.book.indexOf('응용') >= 0 ? '응용' : '발전')}</span>` : '');

    const wrongHtml = wrong.length ? wrong.map(t => {
      const cl = g.cleanup[t.key] || '';
      return `<div class="clean-row">
        <div class="cl-label">${bkLabel(t)}${isPrint ? '' : t.page + '쪽 '}<b>${esc(t.label)}</b>번</div>
        <div class="cl-btns">
          <button class="clb fix ${cl === 'fixed' ? 'on' : ''}" data-act="cleanup" data-key="${t.key}" data-k="fixed">⚔️ 해결!</button>
          <button class="clb star ${cl === 'star' ? 'on' : ''} ${starCnt >= STAR_MAX && cl !== 'star' ? 'is-full' : ''}" data-act="cleanup" data-key="${t.key}" data-k="star">⭐ 질문</button>
        </div>
      </div>`;
    }).join('') : `<div class="empty-note">🎉 틀린 문제가 없어요!</div>`;

    const photoArea = stamped
      ? (existingPhoto
        ? `<div class="photo-preview"><img src="${existingPhoto.data}" alt="낸 사진"><div class="lock">✅ 선생님 도장 완료</div></div>`
        : `<div class="empty-note">✅ 선생님이 확인했어요. 고친 내용은 선생님께 직접 말해 주세요.</div>`)
      : (sub && existingPhoto && up.ok)
        ? `<div class="photo-preview"><img src="${existingPhoto.data}" alt="낸 사진"><div class="lock">🔒 낸 사진</div></div>
         <button class="btn btn-ghost btn-block btn-sm" style="margin-top:8px" data-act="reupload">📸 사진 다시 (${up.mins}분)</button>`
        : locked
          ? `<div class="photo-preview"><img src="${existingPhoto.data}" alt="낸 사진"><div class="lock">🔒 낸 사진 · 바꾸려면 선생님께</div></div>`
          : (view.pending.photo || existingPhoto)
            ? `<div class="photo-preview"><img src="${view.pending.photo || existingPhoto.data}" alt="제출 사진"><div class="lock">🔒 나·선생님·(수업 후) 친구들만</div></div>
           <button class="btn btn-ghost btn-sm" style="margin-top:8px" data-act="photoPick">사진 다시 고르기</button>`
            : `<button class="photo-drop" data-act="photoPick">
            <div class="em">📷</div>
            <div class="t">사진 찍기 / 앨범에서 고르기</div>
          </button>`;

    const verifyHtml = stamped ? '' : !isPrint && verify
      ? `<div class="verify big">
          <div class="v-em">🎲</div>
          <div class="grow"><div class="v-k">오늘 찍을 쪽</div>
            <div class="v-t"><b>${verify.page}쪽</b></div>
            <div class="v-s">${esc(verify.book)}</div></div>
        </div>`
      : isPrint
        ? `<div class="verify big"><div class="v-em">📝</div><div class="grow"><div class="v-k">오늘 찍을 것</div><div class="v-t">프린트 <b>1장</b></div></div></div>`
        : '';

    const btnLabel = stamped ? '💾 고친 내용 저장하고 홈으로'
      : locked ? '✅ 고친 내용 저장'
        : view.pending.photo && sub ? '📸 새 사진으로 다시 내기'
          : '📸 사진 올리고 제출';

    return `<div class="screen flow">
      ${topbar({ title: '② 정리 · 사진', sub: isPrint ? '오답프린트' : '틀린 문제 정리', back: true, backAct: 'flowBack' })}
      ${stepper(2)}

      <div class="sect-t"><span>❌ 틀린 문제 ${wrong.length}</span><span class="grow"></span><span class="hint">⭐ 질문 ${starCnt}/${STAR_MAX}</span></div>
      <div class="card clean-card">${wrongHtml}</div>

      ${starOs.length ? `<div class="sect-t"><span>⭕ 맞았지만 궁금해요 ${starOs.length}</span><span class="grow"></span><span class="hint">선생님 질문 목록에 올라갔어요</span></div>
      <div class="card tight"><div class="clean-list">${starOs.map(t => `<span class="cchip">${multi && !isPrint ? (t.book.indexOf('응용') >= 0 ? '응용 ' : '발전 ') : ''}${isPrint ? '' : t.page + '쪽 '}${esc(t.label)}번 <button class="chipx-mini" data-act="starO" data-key="${t.key}" aria-label="질문 취소">✕</button></span>`).join('')}</div></div>` : ''}

      ${cnt.c6 ? `<div class="hint wrap" style="margin:0 18px 8px">🏫 수업에서 푼 문제 <b>${cnt.c6}</b>개는 채점에서 빼뒀어요.</div>` : ''}

      <div class="sect-t"><span>⏭️ 안 누른 문제 ${rest.length}</span></div>
      <div class="card tight carry-card">
        ${rest.length
          ? `<div class="carry-list">${rest.map(t => `<span class="cchip">${multi && !isPrint ? (t.book.indexOf('응용') >= 0 ? '응용 ' : '발전 ') : ''}${isPrint ? '' : t.page + '쪽 '}${esc(t.label)}번</span>`).join('')}</div>`
          : `<div class="muted">모든 문제를 골랐어요 🎉</div>`}
      </div>

      <div class="sect-t"><span>📸 사진</span><span class="grow"></span><span class="hint">${stamped ? '도장 완료' : up.ok ? up.mins + '분 안에 교체' : '1장'}</span></div>
      <div class="card tight photo-card">
        ${verifyHtml}
        ${photoArea}
        <div class="privacy-note">📖 문제집 페이지만 찍어요! 얼굴, 방, 이름표 등 개인정보가 나오지 않도록 주의해주세요.</div>
      </div>

      <div class="flowfoot">
        ${stamped
          ? `<button class="btn btn-primary btn-block btn-lg" data-act="saveStamped">${btnLabel}</button>
        <div class="hint center" style="margin-top:8px">선생님 도장은 그대로예요 · 고친 해결·질문만 저장돼요</div>`
          : `<button class="btn btn-primary btn-block btn-lg" data-act="submit">${btnLabel}</button>`}
        ${(!isPrint && store.dueInfo(cid).has && !store.dueInfo(cid).passed && !stamped) ? `<button class="btn btn-ghost btn-block btn-sm" style="margin-top:8px" data-act="saveTemp">💾 사진 없이 임시 저장 (기한까지 이어서)</button>` : ''}
      </div>
      <input type="file" class="photo-input" data-target="clean" accept="image/*" aria-hidden="true">
      ${sheetHtml()}
    </div>`;
  }

  /* =========================================================
     ③ 제출 완료
  ========================================================= */
  function flowDone() {
    const cid = view.classId, sid = view.studentId;
    const isPrint = view.gradeSource === 'print';
    const sub = store.submission(cid, sid, null, isPrint ? 'print' : 'hw');
    const r = view.lastResult;
    const st = isPrint ? store.printStats(cid, sid) : store.stats(cid, sid);
    const boss = store.boss(cid);
    const egg = store.eggOf(cid, sid);
    const titles = (store.student(cid, sid).titles || []).slice(-2);
    const coinsNow = store.coins(cid, sid);
    const up = store.reuploadInfo(cid, sid, isPrint ? 'print' : 'hw');
    const carriedNow = store.carried(cid, sid).length;

    return `<div class="screen flow">
      ${topbar({ title: '③ 제출 완료', sub: sub ? '제출 ' + esc(sub.at) : '', back: true, backAct: 'flowBack' })}
      ${stepper(3)}
      <div class="done-hero">
        <div class="em">🎉</div>
        <div class="t">${isPrint ? '프린트 제출 완료!' : '제출 완료!'}</div>
        <div class="title-chip">${esc(todayTitle(cid, sid))}</div>
      </div>
      <div class="card">
        <div class="sumline">
          <span class="sumc o">⭕ ${st.c1}</span>
          <span class="sumc x">❌ ${st.c2 + st.c4}</span>
          <span class="sumc f">⚔️ ${st.c3}</span>
          <span class="sumc q">⭐ ${st.c4}</span>
          <span class="sumc c">⏭️ ${st.c5}</span>
        </div>
        <div class="divider"></div>
        <div class="kv"><span class="k">🪙 코인</span><span>+${r && r.coins != null ? r.coins : 0} · 지금 <b>${coinsNow}</b></span></div>
        <div class="kv"><span class="k">✨ XP</span><span>+${r && r.xp != null ? r.xp : st.xp}</span></div>
        <div class="kv"><span class="k">${boss.def.em || '👾'} 보스</span><span>${boss.hp}% 남음</span></div>
        ${r && r.join && r.join.pet ? `<div class="kv"><span class="k">🐾 새 펫</span><span>${r.join.pet.em} ${esc(r.join.pet.name)}</span></div>` : ''}
        ${r && r.join && r.join.coins ? `<div class="kv"><span class="k">🐾 펫의 힘</span><span>펫 코인 +${r.join.coins}</span></div>` : ''}
        <div class="kv"><span class="k">🎯 오늘 미션</span><span>${missionLine(cid, sid)}</span></div>
      </div>
      ${carriedNow ? `<div class="card tight">
        <div class="row"><span class="grow muted" style="font-size:12.5px">⚔️ 밀린문제 <b>${carriedNow}개</b></span>
        <button class="btn btn-mint btn-sm" data-act="homeTab" data-t="carry">고치기 →</button></div>
      </div>` : ''}
      ${(!isPrint && r && !r.reupload && !r.already) ? `<div class="notifyline">📣 선생님께 <b>'오늘 열심히 했어요!'</b> 알림이 전달됐어요!</div>` : ''}
      <div class="cta-wrap">
        <button class="btn btn-primary btn-block btn-lg" data-act="goHome">🏠 숙제로 돌아가기</button>
        <div class="quickrow">
          <button class="btn btn-ghost btn-sm" data-act="gallery">👀 친구들 풀이</button>
          <button class="btn btn-ghost btn-sm" data-act="openShop">🛍️ 상점</button>
          ${up.ok ? `<button class="btn btn-ghost btn-sm" data-act="reupload">📸 사진 다시 (${up.mins}분)</button>` : ''}
        </div>
      </div>
      <input type="file" class="photo-input" data-target="clean" accept="image/*" aria-hidden="true">
      ${sheetHtml()}
    </div>`;
  }

  /* =========================================================
     내 도감 / 랭킹 / ⚙️ 설정
  ========================================================= */
  /** 📊 약점 단원 & 자주 하는 실수 — 아이 화면과 선생님 리포트가 같은 데이터를 씁니다 */
  function weakCard(cid, sid, who) {
    const w = store.weakReport(cid, sid);
    const title = who ? who + '의 자주 하는 실수' : '자주 하는 실수';
    if (!w.totalWrong && !w.tagTotal) {
      return `<div class="card tight weakempty"><div class="card-hd"><span class="t">📊 ${title}</span></div><div class="muted">아직 오답이 없어요</div></div>`;
    }
    const tags = w.tags.filter(t => t.count > 0);
    return `<div class="card weakcard">
      <div class="card-hd"><span class="t">📊 ${title}</span><span class="grow"></span>
        <span class="hint">오답 ${w.totalWrong}</span></div>
      ${w.units.length ? w.units.map(u => `<div class="weakline">
        <span class="wl-nm">${esc(u.name || '기타')}</span>
        <span class="wl-n">오답 <b>${u.wrong}</b></span>
        <span class="wl-f">고침 ${u.fixed}</span>
      </div>`).join('') : ''}
      ${tags.length ? `<div class="tagbars">
        ${tags.map(t => `<span class="tagbar ${t.id}"><b>${t.em} ${esc(t.label)}</b> ${t.pct}%</span>`).join('')}
      </div>` : `<div class="hint" style="margin-top:8px">❌ 누를 때 이유를 고르면 여기에 쌓여요</div>`}
    </div>`;
  }

  /** ★ v2.0 — 대표 펫 쇼케이스: 진화 3단계를 크게 보여 주는 카드 */
  function petShowcase(cid, sid) {
    const pets = store.myPets(cid, sid);
    if (!pets.length) {
      const egg = store.eggOf(cid, sid);
      return `<div class="petshow">
        <div class="ps-hd"><span class="t">🐾 대표 펫 · 진화</span><span class="grow"></span><span class="pill">아직 없음</span></div>
        <div class="ps-body">
          <div class="petshow-orb" style="filter:grayscale(.25)">🥚</div>
          <div class="grow">
            <div class="ps-nm">펫을 만나러 가 볼까요?</div>
            <div class="ps-empty" style="margin-top:6px">오답을 고치면 펫 알이 부화해요.${egg ? ` 지금 알 ${egg.pct}%.` : ''}<br>1단계 아기 → 2단계 성장 → 3단계 완전체!</div>
            <div class="ps-steps"><span class="cur">🐣 아기</span><span>🌱 성장</span><span>👑 완전체</span></div>
          </div>
        </div>
      </div>`;
    }
    const best = pets.slice().sort((a, b) => {
      const sa = store.petStageOf(a), sb = store.petStageOf(b);
      if (sb !== sa) return sb - sa;
      return Number(b.xp || b.lv || 0) - Number(a.xp || a.lv || 0);
    })[0];
    const stage = store.petStageOf(best);
    const lab = store.petStageLabel(best);
    const next = store.petNextNeed(best);
    const def = store.petDef(best.id) || {};
    const left = next.need == null ? 0 : Math.max(0, next.need - next.have);
    return `<div class="petshow">
      <div class="ps-hd"><span class="t">🐾 대표 펫 · 진화</span><span class="grow"></span>
        <span class="ps-badge s${stage}">${lab.em} ${stage}단계 ${lab.name}</span></div>
      <div class="ps-body">
        <div class="petshow-orb s${stage}">${best.em || def.em || '🐾'}</div>
        <div class="grow" style="min-width:0">
          <div class="ps-nm">${esc(best.name || def.name || '내 펫')}</div>
          <div class="ps-steps">
            <span class="${stage === 1 ? 'cur' : ''}">🐣 아기</span>
            <span class="${stage === 2 ? 'cur s2' : ''}">🌱 성장</span>
            <span class="${stage === 3 ? 'cur s3' : ''}">👑 완전체</span>
          </div>
          <div class="ps-track s${stage}"><i style="width:${next.pct}%"></i></div>
          <div class="ps-next">${stage >= 3 ? '완성! <b>칭호</b>를 받았어요 · 보스 공격력 +' + store.companionPct(cid, sid) + '%' : `다음 단계까지 <b>${left} XP</b> · 문제를 풀면 자라요`}</div>
        </div>
      </div>
    </div>`;
  }

  function renderRecord() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid), c = store.getClass(cid);
    const st = store.stats(cid, sid), lv = store.level(cid, sid), streak = store.streak(cid, sid);
    const ym = store.state.today.slice(0, 7);
    const cells = store.calendar(cid, sid, ym);
    const joined = cells.filter(x => x.flame).length;
    const exams = store.exam(cid, sid);
    const pets = store.myPets(cid, sid);
    const cat = store.petCatalog();
    const owned = new Set(pets.map(p => p.id));
    const egg = store.eggOf(cid, sid);
    const titles = me.titles || [];
    const eggs = store.darkEggs(cid, sid);
    const power = store.companionPct(cid, sid);

    return `<div class="screen">
      ${topbar({ title: '내 도감', sub: c.name, right: `${coinChip(cid, sid)}${gearBtn()}` })}
      <div class="card">
        <div class="avatarbox">
          <button class="avatar-big" style="border:none;cursor:pointer" data-act="editProfile">${esc(me.avatar || '🙂')}</button>
          <div class="grow" style="min-width:0">
            <div class="nmline">${esc(me.nickname || me.name)} <span class="pill">${esc(me.name)}</span></div>
            <div class="chips" style="margin:6px 0">
              <span class="title-chip">${esc(todayTitle(cid, sid))}</span>
              <span class="chip streak">🔥 ${streak}일</span>
            </div>
            <div class="lvlbar"><i style="width:${lv.into}%"></i></div>
          </div>
        </div>
      </div>
      <div class="pad"><div class="stat-grid">
        <div class="stat"><div class="v">🔥 ${streak}</div><div class="l">연속 불꽃</div></div>
        <div class="stat"><div class="v">🐾 ${pets.length}</div><div class="l">내 펫</div></div>
        <div class="stat"><div class="v">⚠️ ${eggs.length}</div><div class="l">못 고친 오답</div></div>
      </div></div>

      ${weakCard(cid, sid)}

      ${growthCard(cid, sid)}

      <div class="sect-t" id="companionDex"><span>🐾 펫 도감</span><span class="grow"></span><span class="hint">${pets.length}/${cat.length}</span></div>
      ${petShowcase(cid, sid)}
      <div class="card">
        ${egg ? `<button class="eggline" data-act="openShop"><span class="em eggwig">🥚</span><span class="grow">펫 알 ${egg.pct}%</span><span class="go">간식 →</span></button>` : ''}
        <div class="petgrid">
          ${cat.map(p => {
            const mine = owned.has(p.id);
            const r = (GAME().rarity || {})[p.rarity] || {};
            const my = pets.find(x => x.id === p.id);
            const stg = mine ? store.petStageOf(my) : 0;
            return `<button class="petcard ${mine ? 'got' : 'locked'} r-${p.rarity} ${stg ? 'st' + stg : ''}" data-act="petDetail" data-id="${p.id}">
              <span class="rar">${r.label || ''}</span>
              ${stg >= 2 ? `<span class="stagepin">${stg >= 3 ? '👑' : '🌱'}</span>` : ''}
              <span class="pem">${mine ? p.em : '❔'}</span>
              <span class="pnm">${mine ? esc(p.name) : '???'}</span>
              <span class="pst">${mine ? `${store.petStageLabel(my).em}${store.petStageLabel(my).name}` : ''}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="hint" style="margin-top:10px">펫 ${pets.length}마리 · 보스 공격력 +${power}%</div>
      </div>

      <div class="sect-t"><span>❌ 못 고친 오답 ${eggs.length}</span><span class="grow"></span><span class="hint">고치면 펫 알 부화!</span></div>
      <div class="hint wrap" style="margin:-2px 18px 8px">오늘 숙제에서 틀린 문제는 <b>② 정리 화면</b>에서, 지난 오답은 <b>⚔️ 밀린문제</b>에서 고쳐요.</div>
      <div class="card tight">
        ${eggs.length ? eggs.slice(0, 6).map(m => `
          <div class="eggrow">
            <span class="er-em">🥚</span>
            <span class="grow" style="min-width:0"><b>${esc(m.label || (m.page + '쪽 ' + m.num + '번'))}</b>
              <small>${esc(m.unitName || '')}${m.reason === 'star' ? ' · ⭐질문' : m.reason === 'skip' ? ' · ⏭️안 풀었음' : ''}</small></span>
            ${m.today
              ? `<button class="btn btn-mint btn-sm" data-act="fixNow">⚔️ 고치기</button>`
              : `<button class="btn btn-mint btn-sm" data-act="homeTab" data-t="carry">⚔️ 고치기 →</button>`}
          </div>`).join('') + (eggs.length > 6 ? `<div class="hint" style="margin-top:8px">외 ${eggs.length - 6}개는 숙제의 밀린문제에서 볼 수 있어요</div>` : '')
          : `<div class="empty-note">못 고친 오답이 없어요 🌟</div>`}
      </div>

      <div class="sect-t"><span>🔥 불꽃 달력</span><span class="grow"></span><span class="hint">${parseInt(ym.slice(5), 10)}월 · ${joined}일</span></div>
      <div class="card">
        <div class="cal">
          ${['일', '월', '화', '수', '목', '금', '토'].map(d => `<div class="wd">${d}</div>`).join('')}
          ${cells.map(c2 => c2.empty ? '<div class="cell empty"></div>' :
            `<div class="cell ${c2.flame ? 'done' : ''} ${c2.today ? 'today' : ''} ${c2.future ? 'future' : ''}">${c2.day}${c2.flame ? '<span class="fl">🔥</span>' : ''}${c2.late ? '<span class="lt">⏰</span>' : ''}</div>`).join('')}
        </div>
      </div>

      ${titles.length ? `<div class="sect-t"><span>🏅 내 칭호</span><span class="grow"></span><span class="hint">${titles.length}</span></div>
      <div class="card tight"><div class="chips">${titles.map(t => `<span class="chip">${t.em || '🏅'} ${esc(t.name)}</span>`).join('')}</div></div>` : ''}

      ${exams.length ? `<div class="sect-t"><span>📝 단원평가</span></div>
      <div class="card tight">
        ${exams.map(e => {
          const bad = e.score != null && e.retestLine && e.score < e.retestLine;
          return `<div class="kv"><span class="k">${esc(e.unit)} <small class="muted">${esc(e.date.slice(5))}</small></span>
            <span>${e.score != null ? e.score + '점' : '—'}
              ${e.retest != null ? ` → <b>재시 ${e.retest}점</b>` : ''}
              ${e.retest != null ? '<span class="pill ok">재시 통과</span>' : (e.score != null ? (bad ? '<span class="pill warn">재시 예정</span>' : '<span class="pill ok">통과</span>') : '')}</span></div>`;
        }).join('')}
      </div>` : ''}
      ${nav([
        { id: 'home', em: '🔥', label: '숙제' },
        { id: 'record', em: '🐾', label: '내 도감' },
        { id: 'rank', em: '🏆', label: '랭킹' }
      ], view.tab)}
      ${sheetHtml()}
    </div>`;
  }

  function renderRank() {
    const cid = view.classId, sid = view.studentId;
    const c = store.getClass(cid);
    const rows = view.rankScope === 'class' ? store.ranking(cid, view.rankMode) : store.gradeRanking(view.rankMode);
    const boss = store.boss(cid);
    const mine = store.myDamage(cid, sid);
    return `<div class="screen">
      ${topbar({ title: '랭킹', sub: c.name, right: `${coinChip(cid, sid)}${gearBtn()}` })}
      <div class="segmented">
        <button class="${view.rankMode === 'first' ? 'on' : ''}" data-act="rankMode" data-m="first">🥇 1등 완료</button>
        <button class="${view.rankMode === 'king' ? 'on' : ''}" data-act="rankMode" data-m="king">👑 공부 왕</button>
      </div>
      <div class="segmented">
        <button class="${view.rankScope === 'class' ? 'on' : ''}" data-act="rankScope" data-s="class">우리 반</button>
        <button class="${view.rankScope === 'grade' ? 'on' : ''}" data-act="rankScope" data-s="grade">전체 학년</button>
      </div>
      <div class="card">
        ${rows.length ? rows.map(r => `
          <div class="rank-row ${r.student.id === sid ? 'me' : ''}">
            <div class="rank-num">${r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}</div>
            ${avatarHtml(r.student, 36)}
            <div class="rank-nm">${esc(r.student.nickname || r.student.name)}
              <span class="sm">${esc(r.label)}</span>
            </div>
            <div class="rank-v">${esc(r.value || '')}</div>
          </div>`).join('')
          : `<div class="empty">아직 오늘 기록이 없어요.<br><small>첫 번째 주자가 되어 보세요!</small></div>`}
      </div>
      <div class="card tight">
        <div class="card-hd"><span class="t">${boss.def.em || '👾'} 우리 반 보스전</span><span class="grow"></span><span class="pill ${boss.left === 0 ? 'ok' : 'warn'}">${boss.left === 0 ? '클리어!' : '남은 ' + boss.left + '명'}</span></div>
        <div class="hpbar" style="background:#E9EEF6"><div class="fill" style="width:${boss.hp}%"></div></div>
        <div class="muted" style="margin-top:8px;font-size:12px">보스 HP ${boss.hp}% · 도장 ${boss.stamped}/${boss.total}</div>
        <div class="hint" style="margin-top:6px">닉네임으로만 보여요</div>
      </div>
      ${nav([
        { id: 'home', em: '🔥', label: '숙제' },
        { id: 'record', em: '🐾', label: '내 도감' },
        { id: 'rank', em: '🏆', label: '랭킹' }
      ], view.tab)}
      ${sheetHtml()}
    </div>`;
  }


  /* =========================================================
     선생님
  ========================================================= */
  function renderTeacher() {
    const cid = view.classId || 'c4m2';
    const c = store.getClass(cid);
    const boss = store.boss(cid);
    const tabs = [
      { id: 'today', em: '📋', label: '오늘' },
      { id: 'dash', em: '📊', label: '반 대시보드' },
      { id: 'top5', em: '⭐', label: '질문' },
      { id: 'report', em: '🧾', label: '성취도' },
      { id: 'admin', em: '⚙️', label: '관리' }
    ];
    if (!tabs.find(t => t.id === view.teacherTab)) view.teacherTab = 'today';
    let body = '';
    if (view.teacherTab === 'top5') body = teacherTop5(c);
    else if (view.teacherTab === 'dash') body = teacherDashboard(c);
    else if (view.teacherTab === 'report') body = teacherReport(c);
    else if (view.teacherTab === 'admin') body = teacherAdmin(c);
    else body = teacherToday(c);

    return `<div class="screen">
      ${topbar({
        title: '선생님 모드',
        sub: `${c.name} · 제출 ${boss.submitted}/${boss.total} · 도장 ${boss.stamped}`,
        right: `<button class="icon-btn" data-act="teacherExit" aria-label="선생님 모드 나가기">✕</button>`
      })}
      <div class="tabs-scroll">
        ${tabs.map(t => `<button class="${view.teacherTab === t.id ? 'on' : ''}" data-act="teacherTab" data-t="${t.id}">${t.em} ${t.label}</button>`).join('')}
      </div>
      ${missingAlert(c)}
      ${body}
      ${sheetHtml()}
    </div>`;
  }

  /** ⚠️ 쪽수표에 없는 쪽 — 선생님 모드에 들어오면 맨 위에서 바로 번호를 넣게 합니다 (v1.2) */
  function missingAlert(c) {
    const miss = store.missingPages(c.id);
    if (!miss.length) return '';
    const first = miss[0];
    const label = miss.slice(0, 5).map(x => x.page + '쪽').join(', ');
    return `<div class="card tight missing-note" style="margin:10px 16px 0">
      <div class="muted wrap" style="font-size:12px;white-space:normal">⚠️ <b>쪽수표에 없는 ${miss.length}쪽</b>이 있어요 — ${esc(label)}${miss.length > 5 ? ' 외 ' + (miss.length - 5) + '쪽' : ''}<br>${esc(first.book)} · 번호를 넣으면 저장되는 즉시 학생 숙제에 나와요.</div>
      <button class="btn btn-primary btn-block btn-sm" style="margin-top:8px" data-act="fixMissing" data-b="${esc(first.book)}" data-p="${first.page}">바로 번호 넣기 (${first.page}쪽)</button>
    </div>`;
  }

  function stuQuickButtons(cid, r) {
    const s = r.student;
    const sub = r.sub;
    const out = [];
    if (sub && sub.status === 'submitted') out.push(`<button class="tbtn primary" data-act="stamp" data-id="${s.id}">✅ 도장</button>`);
    if (sub && sub.stampAt) out.push(`<button class="tbtn" data-act="unlock" data-id="${s.id}">🔓 제출 풀기</button>`);
    if (sub && !sub.stampAt && sub.status !== 'submitted') out.push(`<button class="tbtn" data-act="resubmit" data-id="${s.id}">📷 재제출</button>`);
    out.push(`<button class="tbtn ${s.sick ? 'on' : ''}" data-act="toggleSick" data-id="${s.id}">🤒 아픔${s.sick ? ' ON' : ''}</button>`);
    if (sub && store.photo(sub.photoId)) out.push(`<button class="tbtn" data-act="photoBig" data-sid="${s.id}" data-at="${esc(sub.at)}">📸 사진</button>`);
    out.push(`<button class="tbtn ${store.hasPrint(cid, s.id) ? 'on' : ''}" data-act="openPrintSet" data-id="${s.id}">📝 프린트${store.hasPrint(cid, s.id) ? ' ' + store.printInfo(cid, s.id).count : ''}</button>`);
    out.push(`<button class="tbtn" data-act="openReport" data-id="${s.id}">📊 성취도</button>`);
    /* ✅ 책으로 완료 — 앱 오류·사진 문제로 제출이 막혔을 때 (밀린문제는 건드리지 않음) */
    out.push(`<button class="tbtn bookdone" data-act="bookDone" data-id="${s.id}">✅ 책으로 완료</button>`);
    return `<div class="tbtns">${out.join('')}</div>`;
  }

  function teacherToday(c) {
    const cid = c.id;
    const rows = store.classDay(cid);
    const pending = rows.filter(r => (r.sub && r.sub.status === 'submitted') || (r.printSub && r.printSub.status === 'submitted')).length;
    const handedIn = rows.filter(r => r.sub || r.printSub).length;
    return `
      <button class="bigstamp" data-act="stampAll">✅ 오늘 제출 확인 & 한꺼번에 도장${pending ? ` <small>${pending}장</small>` : ''}</button>
      <div class="sect-t"><span>학생 ${rows.length}</span><span class="grow"></span><span class="hint">제출 ${handedIn}</span></div>
      <div class="pad">
        ${rows.map(r => {
          const sub = r.sub, psub = r.printSub;
          // 오답프린트만 낸 학생도 '미제출'이 아닙니다 (v0.9 잔버그 수정)
          const shown = sub || psub;
          const onlyPrint = !sub && !!psub;
          const hasPh = shown && store.photo(shown.photoId);
          const cls = shown && shown.stampAt ? 'ok' : shown && shown.status === 'submitted' ? 'warn' : shown && shown.status === 'resubmit' ? 'bad' : shown && shown.status === 'unlocked' ? 'info' : '';
          const base = shown && shown.stampAt ? '도장 ' + esc(shown.stampAt) : shown && shown.status === 'submitted' ? '제출' : shown && shown.status === 'resubmit' ? '재제출' : shown && shown.status === 'unlocked' ? '풀림' : '미제출';
          const label = (base === '미제출') ? base : (onlyPrint ? '프린트 ' + base : base);
          const status = hasPh
            ? `<button class="pill ${cls} pillbtn" data-act="photoBig" data-sid="${r.student.id}" data-at="${esc(shown.at || '')}">${label} 📸</button>`
            : `<span class="pill ${cls}">${label}</span>`;
          const open = !!view.stuOpen[r.student.id];
          return `<div class="sturow ${open ? 'open' : ''}">
            <div class="stuhd">
              <button class="stuhb" data-act="openReport" data-id="${r.student.id}">
                ${avatarHtml(r.student, 32)}
                <span class="grow" style="min-width:0">
                  <span class="nm">${esc(r.student.nickname || r.student.name)}${r.student.nickname ? ` <small>${esc(r.student.name)}</small>` : ''}${r.student.sick ? ' 🤒' : ''}</span>
                  <span class="cnts"><span class="o">⭕${r.c1}</span><span class="x">❌${r.c2}</span><span class="f">⚔️${r.c3}</span><span class="q">⭐${r.c4}</span><span class="c">⏭️${r.c5}</span></span>
                </span>
              </button>
              <div class="stright">${status}${(sub && psub) ? '<span class="pill info">📝+</span>' : ''}</div>
              <button class="more" data-act="stuTools" data-id="${r.student.id}" aria-label="도구">⋯</button>
            </div>
            ${stuQuickButtons(cid, r)}
          </div>`;
        }).join('')}
      </div>`;
  }

  /** ⚙️ 관리 — 부가 도구는 전부 여기(접기/펼치기) 안으로 */
  function teacherAdmin(c) {
    const cid = c.id;
    const rows = store.classDay(cid);
    const on = store.state.shop ? store.state.shop.rewardsOn !== false : true;
    const claims = ((store.state.shop || {}).claims || []);
    const gmode = ((store.state.gallery || {}).mode || 'auto');
    const testMode = store.mode !== 'api';
    const tg = (key, em, title, inner, hint) => {
      const open = !!view.tOpen[key];
      return `<div class="tgroup ${open ? 'open' : ''}">
        <button data-act="tGroup" data-k="${key}"><span class="em">${em}</span><span class="grow">${title}</span>
          ${hint ? `<span class="hint">${hint}</span>` : ''}<span class="ar">›</span></button>
        ${open ? `<div class="tg-body">${inner}</div>` : ''}
      </div>`;
    };

    const l = store.lesson(cid) || {};
    const due = store.dueInfo(cid);
    return `
      ${tg('lesson', '📘', '오늘 진도 · 숙제', `
        <div class="kv"><span class="k">진도</span><span>${esc(l.lesson)}</span></div>
        <div class="kv"><span class="k">숙제</span><span>${esc(l.homework)}</span></div>
        <div class="kv"><span class="k">제출 기한</span><span>${esc(due.label || '없음')} <span class="pill ${due.passed ? 'bad' : 'ok'}">${due.passed ? (due.closed ? '마감됨' : '기한 지남') : '진행 중'}</span></span></div>
        <div class="hint wrap" style="margin:2px 0 4px">${esc(due.passed ? due.lateText : due.leftText)}</div>
        <button class="btn btn-ghost btn-block btn-sm" style="margin-top:10px" data-act="openLessonEdit">숙제·기한 바꾸기</button>
        <div class="row" style="margin-top:8px;gap:8px">
          <button class="btn btn-primary grow btn-sm" data-act="closeDue">⏰ 지금 마감</button>
          <button class="btn btn-ghost grow btn-sm" data-act="copyLessonOpen">📤 다른 반에 복사</button>
        </div>
        <div class="hint" style="margin-top:6px">마감하면 지금까지 안 푼 문제가 바로 ⚔️ 밀린문제로 넘어가요.</div>`, due.passed ? '기한 지남' : '진행 중')}

      ${tg('print', '🖨️', '프린트 설정', `
        ${rows.map(r => {
          const info = store.printInfo(cid, r.student.id);
          return `<div class="pinrow">
            <b>${esc(r.student.nickname || r.student.name)}</b>
            <span class="grow muted">${info ? info.count + '문제' : '없음'}</span>
            <button class="btn btn-ghost btn-sm" data-act="openPrintSet" data-id="${r.student.id}">${info ? '바꾸기' : '넣기'}</button>
            ${info ? `<button class="btn btn-ghost btn-sm" data-act="copyPrintAll" data-id="${r.student.id}" title="다른 학생에게 같이">복사</button>` : ''}
          </div>`;
        }).join('')}
        <div class="hint" style="margin-top:8px">[복사] = 이 학생의 프린트 문제 수를 반 전체에 똑같이 넣어요.</div>`, `${rows.filter(r => store.hasPrint(cid, r.student.id)).length}명`)}

      ${tg('coupon', '🎁', '현실 보상 쿠폰', `
        <div class="pinrow"><b class="grow">쿠폰 보이기</b>
          <button class="toggle ${on ? 'on' : ''}" data-act="toggleRewards"><i></i><b>${on ? 'ON' : 'OFF'}</b></button></div>
        ${claims.length ? claims.slice().reverse().map(cl => `
          <div class="kv claim ${cl.used ? 'used' : ''}">
            <span class="k">${cl.em} ${esc(cl.name)}<br><small class="muted">${esc(store.student(cid, cl.sid) ? store.student(cid, cl.sid).name : cl.sid)} · ${esc(cl.at.slice(5))}</small></span>
            ${cl.used ? '<span class="pill">사용 완료</span>' : `<button class="btn btn-primary btn-sm" data-act="useClaim" data-id="${cl.id}">간식 주기</button>`}
          </div>`).join('') : '<div class="hint" style="margin-top:8px">아직 사용 요청이 없어요</div>'}`, claims.filter(cl => !cl.used).length + '건')}

      ${tg('gallery', '👀', '친구들 풀이 공개', `
        <div class="segmented" style="margin:0">
          ${['auto', 'open', 'closed'].map(m => `<button class="${gmode === m ? 'on' : ''}" data-act="galleryMode" data-m="${m}">${m === 'auto' ? '자동' : m === 'open' ? '지금 열기' : '닫기'}</button>`).join('')}
        </div>`, store.galleryInfo(cid, view.studentId || rows[0].student.id).startLabel + ' 이후')}

      ${testMode ? tg('test', '🧪', '테스트 도구', `
        <button class="btn btn-mint btn-block" data-act="nextDay">🌙 다음 날로 넘겨보기</button>
        <div class="row wrap" style="margin-top:10px">
          <button class="btn btn-ghost btn-sm" data-act="previewFx" data-k="shield">🛡️ 방어막</button>
          <button class="btn btn-ghost btn-sm" data-act="previewFx" data-k="early">⚡ 얼리버드</button>
          <button class="btn btn-ghost btn-sm" data-act="previewFx" data-k="legend">🐈 전설 펫</button>
          <button class="btn btn-ghost btn-sm" data-act="previewFx" data-k="boss">🏆 보스 처치</button>
        </div>
        <div class="hint" style="margin-top:10px">테스트 모드 — 이 브라우저에만 쌓여요 · 연습은 주소에 ?mode=demo</div>`) : ''}

      ${tg('pages', '📖', '쪽수표', teacherPages(c))}

      ${tg('students', '👥', '학생 · PIN', teacherStudents(c))}
    `;
  }

  function teacherTop5(c) {
    const cid = c.id;
    const list = store.top5(cid);
    const rows = store.classDay(cid);
    const tiles = store.tiles(cid);
    return `
      <div class="pad tacts"><button class="btn btn-navy btn-block" data-act="bigTop5">📺 크게 보기</button></div>
      <div class="card">
        <div class="card-hd"><span class="t">⭐ 물어본 문제 TOP 5</span></div>
        ${list.length ? list.map((t, i) => `
          <div class="top5row">
            <div class="no">${i + 1}</div>
            <div class="lb">${t.page}쪽 ${esc(t.num)}번 <span class="sm">${t.count}명</span></div>
            <div class="ct">${t.students.map(s => esc(s.nickname || s.name)).join(', ')}</div>
          </div>`).join('') : '<div class="empty">오늘 별표가 없어요</div>'}
      </div>
      <div class="card tight">
        ${rows.map(r => {
          const g = store.grade(cid, r.student.id);
          const wrong = tiles.filter(t => g.marks[t.key] === 'x');
          const stars = tiles.filter(t => g.marks[t.key] === 'x' && g.cleanup[t.key] === 'star').map(t => t.page + '쪽 ' + t.num + '번');
          return `<div class="kv" style="align-items:flex-start">
            <span class="k">${esc(r.student.nickname || r.student.name)}<br>
              <span class="muted" style="font-size:11px">❌ ${wrong.length ? wrong.map(t => t.page + '쪽 ' + t.num + '번').join(', ') : '없음'}</span></span>
            <span class="muted" style="font-size:11px;text-align:right">${stars.length ? '⭐ ' + stars.join('<br>⭐ ') : '<span style="color:#96A4B8">없음</span>'}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  /* =========================================================
     선생님 반 대시보드 (v0.9) — 제출률·미제출·오답 수정률·학습량·학생별 비교
  ========================================================= */
  /** 🔥 오늘의 열정 학생 — 숙제 완료·밀린문제 3개 이상 해결한 학생을 대시보드 맨 위에 */
  function effortCard(cid) {
    const list = store.effortToday ? store.effortToday(cid) : [];
    const reasonTxt = { homework: '숙제 완료', carry3: '밀린문제 3개 해결', book: '책으로 완료' };
    if (!list.length) return '';
    return `<div class="card effortcard">
      <div class="card-hd"><span class="t">🔥 오늘의 열정 학생</span><span class="grow"></span>
        <span class="hint">${list.length}명 · 앱이 알려 줬어요</span></div>
      <div class="effrow">
        ${list.slice(0, 8).map(r => `<span class="effchip">${avatarHtml(r.student, 22)}<b>${esc(r.student.nickname || r.student.name)}</b><small>${reasonTxt[r.reason] || '열심히 했어요'}</small></span>`).join('')}
      </div>
      <button class="linkbtn2" style="margin-top:8px" data-act="effortClear">오늘 알림 비우기</button>
    </div>`;
  }

  function teacherDashboard(c) {
    const cid = c.id;
    const d = store.dashboard(cid, view.dashRange);
    const due = d.due;
    const rangeName = { week: '이번 주', month: '이번 달', semester: '이번 학기' }[view.dashRange] || '이번 달';
    const nm = s => esc(s.nickname || s.name);
    const bar = (pct, color) => `<div class="pbar"><i style="width:${Math.max(0, Math.min(100, pct))}%;background:${color || 'var(--navy)'}"></i></div>`;
    const open = !!view.dashOpen.detail;
    return `
      ${effortCard(cid)}
      <div class="pad" style="margin-top:10px"><div class="segmented" style="margin:0">
        ${[['week', '이번 주'], ['month', '이번 달'], ['semester', '이번 학기']].map(x =>
          `<button class="${view.dashRange === x[0] ? 'on' : ''}" data-act="dashRange" data-r="${x[0]}">${x[1]}</button>`).join('')}
      </div></div>

      <div class="card dashcard">
        <div class="dash-kpis">
          <div class="kpi"><b>${d.submitRate}%</b><span>숙제 제출률</span><small>${d.submitted}/${d.total}명</small></div>
          <div class="kpi"><b>${d.fixRate}%</b><span>오답 수정률</span><small>${d.wrongFixed}/${d.wrongTotal}개</small></div>
          <div class="kpi"><b>${d.solved}</b><span>반 학습량</span><small>${rangeName} 문항</small></div>
          <div class="kpi"><b>${d.avgHw}%</b><span>숙제 수행률</span><small>${rangeName}</small></div>
        </div>
        <div class="divider"></div>
        <div class="dashrow"><span class="k">📘 숙제 기한</span><b>${due.has ? esc(due.label) + '까지' : '오늘 숙제 없음'}</b></div>
        <div class="dashrow"><span class="k">${due.passed ? '⏰' : '⏳'} 기한</span><span class="${due.passed ? 'neg' : 'pos'}">${esc(due.has ? (due.passed ? due.lateText : due.leftText) : '선생님이 숙제를 내면 기한이 생겨요')}</span></div>
        <div class="dashrow"><span class="k">❌ 미제출</span><b>${d.missing.length}명</b><span class="grow"></span>${d.missing.length ? `<span class="hint">${d.missing.map(r => nm(r.student)).join(', ')}</span>` : '<span class="pos">전원 제출 🎉</span>'}</div>
        <div class="dashrow"><span class="k">오답 3단</span><span>전체 <b>${d.wrongTotal}</b> · 아직 <b class="neg">${d.wrongOpen}</b> · 고침 <b class="pos">${d.wrongFixed}</b></span></div>
        <div class="dashrow"><span class="k">✅ 도장</span><span>${d.stamped}/${d.total}명</span></div>
        <div class="dashrow"><span class="k">🔥 연속 숙제 수행</span><span>최고 <b>${Math.max.apply(null, d.rows.map(r => r.streak).concat([0]))}일</b> · 평균 ${Math.round(d.rows.reduce((a, r) => a + r.streak, 0) / (d.rows.length || 1))}일</span></div>
      </div>

      <div class="sect-t"><span>⭐ 질문 · ❌ 많이 틀린 문제 · 📋 못 고친 오답</span><span class="grow"></span><span class="hint">선생님만 보여요</span></div>
      ${teacherLists(cid)}

      <div class="sect-t"><span>학생별 현황 비교</span><span class="grow"></span><span class="hint">${rangeName}</span></div>
      <div class="card tight">
        <div class="dtable">
          <div class="dtrow dthead"><span>학생</span><span>제출</span><span>학습</span><span>오답(남음·고침)</span><span>수정률</span></div>
          ${d.rows.map(r => {
            const handed = r.submitted || r.printSubmitted;
            const pill = r.stamped ? '<span class="pill ok">도장</span>' : r.submitted ? '<span class="pill warn">제출</span>' : r.printSubmitted ? '<span class="pill info">프린트</span>' : '<span class="pill bad">미제출</span>';
            return `<div class="dtrow">
              <span class="dtnm">${nm(r.student)}<small>${r.student.nickname ? esc(r.student.name) : ''}</small></span>
              <span>${pill}</span>
              <span>${r.solved}문항<br><small class="muted">숙제 ${r.hwRate}%</small></span>
              <span><b class="neg">${r.wrongOpen}</b> · <b class="pos">${r.wrongFixed}</b><br><small class="muted">전체 ${r.wrongTotal}</small></span>
              <span><b>${r.fixRate}%</b><br><small class="muted">${r.streak}일</small></span>
            </div>`;
          }).join('')}
        </div>
        <div class="hint wrap" style="margin-top:8px">오답(남음·고침) = 전체 틀린 문제 중 아직 고치지 않은 문제 · 다시 풀어 고친 문제</div>
      </div>

      <button class="btn btn-ghost btn-block btn-sm" data-act="dashOpen" data-k="detail">${open ? '접기' : rangeName + ' 상세 펼치기'}</button>
      ${open ? `<div class="card">
        ${d.rows.map(r => `<div class="dashstu">
          <div class="ds-hd"><b>${nm(r.student)}</b><span class="grow"></span><span class="hint">연속 ${r.streak}일</span></div>
          <div class="ds-line"><span>숙제 수행</span><b>${r.hwRate}%</b></div>${bar(r.hwRate, '#1E293B')}
          <div class="ds-line"><span>오답 수정</span><b>${r.fixRate}%</b></div>${bar(r.fixRate, '#0F8F68')}
          <div class="ds-line"><span>학습량</span><b>${r.solved}문항</b></div>${bar(Math.min(100, r.solved), '#5B47A8')}
        </div>`).join('')}
      </div>` : ''}

      <button class="btn btn-navy btn-block" style="margin-top:4px" data-act="openLessonEdit">📘 오늘 숙제·기한 바꾸기</button>`;
  }

  /** 📊 반 대시보드 — ⭐ 질문 TOP 5 · ❌ 많이 틀린 문제 TOP 5 · 📋 학생별 못 고친 오답 (선생님 전용) */
  function teacherLists(cid) {
    const q = store.questionTop ? store.questionTop(cid, null, 5) : [];
    const w = store.wrongTop ? store.wrongTop(cid, null, 5) : [];
    const open = (store.openWrongByStudent ? store.openWrongByStudent(cid) : []).filter(r => r.rows.length);
    const nm = s => esc(s.nickname || s.name);
    const where = t => t.num === '?'
      ? `${t.page}쪽 <small class="muted">(번호 확인 필요)</small>`
      : `${t.page}쪽 ${esc(t.num)}번`;
    return `
      <div class="card tight tlist">
        <div class="card-hd"><span class="t">⭐ 질문 TOP 5</span><span class="grow"></span><span class="hint">⭕ 맞은 문제 질문 포함</span></div>
        ${q.length ? q.map((t, i) => `<div class="tlwrap">
          <div class="tlrow"><span class="tlno">${i + 1}</span>
            <span class="grow"><b>${where(t)}</b> <small class="muted">${esc(t.book || '')}${t.type ? ' · ' + esc(t.type) : ''}</small></span>
            <span class="tlct">${t.count}명${t.kinds && t.kinds.o ? ` <small class="okc">⭕${t.kinds.o}</small>` : ''}${t.kinds && t.kinds.x ? ` <small class="badc">❌${t.kinds.x}</small>` : ''}</span>
          </div>
          <div class="tlwho">${t.students.map(nm).join(', ')}</div>
        </div>`).join('') : '<div class="empty">오늘 올라온 질문이 없어요</div>'}
      </div>
      <div class="card tight tlist">
        <div class="card-hd"><span class="t">❌ 반 전체 많이 틀린 문제 TOP 5</span><span class="grow"></span><span class="hint">질문 안 눌러도 집계</span></div>
        ${w.length ? w.map((t, i) => `<div class="tlwrap">
          <div class="tlrow"><span class="tlno bad">${i + 1}</span>
            <span class="grow"><b>${where(t)}</b> <small class="muted">${esc(t.book || '')}${t.type ? ' · ' + esc(t.type) : ''}</small></span>
            <span class="tlct">${t.count}명 틀림${t.fixed ? ` <small class="okc">고침 ${t.fixed}</small>` : ''}</span>
          </div>
          <div class="tlwho">${t.students.map(nm).join(', ')}</div>
        </div>`).join('') : '<div class="empty">아직 틀린 문제가 없어요</div>'}
      </div>
      <div class="card tight tlist">
        <div class="card-hd"><span class="t">📋 학생별 못 고친 오답</span><span class="grow"></span><span class="hint">${open.length}명</span></div>
        ${open.length ? open.map(r => `<div class="tlwrap">
          <div class="tlrow"><span class="grow"><b>${nm(r.student)}</b> <small class="muted">${r.rows.length}문제</small></span>
            <button class="btn btn-ghost btn-sm" data-act="openReport" data-id="${r.student.id}">성취도 ›</button></div>
          <div class="tlwho">${r.rows.slice(0, 8).map(x => `${esc(x.label)}${x.star ? '⭐' : ''}${x.carried ? ' ·밀린' : ''}`).join(', ')}${r.rows.length > 8 ? ` 외 ${r.rows.length - 8}문제` : ''}</div>
        </div>`).join('') : '<div class="empty">못 고친 오답이 없어요 🌟</div>'}
      </div>`;
  }

  function teacherReport(c) {
    const cid = c.id;
    const rows = store.classDay(cid);
    return `
      <div class="card">
        ${rows.map(r => `<button class="reprow" data-act="openReport" data-id="${r.student.id}">
          ${avatarHtml(r.student, 34)}
          <span class="grow" style="min-width:0"><b>${esc(r.student.name)}</b> <small>${esc(r.student.nickname || '')}</small></span>
          <span class="muted">연속 ${store.streak(cid, r.student.id)}일 · 오답해결 ${store.parentReport(cid, r.student.id, 'week').fixRate}%</span>
          <span class="chev">›</span></button>`).join('')}
      </div>`;
  }

  function teacherPages(c) {
    const cid = c.id;
    const books = store.bookList();
    const book = view.pmBook || (store.books(cid)[0] || {}).book || books[0];
    view.pmBook = book;
    const pages = store.pagesOfBook(book);
    const l = store.lesson(cid);
    return `
      <div class="tabs-scroll" style="padding:0 0 10px">
        ${books.map(b => `<button class="${b === book ? 'on' : ''}" data-act="pmBook" data-b="${esc(b)}">${esc(b)}</button>`).join('')}
      </div>
      <div class="card">
        ${(() => {
          // 📚 교재 전체를 단원별로 — 한눈에 보면서 고칠 쪽을 찾습니다
          const groups = [];
          pages.forEach(p => {
            const last = groups[groups.length - 1];
            if (last && last.u === p.unit) last.rows.push(p);
            else groups.push({ u: p.unit, name: p.unitName, rows: [p] });
          });
          return groups.map(g => `<div class="unitblk">
            <div class="unithd"><b>${g.u}단원</b> ${esc(g.name || '')}<span class="grow"></span><span class="hint">${g.rows.length}쪽</span></div>
            ${g.rows.map(p => `<button class="pm-row" data-act="pmPage" data-p="${p.page}">
              <div class="pg">${p.page}쪽<br><span style="font-size:9.5px;color:#96A4B8">${esc(p.type)}</span></div>
              <div class="ns">${(p.problems || []).length ? p.problems.map(n => `<span class="n">${esc(n)}</span>`).join('') : '<span class="n empty">개념 설명 (문제 없음)</span>'}</div>
            </button>`).join('')}
          </div>`).join('');
        })()}
      </div>
      <div class="kv" style="margin-top:10px"><span class="k">지금 숙제</span><span>${esc(l.homework)}</span></div>
      <button class="btn btn-primary btn-block" style="margin-top:10px" data-act="lessonEdit">쪽수 바꾸기</button>
      <div class="card tight" style="margin-top:10px">
        <div class="hint">쪽수표에 없는 쪽(예: 18쪽 — 이 책에서 스캔이 빠진 쪽)도 여기서 문제번호를 넣으면 채점할 수 있어요.</div>
        <div class="row" style="margin-top:8px;gap:8px">
          <input id="pmNewPage" class="tinput grow" inputmode="numeric" placeholder="쪽 번호 (예: 18)">
          <button class="btn btn-ghost btn-sm" data-act="pmAddPage">쪽 추가</button>
        </div>
      </div>`;
  }

  function teacherStudents(c) {
    const cid = c.id;
    const act = store.activeStudents(cid);
    const left = store.leftStudents(cid);
    return `
      <div class="card">
        ${act.map(s => `<div class="pinrow">
          ${avatarHtml(s, 32)}
          <span class="grow" style="min-width:0"><b>${esc(s.name)}</b> <small class="muted">${esc(s.nickname || '')}</small></span>
          <span class="pinval" data-pin="${s.id}">${view.pinReveal === s.id ? esc(s.pin) : '••••'}</span>
          <button class="btn btn-ghost btn-sm" data-act="revealPin" data-id="${s.id}">${view.pinReveal === s.id ? '숨기기' : '보기'}</button>
          <button class="btn btn-ghost btn-sm" data-act="resetStudentPin" data-id="${s.id}">PIN 초기화</button>
        </div>
        <div class="stuadmin">
          <button class="linkbtn2" data-act="moveOpen" data-id="${s.id}">↪ 반 이동</button>
          <button class="linkbtn2" data-act="openStuReset" data-id="${s.id}">🔄 기록 초기화</button>
          <button class="linkbtn2 neg" data-act="retire" data-id="${s.id}">🎒 퇴원(보관)</button>
        </div>`).join('')}
      </div>
      <div class="hint wrap" style="margin:6px 4px 10px">PIN 초기화 = 한 번에 <b>1234</b>로 바꿉니다. 아이가 ⚙️ 설정에서 직접 바꿀 수도 있어요.</div>
      ${left.length ? `<div class="sect-t"><span>🎒 퇴원(보관) ${left.length}명</span><span class="grow"></span><span class="hint">기록은 그대로</span></div>
      <div class="card tight">
        ${left.map(s => `<div class="pinrow">
          ${avatarHtml(s, 30)}
          <span class="grow" style="min-width:0"><b>${esc(s.name)}</b> <small class="muted">${esc(s.nickname || '')}</small></span>
          <span class="pill">퇴원 ${esc((s.leftAt || '').slice(5))}</span>
          <button class="btn btn-ghost btn-sm" data-act="restore" data-id="${s.id}">되돌리기</button>
        </div>`).join('')}
      </div>` : ''}
      <div class="hint wrap" style="margin:6px 4px 10px">반 이동·퇴원을 해도 펫·코인·XP·학습 기록(채점·오답·성취도)은 그대로 남습니다.</div>
      <button class="btn btn-ghost btn-block btn-sm" data-act="reissueRecovery">🔑 선생님 비상 복구 키 다시 만들기</button>
      <div class="hint wrap" style="margin:6px 4px 0">복구 키를 잊어버렸을 때만 누르세요. 새 키가 나오고 예전 키는 쓸 수 없어요.</div>
      <div class="kv"><span class="k">반</span><span>${esc(c.name)} · ${esc(c.semester)}</span></div>
      <div class="kv"><span class="k">수업</span><span>${esc(c.days)} ${esc(c.time)}</span></div>
      <div class="kv"><span class="k">교재</span><span>${esc((c.textbooks || []).join(' · '))}</span></div>`;
  }

  /* =========================================================
     시트(모달)들 — 모두 상단 ✕ + 바깥 터치 닫기
  ========================================================= */
  function sheetHtml() {
    const map = {
      gallery: sheetGallery, carry: sheetCarry, onboard: sheetOnboard, pinchange: sheetPinChange,
      profile: sheetProfile, shop: sheetShop, pet: sheetPet, monster: sheetMonster,
      top5big: sheetTop5Big, report: sheetReport, reportimg: sheetReportImg, printset: sheetPrintSet,
      reportcopy: sheetReportCopy,
      lessonEdit: sheetLessonEdit, pmpage: sheetPmPage, yesterday: sheetYesterday,
      photocopy: sheetPhotoCopy, printpick: sheetPrintPick,
      story: storySheet, photoconfirm: sheetPhotoConfirm, nextday: sheetNextDay,
      settings: sheetSettings, bigphoto: sheetBigPhoto, recovery: sheetRecovery,
      moveStu: sheetMoveStu, copyLesson: sheetCopyLesson, startfrom: sheetStartFrom,
      bookall: sheetBookAll, apphelp: sheetAppHelp, stuReset: sheetStuReset,
      kingdom: sheetKingdom
    };
    const fn = map[view.sheet];
    return fn ? fn() : '';
  }

  function sheetPhotoConfirm() {
    const data = view.pending.tempPhoto;
    if (!data) return '';
    const isY = view.pending.tempTarget === 'yesterday';
    return sheetWrap(isY ? '🔥 어제 사진 확인' : '📸 사진 확인', `
      <div class="sub">${isY ? '어제 푼 사진이 맞나요?' : '이 사진으로 제출할까요?'} <b>셀카가 아닌지 확인!</b></div>
      <div class="photo-preview big"><img src="${data}" alt="사진 미리보기"><div class="lock">🔒 나·선생님·(수업 후) 낸 친구들만 볼 수 있어요</div></div>
      <button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-act="confirmPhoto">${isY ? '⏰ 이 사진으로 어제분 올리기' : '📸 이 사진으로 제출하기'}</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="retakePhoto">🔄 다시 찍기 (취소)</button>
    `);
  }

  function sheetNextDay() {
    const rows = view.nextDayRows || [];
    const total = view.nextDayTotal || 0;
    return sheetWrap('🌙 다음 날로 넘겨보기', `
      <div class="sub">안 누른 문제를 내일 아침 밀린문제로 넘겨 봤어요</div>
      <div class="wallet"><span class="w-em">⚔️</span><b>${total}</b>개 넘김 <span class="grow"></span><span class="muted">반 전체</span></div>
      ${rows.map(r => `<div class="kv"><span class="k">${esc(r.name)}${r.real && r.real !== r.name ? ` <small class="muted">${esc(r.real)}</small>` : ''}</span><span>+${r.added}개 · 밀린문제 ${r.total}개</span></div>`).join('')}
      <div class="hint" style="margin-top:10px">아이 화면의 ⚔️ 밀린문제로 넘어갔어요</div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="closeSheet">확인</button>
    `);
  }

  function sheetGallery() {
    const cid = view.classId, sid = view.studentId;
    const c = store.getClass(cid);
    const rows = store.classDay(cid);
    const g = store.galleryInfo(cid, sid);
    const done = rows.filter(r => r.sub).length;
    const nm = s => esc(s.nickname || s.name);

    if (!g.open) {
      const head = g.reason === 'mine' ? '먼저 내 숙제를 내 주세요'
        : g.reason === 'closed' ? '지금은 닫혀 있어요'
          : `수업 시작(${g.startLabel}) 후에 열려요`;
      const body = g.reason === 'mine'
        ? '내 숙제를 내면 친구들 풀이를 볼 수 있어요'
        : g.reason === 'closed'
          ? '선생님이 다시 열어 주면 볼 수 있어요'
          : '수업이 시작되면 낸 친구들끼리 서로 볼 수 있어요';
      return sheetWrap('👀 친구들 풀이', `
        <div class="gatebox">
          <div class="g-em">🔒</div>
          <div class="g-t">${head}</div>
          <div class="g-s">${body}</div>
        </div>
        <div class="hint center">지금 낸 사람 ${done}명</div>
      `);
    }

    return sheetWrap('👀 친구들 풀이', `
      <div class="hint" style="margin-bottom:10px">오늘 ${done}명 · 사진을 누르면 크게 볼 수 있어요</div>
      <div class="glist">
        ${rows.map(r => {
          const sub = r.sub;
          const mine = r.student.id === sid;
          if (!sub) {
            return `<div class="grow-row none">
              ${avatarHtml(r.student, 34)}
              <div class="grow"><b>${nm(r.student)}${mine ? ' <span class="pill">나</span>' : ''}</b>
                <small>아직이에요</small></div>
              <span class="gem">🌱</span>
            </div>`;
          }
          const ph = store.photo(sub.photoId);
          const inner = `
            ${ph ? `<span class="gphoto-wrap"><img class="gphoto" src="${ph.data}" alt="">
              <span class="zoom">확대</span></span>`
              : `<span class="gphoto-wrap"><span class="gphoto none">📷</span></span>`}
            <span class="grow">
              <b>${nm(r.student)}${mine ? ' <span class="pill">나</span>' : ''}</b>
              <small>${sub.stampAt ? '✅ 도장 완료' : '🎉 제출 완료'} · ${esc(sub.at)}</small>
            </span>
            ${ph ? '<span class="go-zoom">크게 ›</span>' : ''}`;
          return ph
            ? `<button class="gitem-row ${mine ? 'me' : ''}" data-act="photoBig" data-sid="${r.student.id}" data-at="${esc(sub.at)}">${inner}</button>`
            : `<div class="gitem-row ${mine ? 'me' : ''}">${inner}</div>`;
        }).join('')}
      </div>
      <div class="gfriendly">점수는 선생님만 봐요 👏</div>
    `);
  }

  function sheetCarry() {
    const cid = view.classId, sid = view.studentId;
    const list = store.carried(cid, sid);
    return sheetWrap('⚔️ 밀린문제', `
      <div class="sub">다시 풀어 고치면 펫 알이 부화해요 🥚</div>
      ${list.map(m => `<div class="kv"><span class="k">${m.em} ${esc(m.name)}<br><span class="muted" style="font-size:11px">${esc(m.label)} · ${esc(m.date.slice(5))}</span></span>
        <button class="btn btn-mint btn-sm" data-act="homeTab" data-t="carry">고치기 →</button></div>`).join('')}
      ${!list.length ? '<div class="empty">밀린문제가 없어요 🎉</div>' : ''}
    `);
  }

  function sheetOnboard() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid);
    const avs = ['🦊', '🐰', '🐯', '🐼', '🐶', '🐨', '🐻', '🐷', '🐸', '🦄'];
    const chosen = view.pending.avatar || me.avatar || '🦊';
    const st = STORY();
    return sheetWrap('내 캐릭터 만들기', `
      <div class="storybox small">
        <div class="s-em">🌑</div>
        <b class="s-title">${esc(st.title || '숫자 왕국 구출 대작전')}</b>
        <p class="s-line">${esc((st.lines || [])[1] || '오답을 다시 풀어 고치면 펫 알이 부화해요!')}</p>
      </div>
      <div class="sub">캐릭터와 닉네임(한글 4자)을 정해요</div>
      <div class="avatars">${avs.map(a => `<button class="${a === chosen ? 'on' : ''}" data-act="avatar" data-a="${a}">${a}</button>`).join('')}</div>
      <div style="margin-top:14px">
        <input id="nickInput" class="tinput" placeholder="닉네임 (예: 도연)" maxlength="4" value="${esc(view.pending.nickname || '')}">
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="saveOnboard">시작하기</button>
    `);
  }

  function sheetProfile() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid);
    const avs = ['🦊', '🐰', '🐯', '🐼', '🐶', '🐨', '🐻', '🐷', '🐸', '🦄'];
    const chosen = view.pending.avatar || me.avatar || '🦊';
    return sheetWrap('캐릭터 · 닉네임', `
      <div class="sub">닉네임은 한글 4자까지</div>
      <div class="avatars">${avs.map(a => `<button class="${a === chosen ? 'on' : ''}" data-act="avatar" data-a="${a}">${a}</button>`).join('')}</div>
      <div style="margin-top:14px">
        <input id="nickInput" class="tinput" placeholder="닉네임" maxlength="4" value="${esc(view.pending.nickname || me.nickname || '')}">
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="saveProfile">저장</button>
    `);
  }

  function sheetPinChange() {
    return sheetWrap('내 PIN 바꾸기', `
      <div class="sub">새 PIN 4자리</div>
      <input id="newPin" class="tinput pininput" inputmode="numeric" maxlength="4" placeholder="새 PIN 4자리">
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="savePin">바꾸기</button>
    `);
  }

  function sheetShop() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid);
    const coins = store.coins(cid, sid);
    const egg = store.eggOf(cid, sid);
    const items = store.shopItems();
    const bag = store.bagOf(cid, sid);
    const pets = store.myPets(cid, sid);
    const rar = GAME().rarity || {};
    const coupons = items.filter(i => i.kind === 'coupon');
    return sheetWrap('🛍️ 상점', `
      <div class="wallet"><span class="w-em">🪙</span><b>${coins}</b>코인</div>

      <div class="eggsect">
        ${egg ? `<div class="eggbox">
          <div class="eggtop"><span class="em eggwig">🥚</span>
            <div class="grow" style="min-width:0"><b>펫 알 ${egg.pct}%</b>
              <div class="lvlbar"><i style="width:${egg.pct}%"></i></div></div></div>
          <button class="btn btn-mint btn-block" data-act="feed" ${coins < 20 ? 'disabled' : ''}>🍎 간식 주기 (20코인)</button>
        </div>` : `<div class="eggbox empty">
          <div class="eggtop"><span class="em">🥚</span><div class="grow"><b>펫 알 사기</b></div></div>
          <button class="btn btn-primary btn-block" data-act="buy" data-id="egg" ${coins < 60 ? 'disabled' : ''}>🥚 펫 알 (60코인)</button>
        </div>`}
      </div>

      <div class="shopgrid">
        ${items.filter(i => i.kind !== 'coupon').map(i => `
          <div class="shopitem ${i.price <= 59 ? 'mini' : ''}">
            <div class="si-em">${i.em}</div>
            <div class="si-nm">${esc(i.name)}</div>
            ${i.kind === 'shield' || i.kind === 'bomb' || i.kind === 'potion' ? `<div class="si-have">가진 것 ${bag[i.kind] || 0}개</div>` : ''}
            ${shopBtn(i, coins, me)}
          </div>`).join('')}
      </div>

      <div class="sect-t"><span>🎁 현실 보상 쿠폰</span><span class="grow"></span><span class="hint">코인 → 간식</span></div>
      ${coupons.length ? `<div class="couponlist">
        ${coupons.map(i => `
          <div class="coupon">
            <span class="c-em">${i.em}</span>
            <span class="c-body"><b>${esc(i.name)}</b>${i.tag ? `<span class="pill">${esc(i.tag)}</span>` : ''}</span>
            ${shopBtn(i, coins, me)}
          </div>`).join('')}
      </div>` : `<div class="card tight"><div class="muted">지금은 쿠폰을 꺼 두었어요</div></div>`}

      <div class="sect-t"><span>🐾 내 펫 ${pets.length}마리</span><span class="grow"></span>
        <button class="linkbtn" data-act="openDex" style="width:auto;padding:0">도감 →</button></div>
      <div class="petgrid mini">
        ${pets.length ? pets.map(p => {
          const r = rar[p.rarity] || {};
          return `<button class="petcard got r-${p.rarity}" data-act="petDetail" data-id="${p.id}">
            <span class="rar">${r.label || ''}</span><span class="pem">${p.em}</span>
            <span class="pnm">${esc(p.name)}</span><span class="ptag">${'⭐'.repeat(Math.min(3, p.lv || 1))}</span></button>`;
        }).join('') : '<div class="muted">아직 펫이 없어요</div>'}
      </div>
    `);
  }

  function sheetPet() {
    const cid = view.classId, sid = view.studentId;
    const cat = store.petCatalog();
    const p = cat.find(x => x.id === view.petDetail);
    if (!p) return '';
    const mine = store.myPets(cid, sid).find(x => x.id === p.id);
    const r = (GAME().rarity || {})[p.rarity] || {};
    const egg = store.eggOf(cid, sid);
    const coins = store.coins(cid, sid);
    return sheetWrap((mine ? p.em + ' ' : '❔ ') + (mine ? esc(p.name) : '아직 못 만난 펫'), `
      <div class="pethero r-${p.rarity}">
        <div class="ph-em">${mine ? p.em : '❔'}</div>
        <div class="ph-rar">${r.label || ''} 등급 · ${r.rate || 0}% 확률</div>
        <div class="ph-line">${mine ? esc(p.line || '') : '오답을 고치면 펫 알이 부화해요'}</div>
        ${mine ? `<div class="ph-tag">${esc(p.tag || '')}</div>
          <div class="ph-stage">${store.petStageLabel(mine).em} <b>${store.petStageOf(mine)}단계 ${store.petStageLabel(mine).name}</b>${store.petStageOf(mine) >= 3 ? ' 👑' : ''}</div>
          <div class="lvlbar" style="max-width:220px;margin:8px auto 0"><i style="width:${store.petNextNeed(mine).pct}%"></i></div>
          <div class="muted" style="margin-top:5px">${store.petStageOf(mine) >= 3 ? '완성! 칭호를 받았어요' : '다음 단계까지 ' + Math.max(0, store.petNextNeed(mine).need - store.petNextNeed(mine).have) + ' XP · 문제를 풀면 자라요'}</div>
          <div class="muted">⭐${mine.lv || 1} · ${esc(mine.at || '')}</div>` : ''}
      </div>
      ${mine ? `<div class="card tight" style="margin:12px 0 0">
        <div class="kv"><span class="k">공격력</span><span>+${store.companionPct(cid, sid)}% (전체)</span></div>
        <div class="kv"><span class="k">성장도</span><span>${store.petStageOf(mine)}/3 단계 · XP ${Number(mine.xp || 0)}</span></div>
      </div>
      ${!egg && (mine.lv || 1) < 3 ? `<button class="btn btn-mint btn-block" style="margin-top:10px" data-act="growCompanion" data-id="${p.id}" ${coins < 20 ? 'disabled' : ''}>🍎 간식으로 키우기 (20코인)</button>` : ''}
      ${egg ? '<div class="hint center" style="margin-top:8px">지금은 펫 알을 키우는 중이에요</div>' : ''}
      ` : ''}
      <div class="muted center" style="margin-top:12px">도감 ${store.myPets(cid, sid).length}/${cat.length}</div>
    `);
  }

  function sheetMonster() {
    const cid = view.classId, sid = view.studentId;
    const m = store.darkEggs(cid, sid).find(x => x.id === view.monsterDetail);
    if (!m) return '';
    return sheetWrap('❌ 못 고친 오답', `
      <div class="pethero dark">
        <div class="ph-em darkegg">🥚</div>
        <div class="ph-rar">${m.today ? '오늘 생긴 오답' : '밀린문제'}</div>
        <div class="ph-line">${m.page}쪽 ${m.num}번</div>
      </div>
      <div class="kv"><span class="k">문제</span><span>${esc(m.book ? m.book + ' ' : '')}${esc(String(m.page))}쪽 ${esc(String(m.num))}번</span></div>
      ${m.unitName ? `<div class="kv"><span class="k">단원</span><span>${esc(m.unitName)}</span></div>` : ''}
      <div class="kv"><span class="k">상태</span><span>${m.reason === 'star' ? '⭐ 질문' : m.reason === 'skip' ? '⏭️ 안 풀었음' : '❌ 틀림'}</span></div>
      ${m.today
        ? `<button class="btn btn-mint btn-block" style="margin-top:12px" data-act="fixNow">⚔️ 지금 고치기</button>`
        : `<button class="btn btn-mint btn-block" style="margin-top:12px" data-act="homeTab" data-t="carry">⚔️ 밀린문제에서 고치기 →</button>`}
    `);
  }

  function sheetTop5Big() {
    const cid = view.classId;
    const list = store.top5(cid);
    return sheetWrap('📺 질문 TOP 5', `
      <div class="biglist">
        ${list.length ? list.map((t, i) => `<div class="bigrow">
          <span class="bno">${i + 1}</span>
          <span class="blb">${t.page}쪽 <b>${esc(t.num)}</b>번<small>${esc(t.type || '')} · ${t.count}명</small></span>
        </div>`).join('') : '<div class="empty">오늘 별표가 없어요.</div>'}
      </div>

    `, { wide: true });
  }

  /* =========================================================
     🎓 어머님용 성취도 리포트 — 전문 학원 성적표 톤 (게임 용어 없음)
       학습 성실도 / 풀이·오답 해결 / 오답 원인 3비율 / 취약 단원 / 단원평가
  ========================================================= */
  const TAG_COLOR = { calc: '#2B5FA8', read: '#B07A16', concept: '#C0392B' };
  const dotted = iso => String(iso || '').slice(0, 10).replace(/-/g, '.');
  const shortDot = iso => { const p = String(iso || '').split('-'); return p.length === 3 ? (+p[1] + '.' + p[2]) : ''; };

  function rcBar(pct, cls) {
    const w = Math.max(0, Math.min(100, Math.round(pct || 0)));
    return `<div class="rc-bar ${cls || ''}"><i style="width:${w}%"></i></div>`;
  }

  /** 📈 최근 7일 미니 성장 그래프 — 학습량(남색 막대) · 오답 해결(초록 막대) */
  function growthBars(g, opt) {
    const list = g || [];
    const max = Math.max(1, list.reduce((a, d) => Math.max(a, d.solved, d.fixed), 1));
    /* ★ v2.0 — 높이를 %가 아니라 px로 (막대가 바닥에 붙어 안 보이던 문제) */
    const H = opt && opt.small ? 44 : 56;
    const px = v => (Number(v) > 0 ? Math.max(5, Math.round(Number(v) / max * H)) : 2);
    return `<div class="gbars ${opt && opt.small ? 'small' : ''}">${list.map(d => `<div class="gcol ${d.today ? 'today' : ''}">
      <div class="gbar"><i style="height:${px(d.solved)}px"></i><b style="height:${px(d.fixed)}px"></b></div>
      <span class="gd">${d.dow}</span></div>`).join('')}</div>`;
  }
  function growthCard(cid, sid) {
    const g = store.growth ? store.growth(cid, sid, 7) : [];
    const solved = g.reduce((a, d) => a + d.solved, 0);
    const fixed = g.reduce((a, d) => a + d.fixed, 0);
    return `<div class="card growthcard">
      <div class="card-hd"><span class="t">📈 최근 7일 성장</span><span class="grow"></span>
        <span class="hint">학습 ${solved} · 오답 해결 ${fixed}</span></div>
      ${growthBars(g)}
      <div class="glegend"><span><i class="lg-solved"></i>푼 문제</span><span><i class="lg-fix"></i>오답 해결</span></div>
    </div>`;
  }

  function reportCardHtml(s, c, r) {
    const nm = s.nickname && s.nickname !== s.name ? `<span class="rc-nick">${esc(s.nickname)}</span>` : '';
    const tags = r.tags.map(t => `<div class="rc-tag">
        <div class="rc-tagline">
          <span class="rc-dot" style="background:${TAG_COLOR[t.id] || '#334155'}"></span>
          <span class="rc-taglab">${esc(t.label)}</span>
          <span class="rc-tagpct" style="color:${TAG_COLOR[t.id] || '#334155'}">${t.pct}%</span>
        </div>
        <div class="rc-bar sm"><i style="width:${t.pct}%;background:${TAG_COLOR[t.id] || '#334155'}"></i></div>
      </div>`).join('');
    const units = r.units.length
      ? r.units.map(u => `<div class="rc-unit">
          <span class="rc-unit-nm">${esc(u.name)}</span>
          <span class="rc-unit-v">오답 <b>${u.wrong}</b>개 <em>(${u.pct || 0}%)</em>${u.fixed ? ` · 재풀이 <b>${u.fixed}</b>` : ''}</span>
        </div>`).join('')
      : '<div class="rc-empty">이 기간에 오답 기록이 없습니다.</div>';
    const dayList = (r.dayList || []).map(d => `<div class="rc-day">
        <div class="rc-day-d">${esc(d.label)}</div>
        <div class="rc-day-b">
          ${d.lesson ? `<div class="rc-day-l"><b>진도</b><span>${esc(d.lesson)}</span></div>` : ''}
          ${d.homework ? `<div class="rc-day-l"><b>숙제</b><span>${esc(d.homework)}</span></div>` : ''}
        </div>
      </div>`).join('');
    /* 이번 달 — 단원명 + 전체 쪽수 한 줄 / 이번 학기 — 진도 목록 없음 */
    const monthLine = r.range === 'month'
      ? (r.monthSummary
        ? `<div class="rc-summary"><b>${esc(r.monthSummary.text)}</b></div>`
        : '<div class="rc-empty">이번 달 진도 기록이 없습니다.</div>')
      : '';
    const printList = (r.printList || []).map(p =>
      `<div class="rc-extra">추가 과제 · 개별 오답프린트 <b>${p.count}문항</b> 배부 <small>${esc(p.label)}</small></div>`).join('');
    const lessonSection = r.range === 'semester' ? '' : `<div class="rc-sec">
        <div class="rc-t">${r.range === 'week' ? '이번 주 진도 · 숙제 (최근 2회)' : '이번 달 진도'}</div>
        ${r.range === 'month' ? monthLine : (dayList || '<div class="rc-empty">이번 주 진도 기록이 없습니다.</div>')}
        ${r.range === 'week' ? printList : ''}
      </div>`;
    const tagBlock = r.wrong === 0
      ? '<div class="rc-empty">이번 기간 오답 없음</div>'
      : r.tagTotal
        ? tags
        : `<div class="rc-empty">오답 ${r.wrong}개 · 이유 미선택</div>`;
    const exams = r.exams.length
      ? r.exams.slice(-3).map(e => `<div class="rc-unit exam">
          <span class="rc-unit-nm">${esc(e.unit.replace(' 평가', ''))} <small>${esc(shortDot(e.date))}</small></span>
          <span class="rc-unit-v"><b>${e.score}점</b>${e.retest != null ? ` <small>재시 ${e.retest}점</small>` : ''}</span>
        </div>`).join('')
      : '<div class="rc-empty">이 기간에 응시한 단원평가가 없습니다.</div>';

    return `<div class="report-card">
      <div class="rc-hd">
        <span class="rc-brand">학습 성취도 리포트</span>
        <span class="rc-period">${dotted(r.from)} – ${shortDot(r.to)}</span>
      </div>
      <div class="rc-who">
        <div class="rc-name">${esc(s.name)}${nm}</div>
        <div class="rc-class">${esc(c.name || '')}${c.days ? ` · ${esc(c.days)}` : ''}${c.time ? ` ${esc(c.time)}` : ''}</div>
      </div>
      <div class="rc-sec">
        <div class="rc-t">학습 성실도</div>
        <div class="rc-grid2">
          <div class="rc-stat"><div class="v">${r.streak}일</div><div class="l">연속 학습</div></div>
          <div class="rc-stat"><div class="v">${r.hwRate}%</div><div class="l">숙제 완료율</div></div>
        </div>
        ${rcBar(r.hwRate)}
        <div class="rc-sub">${r.classDays ? `숙제 ${r.classDays}회 중 ${r.doneClassDays}회 완료` : '이번 기간 숙제 기록 없음'}</div>
      </div>
      ${lessonSection}
      ${(r.growth && r.growth.length) ? `<div class="rc-sec">
        <div class="rc-t">최근 7일 성장</div>
        ${growthBars(r.growth)}
        <div class="rc-glegend"><span><i class="lg-solved"></i>푼 문제</span><span><i class="lg-fix"></i>오답 해결</span></div>
      </div>` : ''}
      <div class="rc-sec">
        <div class="rc-t">풀이 및 오답 해결</div>
        <div class="rc-line">총 <b>${r.solved}</b>문항 풀이 · 오답 <b>${r.wrong}</b>개 중 <b>${r.fixed}</b>개 재풀이 완료</div>
        ${rcBar(r.fixRate, 'mint')}
        <div class="rc-sub">오답 해결률 ${r.fixRate}%</div>
      </div>
      <div class="rc-sec">
        <div class="rc-t">오답 원인 분석</div>
        ${tagBlock}
      </div>
      <div class="rc-sec">
        <div class="rc-t">취약 단원</div>
        ${units}
      </div>
      <div class="rc-sec">
        <div class="rc-t">학원 단원평가</div>
        ${r.avgExam != null ? `<div class="rc-avg"><b>${r.avgExam}점</b><span>기간 평균 · ${r.exams.length}회 응시</span></div>` : ''}
        ${exams}
      </div>
      <div class="rc-foot">${dotted(r.to)} 기준 · 학습 기록 자동 집계</div>
    </div>`;
  }

  /** 같은 내용을 PNG 이미지로 — 정확히 같은 항목만 담습니다 */
  function reportImageData(s, c, r) {
    const W = 380, PAD = 26, SCALE = 2;
    const INK = '#1F2937', MUTED = '#6B7280', LINE = '#E5E7EB', NAVY = '#1E293B', SOFT = '#F8FAFC';
    const FONT = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';

    function draw(ctx) {
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, 4000);
      let y = 32;
      const setF = (size, weight) => { ctx.font = `${weight || 400} ${size}px ${FONT}`; };
      const txt = (str, x, yy, size, weight, color, align) => {
        setF(size, weight); ctx.fillStyle = color || INK;
        ctx.textAlign = align || 'left';
        ctx.fillText(String(str), x, yy);
        ctx.textAlign = 'left';
      };
      const hair = (yy) => { ctx.fillStyle = LINE; ctx.fillRect(PAD, yy, W - PAD * 2, 0.7); };
      const rr = (x, yy, w, h, rad, fill) => {
        const r0 = Math.min(rad, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r0, yy); ctx.lineTo(x + w - r0, yy);
        ctx.quadraticCurveTo(x + w, yy, x + w, yy + r0);
        ctx.lineTo(x + w, yy + h - r0);
        ctx.quadraticCurveTo(x + w, yy + h, x + w - r0, yy + h);
        ctx.lineTo(x + r0, yy + h);
        ctx.quadraticCurveTo(x, yy + h, x, yy + h - r0);
        ctx.lineTo(x, yy + r0);
        ctx.quadraticCurveTo(x, yy, x + r0, yy);
        ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
      };
      const bar = (pct, yy, color, h) => {
        const w = W - PAD * 2;
        rr(PAD, yy, w, h || 5, (h || 5) / 2, '#EEF1F5');
        const fw = Math.max(0, Math.min(1, (pct || 0) / 100)) * w;
        if (fw > 0) rr(PAD, yy, Math.max(fw, (h || 5)), h || 5, (h || 5) / 2, color || '#1E293B');
      };
      const section = (label) => {
        y += 21;
        ctx.fillStyle = '#D9532B';
        ctx.fillRect(PAD, y - 9, 2.5, 10);
        txt(label, PAD + 9, y, 10, 700, NAVY);
        y += 14;
      };
      const wrap = (str, x, yy, size, weight, color, maxW, lh) => {
        setF(size, weight); ctx.fillStyle = color || INK; ctx.textAlign = 'left';
        const words = String(str).split(' ');
        let line = '', outY = yy;
        words.forEach(w => {
          const test = line ? line + ' ' + w : w;
          if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, outY); outY += lh; line = w; }
          else line = test;
        });
        if (line) { ctx.fillText(line, x, outY); outY += lh; }
        return outY;
      };

      /* 머리 — 남색 머리띠로 성적표답게 (v1.1 디자인) */
      ctx.fillStyle = NAVY;
      ctx.fillRect(0, 0, W, 62);
      txt('학습 성취도 리포트', PAD, 28, 13.5, 700, '#FFFFFF');
      txt('HOMEWORK & ACHIEVEMENT', PAD, 44, 6.6, 700, 'rgba(255,255,255,.6)');
      txt(`${dotted(r.from)} – ${shortDot(r.to)}`, W - PAD, 28, 8.6, 600, 'rgba(255,255,255,.85)', 'right');
      txt(r.label, W - PAD, 44, 8, 700, '#FFCF4D', 'right');
      y = 86;
      setF(21, 700);
      txt(s.name, PAD, y, 21, 700, INK);
      if (s.nickname && s.nickname !== s.name) {
        const nw = ctx.measureText(s.name).width;
        txt(s.nickname, PAD + nw + 6, y, 10, 500, MUTED);
      }
      y += 15;
      txt(`${c.name || ''}${c.days ? ' · ' + c.days : ''}${c.time ? ' ' + c.time : ''}`, PAD, y, 9, 500, MUTED);

      /* 학습 성실도 */
      section('학습 성실도');
      const bw = (W - PAD * 2 - 8) / 2;
      rr(PAD, y, bw, 46, 8, SOFT); rr(PAD + bw + 8, y, bw, 46, 8, SOFT);
      txt(`${r.streak}일`, PAD + 12, y + 21, 17, 700, NAVY);
      txt('연속 학습', PAD + 12, y + 36, 8.5, 600, MUTED);
      txt(`${r.hwRate}%`, PAD + bw + 20, y + 21, 17, 700, NAVY);
      txt('숙제 완료율', PAD + bw + 20, y + 36, 8.5, 600, MUTED);
      y += 54;
      bar(r.hwRate, y, '#1E293B', 5);
      y += 16;
      txt(r.classDays ? `숙제 ${r.classDays}회 중 ${r.doneClassDays}회 완료` : '이번 기간 숙제 기록 없음', PAD, y, 8, 500, MUTED);

      /* 진도 — 이번 주는 최근 2회 / 이번 달은 1줄 요약 / 이번 학기는 목록 없음 */
      if (r.range === 'week') {
        section('이번 주 진도 · 숙제 (최근 2회)');
        if (!(r.dayList || []).length) { txt('이번 주 진도 기록이 없습니다.', PAD, y, 8.5, 500, MUTED); y += 14; }
        (r.dayList || []).forEach(d => {
          txt(d.label, PAD, y, 9, 700, NAVY);
          y += 12;
          if (d.lesson) {
            txt('진도', PAD, y, 8, 800, '#8A94A6');
            y = wrap(d.lesson, PAD + 24, y, 8.5, 500, INK, W - PAD * 2 - 24, 11);
          }
          if (d.homework) {
            txt('숙제', PAD, y, 8, 800, '#8A94A6');
            y = wrap(d.homework, PAD + 24, y, 8.5, 500, INK, W - PAD * 2 - 24, 11);
          }
          y += 5;
        });
        (r.printList || []).forEach(p => {
          y = wrap(`추가 과제 · 개별 오답프린트 ${p.count}문항 배부 (${p.md})`, PAD, y, 8.5, 600, '#B4562B', W - PAD * 2, 11);
        });
        y -= 2;
      } else if (r.range === 'month') {
        section('이번 달 진도');
        if (r.monthSummary) {
          rr(PAD, y - 12, W - PAD * 2, 34, 8, '#F5F7FA');
          y = wrap(r.monthSummary.text, PAD + 10, y + 4, 9, 700, NAVY, W - PAD * 2 - 20, 12);
          y += 6;
        } else { txt('이번 달 진도 기록이 없습니다.', PAD, y, 8.5, 500, MUTED); y += 14; }
      }

      /* 풀이 및 오답 해결 */
      section('풀이 및 오답 해결');
      txt(`총 ${r.solved}문항 풀이 · 오답 ${r.wrong}개 중 ${r.fixed}개 재풀이 완료`, PAD, y, 9.5, 600, INK);
      y += 10;
      bar(r.fixRate, y, '#0F8F68', 5);
      y += 16;
      txt(`오답 해결률 ${r.fixRate}%`, PAD, y, 8, 500, MUTED);

      /* 오답 원인 분석 */
      section('오답 원인 분석');
      if (r.wrong === 0) {
        txt('이번 기간 오답 없음', PAD, y, 9, 600, MUTED);
        y += 14;
      } else if (!r.tagTotal) {
        txt(`오답 ${r.wrong}개 · 이유 미선택`, PAD, y, 9, 600, MUTED);
        y += 14;
      } else {
        r.tags.forEach(t => {
          txt(t.label, PAD, y, 9.5, 600, INK);
          txt(t.pct + '%', W - PAD, y, 9.5, 700, TAG_COLOR[t.id] || INK, 'right');
          y += 6;
          bar(t.pct, y, TAG_COLOR[t.id] || '#334155', 4);
          y += 16;
        });
        y -= 4;
      }

      /* 취약 단원 — 오답 수 + 전체 대비 비율 */
      section('취약 단원');
      if (r.units.length) {
        r.units.forEach(u => {
          txt(u.name, PAD, y, 9.5, 600, INK);
          txt(`오답 ${u.wrong}개 (${u.pct || 0}%)${u.fixed ? ` · 재풀이 ${u.fixed}` : ''}`, W - PAD, y, 8.5, 600, MUTED, 'right');
          y += 18;
        });
        y -= 4;
      } else {
        txt('이 기간에 오답 기록이 없습니다.', PAD, y, 8.5, 500, MUTED);
        y += 14;
      }

      /* 최근 7일 성장 그래프 — 학습량(검남) · 오답 해결(초록). 요일 라벨과 범례 사이에 충분한 여백 */
      if (r.growth && r.growth.length) {
        section('최근 7일 성장');
        const maxV = Math.max(1, Math.max.apply(null, r.growth.map(g => Math.max(g.solved, g.fixed))));
        const gw = W - PAD * 2, colW = gw / r.growth.length, bw2 = Math.min(9, colW * .3);
        const barH = 34, baseY = y + barH;
        ctx.fillStyle = '#E8EDF2';
        ctx.fillRect(PAD, baseY, gw, 0.8);          // 막대 바닥선 — 0인 날도 눈에 보이게
        r.growth.forEach((g, i) => {
          const cx = PAD + colW * i + colW / 2;
          const hs = Math.round((g.solved / maxV) * barH), hf = Math.round((g.fixed / maxV) * barH);
          if (hs) rr(cx - bw2 - 1.5, baseY - hs, bw2, hs, 2, g.today ? '#111827' : '#94A3B8');
          if (hf) rr(cx + 1.5, baseY - hf, bw2, hf, 2, '#0F8F68');
          txt(g.dow, cx, baseY + 13, 7.5, 700, g.today ? NAVY : '#9CA3AF', 'center');
        });
        y = baseY + 30;                      // 요일 라벨 아래 17px 여백 뒤에 범례
        rr(PAD, y - 5.5, 7, 4, 2, '#94A3B8');
        txt('막대 = 그날 푼 문항', PAD + 10, y, 7.6, 600, '#8A94A6');
        rr(PAD + 104, y - 5.5, 7, 4, 2, '#0F8F68');
        txt('초록 = 다시 풀어 해결한 오답', PAD + 114, y, 7.6, 600, '#0F8F68');
        y += 12;
      }

      /* 학원 단원평가 */
      section('학원 단원평가');
      if (r.avgExam != null) {
        setF(17, 700);
        txt(`${r.avgExam}점`, PAD, y + 3, 17, 700, NAVY);
        const aw = ctx.measureText(`${r.avgExam}점`).width;
        txt(`기간 평균 · ${r.exams.length}회 응시`, PAD + aw + 8, y + 3, 8.5, 500, MUTED);
        y += 16;
      }
      if (r.exams.length) {
        r.exams.slice(-3).forEach(e => {
          txt(`${e.unit.replace(' 평가', '')} (${shortDot(e.date)})`, PAD, y, 9, 500, INK);
          txt(`${e.score}점${e.retest != null ? ` · 재시 ${e.retest}점` : ''}`, W - PAD, y, 9, 700, NAVY, 'right');
          y += 16;
        });
        y -= 4;
      } else {
        txt('이 기간에 응시한 단원평가가 없습니다.', PAD, y, 8.5, 500, MUTED);
        y += 14;
      }

      /* 꼬리 */
      y += 12; hair(y);
      y += 14;
      txt(`${dotted(r.to)} 기준 · 학습 기록 자동 집계`, PAD, y, 8, 500, '#9CA3AF');
      return y + 16;
    }

    const tmp = document.createElement('canvas');
    tmp.width = W * SCALE; tmp.height = 4000;
    const endY = draw(tmp.getContext('2d'));
    const cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = Math.ceil(endY) * SCALE;
    draw(cv.getContext('2d'));
    return { data: cv.toDataURL('image/png'), w: W, h: Math.ceil(endY) };
  }

  function sheetReport() {
    const cid = view.classId;
    const sid = view.reportSid;
    const s = store.student(cid, sid);
    if (!s) return '';
    const c = store.getClass(cid);
    const rg = view.reportRange || 'week';
    const r = store.parentReport(cid, sid, rg);
    const text = store.kakaoSummary(cid, sid, rg);
    return sheetWrap('📊 ' + esc(s.name) + ' 성취도 리포트', `
      <div class="segmented">
        <button class="${rg === 'week' ? 'on' : ''}" data-act="reportRange" data-r="week">이번 주</button>
        <button class="${rg === 'month' ? 'on' : ''}" data-act="reportRange" data-r="month">이번 달</button>
        <button class="${rg === 'semester' ? 'on' : ''}" data-act="reportRange" data-r="semester">이번 학기</button>
      </div>
      ${reportCardHtml(s, c, r)}
      <div class="card tight" style="margin-top:12px">
        <div class="card-hd"><span class="t">📋 어머님께 보낼 카톡</span></div>
        <pre class="kakao" id="kakaoText">${esc(text)}</pre>
        <div class="row" style="gap:8px">
          <button class="btn btn-primary grow" data-act="copyReport">📋 카톡 복사</button>
          <button class="btn btn-ghost grow" data-act="saveReportImage">📸 이미지로 저장</button>
        </div>
        <button class="btn btn-ghost btn-block btn-sm" style="margin-top:8px" data-act="openCopyText">👀 복사할 글 직접 보기 · 전체 선택</button>
      </div>

    `, { wide: true });
  }

  function sheetReportImg() {
    if (!view.reportImg) return '';
    const nm = view.reportImgName || '성취도리포트.png';
    return sheetWrap('📸 성취도 리포트 이미지', `
      <div class="sub">아래 이미지를 저장해 카톡으로 보내면 됩니다.</div>
      <img class="report-img" src="${view.reportImg}" alt="성취도 리포트 이미지">
      <a class="btn btn-primary btn-block" style="margin-top:12px" href="${view.reportImg}" download="${esc(nm)}">⬇️ 이미지 저장</a>
      <div class="hint center" style="margin-top:8px">아이폰은 이미지를 길게 눌러 <b>사진에 저장</b>을 눌러 주세요.</div>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="backReport">← 리포트로 돌아가기</button>
    `, { wide: true });
  }

  function sheetReportCopy() {
    const cid = view.classId, sid = view.reportSid;
    const s = store.student(cid, sid);
    if (!s) return '';
    const text = store.kakaoSummary(cid, sid, view.reportRange || 'week');
    return sheetWrap('📋 카톡 글 직접 복사', `
      <div class="sub">아래 글을 <b>길게 눌러 전체 선택 → 복사</b>한 뒤 카톡에 붙여넣어 주세요.</div>
      <textarea class="copy-area" id="copyArea" readonly rows="12">${esc(text)}</textarea>
      <button class="btn btn-primary btn-block" style="margin-top:10px" data-act="copyAgain">📋 복사 다시 시도</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="copySelectAll">전체 선택</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="backReport">← 리포트로 돌아가기</button>
    `, { wide: true });
  }

  function sheetPrintSet() {
    const cid = view.classId;
    const sid = view.printSid;
    const s = store.student(cid, sid);
    const info = store.printInfo(cid, sid);
    // 방금 누른 값(view.printInput)을 먼저 보고, 없으면 저장된 값
    const typed = view.printInput;
    const cur = (typed !== '' && typed != null && !isNaN(Number(typed))) ? Number(typed) : (info ? info.count : 0);
    return sheetWrap('📝 오답프린트 설정', `
      <div class="sub">${esc(s.name)} 학생에게 오늘 낼 <b>오답프린트 문제 수</b>를 넣어 주세요. 1~N번 타일이 바로 생겨요.</div>
      <div class="printpick">
        ${[10, 15, 18, 20, 25, 30].map(n => `<button class="numtile ${cur === n ? 'on' : ''}" data-act="printNum" data-n="${n}">${n}문제</button>`).join('')}
      </div>
      <input id="printInput" class="tinput" inputmode="numeric" placeholder="직접 입력 (예: 18)" value="${cur || ''}">
      <div class="hint" style="margin-top:8px">제출 완료 전에는 날이 바뀌어도 그대로 이어져요.</div>
      <div class="sect-t" style="margin-top:12px"><span>같은 문제 수를 다른 학생에게</span><span class="grow"></span><span class="hint">${esc(s.name)} → </span></div>
      <div class="chipx">
        ${store.activeStudents(cid).filter(x => x.id !== sid).map(x => `<button class="chipx-item" data-act="copyPrintOne" data-id="${x.id}">${esc(x.nickname || x.name)}</button>`).join('')}
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn btn-primary grow" data-act="savePrint">저장</button>
        ${(info || cur) ? `<button class="btn btn-danger" data-act="clearPrint">없애기</button>` : ''}
      </div>
    `);
  }

  function sheetPrintPick() {
    const cid = view.classId, sid = view.studentId;
    return sheetWrap('📝 내 프린트는 몇 번까지?', `
      <div class="sub">오늘 받은 오답프린트의 <b>마지막 번호</b>를 고르면 그만큼 채점 칸이 생겨요.</div>
      <div class="printpick">
        ${[10, 12, 15, 18, 20, 25].map(n => `<button class="numtile" data-act="printPickNum" data-n="${n}">${n}번</button>`).join('')}
      </div>
      <input id="printPickInput" class="tinput" inputmode="numeric" placeholder="직접 입력 (예: 18)">
      <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="savePrintPick">확인</button>
    `);
  }

  function sheetLessonEdit() {
    const cid = view.classId;
    const books = store.bookList();
    const book = view.lessonEditBook || (store.books(cid)[0] || {}).book || books[0];
    view.lessonEditBook = book;
    const saved = (store.books(cid).find(b => b.book === book) || { pages: [] }).pages;
    const pages = (view.lessonEditPages != null ? view.lessonEditPages.slice() : saved.slice()).sort((a, b) => a - b);
    if (view.lessonEditMode == null) view.lessonEditMode = '';
    const mode = EMA.util.HW_MODES.indexOf(view.lessonEditMode) > 0 ? view.lessonEditMode : '';
    const tiles = store.tilesOf(book, pages, mode);
    const missing = pages.filter(p => !store.pageInfo(book, p));
    const due = view.lessonEditDue != null ? view.lessonEditDue : store.dueAtOf(cid);
    const nextDue = store.defaultDueAt(cid);
    return sheetWrap('📘 숙제 쪽수 · 제출 기한', `
      <div class="sub">쪽수 범위를 적으면 칸이 <b>자동으로</b> 생겨요. 만든 칸은 눌러서 하나씩 뺄 수 있어요.</div>
      <div class="tabs-scroll" style="padding:0 0 10px">
        ${books.map(b => `<button class="${b === book ? 'on' : ''}" data-act="lessonBook" data-b="${esc(b)}">${esc(b)}</button>`).join('')}
      </div>
      <div class="editor"><input id="pageInput" value="${esc(view.lessonEditInput != null ? view.lessonEditInput : pagesText(pages))}" placeholder="19~22쪽 (유제만) · 8-10, 12쪽"></div>
      <button class="btn btn-ghost btn-block btn-sm" style="margin-top:8px" data-act="lessonRange">🔢 이 범위로 칸 만들기</button>
      <button class="btn btn-navy btn-block btn-sm" style="margin-top:8px" data-act="bookAllOpen">📚 책 전체 보기 · 단원·쪽수 한번에 고르기</button>
      <div class="sect-t" style="margin-top:14px"><span>🎯 숙제 범위</span><span class="grow"></span><span class="hint">학생은 고르지 못해요</span></div>
      <div class="segmented mode4" style="margin:0">
        ${[['', '전체'], ['yooh', '유제만(-1)'], ['odd', '홀수'], ['even', '짝수']].map(x =>
          `<button class="${mode === x[0] ? 'on' : ''}" data-act="lessonMode" data-m="${x[0]}">${x[1]}</button>`).join('')}
      </div>
      <div class="hint wrap" style="margin-top:6px">유제만 = 대표번호(1,2,3…)를 빼고 <b>1-1, 2-1</b> 같은 유제만 · 쪽수 칸에 <b>19~22 (유제만)</b>처럼 적어도 됩니다.</div>
      <div class="chipx">${pages.length ? pages.map(p => `<button class="chipx-item" data-act="lessonPageDel" data-p="${p}">${p}쪽 ✕</button>`).join('') : '<span class="hint">아직 쪽이 없어요 — 위에 범위를 적어 주세요</span>'}</div>
      <div class="row" style="margin-top:8px;gap:8px">
        <input id="lessonNewPage" class="tinput grow" inputmode="numeric" placeholder="쪽 하나 추가 (예: 18)">
        <button class="btn btn-ghost btn-sm" data-act="lessonPageAdd">추가</button>
      </div>
      <div class="tilecount">→ <b>${EMA.util.HW_MODE_LABEL[mode] || '전체'}</b> 문제 <b>${tiles.length}</b>개${tiles.length ? ': ' + tiles.slice(0, 12).map(t => t.label).join(', ') + (tiles.length > 12 ? ' …' : '') : ''}</div>
      ${missing.length ? `<div class="card tight missing-note" style="margin-top:10px"><div class="muted wrap" style="font-size:12px;white-space:normal">⚠️ <b>${missing.join(', ')}쪽</b>은 쪽수표에 없어요. 저장은 되지만 채점하려면 <b>⚙️ 관리 → 쪽수표 → 쪽 추가</b>에서 그 쪽 문제번호를 넣어 주세요.</div></div>` : ''}
      <div class="sect-t" style="margin-top:14px"><span>⏰ 제출 기한</span><span class="grow"></span><span class="hint">${esc(store.dueInfo(cid).leftText || store.dueInfo(cid).lateText)}</span></div>
      <input id="dueAt" class="tinput" type="datetime-local" value="${esc(String(due).replace(' ', 'T'))}">
      <div class="row" style="margin-top:8px;gap:8px">
        <button class="btn btn-ghost btn-sm grow" data-act="dueNext">다음 수업일 (${esc(nextDue)})</button>
        <button class="btn btn-ghost btn-sm grow" data-act="dueClear">기한 없음</button>
      </div>
      <div class="hint wrap" style="margin-top:8px">비워 두면 기한 없이 계속 진행 중이에요. 기한이 지나면 그때 안 푼 문제만 ⚔️ 밀린문제로 넘어갑니다.</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="saveLesson">저장</button>
    `);
  }

  function sheetPmPage(c) {
    const list = view.pmList != null ? view.pmList : rangeList(view.pmInput);
    return sheetWrap(`${esc(view.pmBook)} ${view.pmPage}쪽 문제번호`, `
      <div class="sub">범위로 적으면 <b>1~14번, 15~28번</b>처럼 자동으로 칸이 생겨요. 만든 번호는 눌러서 하나씩 뺄 수 있어요.</div>
      <div class="editor"><input id="pmInput" value="${esc(view.pmInput)}" placeholder="1-14, 15-28"></div>
      <button class="btn btn-ghost btn-block btn-sm" style="margin-top:8px" data-act="pmRange">🔢 이 범위로 번호 만들기</button>
      <div class="chipx">${list.length ? list.map(n => `<button class="chipx-item" data-act="pmDel" data-n="${esc(n)}">${esc(n)}번 ✕</button>`).join('') : '<span class="hint">아직 번호가 없어요</span>'}</div>
      <div class="row" style="margin-top:8px;gap:8px">
        <input id="pmNewNo" class="tinput grow" placeholder="번호 하나 추가 (예: 2-1)">
        <button class="btn btn-ghost btn-sm" data-act="pmAdd">추가</button>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="pmSave">저장</button>
    `);
  }

  /** 🏫 몇 번부터 숙제? — 수업에서 앞부분을 풀고 남은 번호부터 시작 */
  function sheetStartFrom() {
    const tiles = sourceTiles();
    const g = sourceGrade();
    const groups = [];
    tiles.forEach(t => {
      if (t.missing) return;
      const last = groups[groups.length - 1];
      if (last && last.page === t.page && last.book === t.book) last.items.push(t);
      else groups.push({ page: t.page, book: t.book, type: t.type, items: [t] });
    });
    return sheetWrap('🏫 몇 번부터 숙제?', `
      <div class="sub">수업 때 앞에서 같이 푼 번호는 빼고, <b>남은 번호부터</b> 채점해요. 시작할 번호를 하나만 누르세요.</div>
      ${groups.map(gr => `<div class="sfgroup">
        <div class="sfpage">${esc(gr.book.indexOf('응용') >= 0 ? '응용 ' : '')}${gr.page}쪽${gr.type && gr.type !== '표없음' ? ' · ' + esc(gr.type) : ''}</div>
        <div class="sfgrid">${gr.items.map(t => `<button class="sfbtn ${view.gradeStartKey === t.key ? 'on' : ''} ${g.marks[t.key] ? 'done' : ''}" data-act="gradeStartPick" data-k="${t.key}">${esc(t.label)}</button>`).join('')}</div>
      </div>`).join('')}
      ${view.gradeStartKey ? `<button class="btn btn-ghost btn-block" style="margin-top:10px" data-act="gradeStartClear">처음부터 다시 (빼둔 것 없이)</button>` : ''}
      <div class="hint wrap" style="margin-top:10px">빼둔 문제는 <b>밀린문제·오답</b>로 넘어가지 않아요. ① 화면의 [되돌리기]로 언제든 살릴 수 있어요.</div>
    `);
  }

  /** 📚 책 전체 보기 — 단원·쪽수를 한눈에 보고 숙제 범위 고르기 (선생님) */
  function sheetBookAll() {
    const cid = view.classId;
    const books = store.bookList();
    const book = view.baBook || view.lessonEditBook || books[0];
    view.baBook = book; view.baPages = view.baPages || [];
    const def = store.book(book) || { 단원: {} };
    const sel = new Set(view.baPages);
    let total = 0, concept = 0;
    const units = Object.keys(def.단원 || {}).sort((a, b) => +a - +b).map(u => {
      const unit = def.단원[u] || {};
      const pages = Object.keys(unit.쪽 || {}).map(Number).sort((a, b) => a - b);
      return { u, name: unit.이름 || (u + '단원'), pages };
    });
    units.forEach(un => un.pages.forEach(p => {
      total++;
      const info = (def.단원[un.u].쪽 || {})[String(p)] || {};
      if (!(info.문제 || []).length) concept++;
    }));
    const chosen = (view.baPages || []).slice().sort((a, b) => a - b);
    const tileN = store.tilesOf(book, chosen).length;
    return sheetWrap('📚 ' + book + ' 전체 보기', `
      <div class="sub">단원을 넘기며 쪽을 눌러 고르세요. <b>[단원 전체]</b> 하나면 그 단원이 통째로 들어가요.</div>
      <div class="tabs-scroll" style="padding:0 0 10px">
        ${books.map(b => `<button class="${b === book ? 'on' : ''}" data-act="baBook" data-b="${esc(b)}">${esc(b)}</button>`).join('')}
      </div>
      <div class="row" style="gap:8px;margin-bottom:8px">
        <button class="btn btn-ghost btn-sm grow" data-act="baAll">전체 ${total}쪽 선택</button>
        <button class="btn btn-ghost btn-sm grow" data-act="baClear">선택 비우기</button>
      </div>
      ${units.map(un => `<div class="baunit">
        <div class="bahd"><span class="grow"><b>${un.u}단원</b> ${esc(un.name)}</span>
          <button class="btn btn-ghost btn-sm" data-act="baUnit" data-u="${un.u}">단원 전체</button></div>
        <div class="bapages">
          ${un.pages.map(p => {
            const info = (def.단원[un.u].쪽 || {})[String(p)] || {};
            const n = (info.문제 || []).length;
            return `<button class="bapage ${sel.has(p) ? 'on' : ''} ${n ? '' : 'empty'}" data-act="baToggle" data-p="${p}">
              <b>${p}</b><small>${n ? n + '문제' : '개념'}</small></button>`;
          }).join('')}
        </div>
      </div>`).join('')}
      <div class="hint wrap" style="margin-top:10px">📖 개념 설명만 있는 쪽 ${concept}쪽은 문제가 없어서 숙제에서 자동으로 빠져요.</div>
      <div class="bhintbar">선택 <b>${chosen.length}쪽</b> · 문제 <b>${tileN}개</b>${chosen.length ? ' · ' + esc(pagesText(chosen)) + '쪽' : ''}</div>
      <button class="btn btn-primary btn-block" style="margin-top:10px" data-act="baApply" ${chosen.length ? '' : 'disabled'}>이 범위를 숙제로 넣기</button>
    `);
  }

  /** 반 이동 */
  function sheetMoveStu() {
    const cid = view.classId;
    const s = store.student(cid, view.moveSid);
    if (!s) return '';
    const others = store.state.classes.filter(c => c.id !== cid && !(store.mode === 'api' && c.localOnly));
    return sheetWrap('↪ 반 이동', `
      <div class="sub"><b>${esc(s.name)}</b> 학생을 어느 반으로 옮길까요?</div>
      ${others.map(c => `<button class="pickrow ${view.moveTo === c.id ? 'on' : ''}" data-act="moveTo" data-id="${c.id}">
        <span class="em">${c.emoji || '🏫'}</span>
        <span class="grow"><b>${esc(c.name)}</b><small>${esc(c.days || '')} ${esc(c.time || '')} · ${store.activeStudents(c.id).length}명</small></span>
        <span class="r">${view.moveTo === c.id ? '✓' : '›'}</span></button>`).join('')}
      <div class="hint wrap" style="margin-top:10px">펫·코인·XP·채점·오답·성취도 기록이 <b>그대로</b> 새 반으로 따라갑니다.</div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="moveGo" ${view.moveTo ? '' : 'disabled'}>이 반으로 옮기기</button>
    `);
  }

  /** 다른 반에 숙제·쪽수 설정 복사 */
  /** 🔄 학생 기록 초기화 — 선생님 4자리 PIN을 확인한 뒤 그 학생 기록만 지웁니다 (v1.2) */
  function sheetStuReset() {
    const cid = view.classId;
    const s = store.student(cid, view.stuResetSid);
    if (!s) return '';
    const st = store.stats(cid, s.id);
    const carried = store.carried(cid, s.id).length;
    return sheetWrap('🔄 ' + esc(s.name) + ' 기록 초기화', `
      <div class="sub">이 학생의 <b>채점·제출·도장·오답·밀린문제·프린트·출석·펫·코인·XP</b>를 처음 상태로 되돌립니다.<br>이름·PIN·반은 그대로 남아요.</div>
      <div class="card tight" style="margin-top:10px">
        <div class="kv"><span class="k">지금 기록</span><span>코인 ${s.coins || 0} · XP ${(s.xp || 0) + (s.bonusXp || 0)} · 펫 ${(s.pets || []).length}마리</span></div>
        <div class="kv"><span class="k">오늘 채점</span><span>${st.marked}/${st.total}문제 · 밀린문제 ${carried}개</span></div>
      </div>
      <div class="hint wrap" style="margin:10px 0 6px">되돌릴 수 없어요. 선생님 4자리 PIN을 넣어 주세요.</div>
      <input id="stuResetPin" class="tinput pininput" inputmode="numeric" maxlength="4" placeholder="선생님 PIN 4자리" autocomplete="off">
      <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="stuResetGo" data-id="${s.id}">이 학생 기록 초기화</button>
    `);
  }

  function sheetCopyLesson() {
    const cid = view.classId;
    const l = store.lesson(cid) || {};
    const others = store.state.classes.filter(c => c.id !== cid && !(store.mode === 'api' && c.localOnly));
    return sheetWrap('📤 다른 반에 숙제 복사', `
      <div class="sub">지금 숙제(<b>${esc((l.books || []).map(b => b.book + ' ' + pagesText(b.pages) + '쪽').join(', ') || l.homework || '')}</b>)를 어느 반에 똑같이 낼까요?</div>
      ${others.map(c => `<button class="pickrow ${view.copyTo === c.id ? 'on' : ''}" data-act="copyTo" data-id="${c.id}">
        <span class="em">${c.emoji || '🏫'}</span>
        <span class="grow"><b>${esc(c.name)}</b><small>${esc(c.days || '')} ${esc(c.time || '')} · ${store.activeStudents(c.id).length}명</small></span>
        <span class="r">${view.copyTo === c.id ? '✓' : '›'}</span></button>`).join('')}
      <div class="hint wrap" style="margin-top:10px">쪽수·기한(그 반 다음 수업일)이 함께 복사돼요. 복사한 반은 따로 고칠 수 있어요.</div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="copyGo" ${view.copyTo ? '' : 'disabled'}>이 반에 복사</button>
    `);
  }

  function sheetYesterday() {
    const cid = view.classId, sid = view.studentId;
    const y = EMA.util.shiftISO(store.state.today, -1);
    return sheetWrap('🔥 어제분 올리기', `
      <div class="sub">어제(${esc(EMA.ui.kdate(y))}) 푼 사진으로 불꽃을 살려요</div>
      ${view.pending.yphoto
        ? `<div class="photo-preview"><img src="${view.pending.yphoto}" alt="어제 사진"></div>
           <button class="btn btn-ghost btn-sm" style="margin-top:8px" data-act="yPhotoPick">사진 다시 고르기</button>`
        : `<button class="photo-drop" data-act="yPhotoPick">
             <div class="em">📷</div><div class="t">어제 푼 사진 올리기</div>
             <div class="s">푼 흔적이 보이면 돼요. 다 맞지 않아도 괜찮아요.</div>
           </button>`}
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="submitYesterday">어제분 올리기 (⏰)</button>
      <div class="privacy-note">📖 문제집 페이지만 찍어요! 얼굴, 방, 이름표 등 개인정보가 나오지 않도록 주의해주세요.</div>

      <input type="file" class="photo-input" data-target="yesterday" accept="image/*" aria-hidden="true">
    `);
  }

  function sheetPhotoCopy() {
    const cid = view.classId;
    const sid = view.printSid || view.studentId;
    const sub = store.submission(cid, sid) || store.submission(cid, sid, null, 'print');
    const ph = sub ? store.photo(sub.photoId) : null;
    return sheetWrap('📸 제출 사진 크게 보기', `
      ${ph ? `<img class="bigphoto" src="${ph.data}" alt="제출 사진">` : '<div class="empty">사진이 없어요.</div>'}
      <div class="muted center" style="margin-top:8px">🎲 인증 쪽: ${esc((sub && sub.verify && sub.verify.book) || '')} ${esc((sub && sub.verify && sub.verify.page) || '')}</div>
    `, { wide: true });
  }

  function sheetBigPhoto() {
    const cid = view.classId;
    const sid = view.bigPhotoSid;
    const sub = store.submission(cid, sid) || store.submission(cid, sid, null, 'print');
    const ph = sub ? store.photo(sub.photoId) : null;
    const s = store.student(cid, sid);
    const who = esc((s && (s.nickname || s.name)) || '풀이');
    const teacher = view.role === 'teacher';
    if (!ph) {
      const gone = !!(sub && (sub.photoId || sub.photoSubmitted));
      return sheetWrap('📸 ' + who + ' 풀이', `
        <div class="empty">${gone ? '사진은 보관 기간(7일)이 지나 앱에서 지웠어요.<br><small>제출 시각·채점·사진 제출 여부 기록은 그대로 남아 있어요.</small>' : '사진이 없어요'}</div>
        <div class="hint center" style="margin-top:10px">${sub && sub.at ? '제출 ' + esc(sub.at) : '제출 기록 없음'}${sub && sub.photoAt ? ' · 사진 ' + esc(sub.photoAt) : ''}</div>
      `);
    }
    const v = (sub && sub.verify) || null;
    const meta = [v ? '🎲 ' + esc(v.book || '') + ' ' + esc(v.page || '') + '쪽' : '', view.bigPhotoAt ? esc(view.bigPhotoAt) + ' 제출' : ''].filter(Boolean).join(' · ');
    return sheetWrap('📸 ' + who + ' 풀이', `
      <div class="fullphoto">
        ${meta ? `<div class="fp-meta">${meta}</div>` : ''}
        <img class="fp-img" src="${ph.data}" alt="${who} 풀이 사진">
        ${sub && sub.stampAt ? `<div class="fp-nm">✅ 도장 ${esc(sub.stampAt)}</div>` : ''}
      </div>
      ${teacher ? `<button class="btn btn-danger btn-block" style="margin-top:12px" data-act="deletePhoto" data-sid="${esc(sid)}">🗑 이 사진 지우기 (선생님 확인 후)</button>
        <div class="hint center wrap" style="margin-top:8px">확인 후 지우면 다시 볼 수 없어요. 제출·채점 기록은 남습니다. 7일이 지나면 자동으로 지워집니다.</div>` : ''}
    `, { full: true });
  }

  /** ⬆️ 긴 목록을 볼 때만 나타나는 '맨 위로' 버튼 — 화면과 따로 살아서 스크롤을 따라가지 않습니다 */
  function topButton() {
    const app = document.getElementById('app');
    let b = app.querySelector('.fabtop');
    if (!b) {
      b = document.createElement('button');
      b.className = 'fabtop';
      b.setAttribute('data-act', 'scrollTop');
      b.setAttribute('aria-label', '맨 위로');
      b.innerHTML = '⬆️ 맨 위로';
      app.appendChild(b);
    }
    return b;
  }

  /* =========================================================
     렌더 진입
  ========================================================= */
  function render() {
    const app = document.getElementById('app');
    const prev = app.querySelector('.screen');
    const y = prev ? prev.scrollTop : 0;
    // ★ v1.1 — 모달(책 전체 보기·쪽수표·숙제 편집) 안에서 버튼을 눌러도 스크롤이 0으로 튀지 않게 위치를 기억합니다
    const prevSheet = app.querySelector('.sheet-scroll');
    const sy = prevSheet ? prevSheet.scrollTop : 0;
    let html = '';
    if (view.role === 'login') html = renderLogin();
    else if (view.role === 'teacher') html = renderTeacher();
    else if (view.flow === 'grade') html = flowGrade();
    else if (view.flow === 'clean') html = flowClean();
    else if (view.flow === 'done') html = flowDone();
    else html = view.tab === 'rank' ? renderRank() : view.tab === 'record' ? renderRecord() : renderStudentHome();
    app.innerHTML = html;
    app.classList.toggle('in-flow', !!view.flow);
    const sc = app.querySelector('.screen');
    if (sc) {
      sc.scrollTop = view.resetScroll ? 0 : y;
      view.resetScroll = false;
      if (view.scrollTarget) {
        const el = sc.querySelector('#' + view.scrollTarget) || sc.querySelector('.' + view.scrollTarget);
        if (el) {
          const r1 = el.getBoundingClientRect(), r2 = sc.getBoundingClientRect();
          sc.scrollTop += (r1.top - r2.top) - 64;
        }
        view.scrollTarget = null;
      }
    }
    const sheetSc = app.querySelector('.sheet-scroll');
    if (sheetSc && sy) sheetSc.scrollTop = sy;
    /* ★ v2.0 — 선생님 탭 줄: 고른 탭이 화면 밖으로 잘리지 않게 가로로 맞춰 줍니다 */
    const tstrip = app.querySelector('.tabs-scroll');
    const ton = tstrip ? tstrip.querySelector('button.on') : null;
    if (tstrip && ton) {
      const tr = tstrip.getBoundingClientRect(), br = ton.getBoundingClientRect();
      if (br.right > tr.right - 8) tstrip.scrollLeft += (br.right - tr.right) + 12;
      else if (br.left < tr.left + 8) tstrip.scrollLeft -= (tr.left - br.left) + 12;
    }
    if (document.body.classList.contains('sheet-open')) document.body.classList.remove('sheet-open');
    if (view.sheet) document.body.classList.add('sheet-open');

    /* ⬆️ 맨 위로 — 300px 넘게 내려간 긴 화면에서만 */
    const topBtn = topButton();
    if (sc) {
      const sync = () => {
        const long = sc.scrollHeight > sc.clientHeight + 220;
        topBtn.classList.toggle('show', long && sc.scrollTop > 300);
      };
      sc.addEventListener('scroll', sync, { passive: true });
      sync();
      setTimeout(sync, 80);
    } else topBtn.classList.remove('show');

    const inputs = app.querySelectorAll('input[id]');
    inputs.forEach(inp => {
      inp.addEventListener('input', () => {
        if (inp.id === 'nickInput') view.pending.nickname = inp.value;
        if (inp.id === 'pmInput') view.pmInput = inp.value;
        if (inp.id === 'pageInput') {
          view.lessonEditPages = inp.value;
          if (view.sheet === 'lessonEdit') {
            // 저장 전에 '?쪽' 경고·미리보기가 바로 보이도록 (입력이 멈추면 한 번 다시 그림)
            clearTimeout(view._pgT);
            view._pgT = setTimeout(() => {
              if (view.sheet !== 'lessonEdit') return;
              render();
              const el = document.querySelector('#pageInput');
              if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { } }
            }, 400);
          }
        }
        if (inp.id === 'printInput') view.printInput = inp.value;
      });
    });
    app.querySelectorAll('.photo-input').forEach(fi => {
      fi.addEventListener('change', e => onPhotoChosen(e, fi.dataset.target));
    });
    EMA.ui.reflushToast();
  }

  function afterLoginStudent(classId, studentId) {
    view.role = 'student'; view.classId = classId; view.studentId = studentId;
    view.tab = 'home'; view.homeTab = 'today'; view.flow = null; view.sheet = null;
    store.setSession({ role: 'student', classId, studentId });
    const s = store.student(classId, studentId);
    if (!s.nickname) { view.sheet = 'onboard'; clearDraft(); }
    else {
      const d = readDraft();
      if (d && d.classId === classId && d.studentId === studentId && d.flow) {
        view.flow = d.flow;
        if (d.tab) view.tab = d.tab;
        if (d.homeTab) view.homeTab = d.homeTab;
        if (d.gradeSource) view.gradeSource = d.gradeSource;
        if (d.gradeBook) view.gradeBook = d.gradeBook;
        view.pending.photo = readDraftPhoto();
      }
    }
    render();
    if (view.flow) EMA.ui.toast('하던 곳에서 이어서 시작해요 👋');
  }

  /* =========================================================
     사진 선택
  ========================================================= */
  async function onPhotoChosen(e, target) {
    const f = e.target.files && e.target.files[0];
    try { e.target.value = ''; } catch (err) { }
    if (!f) return;
    try {
      const data = await EMA.ui.compress(f, 900, 0.62);
      // 바로 제출하지 않는다 — 미리보기에서 [이 사진으로 제출하기] / [다시 찍기] 를 고른다
      view.pending.tempPhoto = data;
      view.pending.tempTarget = target === 'yesterday' ? 'yesterday' : 'clean';
      view.sheet = 'photoconfirm';
      EMA.ui.sound('coin');
      render();
    } catch (err) {
      EMA.ui.toast('사진을 읽지 못했어요. 다른 사진으로 해 보세요');
    }
  }

  function currentPinVerify() {
    const s = store.student(view.classId, view.studentId);
    if (s && s.pin === view.pin) { afterLoginStudent(view.classId, view.studentId); return; }
    EMA.ui.toast('PIN이 달라요. 선생님께 물어보세요!');
    EMA.ui.sound('wrong');
    view.pin = '';
    render();
  }

  /** 선생님 모드로 들어가기 (세션 12시간) */
  function enterTeacher() {
    view.role = 'teacher';
    view.teacherTab = 'today';
    view.flow = null;
    view.sheet = null;
    view.pin = '';
    view.pinTarget = 'student';
    view.step = 'class';
    const cid = view.classId || (store.classes()[0] || {}).id || null;
    view.classId = cid;
    store.setSession({ role: 'teacher', classId: cid });
    EMA.ui.sound('levelup');
    view.resetScroll = true;
    render();
  }

  function setFlow(f) { view.flow = f; saveDraft(); render(); }

  function celebrateQueue(items) {
    items = items.filter(Boolean);
    if (!items.length) return;
    items.forEach((it, i) => setTimeout(() => {
      EMA.ui.fx.celebrate(it);
      EMA.ui.sound(it.sfx || 'fanfare');
    }, i * 1050));
  }

  /** 🎊 전체 화면 축하 — 폭진·반짝임·자기 칭찬 (숙제 완료·펫 부화/진화·보스 격파·주간 목표) */
  function bigCeleb(o) {
    if (!o || !o.title) return;
    EMA.ui.fx.bigCelebrate(Object.assign({ ms: 3000 }, o));
    EMA.ui.sound(o.sfx || 'fanfare');
    EMA.ui.fx.confetti(o.kind === 'legend' ? 120 : 80);
  }

  /* =========================================================
     동작
  ========================================================= */
  const actions = {
    kingdom() {
      view.sheet = 'kingdom';
      EMA.ui.sound('tap');
      render();
    },
    class(d) {
      const c = store.getClass(d.id);
      if (!c || !c.active) return;
      view.classId = d.id; view.step = 'student'; view.resetScroll = true;
      EMA.ui.sound('tap'); render();
    },
    back() {
      if (view.role === 'login') {
        if (view.step === 'pin') view.step = 'student';
        else if (view.step === 'student') view.step = 'class';
        else if (view.step === 'teacherRecover') view.step = 'teacherPin';
        else if (view.step === 'teacherSetup' || view.step === 'teacherSetup2' || view.step === 'teacherPin') view.step = 'class';
        view.pin = ''; view.pinTarget = 'student';
      }
      view.resetScroll = true; render();
    },
    pickStudent(d) {
      view.studentId = d.id; view.step = 'pin'; view.pin = ''; view.pinTarget = 'student';
      view.resetScroll = true; EMA.ui.sound('tap'); render();
    },
    pinKey(d) {
      const teacher = view.pinTarget === 'teacher' || view.step === 'teacherSetup' || view.step === 'teacherSetup2';
      const max = teacher ? MAX_TEACHER_PIN : 4;
      if (view.pin.length >= max) return;
      view.pin += d.k;
      EMA.ui.sound('tap');
      if (!teacher && view.pin.length === 4) { render(); setTimeout(currentPinVerify, 120); return; }
      /* ★ v1.2 — 선생님 PIN도 4자리를 다 누르면 바로 확인 (학생과 같은 손맛) */
      if (teacher && view.step === 'teacherPin' && view.pin.length === 4) { render(); setTimeout(actions.teacherPinOk, 120); return; }
      render();
    },
    pinDel() { view.pin = view.pin.slice(0, -1); render(); },
    pinBack() { view.pin = ''; render(); },
    teacherEntry() {
      view.pinTarget = 'teacher'; view.pin = ''; view.newPin1 = '';
      /* ★ v1.2 — 예전에 5~6자리로 정한 PIN은 4자리로 다시 정하게 안내합니다 */
      const cfg = (window.EMA.auth && EMA.auth.config) ? EMA.auth.config() : null;
      const legacy = !!(cfg && cfg.hash && Number(cfg.len || 0) !== 4);
      view.pinLegacy = legacy;
      view.step = (window.EMA.auth && (EMA.auth.needsSetup() || legacy)) ? 'teacherSetup' : 'teacherPin';
      if (view.role !== 'login') view.role = 'login';
      view.sheet = null;
      view.resetScroll = true; render();
    },
    /* ---- 선생님 PIN 첫 설정 (4~6자리 → 해시 저장 → 비상 복구 키 1회 안내) ---- */
    confirmTeacherSetup1() {
      if (!/^\d{4}$/.test(view.pin)) { EMA.ui.toast('숫자 4자리로 정해 주세요'); return; }
      view.newPin1 = view.pin;
      view.pin = '';
      view.step = 'teacherSetup2';
      EMA.ui.sound('tap');
      render();
    },
    async confirmTeacherSetup2() {
      if (!/^\d{4}$/.test(view.pin)) { EMA.ui.toast('숫자 4자리로 정해 주세요'); return; }
      if (view.pin !== view.newPin1) {
        EMA.ui.toast('두 번 누른 PIN이 달라요. 처음부터 다시 해 주세요');
        EMA.ui.sound('wrong');
        view.pin = ''; view.newPin1 = ''; view.step = 'teacherSetup';
        render();
        return;
      }
      await EMA.auth.setPin(view.pin);
      view.recoveryCode = await EMA.auth.issueRecovery();
      view.newPin1 = '';
      enterTeacher();
      view.sheet = 'recovery';
      render();
    },
    async teacherPinOk() {
      if (view.pin.length !== 4) return;          // 4자리를 다 누르면 자동 확인 — 빈 채로 누른 경우는 조용히 무시
      const ok = await EMA.auth.verifyPin(view.pin);
      if (!ok) {
        EMA.ui.toast('선생님 PIN이 달라요');
        EMA.ui.sound('wrong');
        view.pin = '';
        render();
        return;
      }
      enterTeacher();
      EMA.ui.toast('선생님 모드로 들어왔어요');
    },
    teacherRecoverOpen() {
      view.step = 'teacherRecover';
      view.pin = '';
      view.resetScroll = true;
      render();
    },
    async teacherRecoverSave() {
      const code = (document.querySelector('#recoverInput') || {}).value || '';
      const pin = (document.querySelector('#recoverPin') || {}).value || '';
      if (!/^\d{4}$/.test(pin)) { EMA.ui.toast('새 PIN을 숫자 4자리로 정해 주세요'); return; }
      const r = await EMA.auth.resetWithRecovery(code, pin);
      if (r.error) { EMA.ui.toast(r.error); EMA.ui.sound('wrong'); return; }
      view.recoveryCode = r.recovery;
      enterTeacher();
      view.sheet = 'recovery';
      render();
    },
    closeRecovery() {
      view.recoveryCode = '';
      view.sheet = null;
      render();
    },
    copyRecovery() {
      const ok = EMA.ui.copy(view.recoveryCode || '');
      EMA.ui.toast(ok ? '복구 키를 복사했어요 · 안전한 곳에 적어 두세요' : '복구 키를 길게 눌러 직접 적어 주세요', 3000);
    },
    teacherExit() {
      view.role = 'login'; view.step = 'class'; view.pin = ''; view.pinTarget = 'student';
      store.setSession(null); view.resetScroll = true; render();
    },
    tab(d) { view.tab = d.tab; view.sheet = null; view.flow = null; saveDraft(); view.resetScroll = true; EMA.ui.sound('tap'); render(); },
    homeTab(d) {
      view.homeTab = d.t;
      view.tab = 'home';                 // ★ 내 도감에서 '고치기 →'를 누르면 숙제 탭으로 실제 이동
      view.sheet = null; view.flow = null; saveDraft(); view.resetScroll = true;
      EMA.ui.sound('tap'); render();
    },
    teacherTab(d) { view.teacherTab = d.t; view.sheet = null; view.resetScroll = true; EMA.ui.sound('tap'); render(); },

    /* ---- 채점 동선 ---- */
    startGrade() {
      view.sheet = null;
      view.gradeSource = 'homework';
      view.gradeStartKey = null; view.undoFill = null;
      const bs = store.books(view.classId);
      view.gradeBook = bs.length > 1 ? (view.gradeBook && bs.find(b => b.book === view.gradeBook) ? view.gradeBook : bs[0].book) : (bs[0] || {}).book || null;
      if (!store.tiles(view.classId).length) { actions.noHomework(); return; }
      view.resetScroll = true; setFlow('grade');
    },
    /** 오늘 숙제가 없을 때도 버튼은 반드시 반응한다 */
    noHomework() {
      const carried = store.carried(view.classId, view.studentId).length;
      EMA.ui.toast('오늘은 숙제가 없어요. 선생님이 올리면 바로 시작할 수 있어요 📭');
      if (carried) { view.homeTab = 'carry'; view.sheet = null; render(); }
      else render();
      EMA.ui.sound('tap');
    },
    startPrint() {
      if (!store.hasPrint(view.classId, view.studentId)) { view.sheet = 'printpick'; render(); return; }
      view.gradeSource = 'print';
      view.gradeStartKey = null; view.undoFill = null;
      view.resetScroll = true; setFlow('grade');
    },
    /** 도감의 오늘 알 → 바로 ② 정리 화면으로 (⚔️ 해결하러) */
    fixNow() {
      view.sheet = null;
      view.gradeSource = 'homework';
      view.undoFill = null;
      const bs = store.books(view.classId);
      view.gradeBook = bs.length > 1 ? (view.gradeBook && bs.find(b => b.book === view.gradeBook) ? view.gradeBook : bs[0].book) : (bs[0] || {}).book || null;
      if (!store.tiles(view.classId).length) { actions.noHomework(); return; }
      view.resetScroll = true; setFlow('clean');
    },
    gradeBook(d) { view.gradeBook = d.b; saveDraft(); view.resetScroll = true; render(); },
    mark(d, el) {
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      const cur = store.gradeOf(view.classId, view.studentId, kind).marks[d.key] || '';
      const next = cur === d.m ? '' : d.m;
      store.setMark(view.classId, view.studentId, d.key, next, kind);
      EMA.ui.haptic();
      EMA.ui.sound(next === 'x' ? 'wrong' : next === 'o' ? 'correct' : 'tap');
      view.resetScroll = false;
      const mx = store.ensureMission(view.classId, view.studentId);
      render();
      const t = document.querySelector('.ox[data-key="' + d.key + '"][data-m="' + d.m + '"]');
      if (t) EMA.ui.fx.bounce(t);
      if (next === 'x') {
        const msgs = ['❌ 못 고친 오답!', '📌 고치면 펫 알 부화', '🥚 알이 흔들!', '😤 다시 풀면 돼'];
        EMA.ui.fx.hit(t, msgs[Math.floor(Math.random() * msgs.length)], 'bad');
      } else if (next === 'o') {
        const ok = ['⭕ 좋아! 통과', '👏 맞았어!', '✨ 정답!'];
        EMA.ui.fx.hit(t, ok[Math.floor(Math.random() * ok.length)], 'good');
      }
      if (mx && mx.then) mx.then(r => r && missionToast(r));
      else if (mx) missionToast(mx);
    },
    /** ⭐ 맞았지만 궁금해요 — ⭕ 문제에도 질문을 달 수 있습니다 (1건당 5개까지) */
    starO(d) {
      const kind = sourceKind();
      const g = store.gradeOf(view.classId, view.studentId, kind);
      if (g.marks[d.key] !== 'o') { EMA.ui.toast('⭕ 맞은 문제에만 ⭐를 달 수 있어요'); return; }
      const before = (g.cleanup || {})[d.key] || '';
      if (before !== 'star' && store.starCount(view.classId, view.studentId, kind) >= STAR_MAX) {
        EMA.ui.toast('질문은 ' + STAR_MAX + '개까지! 나머지는 선생님께 직접 물어봐 😊', 3200);
        EMA.ui.sound('wrong');
        return;
      }
      store.setCleanup(view.classId, view.studentId, d.key, 'star', kind);
      EMA.ui.haptic();
      EMA.ui.sound('tap');
      view.resetScroll = false;
      const on = (store.gradeOf(view.classId, view.studentId, kind).cleanup || {})[d.key] === 'star';
      const mx = store.ensureMission(view.classId, view.studentId);
      render();
      if (on) {
        EMA.ui.toast('⭐ 선생님 질문 목록에 올렸어요');
        const b = document.querySelector('.ox-star[data-key="' + d.key + '"]');
        if (b) EMA.ui.fx.bounce(b);
      }
      if (mx && mx.then) mx.then(r => r && missionToast(r));
      else if (mx) missionToast(mx);
    },
    /* ---- 🏫 5초 컷 도구 ---- */
    gradeStartOpen() { view.sheet = 'startfrom'; EMA.ui.sound('tap'); view.resetScroll = false; render(); },
    gradeStartPick(d) {
      view.gradeStartKey = d.k || null;
      const n = applyGradeView();
      view.sheet = null;
      view.resetScroll = false;
      EMA.ui.sound('tap');
      render();
      const el = document.querySelector('.ox-block [data-key="' + String(d.k || '').replace(/"/g, '\\"') + '"]');
      const box = el ? el.closest('.ox-block') : null;
      if (box) { try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { box.scrollIntoView(); } }
      if (view.gradeStartKey && n) EMA.ui.toast(n + '문제는 수업에서 푼 걸로 빼뒀어요', 2600);
    },
    gradeRep() {
      /* v1.1 — 학생 화면에서는 뺐습니다. 선생님 숙제 출제의 [유제만]이 같은 역할을 합니다. */
      EMA.ui.toast('대표문제 접기는 이제 선생님이 숙제를 낼 때 [유제만]으로 정해요', 3200);
    },
    gradeParity() {
      EMA.ui.toast('홀수·짝수 범위는 이제 선생님이 숙제를 낼 때 정해요', 3200);
    },
    gradeReset() {
      view.gradeStartKey = null;
      applyGradeView();
      view.resetScroll = false;
      EMA.ui.sound('tap');
      render();
    },
    gradeStartClear() {
      view.gradeStartKey = null;
      applyGradeView();
      view.sheet = null;
      view.resetScroll = false;
      EMA.ui.sound('tap');
      render();
    },
    /* ---- 📚 책 전체 보기 (선생님 숙제 범위) ---- */
    bookAllOpen() {
      view.baBook = view.lessonEditBook || (store.books(view.classId)[0] || {}).book || store.bookList()[0];
      view.baPages = (view.lessonEditPages || []).slice();
      view.sheet = 'bookall';
      EMA.ui.sound('tap');
      render();
    },
    baBook(d) {
      view.baBook = d.b;
      view.baPages = [];
      EMA.ui.sound('tap');
      render();
    },
    baToggle(d) {
      const p = parseInt(d.p, 10);
      const list = (view.baPages || []).slice();
      const i = list.indexOf(p);
      if (i >= 0) list.splice(i, 1); else list.push(p);
      view.baPages = list.sort((a, b) => a - b);
      EMA.ui.sound('tap');
      render();
    },
    baUnit(d) {
      const def = store.book(view.baBook) || { 단원: {} };
      const unit = (def.단원 || {})[d.u] || { 쪽: {} };
      const pages = Object.keys(unit.쪽 || {}).map(Number);
      const list = (view.baPages || []).slice();
      pages.forEach(p => { if (list.indexOf(p) < 0) list.push(p); });
      view.baPages = list.sort((a, b) => a - b);
      EMA.ui.sound('tap');
      render();
    },
    baAll() {
      view.baPages = store.pagesOfBook(view.baBook).map(p => p.page);
      EMA.ui.sound('tap');
      render();
    },
    baClear() { view.baPages = []; EMA.ui.sound('tap'); render(); },
    baApply() {
      const pages = (view.baPages || []).slice().sort((a, b) => a - b);
      if (!pages.length) return;
      view.lessonEditBook = view.baBook;
      view.lessonEditPages = pages;
      view.lessonEditInput = pagesText(pages);
      view.sheet = 'lessonEdit';
      EMA.ui.sound('coin');
      render();
      EMA.ui.toast(pages.length + '쪽을 골랐어요 · 문제 ' + store.tilesOf(view.baBook, pages).length + '개', 3000);
    },
    /** 1초 이유 태그 — 골라도 되고 안 골라도 된다 */
    tag(d) {
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      store.setTag(view.classId, view.studentId, d.key, d.t, kind);
      EMA.ui.haptic();
      EMA.ui.sound('tap');
      render();
    },
    markAll() {
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      const r = store.fillRestCorrect
        ? store.fillRestCorrect(view.classId, view.studentId, kind, view.gradeSource === 'print' ? null : view.gradeBook)
        : null;
      const n = r && r.n != null ? r.n : (typeof r === 'number' ? r : 0);
      const keys = (r && r.keys) || [];
      view.undoFill = n && keys.length ? { keys, n, kind } : null;   // 다음 단계로 갈 때까지 유지되는 되돌리기 배너
      EMA.ui.haptic(); EMA.ui.sound('correct');
      EMA.ui.toast(n ? n + '문제를 한 번에 ⭕ 했어요! 틀린 문제만 ❌를 눌러 주세요' : '채울 빈칸이 없어요', 3500);
      const mx = store.ensureMission(view.classId, view.studentId);
      if (mx && mx.then) mx.then(r2 => r2 && missionToast(r2));
      else if (mx) missionToast(mx);
      render();
    },
    undoFill() {
      if (!view.undoFill) return;
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      const n = store.undoFill ? store.undoFill(view.classId, view.studentId, view.undoFill.keys, kind) : 0;
      view.undoFill = null;
      view.resetScroll = false;
      EMA.ui.sound('tap');
      render();
      EMA.ui.toast(n ? n + '문제를 되돌렸어요 · 다시 골라 주세요' : '되돌릴 것이 없어요', 3200);
    },
    toClean() {
      const tiles = sourceTiles();
      const g = sourceGrade();
      const cnt = countTiles(tiles, g);
      if (!cnt.marked) { EMA.ui.toast('먼저 맞은 문제 ⭕, 틀린 문제 ❌를 눌러 주세요'); return; }
      // ❌ 틀림(·⭐ 질문) 문제는 이유 태그를 꼭 골라야 다음으로
      const missing = tiles.filter(t => g.marks[t.key] === 'x' && !(g.tags || {})[t.key]);
      if (missing.length) {
        EMA.ui.toast('왜 틀렸는지 골라야 다음으로 갈 수 있어요!', 3200);
        EMA.ui.sound('wrong');
        EMA.ui.haptic();
        const key = String(missing[0].key).replace(/"/g, '\\"');
        const hit = document.querySelector('.ox-block [data-key="' + key + '"]');
        const box = hit ? hit.closest('.ox-block') : null;
        if (box) {
          try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { box.scrollIntoView(); }
          box.classList.add('need-tag');
          setTimeout(() => box.classList.remove('need-tag'), 2600);
        }
        return;
      }
      view.resetScroll = true;
      EMA.ui.sound('tap');
      setFlow('clean');
    },
    cleanup(d, el) {
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      const before = store.gradeOf(view.classId, view.studentId, kind).cleanup[d.key] || '';
      // ⭐ 질문은 숙제 1건당 5개까지
      if (d.k === 'star' && before !== 'star' && store.starCount(view.classId, view.studentId, kind) >= STAR_MAX) {
        EMA.ui.toast('질문은 ' + STAR_MAX + '개까지! 나머지 ❌ 틀림 문제는 수업 전후에 선생님께 직접 물어봐 😊', 3400);
        EMA.ui.sound('wrong');
        EMA.ui.haptic();
        return;
      }
      store.setCleanup(view.classId, view.studentId, d.key, d.k, kind);
      EMA.ui.haptic();
      const on = store.gradeOf(view.classId, view.studentId, kind).cleanup[d.key] === d.k;
      let join = null;
      // 오답 해결 → 펫 알 부화(펫 합류, 한 문제는 한 번만)
      if (on && d.k === 'fixed' && before !== 'fixed') {
        join = store.purifyEgg(view.classId, view.studentId, d.key);
      }
      render();
      const t = document.querySelector('.clb[data-key="' + d.key + '"][data-k="' + d.k + '"]');
      if (t && on) {
        EMA.ui.fx.bounce(t);
        if (d.k === 'fixed') {
          EMA.ui.sound('crit');
          EMA.ui.fx.hit(t, '+250 DMG! ⚔️', 'crit');
          EMA.ui.fx.shake('.boss');
          if (join && join.pet) {
            EMA.ui.sound('hatch');
            bigCeleb({ kind: 'hatch', em: join.pet.em, title: join.pet.name + ' 부화!', sub: '펫 알 부화! · 내 도감에 담았어요', sfx: 'hatch' });
          } else if (join && join.coins) {
            EMA.ui.toast('펫이 힘을 보태 코인 +' + join.coins + ' 🐾');
          }
        } else EMA.ui.sound('tap');
      }
    },
    flowBack() {
      if (view.flow === 'done') { view.resetScroll = true; setFlow('clean'); }
      else if (view.flow === 'clean') { view.resetScroll = true; setFlow('grade'); }
      else { view.flow = null; view.sheet = null; saveDraft(); view.resetScroll = true; render(); }
    },
    goHome() { view.flow = null; view.tab = 'home'; view.homeTab = 'today'; view.sheet = null; saveDraft(); view.resetScroll = true; render(); },
    photoPick() {
      view.pending.tempTarget = 'clean';
      const inp = document.querySelector('.photo-input[data-target="clean"]');
      if (inp) inp.click();
      else EMA.ui.toast('사진 버튼을 다시 눌러 주세요');
    },
    yPhotoPick() {
      view.pending.tempTarget = 'yesterday';
      const inp = document.querySelector('.photo-input[data-target="yesterday"]');
      if (inp) inp.click();
    },
    /** 미리보기 확인 — 여기서 제출하지 않고 한 번 더 확인한다(셀카·사생활 오촬영 방지) */
    confirmPhoto() {
      const t = view.pending.tempTarget || 'clean';
      const data = view.pending.tempPhoto;
      if (!data) { view.sheet = null; render(); return; }
      view.pending.tempPhoto = null;
      if (t === 'yesterday') {
        view.pending.yphoto = data;
        view.sheet = 'yesterday';
        EMA.ui.sound('coin');
        EMA.ui.toast('어제 사진 준비 완료! 아래 버튼을 눌러 주세요');
        render();
        return;
      }
      view.pending.photo = data;
      view.pending.reupload = false;
      saveDraft();
      view.sheet = null;
      EMA.ui.sound('coin');
      render();
      // 미리보기에서 '이 사진으로 제출하기'를 고르면 바로 제출까지 이어서
      actions.submit();
    },
    /** 취소 → 사진 버리고 다시 찍기 */
    retakePhoto() {
      const t = view.pending.tempTarget || 'clean';
      view.pending.tempPhoto = null;
      view.sheet = null;
      render();
      setTimeout(() => {
        const inp = document.querySelector('.photo-input[data-target="' + (t === 'yesterday' ? 'yesterday' : 'clean') + '"]');
        if (inp) inp.click();
      }, 180);
    },
    /** 제출 후 1시간 안 · 도장 전 — 사진만 교체 */
    reupload() {
      view.pending.tempTarget = 'clean';
      const inp = document.querySelector('.photo-input[data-target="clean"]');
      if (inp) { inp.click(); return; }
      view.resetScroll = true;
      setFlow('clean');
      setTimeout(() => {
        const i2 = document.querySelector('.photo-input[data-target="clean"]');
        if (i2) i2.click(); else EMA.ui.toast('사진 다시 올리기 버튼을 눌러 주세요');
      }, 240);
    },
    /** 💾 임시 저장 — 사진 없이 채점만 남깁니다. 기한 전에는 밀린문제로 넘기지 않아요 */
    saveTemp() {
      const cid = view.classId, sid = view.studentId;
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      if (store.saveProgress) store.saveProgress(cid, sid, kind);
      else store.save();
      const st = kind === 'print' ? store.printStats(cid, sid) : store.stats(cid, sid);
      const due = store.dueInfo(cid);
      view.flow = null; view.tab = 'home'; view.homeTab = 'today'; view.sheet = null;
      view.pending.photo = null; view.resetScroll = true;
      saveDraft();
      EMA.ui.sound('coin');
      EMA.ui.toast(`💾 임시 저장했어요 · ${st.marked}/${st.total}문제${due.passed ? '' : ' · 기한까지 이어서 할 수 있어요'}`, 3200);
      render();
    },
    async submit() {
      const cid = view.classId, sid = view.studentId;
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      const sub = store.submission(cid, sid, null, kind);
      const existingPhoto = sub ? store.photo(sub.photoId) : null;
      const up = store.reuploadInfo(cid, sid, kind);
      const locked = !!(sub && existingPhoto && !up.ok);

      // 도장 보호 — 선생님이 확인한 제출은 아이가 저장해도 도장이 지워지지 않습니다
      if (sub && (sub.stampAt || sub.status === 'stamped')) {
        EMA.ui.toast('선생님이 도장을 찍은 제출이에요. 고친 내용은 선생님께 직접 말해 주세요', 3200);
        EMA.ui.sound('tap');
        return;
      }

      if (sub && existingPhoto && up.ok && view.pending.photo) {
        // 1시간 안 사진 교체 — 보상은 그대로
        const r = await store.reuploadPhoto(cid, sid, view.pending.photo, kind);
        if (r.error) { EMA.ui.toast(r.error); EMA.ui.sound('wrong'); return; }
        if (r.photoError) EMA.ui.toast('사진 저장에 문제가 있어요. 다시 한 번 시도해 주세요', 3200);
        view.lastResult = { coins: 0, xp: 0, reupload: true };
        view.pending.photo = null;
        saveDraft();
      } else if (!locked) {
        if (!view.pending.photo && !existingPhoto) { EMA.ui.toast('사진을 먼저 올려 주세요 📷'); return; }
        let r;
        if (view.pending.photo) {
          r = await store.submitPhoto(cid, sid, view.pending.photo, kind);
        } else {
          const saved = store.touchSubmission(cid, sid, kind);
          r = saved ? store.previewReward(cid, sid, kind) : { coins: 0, xp: 0 };
          if (!saved) { EMA.ui.toast('저장하지 못했어요. 다시 시도해 주세요'); return; }
        }
        view.lastResult = r;
        if (r && r.photoError) EMA.ui.toast('사진 저장에 문제가 있어요. 선생님께 알려 주세요', 3600);
        const items = [];
        if (r && r.titles && r.titles.length) {
          r.titles.forEach(t => items.push({ kind: 'title', em: t.em || '🏅', title: t.name + ' 획득!', sub: '새 칭호가 열렸어요', sfx: 'fanfare' }));
        }
        if (r && r.killed) setTimeout(() => bigCeleb({ kind: 'boss', em: '🏆', title: '보스 처치!', sub: '반 전원 보너스 코인 30개 · 한정판 칭호', sfx: 'bossdown' }), 3000);
        if (r && r.sub && r.sub.shield) items.push({ kind: 'shield', em: '🛡️', title: '보스 방어막 발동!', sub: '수업 당일에 몰아서 내서 보스·코인 50%만 들어갔어요', sfx: 'shield' });
        else if (r && r.sub && r.sub.early) items.push({ kind: 'early', em: '⚡', title: '얼리버드 크리티컬 2배!', sub: '일찍 내서 코인 2배 + XP 20 보너스!', sfx: 'fanfare' });
        if (r && r.carried) items.push({ kind: 'title', em: '🥚', title: '안 푼 ' + r.carried + '문제 → 밀린문제', sub: '제출 기한이 지나 ⚔️ 밀린문제로 넘어갔어요', sfx: 'tap', ms: 1800 });
        celebrateQueue(items);
        view.pending.photo = null;
      } else {
        // 이미 낸 사진이 있고 바꿀 수 없을 때 — 채점만 저장
        store.touchSubmission(cid, sid, kind);
        view.lastResult = { coins: 0, xp: 0 };
      }
      view.sheet = null;
      view.resetScroll = true;
      setFlow('done');
      /* 🎊 숙제를 끝낸 순간 — 화면 전체 축하 팝업 + 자기 칭찬 */
      if (view.lastResult && !view.lastResult.reupload) {
        const lr = view.lastResult;
        const pr = lr.print || kind === 'print';
        setTimeout(() => {
          bigCeleb({
            kind: 'title', em: pr ? '📝' : '🎉',
            title: pr ? '프린트 끝!' : '오늘 숙제 완료!',
            sub: `코인 +${lr.coins != null ? lr.coins : 0} · XP +${lr.xp != null ? lr.xp : 0}` + (lr.carried ? ` · 밀린문제 ${lr.carried}개` : ''),
            ms: 2600
          });
        }, 420);
      }
      if (!(view.lastResult && view.lastResult.titles && view.lastResult.titles.length)) EMA.ui.fx.confetti(70);
      EMA.ui.sound('fanfare');
      if (view.lastResult && view.lastResult.reupload) EMA.ui.toast('사진을 새로 올렸어요! 남은 시간 동안 한 번 더 바꿀 수 있어요');
    },
    /** 💾 고친 내용 저장하고 홈으로 — 선생님 도장이 찍힌 제출이어도 막다른 길 없이 저장하고 나갑니다.
        도장·사진·제출 시각은 건드리지 않고, 고친 해결(⚔️)·질문(⭐) 내용만 저장합니다. */
    saveStamped() {
      const cid = view.classId, sid = view.studentId;
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      const sub = store.submission(cid, sid, null, kind);
      const stampAt = sub ? sub.stampAt : null;
      if (store.saveProgress) store.saveProgress(cid, sid, kind);
      else store.save();
      const after = store.submission(cid, sid, null, kind);
      if (stampAt && after && after.stampAt !== stampAt) {
        // 있을 수 없는 일이지만, 도장이 사라졌다면 되돌리고 알립니다
        after.stampAt = stampAt; after.status = 'stamped'; store.save();
      }
      view.flow = null; view.tab = 'home'; view.homeTab = 'today'; view.sheet = null;
      view.pending.photo = null; view.pending.tempPhoto = null; view.resetScroll = true;
      saveDraft();
      EMA.ui.sound('coin');
      EMA.ui.toast('💾 고친 내용을 저장했어요 · 선생님 도장은 그대로예요', 3400);
      render();
    },
    gallery() { view.sheet = 'gallery'; EMA.ui.sound('tap'); render(); },
    closeSheet() {
      if (view.sheet === 'reportimg') { view.reportImg = null; view.sheet = 'report'; render(); return; }
      view.sheet = view.sheet === 'bigphoto' && view.bigPhotoFrom === 'gallery' ? 'gallery' : null;
      view.bigPhotoFrom = ''; view.printSid = null; view.printInput = ''; view.reportImg = null; render();
    },
    carry() { view.homeTab = 'carry'; view.sheet = null; render(); },
    /** ⬆️ 맨 위로 — 긴 목록의 맨 위로 부드럽게 */
    scrollTop() {
      const sc = document.querySelector('.screen');
      if (!sc) return;
      try { sc.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { sc.scrollTop = 0; }
    },
    /** ❓ 앱이 이상해요 — 당황하지 말고 책에 직접 채점·오답 고쳐서 선생님께 보여주면 됩니다 */
    appHelp() { view.sheet = 'apphelp'; EMA.ui.sound('tap'); render(); },
    /** ✅ 책으로 완료 (밀린문제 제외) — 선생님 비상 버튼 */
    bookDone(d) {
      const cid = view.classId;
      const s = store.student(cid, d.id);
      if (!s) return;
      if (!confirm(`${s.name} 학생을 '책으로 완료'로 처리할까요?\n\n아직 안 누른 문제는 새로 밀린문제로 넘어가지 않습니다.`)) return;
      const r = store.markBookDone ? store.markBookDone(cid, d.id, 'hw') : null;
      EMA.ui.sound('stamp');
      EMA.ui.toast(r && r.already ? `${s.name}은 이미 완료 처리되어 있어요` : `${s.name} — 책으로 완료! (밀린문제는 그대로)`, 3400);
      render();
    },
    effortClear() {
      if (store.clearEffort) store.clearEffort(view.classId);
      EMA.ui.toast('오늘의 열정 알림을 비웠어요');
      render();
    },

    /* ---- 세계관·도감 ---- */
    openDex() {
      view.sheet = null; view.tab = 'record'; view.flow = null;
      view.scrollTarget = 'companionDex';
      view.resetScroll = false;
      EMA.ui.sound('tap'); render();
    },
    openStory() { view.sheet = 'story'; EMA.ui.sound('tap'); render(); },
    settings() { view.sheet = 'settings'; EMA.ui.sound('tap'); render(); },
    photoBig(d) { view.bigPhotoFrom = view.sheet === 'gallery' ? 'gallery' : ''; view.bigPhotoSid = d.sid || view.studentId; view.bigPhotoAt = d.at || ''; view.sheet = 'bigphoto'; EMA.ui.sound('tap'); render(); },
    tGroup(d) { view.tOpen[d.k] = !view.tOpen[d.k]; EMA.ui.sound('tap'); render(); },
    stuTools(d) { view.stuOpen[d.id] = !view.stuOpen[d.id]; EMA.ui.sound('tap'); render(); },
    growCompanion(d) {
      const r = store.growCompanion(view.classId, view.studentId, d.id);
      if (r.error) { EMA.ui.toast(r.error); EMA.ui.sound('wrong'); return; }
      EMA.ui.sound(r.pet.lv >= 3 ? 'legendary' : 'coin');
      render();
      EMA.ui.toast(r.msg || '펫이 자랐어요!');
      /* 🌱 펫이 한 단계 자라면 전체 화면 축하 */
      if (r.stageUp && r.pet) {
        bigCeleb({ kind: 'hatch', em: r.pet.em, title: r.pet.name + ' ' + (r.pet.lv >= 3 ? '완성!' : '성장!'), sub: '펫 ' + r.pet.lv + '단계가 열렸어요' + (r.title ? ' · 칭호 ' + r.title.name : ''), sfx: 'hatch' });
      }
    },
    /* ---- 선생님 테스트: 다음 날로 넘겨보기 ---- */
    galleryMode(d) {
      store.setGalleryMode(d.m);
      EMA.ui.toast(d.m === 'auto' ? '풀이 공개: 자동 (수업 시작 후)' : d.m === 'open' ? '풀이 공개: 지금 열기' : '풀이 공개: 닫기');
      EMA.ui.sound('tap');
      render();
    },
    nextDay() {
      const r = store.nextDayPreview(view.classId);
      view.nextDayRows = r.rows.map(x => ({
        name: x.student.nickname || x.student.name, real: x.student.name,
        added: x.added, total: x.total
      }));
      view.nextDayTotal = r.total;
      view.sheet = 'nextday';
      EMA.ui.sound('stamp');
      render();
    },

    /* ---- 상점·펫 ---- */
    openShop() { view.sheet = 'shop'; EMA.ui.sound('tap'); render(); },
    buy(d) {
      const r = store.buy(view.classId, view.studentId, d.id);
      if (r.error) { EMA.ui.toast(r.error); EMA.ui.sound('wrong'); return; }
      EMA.ui.sound(r.hatch ? (r.hatch.pet.rarity === 'legend' ? 'legendary' : 'hatch') : 'coin');
      render();
      EMA.ui.toast(r.msg || '구매 완료!');
      if (r.hatch) {
        const p = r.hatch.pet;
        bigCeleb({ kind: 'hatch', em: p.em, title: `${p.name} 부화!`, sub: (GAME().rarity[p.rarity] || {}).label + ' 등급 · 도감에 등록됐어요', sfx: p.rarity === 'legend' ? 'legendary' : 'hatch' });
        const items = [];
        (r.hatch.titles || []).forEach(t => items.push({ kind: 'title', em: t.em || '🏅', title: t.name + ' 획득!', sub: '새 칭호가 열렸어요', sfx: 'fanfare', ms: 1900 }));
        if (items.length) setTimeout(() => celebrateQueue(items), 3000);
      }
      if (r.killed && r.killed.boss) {
        setTimeout(() => bigCeleb({ kind: 'boss', em: '🏆', title: '보스 처치!', sub: '반 전원 보너스 코인 30개 · 한정판 칭호', sfx: 'bossdown' }), 900);
      }
    },
    feed() {
      const r = store.feed(view.classId, view.studentId);
      if (r.error) { EMA.ui.toast(r.error); EMA.ui.sound('wrong'); return; }
      EMA.ui.sound(r.hatch ? (r.hatch.pet.rarity === 'legend' ? 'legendary' : 'hatch') : 'coin');
      render();
      EMA.ui.toast(r.msg || '냠냠!');
      if (r.hatch) {
        const p = r.hatch.pet;
        bigCeleb({ kind: 'hatch', em: p.em, title: `${p.name} 부화!`, sub: (GAME().rarity[p.rarity] || {}).label + ' 등급 · 도감에 등록됐어요', sfx: p.rarity === 'legend' ? 'legendary' : 'hatch' });
      }
    },
    petDetail(d) { view.petDetail = d.id; view.sheet = 'pet'; render(); },
    monsterDetail(d) { view.monsterDetail = d.id; view.sheet = 'monster'; render(); },
    toggleSound() {
      const on = EMA.sfx.toggle();
      EMA.ui.toast(on ? '🔊 소리 켜짐' : '🔇 소리 꺼짐');
      render();
    },

    /* ---- 어제분 ---- */
    yesterday() { view.sheet = 'yesterday'; view.pending.yphoto = null; render(); },
    async submitYesterday() {
      const cid = view.classId, sid = view.studentId;
      if (!view.pending.yphoto) { EMA.ui.toast('어제 푼 사진을 먼저 올려 주세요 📷'); return; }
      await store.submitYesterday(cid, sid, view.pending.yphoto, MIN);
      view.pending.yphoto = null; view.sheet = null;
      EMA.ui.sound('fanfare');
      view.resetScroll = true;
      render();
      EMA.ui.fx.celebrate({ kind: 'early', em: '🔥', title: '어제 불꽃 살렸어요!', sub: '⏰ 어제분으로 올렸어요 · 코인 +5', ms: 2100 });
      EMA.ui.toast('어제 불꽃을 살렸어요! 🔥');
    },

    /* ---- 밀린문제: ⭕ 맞았어요 / ❌ 틀렸어요 ---- */
    resolveCarry(d) {
      const r = store.resolveCarried(view.classId, view.studentId, d.id);
      if (!r) return;
      view.carryWhy = null;
      EMA.ui.sound(r.skip ? 'coin' : 'crit');
      const mx = store.ensureMission(view.classId, view.studentId);
      render();
      const sub = r.skip
        ? '안 푼 문제라 코인 +1만 들어요'
        : `+${r.coins}코인 · +${r.xp} XP${r.join && r.join.pet ? ' · 🥚→🐾 펫 알 부화!' : ''}`;
      EMA.ui.fx.celebrate({ kind: 'title', em: r.skip ? '✅' : '⚔️', title: '해결!', sub, ms: 1700 });
      if (r.join && r.join.pet) EMA.ui.sound('hatch');
      const nextHint = (view.carryMode === 'one' && store.carried(view.classId, view.studentId).length) ? ' · 다음 문제 →' : '';
      EMA.ui.toast((r.capped ? '해결! 오늘 정식 보상 5개를 넘어 코인 1개만 들어요' : r.skip ? '해결! 안 푼 문제는 코인 1개만 들어요' : '밀린문제 하나 해결! ⚔️') + nextHint);
      if (r.killed && r.killed.boss) setTimeout(() => bigCeleb({ kind: 'boss', em: '🏆', title: '보스 처치!', sub: '반 전원 보너스 코인 30개', sfx: 'bossdown' }), 1800);
      if (r.effort && !r.skip) EMA.ui.fx.banner('📣 선생님께 \'오늘 열심히 했어요!\' 알림이 전달됐어요!', 'effort', 3400);
      if (mx && mx.then) mx.then(x => x && missionToast(x));
      else if (mx) missionToast(mx);
    },
    /* ❌ 틀렸어요 → 이유를 골라야 하고, 문제는 목록에 그대로 남습니다 */
    carryWrong(d) {
      view.carryWhy = view.carryWhy === d.id ? null : d.id;
      EMA.ui.sound('tap');
      render();
      if (view.carryWhy) {
        EMA.ui.toast(view.carryMode === 'one'
          ? '왜 틀렸는지 하나 고르면 다음 문제로 넘어가요'
          : '왜 틀렸는지 하나 골라 주세요 (문제는 다시 도전 목록에 남아요)');
      }
    },
    carryWhySet(d) {
      const item = store.retryCarried(view.classId, view.studentId, d.id, d.t);
      const one = view.carryMode === 'one';
      view.carryWhy = null;
      if (one && view.carryOne && view.carryOne.sid === view.studentId) {
        // 🎯 한 문제씩 — 이유를 고르면 다음 문제로 넘어갑니다 (문제는 다시 도전 목록에 남아요)
        const q = view.carryOne;
        if (q.ids[q.idx] === d.id) q.idx++;
      }
      EMA.ui.sound('tap');
      view.resetScroll = true;
      render();
      if (item) EMA.ui.toast(one ? '이유를 적어 두고 다음 문제로 넘어갈게요 · 이 문제는 다시 도전 목록에 남아요 💪' : '이유를 적어 두고 다시 도전 목록에 남겼어요 · 다음에 또 풀어 봐요 💪');
    },
    /** [📋 목록으로 | 🎯 한 문제씩] 전환 — 한 문제씩으로 새로 들어갈 때는 지금 남은 문제부터 1/N */
    carryMode(d) {
      const m = d.m === 'one' ? 'one' : 'list';
      const changed = view.carryMode !== m;
      view.carryMode = m;
      view.carryWhy = null;
      if (m === 'one' && changed) view.carryOne = null;
      view.resetScroll = true;
      EMA.ui.sound('tap');
      render();
    },

    /* ---- 프로필 ---- */
    editProfile() { view.pending = { photo: view.pending.photo, avatar: null, nickname: '', yphoto: null }; view.sheet = 'profile'; render(); },
    avatar(d) { view.pending.avatar = d.a; EMA.ui.sound('tap'); render(); },
    saveProfile() {
      const nick = (document.querySelector('#nickInput') || {}).value || '';
      if (nick && !/^[가-힣]{1,4}$/.test(nick)) { EMA.ui.toast('닉네임은 한글 4글자 이내로 정해 주세요'); return; }
      const me = store.student(view.classId, view.studentId);
      store.saveProfile(view.classId, view.studentId, {
        avatar: view.pending.avatar || me.avatar,
        nickname: nick || me.nickname
      });
      view.sheet = null; EMA.ui.toast('저장했어요'); EMA.ui.sound('coin');
      render();
    },
    saveOnboard() {
      const nick = (document.querySelector('#nickInput') || {}).value || '';
      if (!/^[가-힣]{1,4}$/.test(nick)) { EMA.ui.toast('닉네임은 한글 1~4글자로 정해 주세요 (예: 도연)'); return; }
      store.saveProfile(view.classId, view.studentId, { avatar: view.pending.avatar || '🦊', nickname: nick });
      view.pending = { photo: null, avatar: null, nickname: '', yphoto: null };
      view.sheet = null; view.flow = null;
      saveDraft();
      EMA.ui.sound('levelup');
      EMA.ui.fx.confetti(50);
      EMA.ui.toast('환영해요, ' + nick + '! 🔥');
      render();
    },
    openPinChange() { view.sheet = 'pinchange'; render(); },
    savePin() {
      const v = (document.querySelector('#newPin') || {}).value || '';
      if (!/^\d{4}$/.test(v)) { EMA.ui.toast('숫자 4자리로 정해 주세요'); return; }
      const s = store.student(view.classId, view.studentId);
      s.pin = v;
      store.save && store.save();
      view.sheet = null; EMA.ui.toast('PIN을 바꿨어요');
      render();
    },
    logout() {
      store.setSession(null); clearDraft();
      view.role = 'login'; view.step = 'class'; view.pin = ''; view.sheet = null; view.flow = null; view.resetScroll = true;
      render();
    },
    async resetDemo() {
      if (!confirm('이 기기의 기록을 처음(예시) 상태로 되돌릴까요?\n\n지금 데이터는 이 기기에 백업해 둔 뒤 새로 시작합니다.')) return;
      if (store.reset) await store.reset();
      clearDraft();
      view.role = 'login'; view.step = 'class'; view.sheet = null; view.flow = null; view.resetScroll = true;
      render();
      EMA.ui.toast('처음 상태로 되돌렸어요 · 지금 데이터는 백업해 두었습니다');
    },

    /* ---- 선생님 ---- */
    stamp(d) {
      store.stamp(view.classId, d.id);
      EMA.ui.sound('stamp');
      render();
      EMA.ui.fx.confetti(30);
      EMA.ui.toast('도장 완료! 최종 확정 ✅');
    },
    stampAll() {
      const r = store.stampAllPending(view.classId);
      EMA.ui.sound('stamp');
      if (!r.count) { EMA.ui.toast('지금 도장할 사진이 없어요'); render(); return; }
      EMA.ui.fx.confetti(50);
      EMA.ui.toast(`${r.count}장 한꺼번에 도장! ✅`);
      render();
    },
    resubmit(d) {
      store.requestResubmit(view.classId, d.id);
      EMA.ui.toast('재제출을 요청했어요');
      EMA.ui.sound('tap');
      render();
    },
    unlock(d) {
      store.unlockSubmission(view.classId, d.id);
      EMA.ui.toast('제출을 풀어 줬어요 · 아이가 다시 낼 수 있어요');
      render();
    },
    toggleSick(d) {
      const on = store.toggleSick(view.classId, d.id);
      EMA.ui.sound('tap');
      EMA.ui.toast(on ? '🤒 오늘 불꽃 보호 ON' : '불꽃 보호 OFF');
      render();
    },
    photoView(d) {
      view.printSid = d.id; view.sheet = 'photocopy'; render();
    },
    openPrintSet(d) {
      view.printSid = d.id;
      const info = store.printInfo(view.classId, d.id);
      view.printInput = info ? String(info.count) : '';
      view.sheet = 'printset'; render();
    },
    printNum(d) {
      view.printInput = d.n;
      const inp = document.querySelector('#printInput'); if (inp) inp.value = d.n;
      render();
    },
    savePrint() {
      const v = (document.querySelector('#printInput') || {}).value || view.printInput;
      const n = parseInt(v, 10);
      if (!n || n < 1 || n > 60) { EMA.ui.toast('1~60 사이 문제 수를 넣어 주세요'); return; }
      store.setPrint(view.classId, view.printSid, n);
      const s = store.student(view.classId, view.printSid);
      view.printSid = null; view.sheet = null;
      EMA.ui.sound('coin');
      EMA.ui.toast(`${s.name} 오답프린트 ${n}문제로 설정!`);
      render();
    },
    clearPrint() {
      store.setPrint(view.classId, view.printSid, 0);
      view.printSid = null; view.printInput = ''; view.sheet = null;
      EMA.ui.toast('오답프린트를 없앴어요');
      render();
    },
    printPickNum(d) { view.printInput = d.n; render(); },
    savePrintPick() {
      const v = (document.querySelector('#printPickInput') || {}).value || view.printInput;
      const n = parseInt(v, 10);
      if (!n || n < 1 || n > 60) { EMA.ui.toast('마지막 번호를 1~60 사이로 알려 주세요'); return; }
      store.setPrintLastNo(view.classId, view.studentId, n);
      view.sheet = null;
      EMA.ui.sound('coin');
      EMA.ui.toast(`1~${n}번 채점 칸을 만들었어요`);
      view.homeTab = 'print';
      render();
    },
    openReport(d) {
      view.reportSid = d.id; view.reportRange = 'week'; view.reportImg = null;
      view.sheet = 'report'; EMA.ui.sound('tap'); render();
    },
    reportRange(d) { view.reportRange = d.r; view.reportImg = null; render(); },
    saveReportImage() {
      const cid = view.classId, sid = view.reportSid, rg = view.reportRange || 'week';
      const s = store.student(cid, sid), c = store.getClass(cid);
      if (!s) return;
      const r = store.parentReport(cid, sid, rg);
      try {
        const out = reportImageData(s, c, r);
        view.reportImg = out.data;
        view.reportImgName = '성취도리포트_' + s.name + '_' + r.to + '.png';
        view.sheet = 'reportimg';
        EMA.ui.sound('coin');
        render();
      } catch (e) {
        EMA.ui.toast('이미지를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      }
    },
    backReport() { view.sheet = 'report'; render(); },
    openCopyText() { view.sheet = 'reportcopy'; EMA.ui.sound('tap'); render(); },
    copySelectAll() {
      const ta = document.querySelector('#copyArea');
      if (!ta) return;
      try { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); } catch (e) { }
      EMA.ui.toast('전체 선택했어요. 길게 눌러 복사해 주세요 📋', 2600);
    },
    copyAgain() { actions.copyReport(); },
    copyReport() {
      const cid = view.classId;
      const text = store.kakaoSummary(cid, view.reportSid, view.reportRange);
      const ok = EMA.ui.copy(text);          // 클릭 안에서 동기로 복사 (iOS 사파리 대응)
      if (ok) {
        EMA.ui.toast('복사 완료! 카톡에 붙여넣기 하세요 📋', 3000);
        EMA.ui.sound('coin');
      } else {
        view.sheet = 'reportcopy';
        render();
        EMA.ui.toast('글자를 길게 눌러 직접 복사해 주세요 📋', 3200);
        EMA.ui.sound('wrong');
      }
    },
    useClaim(d) {
      store.useClaim(d.id);
      EMA.ui.toast('간식 쿠폰 사용 처리했어요');
      render();
    },
    toggleRewards() {
      const on = store.state.shop ? store.state.shop.rewardsOn !== false : true;
      store.setRewardsOn(!on);
      EMA.ui.toast(!on ? '현실 보상 쿠폰을 켰어요' : '현실 보상 쿠폰을 껐어요');
      render();
    },
    bigTop5() { view.sheet = 'top5big'; render(); },
    previewFx(d) {
      const map = {
        shield: { kind: 'shield', em: '🛡️', title: '보스 방어막 발동!', sub: '수업 당일에 몰아서 내면 보스·코인 50%만 들어가요', sfx: 'shield' },
        early: { kind: 'early', em: '⚡', title: '얼리버드 크리티컬 2배!', sub: '숙제 나간 당일·다음 날 내면 코인 2배', sfx: 'fanfare' },
        legend: { kind: 'legend', em: '🐈', title: '전설 피타고라스 냥이 획득!', sub: '전설 등급 · 도감에 등록됐어요', sfx: 'legendary', ms: 2300 },
        boss: { kind: 'boss', em: '🏆', title: '보스 처치!', sub: '반 전원 보너스 코인 30개 · 한정판 칭호', sfx: 'bossdown', ms: 2400 }
      };
      const o = map[d.k]; if (!o) return;
      EMA.ui.fx.celebrate(o);
      EMA.ui.sound(o.sfx);
      if (d.k === 'legend' || d.k === 'boss') EMA.ui.fx.confetti(90);
    },
    revealPin(d) { view.pinReveal = view.pinReveal === d.id ? null : d.id; render(); },
    /** 학생 PIN 초기화 — 한 번에 1234로 */
    resetStudentPin(d) {
      const s = store.student(view.classId, d.id);
      if (!s) return;
      s.pin = '1234';
      store.save();
      view.pinReveal = d.id;
      EMA.ui.sound('coin');
      EMA.ui.toast(`${s.name} PIN을 1234로 초기화했어요`);
      render();
    },
    /** 선생님 확인 후 사진 지우기 (제출·채점 기록은 남김) */
    async deletePhoto(d) {
      const sid = d.sid || view.bigPhotoSid;
      const sub = store.submission(view.classId, sid) || store.submission(view.classId, sid, null, 'print');
      if (!sub || !sub.photoId) { EMA.ui.toast('지울 사진이 없어요'); return; }
      if (!confirm('이 사진을 앱에서 지울까요? 제출·채점 기록은 그대로 남습니다.')) return;
      await store.deletePhoto(sub.photoId);
      sub.photoDeleted = true;
      sub.photoDeletedAt = store.state.today;
      store.save();
      view.sheet = null;
      EMA.ui.toast('사진을 지웠어요 · 제출 기록은 그대로예요');
      render();
    },
    /** 비상 복구 키 다시 만들기 (선생님이 로그인한 상태에서) */
    async reissueRecovery() {
      if (!confirm('새 복구 키를 만들까요? 예전 키는 쓸 수 없게 됩니다.')) return;
      view.recoveryCode = await EMA.auth.issueRecovery();
      view.sheet = 'recovery';
      EMA.ui.sound('coin');
      render();
    },
    regenPin(d) {
      const pin = store.regenPin(view.classId, d.id);
      view.pinReveal = d.id;
      EMA.ui.toast('새 PIN: ' + pin);
      render();
    },
    rankMode(d) { view.rankMode = d.m; render(); },
    rankScope(d) { view.rankScope = d.s; render(); },
    pmBook(d) { view.pmBook = d.b; view.pmList = null; render(); },
    pmPage(d) {
      const l = store.lesson(view.classId) || {};
      const book = view.pmBook || l.book || store.bookList()[0];
      view.pmBook = book;
      const p = store.pagesOfBook(book).find(x => x.page === parseInt(d.p, 10));
      view.pmPage = parseInt(d.p, 10);
      view.pmInput = p ? p.problems.join(', ') : '';
      view.pmList = p ? p.problems.slice() : [];
      view.sheet = 'pmpage'; render();
    },
    pmAddPage() {
      const v = (document.querySelector('#pmNewPage') || {}).value || '';
      const p = parseInt(v, 10);
      if (!p || p < 1 || p > 999) { EMA.ui.toast('쪽 번호를 숫자로 넣어 주세요 (예: 18)'); return; }
      const book = view.pmBook || (store.books(view.classId)[0] || {}).book || store.bookList()[0];
      view.pmBook = book;
      view.pmPage = p;
      const hit = store.pageInfo(book, p);
      view.pmInput = hit ? hit.문제.join(', ') : '';
      view.pmList = hit ? hit.문제.slice() : [];
      view.sheet = 'pmpage';
      render();
    },
    /** 쪽수표 문제번호 — 범위(1~14번, 15~28번)로 자동 생성 */
    pmRange() {
      const v = (document.querySelector('#pmInput') || {}).value || '';
      view.pmInput = v;
      view.pmList = rangeList(v);
      EMA.ui.sound('tap');
      render();
    },
    pmDel(d) {
      view.pmList = (view.pmList || []).filter(n => String(n) !== String(d.n));
      view.pmInput = view.pmList.join(', ');
      render();
    },
    pmAdd() {
      const v = String((document.querySelector('#pmNewNo') || {}).value || '').trim();
      if (!v) { EMA.ui.toast('번호를 넣어 주세요'); return; }
      // ★ '2,4,5,6' 처럼 쉼표로 여러 개를 넣어도 각각 따로 들어갑니다
      const add = rangeList(v);
      if (!add.length) { EMA.ui.toast('번호를 숫자로 넣어 주세요 (예: 2-1)'); return; }
      view.pmList = (view.pmList || []).concat(add);
      view.pmInput = view.pmList.join(', ');
      render();
    },
    pmSave() {
      const typed = (document.querySelector('#pmInput') || {}).value;
      let list = typed != null && rangeList(typed).length ? rangeList(typed)
        : (view.pmList && view.pmList.length) ? view.pmList.slice() : rangeList(view.pmInput);
      // 저장 전에 한 번 더 — 혹시 한 칸에 '2,4,5,6'이 통째로 들어갔으면 쪼개 줍니다
      const flat = [];
      list.forEach(n => rangeList(n).forEach(x => { if (flat.indexOf(x) < 0) flat.push(x); }));
      list = flat;
      if (!list.length) { EMA.ui.toast('문제 번호를 적어 주세요'); return; }
      const book = view.pmBook || (store.lesson(view.classId) || {}).book || store.bookList()[0];
      store.setPageProblem(book, view.pmPage, list);
      view.sheet = null; view.pmList = null;
      EMA.ui.toast(view.pmPage + '쪽 문제 ' + list.length + '개를 저장했어요');
      render();
    },
    lessonEdit() {
      const l = store.lesson(view.classId);
      const b0 = store.books(view.classId)[0] || {};
      view.lessonEditBook = b0.book || (l && l.book);
      view.lessonEditPages = (b0.pages || []).slice();
      view.lessonEditInput = pagesText(view.lessonEditPages);
      view.lessonEditMode = b0.mode || '';
      view.lessonEditDue = store.dueAtOf(view.classId);
      view.sheet = 'lessonEdit'; render();
    },
    openLessonEdit() { actions.lessonEdit(); },
    lessonBook(d) {
      view.lessonEditBook = d.b;
      const b = store.books(view.classId).find(x => x.book === d.b) || { pages: [] };
      view.lessonEditPages = (b.pages || []).slice();
      view.lessonEditInput = pagesText(view.lessonEditPages);
      view.lessonEditMode = b.mode || '';
      render();
    },
    lessonMode(d) {
      view.lessonEditMode = d.m || '';
      EMA.ui.sound('tap');
      render();
      const n = store.tilesOf(view.lessonEditBook, view.lessonEditPages || [], view.lessonEditMode).length;
      EMA.ui.toast(`${EMA.util.HW_MODE_LABEL[view.lessonEditMode] || '전체'} · 문제 ${n}개`, 3000);
    },
    lessonRange() {
      const v = (document.querySelector('#pageInput') || {}).value || '';
      const parsed = EMA.util.parsePagesMode ? EMA.util.parsePagesMode(v) : { pages: EMA.util.parsePages(v), mode: '' };
      view.lessonEditInput = v;
      view.lessonEditPages = parsed.pages;
      if (parsed.mode) view.lessonEditMode = parsed.mode;
      EMA.ui.sound('tap');
      render();
      const n = store.tilesOf(view.lessonEditBook, view.lessonEditPages, view.lessonEditMode).length;
      EMA.ui.toast(parsed.pages.length
        ? `✓ ${pagesText(parsed.pages)}쪽 · ${EMA.util.HW_MODE_LABEL[view.lessonEditMode] || '전체'} → 문제 ${n}개`
        : '쪽수를 숫자로 적어 주세요 (예: 19~22)', 3400);
    },
    lessonPageDel(d) {
      view.lessonEditPages = (view.lessonEditPages || []).filter(p => String(p) !== String(d.p));
      view.lessonEditInput = pagesText(view.lessonEditPages);
      render();
    },
    lessonPageAdd() {
      const v = (document.querySelector('#lessonNewPage') || {}).value || '';
      const p = parseInt(v, 10);
      if (!p || p < 1 || p > 999) { EMA.ui.toast('쪽 번호를 숫자로 넣어 주세요 (예: 18)'); return; }
      const list = (view.lessonEditPages || []).slice();
      if (list.indexOf(p) < 0) list.push(p);
      view.lessonEditPages = list.sort((a, b) => a - b);
      view.lessonEditInput = pagesText(view.lessonEditPages);
      render();
    },
    dueNext() { view.lessonEditDue = store.defaultDueAt(view.classId); render(); },
    dueClear() { view.lessonEditDue = ''; render(); },
    saveLesson() {
      const cid = view.classId;
      const pages = (view.lessonEditPages || []).slice().sort((a, b) => a - b);
      if (!pages.length) { EMA.ui.toast('쪽수를 범위로 만들거나 하나 추가해 주세요'); return; }
      const book = view.lessonEditBook || (store.books(cid)[0] || {}).book;
      const mode = EMA.util.HW_MODES.indexOf(view.lessonEditMode) > 0 ? view.lessonEditMode : '';
      const tiles = store.tilesOf(book, pages, mode);
      const missing = pages.filter(p => !store.pageInfo(book, p));
      const books = store.books(cid).map(b => b.book === book ? { book, pages, mode } : b);
      if (!books.find(b => b.book === book)) books.push({ book, pages, mode });
      const dueEl = document.querySelector('#dueAt');
      const dueVal = String(dueEl ? dueEl.value : (view.lessonEditDue || '')).replace('T', ' ').trim();
      store.saveLesson(cid, {
        date: store.state.today,
        books,
        homework: books.map(b => b.book + ' ' + pagesText(b.pages) + '쪽' + (EMA.util.HW_MODE_SUFFIX[b.mode] || '')).join(', '),
        assignedAt: (store.lesson(cid) || {}).assignedAt || store.state.today
      });
      store.setDue(cid, dueVal);
      view.lessonEditInput = pagesText(pages);
      view.sheet = null;
      const d = store.dueInfo(cid);
      const modeTxt = mode ? ' · ' + EMA.util.HW_MODE_LABEL[mode] : '';
      EMA.ui.toast(missing.length
        ? `${book} ${pagesText(pages)}쪽${modeTxt} → 문제 ${tiles.length}개 (${missing.join(', ')}쪽은 쪽수표에 없어 ?로 나와요)`
        : `${book} ${pagesText(pages)}쪽${modeTxt} → 문제 ${tiles.length}개 · 기한 ${d.label}`, 3600);
      render();
    },
    /** ⏰ 지금 마감 — 안 푼 문제를 바로 밀린문제로 */
    closeDue() {
      if (!confirm('지금 숙제를 마감할까요? 안 푼 문제는 ⚔️ 밀린문제로 넘어갑니다.')) return;
      const n = store.closeDue(view.classId);
      EMA.ui.sound('coin');
      EMA.ui.toast(n ? `마감했어요 · 안 푼 ${n}문제를 밀린문제로 넘겼어요` : '마감했어요', 3200);
      render();
    },
    dashRange(d) { view.dashRange = d.r; view.dashOpen = {}; EMA.ui.sound('tap'); render(); },
    dashOpen(d) { view.dashOpen[d.k] = !view.dashOpen[d.k]; EMA.ui.sound('tap'); render(); },
    /** 프린트 문제 수를 학생 한 명에게 복사 */
    copyPrintOne(d) {
      const cid = view.classId;
      const info = store.printInfo(cid, view.printSid);
      if (!info) { EMA.ui.toast('먼저 이 학생의 프린트 문제 수를 저장해 주세요'); return; }
      store.copyPrint(cid, view.printSid, [d.id]);
      const to = store.student(cid, d.id);
      EMA.ui.sound('coin');
      EMA.ui.toast(`${to.name} 학생에게 ${info.count}문제로 똑같이 넣었어요`);
      render();
    },
    /** 프린트 문제 수를 반 전체에 복사 */
    copyPrintAll(d) {
      const cid = view.classId;
      const info = store.printInfo(cid, d.id);
      if (!info) { EMA.ui.toast('복사할 프린트가 없어요'); return; }
      const to = store.activeStudents(cid).map(s => s.id);
      const n = store.copyPrint(cid, d.id, to);
      EMA.ui.sound('coin');
      EMA.ui.toast(`${info.count}문제를 ${n}명에게 똑같이 넣었어요`);
      render();
    },
    moveOpen(d) { view.moveSid = d.id; view.moveTo = null; view.sheet = 'moveStu'; render(); },
    moveTo(d) { view.moveTo = d.id; render(); },
    moveGo() {
      const r = store.moveStudent(view.classId, view.moveSid, view.moveTo);
      if (!r) { EMA.ui.toast('옮기지 못했어요'); return; }
      const to = store.getClass(view.moveTo);
      view.sheet = null; view.moveSid = null; view.moveTo = null;
      EMA.ui.sound('fanfare');
      EMA.ui.toast(`${r.name} 학생을 ${to.name} 반으로 옮겼어요 · 기록 그대로`);
      render();
    },
    retire(d) {
      const s = store.student(view.classId, d.id);
      if (!s) return;
      if (!confirm(`${s.name} 학생을 퇴원(보관) 처리할까요? 기록은 지우지 않고 그대로 보관해요.`)) return;
      store.retireStudent(view.classId, d.id);
      EMA.ui.toast(`${s.name} 학생을 퇴원(보관)했어요 · 기록은 남아 있어요`, 3000);
      render();
    },
    restore(d) {
      const s = store.restoreStudent(view.classId, d.id);
      EMA.ui.sound('coin');
      EMA.ui.toast(`${s.name} 학생을 다시 재원으로 돌렸어요`);
      render();
    },
    /** ⚠️ 쪽수표에 없는 쪽 번호 바로 넣기 */
    fixMissing(d) {
      view.pmBook = d.b;
      view.pmPage = parseInt(d.p, 10);
      view.pmInput = '';
      view.pmList = [];
      view.sheet = 'pmpage';
      render();
    },
    openStuReset(d) { view.stuResetSid = d.id; view.sheet = 'stuReset'; render(); },
    async stuResetGo(d) {
      const pin = String((document.querySelector('#stuResetPin') || {}).value || '').trim();
      if (!/^\d{4}$/.test(pin)) { EMA.ui.toast('선생님 PIN 4자리를 넣어 주세요'); return; }
      const ok = await EMA.auth.verifyPin(pin);
      if (!ok) { EMA.ui.toast('선생님 PIN이 달라요'); EMA.ui.sound('wrong'); return; }
      const r = store.resetStudentRecords(view.classId, d.id);
      if (!r) { EMA.ui.toast('학생을 찾지 못했어요'); return; }
      view.sheet = null;
      EMA.ui.sound('coin');
      EMA.ui.toast(`${r.name} 학생 기록을 초기화했어요 (코인 ${r.before.coins} · 펫 ${r.before.pets}마리 → 0)`, 3400);
      render();
    },
    copyLessonOpen() { view.copyTo = null; view.sheet = 'copyLesson'; render(); },
    copyTo(d) { view.copyTo = d.id; render(); },
    copyGo() {
      const r = store.copyLesson(view.classId, view.copyTo);
      if (!r) { EMA.ui.toast('복사하지 못했어요'); return; }
      const to = store.getClass(view.copyTo);
      view.sheet = null; view.copyTo = null;
      EMA.ui.sound('fanfare');
      EMA.ui.toast(`${to.name} 반에 숙제를 복사했어요 · 기한 ${store.dueInfo(to.id).label}`, 3400);
      render();
    }
  };

  /* 두 번 누르면 두 번 결제되는 사고를 막는 클릭 잠금 — 채점(⭕/❌)은 일부로 제외 */
  const LOCK_MS = {
    buy: 600, feed: 600, growCompanion: 600, useClaim: 600,
    submit: 1000, stamp: 700, stampAll: 1000, resolveCarry: 600,
    deletePhoto: 800, savePrint: 400, teacherPinOk: 900, confirmTeacherSetup2: 1000
  };
  const lockedAt = {};

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const fn = actions[act];
    if (!fn) return;
    e.preventDefault();
    const ms = LOCK_MS[act];
    if (ms) {
      const now = Date.now();
      if (lockedAt[act] && now - lockedAt[act] < ms) return;   // 연타 → 한 번만 처리
      lockedAt[act] = now;
    }
    fn(el.dataset, el);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && view.sheet) { view.sheet = null; render(); }
  });

  /* =========================================================
     부팅
  ========================================================= */
  async function boot() {
    try {
      const qs = new URLSearchParams(location.search);
      window.EMA_CONFIG = Object.assign({ mode: 'local', apiUrl: '', demo: false }, window.EMA_CONFIG || {});
      if (qs.get('mode')) window.EMA_CONFIG.mode = qs.get('mode');
      if (qs.get('api')) window.EMA_CONFIG.apiUrl = qs.get('api');
      // ?mode=demo → 연습용 저장칸(운영 데이터와 완전히 분리)
      window.EMA_CONFIG.demo = (qs.get('mode') === 'demo') || qs.get('demo') === '1';
    } catch (e) { }
    store = EMA.createStore();
    EMA.store = store;
    try {
      await store.init();
    } catch (err) {
      document.getElementById('app').innerHTML = `<div class="screen no-nav pad" style="padding-top:40px">
        <div class="card"><b>기록을 불러오지 못했어요.</b><div class="muted">${esc(err.message)}<br>학생 기록은 기기에 저장돼 있으니, 새로고침하면 이어집니다. (${store.mode === 'api' ? '시트 연결 확인 필요' : '테스트 모드'})</div></div></div>`;
      return;
    }
    // 예시 제출 사진(문제집 모양 가짜 사진) — '예시 데이터'의 예시 제출에만. 실제 제출 사진을 지어내지 않습니다.
    try {
      const cid = 'c4m2';
      const isDemo = !!(store.state.meta && store.state.meta.demo);
      if (isDemo && store.getClass(cid)) {
        const lesson = store.lesson(cid) || {};
        const jobs = [];
        store.classDay(cid).forEach(r => {
          const pid = r.sub && r.sub.photoId;
          if (pid && /^p_/.test(pid) && !store.photo(pid)) {
            jobs.push(store.putPhoto(pid, EMA.ui.fakePhoto(r.student.name, (r.sub.verify && r.sub.verify.book) || lesson.book || '6-1 발전책'), r.student.id));
          }
        });
        if (jobs.length) await Promise.all(jobs);
      }
    } catch (e) { }

    const s = store.session();
    // v0.9 — 숙제 기한이 지난 반의 미푼 문제를 한 번만 밀린문제로 이월
    try { store.sweepDue(); } catch (e) { }
    if (s && s.role === 'student' && store.student(s.classId, s.studentId)) {
      const stu = store.student(s.classId, s.studentId);
      if (stu.status === 'left') {          // 퇴원(보관)된 학생의 기기는 로그인 화면으로
        store.setSession(null);
        view.role = 'login'; view.step = 'class'; view.pin = '';
      } else {
        view.role = 'student'; view.classId = s.classId; view.studentId = s.studentId;
        const d = readDraft();
        if (d && d.classId === s.classId && d.studentId === s.studentId) {
          if (d.flow) view.flow = d.flow;
          if (d.tab) view.tab = d.tab;
          if (d.homeTab) view.homeTab = d.homeTab;
          if (d.gradeSource) view.gradeSource = d.gradeSource;
          if (d.gradeBook) view.gradeBook = d.gradeBook;
          view.pending.photo = readDraftPhoto();
        }
      }
    } else if (s && s.role === 'teacher') {
      view.role = 'teacher'; view.classId = s.classId || 'c4m2'; view.teacherTab = 'today';
    } else {
      view.role = 'login';
    }
    render();

    // 선생님 세션 12시간 — 앱을 켜 둔 채 지나도 다시 PIN을 묻게
    setInterval(() => {
      if (view.role === 'teacher' && !store.session()) {
        view.role = 'login'; view.step = 'class'; view.pin = ''; view.pinTarget = 'student';
        view.sheet = null; view.flow = null;
        if (EMA.ui) EMA.ui.toast('보안을 위해 12시간이 지나 다시 로그인해야 해요', 3600);
        render();
      }
    }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
