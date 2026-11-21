/* 수학 펫 · 상점 · 보스 · 칭호 사전 (v0.3)
   ─────────────────────────────────────────────────────────
   상점 품목과 펫 도감은 여기만 고치면 앱 전체에 반영됩니다.
   (가격·이름·확률을 학원 사정에 맞게 바꿔 쓰세요)
*/
window.EMA_GAME = {
  /* ---------- 수학 펫 도감 ----------
     rarity: common(일반) | rare(희귀) | legend(전설) */
  pets: [
    { id: 'rootcat',  name: '아기 루트냥',      rarity: 'common', em: '🐱', tag: '√',        line: '루트도 무섭지 않아요!' },
    { id: 'fracho',   name: '분수 햄스터',      rarity: 'common', em: '🐹', tag: '1/2',      line: '볼주머니에 분수를 넣고 다녀요' },
    { id: 'angryong', name: '각도기 용용이',    rarity: 'common', em: '🐲', tag: '∠',        line: '각도만 재면 불을 뿜어요' },
    { id: 'zerofox',  name: '영(0) 여우',       rarity: 'common', em: '🦊', tag: '0',        line: '아무것도 없어도 씩씩해요' },
    { id: 'dotduck',  name: '소수점 오리',      rarity: 'common', em: '🦆', tag: '.',        line: '소수점 하나만 콕!' },
    { id: 'graphbear',name: '그래프 곰',        rarity: 'rare',   em: '🐻', tag: '📊',       line: '막대그래프를 좋아해요' },
    { id: 'primepen', name: '소수(素數) 펭귄',  rarity: 'rare',   em: '🐧', tag: '2·3·5·7',  line: '나눠지지 않는 멋쟁이' },
    { id: 'piowl',    name: '파이 부엉이',      rarity: 'rare',   em: '🦉', tag: 'π',        line: '밤새 원을 그려요' },
    { id: 'areabee',  name: '넓이 꿀벌',        rarity: 'rare',   em: '🐝', tag: 'cm²',      line: '가로×세로로 꿀을 모아요' },
    { id: 'pythcat',  name: '전설 피타고라스 냥이', rarity: 'legend', em: '🐈', tag: 'a²+b²=c²', line: '직각삼각형의 수호자' },
    { id: 'ratrab',   name: '황금비 토끼',      rarity: 'legend', em: '🐇', tag: '1.618',    line: '제일 예쁜 비율을 알고 있어요' },
    { id: 'infturtle',name: '무한 거북',        rarity: 'legend', em: '🐢', tag: '∞',        line: '끝까지 가면 무한이 나와요' }
  ],
  rarity: {
    common: { label: '일반', rate: 70, color: '#5B7A99', badge: '#EAF1F8' },
    rare:   { label: '희귀', rate: 25, color: '#7C5CD6', badge: '#F0EAFF' },
    legend: { label: '전설', rate: 5,  color: '#C98908', badge: '#FFF3D2' }
  },

  /* ---------- 미니 상점 ---------- */
  shop: [
    { id: 'snack',  em: '🍎', name: '펫 간식',      price: 20,  kind: 'snack',
      desc: '알 부화 +25% · 펫 성장' },
    { id: 'egg',    em: '🥚', name: '랜덤 펫 알',    price: 60,  kind: 'egg',
      desc: '일반 70% · 희귀 25% · 전설 5%' },
    { id: 'bomb',   em: '💣', name: '보스 폭탄',     price: 80,  kind: 'bomb',
      desc: '우리 반 보스 HP 15% 즉시 감소' },
    { id: 'shield', em: '🛡️', name: '불꽃 방어권',  price: 120, kind: 'shield',
      desc: '불꽃이 끊길 때 1회 자동 보호' },
    { id: 'coupon_sticker', em: '⭐', name: '칭찬 스티커 1장', price: 120, kind: 'coupon',
      desc: '선생님께 보여주면 진짜 스티커!' },
    { id: 'coupon_choco',   em: '🍫', name: '초코파이 1개',    price: 200, kind: 'coupon',
      desc: '선생님께 보여주면 진짜 간식!' },
    { id: 'coupon_mypu',    em: '🍬', name: '마이쮸 1개',      price: 300, kind: 'coupon',
      desc: '선생님께 보여주면 진짜 간식!' }
  ],

  /* ---------- 매주 자동 교체 보스 ---------- */
  bosses: [
    { id: 'octopus', em: '🐙', name: '숙제 찢어먹는 대왕문어',
      taunts: ['크크크, 오늘도 숙제를 찢어 먹으리라!', '내 다리 여덟 개보다 네 숙제가 느리구나!', '너희 반 다 냈냐? 난 아직 배고프다!', '야옹? …아니, 나 문어다!'],
      title: '문어 퇴치반 🐙' },
    { id: 'dino', em: '🦖', name: '계산실수 공룡',
      taunts: ['0 하나 빠뜨렸지? 내가 먹었다!', '받아올림은 내 간식이다!', '크아앙~ 식을 끝까지 안 썼지?', '내 이빨은 32개, 네 실수는 몇 개?'],
      title: '공룡 뼈 발굴대 🦴' },
    { id: 'ghost', em: '👻', name: '부호 유령',
      taunts: ['+를 -로 바꿔 버릴까~?', '마이너스 싫어? 나도야~', '부호 하나만 틀려도 다 틀려~', '우우우~ 괄호를 잊었지?'],
      title: '부호 사냥꾼 ➕➖' },
    { id: 'robot', em: '🤖', name: '시간도둑 로봇',
      taunts: ['삐빅- 마감 3분 전입니다', '몰아서 하면 내가 이긴다', '숙제는 미리 하는 게 효율적-', '삐- 오답 데이터 수집 완료'],
      title: '시간 수호대 ⏱️' }
  ],

  /* ---------- 히든 칭호 ---------- */
  titles: [
    { id: 'bulldozer', name: '수학 불도저', em: '🚜', hint: '오늘 숙제를 하나도 안 남기고 다 풀면' },
    { id: 'lastattack', name: '최후의 일격', em: '💥', hint: '보스를 마지막 한 방으로 처치하면' },
    { id: 'cleaner', name: '오답 청소부', em: '🧹', hint: '틀린 문제를 3개 이상 고치면' },
    { id: 'earlybird', name: '얼리버드', em: '⚡', hint: '숙제 나간 당일·다음 날 제출하면' },
    { id: 'legendary', name: '전설 수집가', em: '🏅', hint: '전설 펫을 처음 만나면' },
    { id: 'flamekeeper', name: '불꽃 지킴이', em: '🔥', hint: '5일 연속 불꽃을 켜면' }
  ],

  /* ---------- 오늘의 칭호(매일 재미로) ---------- */
  dailyTitles: ['오늘의 수학 용사 🦸', '암산 폭주족 🏍️', '오답 사냥꾼 ⚔️', '불꽃 지킴이 🔥', '문어 퇴치반 🐙', '0을 되찾은 자 🕵️'],

  /* ---------- 병맛 오답 몬스터 ---------- */
  monsters: [
    { name: '연산 실수 콧물 슬라임', em: '🟢' },
    { name: '부호 까먹는 뿡뿡이', em: '💨' },
    { name: '0을 훔쳐간 도둑', em: '🥷' },
    { name: '분수 무서워 꽥꽥 오리', em: '🦆' },
    { name: '자릿수 흔드는 유령', em: '👻' },
    { name: '각도 삐뚤 악어', em: '🐊' },
    { name: '시간 초과 두더지', em: '⏰' },
    { name: '지우개 먹은 요괴', em: '🧽' }
  ]
};
