/* 실행 설정 — 이 파일만 바꾸면 로컬 테스트 ↔ 시트 연동을 전환합니다. */
window.EMA_CONFIG = {
  // 'local' = 이 브라우저에만 저장(지금 바로 테스트용)
  // 'api'   = 관리시트(GApps Script Web App)와 연결
  mode: 'local',
  apiUrl: '',                 // 예: 'https://script.google.com/macros/s/AKfy.../exec'
  classId: 'c4m2',            // 시범 반: 초4마스터(2)
  version: '0.2 (시제품 · ⭕/❌ 3단계)'
};
