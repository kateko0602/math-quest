/* ============================================================================
   숙제 대소동 v2.2 — 컬러 3D 둥근 아이콘 세트
   · 웹 문서처럼 보이던 OS 이모지(📊 ✅ 📝 🔥 ⭐ …)를 앱 안에서 직접 그린
     선명한 컬러 SVG 아이콘으로 바꿉니다. 외부 이미지·폰트·저작권 없음.
   · 색: 코발트(#2563EB) · 코랄(#FF6B4A) · 민트(#2FD3A6) · 골드(#F5B93B)
   · 입체감: 위→아래 그라데이션 + 아래쪽 살짝 어두운 그림자 + 흰 하이라이트
   · 쓰는 법
       EMA.icons.html('flame')            → <svg class="svic sv-flame"> … </svg>
       EMA.icons.html('star', 'lg')       → 크기 클래스(sm·md·lg·xl) 추가
       EMA.icons.em('🔥')                 → 이모지를 같은 뜻의 아이콘으로
   ========================================================================== */
(function () {
  const ICONS = {};

  /* ---------- 하단 탭 · 홈 ---------- */
  ICONS.home = `
<defs><linearGradient id="ic-home-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#63A2FF"/><stop offset=".55" stop-color="#2563EB"/><stop offset="1" stop-color="#1B45C0"/></linearGradient></defs>
<path d="M12.75 3.15a1.2 1.2 0 0 0-1.5 0L3.05 9.9c-.55.45-.23 1.35.48 1.35h1.02v6.2a2.5 2.5 0 0 0 2.5 2.5h2.2a.9.9 0 0 0 .9-.9v-3.5c0-.72.58-1.3 1.3-1.3h1.1c.72 0 1.3.58 1.3 1.3v3.5c0 .5.4.9.9.9h2.2a2.5 2.5 0 0 0 2.5-2.5v-6.2h1.02c.71 0 1.03-.9.48-1.35z" fill="url(#ic-home-g)"/>
<path d="M12 3.6 4.2 10.4h15.6z" fill="#fff" opacity=".16"/>
<rect x="10.1" y="13.9" width="3.8" height="6.05" rx="1.5" fill="#fff" opacity=".95"/>
<circle cx="13" cy="17" r=".55" fill="#2563EB"/>`;

  ICONS.paw = `
<defs><linearGradient id="ic-paw-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#6BEBC6"/><stop offset="1" stop-color="#0FA97D"/></linearGradient></defs>
<ellipse cx="12" cy="15.7" rx="6.05" ry="5.15" fill="url(#ic-paw-g)"/>
<ellipse cx="6.2" cy="9.35" rx="2.35" ry="2.95" transform="rotate(-20 6.2 9.35)" fill="url(#ic-paw-g)"/>
<ellipse cx="10.1" cy="6.65" rx="2.15" ry="2.85" transform="rotate(-8 10.1 6.65)" fill="url(#ic-paw-g)"/>
<ellipse cx="14.1" cy="6.65" rx="2.15" ry="2.85" transform="rotate(8 14.1 6.65)" fill="url(#ic-paw-g)"/>
<ellipse cx="18" cy="9.5" rx="2.3" ry="2.9" transform="rotate(20 18 9.5)" fill="url(#ic-paw-g)"/>
<ellipse cx="9.9" cy="13.6" rx="2.5" ry="1.55" fill="#fff" opacity=".28"/>`;

  ICONS.trophy = `
<defs><linearGradient id="ic-trophy-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFDD86"/><stop offset=".6" stop-color="#F5B93B"/><stop offset="1" stop-color="#D8871A"/></linearGradient></defs>
<path d="M7.6 3.2h8.8v4.4c0 3-2 5.35-4.4 5.35s-4.4-2.35-4.4-5.35z" fill="url(#ic-trophy-g)"/>
<path d="M7.6 4.3H5.2a2.6 2.6 0 0 0 0 5.2h1.1M16.4 4.3h2.4a2.6 2.6 0 0 1 0 5.2h-1.1" fill="none" stroke="#F0AC2E" stroke-width="1.5" stroke-linecap="round"/>
<rect x="10.7" y="12.4" width="2.6" height="3.5" rx="1.1" fill="#E6A32A"/>
<path d="M7.6 19.9c0-1.5 1.2-2.6 2.7-2.6h3.4c1.5 0 2.7 1.1 2.7 2.6 0 .7-.6 1.3-1.3 1.3H8.9c-.7 0-1.3-.6-1.3-1.3z" fill="url(#ic-trophy-g)"/>
<circle cx="12" cy="6.9" r="2.35" fill="#fff" opacity=".9"/>
<path d="m12 5.35.62 1.3 1.4.16-.99.93.24 1.42L12 8.45l-1.27.71.24-1.42-.99-.93 1.4-.16z" fill="#F5B93B"/>`;

  ICONS.clipboard = `
<defs><linearGradient id="ic-clip-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#5E9DFF"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient>
  <linearGradient id="ic-clip-gg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFD671"/><stop offset="1" stop-color="#E9A521"/></linearGradient></defs>
<rect x="3.9" y="4.3" width="16.2" height="16.3" rx="4.2" fill="url(#ic-clip-g)"/>
<rect x="6.9" y="7.9" width="10.2" height="10.4" rx="2.3" fill="#fff"/>
<rect x="8.7" y="10.1" width="6.6" height="1.35" rx=".67" fill="#C3D6F7"/>
<rect x="8.7" y="13" width="4.6" height="1.35" rx=".67" fill="#C3D6F7"/>
<rect x="9.2" y="2.1" width="5.6" height="4.3" rx="2.15" fill="url(#ic-clip-gg)"/>
<path d="M8.7 16.4h1.2l.9.9 1.9-1.9" fill="none" stroke="#12B886" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  ICONS.chart = `
<defs><linearGradient id="ic-chart-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E9DFF"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient>
<linearGradient id="ic-chart-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FE7C3"/><stop offset="1" stop-color="#12A57C"/></linearGradient>
<linearGradient id="ic-chart-y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFDA82"/><stop offset="1" stop-color="#E9A521"/></linearGradient></defs>
<rect x="3.2" y="11.4" width="4.5" height="9.4" rx="2.25" fill="url(#ic-chart-c)"/>
<rect x="9.75" y="4" width="4.5" height="16.8" rx="2.25" fill="url(#ic-chart-m)"/>
<rect x="16.3" y="8.2" width="4.5" height="12.6" rx="2.25" fill="url(#ic-chart-y)"/>
<rect x="4.6" y="12.7" width="1.5" height="2.6" rx=".75" fill="#fff" opacity=".45"/>
<rect x="11.2" y="5.6" width="1.5" height="3" rx=".75" fill="#fff" opacity=".5"/>`;

  ICONS.star = `
<defs><linearGradient id="ic-star-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFE59B"/><stop offset=".55" stop-color="#F7C24A"/><stop offset="1" stop-color="#DE9312"/></linearGradient></defs>
<path d="M12 2.15l2.86 5.9 6.44.83c.55.07.77.76.36 1.14l-4.72 4.37 1.2 6.3c.1.55-.49.97-.98.7L12 18.3l-5.16 3.09c-.49.27-1.08-.15-.98-.7l1.2-6.3-4.72-4.37c-.41-.38-.19-1.07.36-1.14l6.44-.83z" fill="url(#ic-star-g)"/>
<path d="M12 4.4l2.05 4.24 4.3.55-3.2 2.95.86 4.42L12 14.4z" fill="#fff" opacity=".33"/>`;

  ICONS.gear = `
<defs><linearGradient id="ic-gear-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#93A8C6"/><stop offset="1" stop-color="#5A6F8E"/></linearGradient></defs>
<g fill="url(#ic-gear-g)">
  <rect x="10.85" y="1.4" width="2.3" height="4.2" rx="1.15"/>
  <rect x="10.85" y="1.4" width="2.3" height="4.2" rx="1.15" transform="rotate(45 12 12)"/>
  <rect x="10.85" y="1.4" width="2.3" height="4.2" rx="1.15" transform="rotate(90 12 12)"/>
  <rect x="10.85" y="1.4" width="2.3" height="4.2" rx="1.15" transform="rotate(135 12 12)"/>
  <rect x="10.85" y="1.4" width="2.3" height="4.2" rx="1.15" transform="rotate(180 12 12)"/>
  <rect x="10.85" y="1.4" width="2.3" height="4.2" rx="1.15" transform="rotate(225 12 12)"/>
  <rect x="10.85" y="1.4" width="2.3" height="4.2" rx="1.15" transform="rotate(270 12 12)"/>
  <rect x="10.85" y="1.4" width="2.3" height="4.2" rx="1.15" transform="rotate(315 12 12)"/>
  <circle cx="12" cy="12" r="7.9"/>
</g>
<circle cx="12" cy="12" r="3.35" fill="#F5F8FD"/>
<circle cx="12" cy="12" r="2.1" fill="#7189A9"/>`;

  /* ---------- 학습·자료 ---------- */
  ICONS.book = `
<defs><linearGradient id="ic-book-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#5E9DFF"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs>
<rect x="4" y="2.5" width="16" height="19" rx="3.4" fill="url(#ic-book-g)"/>
<rect x="4" y="2.5" width="3.1" height="19" rx="1.6" fill="#12307F" opacity=".55"/>
<rect x="8.6" y="4.6" width="9.4" height="14.6" rx="2" fill="#fff"/>
<rect x="10.3" y="7" width="6" height="1.3" rx=".65" fill="#C3D6F7"/>
<rect x="10.3" y="10" width="6" height="1.3" rx=".65" fill="#C3D6F7"/>
<rect x="10.3" y="13" width="3.8" height="1.3" rx=".65" fill="#C3D6F7"/>
<path d="M15.4 15.6l1 1 1.9-2.1" fill="none" stroke="#12B886" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;

  ICONS.bookWarm = ICONS.book.replace(/ic-book-g/g, 'ic-bookw-g')
    .replace('<stop offset="0" stop-color="#5E9DFF"/><stop offset="1" stop-color="#1D4ED8"/>',
      '<stop offset="0" stop-color="#FFA37B"/><stop offset="1" stop-color="#E8542E"/>')
    .replace('#12307F', '#A63A19');

  ICONS.camera = `
<defs><linearGradient id="ic-cam-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#5E9DFF"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs>
<path d="M8.6 3.1h6.8c.7 0 1.3.5 1.5 1.2l.3 1.1h1.5A2.8 2.8 0 0 1 21.5 8.2v9.3a2.8 2.8 0 0 1-2.8 2.8H5.3a2.8 2.8 0 0 1-2.8-2.8V8.2a2.8 2.8 0 0 1 2.8-2.8h1.5l.3-1.1c.2-.7.8-1.2 1.5-1.2z" fill="url(#ic-cam-g)"/>
<circle cx="12" cy="12.8" r="4.7" fill="#fff"/>
<circle cx="12" cy="12.8" r="3.25" fill="#9EC0F8"/>
<circle cx="12" cy="12.8" r="1.75" fill="#1D4ED8"/>
<circle cx="10.9" cy="11.7" r=".85" fill="#fff" opacity=".85"/>
<circle cx="18.35" cy="7.5" r="1.05" fill="#FF6B4A"/>`;

  ICONS.pencil = `
<defs><linearGradient id="ic-pen-g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#5E9DFF"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs>
<g transform="rotate(-45 12 12)">
  <rect x="9.4" y="2.2" width="5.2" height="13.6" rx="1.5" fill="url(#ic-pen-g)"/>
  <rect x="9.4" y="2.2" width="2" height="13.6" rx="1" fill="#fff" opacity=".28"/>
  <path d="M9.4 15.8h5.2l-2.6 4.4z" fill="#F7DDB2"/>
  <path d="M11.4 18.9h1.2l-.6 1.3z" fill="#334155"/>
  <rect x="9.4" y="2.2" width="5.2" height="3.2" rx="1.4" fill="#FF6B4A"/>
</g>`;

  ICONS.clock = `
<defs><linearGradient id="ic-clock-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#6EA8FF"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs>
<circle cx="12" cy="12.4" r="9.1" fill="url(#ic-clock-g)"/>
<circle cx="12" cy="12.4" r="7" fill="#fff"/>
<path d="M12 8.1v4.5l3 1.9" fill="none" stroke="#2563EB" stroke-width="1.9" stroke-linecap="round"/>
<circle cx="12" cy="12.4" r="1.15" fill="#FF6B4A"/>`;

  ICONS.target = `
<defs><linearGradient id="ic-target-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FF9B7B"/><stop offset="1" stop-color="#E8542E"/></linearGradient></defs>
<circle cx="12" cy="12" r="9.3" fill="url(#ic-target-g)"/>
<circle cx="12" cy="12" r="6.4" fill="#fff"/>
<circle cx="12" cy="12" r="3.5" fill="url(#ic-target-g)"/>
<circle cx="12" cy="12" r="1.3" fill="#fff"/>
<path d="M12 12 7 7" stroke="#334155" stroke-width="1.4" stroke-linecap="round" opacity=".35"/>`;

  /* ---------- 상태·보상 ---------- */
  ICONS.flame = `
<defs><linearGradient id="ic-flame-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFB05C"/><stop offset=".5" stop-color="#FF6B4A"/><stop offset="1" stop-color="#E03C1C"/></linearGradient>
<linearGradient id="ic-flame-i" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFEB9B"/><stop offset="1" stop-color="#FFB23F"/></linearGradient></defs>
<path d="M12.6 1.9c.4 3.1 2.5 4.6 4.1 6.5 1.9 2.2 3 3.9 3 6.4A7.7 7.7 0 0 1 12 22.5a7.7 7.7 0 0 1-7.7-7.7c0-3.1 1.8-5.2 3.4-6.7.2 1.3.8 2.3 1.8 2.8-.6-3.6.7-6.6 3.1-9z" fill="url(#ic-flame-g)"/>
<path d="M12.05 10.4c.3 2 1.7 2.7 2.5 4.1.6 1.1.9 2 .9 2.9a3.5 3.5 0 0 1-7 0c0-1.5.8-2.5 1.6-3.4.2.8.5 1.3 1.1 1.6-.3-1.9.1-3.5.9-5.2z" fill="url(#ic-flame-i)" opacity=".95"/>`;

  ICONS.check = `
<defs><linearGradient id="ic-chk-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#6BEBC6"/><stop offset="1" stop-color="#0FA97D"/></linearGradient></defs>
<circle cx="12" cy="12" r="9.5" fill="url(#ic-chk-g)"/>
<circle cx="12" cy="12" r="9.5" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1"/>
<path d="M7.2 12.3l3.2 3.3 6.4-6.9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;

  ICONS.coin = `
<defs><linearGradient id="ic-coin-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFE08E"/><stop offset=".55" stop-color="#F5B93B"/><stop offset="1" stop-color="#D8871A"/></linearGradient></defs>
<circle cx="12" cy="12" r="9.4" fill="url(#ic-coin-g)"/>
<circle cx="12" cy="12" r="6.9" fill="#FFD36E" opacity=".85"/>
<path d="m12 7.3 1.5 3.1 3.4.44-2.5 2.3.63 3.3L12 14.85l-3.03 1.63.63-3.3-2.5-2.3 3.4-.44z" fill="#B3720F"/>`;

  ICONS.gift = `
<defs><linearGradient id="ic-gift-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FF9B7B"/><stop offset="1" stop-color="#E0442B"/></linearGradient></defs>
<rect x="3.4" y="9.6" width="17.2" height="11.6" rx="2.6" fill="url(#ic-gift-g)"/>
<rect x="2.2" y="6.1" width="19.6" height="4.9" rx="2.3" fill="#FF8164"/>
<rect x="10.3" y="6.1" width="3.4" height="15.1" fill="#FFD36E"/>
<path d="M12 6.1C10.4 3.2 7.3 2.4 6.2 4.2c-1 1.7 1.5 3 5.8 1.9zM12 6.1c1.6-2.9 4.7-3.7 5.8-1.9 1 1.7-1.5 3-5.8 1.9z" fill="#FFD36E"/>
<circle cx="12" cy="6.4" r="1.5" fill="#F5B93B"/>`;

  ICONS.sword = `
<defs><linearGradient id="ic-sword-g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#DCE7F8"/><stop offset="1" stop-color="#8FA8CB"/></linearGradient></defs>
<path d="M19.6 2.4l1.9 1.9-9.6 9.7-1.9-1.9z" fill="url(#ic-sword-g)"/>
<path d="M19.6 2.4l1.9 1.9-1.1 1.1-1.9-1.9z" fill="#fff" opacity=".7"/>
<path d="M8.3 10.4l3.3 3.3-1.5 1.5-3.3-3.3z" fill="#F5B93B"/>
<path d="M6.4 13.1l-1.9 1.9 4.5 4.5 1.9-1.9z" fill="#FF6B4A"/>
<circle cx="5.9" cy="18.1" r="1.6" fill="#F5B93B"/>`;

  ICONS.users = `
<defs><linearGradient id="ic-users-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E9DFF"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient>
<linearGradient id="ic-users-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6BEBC6"/><stop offset="1" stop-color="#0FA97D"/></linearGradient></defs>
<circle cx="9.2" cy="7.4" r="3.5" fill="url(#ic-users-c)"/>
<path d="M2.6 19.4c0-3.5 2.9-5.9 6.6-5.9s6.6 2.4 6.6 5.9c0 .8-.7 1.4-1.5 1.4H4.1c-.8 0-1.5-.6-1.5-1.4z" fill="url(#ic-users-c)"/>
<circle cx="17.3" cy="8.6" r="2.75" fill="url(#ic-users-m)"/>
<path d="M15 13.6c3.1-.5 6.4 1.3 6.4 4.4 0 .7-.6 1.3-1.3 1.3h-3.2c.2-.5.3-1 .3-1.5 0-1.7-.8-3.1-2.2-4.2z" fill="url(#ic-users-m)"/>`;

  ICONS.castle = `
<defs><linearGradient id="ic-castle-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#6EA8FF"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs>
<rect x="3.2" y="8.4" width="4.6" height="12.8" rx="1.6" fill="url(#ic-castle-g)"/>
<rect x="16.2" y="8.4" width="4.6" height="12.8" rx="1.6" fill="url(#ic-castle-g)"/>
<rect x="3.2" y="6" width="1.8" height="3.4" fill="#5E9DFF"/><rect x="5.9" y="6" width="1.8" height="3.4" fill="#5E9DFF"/>
<rect x="16.2" y="6" width="1.8" height="3.4" fill="#5E9DFF"/><rect x="18.9" y="6" width="1.8" height="3.4" fill="#5E9DFF"/>
<rect x="7.6" y="11.4" width="8.8" height="9.8" rx="1.8" fill="url(#ic-castle-g)"/>
<path d="M7.6 5.9 12 2.4l4.4 3.5z" fill="#FF6B4A"/>
<path d="M10.2 21.2v-4.1a1.8 1.8 0 0 1 3.6 0v4.1z" fill="#FFD36E"/>
<circle cx="12" cy="14.2" r="1.15" fill="#fff" opacity=".9"/>`;

  ICONS.alert = `
<defs><linearGradient id="ic-alert-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFC46B"/><stop offset="1" stop-color="#E8862B"/></linearGradient></defs>
<path d="M10.4 3.5a1.9 1.9 0 0 1 3.2 0l7.6 13.2c.7 1.2-.2 2.7-1.6 2.7H4.4c-1.4 0-2.3-1.5-1.6-2.7z" fill="url(#ic-alert-g)"/>
<rect x="11" y="8.1" width="2" height="5.6" rx="1" fill="#fff"/>
<circle cx="12" cy="16.4" r="1.25" fill="#fff"/>`;

  ICONS.help = `
<defs><linearGradient id="ic-help-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#8FB6FF"/><stop offset="1" stop-color="#2563EB"/></linearGradient></defs>
<circle cx="12" cy="12" r="9.4" fill="url(#ic-help-g)"/>
<path d="M9.1 9.4c0-1.7 1.3-3 2.9-3s2.9 1.2 2.9 2.7c0 1.2-.7 1.9-1.7 2.5-.9.5-1.2 1-1.2 2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
<circle cx="12" cy="17.1" r="1.3" fill="#fff"/>`;

  ICONS.sparkle = `
<defs><linearGradient id="ic-spark-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#8CF3D6"/><stop offset="1" stop-color="#0FA97D"/></linearGradient></defs>
<path d="M12 2.2l2.1 6.1 6.1 2.1-6.1 2.1L12 18.6l-2.1-6.1L3.8 10.4l6.1-2.1z" fill="url(#ic-spark-g)"/>
<path d="M18.6 15.2l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="url(#ic-spark-g)" opacity=".8"/>`;

  ICONS.phone = `
<defs><linearGradient id="ic-phone-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#5E9DFF"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs>
<rect x="5.1" y="1.9" width="13.8" height="20.2" rx="4" fill="url(#ic-phone-g)"/>
<rect x="6.9" y="3.9" width="10.2" height="14.6" rx="2" fill="#fff"/>
<rect x="9.6" y="2.6" width="4.8" height=".9" rx=".45" fill="#fff" opacity=".65"/>
<circle cx="12" cy="20.1" r="1.15" fill="#fff" opacity=".9"/>
<path d="M9.1 7.4h1.1l.8 1.9-.9.7c.5 1.2 1.3 2 2.5 2.5l.7-.9 1.9.8v1.1c0 .6-.6 1.1-1.2 1-2.6-.3-4.6-2.3-4.9-4.9-.1-.6.4-1.2 1-1.2z" fill="#F5B93B"/>`;

  ICONS.medal = `
<defs><linearGradient id="ic-medal-g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFDD86"/><stop offset="1" stop-color="#D8871A"/></linearGradient></defs>
<path d="M6.2 2.2h11.6l-3 7.4H9.2z" fill="#5E9DFF"/>
<circle cx="12" cy="14.6" r="6.7" fill="url(#ic-medal-g)"/>
<circle cx="12" cy="14.6" r="4.4" fill="#fff" opacity=".9"/>
<path d="m12 11.5 1.1 2.2 2.4.3-1.8 1.7.45 2.4-2.15-1.2-2.15 1.2.45-2.4-1.8-1.7 2.4-.3z" fill="#E9A521"/>`;

  /* 이모지 → 아이콘 (기존 마크업을 그대로 두고 아이콘만 바꿀 때) */
  const EMAP = {
    '🔥': 'flame', '🐾': 'paw', '🏆': 'trophy', '📊': 'chart', '📋': 'clipboard',
    '⭐': 'star', '⚙️': 'gear', '⚙': 'gear', '✅': 'check', '✔️': 'check',
    '📘': 'book', '📙': 'bookWarm', '📖': 'book', '📚': 'book', '📝': 'pencil',
    '📸': 'camera', '📷': 'camera', '🪙': 'coin', '💰': 'coin', '🎁': 'gift',
    '🛍️': 'gift', '⚔️': 'sword', '⚔': 'sword', '🏰': 'castle', '👀': 'users',
    '🎯': 'target', '⏰': 'clock', '⏳': 'clock', '❓': 'help', '⚠️': 'alert',
    '⚠': 'alert', '🏅': 'medal', '✨': 'sparkle', '📲': 'phone', '📱': 'phone'
  };

  function html(name, cls) {
    const body = ICONS[name];
    if (!body) return '';
    return `<svg class="svic sv-${name}${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  }
  function has(name) { return !!ICONS[name]; }
  function em(ch) { const n = EMAP[ch]; return n ? html(n) : ''; }

  window.EMA = window.EMA || {};
  window.EMA.icons = { html, has, em, names: Object.keys(ICONS) };
})();
