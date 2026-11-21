/* 시제품 예시 데이터 v0.4 — 관리시트의 반 구조를 따릅니다.
   (초6 심화반 5명 · 시트 🏫 반·학생 / 📖 진도·숙제 기준 · v0.5 펫 알·펫 도감 모델)

   예시 데이터는 "실제로 아이들이 며칠 써 본 반"처럼 보이도록
   날짜별 불꽃 기록·오답·밀린문제·동료를 자연스럽게 흩어 놓았습니다.
*/
window.EMA = window.EMA || {};
(function () {
  const pad = n => String(n).padStart(2, '0');
  function shift(iso, d) {
    const dt = new Date(iso + 'T12:00:00');
    dt.setDate(dt.getDate() + d);
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }
  function dow(iso) {
    return ['일', '월', '화', '수', '목', '금', '토'][new Date(iso + 'T12:00:00').getDay()];
  }
  function nextClass(iso, days) {
    for (let i = 1; i <= 7; i++) {
      const d = shift(iso, i);
      if (days.indexOf(new Date(d + 'T12:00:00').getDay()) >= 0) return d;
    }
    return shift(iso, 1);
  }

  const AVATARS = ['🦊', '🐰', '🐯', '🐼', '🐶', '🐨', '🐻', '🐷'];
  let avI = 0;
  function stu(id, name, opts) {
    return Object.assign({
      id, name, pin: '1234',
      nickname: null, avatar: AVATARS[avI++ % AVATARS.length],
      xp: 0, bonusXp: 0, coins: 0, streak: 0,
      pets: [], egg: null, bag: { snack: 0, shield: 0, bomb: 0 },
      titles: [], sick: false
    }, opts || {});
  }
  function pet(id, when, lv) {
    const def = (window.EMA_GAME.pets || []).find(p => p.id === id) || { id, name: id, rarity: 'common', em: '🐾' };
    return { id: def.id, name: def.name, rarity: def.rarity, em: def.em, at: when, lv: lv || 1 };
  }

  EMA.buildSeed = function (today) {
    avI = 0;
    const T = today;
    const y1 = shift(T, -1), y2 = shift(T, -2), y3 = shift(T, -3);

    const classes = [
      {
        id: 'c4m2', name: '초6 심화반', grade: '초4', semester: '초6-1', prevSemester: '초5-2',
        days: '화·목', time: '18:00~20:20', startDate: '2026-12-01',
        textbooks: ['6-1 발전책', '6-1 응용심화책'], emoji: '🧮', active: true,
        students: [
          stu('s1', '김하늘', {
            nickname: null, avatar: '🦊', xp: 180, coins: 34, streak: 2,
            pets: [pet('rootcat', shift(T, -12), 2)],
            purified: { 'purify|rootcat': { at: shift(T, -12), petId: 'rootcat' } },
            titles: [{ id: 'earlybird', name: '얼리버드', em: '⚡', at: shift(T, -6) }]
          }),
          stu('s2', '박서연', {
            nickname: '서연', avatar: '🐰', xp: 420, coins: 61, streak: 5,
            pets: [pet('fracho', shift(T, -9), 2), pet('piowl', shift(T, -2), 1)],
            purified: {
              'carry|c_s2_1': { at: shift(T, -9), petId: 'fracho' },
              '6-1 발전책|6:1': { at: shift(T, -2), petId: 'piowl' }
            },
            egg: { pct: 75, gotAt: shift(T, -4) },
            bag: { snack: 0, shield: 0, bomb: 0 },
            titles: [{ id: 'cleaner', name: '오답 청소부', em: '🧹', at: shift(T, -3) }]
          }),
          stu('s3', '오지훈', {
            nickname: '지훈', avatar: '🐯', xp: 250, coins: 38, streak: 1,
            egg: { pct: 25, gotAt: y2 }
          }),
          stu('s4', '정하윤', {
            nickname: '하윤', avatar: '🐼', xp: 390, coins: 55, streak: 3,
            pets: [pet('angryong', shift(T, -6), 1)],
            purified: { '6-1 발전책|8:3': { at: shift(T, -6), petId: 'angryong' } },
            titles: [{ id: 'earlybird', name: '얼리버드', em: '⚡', at: shift(T, -4) }]
          }),
          stu('s5', '하준', {
            nickname: '하준', avatar: '🐶', xp: 520, coins: 80, streak: 6,
            pets: [pet('zerofox', shift(T, -15), 3), pet('primepen', shift(T, -5), 1)],
            purified: {
              'carry|m_s5_1': { at: shift(T, -16), petId: 'zerofox' },
              '6-1 발전책|8:2': { at: shift(T, -5), petId: 'primepen' }
            },
            titles: [{ id: 'flamekeeper', name: '불꽃 지킴이', em: '🔥', at: shift(T, -8) }]
          })
        ]
      },
      {
        id: 'c4m1', name: '초6 기본반', grade: '초4', semester: '초6-1', days: '화·목',
        time: '15:30~17:50', textbooks: ['6-1 발전책', '6-1 응용심화책'], emoji: '📗', active: false,
        students: [
          stu('a1', '유가온', { nickname: '가온', xp: 300, coins: 40, streak: 2 }),
          stu('a2', '최서아', { nickname: '서아', xp: 260, coins: 33, streak: 1 }),
          stu('a3', '최유나', { nickname: '유나', xp: 210, coins: 28, streak: 0 })
        ]
      },
      {
        id: 'c5m', name: '초5 심화반', grade: '초5', semester: '중1-1', days: '수·금',
        time: '15:30~17:50', textbooks: ['개념진도북', '발전셀프북'], emoji: '📘', active: false,
        students: [
          stu('b1', '강시우', { nickname: '시우', xp: 380, coins: 50, streak: 4 }),
          stu('b2', '김나연', { nickname: '나연', xp: 190, coins: 22, streak: 0 }),
          stu('b3', '이도윤', { nickname: '도윤', xp: 240, coins: 31, streak: 2 }),
          stu('b4', '줄리', { nickname: '줄리', xp: 330, coins: 44, streak: 3 })
        ]
      },
      {
        id: 'c6m', name: '초6 기본반2', grade: '초6', semester: '중2-1', days: '수·금',
        time: '18:00~20:20', textbooks: ['개념진도북', '발전셀프북'], emoji: '📙', active: false,
        students: [
          stu('d1', '김예린', { nickname: '예린', xp: 410, coins: 58, streak: 5 }),
          stu('d2', '성민준', { nickname: '민준', xp: 350, coins: 47, streak: 2 }),
          stu('d3', '양지우', { nickname: '지우', xp: 280, coins: 36, streak: 1 }),
          stu('d4', '정하준', { nickname: '하준', xp: 220, coins: 25, streak: 0 })
        ]
      }
    ];

    // 오늘 수업 (시트 📖 진도·숙제에 적는 칸을 그대로 옮긴 모양)
    const nxt = nextClass(T, [2, 4]); // 화·목
    const lessons = {
      c4m2: {
        date: T,
        lesson: '6-1 발전책 : 분수의 나눗셈 (8~9쪽) · 응용심화 6쪽',
        homework: '6-1 발전책 8~10쪽, 6-1 응용심화책 6~7쪽',
        books: [
          { book: '6-1 발전책', pages: [8, 9, 10] },
          { book: '6-1 응용심화책', pages: [6, 7] }
        ],
        // 숙제가 나간 날 = 지난 수업일, 마감 = 다음 수업일
        assignedAt: y1,
        dueDate: nxt,
        due: '다음 수업(' + nxt.slice(5) + ' ' + dow(nxt) + ') 전까지',
        memo: '식 쓰는 연습이 필요한 친구 있음 / 심화 혼자 잘 푸는 친구 있음'
      }
    };

    // 지난 수업의 숙제 범위 (밀린문제 계산용)
    const dayLessons = {
      c4m2: {
        [y1]: {
          books: [
            { book: '6-1 발전책', pages: [6, 7] },
            { book: '6-1 응용심화책', pages: [4, 5] }
          ],
          lesson: '6-1 발전책 : 분수의 나눗셈 (6~7쪽) · 응용심화 4~5쪽',
          homework: '6-1 발전책 6~7쪽, 6-1 응용심화책 4~5쪽'
        }
      }
    };

    const exams = {
      c4m2: [
        {
          date: shift(T, -24), unit: '초5-2 3단원 평가', full: 100, retestLine: 70,
          rows: [
            { studentId: 's1', score: 85 }, { studentId: 's2', score: 90 },
            { studentId: 's3', score: 72 }, { studentId: 's4', score: 88 },
            { studentId: 's5', score: 96 }
          ]
        },
        {
          date: shift(T, -17), unit: '초5-2 4단원 평가', full: 100, retestLine: 70,
          rows: [
            { studentId: 's1', score: 78 }, { studentId: 's2', score: 65 },
            { studentId: 's3', score: 74 }, { studentId: 's4', score: 92 },
            { studentId: 's5', score: 94 }
          ],
          retest: [{ studentId: 's2', score: 100, date: y3 }]
        },
        {
          date: shift(T, -10), unit: '초5-2 5단원 평가', full: 100, retestLine: 70,
          rows: [
            { studentId: 's1', score: 90 }, { studentId: 's2', score: 85 },
            { studentId: 's3', score: 68 }, { studentId: 's4', score: 95 },
            { studentId: 's5', score: 98 }
          ],
          retest: [{ studentId: 's3', score: 92, date: shift(T, -5) }]
        }
      ]
    };

    const K = (c, d, s) => c + '|' + d + '|' + s;
    const bk = (book, page, i) => book + '|' + page + ':' + i;
    const grades = {}, submissions = {};

    // 오늘: 하준 도장 완료 · 서연 제출 후 도장 대기 · 지훈 채점 중
    grades[K('c4m2', T, 's5')] = {
      marks: {
        [bk('6-1 발전책', 8, 0)]: 'o', [bk('6-1 발전책', 8, 1)]: 'x', [bk('6-1 발전책', 8, 2)]: 'o',
        [bk('6-1 발전책', 9, 0)]: 'o', [bk('6-1 발전책', 9, 1)]: 'o', [bk('6-1 발전책', 9, 2)]: 'o',
        [bk('6-1 발전책', 10, 0)]: 'o', [bk('6-1 발전책', 10, 1)]: 'o', [bk('6-1 발전책', 10, 2)]: 'o', [bk('6-1 발전책', 10, 3)]: 'o',
        [bk('6-1 응용심화책', 6, 0)]: 'o', [bk('6-1 응용심화책', 6, 1)]: 'o', [bk('6-1 응용심화책', 6, 2)]: 'o', [bk('6-1 응용심화책', 6, 3)]: 'o',
        [bk('6-1 응용심화책', 7, 0)]: 'o', [bk('6-1 응용심화책', 7, 1)]: 'o'
      },
      cleanup: { [bk('6-1 발전책', 8, 1)]: 'fixed' },
      updatedAt: '17:10'
    };
    grades[K('c4m2', T, 's2')] = {
      marks: {
        [bk('6-1 발전책', 8, 0)]: 'o', [bk('6-1 발전책', 8, 1)]: 'o', [bk('6-1 발전책', 8, 2)]: 'o',
        [bk('6-1 발전책', 9, 0)]: 'o', [bk('6-1 발전책', 9, 1)]: 'x', [bk('6-1 발전책', 9, 2)]: 'o', [bk('6-1 발전책', 9, 3)]: 'o',
        [bk('6-1 발전책', 10, 0)]: 'o', [bk('6-1 발전책', 10, 1)]: 'o', [bk('6-1 발전책', 10, 2)]: 'x',
        [bk('6-1 응용심화책', 6, 0)]: 'o', [bk('6-1 응용심화책', 6, 1)]: 'o', [bk('6-1 응용심화책', 6, 2)]: 'o',
        [bk('6-1 응용심화책', 7, 0)]: 'o', [bk('6-1 응용심화책', 7, 1)]: 'o'
      },
      cleanup: { [bk('6-1 발전책', 9, 1)]: 'star', [bk('6-1 발전책', 10, 2)]: 'fixed' },
      tags: { [bk('6-1 발전책', 9, 1)]: 'read', [bk('6-1 발전책', 10, 2)]: 'calc' },
      updatedAt: '17:40'
    };
    grades[K('c4m2', T, 's3')] = {
      marks: {
        [bk('6-1 발전책', 8, 0)]: 'x', [bk('6-1 발전책', 8, 1)]: 'o', [bk('6-1 발전책', 8, 2)]: 'o',
        [bk('6-1 발전책', 9, 0)]: 'o'
      },
      cleanup: {},
      updatedAt: '16:22'
    };
    submissions[K('c4m2', T, 's5')] = { status: 'stamped', at: '17:08', ts: Date.now() - 150 * 60000, photoId: 'p_s5', stampAt: '17:15', verify: { book: '6-1 발전책', page: 9 }, early: true, coins: 34, xp: 78 };
    // 서연: 25분 전 제출 → '사진 다시 올리기 (35분 남음)'을 바로 눌러 볼 수 있게
    submissions[K('c4m2', T, 's2')] = { status: 'submitted', at: '17:40', ts: Date.now() - 25 * 60000, photoId: 'p_s2', stampAt: null, verify: { book: '6-1 응용심화책', page: 7 }, early: true, coins: 26, xp: 66 };

    /* ---------- 지난 날 불꽃 기록 (5주치) ----------
       일·월은 학원 휴무라 대체로 비고, 시험 기간엔 뚝 떨어지는 모습으로 자연스럽게 */
    const history = {};
    const patterns = {
      s1: { base: 4, off: [0, 6, 9, 13, 20, 27], low: [3, 17, 22, 30] },
      s2: { base: 8, off: [7, 19, 26], low: [11, 16, 23, 31] },
      s3: { base: 3, off: [0, 1, 5, 6, 8, 13, 14, 20, 21, 27], low: [10, 17, 24, 31] },
      s4: { base: 6, off: [0, 6, 7, 14, 21, 28], low: [9, 16, 23, 30] },
      s5: { base: 9, off: [13, 20], low: [6, 12, 27] }
    };
    Object.keys(patterns).forEach(sid => {
      const p = patterns[sid];
      history[sid] = [];
      for (let k = 34; k >= 1; k--) {
        const date = shift(T, -k);
        const wd = new Date(date + 'T12:00:00').getDay();
        let solved;
        if (wd === 1) solved = 0;                       // 월요일 휴무
        else if (p.off.indexOf(k) >= 0) solved = 0;     // 쉰 날
        else if (p.low.indexOf(k) >= 0) solved = Math.max(1, p.base - 2);
        else solved = p.base + ((k * 7 + sid.charCodeAt(1)) % 4);
        if (wd === 0) solved = Math.min(solved, 2);     // 일요일은 가볍게
        history[sid].push({ date, solved });
      }
      // 어제: 도연이만 늦게 올림(⏰ 어제분)으로 표시
      const yRow = history[sid].find(x => x.date === y1);
      if (yRow && sid === 's1') { yRow.solved = 4; yRow.late = true; }
    });

    const monsters = {
      s1: [
        { id: 'm_s1_1', book: '6-1 발전책', page: 6, num: '2', label: '6쪽 2번', date: shift(T, -8), captured: true },
        { id: 'm_s1_2', book: '6-1 발전책', page: 7, num: '3', label: '7쪽 3번', date: shift(T, -8), captured: false }
      ],
      s2: [
        { id: 'm_s2_1', book: '6-1 발전책', page: 6, num: '2', label: '6쪽 2번', date: shift(T, -9), captured: true },
        { id: 'm_s2_2', book: '6-1 응용심화책', page: 4, num: '3-1', label: '4쪽 3-1번', date: shift(T, -9), captured: true },
        { id: 'm_s2_3', book: '6-1 발전책', page: 7, num: '3', label: '7쪽 3번', date: shift(T, -7), captured: false }
      ],
      s3: [
        { id: 'm_s3_1', book: '6-1 발전책', page: 7, num: '4', label: '7쪽 4번', date: y1, captured: false }
      ],
      s4: [
        { id: 'm_s4_1', book: '6-1 발전책', page: 8, num: '3', label: '8쪽 3번', date: shift(T, -12), captured: true }
      ],
      s5: [
        { id: 'm_s5_1', book: '6-1 발전책', page: 8, num: '2', label: '8쪽 2번', date: shift(T, -16), captured: true },
        { id: 'm_s5_2', book: '6-1 응용심화책', page: 4, num: '5', label: '4쪽 5번', date: shift(T, -11), captured: true },
        { id: 'm_s5_3', book: '6-1 발전책', page: 7, num: '5-1', label: '7쪽 5-1번', date: shift(T, -6), captured: true }
      ]
    };

    /* ---------- 밀린 오답·이월 (어제 이전 날의 ❌·⭐·⏭️) ---------- */
    const carried = {
      s1: [
        { id: 'c_s1_1', book: '6-1 발전책', page: 7, num: '5', label: '7쪽 5번', date: shift(T, -6), reason: 'x' }
      ],
      s2: [
        { id: 'c_s2_1', book: '6-1 발전책', page: 7, num: '4', label: '7쪽 4번', date: y3, reason: 'x' },
        { id: 'c_s2_2', book: '6-1 발전책', page: 6, num: '3-1', label: '6쪽 3-1번', date: y3, reason: 'star' },
        { id: 'c_s2_3', book: '6-1 응용심화책', page: 5, num: '2', label: '응용 5쪽 2번', date: shift(T, -5), reason: 'skip' },
        { id: 'c_s2_4', book: '6-1 응용심화책', page: 4, num: '4', label: '응용 4쪽 4번', date: shift(T, -7), reason: 'x' }
      ],
      s3: [
        { id: 'c_s3_1', book: '6-1 발전책', page: 6, num: '1', label: '6쪽 1번', date: y2, reason: 'skip' },
        { id: 'c_s3_2', book: '6-1 발전책', page: 7, num: '2', label: '7쪽 2번', date: shift(T, -4), reason: 'x' }
      ],
      s4: [],
      s5: []
    };

    // 개별 오답프린트 — 서연는 선생님이 25문제로 넣어 둠(바로 눌러 보기)
    const prints = {
      [K('c4m2', T, 's2')]: { count: 25, lastNo: null, setBy: 'teacher', at: y1 }
    };

    return JSON.parse(JSON.stringify({
      version: 4,
      today: T,
      teacherPin: '2580',
      classes, lessons, dayLessons, exams,
      pageMaps: window.EMA_PAGE_MAPS || {},
      grades, submissions, history, monsters, carried, prints,
      solvedCarried: {},
      lateUploads: { [K('c4m2', y1, 's1')]: { at: '20:12', photoId: 'p_late_s1', solved: 4 } },
      photos: {},
      shop: { rewardsOn: true, claims: [] },
      gallery: { mode: 'auto' },
      bossBoosts: {},
      bossKills: {},
      meta: { seededAt: new Date().toISOString(), demo: true, model: 'v0.4' }
    }));
  };
})();
