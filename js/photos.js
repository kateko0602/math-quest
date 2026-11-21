/* 사진 저장소 v0.8 — 사진(base64)을 localStorage에서 떼어 내 IndexedDB에 저장합니다.
   ─────────────────────────────────────────────────────────────
   · localStorage(약 5MB)에 사진을 쌓으면 어느 순간 저장이 조용히 멈춥니다.
     사진만 IndexedDB(수십 MB)로 옮겨 그 사고를 막습니다.
   · 화면 코드는 계속 '동기'로 사진을 읽습니다 → EMA.photos.get(id)가 메모리 캐시에서 바로 돌려줍니다.
   · 사진은 올린 날부터 7일이 지나면 앱 저장본에서 자동 삭제합니다.
     (제출 시각·채점·사진 제출 여부 같은 '기록'은 store의 submissions에 그대로 남습니다)
   · IndexedDB를 쓸 수 없는 브라우저에서는 failed=true 가 되고,
     store가 예전처럼 localStorage에 저장합니다(앱이 멈추지 않게 하는 안전장치).
*/
window.EMA = window.EMA || {};
(function () {
  const DB_NAME = 'ema-photos';
  const STORE = 'photos';
  const VERSION = 1;
  const KEEP_DAYS = 7;                 // 사진 보관 기간(일)

  const cache = {};                    // id → { id, data, owner, date, at }
  let db = null;
  let opened = false;
  let failed = false;
  let loading = null;

  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  const shiftISO = (iso, n) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };

  function open() {
    if (opened) return Promise.resolve(db);
    opened = true;
    return new Promise(resolve => {
      let rq;
      try {
        if (!window.indexedDB) throw new Error('no indexedDB');
        rq = indexedDB.open(DB_NAME, VERSION);
      } catch (e) {
        failed = true; return resolve(null);
      }
      rq.onupgradeneeded = () => {
        const d = rq.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      rq.onsuccess = () => { db = rq.result; resolve(db); };
      rq.onerror = () => { failed = true; resolve(null); };
      rq.onblocked = () => { failed = true; resolve(null); };
      setTimeout(() => { if (!db && !failed) { failed = true; resolve(null); } }, 4000);
    });
  }

  function run(mode, fn) {
    return open().then(d => {
      if (!d) return null;
      return new Promise(resolve => {
        let t;
        try { t = d.transaction(STORE, mode); } catch (e) { failed = true; return resolve(null); }
        const s = t.objectStore(STORE);
        let out = null;
        try { out = fn(s); } catch (e) { /* noop */ }
        t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
        t.onerror = () => resolve(null);
        t.onabort = () => resolve(null);
      });
    });
  }

  const api = {
    cache,
    KEEP_DAYS,
    get failed() { return failed; },
    get ready() { return !failed && !!db; },

    /** 앱 부팅 때 한 번 — 저장된 사진을 메모리 캐시로 올립니다 */
    async load() {
      if (loading) return loading;
      loading = (async () => {
        const d = await open();
        if (!d) return { ok: false, count: 0 };
        const rows = await new Promise(resolve => {
          try {
            const t = d.transaction(STORE, 'readonly');
            const rq = t.objectStore(STORE).getAll();
            rq.onsuccess = () => resolve(rq.result || []);
            rq.onerror = () => resolve([]);
          } catch (e) { resolve([]); }
        });
        rows.forEach(r => { if (r && r.id) cache[r.id] = r; });
        return { ok: true, count: rows.length };
      })();
      return loading;
    },

    /** 동기 조회 — 화면 코드가 그대로 씁니다 */
    get(id) { return cache[id] || null; },
    has(id) { return !!cache[id]; },

    async put(id, rec) {
      const row = Object.assign({ id, date: todayISO(), at: '' }, rec || {});
      cache[id] = row;
      const ok = await run('readwrite', s => { s.put(row); return true; });
      return ok === true;
    },

    async del(id) {
      delete cache[id];
      await run('readwrite', s => { s.delete(id); return true; });
      return true;
    },

    /** 올린 날부터 KEEP_DAYS(7)일이 지난 사진을 지웁니다. 지운 id 목록을 돌려줍니다. */
    async purge(keepDays) {
      const keep = keepDays || KEEP_DAYS;
      const limit = shiftISO(todayISO(), -(keep - 1));   // 오늘 포함 7일 유지
      const gone = [];
      Object.keys(cache).forEach(id => {
        const r = cache[id];
        const date = r && (r.date || '');
        if (!date) return;                                // 날짜를 모르는 옛 사진은 건드리지 않음
        if (date < limit) { delete cache[id]; gone.push(id); }
      });
      if (gone.length) {
        await run('readwrite', s => { gone.forEach(id => s.delete(id)); return true; });
      }
      return gone;
    },

    /** localStorage state.photos → IndexedDB 로 옮기기 (v0.7 이하 데이터) */
    async migrateFrom(photos, fallbackDate) {
      const out = { moved: 0, failed: 0 };
      if (!photos) return out;
      const ids = Object.keys(photos);
      for (const id of ids) {
        const p = photos[id] || {};
        if (!p.data) { delete photos[id]; continue; }
        const ok = await api.put(id, {
          data: p.data, owner: p.owner || '', at: p.at || '',
          date: p.date || fallbackDate || todayISO()
        });
        if (ok) { delete photos[id]; out.moved++; } else out.failed++;
      }
      return out;
    }
  };

  EMA.photos = api;
})();
