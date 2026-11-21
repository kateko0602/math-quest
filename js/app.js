/* 숙제 대소동 v0.5 — 화면과 동선 (미니멀 대청소)
   ─────────────────────────────────────────────────────────────
   세계관: 〈숫자 왕국 구출 대작전〉 — 알은 하나, '펫 알'뿐
     · 못 고친 오답 → 다시 풀어 ⚔️ 해결하면 '펫 알 부화!' → 펫 합류
     · 상점의 펫 알도 간식으로 키워 부화 · 펫이 많을수록 보스 공격력 +
   아이 동선(딱 3단계): 숙제 → ① 채점(⭕/❌) → ② 정리·사진 → ③ 제출 완료
   · 하단 탭 3개: 🔥 숙제 | 🐾 내 도감 | 🏆 랭킹
   · 소리·로그아웃·이야기는 우측 상단 ⚙️ 설정 시트로
   · 선생님(PIN 2580): '오늘 제출 확인 & 한꺼번에 도장' + 학생 목록, 나머지 도구는 ⚙️ 관리
*/
window.EMA = window.EMA || {};
(function () {
  const esc = EMA.ui.esc;
  const GAME = () => window.EMA_GAME || { pets: [], shop: [], bosses: [], titles: [], rarity: {}, dailyTitles: [], monsters: [], tags: [], story: {} };
  const STORY = () => GAME().story || {};
  const MIN = 3;
  const REUP_MS = 3600000;
  let store = null;

  const view = {
    role: 'login',            // login | student | teacher
    step: 'class',            // class | student | pin | teacherPin
    classId: null, studentId: null,
    pin: '', pinTarget: 'student',
    tab: 'home', homeTab: 'today', teacherTab: 'today',
    rankMode: 'first', rankScope: 'class',
    sheet: null,
    flow: null,               // null | grade | clean | done
    gradeSource: 'homework',  // homework | print
    gradeBook: null,
    pending: { photo: null, avatar: null, nickname: '', yphoto: null, tempPhoto: null, tempTarget: null, reupload: false },
    pmBook: null, pmPage: null, pmInput: '',
    lessonEditBook: null, lessonEditPages: null,
    pinReveal: null,
    reportSid: null, reportRange: 'week', reportImg: null, reportImgName: '',
    petDetail: null, monsterDetail: null, printSid: null, printInput: '',
    lastResult: null,
    bigPhotoSid: null, bigPhotoAt: '', bigPhotoFrom: '',
    tOpen: {}, stuOpen: {},
    scrollTarget: null,
    resetScroll: false
  };

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
    let c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0;
    tiles.forEach(t => {
      const m = g.marks[t.key];
      if (m === 'o') c1++;
      else if (m === 'x') {
        const cl = g.cleanup[t.key];
        if (cl === 'fixed') c3++; else if (cl === 'star') c4++; else c2++;
      } else c5++;
    });
    return { c1, c2, c3, c4, c5, marked: c1 + c2 + c3 + c4, total: tiles.length };
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
      </div>
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
    return sheetWrap('📖 ' + (st.title || '숫자 왕국 구출 대작전'), `
      <div class="storybox">
        <div class="s-em">🌑</div>
        ${lines.map(l => `<p class="s-line">${esc(l)}</p>`).join('')}
      </div>
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
      <div class="sethd">선생님</div>
      <button class="setrow" data-act="teacherEntry"><span class="se">👩‍🏫</span><span class="st">선생님 모드</span><span class="chev">›</span></button>
      <div class="sethd">계정</div>
      <button class="setrow" data-act="logout"><span class="se">↩️</span><span class="st">로그아웃</span><span class="chev">›</span></button>
      <button class="setrow danger" data-act="resetDemo"><span class="se">🧹</span><span class="st">시제품 데이터 초기화</span></button>
      <div class="hint center" style="margin-top:12px">숙제 대소동 v0.5 시제품 · 숫자 왕국 구출 대작전</div>
    `);
  }

  /* =========================================================
     로그인
  ========================================================= */
  function renderLogin() {
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
              ${c.active ? '<span class="pill ok">시범 반</span>' : '<span class="pill">준비중</span>'}
            </button>`).join('')}
        </div>
        <div class="grow"></div>
        <button class="btn btn-ghost btn-block" data-act="openStory">📖 이야기 보기</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="teacherEntry">👩‍🏫 선생님이세요? 선생님 모드</button>
        <div class="pin-hint">체험용 · 학생 PIN <b>1234</b> · 선생님 PIN <b>2580</b></div>
        <div class="verline">v0.5 시제품</div>
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
            ${c.students.map(s => `
              <button class="student-btn" data-act="pickStudent" data-id="${s.id}">
                <span class="av">${esc(s.avatar || '🙂')}</span>
                <span class="nm">${esc(s.name)}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="grow"></div>
        <div class="pin-hint">이름은 시트 명단 그대로라 오타·동명이인 걱정이 없어요.</div>      </div>
      ${sheetHtml()}`;
    }
    const isTeacher = view.pinTarget === 'teacher';
    const who = isTeacher ? '선생님' : (store.student(view.classId, view.studentId) || {}).name;
    return `<div class="screen no-nav login">
      ${topbar({ title: '비밀번호 4자리', sub: who, back: true })}
      <div class="step" style="margin-top:0">
        <div class="step-t">${isTeacher ? '선생님 PIN' : '3단계 · 내 PIN'}</div>
        <div class="pin-dots">${[0, 1, 2, 3].map(i => `<div class="pin-dot ${view.pin.length > i ? 'on' : ''}"></div>`).join('')}</div>
        <div class="keypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-act="pinKey" data-k="${n}">${n}</button>`).join('')}
          <button class="key fn" data-act="pinBack">지우기</button>
          <button class="key" data-act="pinKey" data-k="0">0</button>
          <button class="key fn" data-act="pinDel">⌫</button>
        </div>
        ${isTeacher ? '' : '<div class="pin-hint">PIN을 잊으면 선생님이 1초에 알려 줄 수 있어요.</div>'}
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
        <div class="who">${esc(me.nickname || me.name)} <span class="lv">Lv.${lv.lv}</span></div>
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
      <input type="file" class="photo-input" data-target="clean" accept="image/*" capture="environment" aria-hidden="true">
      ${sheetHtml()}
    </div>`;
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

    const lessonHtml = l ? `
      <div class="card lesson-card">
        <div class="ln"><div class="k">진도</div><div class="v">${esc(l.lesson)}</div></div>
        <div class="ln"><div class="k">숙제</div><div class="v">${esc(l.homework)}</div></div>
        <div class="booklist">
          ${bs.map(b => {
            const t = store.tiles(cid, b.book);
            return `<div class="bookrow"><span class="be">${b.book.indexOf('응용') >= 0 ? '📙' : '📘'}</span>
              <span class="bn">${esc(b.book)}</span>
              <span class="bp">${b.pages.length > 1 ? b.pages[0] + '~' + b.pages[b.pages.length - 1] : b.pages[0]}쪽 · ${t.length}문제</span></div>`;
          }).join('')}
        </div>
        ${timing.kind === 'early' ? '<div class="timing early">⚡ 얼리버드 · 코인 2배</div>'
          : timing.kind === 'shield' ? '<div class="timing shield">🛡️ 수업 당일 · 보스·코인 50%</div>' : ''}
      </div>` : `<div class="card"><div class="empty">📭 오늘은 숙제가 없어요</div></div>`;

    const hasHw = tiles.length > 0;
    const up = store.reuploadInfo(cid, sid, 'hw');
    let cta, ctaAct = 'startGrade';
    if (!hasHw) {
      cta = '📭 오늘은 숙제가 없어요';
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
      ${missingY ? `<button class="yflame" data-act="yesterday">
        <span class="em">🔥</span>
        <span class="grow"><b>어제 불꽃 살리기</b><small>어제 푼 사진을 올리면 살아나요</small></span>
        <span class="go">올리기</span></button>` : ''}

      ${lessonHtml}

      <div class="cta-wrap">
        <button class="btn btn-primary btn-block btn-xl" data-act="${ctaAct}" ${!hasHw ? 'style="filter:grayscale(.25);opacity:.8"' : ''}>${cta}</button>
        <div class="quickrow">
          <button class="btn btn-ghost btn-sm" data-act="gallery">👀 친구들 풀이</button>
          <button class="btn btn-ghost btn-sm" data-act="openShop">🛍️ 상점</button>
          ${store.hasPrint(cid, sid) ? '<button class="btn btn-ghost btn-sm" data-act="startPrint">📝 오답프린트</button>' : ''}
        </div>
      </div>

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
        <div class="hplb"><span>도장 ${boss.stamped}/${boss.total}</span><span>🎯 내가 ${mine}%</span></div>
        <div class="combat">🐾 내 펫 ${store.myPets(cid, sid).length}마리 · 공격력 +${store.companionPct(cid, sid)}%</div>
        ${boss.killed ? '<div class="bosskill">🏆 우리 반이 보스를 잡았어요!</div>' : ''}
      </div>

      ${eggStrip(cid, sid)}

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
        ${store.photo(sub.photoId) ? `<button class="photo-open" data-act="photoBig" data-sid="${sid}" data-at="${esc(sub.at)}"><img src="${store.photo(sub.photoId).data}" alt="내가 낸 사진"><span class="zoom">확대</span></button>` : ''}
        <div class="row" style="margin-top:10px">
          <button class="btn btn-ghost grow" data-act="gallery">👀 친구들 풀이</button>
          ${up.ok ? `<button class="btn btn-primary grow" data-act="reupload">📸 사진 다시 (${up.mins}분)</button>`
            : sub.status === 'resubmit' || sub.status === 'unlocked' ? `<button class="btn btn-primary grow" data-act="startGrade">다시 내기</button>` : ''}
        </div>
      </div>` : ''}
      ${carried.length ? `<div class="card tight">
        <div class="card-hd"><span class="t">⚔️ 밀린문제 ${carried.length}개</span><span class="grow"></span>
          <button class="linkbtn" style="width:auto;padding:0" data-act="homeTab" data-t="carry">고치기 →</button></div>
        <div class="muted" style="font-size:12px">${carried.slice(0, 2).map(m => esc(m.label)).join(' · ')}${carried.length > 2 ? ' 외 ' + (carried.length - 2) + '개' : ''}</div>
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

  function homeCarry(cid, sid) {
    const list = store.carried(cid, sid);
    const solved = store.solvedCarried(sid);
    const reasonTxt = { x: '❌ 틀림', star: '⭐ 질문', skip: '⏭️ 안 풀었음' };
    if (!list.length) {
      return `<div class="card"><div class="empty">🎉 밀린 문제가 없어요!${solved.length ? `<br><small>지금까지 ${solved.length}개를 스스로 고쳤어요</small>` : ''}</div></div>`;
    }
    return `
      ${list.map(m => `
        <div class="carrycard">
          <div class="cc-em">${m.em || '👾'}</div>
          <div class="grow">
            <div class="cc-nm">${esc(m.name || '못 고친 오답')}</div>
            <div class="cc-lb">${esc(m.book === '프린트' ? '' : m.book + ' ')}${m.page}쪽 ${esc(m.num)}번 <span class="dot">·</span> ${esc(m.date.slice(5))} <span class="dot">·</span> ${reasonTxt[m.reason] || '❌'}</div>
          </div>
          <button class="btn btn-mint btn-sm" data-act="resolveCarry" data-id="${m.id}">⚔️ 해결!</button>
        </div>`).join('')}
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
  function flowGrade() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid);
    const isPrint = view.gradeSource === 'print';
    const bs = store.books(cid);
    if (!isPrint && bs.length > 1 && !bs.find(b => b.book === view.gradeBook)) view.gradeBook = bs[0].book;

    const tiles = sourceTiles();
    const g = sourceGrade();
    const cnt = countTiles(tiles, g);

    let rows = '', lastPage = null;
    const tagDefs = GAME().tags || [];
    tiles.forEach(t => {
      if (t.page !== lastPage) {
        rows += `<div class="pgroup">${isPrint ? '오답프린트' : t.page + '쪽'}${!isPrint && t.type && t.type !== '표없음' ? ' · ' + esc(t.type) : ''}</div>`;
        lastPage = t.page;
      }
      const m = g.marks[t.key] || '';
      const cur = g.tags[t.key] || '';
      rows += `<div class="ox-block">
        <div class="ox-row ${isPrint ? 'compact' : ''} ${t.missing ? 'is-missing' : ''}">
          <div class="ox-label">${esc(t.label)}<span>번</span></div>
          <button class="ox o ${m === 'o' ? 'on' : ''}" data-act="mark" data-key="${t.key}" data-m="o" ${t.missing ? 'disabled' : ''} aria-label="${esc(t.label)}번 맞음">⭕ 맞음</button>
          <button class="ox x ${m === 'x' ? 'on' : ''}" data-act="mark" data-key="${t.key}" data-m="x" ${t.missing ? 'disabled' : ''} aria-label="${esc(t.label)}번 틀림">❌ 틀림</button>
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

    const untagged = tiles.filter(t => g.marks[t.key] === 'x' && !(g.tags || {})[t.key]).length;

    return `<div class="screen flow">
      ${topbar({
        title: isPrint ? '① 프린트 채점' : '① 채점',
        sub: isPrint ? `${tiles.length}문제` : `${view.gradeBook || '오늘 숙제'} · ${tiles.length}문제`,
        back: true, backAct: 'flowBack',
        right: avatarHtml(me, 32)
      })}
      ${stepper(1)}
      ${bookTabs}
      ${oxSum(cnt)}
      <div class="card oxcard">
        <button class="btn btn-mint btn-block" data-act="markAll">⭕ 모두 맞음</button>
        <div class="rows ${isPrint ? 'gridrows' : ''}">${rows}</div>
      </div>
      <div class="flowfoot">
        ${untagged ? `<div class="tag-need">왜 틀렸는지 <b>${untagged}개</b> 더 골라야 해요</div>` : ''}
        <button class="btn btn-primary btn-block btn-lg" data-act="toClean">다음 → 정리 · 사진</button>
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
    const tiles = sourceTiles();
    const g = sourceGrade();
    const cnt = countTiles(tiles, g);
    const sub = store.submission(cid, sid, null, isPrint ? 'print' : 'hw');
    const existingPhoto = sub ? store.photo(sub.photoId) : null;
    const up = store.reuploadInfo(cid, sid, isPrint ? 'print' : 'hw');
    const locked = !!(sub && existingPhoto && !up.ok);
    const verify = isPrint ? { book: '오답프린트', page: '프린트' } : (sub && sub.verify) || store.verifyTarget(cid, sid);

    const wrong = tiles.filter(t => g.marks[t.key] === 'x');
    const rest = tiles.filter(t => !g.marks[t.key]);
    const kindNow = isPrint ? 'print' : 'hw';
    const starCnt = store.starCount(cid, sid, kindNow);

    const wrongHtml = wrong.length ? wrong.map(t => {
      const cl = g.cleanup[t.key] || '';
      return `<div class="clean-row">
        <div class="cl-label">${isPrint ? '' : t.page + '쪽 '}<b>${esc(t.label)}</b>번</div>
        <div class="cl-btns">
          <button class="clb fix ${cl === 'fixed' ? 'on' : ''}" data-act="cleanup" data-key="${t.key}" data-k="fixed">⚔️ 해결!</button>
          <button class="clb star ${cl === 'star' ? 'on' : ''} ${starCnt >= 7 && cl !== 'star' ? 'is-full' : ''}" data-act="cleanup" data-key="${t.key}" data-k="star">⭐ 질문</button>
        </div>
      </div>`;
    }).join('') : `<div class="empty-note">🎉 틀린 문제가 없어요!</div>`;

    const photoArea = (sub && existingPhoto && up.ok)
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

    const verifyHtml = !isPrint && verify
      ? `<div class="verify big">
          <div class="v-em">🎲</div>
          <div class="grow"><div class="v-k">오늘 찍을 쪽</div>
            <div class="v-t"><b>${verify.page}쪽</b></div>
            <div class="v-s">${esc(verify.book)}</div></div>
        </div>`
      : isPrint
        ? `<div class="verify big"><div class="v-em">📝</div><div class="grow"><div class="v-k">오늘 찍을 것</div><div class="v-t">프린트 <b>1장</b></div></div></div>`
        : '';

    return `<div class="screen flow">
      ${topbar({ title: '② 정리 · 사진', sub: isPrint ? '오답프린트' : '틀린 문제 정리', back: true, backAct: 'flowBack' })}
      ${stepper(2)}

      <div class="sect-t"><span>❌ 틀린 문제 ${wrong.length}</span><span class="grow"></span><span class="hint">⭐ 질문 ${starCnt}/7</span></div>
      <div class="card clean-card">${wrongHtml}</div>

      <div class="sect-t"><span>⏭️ 안 누른 문제 ${rest.length}</span></div>
      <div class="card tight carry-card">
        ${rest.length
          ? `<div class="carry-list">${rest.map(t => `<span class="cchip">${isPrint ? '' : t.page + '쪽 '}${esc(t.label)}번</span>`).join('')}</div>`
          : `<div class="muted">모든 문제를 골랐어요 🎉</div>`}
      </div>

      <div class="sect-t"><span>📸 사진</span><span class="grow"></span><span class="hint">${locked ? '제출 완료' : up.ok ? up.mins + '분 안에 교체' : '1장'}</span></div>
      <div class="card tight photo-card">
        ${verifyHtml}
        ${photoArea}
      </div>

      <div class="flowfoot">
        <button class="btn btn-primary btn-block btn-lg" data-act="submit">${locked || (sub && up.ok && !view.pending.photo) ? '✅ 고친 내용 저장' : view.pending.photo && sub ? '📸 새 사진으로 다시 내기' : '📸 사진 올리고 제출'}</button>
      </div>
      <input type="file" class="photo-input" data-target="clean" accept="image/*" capture="environment" aria-hidden="true">
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
      </div>
      ${carriedNow ? `<div class="card tight">
        <div class="row"><span class="grow muted" style="font-size:12.5px">⚔️ 밀린문제 <b>${carriedNow}개</b></span>
        <button class="btn btn-mint btn-sm" data-act="homeTab" data-t="carry">고치기 →</button></div>
      </div>` : ''}
      <div class="cta-wrap">
        <button class="btn btn-primary btn-block btn-lg" data-act="goHome">🏠 숙제로 돌아가기</button>
        <div class="quickrow">
          <button class="btn btn-ghost btn-sm" data-act="gallery">👀 친구들 풀이</button>
          <button class="btn btn-ghost btn-sm" data-act="openShop">🛍️ 상점</button>
          ${up.ok ? `<button class="btn btn-ghost btn-sm" data-act="reupload">📸 사진 다시 (${up.mins}분)</button>` : ''}
        </div>
      </div>
      <input type="file" class="photo-input" data-target="clean" accept="image/*" capture="environment" aria-hidden="true">
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
      return `<div class="card tight"><div class="card-hd"><span class="t">📊 ${title}</span></div><div class="muted">아직 오답이 없어요</div></div>`;
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

      <div class="sect-t" id="companionDex"><span>🐾 펫 도감</span><span class="grow"></span><span class="hint">${pets.length}/${cat.length}</span></div>
      <div class="card">
        ${egg ? `<button class="eggline" data-act="openShop"><span class="em eggwig">🥚</span><span class="grow">펫 알 ${egg.pct}%</span><span class="go">간식 →</span></button>` : ''}
        <div class="petgrid">
          ${cat.map(p => {
            const mine = owned.has(p.id);
            const r = (GAME().rarity || {})[p.rarity] || {};
            const my = pets.find(x => x.id === p.id);
            return `<button class="petcard ${mine ? 'got' : 'locked'} r-${p.rarity}" data-act="petDetail" data-id="${p.id}">
              <span class="rar">${r.label || ''}</span>
              <span class="pem">${mine ? p.em : '❔'}</span>
              <span class="pnm">${mine ? esc(p.name) : '???'}</span>
              <span class="ptag">${mine ? '⭐'.repeat(Math.min(3, (my && my.lv) || 1)) : ''}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="hint" style="margin-top:10px">펫 ${pets.length}마리 · 보스 공격력 +${power}%</div>
      </div>

      <div class="sect-t"><span>❌ 못 고친 오답 ${eggs.length}</span><span class="grow"></span><span class="hint">고치면 펫 알 부화!</span></div>
      <div class="card tight">
        ${eggs.length ? eggs.slice(0, 6).map(m => `
          <div class="eggrow">
            <span class="er-em">🥚</span>
            <span class="grow" style="min-width:0"><b>${esc(m.label || (m.page + '쪽 ' + m.num + '번'))}</b>
              <small>${esc(m.unitName || '')}${m.reason === 'star' ? ' · ⭐질문' : m.reason === 'skip' ? ' · ⏭️안 풀었음' : ''}</small></span>
            ${m.today
              ? `<button class="btn btn-mint btn-sm" data-act="fixNow">⚔️ 고치기</button>`
              : `<button class="btn btn-mint btn-sm" data-act="resolveCarry" data-id="${m.id}">⚔️ 해결!</button>`}
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
        <div class="hpbar" style="background:#F1ECE6"><div class="fill" style="width:${boss.hp}%"></div></div>
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
      { id: 'top5', em: '⭐', label: '질문' },
      { id: 'report', em: '📊', label: '성취도' },
      { id: 'admin', em: '⚙️', label: '관리' }
    ];
    if (!tabs.find(t => t.id === view.teacherTab)) view.teacherTab = 'today';
    let body = '';
    if (view.teacherTab === 'top5') body = teacherTop5(c);
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
      ${body}
      ${sheetHtml()}
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
    return `<div class="tbtns">${out.join('')}</div>`;
  }

  function teacherToday(c) {
    const cid = c.id;
    const rows = store.classDay(cid);
    const pending = rows.filter(r => r.sub && r.sub.status === 'submitted').length;
    return `
      <button class="bigstamp" data-act="stampAll">✅ 오늘 제출 확인 & 한꺼번에 도장${pending ? ` <small>${pending}장</small>` : ''}</button>
      <div class="sect-t"><span>학생 ${rows.length}</span><span class="grow"></span><span class="hint">제출 ${rows.filter(r => r.sub).length}</span></div>
      <div class="pad">
        ${rows.map(r => {
          const sub = r.sub;
          const hasPh = sub && store.photo(sub.photoId);
          const cls = sub && sub.stampAt ? 'ok' : sub && sub.status === 'submitted' ? 'warn' : sub && sub.status === 'resubmit' ? 'bad' : sub && sub.status === 'unlocked' ? 'info' : '';
          const label = sub && sub.stampAt ? '도장 ' + esc(sub.stampAt) : sub && sub.status === 'submitted' ? '제출' : sub && sub.status === 'resubmit' ? '재제출' : sub && sub.status === 'unlocked' ? '풀림' : '미제출';
          const status = hasPh
            ? `<button class="pill ${cls} pillbtn" data-act="photoBig" data-sid="${r.student.id}" data-at="${esc(sub.at)}">${label} 📸</button>`
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
              <div class="stright">${status}${r.printSub ? '<span class="pill info">📝</span>' : ''}</div>
              ${sub ? `<button class="more" data-act="stuTools" data-id="${r.student.id}" aria-label="도구">⋯</button>` : ''}
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

    const l = store.lesson(cid);
    return `
      ${tg('lesson', '📖', '오늘 진도 · 숙제', `
        <div class="kv"><span class="k">진도</span><span>${esc(l.lesson)}</span></div>
        <div class="kv"><span class="k">숙제</span><span>${esc(l.homework)}</span></div>
        <button class="btn btn-ghost btn-block btn-sm" style="margin-top:10px" data-act="lessonEdit">쪽수 바꾸기</button>`)}

      ${tg('print', '🖨️', '프린트 설정', `
        ${rows.map(r => {
          const info = store.printInfo(cid, r.student.id);
          return `<div class="pinrow">
            <b>${esc(r.student.nickname || r.student.name)}</b>
            <span class="grow muted">${info ? info.count + '문제' : '없음'}</span>
            <button class="btn btn-ghost btn-sm" data-act="openPrintSet" data-id="${r.student.id}">${info ? '바꾸기' : '넣기'}</button>
          </div>`;
        }).join('')}`, `${rows.filter(r => store.hasPrint(cid, r.student.id)).length}명`)}

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
        <div class="hint" style="margin-top:10px">테스트 모드 — 이 브라우저에만 쌓여요 · 11/25 시트 연동</div>`) : ''}

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
            <span class="muted" style="font-size:11px;text-align:right">${stars.length ? '⭐ ' + stars.join('<br>⭐ ') : '<span style="color:#B3A79A">없음</span>'}</span>
          </div>`;
        }).join('')}
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
        ${pages.map(p => `<button class="pm-row" data-act="pmPage" data-p="${p.page}">
          <div class="pg">${p.page}쪽<br><span style="font-size:9.5px;color:#B3A79A">${esc(p.type)}</span></div>
          <div class="ns">${p.problems.map(n => `<span class="n">${esc(n)}</span>`).join('')}</div>
        </button>`).join('')}
      </div>
      <div class="kv" style="margin-top:10px"><span class="k">지금 숙제</span><span>${esc(l.homework)}</span></div>
      <button class="btn btn-primary btn-block" style="margin-top:10px" data-act="lessonEdit">쪽수 바꾸기</button>`;
  }

  function teacherStudents(c) {
    return `
      <div class="card">
        ${c.students.map(s => `<div class="pinrow">
          ${avatarHtml(s, 32)}
          <span class="grow" style="min-width:0"><b>${esc(s.name)}</b> <small class="muted">${esc(s.nickname || '')}</small></span>
          <span class="pinval" data-pin="${s.id}">${view.pinReveal === s.id ? esc(s.pin) : '••••'}</span>
          <button class="btn btn-ghost btn-sm" data-act="revealPin" data-id="${s.id}">${view.pinReveal === s.id ? '숨기기' : '보기'}</button>
          <button class="btn btn-ghost btn-sm" data-act="regenPin" data-id="${s.id}">재발급</button>
        </div>`).join('')}
      </div>
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
      settings: sheetSettings, bigphoto: sheetBigPhoto
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
        <button class="btn btn-mint btn-sm" data-act="resolveCarry" data-id="${m.id}">고쳤어요 ⚔️</button></div>`).join('')}
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
          <div class="muted">⭐${mine.lv || 1} · ${esc(mine.at || '')}</div>` : ''}
      </div>
      ${mine ? `<div class="card tight" style="margin:12px 0 0">
        <div class="kv"><span class="k">공격력</span><span>+${store.companionPct(cid, sid)}% (전체)</span></div>
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
        : `<button class="btn btn-mint btn-block" style="margin-top:12px" data-act="resolveCarry" data-id="${m.id}">⚔️ 해결!</button>`}
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
          <span class="rc-unit-v">오답 <b>${u.wrong}</b>${u.fixed ? ` · 재풀이 <b>${u.fixed}</b>` : ''}</span>
        </div>`).join('')
      : '<div class="rc-empty">이 기간에 오답 기록이 없습니다.</div>';
    const dayList = (r.dayList || []).map(d => `<div class="rc-day">
        <div class="rc-day-d">${esc(d.label)}</div>
        <div class="rc-day-b">
          ${d.lesson ? `<div class="rc-day-l"><b>진도</b><span>${esc(d.lesson)}</span></div>` : ''}
          ${d.homework ? `<div class="rc-day-l"><b>숙제</b><span>${esc(d.homework)}</span></div>` : ''}
        </div>
      </div>`).join('');
    const printList = (r.printList || []).map(p =>
      `<div class="rc-extra">추가 과제 · 개별 오답프린트 <b>${p.count}문항</b> 배부 <small>${esc(p.label)}</small></div>`).join('');
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
      ${(dayList || printList) ? `<div class="rc-sec">
        <div class="rc-t">${r.range === 'week' ? '이번 주' : '최근'} 진도 · 숙제</div>
        ${dayList}
        ${printList}
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

      /* 머리 */
      txt('학습 성취도 리포트', PAD, y, 13, 700, NAVY);
      txt(`${dotted(r.from)} – ${shortDot(r.to)}`, W - PAD, y, 9, 500, MUTED, 'right');
      y += 12; hair(y);
      y += 26;
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

      /* 이번 주 진도·숙제 */
      if ((r.dayList && r.dayList.length) || (r.printList && r.printList.length)) {
        section(r.range === 'week' ? '이번 주 진도 · 숙제' : '최근 진도 · 숙제');
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

      /* 취약 단원 */
      section('취약 단원');
      if (r.units.length) {
        r.units.forEach(u => {
          txt(u.name, PAD, y, 9.5, 600, INK);
          txt(`오답 ${u.wrong}${u.fixed ? ` · 재풀이 ${u.fixed}` : ''}`, W - PAD, y, 8.5, 600, MUTED, 'right');
          y += 18;
        });
        y -= 4;
      } else {
        txt('이 기간에 오답 기록이 없습니다.', PAD, y, 8.5, 500, MUTED);
        y += 14;
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
    const l = store.lesson(cid);
    const books = store.bookList();
    const book = view.lessonEditBook || (store.books(cid)[0] || {}).book || books[0];
    const pages = view.lessonEditPages != null ? view.lessonEditPages : (store.books(cid).find(b => b.book === book) || { pages: [] }).pages.join(',');
    const list = String(pages).split(/[,\s~]+/).filter(Boolean).map(Number).filter(n => !isNaN(n));
    const tiles = store.tilesOf(book, list);
    return sheetWrap('이번 숙제 쪽수 바꾸기', `
      <div class="sub">시트 <b>숙제</b> 칸에 적는 것과 같은 방식이에요. 쪽수만 적으면 문제 버튼이 자동으로 만들어집니다.</div>
      <div class="tabs-scroll" style="padding:0 0 10px">
        ${books.map(b => `<button class="${b === book ? 'on' : ''}" data-act="lessonBook" data-b="${esc(b)}">${esc(b)}</button>`).join('')}
      </div>
      <div class="editor"><input id="pageInput" value="${esc(String(pages))}" placeholder="예: 8,9,10 또는 8~10"></div>
      <div class="muted" style="margin-top:8px">→ ${tiles.length}개: ${tiles.map(t => t.label).join(', ')}</div>
      <div class="preview-tiles">${tiles.map(t => `<div class="pt">${esc(t.label)}</div>`).join('')}</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="saveLesson">이 쪽수로 저장</button>
    `);
  }

  function sheetPmPage(c) {
    return sheetWrap(`${esc(view.pmBook)} ${view.pmPage}쪽 문제번호`, `
      <div class="sub">이 쪽에 있는 문제 번호를 쉼표로 적어요. 예: <b>1, 2, 2-1, 3, 4</b> (2-1은 2번의 (1) 같은 하위 문제)</div>
      <div class="editor"><input id="pmInput" value="${esc(view.pmInput)}" placeholder="1, 2, 2-1, 3"></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="pmSave">저장</button>
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

      <input type="file" class="photo-input" data-target="yesterday" accept="image/*" capture="environment" aria-hidden="true">
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
    if (!ph) return sheetWrap('📸 ' + who + ' 풀이', '<div class="empty">사진이 없어요</div>');
    const v = (sub && sub.verify) || null;
    const meta = [v ? '🎲 ' + esc(v.book || '') + ' ' + esc(v.page || '') + '쪽' : '', view.bigPhotoAt ? esc(view.bigPhotoAt) + ' 제출' : ''].filter(Boolean).join(' · ');
    return sheetWrap('📸 ' + who + ' 풀이', `
      <div class="fullphoto">
        ${meta ? `<div class="fp-meta">${meta}</div>` : ''}
        <img class="fp-img" src="${ph.data}" alt="${who} 풀이 사진">
        ${sub && sub.stampAt ? `<div class="fp-nm">✅ 도장 ${esc(sub.stampAt)}</div>` : ''}
      </div>
    `, { full: true });
  }

  /* =========================================================
     렌더 진입
  ========================================================= */
  function render() {
    const app = document.getElementById('app');
    const prev = app.querySelector('.screen');
    const y = prev ? prev.scrollTop : 0;
    let html = '';
    if (view.role === 'login') html = renderLogin();
    else if (view.role === 'teacher') html = renderTeacher();
    else if (view.flow === 'grade') html = flowGrade();
    else if (view.flow === 'clean') html = flowClean();
    else if (view.flow === 'done') html = flowDone();
    else html = view.tab === 'rank' ? renderRank() : view.tab === 'record' ? renderRecord() : renderStudentHome();
    app.innerHTML = html;
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
    if (document.body.classList.contains('sheet-open')) document.body.classList.remove('sheet-open');
    if (view.sheet) document.body.classList.add('sheet-open');

    const inputs = app.querySelectorAll('input[id]');
    inputs.forEach(inp => {
      inp.addEventListener('input', () => {
        if (inp.id === 'nickInput') view.pending.nickname = inp.value;
        if (inp.id === 'pmInput') view.pmInput = inp.value;
        if (inp.id === 'pageInput') view.lessonEditPages = inp.value;
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
    if (view.pinTarget === 'teacher') {
      if (view.pin === store.state.teacherPin) {
        view.role = 'teacher'; view.teacherTab = 'today'; view.sheet = null; view.flow = null;
        view.classId = view.classId || 'c4m2';
        store.setSession({ role: 'teacher', classId: view.classId });
        EMA.ui.sound('levelup');
        EMA.ui.toast('선생님 모드로 들어왔어요');
        render();
        return;
      }
      EMA.ui.toast('선생님 PIN이 달라요');
      EMA.ui.sound('wrong');
    } else {
      const s = store.student(view.classId, view.studentId);
      if (s && s.pin === view.pin) { afterLoginStudent(view.classId, view.studentId); return; }
      EMA.ui.toast('PIN이 달라요. 선생님께 물어보세요!');
      EMA.ui.sound('wrong');
    }
    view.pin = '';
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

  /* =========================================================
     동작
  ========================================================= */
  const actions = {
    class(d) {
      const c = store.getClass(d.id);
      if (!c || !c.active) return;
      view.classId = d.id; view.step = 'student'; view.resetScroll = true;
      EMA.ui.sound('tap'); render();
    },
    back() {
      if (view.role === 'login') {
        if (view.step === 'pin') view.step = view.pinTarget === 'teacher' ? 'class' : 'student';
        else if (view.step === 'student') view.step = 'class';
        else if (view.step === 'teacherPin') view.step = 'class';
        view.pin = ''; view.pinTarget = 'student';
      }
      view.resetScroll = true; render();
    },
    pickStudent(d) {
      view.studentId = d.id; view.step = 'pin'; view.pin = ''; view.pinTarget = 'student';
      view.resetScroll = true; EMA.ui.sound('tap'); render();
    },
    pinKey(d) {
      if (view.pin.length >= 4) return;
      view.pin += d.k;
      EMA.ui.sound('tap');
      if (view.pin.length === 4) { render(); setTimeout(currentPinVerify, 120); return; }
      render();
    },
    pinDel() { view.pin = view.pin.slice(0, -1); render(); },
    pinBack() { view.pin = ''; render(); },
    teacherEntry() {
      view.pinTarget = 'teacher'; view.step = 'teacherPin'; view.pin = '';
      if (view.role !== 'login') view.role = 'login';
      view.sheet = null;
      view.resetScroll = true; render();
    },
    teacherExit() {
      view.role = 'login'; view.step = 'class'; view.pin = ''; view.pinTarget = 'student';
      store.setSession(null); view.resetScroll = true; render();
    },
    tab(d) { view.tab = d.tab; view.sheet = null; view.flow = null; saveDraft(); view.resetScroll = true; EMA.ui.sound('tap'); render(); },
    homeTab(d) { view.homeTab = d.t; view.sheet = null; saveDraft(); view.resetScroll = true; EMA.ui.sound('tap'); render(); },
    teacherTab(d) { view.teacherTab = d.t; view.sheet = null; view.resetScroll = true; EMA.ui.sound('tap'); render(); },

    /* ---- 채점 동선 ---- */
    startGrade() {
      view.sheet = null;
      view.gradeSource = 'homework';
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
      view.resetScroll = true; setFlow('grade');
    },
    /** 도감의 오늘 알 → 바로 ② 정리 화면으로 (⚔️ 해결하러) */
    fixNow() {
      view.sheet = null;
      view.gradeSource = 'homework';
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
      store.markAllCorrect(view.classId, view.studentId, kind, view.gradeSource === 'print' ? null : view.gradeBook);
      EMA.ui.haptic(); EMA.ui.sound('correct');
      EMA.ui.toast('모두 ⭕로 표시했어요! 틀린 문제만 ❌를 눌러 주세요');
      render();
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
      // ⭐ 질문은 숙제 1건당 7개까지
      if (d.k === 'star' && before !== 'star' && store.starCount(view.classId, view.studentId, kind) >= 7) {
        EMA.ui.toast('질문은 7개까지! 나머지 ❌ 틀림 문제는 수업 전후에 선생님께 직접 물어봐 😊', 3400);
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
            EMA.ui.fx.celebrate({ kind: 'hatch', em: join.pet.em, title: join.pet.name + ' 나왔어요!', sub: '펫 알 부화! · 내 도감에 담았어요', ms: 2000 });
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
    async submit() {
      const cid = view.classId, sid = view.studentId;
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      const sub = store.submission(cid, sid, null, kind);
      const existingPhoto = sub ? store.photo(sub.photoId) : null;
      const up = store.reuploadInfo(cid, sid, kind);
      const locked = !!(sub && existingPhoto && !up.ok);

      if (sub && existingPhoto && up.ok && view.pending.photo) {
        // 1시간 안 사진 교체 — 보상은 그대로
        const r = store.reuploadPhoto(cid, sid, view.pending.photo, kind);
        if (r.error) { EMA.ui.toast(r.error); EMA.ui.sound('wrong'); return; }
        view.lastResult = { coins: 0, xp: 0, reupload: true };
        view.pending.photo = null;
        saveDraft();
      } else if (!locked) {
        if (!view.pending.photo && !existingPhoto) { EMA.ui.toast('사진을 먼저 올려 주세요 📷'); return; }
        const r = view.pending.photo
          ? store.submitPhoto(cid, sid, view.pending.photo, kind)
          : (store.touchSubmission(cid, sid, kind), store.previewReward(cid, sid, kind));
        view.lastResult = r;
        const items = [];
        if (r && r.titles && r.titles.length) {
          r.titles.forEach(t => items.push({ kind: 'title', em: t.em || '🏅', title: t.name + ' 획득!', sub: '새 칭호가 열렸어요', sfx: 'fanfare' }));
        }
        if (r && r.killed) items.push({ kind: 'boss', em: '🏆', title: '보스 처치!', sub: '반 전원 보너스 코인 30개 · 한정판 칭호', sfx: 'bossdown', ms: 2400 });
        if (r && r.sub && r.sub.shield) items.push({ kind: 'shield', em: '🛡️', title: '보스 방어막 발동!', sub: '수업 당일에 몰아서 내서 보스·코인 50%만 들어갔어요', sfx: 'shield' });
        else if (r && r.sub && r.sub.early) items.push({ kind: 'early', em: '⚡', title: '얼리버드 크리티컬 2배!', sub: '일찍 내서 코인 2배 + XP 20 보너스!', sfx: 'fanfare' });
        if (r && r.carried) items.push({ kind: 'title', em: '🥚', title: '안 푼 ' + r.carried + '문제 → 밀린문제', sub: '제출하면 바로 ⚔️ 밀린문제로 넘어가요 · 감점 없어요', sfx: 'tap', ms: 1800 });
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
      if (!(view.lastResult && view.lastResult.titles && view.lastResult.titles.length)) EMA.ui.fx.confetti(70);
      EMA.ui.sound('fanfare');
      if (view.lastResult && view.lastResult.reupload) EMA.ui.toast('사진을 새로 올렸어요! 남은 시간 동안 한 번 더 바꿀 수 있어요');
    },
    gallery() { view.sheet = 'gallery'; EMA.ui.sound('tap'); render(); },
    closeSheet() {
      if (view.sheet === 'reportimg') { view.reportImg = null; view.sheet = 'report'; render(); return; }
      view.sheet = view.sheet === 'bigphoto' && view.bigPhotoFrom === 'gallery' ? 'gallery' : null;
      view.bigPhotoFrom = ''; view.printSid = null; view.printInput = ''; view.reportImg = null; render();
    },
    carry() { view.homeTab = 'carry'; view.sheet = null; render(); },

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
        const items = [{ kind: 'hatch', em: p.em, title: `${p.name} 부화!`, sub: (GAME().rarity[p.rarity] || {}).label + ' 등급 · 도감에 등록됐어요', sfx: p.rarity === 'legend' ? 'legendary' : 'hatch', ms: 2300 }];
        (r.hatch.titles || []).forEach(t => items.push({ kind: 'title', em: t.em || '🏅', title: t.name + ' 획득!', sub: '새 칭호가 열렸어요', sfx: 'fanfare' }));
        celebrateQueue(items);
        EMA.ui.fx.confetti(p.rarity === 'legend' ? 110 : 60);
      }
      if (r.killed && r.killed.boss) {
        setTimeout(() => { EMA.ui.fx.celebrate({ kind: 'boss', em: '🏆', title: '보스 처치!', sub: '반 전원 보너스 코인 30개', ms: 2400 }); EMA.ui.sound('bossdown'); }, 900);
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
        celebrateQueue([{ kind: 'hatch', em: p.em, title: `${p.name} 부화!`, sub: (GAME().rarity[p.rarity] || {}).label + ' 등급 · 도감에 등록됐어요', sfx: p.rarity === 'legend' ? 'legendary' : 'hatch', ms: 2300 }]);
        EMA.ui.fx.confetti(p.rarity === 'legend' ? 110 : 60);
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
    submitYesterday() {
      const cid = view.classId, sid = view.studentId;
      if (!view.pending.yphoto) { EMA.ui.toast('어제 푼 사진을 먼저 올려 주세요 📷'); return; }
      store.submitYesterday(cid, sid, view.pending.yphoto, MIN);
      view.pending.yphoto = null; view.sheet = null;
      EMA.ui.sound('fanfare');
      view.resetScroll = true;
      render();
      EMA.ui.fx.celebrate({ kind: 'early', em: '🔥', title: '어제 불꽃 살렸어요!', sub: '⏰ 어제분으로 올렸어요 · 코인 +5', ms: 2100 });
      EMA.ui.toast('어제 불꽃을 살렸어요! 🔥');
    },

    /* ---- 밀린문제 해결 ---- */
    resolveCarry(d) {
      const r = store.resolveCarried(view.classId, view.studentId, d.id);
      if (!r) return;
      EMA.ui.sound('crit');
      render();
      EMA.ui.fx.celebrate({ kind: 'title', em: '⚔️', title: '해결!', sub: `+5코인 · +10 XP · 🥚→🐾 펫 알 부화!`, ms: 1600 });
      EMA.ui.toast('밀린문제 하나 해결! ⚔️');
      if (r.killed && r.killed.boss) setTimeout(() => { EMA.ui.fx.celebrate({ kind: 'boss', em: '🏆', title: '보스 처치!', sub: '반 전원 보너스 코인 30개', ms: 2200 }); EMA.ui.sound('bossdown'); }, 1800);
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
      if (!confirm('시제품 데이터를 처음 상태로 되돌릴까요? (연습 기록이 지워져요)')) return;
      if (store.reset) await store.reset();
      clearDraft();
      view.role = 'login'; view.step = 'class'; view.sheet = null; view.flow = null; view.resetScroll = true;
      render();
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
    regenPin(d) {
      const pin = store.regenPin(view.classId, d.id);
      view.pinReveal = d.id;
      EMA.ui.toast('새 PIN: ' + pin);
      render();
    },
    rankMode(d) { view.rankMode = d.m; render(); },
    rankScope(d) { view.rankScope = d.s; render(); },
    pmBook(d) { view.pmBook = d.b; render(); },
    pmPage(d) {
      const l = store.lesson(view.classId) || {};
      const book = view.pmBook || l.book || store.bookList()[0];
      view.pmBook = book;
      const p = store.pagesOfBook(book).find(x => x.page === parseInt(d.p, 10));
      view.pmPage = parseInt(d.p, 10);
      view.pmInput = p ? p.problems.join(', ') : '';
      view.sheet = 'pmpage'; render();
    },
    pmSave() {
      const v = (document.querySelector('#pmInput') || {}).value || '';
      const list = v.split(',').map(x => x.trim()).filter(Boolean);
      if (!list.length) { EMA.ui.toast('문제 번호를 적어 주세요'); return; }
      const book = view.pmBook || (store.lesson(view.classId) || {}).book || store.bookList()[0];
      store.setPageProblem(book, view.pmPage, list);
      view.sheet = null; EMA.ui.toast(view.pmPage + '쪽 문제번호를 저장했어요');
      render();
    },
    lessonEdit() {
      const l = store.lesson(view.classId);
      const b0 = store.books(view.classId)[0] || {};
      view.lessonEditBook = b0.book || (l && l.book);
      view.lessonEditPages = (b0.pages || []).join(',');
      view.sheet = 'lessonEdit'; render();
    },
    lessonBook(d) { view.lessonEditBook = d.b; view.lessonEditPages = null; render(); },
    saveLesson() {
      const l = store.lesson(view.classId);
      const raw = view.lessonEditPages || '';
      let pages = [];
      String(raw).split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
        const m = part.match(/^(\d+)\s*[~-]\s*(\d+)$/);
        if (m) { const a = +m[1], b = +m[2]; for (let i = Math.min(a, b); i <= Math.max(a, b); i++) pages.push(i); }
        else if (/^\d+$/.test(part)) pages.push(+part);
      });
      if (!pages.length) { EMA.ui.toast('쪽수를 숫자로 적어 주세요 (예: 8~10)'); return; }
      const book = view.lessonEditBook || (store.books(view.classId)[0] || {}).book;
      const tiles = store.tilesOf(book, pages);
      const books = store.books(view.classId).map(b => b.book === book ? { book, pages } : b);
      if (!books.find(b => b.book === book)) books.push({ book, pages });
      store.saveLesson(view.classId, {
        books,
        homework: books.map(b => b.book + ' ' + (b.pages.length > 1 ? b.pages[0] + '~' + b.pages[b.pages.length - 1] : b.pages[0]) + '쪽').join(', ')
      });
      view.sheet = null;
      EMA.ui.toast(`${book} ${pages.join(',')}쪽 → 문제 ${tiles.length}개로 바꿨어요`);
      render();
    }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
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
      window.EMA_CONFIG = Object.assign({ mode: 'local', apiUrl: '' }, window.EMA_CONFIG || {});
      if (qs.get('mode')) window.EMA_CONFIG.mode = qs.get('mode');
      if (qs.get('api')) window.EMA_CONFIG.apiUrl = qs.get('api');
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
    // 예시 제출 사진 만들기 (한 번만)
    const cid = 'c4m2';
    const lesson = store.lesson(cid) || {};
    store.classDay(cid).forEach(r => {
      if (r.sub && r.sub.photoId && !store.photo(r.sub.photoId)) {
        store.putPhoto(r.sub.photoId, EMA.ui.fakePhoto(r.student.name, (r.sub.verify && r.sub.verify.book) || lesson.book || '6-1 발전책'), r.student.id);
      }
    });

    const s = store.session();
    if (s && s.role === 'student' && store.student(s.classId, s.studentId)) {
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
    } else if (s && s.role === 'teacher') {
      view.role = 'teacher'; view.classId = s.classId || 'c4m2'; view.teacherTab = 'today';
    } else {
      view.role = 'login';
    }
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
