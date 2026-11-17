/**
 * 서버가 준비되기 전 화면 개발·발표 시연용 가짜 데이터.
 * 동의대학교(부산진구 가야동, 법정동 앞 5자리 26230) 주변 기준.
 */
import { haversine } from '../lib/geo.js';

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const BASE = { lat: 35.1446, lng: 129.0343 };

// 시드 고정 난수 → 새로고침해도 같은 데이터
let seed = 7;
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

const ROOM_TYPES = ['원룸', '투룸', '오피스텔'];
const LISTINGS = Array.from({ length: 24 }, (_, i) => {
  const room_type = ROOM_TYPES[i % 3];
  const base = room_type === '원룸' ? 38 : room_type === '투룸' ? 55 : 48;
  return {
    listing_id: i + 1,
    title: `${['가야', '개금', '당감', '부암'][i % 4]}동 ${room_type} ${i + 1}호`,
    address: `부산광역시 부산진구 ${['가야동', '개금동', '당감동', '부암동'][i % 4]} ${100 + i}-${i % 7}`,
    lat: BASE.lat + (rand() - 0.5) * 0.03,
    lng: BASE.lng + (rand() - 0.5) * 0.035,
    deposit: [300, 500, 1000, 2000][Math.floor(rand() * 4)],
    rent: Math.round(base + (rand() - 0.5) * 20),
    area: Math.round(16 + rand() * 30),
    room_type,
    lawd_cd: '26230',
  };
});

const INFRA_SEED = {
  subway: [
    { name: '가야역 2호선', lat: 35.1555, lng: 129.0440 },
    { name: '동의대역 1호선', lat: 35.1593, lng: 129.0371 },
    { name: '개금역 2호선', lat: 35.1527, lng: 129.0214 },
  ],
  convenience: Array.from({ length: 10 }, (_, i) => ({
    name: `편의점 ${['CU', 'GS25', '세븐일레븐'][i % 3]} ${i + 1}호점`,
    lat: BASE.lat + (rand() - 0.5) * 0.025,
    lng: BASE.lng + (rand() - 0.5) * 0.03,
  })),
  mart: [
    { name: '홈플러스 가야점', lat: 35.1531, lng: 129.0412 },
    { name: '이마트 메트로 개금점', lat: 35.1488, lng: 129.0251 },
  ],
};

let favorites = new Set([2, 5]);

export async function getListings({ lat, lng, radius, maxRent, maxDeposit, roomType, sort = 'distance' }) {
  await wait();
  let rows = LISTINGS.map((l) => ({ ...l, distance_m: Math.round(haversine(lat, lng, l.lat, l.lng)) }))
    .filter((l) => l.distance_m <= radius)
    .filter((l) => !maxRent || l.rent <= Number(maxRent))
    .filter((l) => !maxDeposit || l.deposit <= Number(maxDeposit))
    .filter((l) => !roomType || l.room_type === roomType);
  rows.sort(sort === 'price' ? (a, b) => a.rent - b.rent : (a, b) => a.distance_m - b.distance_m);
  return rows;
}

export async function getInfra({ lat, lng, radius }) {
  await wait(150);
  const out = {};
  for (const [k, list] of Object.entries(INFRA_SEED)) {
    out[k] = list
      .map((p, i) => ({ id: `${k}-${i}`, ...p, distance_m: Math.round(haversine(lat, lng, p.lat, p.lng)) }))
      .filter((p) => p.distance_m <= radius)
      .sort((a, b) => a.distance_m - b.distance_m);
  }
  return out;
}

export async function getPriceTrend({ months = 12, roomType }) {
  await wait();
  const bump = roomType === '투룸' ? 14 : roomType === '오피스텔' ? 8 : 0;
  const end = new Date(2026, 9, 1); // 2026-10 (실거래 신고 시차 고려)
  return Array.from({ length: Number(months) }, (_, i) => {
    const d = new Date(end.getFullYear(), end.getMonth() - (months - 1 - i), 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const season = [2, 3, 8].includes(d.getMonth()) ? 3 : 0; // 개강 시즌 상승
    return {
      ym,
      avg_rent: Math.round(40 + bump + i * 0.35 + season + Math.sin(i) * 1.5),
      avg_deposit: Math.round(700 + i * 10 + Math.cos(i) * 60),
      count: 20 + Math.round(Math.abs(Math.sin(i * 1.3)) * 25),
    };
  });
}

const MOCK_USER = { id: 1, nickname: '최준희', provider: 'kakao' };
export async function login(provider) { await wait(); return { token: 'mock-token', user: { ...MOCK_USER, provider } }; }
export async function me() { await wait(50); return MOCK_USER; }
export async function getFavorites() { await wait(); return LISTINGS.filter((l) => favorites.has(l.listing_id)); }
export async function addFavorite(id) { await wait(50); favorites.add(Number(id)); return null; }
export async function removeFavorite(id) { await wait(50); favorites.delete(Number(id)); return null; }
export async function getMyListings() { await wait(); return LISTINGS.slice(0, 2); }
