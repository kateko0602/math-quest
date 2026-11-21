/* 시제품 예시 데이터 — 실제 학원 반 구조를 흉내낸 샘플입니다(이름은 모두 예시).
   (5명 반 · 시트 🏫 반·학생 / 📖 진도·숙제 기준 · v0.2 채점 모델) */
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
      xp: 0, coins: 0, streak: 0
    }, opts || {});
  }

  EMA.buildSeed = function (today) {
    avI = 0;
    const T = today;
    const y1 = shift(T, -1), y2 = shift(T, -2);

    const classes = [
      {
        id: 'c4m2', name: '초6 심화반', grade: '초6', semester: '초6-1', prevSemester: '초5-2',
        days: '화·목', time: '18:00~20:20', startDate: '2026-12-01',
        textbooks: ['6-1 발전책', '6-1 응용심화책'], emoji: '🧮', active: true,
        students: [
          stu('s1', '김하늘', { nickname: null, avatar: '🦊', xp: 180, coins: 34, streak: 2 }),
          stu('s2', '박서연', { nickname: '지유', avatar: '🐰', xp: 420, coins: 61, streak: 5 }),
          stu('s3', '오지훈', { nickname: '서준', avatar: '🐯', xp: 250, coins: 38, streak: 1 }),
          stu('s4', '정하윤', { nickname: '서율', avatar: '🐼', xp: 390, coins: 55, streak: 3 }),
          stu('s5', '하준', { nickname: '윤윤', avatar: '🐶', xp: 520, coins: 80, streak: 6 })
        ]
      },
      {
        id: 'c4m1', name: '초6 기본반', grade: '초6', semester: '초6-1', days: '화·목',
        time: '15:30~17:50', textbooks: ['6-1 발전책', '6-1 응용심화책'], emoji: '📗', active: false,
        students: [
          stu('a1', '유문경', { nickname: '문경', xp: 300, coins: 40, streak: 2 }),
          stu('a2', '최민하', { nickname: '민하', xp: 260, coins: 33, streak: 1 }),
          stu('a3', '최예서', { nickname: '예서', xp: 210, coins: 28, streak: 0 })
        ]
      },
      {
        id: 'c5m', name: '초5 심화반', grade: '초5', semester: '중1-1', days: '수·금',
        time: '15:30~17:50', textbooks: ['개념진도북', '발전셀프북'], emoji: '📘', active: false,
        students: [
          stu('b1', '강라현', { nickname: '라현', xp: 380, coins: 50, streak: 4 }),
          stu('b2', '김하연', { nickname: '하연', xp: 190, coins: 22, streak: 0 }),
          stu('b3', '이시원', { nickname: '시원', xp: 240, coins: 31, streak: 2 }),
          stu('b4', '줄리아', { nickname: '줄리', xp: 330, coins: 44, streak: 3 })
        ]
      },
      {
        id: 'c6m', name: '초6 기본반2', grade: '초6', semester: '중2-1', days: '수·금',
        time: '18:00~20:20', textbooks: ['개념진도북', '발전셀프북'], emoji: '📙', active: false,
        students: [
          stu('d1', '김혜린', { nickname: '혜린', xp: 410, coins: 58, streak: 5 }),
          stu('d2', '성석현', { nickname: '석현', xp: 350, coins: 47, streak: 2 }),
          stu('d3', '양서윤', { nickname: '서윤', xp: 280, coins: 36, streak: 1 }),
          stu('d4', '정우영', { nickname: '우영', xp: 220, coins: 25, streak: 0 })
        ]
      }
    ];

    // 오늘 수업 (시트 📖 진도·숙제에 적는 두 칸을 그대로 옮긴 모양)
    const nxt = nextClass(T, [2, 4]); // 화·목
    const lessons = {
      c4m2: {
        date: T,
        lesson: '6-1 발전책 : 분수의 나눗셈 (8~9쪽)',
        homework: '6-1 발전책 8~10쪽',
        book: '6-1 발전책',
        pages: [8, 9, 10],
        due: '다음 수업(' + nxt + ' ' + dow(nxt) + ') 전까지',
        memo: '식 쓰는 연습이 필요한 친구 있음 / 심화 혼자 잘 푸는 친구 있음'
      }
    };

    const exams = {
      c4m2: [
        {
          date: y2, unit: '초5-2 5단원 평가', full: 100, retestLine: 70,
          rows: [
            { studentId: 's1', score: 85 }, { studentId: 's2', score: 65 },
            { studentId: 's3', score: 78 }, { studentId: 's4', score: 90 },
            { studentId: 's5', score: 95 }
          ]
        }
      ]
    };

    const K = (c, d, s) => c + '|' + d + '|' + s;
    const grades = {}, submissions = {};

    // 오늘: 윤윤 도장 완료(1등 후보) · 지유 제출 후 도장 대기 · 서준 채점 중
    grades[K('c4m2', T, 's5')] = {
      marks: { '8:1': 'x', '8:0': 'o', '8:2': 'o', '9:0': 'o', '9:1': 'o', '9:2': 'x', '9:3': 'o' },
      cleanup: { '8:1': 'star', '9:2': 'fixed' },
      updatedAt: '17:10'
    };
    grades[K('c4m2', T, 's2')] = {
      marks: { '8:0': 'o', '8:1': 'o', '8:2': 'o', '9:0': 'o', '9:1': 'x', '9:2': 'o', '9:3': 'o', '10:0': 'o', '10:1': 'o', '10:2': 'x' },
      cleanup: { '9:1': 'star', '10:2': 'fixed' },
      updatedAt: '17:40'
    };
    grades[K('c4m2', T, 's3')] = {
      marks: { '8:0': 'x', '8:1': 'o', '8:2': 'o' },
      cleanup: {},
      updatedAt: '16:22'
    };
    submissions[K('c4m2', T, 's5')] = { status: 'stamped', at: '17:08', photoId: 'p_s5', stampAt: '17:15' };
    submissions[K('c4m2', T, 's2')] = { status: 'submitted', at: '17:40', photoId: 'p_s2', stampAt: null };

    // 지난 날 기록 (불꽃 달력·오답 도감용)
    const history = {};
    const plan = {
      s1: { '-1': 4, '-2': 3, '-3': 0, '-4': 5, '-5': 3, '-6': 0, '-7': 4, '-8': 3 },
      s2: { '-1': 12, '-2': 3, '-3': 6, '-4': 5, '-5': 3, '-6': 4, '-7': 3, '-8': 0 },
      s3: { '-1': 3, '-2': 0, '-3': 0, '-4': 4, '-5': 0, '-6': 3, '-7': 2, '-8': 3 },
      s4: { '-1': 4, '-2': 5, '-3': 3, '-4': 0, '-5': 3, '-6': 4, '-7': 0, '-8': 3 },
      s5: { '-1': 12, '-2': 6, '-3': 5, '-4': 4, '-5': 3, '-6': 6, '-7': 3, '-8': 4 }
    };
    Object.keys(plan).forEach(sid => {
      history[sid] = Object.keys(plan[sid]).map(k => ({
        date: shift(T, parseInt(k, 10)), solved: plan[sid][k]
      })).sort((a, b) => a.date < b.date ? -1 : 1);
    });

    const monsters = {
      s1: [
        { id: 'm_s1_1', label: '8쪽 2번', date: shift(T, -2), captured: true },
        { id: 'm_s1_2', label: '9쪽 2-1번', date: y1, captured: false },
        { id: 'm_s1_3', label: '10쪽 4번', date: y1, captured: false }
      ],
      s2: [
        { id: 'm_s2_1', label: '6쪽 2번', date: shift(T, -4), captured: true },
        { id: 'm_s2_2', label: '7쪽 3번', date: shift(T, -3), captured: true }
      ],
      s3: [{ id: 'm_s3_1', label: '7쪽 4번', date: shift(T, -1), captured: false }],
      s4: [
        { id: 'm_s4_1', label: '8쪽 3번', date: shift(T, -2), captured: true },
        { id: 'm_s4_2', label: '9쪽 3-1번', date: y1, captured: false }
      ],
      s5: [
        { id: 'm_s5_1', label: '8쪽 2번', date: shift(T, -2), captured: true },
        { id: 'm_s5_2', label: '10쪽 5번', date: shift(T, -3), captured: true },
        { id: 'm_s5_3', label: '10쪽 5-1번', date: y1, captured: true }
      ]
    };

    return JSON.parse(JSON.stringify({
      version: 3,
      today: T,
      teacherPin: '2580',
      classes, lessons, exams,
      pageMaps: window.EMA_PAGE_MAPS || {},
      grades, submissions, history, monsters,
      photos: {},
      meta: { seededAt: new Date().toISOString(), demo: true, model: 'v0.2 marks' }
    }));
  };
})();
