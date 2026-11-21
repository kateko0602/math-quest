/* 숙제 대소동 v0.2 — 화면과 동선
   ─────────────────────────────────────────────────────────────
   아이 동선은 딱 3단계입니다.
     홈 → ① 채점(⭕/❌) → ② 정리·사진(⚔️/⭐) → ③ 제출 완료
   누르는 즉시 저장소에 기록되고(localStorage), 화면을 닫았다 열어도 이어집니다.
*/
window.EMA = window.EMA || {};
(function () {
  const esc = EMA.ui.esc;
  const MIN = 3; // 불꽃 최소 문제 수
  let store = null;

  /* 병맛 몬스터 사전 */
  const MONSTER_NAMES = [
    ['연산 실수 콧물 슬라임', '🟢'], ['부호 까먹는 뿡뿡이', '💨'], ['0을 훔쳐간 도둑', '🥷'],
    ['분수 무서워 꽥꽥 오리', '🦆'], ['자릿수 흔드는 유령', '👻'], ['각도 삐뚤 악어', '🐊'],
    ['시간 초과 두더지', '⏰'], ['지우개 먹은 요괴', '🧽']
  ];
  function monName(label) {
    let h = 0;
    for (const ch of String(label)) h = (h * 31 + ch.charCodeAt(0)) % 997;
    return { name: MONSTER_NAMES[h % MONSTER_NAMES.length][0], em: MONSTER_NAMES[h % MONSTER_NAMES.length][1] };
  }
  const BOSS_TAUNTS = [
    '크크크, 오늘도 숙제를 찢어 먹으리라!', '내 다리 여덟 개보다 네 숙제가 느리구나!',
    '너희 반 다 냈냐? 난 아직 배고프다!', '야옹? …아니, 나 문어다!'
  ];
  const TITLES = ['오늘의 수학 용사 🦸', '암산 폭주족 🏍️', '오답 사냥꾼 ⚔️', '불꽃 지킴이 🔥', '문어 퇴치반 🐙', '0을 되찾은 자 🕵️'];
  function todayTitle(st) {
    if (st.c3 >= 2) return '오답 사냥꾼 ⚔️';
    if (st.c1 >= 10) return '암산 폭주족 🏍️';
    if (st.c5 > st.c1) return '내일의 나에게 맡긴 자 🍀';
    return TITLES[Math.floor(Math.random() * 3)];
  }

  const view = {
    role: 'login',            // login | student | teacher
    step: 'class',            // class | student | pin | teacherPin
    classId: null, studentId: null,
    pin: '', pinTarget: 'student',
    tab: 'home', teacherTab: 'today',
    rankMode: 'first', rankScope: 'class',
    sheet: null,              // gallery | carry | profile | pmpage | pinchange | onboard | lessonEdit
    flow: null,               // null | grade | clean | done
    pending: { photo: null, avatar: null, nickname: '' },
    pmBook: null, pmPage: null, pmInput: '',
    lessonEditBook: null, lessonEditPages: null,
    pinReveal: null,
    resetScroll: false
  };

  /* =====================================================================
     초안 저장 — 누른 즉시 localStorage에 남겨 두고, 다시 열면 그 자리로
  ===================================================================== */
  const DRAFT = 'ema.draft.v1';
  const DRAFT_PHOTO = 'ema.draftphoto.v1';
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT, JSON.stringify({
        flow: view.flow, tab: view.tab,
        classId: view.classId, studentId: view.studentId, at: Date.now()
      }));
      if (view.pending.photo) localStorage.setItem(DRAFT_PHOTO, view.pending.photo);
      else localStorage.removeItem(DRAFT_PHOTO);
    } catch (e) { /* 용량 부족 등은 무시하고 계속 진행 */ }
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

  /* =====================================================================
     공통 조각
  ===================================================================== */
  function topbar(o) {
    return `<div class="topbar">
      ${o.back ? `<button class="icon-btn" data-act="${o.backAct || 'back'}">←</button>` : ''}
      <div><div class="ttl">${esc(o.title)}</div>${o.sub ? `<div class="sub">${o.sub}</div>` : ''}</div>
      <div class="grow"></div>${o.right || ''}
    </div>`;
  }
  function nav(items, active) {
    return `<div class="nav ${items.length === 5 ? 'nav5' : ''}">${items.map(it =>
      `<button class="nav-item ${it.id === active ? 'on' : ''}" data-act="tab" data-tab="${it.id}">
        <span class="i">${it.em}</span>${it.label}</button>`).join('')}</div>`;
  }
  function avatarHtml(stu, size) {
    const sz = size || 36;
    return `<span class="rank-av" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz * .52)}px">${esc(stu.avatar || '🙂')}</span>`;
  }
  function sheetWrap(inner) {
    return `<div class="sheet"><div class="backdrop" data-act="closeSheet"></div><div class="body">${inner}</div></div>`;
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
  function oxSum(st) {
    const pct = st.total ? Math.round(st.marked / st.total * 100) : 0;
    return `<div class="oxsum">
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <div class="nums">
        <span class="s-o">⭕ ${st.c1}</span>
        <span class="s-x">❌ ${st.c2 + st.c4}</span>
        <span class="s-f">⚔️ ${st.c3}</span>
        <span class="s-none">아직 ${st.c5}</span>
      </div>
    </div>`;
  }

  /* =====================================================================
     로그인
  ===================================================================== */
  function renderLogin() {
    if (view.step === 'class') {
      const classes = store.classes();
      return `<div class="screen no-nav login">
        <div class="logo">🎮</div>
        <h1>숙제 대소동</h1>
        <div class="tagline">맞으면 ⭕, 틀리면 ❌<br>딱 두 번 누르고 사진 한 장이면 끝!</div>
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
        <div class="pin-hint">시제품 체험용 · 학생 PIN <b>1234</b> · 선생님 PIN <b>2580</b></div>
      </div>`;
    }
    if (view.step === 'student') {
      const c = store.getClass(view.classId);
      return `<div class="screen no-nav login">
        ${topbar({ title: '누구세요?', sub: esc(c.name), back: true })}
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
      ${topbar({ title: '비밀번호 4자리', sub: esc(who), back: true })}
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

  /* =====================================================================
     학생 — 홈 (오늘 진도·숙제 · 보스 HP · 채점 시작 버튼)
  ===================================================================== */
  function renderStudentHome() {
    const cid = view.classId, sid = view.studentId;
    const c = store.getClass(cid), me = store.student(cid, sid);
    const l = store.lesson(cid);
    const tiles = store.tiles(cid);
    const st = store.stats(cid, sid);
    const lv = store.level(cid, sid);
    const boss = store.boss(cid);
    const streak = store.streak(cid, sid);
    const sub = store.submission(cid, sid);
    const carried = store.carriedMisconceptions(cid, sid);

    const lessonHtml = l ? `
      <div class="card lesson-card">
        <div class="card-hd"><span class="t">📖 오늘 진도 &amp; 숙제</span><span class="grow"></span><span class="pill info">시트에서 자동</span></div>
        <div class="ln"><div class="k">진도</div><div class="v">${esc(l.lesson)}</div></div>
        <div class="ln"><div class="k">숙제</div><div class="v">${esc(l.homework)}</div></div>
        <div class="hw-range">
          <span class="pg">${l.pages.length > 1 ? l.pages[0] + '~' + l.pages[l.pages.length - 1] : l.pages[0]}쪽 · ${tiles.length}문제</span>
          <span class="tx">${esc(l.due)}</span>
        </div>
      </div>` : `<div class="card"><div class="muted">오늘 숙제가 아직 올라오지 않았어요.<br>선생님이 시트에 적으면 바로 나타나요.</div></div>`;

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

    return `<div class="screen">
      ${topbar({
        title: '오늘 숙제',
        sub: `${esc(c.name)} · ${EMA.ui.kdate(store.state.today)} ${EMA.ui.kdow(store.state.today)}`,
        right: `${avatarHtml(me, 34)}`
      })}
      <div class="hello">
        <div class="who">${esc(me.nickname || me.name)} <span class="lv">Lv.${lv.lv}</span></div>
        <div class="chips">
          <span class="chip streak">🔥 ${streak}일</span>
          <span class="chip xp">✨ ${st.xp} XP</span>
          <span class="chip coin">🪙 ${me.coins}</span>
        </div>
      </div>

      ${lessonHtml}

      <div class="boss">
        <div class="hd">
          <div class="boss-em">👾</div>
          <div class="grow">
            <div class="nm">🐙 숙제 찢어먹는 대왕 문어</div>
            <div class="taunt">${BOSS_TAUNTS[new Date(store.state.today + 'T12:00:00').getDay() % BOSS_TAUNTS.length]}</div>
          </div>
          <div class="hpn">${boss.hp}<span>%</span></div>
        </div>
        <div class="hpbar"><div class="fill" style="width:${boss.hp}%"></div></div>
        <div class="hplb"><span>보스 HP ${boss.hp}%</span><span>도장 ${boss.stamped}/${boss.total} · 오답 처치 ${boss.fixed}</span></div>
      </div>

      <div class="cta-wrap">
        <button class="btn btn-primary btn-block btn-xl" data-act="startGrade">${cta}</button>
        <div class="cta-sub">${ctaSub}</div>
      </div>

      ${st.marked ? `<div class="card tight sumcard">
        <div class="sumline">
          <span class="sm o">⭕ 맞음 ${st.c1}</span>
          <span class="sm x">❌ 틀림 ${st.c2 + st.c4}</span>
          <span class="sm f">⚔️ 고침 ${st.c3}</span>
          <span class="sm q">⭐ 질문 ${st.c4}</span>
          <span class="sm c">⏭️ 이월 ${st.c5}</span>
        </div>
        ${st.c5 ? `<div class="muted" style="margin-top:8px">안 누른 ${st.c5}문제는 <b>내일 숙제</b>로 넘어가요. 감점 없어요.</div>` : ''}
      </div>` : ''}

      ${sub ? `<div class="card tight">
        <div class="card-hd"><span class="t">📸 낸 사진</span><span class="grow"></span>
          ${sub.stampAt ? `<span class="pill ok">✅ 도장 ${esc(sub.stampAt)}</span>` : sub.status === 'resubmit' ? `<span class="pill bad">재제출 요청</span>` : `<span class="pill warn">🕒 도장 대기 · ${esc(sub.at)}</span>`}
        </div>
        ${store.photo(sub.photoId) ? `<div class="photo-preview"><img src="${store.photo(sub.photoId).data}" alt="제출한 사진"><div class="lock">🔒 낸 사진은 지울 수 없어요</div></div>` : ''}
        <div class="row" style="margin-top:10px">
          <button class="btn btn-ghost grow" data-act="gallery">👀 친구들 풀이</button>
          ${sub.status === 'resubmit' ? `<button class="btn btn-primary grow" data-act="startGrade">다시 찍어 제출</button>` : ''}
        </div>
      </div>` : ''}

      ${carried.length ? `<div class="card tight">
        <div class="card-hd"><span class="t">👾 지난번에 틀린 문제 ${carried.length}개</span><span class="grow"></span><span class="pill warn">고칠 때까지</span></div>
        <div class="muted">${carried.map(m => '· ' + esc(m.label) + ' (' + esc(m.date.slice(5)) + ')').join('<br>')}</div>
        <button class="btn btn-mint btn-block" style="margin-top:10px" data-act="carry">지금 오답 잡으러 가기 ⚔️</button>
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

  function sheetHtml() {
    if (view.sheet === 'gallery') return sheetGallery();
    if (view.sheet === 'carry') return sheetCarry();
    if (view.sheet === 'onboard') return sheetOnboard();
    if (view.sheet === 'pinchange') return sheetPinChange();
    if (view.sheet === 'profile') return sheetProfile();
    return '';
  }

  /* =====================================================================
     ① 채점 — 문제마다 [⭕ 맞음] [❌ 틀림] 두 버튼
  ===================================================================== */
  function flowGrade() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid);
    const l = store.lesson(cid) || {};
    const tiles = store.tiles(cid);
    const g = store.grade(cid, sid);
    const st = store.stats(cid, sid);

    let rows = '', lastPage = null;
    tiles.forEach(t => {
      if (t.page !== lastPage) {
        rows += `<div class="pgroup">${t.page}쪽${t.type && t.type !== '표없음' ? ' · ' + esc(t.type) : ''}</div>`;
        lastPage = t.page;
      }
      const m = g.marks[t.key] || '';
      rows += `<div class="ox-row ${t.missing ? 'is-missing' : ''}">
        <div class="ox-label">${esc(t.label)}<span>번</span></div>
        <button class="ox o ${m === 'o' ? 'on' : ''}" data-act="mark" data-key="${t.key}" data-m="o" ${t.missing ? 'disabled' : ''}>⭕ 맞음</button>
        <button class="ox x ${m === 'x' ? 'on' : ''}" data-act="mark" data-key="${t.key}" data-m="x" ${t.missing ? 'disabled' : ''}>❌ 틀림</button>
      </div>`;
    });

    return `<div class="screen flow">
      ${topbar({
        title: '① 채점',
        sub: `${esc(l.book || '오늘 숙제')} · ${tiles.length}문제`,
        back: true, backAct: 'flowBack',
        right: avatarHtml(me, 32)
      })}
      ${stepper(1)}
      <div class="hintbar">맞은 문제는 <b>⭕ 맞음</b>, 틀린 문제는 <b>❌ 틀림</b>을 눌러요.<br><b>안 푼 문제는 그냥 두기</b> — 내일 숙제로 넘어가요.</div>
      ${oxSum(st)}
      <div class="card oxcard">
        <button class="btn btn-mint btn-block" data-act="markAll">⭕ 모두 맞음 (전부 다 풀었을 때 한 번에)</button>
        <div class="rows">${rows}</div>
      </div>
      <div class="flowfoot">
        <button class="btn btn-primary btn-block btn-lg" data-act="toClean">다음 → 정리 · 사진</button>
        <div class="foot-note">누른 건 자동으로 저장돼요 · 나가도 그대로예요</div>
      </div>
    </div>`;
  }

  /* =====================================================================
     ② 정리 · 사진 — ⚔️ 고쳤어요 / ⭐ 또 틀림·질문 · 미풀이는 자동 이월
  ===================================================================== */
  function flowClean() {
    const cid = view.classId, sid = view.studentId;
    const tiles = store.tiles(cid);
    const g = store.grade(cid, sid);
    const st = store.stats(cid, sid);
    const sub = store.submission(cid, sid);
    const existingPhoto = sub ? store.photo(sub.photoId) : null;
    const locked = !!(sub && existingPhoto && sub.status !== 'resubmit');

    const wrong = tiles.filter(t => g.marks[t.key] === 'x');
    const rest = tiles.filter(t => !g.marks[t.key]);

    const wrongHtml = wrong.length ? wrong.map(t => {
      const cl = g.cleanup[t.key] || '';
      return `<div class="clean-row">
        <div class="cl-label">${t.page}쪽 <b>${esc(t.label)}</b>번</div>
        <div class="cl-btns">
          <button class="clb fix ${cl === 'fixed' ? 'on' : ''}" data-act="cleanup" data-key="${t.key}" data-k="fixed">⚔️ 고쳤어요</button>
          <button class="clb star ${cl === 'star' ? 'on' : ''}" data-act="cleanup" data-key="${t.key}" data-k="star">⭐ 또 틀림·질문</button>
        </div>
        <div class="cl-note">${cl === 'fixed' ? '몬스터 처치! 보스한테 데미지 ⚔️' : cl === 'star' ? '선생님 질문 목록에 올라가요 ⭐' : '안 고르면 ⭐ 또 틀림으로 올라가요'}</div>
      </div>`;
    }).join('') : `<div class="empty-note">🎉 틀린 문제가 하나도 없어요!</div>`;

    const photoArea = locked
      ? `<div class="photo-preview"><img src="${existingPhoto.data}" alt="제출한 사진"><div class="lock">🔒 이미 낸 사진이에요 (바꾸려면 선생님께 재제출 요청)</div></div>`
      : (view.pending.photo || existingPhoto)
        ? `<div class="photo-preview"><img src="${view.pending.photo || existingPhoto.data}" alt="제출 사진"><div class="lock">🔒 제출하면 지울 수 없어요</div></div>
           <button class="btn btn-ghost btn-sm" style="margin-top:8px" data-act="photoPick">사진 다시 고르기</button>`
        : `<button class="photo-drop" data-act="photoPick">
            <div class="em">📷</div>
            <div class="t">사진 찍기 / 앨범에서 고르기</div>
            <div class="s">문제집을 펴 놓고 찍으면 선생님이 1초에 확인해요.</div>
          </button>`;

    return `<div class="screen flow">
      ${topbar({ title: '② 정리 · 사진', sub: '고친 문제와 물어볼 문제를 골라요', back: true, backAct: 'flowBack' })}
      ${stepper(2)}
      <button class="backbig" data-act="flowBack">← 뒤로 (채점 고치기)</button>

      <div class="sect-t"><span>❌ 틀린 문제 ${wrong.length}개</span><span class="grow"></span><span class="hint">둘 중 하나만</span></div>
      <div class="card clean-card">${wrongHtml}</div>

      <div class="sect-t"><span>⏭️ 안 누른 문제 ${rest.length}개</span><span class="grow"></span><span class="hint">내일 이월</span></div>
      <div class="card tight carry-card">
        ${rest.length
          ? `<div class="carry-list">${rest.map(t => `<span class="cchip">${t.page}쪽 ${esc(t.label)}번</span>`).join('')}</div>
             <div class="muted" style="margin-top:9px">이 문제들은 감점 없이 <b>내일 숙제</b>로 넘어가요.</div>
             <button class="btn btn-ghost btn-block" style="margin-top:10px" data-act="flowBack">채점 화면에서 다시 누르기</button>`
          : `<div class="muted">모든 문제를 ⭕/❌로 표시했어요. 완벽해요! 🎉</div>`}
      </div>

      <div class="sect-t"><span>📸 오늘 푼 사진</span><span class="grow"></span><span class="hint">${locked ? '제출 완료' : '한 장 필수'}</span></div>
      <div class="card tight">${photoArea}
        ${locked ? '<div class="muted" style="margin-top:8px">채점만 고쳐서 다시 저장할 수 있어요.</div>' : ''}
      </div>

      <div class="flowfoot">
        <button class="btn btn-primary btn-block btn-lg" data-act="submit">${locked ? '✅ 고친 채점 저장하기' : '📸 사진 올리고 제출 완료'}</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="flowBack">← 뒤로 (채점 고치기)</button>
      </div>
      <input type="file" id="photoInput" accept="image/*" capture="environment" class="hidden">
    </div>`;
  }

  /* =====================================================================
     ③ 제출 완료
  ===================================================================== */
  function flowDone() {
    const cid = view.classId, sid = view.studentId;
    const st = store.stats(cid, sid);
    const sub = store.submission(cid, sid);
    const title = todayTitle(st);
    const boss = store.boss(cid);
    return `<div class="screen flow">
      ${topbar({ title: '③ 제출 완료', sub: sub ? '제출 ' + esc(sub.at) : '', back: true, backAct: 'flowBack' })}
      ${stepper(3)}
      <div class="done-hero">
        <div class="em">🎉</div>
        <div class="t">제출 완료!</div>
        <div class="title-chip">오늘의 칭호 · ${esc(title)}</div>
        <div class="sub">선생님이 사진을 보고 도장을 찍으면 최종 확정돼요.</div>
      </div>
      <div class="card">
        <div class="sumline">
          <span class="sm o">⭕ 맞음 ${st.c1}</span>
          <span class="sm x">❌ 틀림 ${st.c2 + st.c4}</span>
          <span class="sm f">⚔️ 고침 ${st.c3}</span>
          <span class="sm q">⭐ 질문 ${st.c4}</span>
          <span class="sm c">⏭️ 이월 ${st.c5}</span>
        </div>
        <div class="divider"></div>
        <div class="kv"><span class="k">👾 보스</span><span>${boss.hp}% 남음 ${boss.left === 0 ? '· 클리어! 🎉' : '· 우리 반 화이팅!'}</span></div>
        <div class="kv"><span class="k">✨ 오늘 XP</span><span>+${st.xp} XP</span></div>
      </div>
      <div class="cta-wrap">
        <button class="btn btn-primary btn-block btn-lg" data-act="goHome">🏠 홈으로</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="gallery">👀 친구들 풀이 보기</button>
        <button class="backbig" style="margin-top:14px" data-act="flowBack">← 뒤로 (채점 고치기)</button>
        <div class="foot-note">선생님 도장 전에는 채점을 고쳐도 돼요</div>
      </div>
    </div>`;
  }

  /* =====================================================================
     학생 — 내 기록 / 랭킹 / 내 정보
  ===================================================================== */
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

    return `<div class="screen">
      ${topbar({ title: '내 기록', sub: esc(c.name), right: `<span class="chip xp">✨ ${store.totalXP(cid, sid)} XP</span>` })}
      <div class="card">
        <div class="avatarbox">
          <div class="avatar-big" data-act="editProfile">${esc(me.avatar || '🙂')}</div>
          <div class="grow">
            <div style="font-size:19px;font-weight:900;letter-spacing:-.4px">${esc(me.nickname || me.name)} <span class="pill">${esc(me.name)}</span></div>
            <div style="margin:5px 0"><span class="title-chip">${esc(todayTitle(st))}</span></div>
            <div class="muted" style="margin-top:2px">Lv.${lv.lv} · ${lv.into}/100 XP</div>
            <div class="lvlbar"><div class="f" style="width:${lv.into}%"></div></div>
          </div>
        </div>
      </div>
      <div class="pad"><div class="stat-grid">
        <div class="stat"><div class="v">🔥 ${streak}</div><div class="l">연속 불꽃</div></div>
        <div class="stat"><div class="v">👾 ${caught}</div><div class="l">잡은 오답</div></div>
        <div class="stat"><div class="v">${joined}일</div><div class="l">이번 달 참여</div></div>
      </div></div>
      <div class="sect-t" style="margin-top:12px"><span>👾 오답 몬스터 도감</span><span class="grow"></span><span class="hint">${caught}/${mons.length} 포획</span></div>
      <div class="card">
        <div class="monsters">
          ${mons.slice(0, 8).map(m => { const mn = monName(m.label); return `<div class="monster ${m.captured ? 'caught' : ''}"><div class="em">${m.captured ? mn.em : '🥚'}</div><div class="lb">${esc(m.label)}</div><div class="mon-name">${m.captured ? mn.name : '아직 알 속'}</div></div>`; }).join('')}
        </div>
        ${mons.length === 0 ? '<div class="muted">아직 몬스터가 없어요. 틀린 문제가 생기면 여기로 와요.</div>' : ''}
      </div>
      <div class="sect-t"><span>🔥 불꽃 달력</span><span class="grow"></span><span class="hint">${ym.slice(0, 4)}년 ${parseInt(ym.slice(5), 10)}월</span></div>
      <div class="card">
        <div class="cal">
          ${['일', '월', '화', '수', '목', '금', '토'].map(d => `<div class="wd">${d}</div>`).join('')}
          ${cells.map(c2 => c2.empty ? '<div class="cell empty"></div>' :
            `<div class="cell ${c2.flame ? 'done' : ''} ${c2.today ? 'today' : ''}">${c2.day}${c2.flame ? '<span class="fl">🔥</span>' : ''}</div>`).join('')}
        </div>
        <div class="muted" style="margin-top:8px">하루 3문제 이상 풀면 불꽃이 켜져요. 한 문제라도 매일 책을 펴는 게 목표!</div>
      </div>
      ${exams.length ? `<div class="sect-t"><span>📝 단원평가</span></div>
      <div class="card tight">
        ${exams.map(e => {
          const retest = e.score != null && e.retestLine && e.score < e.retestLine;
          return `<div class="kv"><span class="k">${esc(e.unit)} · ${esc(e.date.slice(5))}</span>
            <span>${e.score != null ? e.score + '/' + e.full : '—'} ${retest ? '<span class="pill bad">재시 대상</span>' : (e.score != null ? '<span class="pill ok">통과</span>' : '')}</span></div>`;
        }).join('')}
        <div class="muted" style="margin-top:8px">재시는 학원에서 실제 시험으로 봐요. 앱에는 결과만 남겨요.</div>
      </div>` : ''}
      ${nav([
        { id: 'home', em: '🔥', label: '오늘 숙제' },
        { id: 'record', em: '👾', label: '내 기록' },
        { id: 'rank', em: '🏆', label: '랭킹' },
        { id: 'me', em: '⚙️', label: '내 정보' }
      ], view.tab)}
    </div>`;
  }

  function renderRank() {
    const cid = view.classId, sid = view.studentId;
    const c = store.getClass(cid);
    const rows = view.rankScope === 'class' ? store.ranking(cid, view.rankMode) : store.gradeRanking(view.rankMode);
    const boss = store.boss(cid);
    return `<div class="screen">
      ${topbar({ title: '랭킹', sub: esc(c.name) + ' · ' + EMA.ui.kdate(store.state.today), right: '<span class="chip streak">🔥</span>' })}
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
          : `<div class="muted">아직 오늘 기록이 없어요. 첫 번째 주자가 되어 보세요!</div>`}
      </div>
      <div class="card tight">
        <div class="card-hd"><span class="t">👾 우리 반 보스전</span><span class="grow"></span><span class="pill ${boss.left === 0 ? 'ok' : 'warn'}">${boss.left === 0 ? '클리어!' : '남은 ' + boss.left + '명'}</span></div>
        <div class="hpbar" style="background:#F1ECE6"><div class="fill" style="width:${boss.hp}%"></div></div>
        <div class="muted" style="margin-top:8px">보스 HP ${boss.hp}% · 도장 ${boss.stamped}/${boss.total} · 오답 처치 ${boss.fixed}</div>
        <div class="divider"></div>
        <div class="muted">랭킹은 <b>닉네임</b>으로만 보여요. 인원이 8명 이상이면 하위 3명은 순위에 올리지 않아요(상처 방지).</div>
      </div>
      ${nav([
        { id: 'home', em: '🔥', label: '오늘 숙제' },
        { id: 'record', em: '👾', label: '내 기록' },
        { id: 'rank', em: '🏆', label: '랭킹' },
        { id: 'me', em: '⚙️', label: '내 정보' }
      ], view.tab)}
    </div>`;
  }

  function renderMe() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid), c = store.getClass(cid);
    const lv = store.level(cid, sid), streak = store.streak(cid, sid);
    const skills = [
      { em: '🔥', n: '불꽃 방패', d: '연속 불꽃이 하루 끊겨도 지켜 줌', on: streak >= 5 },
      { em: '⚡', n: '오답 사냥꾼', d: '오답 고칠 때 XP 2배', on: lv.lv >= 3 },
      { em: '⚔️', n: '우리 반 필살기', d: '보스전 데미지 +20%', on: store.boss(cid).left === 0 },
      { em: '💰', n: '코인 2배 부스터', d: '일정 시간 코인 2배', on: lv.lv >= 5 }
    ];
    return `<div class="screen">
      ${topbar({ title: '내 정보', sub: esc(me.name) + ' · ' + esc(c.name), right: avatarHtml(me, 32) })}
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
      <div class="sect-t"><span>⚔️ 성장 스킬</span><span class="grow"></span><span class="hint">보스전·미션으로 해금</span></div>
      <div class="card tight">
        ${skills.map(s => `<div class="kv"><span class="k">${s.em} ${esc(s.n)}<br><span style="font-size:11px">${esc(s.d)}</span></span>
          <span>${s.on ? '<span class="pill ok">해금</span>' : '<span class="pill">잠김</span>'}</span></div>`).join('')}
      </div>
      <div class="card tight">
        <div class="kv"><span class="k">🐣 수학 펫</span><span>알 ${Math.min(100, Math.round(store.totalXP(cid, sid) / 10))}% · 꾸준히 풀면 부화!</span></div>
        <div class="lvlbar" style="margin-top:6px"><div class="f" style="width:${Math.min(100, Math.round(store.totalXP(cid, sid) / 10))}%"></div></div>
      </div>
      <div class="card tight">
        <button class="btn btn-ghost btn-block" data-act="teacherEntry">👩‍🏫 선생님 모드</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="logout">로그아웃</button>
        <button class="btn btn-danger btn-block" style="margin-top:8px" data-act="resetDemo">시제품 데이터 초기화</button>
        <div class="muted center" style="margin-top:10px">숙제 대소동(가칭) 시제품 v0.2 · 초등 수학 숙제 게임</div>
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

  /* =====================================================================
     선생님
  ===================================================================== */
  function connBar() {
    if (store.mode === 'api') {
      return `<div class="connbar ok">🟢 <b>관리시트 연동 중</b> · 마지막 불러오기 ${esc(store.lastSync || '방금')}</div>`;
    }
    return `<div class="connbar test">🧪 <b>테스트 모드</b> — 이 기기(브라우저)에만 저장 중 · <b>11/25 시트 연동 예정</b></div>`;
  }

  function renderTeacher() {
    const cid = view.classId || 'c4m2';
    const c = store.getClass(cid);
    const boss = store.boss(cid);
    const tabs = [
      { id: 'today', em: '📋', label: '오늘 현황' },
      { id: 'stamp', em: '✅', label: '도장' },
      { id: 'top5', em: '⭐', label: '질문 TOP5' },
      { id: 'pages', em: '📖', label: '쪽수표' },
      { id: 'students', em: '👥', label: '학생·PIN' }
    ];
    let body = '';
    if (view.teacherTab === 'today') body = teacherToday(c);
    else if (view.teacherTab === 'stamp') body = teacherStamp(c);
    else if (view.teacherTab === 'top5') body = teacherTop5(c);
    else if (view.teacherTab === 'pages') body = teacherPages(c);
    else body = teacherStudents(c);

    return `<div class="screen">
      ${topbar({
        title: '선생님 모드',
        sub: esc(c.name) + ' · ' + EMA.ui.kdate(store.state.today) + ' ' + EMA.ui.kdow(store.state.today),
        right: `<button class="icon-btn" data-act="teacherExit">✕</button>`
      })}
      ${connBar()}
      <div class="pad" style="display:flex;gap:6px;padding-bottom:10px;flex-wrap:wrap">
        <span class="chip">제출 ${boss.submitted}/${boss.total}</span>
        <span class="chip">도장 ${boss.stamped}/${boss.total}</span>
        <span class="chip" style="color:#C53030">보스 HP ${boss.hp}%</span>
      </div>
      <div class="tabs-scroll">
        ${tabs.map(t => `<button class="${view.teacherTab === t.id ? 'on' : ''}" data-act="teacherTab" data-t="${t.id}">${t.em} ${t.label}</button>`).join('')}
      </div>
      ${body}
      ${nav(tabs, view.teacherTab)}
      ${view.sheet === 'lessonEdit' ? sheetLessonEdit(c) : ''}
      ${view.sheet === 'pmpage' ? sheetPmPage(c) : ''}
      ${view.sheet === 'gallery' ? sheetGallery() : ''}
    </div>`;
  }

  function teacherToday(c) {
    const cid = c.id;
    const l = store.lesson(cid);
    const rows = store.classDay(cid);
    return `
      <div class="card lesson-card">
        <div class="card-hd"><span class="t">📖 시트에서 읽은 오늘 수업</span><span class="grow"></span>
          <button class="btn btn-ghost btn-sm" data-act="lessonEdit">쪽수 바꾸기</button></div>
        <div class="ln"><div class="k">진도</div><div class="v">${esc(l.lesson)}</div></div>
        <div class="ln"><div class="k">숙제</div><div class="v">${esc(l.homework)}</div></div>
        <div class="ln"><div class="k">쪽수</div><div class="v">${esc(l.book)} · ${l.pages.length ? l.pages[0] + (l.pages.length > 1 ? '~' + l.pages[l.pages.length - 1] : '') : '-'}쪽 → ${store.tiles(cid).length}문제 타일</div></div>
        <div class="ln"><div class="k">특이사항</div><div class="v" style="font-size:12.5px;font-weight:700">${esc(l.memo || '—')}</div></div>
      </div>
      <div class="card">
        <div class="card-hd"><span class="t">오늘 반 현황</span><span class="grow"></span><span class="s">${rows.filter(r => r.sub).length}명 제출</span></div>
        <table class="tbl compact">
          <tr><th>학생</th><th>맞음</th><th>틀림</th><th>고침</th><th>질문</th><th>이월</th><th>제출</th><th>도장</th></tr>
          ${rows.map(r => `<tr>
            <td class="nm">${esc(r.student.nickname || r.student.name)}<br><span style="font-size:9.5px;color:#9AA3B2">${esc(r.student.name)}</span></td>
            <td class="num" style="color:#0F8F68">${r.c1}</td><td class="num" style="color:#C53030">${r.c2}</td><td class="num" style="color:#1F6FA8">${r.c3}</td>
            <td class="num" style="color:#B4720A">${r.c4}</td><td class="num" style="color:#6B7280">${r.c5}</td>
            <td>${r.sub ? esc(r.sub.at) : '<span class="pill">미제출</span>'}</td>
            <td>${r.sub && r.sub.stampAt ? '<span class="pill ok">' + esc(r.sub.stampAt) + '</span>' : (r.sub ? '<button class="btn btn-primary btn-sm stampbtn" data-act="stamp" data-id="' + r.student.id + '">도장</button>' : '—')}</td>
          </tr>`).join('')}
        </table>
        <div class="muted" style="margin-top:9px">열은 <b>⭕맞음 · ❌틀림 · ⚔️고침 · ⭐질문 · ⏭️이월</b> 순서예요. ⏭️(이월)는 <b>안 눌러서 내일로 넘어간 문제</b>이고, 나머지는 감점 없이 내일 미션으로 이월됩니다.</div>
      </div>
      <div class="card tight">
        <div class="muted">① 수업 시작 10분: <b>질문 TOP 5</b> 확인 → ② 책 넘기며 <b>도장</b> → ③ 수업 후 시트에 진도·숙제 입력(지금 하던 그대로). 앱에 따로 입력하는 일은 없어요.</div>
      </div>
      <div class="card tight">
        <div class="card-hd"><span class="t">${store.mode === 'api' ? '🟢 연결 상태' : '🧪 지금은 테스트 모드예요'}</span></div>
        <div class="muted">${store.mode === 'api'
          ? '관리시트에서 읽은 진도·숙제와 앱 기록이 함께 보입니다.'
          : '관리시트 연동 전이라 <b>이 브라우저에만</b> 기록이 쌓입니다. 오류가 아니라 정상 상태이고, <b>11/25(수) 시트 연동</b> 후에는 선생님이 시트에 적은 진도·숙제가 그대로 내려옵니다.'}</div>
      </div>`;
  }

  function teacherStamp(c) {
    const cid = c.id;
    const rows = store.classDay(cid).filter(r => r.sub);
    const pending = rows.filter(r => r.sub.status === 'submitted');
    return `
      <div class="card tight">
        <div class="muted">사진과 실제 책을 대조하고 <b>도장</b>을 누르면 최종 1등·XP가 확정돼요. 제출만 한 상태는 '임시 1등'이에요.</div>
      </div>
      <div class="sect-t"><span>도장 기다리는 사진 ${pending.length}장</span></div>
      ${pending.length ? `<div class="pad"><div class="stampgrid">
        ${pending.map(r => {
          const ph = store.photo(r.sub.photoId);
          return `<div class="stampcard">
            ${ph ? `<img src="${ph.data}" alt="">` : '<div style="aspect-ratio:3/4;border-radius:10px;background:#F4EFE9"></div>'}
            <div class="nm">${esc(r.student.nickname || r.student.name)} (${esc(r.student.name)})</div>
            <div class="mt">${esc(r.sub.at)} 제출 · ⭕${r.c1} ❌${r.c2 + r.c4} ⚔️${r.c3}</div>
            <div class="row">
              <button class="btn btn-primary btn-sm grow" data-act="stamp" data-id="${r.student.id}">도장 찍기</button>
              <button class="btn btn-ghost btn-sm" data-act="resubmit" data-id="${r.student.id}">재제출</button>
            </div>
          </div>`;
        }).join('')}
      </div></div>` : `<div class="card"><div class="muted">지금 도장을 기다리는 사진이 없어요.</div></div>`}
      <div class="sect-t" style="margin-top:8px"><span>오늘 도장 완료</span></div>
      <div class="card tight">
        ${store.classDay(cid).filter(r => r.sub && r.sub.stampAt).map(r =>
          `<div class="kv"><span class="k">✅ ${esc(r.student.nickname || r.student.name)} (${esc(r.student.name)})</span><span>${esc(r.sub.stampAt)} 도장</span></div>`
        ).join('') || '<div class="muted">아직 도장이 없어요.</div>'}
      </div>`;
  }

  function teacherTop5(c) {
    const cid = c.id;
    const list = store.top5(cid);
    const rows = store.classDay(cid);
    const tiles = store.tiles(cid);
    const nameOf = k => { const t = tiles.find(x => x.key === k); return t ? `${t.page}쪽 ${t.num}번` : k; };
    return `
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
          </div>`).join('') : '<div class="muted">오늘 별표가 없어요.</div>'}
      </div>
      <div class="sect-t"><span>학생별 오답·질문</span></div>
      <div class="card tight">
        ${rows.map(r => {
          const g = store.grade(cid, r.student.id);
          const wrong = tiles.filter(t => g.marks[t.key] === 'x');
          const stars = tiles.filter(t => g.marks[t.key] === 'x' && g.cleanup[t.key] === 'star').map(t => nameOf(t.key));
          return `<div class="kv" style="align-items:flex-start">
            <span class="k">${esc(r.student.nickname || r.student.name)} (${esc(r.student.name)})<br>
              <span style="font-size:11px">❌ ${wrong.length ? wrong.map(t => t.page + '쪽 ' + t.num + '번').join(', ') : '없음'}</span></span>
            <span style="font-size:11px;text-align:right">${stars.length ? '⭐ ' + stars.join('<br>⭐ ') : '<span style="color:#B3A79A">별표 없음</span>'}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  function teacherPages(c) {
    const cid = c.id;
    const books = store.bookList();
    const book = view.pmBook || (store.lesson(cid) || {}).book || books[0];
    view.pmBook = book;
    const pages = store.pagesOfBook(book);
    const l = store.lesson(cid);
    return `
      <div class="tabs-scroll" style="padding-left:0;padding-right:0">
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
        <table class="tbl">
          <tr><th>실명</th><th>닉네임</th><th>PIN</th><th></th></tr>
          ${c.students.map(s => `<tr>
            <td class="nm">${esc(s.name)}</td>
            <td>${esc(s.nickname || '—')}</td>
            <td><span data-pin="${s.id}">${view.pinReveal === s.id ? esc(s.pin) : '••••'}</span>
              <button class="btn btn-ghost btn-sm" data-act="revealPin" data-id="${s.id}">${view.pinReveal === s.id ? '숨기기' : '보기'}</button></td>
            <td style="text-align:right"><button class="btn btn-ghost btn-sm" data-act="regenPin" data-id="${s.id}">재발급</button></td>
          </tr>`).join('')}
        </table>
      </div>
      <div class="card tight">
        <div class="kv"><span class="k">반</span><span>${esc(c.name)} · ${esc(c.semester)} 과정</span></div>
        <div class="kv"><span class="k">수업</span><span>${esc(c.days)} ${esc(c.time)}</span></div>
        <div class="kv"><span class="k">교재</span><span>${esc((c.textbooks || []).join(' · '))}</span></div>
        <div class="kv"><span class="k">개강</span><span>${esc(c.startDate || '—')} · 초6-1</span></div>
      </div>`;
  }

  /* ---------- 시트(모달) ---------- */
  function sheetGallery() {
    const cid = view.classId, sid = view.studentId;
    const c = store.getClass(cid);
    const mine = store.submission(cid, sid);
    const unlocked = !!mine;
    return sheetWrap(`
      <h3>친구들 풀이</h3>
      <div class="sub">🔒 내 사진을 올려야 친구들 사진이 보여요. 먼저 보고 베끼는 걸 막는 규칙이에요.</div>
      <div class="gallery">
        ${c.students.map(s => {
          const sub = store.submission(cid, s.id);
          const ph = sub ? store.photo(sub.photoId) : null;
          const isMe = s.id === sid;
          if (isMe) {
            return `<div class="gitem">${ph ? `<img src="${ph.data}" alt="">` : `<div class="locked" style="aspect-ratio:3/4">📷</div>`}
              <div class="cap">내 사진${sub ? ' · ' + esc(sub.at) : ''}</div></div>`;
          }
          if (!unlocked) return `<div class="gitem locked">🔒</div>`;
          if (!sub || !ph) return `<div class="gitem locked" style="font-size:11px;color:#B3A79A;text-align:center;padding:10px">아직 안 냈어요</div>`;
          const st = store.stats(cid, s.id);
          return `<div class="gitem"><img src="${ph.data}" alt=""><div class="cap">${esc(s.nickname || s.name)} · ⭕${st.c1} ❌${st.c2 + st.c4} ⚔️${st.c3}</div></div>`;
        }).join('')}
      </div>
      <button class="btn btn-ghost btn-block" style="margin-top:14px" data-act="closeSheet">닫기</button>
    `);
  }

  function sheetCarry() {
    const cid = view.classId, sid = view.studentId;
    const list = store.carriedMisconceptions(cid, sid);
    return sheetWrap(`
      <h3>지난번 오답 몬스터</h3>
      <div class="sub">다시 풀어서 고치면 몬스터를 잡고 XP를 받아요. 도저히 모르겠으면 선생님께 물어봐요.</div>
      ${list.map(m => { const mn = monName(m.label); return `<div class="kv"><span class="k">${mn.em} ${esc(mn.name)}<br><span style="font-size:11px">${esc(m.label)} · ${esc(m.date.slice(5))}</span></span>
        <button class="btn btn-mint btn-sm" data-act="captureMonster" data-id="${m.id}">고쳤어요 ⚔️</button></div>`; }).join('')}
      <button class="btn btn-ghost btn-block" style="margin-top:14px" data-act="closeSheet">닫기</button>
    `);
  }

  function sheetOnboard() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid);
    const avs = ['🦊', '🐰', '🐯', '🐼', '🐶', '🐨', '🐻', '🐷', '🐸', '🦄'];
    const chosen = view.pending.avatar || me.avatar || '🦊';
    return sheetWrap(`
      <h3>내 캐릭터 만들기</h3>
      <div class="sub">캐릭터를 고르고 닉네임을 정해요. 랭킹에는 닉네임만 보여요(한글 4글자 이내).</div>
      <div class="avatars">${avs.map(a => `<button class="${a === chosen ? 'on' : ''}" data-act="avatar" data-a="${a}">${a}</button>`).join('')}</div>
      <div style="margin-top:14px">
        <input id="nickInput" placeholder="닉네임 (예: 도연)" maxlength="4" value="${esc(view.pending.nickname || '')}" style="width:100%;font-family:var(--font);font-size:16px;font-weight:800;padding:13px;border-radius:14px;border:2px solid #EDE4DA">
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="saveOnboard">시작하기</button>
    `);
  }

  function sheetProfile() {
    const cid = view.classId, sid = view.studentId;
    const me = store.student(cid, sid);
    const avs = ['🦊', '🐰', '🐯', '🐼', '🐶', '🐨', '🐻', '🐷', '🐸', '🦄'];
    const chosen = view.pending.avatar || me.avatar || '🦊';
    return sheetWrap(`
      <h3>캐릭터 · 닉네임</h3>
      <div class="sub">닉네임은 한글 4글자 이내. 선생님 화면에는 닉네임(실명)으로 함께 보여요.</div>
      <div class="avatars">${avs.map(a => `<button class="${a === chosen ? 'on' : ''}" data-act="avatar" data-a="${a}">${a}</button>`).join('')}</div>
      <div style="margin-top:14px">
        <input id="nickInput" placeholder="닉네임" maxlength="4" value="${esc(view.pending.nickname || me.nickname || '')}" style="width:100%;font-family:var(--font);font-size:16px;font-weight:800;padding:13px;border-radius:14px;border:2px solid #EDE4DA">
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="saveProfile">저장</button>
    `);
  }

  function sheetPinChange() {
    return sheetWrap(`
      <h3>내 PIN 바꾸기</h3>
      <div class="sub">새 PIN 4자리를 입력해요. 친구에게 알려 주지 마세요.</div>
      <input id="newPin" inputmode="numeric" maxlength="4" placeholder="새 PIN 4자리" style="width:100%;font-family:var(--font);font-size:20px;font-weight:800;letter-spacing:6px;padding:13px;border-radius:14px;border:2px solid #EDE4DA;text-align:center">
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="savePin">바꾸기</button>
    `);
  }

  function sheetLessonEdit(c) {
    const l = store.lesson(c.id);
    const books = store.bookList();
    const book = view.lessonEditBook || l.book || books[0];
    const pages = view.lessonEditPages != null ? view.lessonEditPages : l.pages.join(',');
    const list = String(pages).split(/[,\s~]+/).filter(Boolean).map(Number).filter(n => !isNaN(n));
    const tiles = store.tilesFor(book, list);
    return sheetWrap(`
      <h3>이번 숙제 쪽수 바꾸기</h3>
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
    return sheetWrap(`
      <h3>${esc(view.pmBook)} ${view.pmPage}쪽 문제번호</h3>
      <div class="sub">이 쪽에 있는 문제 번호를 쉼표로 적어요. 예: <b>1, 2, 2-1, 3, 4</b> (2-1은 2번의 (1) 같은 하위 문제)</div>
      <div class="editor"><input id="pmInput" value="${esc(view.pmInput)}" placeholder="1, 2, 2-1, 3"></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="pmSave">저장</button>
    `);
  }

  /* =====================================================================
     렌더 진입
  ===================================================================== */
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
    if (view.sheet === 'onboard' || view.sheet === 'profile' || view.sheet === 'pmpage' || view.sheet === 'lessonEdit') {
      const inp = app.querySelector('#nickInput, #pmInput, #pageInput');
      if (inp) inp.addEventListener('input', () => {
        if (inp.id === 'nickInput') view.pending.nickname = inp.value;
        if (inp.id === 'pmInput') view.pmInput = inp.value;
        if (inp.id === 'pageInput') { view.lessonEditPages = inp.value; }
      });
    }
    const fileInput = app.querySelector('#photoInput');
    if (fileInput) fileInput.addEventListener('change', onPhotoChosen);
  }

  function afterLoginStudent(classId, studentId) {
    view.role = 'student'; view.classId = classId; view.studentId = studentId;
    view.tab = 'home'; view.flow = null; view.sheet = null;
    store.setSession({ role: 'student', classId, studentId });
    const s = store.student(classId, studentId);
    if (!s.nickname) { view.sheet = 'onboard'; clearDraft(); }
    else {
      // 다시 열었을 때: 하던 단계가 있으면 그 자리로 (누른 ⭕/❌ 는 저장소에 그대로)
      const d = readDraft();
      if (d && d.classId === classId && d.studentId === studentId && d.flow) {
        view.flow = d.flow;
        if (d.tab) view.tab = d.tab;
        view.pending.photo = readDraftPhoto();
      }
    }
    render();
    if (view.flow) EMA.ui.toast('하던 곳에서 이어서 시작해요 👋');
  }

  /* =====================================================================
     동작
  ===================================================================== */
  async function onPhotoChosen(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const data = await EMA.ui.compress(f, 900, 0.62);
      view.pending.photo = data;
      saveDraft();
      EMA.ui.toast('사진 준비 완료! 제출을 눌러 주세요');
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
        EMA.ui.toast('선생님 모드로 들어왔어요');
        render();
        return;
      }
      EMA.ui.toast('선생님 PIN이 달라요');
    } else {
      const s = store.student(view.classId, view.studentId);
      if (s && s.pin === view.pin) { afterLoginStudent(view.classId, view.studentId); return; }
      EMA.ui.toast('PIN이 달라요. 선생님께 물어보세요!');
    }
    view.pin = '';
    render();
  }

  function setFlow(f) { view.flow = f; saveDraft(); render(); }

  const actions = {
    class(d) {
      const c = store.getClass(d.id);
      if (!c || !c.active) return;
      view.classId = d.id; view.step = 'student'; view.resetScroll = true; render();
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
      view.studentId = d.id; view.step = 'pin'; view.pin = ''; view.pinTarget = 'student'; view.resetScroll = true; render();
    },
    pinKey(d) {
      if (view.pin.length >= 4) return;
      view.pin += d.k;
      if (view.pin.length === 4) { render(); setTimeout(currentPinVerify, 120); return; }
      render();
    },
    pinDel() { view.pin = view.pin.slice(0, -1); render(); },
    pinBack() { view.pin = ''; render(); },
    teacherEntry() {
      view.pinTarget = 'teacher'; view.step = 'teacherPin'; view.pin = '';
      if (view.role !== 'login') { view.role = 'login'; }
      view.resetScroll = true; render();
    },
    teacherExit() {
      view.role = 'login'; view.step = 'class'; view.pin = ''; view.pinTarget = 'student';
      store.setSession(null); view.resetScroll = true; render();
    },
    tab(d) { view.tab = d.tab; view.sheet = null; view.flow = null; saveDraft(); view.resetScroll = true; render(); },
    teacherTab(d) { view.teacherTab = d.t; view.sheet = null; view.resetScroll = true; render(); },

    /* ---- 3단계 동선 ---- */
    startGrade() { view.resetScroll = true; setFlow('grade'); },
    mark(d, el) {
      const cur = store.markOf(view.classId, view.studentId, d.key);
      const next = cur === d.m ? '' : d.m;
      store.setMark(view.classId, view.studentId, d.key, next);
      EMA.ui.haptic();
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
      store.markAllCorrect(view.classId, view.studentId);
      EMA.ui.haptic();
      EMA.ui.toast('모두 ⭕로 표시했어요! 틀린 문제만 ❌를 눌러 주세요');
      render();
    },
    toClean() {
      const st = store.stats(view.classId, view.studentId);
      if (!st.marked) { EMA.ui.toast('먼저 맞은 문제 ⭕, 틀린 문제 ❌를 눌러 주세요'); return; }
      if (st.c5 > 0 && !view.askedCarry) {
        EMA.ui.toast(`${st.c5}문제는 안 누른 채로 내일 넘어가요`, 2600);
      }
      view.resetScroll = true;
      setFlow('clean');
    },
    cleanup(d, el) {
      store.setCleanup(view.classId, view.studentId, d.key, d.k);
      EMA.ui.haptic();
      render();
      const t = document.querySelector('.clb[data-key="' + d.key + '"][data-k="' + d.k + '"]');
      if (t && store.cleanupOf(view.classId, view.studentId, d.key) === d.k) {
        if (d.k === 'fixed') EMA.ui.fx.hit(t, '+250 DMG! ⚔️', 'crit');
        EMA.ui.fx.bounce(t);
        if (d.k === 'fixed') EMA.ui.fx.shake('.boss');
      }
    },
    flowBack() {
      if (view.flow === 'done') { view.resetScroll = true; setFlow('clean'); }
      else if (view.flow === 'clean') { view.resetScroll = true; setFlow('grade'); }
      else { view.flow = null; view.sheet = null; saveDraft(); view.resetScroll = true; render(); }
    },
    goHome() { view.flow = null; view.tab = 'home'; view.sheet = null; saveDraft(); view.resetScroll = true; render(); },
    photoPick() {
      const inp = document.querySelector('#photoInput');
      if (inp) inp.click();
      else EMA.ui.toast('사진 버튼을 다시 눌러 주세요');
    },
    async submit() {
      const cid = view.classId, sid = view.studentId;
      const sub = store.submission(cid, sid);
      const existingPhoto = sub ? store.photo(sub.photoId) : null;
      const locked = !!(sub && existingPhoto && sub.status !== 'resubmit');
      if (!locked) {
        if (!view.pending.photo && !existingPhoto) { EMA.ui.toast('사진을 먼저 올려 주세요 📷'); return; }
        if (view.pending.photo) await store.submitPhoto(cid, sid, view.pending.photo);
        else if (sub) await store.touchSubmission(cid, sid);
      }
      view.pending.photo = null; view.sheet = null;
      view.resetScroll = true;
      setFlow('done');
      EMA.ui.fx.confetti(70);
      EMA.ui.toast('🎉 제출 완료! 오늘의 칭호: ' + todayTitle(store.stats(cid, sid)));
    },
    gallery() { view.sheet = 'gallery'; render(); },
    closeSheet() { view.sheet = null; render(); },
    carry() { view.sheet = 'carry'; render(); },
    captureMonster(d) {
      if (store.captureMonster) store.captureMonster(view.studentId, d.id);
      EMA.ui.toast('몬스터를 잡았어요! ⚔️ +10 XP');
      render();
    },
    editProfile() { view.pending = { photo: view.pending.photo, avatar: null, nickname: '' }; view.sheet = 'profile'; render(); },
    avatar(d) { view.pending.avatar = d.a; render(); },
    saveProfile() {
      const nick = (document.querySelector('#nickInput') || {}).value || '';
      if (nick && !/^[가-힣]{1,4}$/.test(nick)) { EMA.ui.toast('닉네임은 한글 4글자 이내로 정해 주세요'); return; }
      store.saveProfile(view.classId, view.studentId, {
        avatar: view.pending.avatar || store.student(view.classId, view.studentId).avatar,
        nickname: nick || store.student(view.classId, view.studentId).nickname
      });
      view.sheet = null; EMA.ui.toast('저장했어요');
      render();
    },
    saveOnboard() {
      const nick = (document.querySelector('#nickInput') || {}).value || '';
      if (!/^[가-힣]{1,4}$/.test(nick)) { EMA.ui.toast('닉네임은 한글 1~4글자로 정해 주세요 (예: 도연)'); return; }
      store.saveProfile(view.classId, view.studentId, { avatar: view.pending.avatar || '🦊', nickname: nick });
      view.pending = { photo: null, avatar: null, nickname: '' };
      view.sheet = null; view.flow = null;
      saveDraft();
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
      store.setSession(null);
      clearDraft();
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
    async stamp(d) {
      await store.stamp(view.classId, d.id);
      render();
      EMA.ui.fx.confetti(40);
      EMA.ui.toast('도장 완료! 최종 1등·XP 확정 ✅');
    },
    async resubmit(d) {
      await store.requestResubmit(view.classId, d.id);
      EMA.ui.toast('재제출을 요청했어요');
      render();
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
    pmDownload() {
      const txt = JSON.stringify(store.pageMaps(), null, 1);
      EMA.ui.download('page-maps.json', txt);
    },
    async pmCopy() {
      const txt = JSON.stringify(store.pageMaps(), null, 1);
      try { await navigator.clipboard.writeText(txt); EMA.ui.toast('쪽수표 JSON을 복사했어요'); }
      catch (e) { EMA.ui.toast('복사가 안 되면 내려받기를 써 주세요'); }
    },
    lessonEdit() {
      const l = store.lesson(view.classId);
      view.lessonEditBook = l.book;
      view.lessonEditPages = l.pages.join(',');
      view.sheet = 'lessonEdit'; render();
    },
    lessonBook(d) { view.lessonEditBook = d.b; render(); },
    saveLesson() {
      const l = store.lesson(view.classId);
      const raw = view.lessonEditPages || l.pages.join(',');
      let pages = [];
      String(raw).split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
        const m = part.match(/^(\d+)\s*[~-]\s*(\d+)$/);
        if (m) { const a = +m[1], b = +m[2]; for (let i = Math.min(a, b); i <= Math.max(a, b); i++) pages.push(i); }
        else if (/^\d+$/.test(part)) pages.push(+part);
      });
      if (!pages.length) { EMA.ui.toast('쪽수를 숫자로 적어 주세요 (예: 8~10)'); return; }
      const book = view.lessonEditBook || l.book;
      const tiles = store.tilesFor(book, pages);
      store.saveLesson(view.classId, {
        book, pages,
        homework: book + ' ' + (pages.length > 1 ? pages[0] + '~' + pages[pages.length - 1] : pages[0]) + '쪽'
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

  /* =====================================================================
     부팅
  ===================================================================== */
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
        <div class="card"><b>기록을 불러오지 못했어요.</b><div class="muted">${esc(err.message)}<br>학생 기록은 기기에 저장돼 있으니, 새로고침하면 이어집니다. (${
        store.mode === 'api' ? '시트 연결 확인 필요' : '테스트 모드'})</div></div></div>`;
      return;
    }
    // 예시 제출 사진 만들기 (한 번만)
    const cid = 'c4m2';
    const lesson = store.lesson(cid) || { book: '6-1 발전책' };
    store.classDay(cid).forEach(r => {
      if (r.sub && r.sub.photoId && !store.photo(r.sub.photoId)) {
        const data = EMA.ui.fakePhoto(r.student.name, lesson.book);
        store.putPhoto(r.sub.photoId, data, r.student.id);
      }
    });

    const s = store.session();
    if (s && s.role === 'student' && store.student(s.classId, s.studentId)) {
      view.role = 'student'; view.classId = s.classId; view.studentId = s.studentId;
      view.pmBook = (store.lesson(s.classId) || {}).book || null;
      const d = readDraft();
      if (d && d.classId === s.classId && d.studentId === s.studentId) {
        if (d.flow) view.flow = d.flow;
        if (d.tab) view.tab = d.tab;
        view.pending.photo = readDraftPhoto();
      }
    } else if (s && s.role === 'teacher') {
      view.role = 'teacher'; view.classId = s.classId || 'c4m2'; view.teacherTab = 'today';
      view.pmBook = (store.lesson(view.classId) || {}).book || null;
    } else {
      view.role = 'login';
    }
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
