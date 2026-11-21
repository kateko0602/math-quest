/* 숙제 대소동 v0.3 — 화면과 동선
   ─────────────────────────────────────────────────────────────
   아이 동선: 홈 → ① 채점(⭕/❌) → ② 정리·사진(⚔️/⭐) → ③ 제출 완료
   · 홈 상단 탭: 📘 오늘 숙제 | 📝 오답프린트 | ⚔️ 밀린문제 (필요할 때만 보임)
   · 상점·수학 펫 도감·보스전·효과음·축하 애니메이션
   · 선생님(PIN 2580): 일괄 도장 · 질문 TOP5 크게 보기 · 성취도 리포트 · 사진 인증 확인
*/
window.EMA = window.EMA || {};
(function () {
  const esc = EMA.ui.esc;
  const GAME = () => window.EMA_GAME || { pets: [], shop: [], bosses: [], titles: [], rarity: {}, dailyTitles: [], monsters: [] };
  const MIN = 3;
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
    pending: { photo: null, avatar: null, nickname: '', yphoto: null },
    pmBook: null, pmPage: null, pmInput: '',
    lessonEditBook: null, lessonEditPages: null,
    pinReveal: null,
    reportSid: null, reportRange: 'week',
    petDetail: null, monsterDetail: null, printSid: null, printInput: '',
    lastResult: null,
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
      <div class="body ${opt && opt.wide ? 'wide' : ''}">
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
        <span class="grow"><b>수학 펫 알이 없어요</b><small>상점에서 랜덤 알을 뽑아 보세요 · 60코인</small></span>
        <span class="go">상점 →</span></button>`;
    }
    return `<button class="eggstrip" data-act="openShop">
      <span class="em eggwig">🥚</span>
      <span class="grow"><b>알 부화 ${egg.pct}%</b>
        <span class="lvlbar"><i style="width:${egg.pct}%"></i></span>
        <small>간식 주면 부화가 빨라져요 · 지금 펫 ${pets.length}마리</small></span>
      <span class="go">상점 →</span></button>`;
  }

  /* =========================================================
     로그인
  ========================================================= */
  function renderLogin() {
    if (view.step === 'class') {
      const classes = store.classes();
      return `<div class="screen no-nav login">
        <div class="logo">🎮</div>
        <h1>숙제 대소동</h1>
        <div class="tagline">맞으면 ⭕, 틀리면 ❌<br>오늘 숙제 1쪽만 찍으면 끝!</div>
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
        <button class="btn btn-ghost btn-block" data-act="teacherEntry">👩‍🏫 선생님이세요? 선생님 모드</button>
        <div class="pin-hint">체험용 · 학생 PIN <b>1234</b> · 선생님 PIN <b>2580</b></div>
        <div class="verline">v0.3 시제품 · 상점·수학 펫·보스전·효과음</div>
      </div>`;
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
        <div class="pin-hint">이름은 시트 명단 그대로라 오타·동명이인 걱정이 없어요.</div>
      </div>`;
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
    </div>`;
  }

  /* =========================================================
     학생 — 홈
  ========================================================= */
  function homeTabs(cid, sid) {
    const tabs = [{ id: 'today', label: '📘 오늘 숙제' }];
    if (store.hasPrint(cid, sid)) tabs.push({ id: 'print', label: '📝 오답프린트' });
    const n = store.carried(cid, sid).length;
    if (n) tabs.push({ id: 'carry', label: `⚔️ 밀린문제 (${n})` });
    if (!tabs.find(t => t.id === view.homeTab)) view.homeTab = 'today';
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
        title: '오늘 숙제',
        sub: `${c.name} · ${EMA.ui.kdate(store.state.today)} ${EMA.ui.kdow(store.state.today)}`,
        right: `${sfxBtn()}${avatarHtml(me, 34)}`
      })}
      <div class="hello">
        <div class="who">${esc(me.nickname || me.name)} <span class="lv">Lv.${lv.lv}</span></div>
        <div class="chips">
          ${coinChip(cid, sid)}
          <span class="chip streak">🔥 ${streak}일</span>
          <span class="chip xp">✨ ${st.xp} XP</span>
        </div>
      </div>
      ${homeTabs(cid, sid)}
      ${body}
      ${nav([
        { id: 'home', em: '🔥', label: '오늘 숙제' },
        { id: 'record', em: '👾', label: '내 기록' },
        { id: 'rank', em: '🏆', label: '랭킹' },
        { id: 'me', em: '⚙️', label: '내 정보' }
      ], view.tab)}
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
        <div class="card-hd"><span class="t">📖 오늘 진도 &amp; 숙제</span><span class="grow"></span>
          <span class="pill info">시트에서 자동</span></div>
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
        <div class="hw-range">
          <span class="pg">전체 ${tiles.length}문제</span>
          <span class="tx">${esc(l.due)}</span>
        </div>
        ${timing.kind === 'early' ? '<div class="timing early">⚡ 얼리버드 기간! 지금 내면 코인 2배</div>'
          : timing.kind === 'shield' ? '<div class="timing shield">🛡️ 수업 당일이에요 · 보스·코인 50%만 들어가요</div>' : ''}
      </div>` : `<div class="card"><div class="empty">📭 오늘 숙제가 아직 올라오지 않았어요.<br><small>선생님이 시트에 적으면 바로 나타나요.</small></div></div>`;

    let cta, ctaSub;
    if (sub && sub.stampAt) {
      cta = '✅ 도장 완료 · 채점 보기'; ctaSub = `선생님 도장 ${esc(sub.stampAt)} · 최종 확정!`;
    } else if (sub) {
      cta = st.marked ? '📸 제출 완료 · 채점 다시 보기' : '📝 숙제 채점 시작하기';
      ctaSub = `제출 ${esc(sub.at)} · 선생님 도장 기다리는 중`;
    } else if (st.marked) {
      cta = `📝 채점 이어서 하기 (⭕${st.c1} ❌${st.c2 + st.c4})`;
      ctaSub = `아직 ${st.c5}문제 안 눌렀어요 · 누른 건 자동 저장됐어요`;
    } else {
      cta = '📝 숙제 채점 시작하기'; ctaSub = '틀린 번호만 ❌ · 맞은 건 ⭕ · 30초면 끝!';
    }

    return `
      ${missingY ? `<button class="yflame" data-act="yesterday">
        <span class="em">🔥</span>
        <span class="grow"><b>어제 불꽃이 비었어요!</b><small>어제 풀었다면 지금 올려서 불꽃을 살릴 수 있어요</small></span>
        <span class="go">어제분 올리기</span></button>` : ''}

      ${lessonHtml}

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
        <div class="hplb"><span>보스 HP ${boss.hp}%</span><span>도장 ${boss.stamped}/${boss.total}</span></div>
        <div class="myhp">🎯 내가 깎은 HP: <b>${mine}%</b> <span>· 오답 처치 ${boss.fixed}개</span></div>
        ${boss.killed ? '<div class="bosskill">🏆 우리 반이 보스를 처치했어요! 보너스 코인은 상점에서 확인!</div>' : ''}
      </div>

      <div class="cta-wrap">
        <button class="btn btn-primary btn-block btn-xl" data-act="startGrade">${cta}</button>
        <div class="cta-sub">${ctaSub}</div>
        <div class="quickrow">
          <button class="btn btn-ghost btn-sm" data-act="openShop">🛍️ 상점</button>
          ${store.hasPrint(cid, sid) ? '<button class="btn btn-ghost btn-sm" data-act="startPrint">📝 오답프린트</button>' : ''}
          ${carried.length ? `<button class="btn btn-ghost btn-sm" data-act="homeTab" data-t="carry">⚔️ 밀린문제 ${carried.length}</button>` : ''}
        </div>
      </div>

      ${eggStrip(cid, sid)}

      ${st.marked ? `<div class="card tight sumcard">
        <div class="sumline">
          <span class="sumc o">⭕ 맞음 ${st.c1}</span>
          <span class="sumc x">❌ 틀림 ${st.c2 + st.c4}</span>
          <span class="sumc f">⚔️ 고침 ${st.c3}</span>
          <span class="sumc q">⭐ 질문 ${st.c4}</span>
          <span class="sumc c">⏭️ 이월 ${st.c5}</span>
        </div>
        ${st.c5 ? `<div class="muted" style="margin-top:8px">안 누른 ${st.c5}문제는 <b>밀린문제</b>로 넘어가요. 감점 없어요.</div>` : ''}
      </div>` : ''}

      ${sub ? `<div class="card tight">
        <div class="card-hd"><span class="t">📸 낸 사진</span><span class="grow"></span>
          ${sub.stampAt ? `<span class="pill ok">✅ 도장 ${esc(sub.stampAt)}</span>` : sub.status === 'resubmit' ? `<span class="pill bad">재제출 요청</span>` : sub.status === 'unlocked' ? `<span class="pill warn">🔓 다시 낼 수 있어요</span>` : `<span class="pill warn">🕒 도장 대기 · ${esc(sub.at)}</span>`}
        </div>
        ${store.photo(sub.photoId) ? `<div class="photo-preview"><img src="${store.photo(sub.photoId).data}" alt="내가 낸 사진"><div class="lock">🔒 내 사진은 나와 선생님만 볼 수 있어요</div></div>` : ''}
        <div class="row" style="margin-top:10px">
          <button class="btn btn-ghost grow" data-act="gallery">👀 친구들 풀이</button>
          ${sub.status === 'resubmit' || sub.status === 'unlocked' ? `<button class="btn btn-primary grow" data-act="startGrade">다시 찍어 제출</button>` : ''}
        </div>
      </div>` : ''}
      ${carried.length ? `<div class="card tight">
        <div class="card-hd"><span class="t">⚔️ 밀린문제 ${carried.length}개</span><span class="grow"></span><span class="pill warn">고칠 때까지</span></div>
        <div class="muted">${carried.slice(0, 3).map(m => '· ' + esc(m.label) + ' (' + esc(m.date.slice(5)) + ')').join('<br>')}${carried.length > 3 ? `<br>· 외 ${carried.length - 3}개` : ''}</div>
        <button class="btn btn-mint btn-block" style="margin-top:10px" data-act="homeTab" data-t="carry">지금 오답 잡으러 가기 ⚔️</button>
      </div>` : ''}`;
  }

  function homePrint(cid, sid) {
    const info = store.printInfo(cid, sid);
    const tiles = store.printTiles(cid, sid);
    const cnt = store.printCounts(cid, sid);
    const sub = store.submission(cid, sid, null, 'print');
    if (!info || !tiles.length) {
      return `<div class="card"><div class="empty">📝 오늘은 개별 오답프린트가 없어요.<br><small>선생님이 프린트를 내 주시면 여기에 딱 나타나요.</small></div></div>`;
    }
    return `
      <div class="card">
        <div class="card-hd"><span class="t">📝 개별 오답프린트</span><span class="grow"></span>
          <span class="pill info">${info.setBy === 'teacher' ? '선생님이 넣어 주심' : '내가 고른 수'}</span></div>
        <div class="printbig"><b>${info.count}</b>문제 <span>· 1번 ~ ${info.count}번</span></div>
        <div class="muted">내 프린트에 있는 문제 수만큼 타일이 만들어져 있어요. <b>사진은 프린트 1장</b>만 찍으면 돼요.</div>
        <div class="oxsum" style="margin-top:10px">
          <div class="pbar"><i style="width:${cnt.total ? Math.round(cnt.marked / cnt.total * 100) : 0}%"></i></div>
          <div class="nums"><span class="s-o">⭕ ${cnt.c1}</span><span class="s-x">❌ ${cnt.c2 + cnt.c4}</span><span class="s-f">⚔️ ${cnt.c3}</span><span class="s-none">아직 ${cnt.c5}</span></div>
        </div>
      </div>
      <div class="cta-wrap">
        <button class="btn btn-primary btn-block btn-lg" data-act="startPrint">
          ${sub ? '📝 오답프린트 다시 보기' : cnt.marked ? '📝 프린트 채점 이어서' : '📝 오답프린트 채점 시작'}
        </button>
        <div class="cta-sub">${sub ? `제출 ${esc(sub.at)} · ${sub.stampAt ? '선생님 도장 완료' : '도장 기다리는 중'}` : '틀린 문제만 ❌ · 프린트 1장 찍기'}</div>
      </div>
      ${sub && store.photo(sub.photoId) ? `<div class="card tight"><div class="photo-preview"><img src="${store.photo(sub.photoId).data}" alt="프린트 사진"><div class="lock">🔒 선생님만 볼 수 있어요</div></div></div>` : ''}`;
  }

  function homeCarry(cid, sid) {
    const list = store.carried(cid, sid);
    const solved = store.solvedCarried(sid);
    const tiles = store.tiles(cid);
    const reasonTxt = { x: '❌ 틀림', star: '⭐ 질문', skip: '⏭️ 미풀이' };
    if (!list.length) {
      return `<div class="card"><div class="empty">🎉 밀린 문제가 없어요!<br><small>틀렸거나 못 푼 문제가 생기면 여기에 모여요.</small></div></div>
        ${solved.length ? `<div class="card tight"><div class="muted">지금까지 밀린문제 <b>${solved.length}개</b>를 스스로 해결했어요. 대단해요! ⚔️</div></div>` : ''}`;
    }
    return `
      <div class="card tight">
        <div class="muted">예전에 <b>틀렸거나 못 푼 문제</b>예요. 다시 풀어서 <b>⚔️ 해결!</b>을 누르면
          보스 데미지 + 몬스터 도감 포획 + 목록에서 사라져요.</div>
      </div>
      ${list.map(m => `
        <div class="carrycard">
          <div class="cc-em">${m.em || '👾'}</div>
          <div class="grow">
            <div class="cc-nm">${esc(m.name || '오답 몬스터')}</div>
            <div class="cc-lb">${esc(m.book === '프린트' ? '' : m.book + ' ')}${m.page}쪽 ${esc(m.num)}번 <span class="dot">·</span> ${esc(m.date.slice(5))} <span class="dot">·</span> ${reasonTxt[m.reason] || '❌'}</div>
          </div>
          <button class="btn btn-mint btn-sm" data-act="resolveCarry" data-id="${m.id}">⚔️ 해결!</button>
        </div>`).join('')}
      ${solved.length ? `<div class="card tight"><div class="muted">해결한 밀린문제 <b>${solved.length}개</b> · 이 몬스터들은 도감에 남아요 👾</div></div>` : ''}`;
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
    tiles.forEach(t => {
      if (t.page !== lastPage) {
        rows += `<div class="pgroup">${isPrint ? '오답프린트' : t.page + '쪽'}${!isPrint && t.type && t.type !== '표없음' ? ' · ' + esc(t.type) : ''}</div>`;
        lastPage = t.page;
      }
      const m = g.marks[t.key] || '';
      rows += `<div class="ox-row ${isPrint ? 'compact' : ''} ${t.missing ? 'is-missing' : ''}">
        <div class="ox-label">${esc(t.label)}<span>번</span></div>
        <button class="ox o ${m === 'o' ? 'on' : ''}" data-act="mark" data-key="${t.key}" data-m="o" ${t.missing ? 'disabled' : ''} aria-label="${esc(t.label)}번 맞음">⭕ 맞음</button>
        <button class="ox x ${m === 'x' ? 'on' : ''}" data-act="mark" data-key="${t.key}" data-m="x" ${t.missing ? 'disabled' : ''} aria-label="${esc(t.label)}번 틀림">❌ 틀림</button>
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

    return `<div class="screen flow">
      ${topbar({
        title: isPrint ? '① 프린트 채점' : '① 채점',
        sub: isPrint ? `${tiles.length}문제` : `${view.gradeBook || '오늘 숙제'} · ${tiles.length}문제`,
        back: true, backAct: 'flowBack',
        right: avatarHtml(me, 32)
      })}
      ${stepper(1)}
      ${bookTabs}
      <div class="hintbar">맞은 문제는 <b>⭕ 맞음</b>, 틀린 문제는 <b>❌ 틀림</b>을 눌러요.<br><b>안 푼 문제는 그냥 두기</b> — 밀린문제로 넘어가요.</div>
      ${oxSum(cnt)}
      <div class="card oxcard">
        <button class="btn btn-mint btn-block" data-act="markAll">⭕ 모두 맞음 (${isPrint ? '이 프린트' : '이 교재'} 전부 풀었을 때)</button>
        <div class="rows ${isPrint ? 'gridrows' : ''}">${rows}</div>
      </div>
      <div class="flowfoot">
        <button class="btn btn-primary btn-block btn-lg" data-act="toClean">다음 → 정리 · 사진</button>
        <div class="foot-note">누른 건 자동으로 저장돼요 · 나가도 그대로예요</div>
      </div>
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
    const locked = !!(sub && existingPhoto && (sub.status === 'submitted' || sub.status === 'stamped'));
    const verify = isPrint ? { book: '오답프린트', page: '프린트' } : (sub && sub.verify) || store.verifyTarget(cid, sid);

    const wrong = tiles.filter(t => g.marks[t.key] === 'x');
    const rest = tiles.filter(t => !g.marks[t.key]);

    const wrongHtml = wrong.length ? wrong.map(t => {
      const cl = g.cleanup[t.key] || '';
      return `<div class="clean-row">
        <div class="cl-label">${isPrint ? '' : t.page + '쪽 '}<b>${esc(t.label)}</b>번</div>
        <div class="cl-btns">
          <button class="clb fix ${cl === 'fixed' ? 'on' : ''}" data-act="cleanup" data-key="${t.key}" data-k="fixed">⚔️ 고쳤어요</button>
          <button class="clb star ${cl === 'star' ? 'on' : ''}" data-act="cleanup" data-key="${t.key}" data-k="star">⭐ 또 틀림·질문</button>
        </div>
        <div class="cl-note">${cl === 'fixed' ? '몬스터 처치! 보스한테 데미지 ⚔️' : cl === 'star' ? '선생님 질문 목록에 올라가요 ⭐' : '안 고르면 ⭐ 또 틀림으로 올라가요'}</div>
      </div>`;
    }).join('') : `<div class="empty-note">🎉 틀린 문제가 하나도 없어요!</div>`;

    const photoArea = locked
      ? `<div class="photo-preview"><img src="${existingPhoto.data}" alt="낸 사진"><div class="lock">🔒 이미 낸 사진이에요 (바꾸려면 선생님께 재제출 요청)</div></div>`
      : (view.pending.photo || existingPhoto)
        ? `<div class="photo-preview"><img src="${view.pending.photo || existingPhoto.data}" alt="제출 사진"><div class="lock">🔒 제출하면 지울 수 없어요</div></div>
           <button class="btn btn-ghost btn-sm" style="margin-top:8px" data-act="photoPick">사진 다시 고르기</button>`
        : `<button class="photo-drop" data-act="photoPick">
            <div class="em">📷</div>
            <div class="t">사진 찍기 / 앨범에서 고르기</div>
            <div class="s">${isPrint ? '오답프린트 1장을 펴 놓고 찍어 주세요.' : '오늘 뽑힌 쪽만 펴 놓고 찍으면 돼요.'}</div>
          </button>`;

    return `<div class="screen flow">
      ${topbar({ title: '② 정리 · 사진', sub: isPrint ? '오답프린트' : '고친 문제와 물어볼 문제를 골라요', back: true, backAct: 'flowBack' })}
      ${stepper(2)}
      <button class="backbig" data-act="flowBack">← 뒤로 (채점 고치기)</button>

      ${!isPrint && verify ? `<div class="verify">
        <div class="v-em">🎲</div>
        <div class="grow"><div class="v-t">오늘은 <b>${verify.page}쪽</b>을 찍어 줘!</div>
          <div class="v-s">${esc(verify.book)} · 이 한 쪽만 찍으면 인증 끝 (사진은 선생님만 봐요)</div></div>
      </div>` : isPrint ? `<div class="verify"><div class="v-em">📝</div><div class="grow"><div class="v-t">프린트 <b>1장</b>을 찍어 줘!</div><div class="v-s">내가 푼 프린트 전체가 보이게 찍어 주세요</div></div></div>` : ''}

      <div class="sect-t"><span>❌ 틀린 문제 ${wrong.length}개</span><span class="grow"></span><span class="hint">둘 중 하나만</span></div>
      <div class="card clean-card">${wrongHtml}</div>

      <div class="sect-t"><span>⏭️ 안 누른 문제 ${rest.length}개</span><span class="grow"></span><span class="hint">${isPrint ? '그냥 넘어가요' : '밀린문제로'}</span></div>
      <div class="card tight carry-card">
        ${rest.length
          ? `${isPrint ? '<div class="muted" style="margin-bottom:8px">프린트는 안 누른 번호가 따로 모이지 않아요. 푼 문제만 눌러 주세요.</div>' : ''}
             <div class="carry-list">${rest.map(t => `<span class="cchip">${isPrint ? '' : t.page + '쪽 '}${esc(t.label)}번</span>`).join('')}</div>
             ${isPrint ? '' : '<div class="muted" style="margin-top:9px">감점 없이 <b>밀린문제</b>로 넘어가요. 푼 문제라면 <b>← 뒤로</b>로 돌아가 누르면 돼요.</div>'}`
          : `<div class="muted">모든 문제를 ⭕/❌로 표시했어요. 완벽해요! 🎉</div>`}
      </div>

      <div class="sect-t"><span>📸 ${isPrint ? '프린트' : '사진'} 인증</span><span class="grow"></span><span class="hint">${locked ? '제출 완료' : '1장 필수'}</span></div>
      <div class="card tight">${photoArea}
        ${locked ? '<div class="muted" style="margin-top:8px">채점만 고쳐서 다시 저장할 수 있어요.</div>' : ''}
      </div>

      <div class="flowfoot">
        <button class="btn btn-primary btn-block btn-lg" data-act="submit">${locked ? '✅ 고친 채점 저장하기' : '📸 사진 올리고 제출 완료'}</button>
        <button class="linkbtn" data-act="flowBack">← 뒤로 (채점 고치기)</button>
      </div>
      <input type="file" class="photo-input" data-target="clean" accept="image/*" capture="environment" class="hidden">
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

    return `<div class="screen flow">
      ${topbar({ title: '③ 제출 완료', sub: sub ? '제출 ' + esc(sub.at) : '', back: true, backAct: 'flowBack' })}
      ${stepper(3)}
      <div class="done-hero">
        <div class="em">🎉</div>
        <div class="t">${isPrint ? '프린트 제출 완료!' : '제출 완료!'}</div>
        <div class="title-chip">오늘의 칭호 · ${esc(todayTitle(cid, sid))}</div>
        <div class="sub">선생님이 사진을 보고 도장을 찍으면 최종 확정돼요.</div>
      </div>
      <div class="card">
        <div class="sumline">
          <span class="sumc o">⭕ 맞음 ${st.c1}</span>
          <span class="sumc x">❌ 틀림 ${st.c2 + st.c4}</span>
          <span class="sumc f">⚔️ 고침 ${st.c3}</span>
          <span class="sumc q">⭐ 질문 ${st.c4}</span>
          <span class="sumc c">⏭️ 이월 ${st.c5}</span>
        </div>
        <div class="divider"></div>
        <div class="kv"><span class="k">🪙 코인</span><span>+${r && r.coins != null ? r.coins : 0} · 지금 <b>${coinsNow}코인</b></span></div>
        <div class="kv"><span class="k">✨ XP</span><span>+${r && r.xp != null ? r.xp : st.xp} XP</span></div>
        <div class="kv"><span class="k">${boss.def.em || '👾'} 보스</span><span>${boss.hp}% 남음 ${boss.left === 0 ? '· 클리어! 🎉' : '· 우리 반 화이팅!'}</span></div>
        ${egg ? `<div class="kv"><span class="k">🥚 펫 알</span><span>${egg.pct}% · 간식으로 키우기</span></div>` : ''}
      </div>
      ${titles.length ? `<div class="card tight"><div class="card-hd"><span class="t">🏅 최근 칭호</span></div>
        <div class="chips">${titles.map(t => `<span class="chip">${t.em || '🏅'} ${esc(t.name)}</span>`).join('')}</div></div>` : ''}
      <div class="cta-wrap">
        <button class="btn btn-primary btn-block btn-lg" data-act="goHome">🏠 홈으로</button>
        <div class="quickrow">
          <button class="btn btn-ghost btn-sm" data-act="gallery">👀 친구들 풀이</button>
          <button class="btn btn-ghost btn-sm" data-act="openShop">🛍️ 상점</button>
        </div>
        <button class="backbig" style="margin-top:12px" data-act="flowBack">← 뒤로 (채점 고치기)</button>
        <div class="foot-note">선생님 도장 전에는 채점을 고쳐도 돼요</div>
      </div>
      ${sheetHtml()}
    </div>`;
  }

  /* =========================================================
     내 기록 / 랭킹 / 내 정보
  ========================================================= */
  function renderRecord() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid), c = store.getClass(cid);
    const st = store.stats(cid, sid), lv = store.level(cid, sid), streak = store.streak(cid, sid);
    const mons = store.monsters(cid, sid);
    const caught = mons.filter(m => m.captured).length;
    const ym = store.state.today.slice(0, 7);
    const cells = store.calendar(cid, sid, ym);
    const joined = cells.filter(x => x.flame).length;
    const exams = store.exam(cid, sid);
    const pets = store.myPets(cid, sid);
    const cat = store.petCatalog();
    const owned = new Set(pets.map(p => p.id));
    const egg = store.eggOf(cid, sid);
    const titles = me.titles || [];

    return `<div class="screen">
      ${topbar({ title: '내 기록', sub: c.name, right: `${coinChip(cid, sid)}${sfxBtn()}` })}
      <div class="card">
        <div class="avatarbox">
          <div class="avatar-big" data-act="editProfile">${esc(me.avatar || '🙂')}</div>
          <div class="grow">
            <div class="nmline">${esc(me.nickname || me.name)} <span class="pill">${esc(me.name)}</span></div>
            <div class="chips" style="margin:5px 0">
              <span class="title-chip">${esc(todayTitle(cid, sid))}</span>
              <span class="chip streak">🔥 ${streak}일</span>
            </div>
            <div class="muted">Lv.${lv.lv} · ${lv.into}/100 XP</div>
            <div class="lvlbar"><i style="width:${lv.into}%"></i></div>
          </div>
        </div>
      </div>
      <div class="pad"><div class="stat-grid">
        <div class="stat"><div class="v">🔥 ${streak}</div><div class="l">연속 불꽃</div></div>
        <div class="stat"><div class="v">👾 ${caught}</div><div class="l">잡은 오답</div></div>
        <div class="stat"><div class="v">🐾 ${pets.length}</div><div class="l">수학 펫</div></div>
      </div></div>

      <div class="sect-t"><span>🐾 수학 펫 도감</span><span class="grow"></span><span class="hint">${pets.length}/${cat.length} 수집</span></div>
      <div class="card">
        ${egg ? `<button class="eggline" data-act="openShop"><span class="em eggwig">🥚</span><span class="grow">부화 ${egg.pct}% · 간식 주러 가기</span><span class="go">상점 →</span></button>` : ''}
        <div class="petgrid">
          ${cat.map(p => {
            const mine = owned.has(p.id);
            const r = (GAME().rarity || {})[p.rarity] || {};
            return `<button class="petcard ${mine ? 'got' : 'locked'} r-${p.rarity}" data-act="petDetail" data-id="${p.id}">
              <span class="rar">${r.label || ''}</span>
              <span class="pem">${mine ? p.em : '❔'}</span>
              <span class="pnm">${mine ? esc(p.name) : '???'}</span>
              <span class="ptag">${mine ? esc(p.tag || '') : '아직 몰라요'}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="muted" style="margin-top:9px">상점에서 알을 뽑고 간식으로 키우면 100%에서 부화해요. 부화한 펫은 여기 도감에 하나씩 쌓여요!</div>
      </div>

      <div class="sect-t"><span>👾 오답 몬스터 도감</span><span class="grow"></span><span class="hint">${caught}마리 포획</span></div>
      <div class="card">
        <div class="muted" style="margin-bottom:9px">틀린 문제를 고치면 몬스터를 잡아요! 몬스터를 누르면 몇 쪽 몇 번 문제였는지 볼 수 있어요.</div>
        <div class="monsters">
          ${mons.slice(-8).reverse().map(m => `<button class="monster ${m.captured ? 'caught' : ''}" data-act="monsterDetail" data-id="${m.id}">
            <div class="em">${m.captured ? m.em : '🥚'}</div><div class="lb">${esc(m.label || (m.page + '쪽 ' + m.num + '번'))}</div>
            <div class="mon-name">${m.captured ? esc(m.name) : '아직 안 잡음'}</div></button>`).join('')}
        </div>
        ${mons.length === 0 ? '<div class="muted">아직 몬스터가 없어요. 틀린 문제가 생기면 여기로 와요.</div>' : ''}
      </div>

      <div class="sect-t"><span>🔥 불꽃 달력</span><span class="grow"></span><span class="hint">${ym.slice(0, 4)}년 ${parseInt(ym.slice(5), 10)}월 · ${joined}일</span></div>
      <div class="card">
        <div class="cal">
          ${['일', '월', '화', '수', '목', '금', '토'].map(d => `<div class="wd">${d}</div>`).join('')}
          ${cells.map(c2 => c2.empty ? '<div class="cell empty"></div>' :
            `<div class="cell ${c2.flame ? 'done' : ''} ${c2.today ? 'today' : ''} ${c2.future ? 'future' : ''}">${c2.day}${c2.flame ? '<span class="fl">🔥</span>' : ''}${c2.late ? '<span class="lt">⏰</span>' : ''}</div>`).join('')}
        </div>
        <div class="muted" style="margin-top:8px">하루 3문제 이상 풀면 불꽃이 켜져요(사진 인증까지). ⏰는 다음 날 올린 ‘어제분’이에요.</div>
      </div>

      ${titles.length ? `<div class="sect-t"><span>🏅 내 칭호</span><span class="grow"></span><span class="hint">${titles.length}개</span></div>
      <div class="card tight"><div class="chips">${titles.map(t => `<span class="chip">${t.em || '🏅'} ${esc(t.name)}</span>`).join('')}</div></div>` : ''}

      ${exams.length ? `<div class="sect-t"><span>📝 단원평가</span><span class="grow"></span><span class="hint">학원에서 본 점수</span></div>
      <div class="card tight">
        ${exams.map(e => {
          const bad = e.score != null && e.retestLine && e.score < e.retestLine;
          const passed = e.retest != null ? e.retest >= e.retestLine : (e.score != null && !bad);
          return `<div class="kv"><span class="k">${esc(e.unit)}<br><small class="muted">${esc(e.date.slice(5))}</small></span>
            <span class="exv">${e.score != null ? e.score + '점' : '—'}
              ${e.retest != null ? ` <span class="arrow">→</span> <b>재시 ${e.retest}점</b>` : ''}
              ${e.retest != null ? '<span class="pill ok">재시 통과</span>' : (e.score != null ? (bad ? '<span class="pill warn">재시 예정</span>' : '<span class="pill ok">통과</span>') : '')}</span></div>`;
        }).join('')}
        <div class="muted" style="margin-top:8px">‘학원에서 본 단원평가 점수’예요. 재시는 학원에서 실제 시험으로 보고 앱에는 결과만 남겨요.</div>
      </div>` : ''}
      ${nav([
        { id: 'home', em: '🔥', label: '오늘 숙제' },
        { id: 'record', em: '👾', label: '내 기록' },
        { id: 'rank', em: '🏆', label: '랭킹' },
        { id: 'me', em: '⚙️', label: '내 정보' }
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
      ${topbar({ title: '랭킹', sub: c.name + ' · ' + EMA.ui.kdate(store.state.today), right: `${coinChip(cid, sid)}${sfxBtn()}` })}
      <div class="segmented">
        <button class="${view.rankMode === 'first' ? 'on' : ''}" data-act="rankMode" data-m="first">🥇 오늘 숙제 1등 완료</button>
        <button class="${view.rankMode === 'king' ? 'on' : ''}" data-act="rankMode" data-m="king">👑 오늘 공부 왕</button>
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
        <div class="muted" style="margin-top:8px">보스 HP ${boss.hp}% · 도장 ${boss.stamped}/${boss.total} · 오답 처치 ${boss.fixed}</div>
        <div class="myhp" style="margin-top:8px">🎯 내가 깎은 HP: <b>${mine}%</b></div>
        <div class="divider"></div>
        <div class="muted">랭킹은 <b>닉네임</b>으로만 보여요. 많이 틀린 개수는 친구들에게 보이지 않아요.</div>
      </div>
      ${nav([
        { id: 'home', em: '🔥', label: '오늘 숙제' },
        { id: 'record', em: '👾', label: '내 기록' },
        { id: 'rank', em: '🏆', label: '랭킹' },
        { id: 'me', em: '⚙️', label: '내 정보' }
      ], view.tab)}
      ${sheetHtml()}
    </div>`;
  }

  function renderMe() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid), c = store.getClass(cid);
    const lv = store.level(cid, sid), streak = store.streak(cid, sid);
    const pets = store.myPets(cid, sid);
    const egg = store.eggOf(cid, sid);
    const skills = [
      { em: '🔥', n: '불꽃 방패', d: '연속 불꽃이 하루 끊겨도 지켜 줌', on: streak >= 5 },
      { em: '⚡', n: '오답 사냥꾼', d: '오답 고칠 때 XP 2배', on: lv.lv >= 3 },
      { em: '⚔️', n: '우리 반 필살기', d: '보스전 데미지 +20%', on: store.boss(cid).left === 0 },
      { em: '💰', n: '코인 2배 부스터', d: '일정 시간 코인 2배', on: lv.lv >= 5 }
    ];
    return `<div class="screen">
      ${topbar({ title: '내 정보', sub: me.name + ' · ' + c.name, right: `${coinChip(cid, sid)}${sfxBtn()}` })}
      <div class="card">
        <div class="kv"><span class="k">닉네임</span><span>${esc(me.nickname || '아직 안 정했어요')}</span></div>
        <div class="kv"><span class="k">우리 반</span><span>${esc(c.name)} · ${esc(c.semester)} 과정</span></div>
        <div class="kv"><span class="k">수업</span><span>${esc(c.days)} ${esc(c.time)}</span></div>
        <div class="kv"><span class="k">교재</span><span>${esc((c.textbooks || []).join(' · '))}</span></div>
        <div class="kv"><span class="k">레벨</span><span>Lv.${lv.lv} · ${store.totalXP(cid, sid)} XP</span></div>
        <div class="row" style="margin-top:12px">
          <button class="btn btn-ghost grow" data-act="editProfile">캐릭터·닉네임</button>
          <button class="btn btn-ghost grow" data-act="openPinChange">PIN 바꾸기</button>
        </div>
      </div>
      <div class="card tight">
        <div class="kv"><span class="k">🔊 효과음</span>
          <button class="toggle ${EMA.sfx.on() ? 'on' : ''}" data-act="toggleSound" aria-label="효과음 켜기/끄기"><i></i><b>${EMA.sfx.on() ? '켜짐' : '꺼짐'}</b></button></div>
        <div class="muted" style="margin-top:8px">첫 터치부터 소리가 나요. 조용한 곳에서는 여기서 끄면 돼요.</div>
      </div>
      <div class="sect-t"><span>⚔️ 성장 스킬</span><span class="grow"></span><span class="hint">보스전·미션으로 해금</span></div>
      <div class="card tight">
        ${skills.map(s => `<div class="kv"><span class="k">${s.em} ${esc(s.n)}<br><span class="muted" style="font-size:11px">${esc(s.d)}</span></span>
          <span>${s.on ? '<span class="pill ok">해금</span>' : '<span class="pill">잠김</span>'}</span></div>`).join('')}
      </div>
      <div class="card tight">
        <div class="kv"><span class="k">🐾 수학 펫</span><span>${pets.length}마리 ${egg ? '· 알 ' + egg.pct + '%' : ''}</span></div>
        <div class="lvlbar" style="margin-top:6px"><i style="width:${egg ? egg.pct : 0}%"></i></div>
        <div class="row" style="margin-top:10px"><button class="btn btn-ghost btn-block" data-act="openShop">🛍️ 상점 · 펫 도감</button></div>
      </div>
      <div class="card tight">
        <button class="btn btn-ghost btn-block" data-act="teacherEntry">👩‍🏫 선생님 모드</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="logout">로그아웃</button>
        <button class="btn btn-danger btn-block" style="margin-top:8px" data-act="resetDemo">시제품 데이터 초기화</button>
        <div class="muted center" style="margin-top:10px">숙제 대소동(가칭) 시제품 v0.3 · ${esc(c.name)}</div>
      </div>
      ${nav([
        { id: 'home', em: '🔥', label: '오늘 숙제' },
        { id: 'record', em: '👾', label: '내 기록' },
        { id: 'rank', em: '🏆', label: '랭킹' },
        { id: 'me', em: '⚙️', label: '내 정보' }
      ], view.tab)}
      ${sheetHtml()}
    </div>`;
  }

  /* =========================================================
     선생님
  ========================================================= */
  function connBar() {
    if (store.mode === 'api') {
      return `<div class="connbar ok">🟢 <b>관리시트 연동 중</b> · 마지막 불러오기 ${esc(store.lastSync || '방금')}</div>`;
    }
    return `<div class="connbar test">🧪 <b>테스트 모드</b> — 이 기기(브라우저)에만 저장 중 · 11/25 시트 연동 예정</div>`;
  }

  function renderTeacher() {
    const cid = view.classId || 'c4m2';
    const c = store.getClass(cid);
    const boss = store.boss(cid);
    const tabs = [
      { id: 'today', em: '📋', label: '오늘 현황' },
      { id: 'stamp', em: '✅', label: '도장' },
      { id: 'top5', em: '⭐', label: '질문 TOP5' },
      { id: 'report', em: '📊', label: '성취도' },
      { id: 'pages', em: '📖', label: '쪽수표' },
      { id: 'students', em: '👥', label: '학생·PIN' }
    ];
    let body = '';
    if (view.teacherTab === 'today') body = teacherToday(c);
    else if (view.teacherTab === 'stamp') body = teacherStamp(c);
    else if (view.teacherTab === 'top5') body = teacherTop5(c);
    else if (view.teacherTab === 'report') body = teacherReport(c);
    else if (view.teacherTab === 'pages') body = teacherPages(c);
    else body = teacherStudents(c);

    return `<div class="screen">
      ${topbar({
        title: '선생님 모드',
        sub: c.name + ' · ' + EMA.ui.kdate(store.state.today) + ' ' + EMA.ui.kdow(store.state.today),
        right: `<button class="icon-btn" data-act="teacherExit" aria-label="선생님 모드 나가기">✕</button>`
      })}
      ${connBar()}
      <div class="pad tstat">
        <span class="chip">제출 ${boss.submitted}/${boss.total}</span>
        <span class="chip">도장 ${boss.stamped}/${boss.total}</span>
        <span class="chip" style="color:#C53030">보스 HP ${boss.hp}%</span>
      </div>
      <div class="tabs-scroll">
        ${tabs.map(t => `<button class="${view.teacherTab === t.id ? 'on' : ''}" data-act="teacherTab" data-t="${t.id}">${t.em} ${t.label}</button>`).join('')}
      </div>
      ${body}
      ${nav(tabs.slice(0, 5), view.teacherTab, 'teacherTab')}
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
    out.push(`<button class="tbtn ${s.sick ? 'on' : ''}" data-act="toggleSick" data-id="${s.id}">🤒 아픔 방어${s.sick ? ' ON' : ''}</button>`);
    out.push(`<button class="tbtn ${store.hasPrint(cid, s.id) ? 'on' : ''}" data-act="openPrintSet" data-id="${s.id}">📝 프린트${store.hasPrint(cid, s.id) ? ' ' + store.printInfo(cid, s.id).count : ''}</button>`);
    out.push(`<button class="tbtn" data-act="openReport" data-id="${s.id}">📊 성취도</button>`);
    return `<div class="tbtns">${out.join('')}</div>`;
  }

  function teacherToday(c) {
    const cid = c.id;
    const l = store.lesson(cid);
    const rows = store.classDay(cid);
    const pending = rows.filter(r => r.sub && r.sub.status === 'submitted').length;
    return `
      <div class="card lesson-card">
        <div class="card-hd"><span class="t">📖 시트에서 읽은 오늘 수업</span><span class="grow"></span>
          <button class="btn btn-ghost btn-sm" data-act="lessonEdit">쪽수 바꾸기</button></div>
        <div class="ln"><div class="k">진도</div><div class="v">${esc(l.lesson)}</div></div>
        <div class="ln"><div class="k">숙제</div><div class="v">${esc(l.homework)}</div></div>
        <div class="ln"><div class="k">분량</div><div class="v">${store.books(cid).map(b => esc(b.book) + ' ' + (b.pages.length > 1 ? b.pages[0] + '~' + b.pages[b.pages.length - 1] : b.pages[0]) + '쪽').join(' · ')} → ${store.tiles(cid).length}문제 타일</div></div>
        <div class="ln"><div class="k">특이사항</div><div class="v" style="font-size:12.5px;font-weight:700">${esc(l.memo || '—')}</div></div>
      </div>
      <div class="pad tacts">
        <button class="btn btn-primary grow" data-act="stampAll">✅ 한꺼번에 도장! ${pending ? '(' + pending + '장)' : ''}</button>
        <button class="btn btn-ghost grow" data-act="bigTop5">📺 질문 TOP 5 크게</button>
      </div>
      <div class="card">
        <div class="card-hd"><span class="t">오늘 반 현황</span><span class="grow"></span><span class="s">${rows.filter(r => r.sub).length}명 제출</span></div>
        ${rows.map(r => {
          const sub = r.sub;
          const status = sub && sub.stampAt ? `<span class="pill ok">도장 ${esc(sub.stampAt)}</span>`
            : sub && sub.status === 'submitted' ? `<span class="pill warn">제출 ${esc(sub.at)}</span>`
              : sub && sub.status === 'resubmit' ? `<span class="pill bad">재제출</span>`
                : sub && sub.status === 'unlocked' ? `<span class="pill info">제출 풀림</span>` : `<span class="pill">미제출</span>`;
          return `<div class="sturow">
            <div class="stuhd" data-act="openReport" data-id="${r.student.id}">
              ${avatarHtml(r.student, 32)}
              <div class="grow"><div class="nm">${esc(r.student.nickname || r.student.name)}${r.student.nickname ? ` <small>${esc(r.student.name)}</small>` : ''}${r.student.sick ? ' 🤒' : ''}</div>
                <div class="cnts"><span class="o">⭕${r.c1}</span><span class="x">❌${r.c2}</span><span class="f">⚔️${r.c3}</span><span class="q">⭐${r.c4}</span><span class="c">⏭️${r.c5}</span>${store.lateUpload(cid, r.student.id) ? '<span class="late">⏰ 어제분</span>' : ''}</div>
              </div>
              <div class="stright">${status}${r.printSub ? '<span class="pill info">📝 프린트</span>' : ''}<span class="chev">›</span></div>
            </div>
            ${stuQuickButtons(cid, r)}
          </div>`;
        }).join('')}
        <div class="muted" style="margin-top:9px">학생 이름을 누르면 <b>학부모 성취도 카드</b>가 열려요. 열은 ⭕맞음 · ❌틀림 · ⚔️고침 · ⭐질문 · ⏭️이월.</div>
      </div>
      <div class="card tight">
        <div class="muted">① 수업 시작 10분: <b>질문 TOP 5</b> 크게 보기 → ② 책 넘기며 <b>도장</b>(또는 한꺼번에 도장) → ③ 수업 후 시트에 진도·숙제 입력(지금 하던 그대로). 앱에 따로 입력하는 일은 없어요.</div>
      </div>
      ${store.mode === 'api' ? '' : `<div class="card tight previewfx">
        <div class="card-hd"><span class="t">🧪 연출 미리보기</span><span class="grow"></span><span class="hint">테스트 모드 전용</span></div>
        <div class="muted" style="margin-bottom:8px">아이 화면에 뜨는 축하 연출을 미리 봐요.</div>
        <div class="row wrap">
          <button class="btn btn-ghost btn-sm" data-act="previewFx" data-k="shield">🛡️ 방어막</button>
          <button class="btn btn-ghost btn-sm" data-act="previewFx" data-k="early">⚡ 얼리버드</button>
          <button class="btn btn-ghost btn-sm" data-act="previewFx" data-k="legend">🐈 전설 펫</button>
          <button class="btn btn-ghost btn-sm" data-act="previewFx" data-k="boss">🏆 보스 처치</button>
        </div>
      </div>`}`;
  }

  function teacherStamp(c) {
    const cid = c.id;
    const rows = store.classDay(cid).filter(r => r.sub);
    const pending = rows.filter(r => r.sub.status === 'submitted');
    return `
      <div class="pad tacts">
        <button class="btn btn-primary grow" data-act="stampAll">✅ 한꺼번에 도장! ${pending.length ? '(' + pending.length + '장)' : ''}</button>
      </div>
      <div class="card tight">
        <div class="muted">사진과 실제 책을 대조하고 <b>도장</b>을 누르면 최종 1등·XP가 확정돼요. 사진은 <b>선생님 화면에서만</b> 보여요(학생 화면엔 완료 여부만).</div>
      </div>
      <div class="sect-t"><span>도장 기다리는 사진 ${pending.length}장</span></div>
      ${pending.length ? `<div class="pad"><div class="stampgrid">
        ${pending.map(r => {
          const ph = store.photo(r.sub.photoId);
          return `<div class="stampcard">
            ${ph ? `<img src="${ph.data}" alt="">` : '<div style="aspect-ratio:3/4;border-radius:10px;background:#F4EFE9"></div>'}
            <div class="nm">${esc(r.student.nickname || r.student.name)} <small>${esc(r.student.name)}</small></div>
            <div class="mt">${esc(r.sub.at)} 제출 · ⭕${r.c1} ❌${r.c2 + r.c4} ⚔️${r.c3}</div>
            <div class="verifyline">🎲 인증 ${esc((r.sub.verify || {}).book || '')} ${esc((r.sub.verify || {}).page || '')}쪽</div>
            <div class="row">
              <button class="btn btn-primary btn-sm grow" data-act="stamp" data-id="${r.student.id}">도장 찍기</button>
              <button class="btn btn-ghost btn-sm" data-act="photoView" data-id="${r.student.id}">🔍 크게</button>
              <button class="btn btn-ghost btn-sm" data-act="resubmit" data-id="${r.student.id}">재제출</button>
            </div>
          </div>`;
        }).join('')}
      </div></div>` : `<div class="card"><div class="empty">지금 도장을 기다리는 사진이 없어요.<br><small>아이가 제출하면 여기에 사진이 도착해요.</small></div></div>`}
      <div class="sect-t" style="margin-top:8px"><span>오늘 도장 완료</span></div>
      <div class="card tight">
        ${store.classDay(cid).filter(r => r.sub && r.sub.stampAt).map(r =>
          `<div class="kv"><span class="k">✅ ${esc(r.student.nickname || r.student.name)} <small class="muted">${esc(r.student.name)}</small></span><span>${esc(r.sub.stampAt)} 도장</span></div>`
        ).join('') || '<div class="muted">아직 도장이 없어요.</div>'}
      </div>`;
  }

  function teacherTop5(c) {
    const cid = c.id;
    const list = store.top5(cid);
    const rows = store.classDay(cid);
    const tiles = store.tiles(cid);
    const nameOf = k => { const t = tiles.find(x => x.key === k); return t ? `${t.book} ${t.page}쪽 ${t.num}번` : k; };
    return `
      <div class="pad tacts"><button class="btn btn-navy btn-block" data-act="bigTop5">📺 질문 TOP 5 크게 보기 (칠판용)</button></div>
      <div class="card tight">
        <div class="muted">아이는 <b>❌ 틀린 문제</b> 중에서 ⭐를 골라요. 여기 모인 문제만 수업 시작 10분에 짚으면 됩니다.</div>
      </div>
      <div class="card">
        <div class="card-hd"><span class="t">⭐ 오늘 최다 막힘 문제 TOP 5</span></div>
        ${list.length ? list.map((t, i) => `
          <div class="top5row">
            <div class="no">${i + 1}</div>
            <div class="lb">${t.page}쪽 ${esc(t.num)}번 <span class="sm">${esc(t.type || '')} · ${t.count}명</span></div>
            <div class="ct">${t.students.map(s => esc(s.nickname || s.name)).join(', ')}</div>
          </div>`).join('') : '<div class="empty">오늘 별표가 없어요.<br><small>아이들이 ⭐ 또 틀림·질문을 누르면 모여요.</small></div>'}
      </div>
      <div class="sect-t"><span>학생별 오답·질문</span></div>
      <div class="card tight">
        ${rows.map(r => {
          const g = store.grade(cid, r.student.id);
          const wrong = tiles.filter(t => g.marks[t.key] === 'x');
          const stars = tiles.filter(t => g.marks[t.key] === 'x' && g.cleanup[t.key] === 'star').map(t => t.page + '쪽 ' + t.num + '번');
          return `<div class="kv" style="align-items:flex-start">
            <span class="k">${esc(r.student.nickname || r.student.name)} <small class="muted">${esc(r.student.name)}</small><br>
              <span class="muted" style="font-size:11px">❌ ${wrong.length ? wrong.map(t => t.page + '쪽 ' + t.num + '번').join(', ') : '없음'}</span></span>
            <span class="muted" style="font-size:11px;text-align:right">${stars.length ? '⭐ ' + stars.join('<br>⭐ ') : '<span style="color:#B3A79A">별표 없음</span>'}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  function teacherReport(c) {
    const cid = c.id;
    const rows = store.classDay(cid);
    const on = store.state.shop ? store.state.shop.rewardsOn !== false : true;
    const claims = ((store.state.shop || {}).claims || []);
    return `
      <div class="card tight">
        <div class="muted">학생을 누르면 <b>주간·월간·학기 성취도</b>와 <b>어머님께 보낼 카톡 요약</b>이 1초 만에 나와요.</div>
      </div>
      <div class="card">
        ${rows.map(r => `<button class="reprow" data-act="openReport" data-id="${r.student.id}">
          ${avatarHtml(r.student, 34)}
          <span class="grow"><b>${esc(r.student.name)}</b> <small>${esc(r.student.nickname || '')}</small></span>
          <span class="muted">🔥${store.streak(cid, r.student.id)} · 🐾${store.myPets(cid, r.student.id).length}</span>
          <span class="chev">›</span></button>`).join('')}
      </div>

      <div class="sect-t"><span>🎁 현실 보상 쿠폰</span><span class="grow"></span>
        <button class="toggle ${on ? 'on' : ''}" data-act="toggleRewards" aria-label="현실 보상 쿠폰 켜기/끄기"><i></i><b>${on ? 'ON' : 'OFF'}</b></button></div>
      <div class="card tight">
        <div class="muted">켜 두면 아이 상점에 <b>코인 120·200·300개 = 스티커·초코파이·마이쮸</b> 쿠폰이 보여요. 아이가 사면 아래에 <b>사용 요청</b>이 쌓여요.</div>
        ${claims.length ? claims.slice().reverse().map(cl => `
          <div class="kv claim ${cl.used ? 'used' : ''}">
            <span class="k">${cl.em} ${esc(cl.name)}<br><small class="muted">${esc(store.student(cid, cl.sid) ? store.student(cid, cl.sid).name : cl.sid)} · ${esc(cl.at.slice(5))}</small></span>
            ${cl.used ? '<span class="pill">사용 완료</span>' : `<button class="btn btn-primary btn-sm" data-act="useClaim" data-id="${cl.id}">간식 주기</button>`}
          </div>`).join('') : '<div class="muted" style="margin-top:8px">아직 쿠폰 사용 요청이 없어요.</div>'}
      </div>

      <div class="card tight">
        <div class="card-hd"><span class="t">🧪 지금은 테스트 모드예요</span></div>
        <div class="muted">관리시트 연동 전이라 <b>이 브라우저에만</b> 기록이 쌓입니다. 오류가 아니라 정상 상태이고, <b>11/25(수) 시트 연동</b> 후에는 선생님이 시트에 적은 진도·숙제가 그대로 내려옵니다.</div>
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
      <div class="tabs-scroll" style="padding-left:16px;padding-right:16px">
        ${books.map(b => `<button class="${b === book ? 'on' : ''}" data-act="pmBook" data-b="${esc(b)}">${esc(b)}</button>`).join('')}
      </div>
      <div class="card tight">
        <div class="muted">한 번만 세팅하면 끝! 이 표에 있는 쪽수를 시트 <b>숙제</b> 칸에 적으면 학생 화면에 문제 버튼이 자동으로 생겨요. 지금은 <b>예시 쪽수</b>이고, 실제 교재 쪽수·문제번호만 이 표에서 바꾸면 됩니다.</div>
      </div>
      <div class="card">
        <div class="card-hd"><span class="t">${esc(book)}</span><span class="grow"></span><span class="s">${pages.length}쪽 세팅</span></div>
        ${pages.map(p => `<button class="pm-row" data-act="pmPage" data-p="${p.page}">
          <div class="pg">${p.page}쪽<br><span style="font-size:9.5px;color:#B3A79A">${esc(p.type)}</span></div>
          <div class="ns">${p.problems.map(n => `<span class="n">${esc(n)}</span>`).join('')}</div>
        </button>`).join('')}
      </div>
      <div class="card tight">
        <div class="card-hd"><span class="t">쪽수표 저장/교체</span></div>
        <div class="muted">실제 쪽수표를 받으면 아래 JSON을 내려받아 <code>data/page-maps.js</code>의 본문을 바꾸면 앱 전체에 반영돼요.</div>
        <div class="row" style="margin-top:10px">
          <button class="btn btn-ghost grow" data-act="pmDownload">📥 JSON 내려받기</button>
          <button class="btn btn-ghost grow" data-act="pmCopy">📋 JSON 복사</button>
        </div>
      </div>
      <div class="card tight">
        <div class="card-hd"><span class="t">이번 숙제 쪽수 (시트 대신 테스트)</span></div>
        <div class="kv"><span class="k">지금 숙제</span><span>${esc(l.homework)}</span></div>
        <button class="btn btn-primary btn-block" style="margin-top:10px" data-act="lessonEdit">쪽수 바꿔서 문제 확인</button>
      </div>`;
  }

  function teacherStudents(c) {
    return `
      <div class="card tight">
        <div class="muted">실명은 선생님 화면에만 보여요. 아이들 화면에는 <b>닉네임</b>만 나갑니다. PIN 재발급은 선생님만 할 수 있어요.</div>
      </div>
      <div class="card">
        ${c.students.map(s => `<div class="pinrow">
          ${avatarHtml(s, 32)}
          <span class="grow"><b>${esc(s.name)}</b> <small class="muted">${esc(s.nickname || '닉네임 없음')}</small></span>
          <span class="pinval" data-pin="${s.id}">${view.pinReveal === s.id ? esc(s.pin) : '••••'}</span>
          <button class="btn btn-ghost btn-sm" data-act="revealPin" data-id="${s.id}">${view.pinReveal === s.id ? '숨기기' : '보기'}</button>
          <button class="btn btn-ghost btn-sm" data-act="regenPin" data-id="${s.id}">재발급</button>
        </div>`).join('')}
      </div>
      <div class="card tight">
        <div class="kv"><span class="k">반</span><span>${esc(c.name)} · ${esc(c.semester)} 과정</span></div>
        <div class="kv"><span class="k">수업</span><span>${esc(c.days)} ${esc(c.time)}</span></div>
        <div class="kv"><span class="k">교재</span><span>${esc((c.textbooks || []).join(' · '))}</span></div>
        <div class="kv"><span class="k">개강</span><span>${esc(c.startDate || '—')} · 초6-1</span></div>
      </div>
      <div class="card tight">
        <div class="muted">🤒 아픔 방어를 켜면 그날 불꽃이 보호돼요(선생님만 조작). 켜 둔 학생은 오늘 현황 이름 옆에 🤒로 표시됩니다.</div>
      </div>`;
  }

  /* =========================================================
     시트(모달)들 — 모두 상단 ✕ + 바깥 터치 닫기
  ========================================================= */
  function sheetHtml() {
    const map = {
      gallery: sheetGallery, carry: sheetCarry, onboard: sheetOnboard, pinchange: sheetPinChange,
      profile: sheetProfile, shop: sheetShop, pet: sheetPet, monster: sheetMonster,
      top5big: sheetTop5Big, report: sheetReport, printset: sheetPrintSet,
      lessonEdit: sheetLessonEdit, pmpage: sheetPmPage, yesterday: sheetYesterday,
      photocopy: sheetPhotoCopy, printpick: sheetPrintPick
    };
    const fn = map[view.sheet];
    return fn ? fn() : '';
  }

  function sheetGallery() {
    const cid = view.classId, sid = view.studentId;
    const c = store.getClass(cid);
    const rows = store.classDay(cid);
    const n = rows.filter(r => r.sub).length;
    return sheetWrap('👀 친구들 풀이', `
      <div class="gintro">오늘 <b>${n}명</b>이 숙제를 냈어요. 누가 냈는지만 따뜻하게 보여 줘요.<br>
        <span class="muted">사진은 선생님만 보고, 많이 틀린 개수는 아무도 못 봐요.</span></div>
      <div class="glist">
        ${rows.map(r => {
          const sub = r.sub;
          const me = r.student.id === sid;
          const state = sub && sub.stampAt ? { cls: 'done', txt: '도장 완료! ✅', em: '🏅' }
            : sub ? { cls: 'sub', txt: '오늘 완료! 🎉', em: '🌟' }
              : { cls: 'none', txt: '아직이에요 🌱', em: '🌱' };
          return `<div class="grow-row ${state.cls} ${me ? 'me' : ''}">
            ${avatarHtml(r.student, 38)}
            <div class="grow"><b>${esc(r.student.nickname || r.student.name)}${me ? ' <span class="pill">나</span>' : ''}</b>
              <small>${esc(state.txt)}</small></div>
            <span class="gem">${state.em}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="gfriendly">다 같이 하면 더 재밌어요! 아직인 친구는 내일 같이 하면 돼요 👏</div>
    `);
  }

  function sheetCarry() {
    const cid = view.classId, sid = view.studentId;
    const list = store.carried(cid, sid);
    return sheetWrap('⚔️ 밀린문제', `
      <div class="sub">다시 풀어서 고치면 몬스터를 잡고 코인을 받아요. 모르겠으면 선생님께 물어봐요.</div>
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
    return sheetWrap('내 캐릭터 만들기', `
      <div class="sub">캐릭터를 고르고 닉네임을 정해요. 랭킹에는 닉네임만 보여요(한글 4글자 이내).</div>
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
      <div class="sub">닉네임은 한글 4글자 이내. 선생님 화면에는 실명과 함께 보여요.</div>
      <div class="avatars">${avs.map(a => `<button class="${a === chosen ? 'on' : ''}" data-act="avatar" data-a="${a}">${a}</button>`).join('')}</div>
      <div style="margin-top:14px">
        <input id="nickInput" class="tinput" placeholder="닉네임" maxlength="4" value="${esc(view.pending.nickname || me.nickname || '')}">
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="saveProfile">저장</button>
    `);
  }

  function sheetPinChange() {
    return sheetWrap('내 PIN 바꾸기', `
      <div class="sub">새 PIN 4자리를 입력해요. 친구에게 알려 주지 마세요.</div>
      <input id="newPin" class="tinput pininput" inputmode="numeric" maxlength="4" placeholder="새 PIN 4자리">
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="savePin">바꾸기</button>
    `);
  }

  function sheetShop() {
    const cid = view.classId, sid = view.studentId;
    const coins = store.coins(cid, sid);
    const egg = store.eggOf(cid, sid);
    const items = store.shopItems();
    const bag = store.bagOf(cid, sid);
    const pets = store.myPets(cid, sid);
    const rar = GAME().rarity || {};
    return sheetWrap('🛍️ 미니 상점', `
      <div class="wallet"><span class="w-em">🪙</span><b>${coins}</b>코인
        <span class="grow"></span><span class="muted">${esc(store.state.today.slice(5))} 기준</span></div>

      <div class="eggsect">
        ${egg ? `<div class="eggbox">
          <div class="eggtop"><span class="em eggwig">🥚</span>
            <div class="grow"><b>부화 ${egg.pct}%</b>
              <div class="lvlbar"><i style="width:${egg.pct}%"></i></div>
              <small>간식 1개 = +25%</small></div></div>
          <button class="btn btn-mint btn-block" data-act="feed" ${coins < 20 ? 'disabled' : ''}>🍎 간식 주기 (20코인)</button>
        </div>` : `<div class="eggbox empty">
          <div class="eggtop"><span class="em">🥚</span><div class="grow"><b>아직 알이 없어요</b><small>랜덤 펫 알을 뽑아 도감을 채워 보세요!</small></div></div>
          <button class="btn btn-primary btn-block" data-act="buy" data-id="egg" ${coins < 60 ? 'disabled' : ''}>🥚 랜덤 알 뽑기 (60코인)</button>
        </div>`}
      </div>

      <div class="shopgrid">
        ${items.filter(i => i.kind !== 'coupon').map(i => `
          <div class="shopitem">
            <div class="si-em">${i.em}</div>
            <div class="si-nm">${esc(i.name)}</div>
            <div class="si-d">${esc(i.desc || '')}</div>
            ${i.kind === 'shield' || i.kind === 'bomb' ? `<div class="si-have">가진 것 ${bag[i.kind] || 0}개</div>` : ''}
            <button class="btn ${coins >= i.price ? 'btn-primary' : 'btn-ghost'} btn-sm btn-block" data-act="buy" data-id="${i.id}" ${coins < i.price || (i.kind === 'egg' && egg) || (i.kind === 'snack' && !egg) ? 'disabled' : ''}>
              ${coins >= i.price ? i.price + '코인' : (i.price - coins) + '코인 더'}
            </button>
          </div>`).join('')}
      </div>

      <div class="sect-t"><span>🎁 현실 보상 쿠폰</span><span class="grow"></span><span class="hint">선생님이 켜 두면 보여요</span></div>
      ${items.filter(i => i.kind === 'coupon').length ? `<div class="couponlist">
        ${items.filter(i => i.kind === 'coupon').map(i => `
          <div class="coupon">
            <span class="c-em">${i.em}</span>
            <span class="grow"><b>${esc(i.name)}</b><small>${i.price}코인 · 선생님께 보여 주세요</small></span>
            <button class="btn ${coins >= i.price ? 'btn-primary' : 'btn-ghost'} btn-sm" data-act="buy" data-id="${i.id}" ${coins < i.price ? 'disabled' : ''}>${coins >= i.price ? '받기' : (i.price - coins) + '개 부족'}</button>
          </div>`).join('')}
      </div>` : `<div class="card tight"><div class="muted">지금은 선생님이 현실 보상 쿠폰을 꺼 두었어요. 펫 간식·알·아이템만 살 수 있어요.</div></div>`}

      <div class="sect-t"><span>🐾 내 수학 펫 ${pets.length}마리</span><span class="grow"></span>
        <button class="linkbtn" data-act="closeSheet">도감 보기 →</button></div>
      <div class="petgrid mini">
        ${pets.length ? pets.map(p => {
          const r = rar[p.rarity] || {};
          return `<button class="petcard got r-${p.rarity}" data-act="petDetail" data-id="${p.id}">
            <span class="rar">${r.label || ''}</span><span class="pem">${p.em}</span>
            <span class="pnm">${esc(p.name)}</span><span class="ptag">${esc(p.tag || '')}</span></button>`;
        }).join('') : '<div class="muted">아직 펫이 없어요. 알을 뽑아 보세요!</div>'}
      </div>
    `);
  }

  function sheetPet() {
    const cat = store.petCatalog();
    const p = cat.find(x => x.id === view.petDetail);
    if (!p) return '';
    const mine = store.myPets(view.classId, view.studentId).find(x => x.id === p.id);
    const r = (GAME().rarity || {})[p.rarity] || {};
    return sheetWrap((mine ? p.em + ' ' : '❔ ') + (mine ? esc(p.name) : '아직 만나지 못한 펫'), `
      <div class="pethero r-${p.rarity}">
        <div class="ph-em">${mine ? p.em : '❔'}</div>
        <div class="ph-rar">${r.label || ''} 등급 · ${r.rate || 0}% 확률</div>
        <div class="ph-line">${mine ? esc(p.line || '') : '상점에서 알을 뽑아 부화시키면 만날 수 있어요.'}</div>
        ${mine ? `<div class="ph-tag">${esc(p.tag || '')}</div><div class="muted">${esc(mine.at || '')} 에 만남</div>` : ''}
      </div>
      <div class="muted center" style="margin-top:12px">도감 ${store.myPets(view.classId, view.studentId).length}/${cat.length} 수집</div>
    `);
  }

  function sheetMonster() {
    const cid = view.classId, sid = view.studentId;
    const m = store.monsters(cid, sid).find(x => x.id === view.monsterDetail);
    if (!m) return '';
    return sheetWrap('👾 몬스터 상세', `
      <div class="pethero ${m.captured ? 'r-rare' : 'r-common'}">
        <div class="ph-em">${m.captured ? m.em : '🥚'}</div>
        <div class="ph-rar">${m.captured ? '포획 완료' : '아직 안 잡음'}</div>
        <div class="ph-line">${esc(m.name || '오답 몬스터')}</div>
      </div>
      <div class="kv"><span class="k">문제</span><span>${esc(m.book ? m.book + ' ' : '')}${esc(String(m.page))}쪽 ${esc(String(m.num))}번</span></div>
      <div class="kv"><span class="k">날짜</span><span>${esc(m.date || '')}</span></div>
      <div class="kv"><span class="k">상태</span><span>${m.captured ? '⚔️ 고쳐서 잡았어요' : '❌ 아직 안 고쳤어요'}</span></div>
      <div class="muted" style="margin-top:10px">틀린 문제를 고치면 이 몬스터가 도감에 남아요.</div>
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
      <div class="muted center" style="margin-top:10px">칠판에 이 번호만 써 두면 돼요.</div>
    `, { wide: true });
  }

  function sheetReport() {
    const cid = view.classId;
    const sid = view.reportSid;
    const s = store.student(cid, sid);
    if (!s) return '';
    const rg = view.reportRange || 'week';
    const a = store.achievement(cid, sid, rg);
    const text = store.kakaoSummary(cid, sid, rg);
    return sheetWrap('📊 ' + esc(s.name) + ' 성취도', `
      <div class="segmented">
        <button class="${rg === 'week' ? 'on' : ''}" data-act="reportRange" data-r="week">이번 주</button>
        <button class="${rg === 'month' ? 'on' : ''}" data-act="reportRange" data-r="month">이번 달</button>
        <button class="${rg === 'semester' ? 'on' : ''}" data-act="reportRange" data-r="semester">이번 학기</button>
      </div>
      <div class="stat-grid" style="margin-top:10px">
        <div class="stat"><div class="v">🔥 ${a.flameDays}일</div><div class="l">불꽃 인정</div></div>
        <div class="stat"><div class="v">✏️ ${a.totalSolved}</div><div class="l">푼 문제</div></div>
        <div class="stat"><div class="v">⚔️ ${a.todayFixed}</div><div class="l">오늘 고친 오답</div></div>
      </div>
      <div class="stat-grid" style="margin-top:8px">
        <div class="stat"><div class="v">${a.avgExam != null ? a.avgExam + '점' : '—'}</div><div class="l">단원평가 평균</div></div>
        <div class="stat"><div class="v">🐾 ${a.owned}</div><div class="l">수학 펫</div></div>
        <div class="stat"><div class="v">📅 ${a.activeDays}일</div><div class="l">숙제한 날</div></div>
      </div>
      <div class="card tight" style="margin-top:10px">
        <div class="card-hd"><span class="t">📋 어머님께 보낼 카톡 요약</span></div>
        <pre class="kakao" id="kakaoText">${esc(text)}</pre>
        <button class="btn btn-primary btn-block" data-act="copyReport">📋 1초 복사</button>
      </div>
      <div class="muted">복사한 뒤 카톡에 붙여넣기만 하면 돼요. 숫자는 앱 기록 기준이라 실제와 다르면 그 부분만 고쳐 보내세요.</div>
    `);
  }

  function sheetPrintSet() {
    const cid = view.classId;
    const sid = view.printSid;
    const s = store.student(cid, sid);
    const info = store.printInfo(cid, sid);
    return sheetWrap('📝 오답프린트 설정', `
      <div class="sub">${esc(s.name)} 학생에게 오늘 낼 <b>오답프린트 문제 수</b>를 넣어 주세요. 1~N번 타일이 바로 생겨요.</div>
      <div class="printpick">
        ${[10, 15, 18, 20, 25, 30].map(n => `<button class="numtile ${info && info.count === n ? 'on' : ''}" data-act="printNum" data-n="${n}">${n}문제</button>`).join('')}
      </div>
      <input id="printInput" class="tinput" inputmode="numeric" placeholder="직접 입력 (예: 18)" value="${info ? info.count : ''}">
      <div class="row" style="margin-top:12px">
        <button class="btn btn-primary grow" data-act="savePrint">저장</button>
        ${info ? `<button class="btn btn-danger" data-act="clearPrint">없애기</button>` : ''}
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

  function sheetLessonEdit(c) {
    const cid = c.id;
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
      <div class="sub">어제(${esc(EMA.ui.kdate(y))}) 3문제 이상 풀었는데 폰이 없어서 못 올렸다면, 지금 사진 한 장으로 불꽃을 살릴 수 있어요. <b>딱 어제 것만</b> 돼요.</div>
      ${view.pending.yphoto
        ? `<div class="photo-preview"><img src="${view.pending.yphoto}" alt="어제 사진"></div>
           <button class="btn btn-ghost btn-sm" style="margin-top:8px" data-act="yPhotoPick">사진 다시 고르기</button>`
        : `<button class="photo-drop" data-act="yPhotoPick">
             <div class="em">📷</div><div class="t">어제 푼 사진 올리기</div>
             <div class="s">푼 흔적이 보이면 돼요. 다 맞지 않아도 괜찮아요.</div>
           </button>`}
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="submitYesterday">어제분 올리기 (⏰)</button>
      <div class="muted center" style="margin-top:8px">올리면 선생님 화면에 ⏰ 어제분으로 표시돼요.</div>
      <input type="file" class="photo-input" data-target="yesterday" accept="image/*" capture="environment">
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
    else html = view.tab === 'home' ? renderStudentHome() : view.tab === 'record' ? renderRecord() : view.tab === 'rank' ? renderRank() : renderMe();
    app.innerHTML = html;
    const sc = app.querySelector('.screen');
    if (sc) {
      sc.scrollTop = view.resetScroll ? 0 : y;
      view.resetScroll = false;
    }
    if (document.body.classList.contains('sheet-open')) document.body.classList.remove('sheet-open');
    if (view.sheet) document.body.classList.add('sheet-open');

    const inputs = app.querySelectorAll('input[id]');
    inputs.forEach(inp => {
      inp.addEventListener('input', () => {
        if (inp.id === 'nickInput') view.pending.nickname = inp.value;
        if (inp.id === 'pmInput') view.pmInput = inp.value;
        if (inp.id === 'pageInput') view.lessonEditPages = inp.value;
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
    if (!f) return;
    try {
      const data = await EMA.ui.compress(f, 900, 0.62);
      if (target === 'yesterday') view.pending.yphoto = data;
      else { view.pending.photo = data; saveDraft(); }
      EMA.ui.sound('coin');
      EMA.ui.toast('사진 준비 완료! ' + (target === 'yesterday' ? '아래 버튼을 눌러 주세요' : '제출을 눌러 주세요'));
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
      view.gradeSource = 'homework';
      const bs = store.books(view.classId);
      view.gradeBook = bs.length > 1 ? (view.gradeBook && bs.find(b => b.book === view.gradeBook) ? view.gradeBook : bs[0].book) : (bs[0] || {}).book || null;
      view.resetScroll = true; setFlow('grade');
    },
    startPrint() {
      if (!store.hasPrint(view.classId, view.studentId)) { view.sheet = 'printpick'; render(); return; }
      view.gradeSource = 'print';
      view.resetScroll = true; setFlow('grade');
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
        const msgs = ['😱 앗! 오답 몬스터 등장!', '💥 콕! 하나 잡혔다', '🙈 헉, 손가락 미끄러짐?', '😤 이건 다시 잡으면 돼'];
        EMA.ui.fx.hit(t, msgs[Math.floor(Math.random() * msgs.length)], 'bad');
      } else if (next === 'o') {
        const ok = ['⭕ 좋아! 통과', '👏 맞았어!', '✨ 정답!'];
        EMA.ui.fx.hit(t, ok[Math.floor(Math.random() * ok.length)], 'good');
      }
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
      view.resetScroll = true;
      EMA.ui.sound('tap');
      setFlow('clean');
    },
    cleanup(d, el) {
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      store.setCleanup(view.classId, view.studentId, d.key, d.k, kind);
      EMA.ui.haptic();
      render();
      const t = document.querySelector('.clb[data-key="' + d.key + '"][data-k="' + d.k + '"]');
      const on = store.gradeOf(view.classId, view.studentId, kind).cleanup[d.key] === d.k;
      if (t && on) {
        EMA.ui.fx.bounce(t);
        if (d.k === 'fixed') {
          EMA.ui.sound('crit');
          EMA.ui.fx.hit(t, '+250 DMG! ⚔️', 'crit');
          EMA.ui.fx.shake('.boss');
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
      const inp = document.querySelector('.photo-input[data-target="clean"]');
      if (inp) inp.click();
      else EMA.ui.toast('사진 버튼을 다시 눌러 주세요');
    },
    yPhotoPick() {
      const inp = document.querySelector('.photo-input[data-target="yesterday"]');
      if (inp) inp.click();
    },
    async submit() {
      const cid = view.classId, sid = view.studentId;
      const kind = view.gradeSource === 'print' ? 'print' : 'hw';
      const sub = store.submission(cid, sid, null, kind);
      const existingPhoto = sub ? store.photo(sub.photoId) : null;
      const locked = !!(sub && existingPhoto && (sub.status === 'submitted' || sub.status === 'stamped'));
      if (!locked) {
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
        celebrateQueue(items);
      } else {
        store.touchSubmission(cid, sid, kind);
        view.lastResult = { coins: 0, xp: 0 };
      }
      view.pending.photo = null; view.sheet = null;
      view.resetScroll = true;
      setFlow('done');
      if (!(view.lastResult && view.lastResult.titles && view.lastResult.titles.length)) EMA.ui.fx.confetti(70);
      EMA.ui.sound('fanfare');
    },
    gallery() { view.sheet = 'gallery'; EMA.ui.sound('tap'); render(); },
    closeSheet() { view.sheet = null; view.printSid = null; view.printInput = ''; render(); },
    carry() { view.homeTab = 'carry'; view.sheet = null; render(); },

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
      EMA.ui.fx.celebrate({ kind: 'title', em: '⚔️', title: '해결!', sub: `+5코인 · +10 XP · 몬스터 도감에 포획`, ms: 1600 });
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
      view.printSid = null; view.sheet = null;
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
      view.reportSid = d.id; view.reportRange = 'week';
      view.sheet = 'report'; EMA.ui.sound('tap'); render();
    },
    reportRange(d) { view.reportRange = d.r; render(); },
    async copyReport() {
      const cid = view.classId;
      const text = store.kakaoSummary(cid, view.reportSid, view.reportRange);
      const ok = await EMA.ui.copy(text);
      EMA.ui.toast(ok ? '복사 완료! 카톡에 붙여넣기 하세요 📋' : '복사가 안 되면 글자를 길게 눌러 복사해 주세요');
      EMA.ui.sound(ok ? 'coin' : 'wrong');
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
    pmDownload() { EMA.ui.download('page-maps.json', JSON.stringify(store.pageMaps(), null, 1)); },
    async pmCopy() {
      const txt = JSON.stringify(store.pageMaps(), null, 1);
      const ok = await EMA.ui.copy(txt);
      EMA.ui.toast(ok ? '쪽수표 JSON을 복사했어요' : '복사가 안 되면 내려받기를 써 주세요');
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
