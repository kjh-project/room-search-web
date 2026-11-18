/** 최근 조회 매물 — 브라우저(localStorage)에 최대 20개 저장. DB 테이블 추가 없이 마이페이지에 표시. */
const KEY = 'jachui_recent';
const MAX = 20;

export function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function pushRecent(listing) {
  const { listing_id, title, address, deposit, rent, room_type } = listing;
  const next = [{ listing_id, title, address, deposit, rent, room_type, viewed_at: Date.now() },
    ...getRecent().filter((l) => l.listing_id !== listing_id)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 저장 실패 무시 */ }
}
