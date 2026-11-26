// 매물 주변 생활 인프라 (카카오 로컬 API 카테고리 검색): 반경 안 개수 + 가장 가까운 곳까지 거리
const BASE = 'https://dapi.kakao.com/v2/local/search/category.json';
const TARGETS = [
  { key: 'subway', label: '지하철역', code: 'SW8', radius: 1000 },
  { key: 'mart', label: '대형마트', code: 'MT1', radius: 1000 },
  { key: 'convenience', label: '편의점', code: 'CS2', radius: 500 },
  { key: 'pharmacy', label: '약국', code: 'PM9', radius: 500 },
];

async function one(t, lat, lng) {
  const qs = new URLSearchParams({
    category_group_code: t.code, x: String(lng), y: String(lat),
    radius: String(t.radius), sort: 'distance', size: '1',
  });
  const res = await fetch(`${BASE}?${qs}`, {
    headers: { Authorization: 'KakaoAK ' + process.env.KAKAO_REST_API_KEY },
  });
  if (!res.ok) throw new Error(`${t.label} 검색 실패 ${res.status}`);
  const data = await res.json();
  const first = data.documents && data.documents[0];
  return {
    label: t.label,
    radius: t.radius,
    count: (data.meta && data.meta.total_count) || 0,
    nearestM: first ? Number(first.distance) : null,
  };
}

// 일부 실패해도 나머지는 사용. 전부 실패하면 null
async function countNearby(lat, lng) {
  const results = await Promise.allSettled(TARGETS.map((t) => one(t, lat, lng)));
  const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  results.filter((r) => r.status === 'rejected').forEach((r) => console.error(r.reason.message));
  return ok.length ? ok : null;
}

module.exports = { countNearby };
