/**
 * 서버(Express, ../backend)와 주고받는 모든 요청을 여기 모아 둔다.
 * .env 가 없거나 VITE_USE_MOCK 이 false 가 아니면 서버 없이 mock.js 데이터를 돌려준다.
 *
 * ── 종환 님 backend 와 연결되는 API ──
 * GET  /api/listings?lat&lng&radius&maxRent&maxDeposit&roomType&sort
 *      → [{ id, title, address, lat, lng, lawd_cd, deposit, rent, area, room_type, distance }]
 * GET  /api/listings/mine (JWT)
 * GET  /api/infra?lat&lng&radius  (서버에 없으면 브라우저 카카오 SDK 로 대체)
 *
 * ── 준희 담당 backend 라우트 ──
 * POST /api/auth/:provider { code, redirectUri } → { token, user }   (routes/auth.js)
 * GET  /api/me                                                       (routes/auth.js)
 * GET/POST/DELETE /api/favorites[/:listingId]                        (routes/favorites.js)
 * GET  /api/prices/trend?lawdCd&months → [{ ym, avg_rent, avg_deposit, count }] (routes/prices.js)
 *
 * 서버는 매물 PK 를 id, 거리를 distance 로 주므로 화면용으로 listing_id, distance_m 으로 맞춰 쓴다.
 */
import * as mock from './mock.js';

// .env 가 없거나 값이 비어 있으면 목업 모드. 실제 서버에 붙일 때만 VITE_USE_MOCK=false 로 지정.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const TOKEN_KEY = 'jachui_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, query } = {}) {
  const qs = query
    ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
    : '';
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}${qs}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) tokenStore.clear(); // 만료된 토큰 정리
  if (!res.ok) {
    let msg = `요청 실패 (${res.status})`;
    try { const j = await res.json(); msg = j.error || j.message || msg; } catch { /* 본문 없음 */ }
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? null : res.json();
}

/** 서버 응답(id, distance) → 화면에서 쓰는 이름(listing_id, distance_m) */
const toListing = (r) => ({
  ...r,
  listing_id: r.listing_id ?? r.id,
  distance_m: r.distance_m ?? r.distance,
  deposit: Number(r.deposit),
  rent: Number(r.rent),
  area: Number(r.area),
});
const toListings = (p) => p.then((rows) => rows.map(toListing));

export const api = {
  // SFR-001
  loginWithCode: (provider, code, redirectUri) =>
    USE_MOCK ? mock.login(provider) : request(`/auth/${provider}`, { method: 'POST', body: { code, redirectUri } }),
  me: () => (USE_MOCK ? mock.me() : request('/me')),
  getFavorites: () => (USE_MOCK ? mock.getFavorites() : toListings(request('/favorites'))),
  addFavorite: (id) => (USE_MOCK ? mock.addFavorite(id) : request(`/favorites/${id}`, { method: 'POST' })),
  removeFavorite: (id) => (USE_MOCK ? mock.removeFavorite(id) : request(`/favorites/${id}`, { method: 'DELETE' })),
  getMyListings: () => (USE_MOCK ? mock.getMyListings() : toListings(request('/listings/mine'))),

  // SFR-002 (종환) → SFR-003 지도 핀
  getListings: (params) => (USE_MOCK ? mock.getListings(params) : toListings(request('/listings', { query: params }))),
  getInfra: (params) => (USE_MOCK ? mock.getInfra(params) : request('/infra', { query: params })),

  // SFR-002 price_cache → SFR-005 그래프
  getPriceTrend: (params) => (USE_MOCK ? mock.getPriceTrend(params) : request('/prices/trend', { query: params })),
};
