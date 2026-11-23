/* v2.3 — 3D 캐릭터 20종 · 악당 6종 사전
   ─────────────────────────────────────────────────────────
   · assets/avatars/01_fox.png … 20_octopus.png  (192×192 투명 PNG)
   · assets/villains/boss_01…03 · minion_01…03   (224×224 투명 PNG)
   여기만 고치면 홈 배너·랭킹·선생님 화면·축하 팝업·빈 화면 응원이
   모두 같은 캐릭터로 바뀝니다.
*/
window.EMA_CHARS = (function () {
  const BASE = 'assets/avatars/';
  const VBASE = 'assets/villains/';

  /* 우리 편 20마리 — 이름 · 별명 · 응원 대사 3개 */
  const avatars = [
    { id: '01_fox', name: '로켓 여우', nick: '루비', em: '🦊',
      cheers: ['여우처럼 빠르게, 한 문제 더!', '루비가 옆에서 응원할게!', '오늘도 로켓처럼 슝!'] },
    { id: '02_dragon', name: '아기 드래곤', nick: '파이', em: '🐉',
      cheers: ['파이~ 하고 불꽃처럼 힘내!', '작아도 용감한 드래곤이야!', '한 문제 더 풀면 날개가 자라!'] },
    { id: '03_cat', name: '치즈 고양이', nick: '치즈', em: '🐱',
      cheers: ['치즈처럼 노릇노릇 잘했어!', '냥~ 한 번 더 해 볼까?', '고양이는 실수해도 다시 폴짝!'] },
    { id: '04_rabbit', name: '안경 토끼', nick: '모찌', em: '🐰',
      cheers: ['모찌랑 같이 차근차근 풀어 봐!', '안경 쓴 토끼는 실수를 안 놓쳐!', '폴짝! 한 칸 더 올라가자!'] },
    { id: '05_robot', name: '하트 로봇', nick: '비토', em: '🤖',
      cheers: ['삐빅- 계산 완료! 정확해!', '비토의 심장이 두근두근!', '틀려도 괜찮아, 다시 계산!'] },
    { id: '06_slime', name: '왕관 슬라임', nick: '푸딩', em: '👑',
      cheers: ['말랑말랑해도 포기는 안 해!', '푸딩처럼 흔들려도 괜찮아!', '왕관은 노력한 너의 것!'] },
    { id: '07_lion', name: '아기 사자', nick: '레오', em: '🦁',
      cheers: ['으르렁! 오늘의 주인공은 너야!', '용감한 사자처럼 도전!', '한 번 더 하면 진짜 사자!'] },
    { id: '08_bear', name: '헤드셋 곰', nick: '코코', em: '🐻',
      cheers: ['코코가 리듬 타며 응원 중!', '느려도 꾸준하면 이겨!', '숙제 끝나면 꿀 한 스푼!'] },
    { id: '09_wolf', name: '번개 늑대', nick: '볼트', em: '🐺',
      cheers: ['번개처럼 번쩍! 풀어 보자!', '볼트가 앞장설게, 따라와!', '집중하면 번개가 내려!'] },
    { id: '10_dog', name: '탐정 강아지', nick: '몽이', em: '🐶',
      cheers: ['몽이가 틀린 곳을 찾았어!', '돋보기로 한 번 더 확인!', '수수께끼 같은 문제도 척척!'] },
    { id: '11_panda', name: '대나무 판다', nick: '밤부', em: '🐼',
      cheers: ['대나무처럼 쑥쑥 자라자!', '밤부는 천천히 꾸준히!', '한 문제씩 먹방처럼 정복!'] },
    { id: '12_penguin', name: '고글 펭귄', nick: '핑구', em: '🐧',
      cheers: ['미끄러져도 다시 일어나!', '펭귄은 추운 데서도 공부해!', '뚜벅뚜벅 한 걸음 더!'] },
    { id: '13_chick', name: '알모자 병아리', nick: '삐약', em: '🐣',
      cheers: ['삐약! 알에서 나온 순간부터 최고!', '작은 날개로도 훨훨!', '삐약삐약, 넌 할 수 있어!'] },
    { id: '14_unicorn', name: '무지개 유니콘', nick: '루나', em: '🦄',
      cheers: ['무지개 길을 따라가자!', '루나가 반짝반짝 응원해!', '너의 오늘은 무지개색이야!'] },
    { id: '15_dino', name: '꼬마 티라노', nick: '티노', em: '🦖',
      cheers: ['크앙! 어려운 문제도 한 입에!', '티노도 매일 조금씩 자라!', '실수는 다음엔 안 틀리면 돼!'] },
    { id: '16_fairy', name: '딸기 요정', nick: '베리', em: '🍓',
      cheers: ['딸기 마법으로 힘내!', '베리가 반짝 가루를 뿌렸어!', '달콤한 결과가 기다려!'] },
    { id: '17_star', name: '별똥별', nick: '스타', em: '⭐',
      cheers: ['별처럼 반짝이는 풀이였어!', '스타가 꼬리를 흔들며 응원!', '너는 오늘의 별이야!'] },
    { id: '18_cloud', name: '무지개 구름', nick: '몽실', em: '☁️',
      cheers: ['몽실몽실 구름처럼 가볍게!', '막히면 잠깐 쉬어도 돼!', '구름 위에서 응원할게!'] },
    { id: '19_cactus', name: '꽃 선인장', nick: '가시', em: '🌵',
      cheers: ['가시처럼 단단하게 버텨!', '선인장도 꽃을 피워!', '조금씩 자라면 꼭 꽃이 펴!'] },
    { id: '20_octopus', name: '문어 박사', nick: '타코', em: '🐙',
      cheers: ['여덟 팔로 문제를 척척!', '타코 박사가 검산해 줄게!', '한 번 더 확인하면 완벽!'] }
  ];

  /* 무서운 악당 — 보스 3 + 쫄병 3 */
  const villains = [
    { id: 'boss_01_shadow_king', name: '보랏빛 어둠 마왕', em: '🌑', kind: 'boss',
      line: '오답을 먹고 자라나는 어둠의 왕' },
    { id: 'boss_02_lava_dragon', name: '용암 드래곤', em: '🔥', kind: 'boss',
      line: '계산 실수를 태워 버리는 불꽃' },
    { id: 'boss_03_skull_mech', name: '강철 해골 군주', em: '⚙️', kind: 'boss',
      line: '마감과 게으름을 지키는 강철 병기' },
    { id: 'minion_01_slime', name: '계산 실수 독액 슬라임', em: '🟢', kind: 'minion',
      line: '받아올림을 흘려 버려요' },
    { id: 'minion_02_bat', name: '문제 오독 섀도우 박쥐', em: '🦇', kind: 'minion',
      line: '문제를 대충 읽게 만들어요' },
    { id: 'minion_03_golem', name: '개념 혼돈 얼음 골렘', em: '🧊', kind: 'minion',
      line: '개념을 얼려 버려요' }
  ];

  const byId = {};
  avatars.forEach(a => { byId[a.id] = a; });
  villains.forEach(v => { byId[v.id] = v; });

  function hash(s) {
    s = String(s || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
    return h;
  }

  /** 학생 ID로 자동 배정 — 같은 학생은 늘 같은 캐릭터로 시작합니다 */
  function defaultFor(sid) {
    return avatars[hash('c' + sid) % avatars.length].id;
  }

  /** 학생 객체 → 캐릭터 id (저장값이 이모지여도 자동 배정으로 이어 줌) */
  function idOf(stu) {
    if (!stu) return avatars[0].id;
    const v = stu.avatarId || stu.avatar;
    if (v && byId[v] && byId[v].kind !== 'minion' && v.indexOf('boss_') !== 0) return v;
    return defaultFor(stu.id || stu.name || '');
  }

  function info(id) { return byId[id] || byId[defaultFor('')] || avatars[0]; }

  function art(id) {
    return (String(id).indexOf('boss_') === 0 || String(id).indexOf('minion_') === 0 ? VBASE : BASE) + id + '.png';
  }

  /** <img> 한 장 — 크기·클래스·애니메이션을 그대로 넘깁니다 */
  function img(id, opt) {
    const o = opt || {};
    const it = info(id);
    const size = o.size || 40;
    const cls = ['char-img', o.cls || ''].filter(Boolean).join(' ');
    const style = `width:${size}px;height:${size}px` + (o.style ? ';' + o.style : '');
    return `<img class="${cls}" src="${art(it.id)}" alt="${o.alt != null ? o.alt : it.nick + ' 캐릭터'}"
      width="${size}" height="${size}" style="${style}" loading="lazy" decoding="async">`;
  }

  /* 응원 대사 — 같은 대사가 연달아 나오지 않게 회전 */
  let turn = 0;
  function cheer(id) {
    const it = info(id);
    const lines = it.cheers || ['오늘도 화이팅!'];
    turn = (turn + 1) % lines.length;
    return lines[(turn + hash(it.id)) % lines.length];
  }

  /** 오늘의 응원 친구 — 화면을 다시 그려도 같은 친구가 나오게 날짜+학생으로 고정 */
  function pickFor(sid, ctx) {
    const seed = hash((window.EMA && EMA.store && EMA.store.state ? EMA.store.state.today : '') + '|' + sid + '|' + (ctx || ''));
    return avatars[seed % avatars.length];
  }

  /** 축하 팝업에 함께 나올 친구들 — 내 캐릭터 + 다른 친구 1~2명 */
  function party(myId, n) {
    const mine = info(myId);
    const pool = avatars.filter(a => a.id !== mine.id);
    const out = [{ id: mine.id, line: cheer(mine.id) }];
    let seed = hash('p' + mine.id + turn + (Date.now() % 97));
    for (let i = 0; i < (n == null ? 2 : n) && pool.length; i++) {
      seed = (seed * 37 + 11) % 100003;
      const pick = pool.splice(seed % pool.length, 1)[0];
      out.push({ id: pick.id, line: cheer(pick.id) });
    }
    return out;
  }

  /** 이유별 오답 쫄병 */
  function minionFor(why) {
    return why === 'read' ? 'minion_02_bat' : why === 'concept' ? 'minion_03_golem' : 'minion_01_slime';
  }

  function bossArt(bossId) {
    const m = { shadow: 'boss_01_shadow_king', lava: 'boss_02_lava_dragon', skull: 'boss_03_skull_mech' };
    return m[bossId] || 'boss_01_shadow_king';
  }

  return { avatars, villains, byId, info, art, img, imgUrl: art, cheer, pickFor, party, minionFor,
           bossArt, defaultFor, idOf, hash, list: () => avatars };
})();
