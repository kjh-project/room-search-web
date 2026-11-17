/**
 * 카카오맵 JS SDK 로더 + 로컬 API(SDK services) 도우미.
 * 카카오 디벨로퍼스 > 플랫폼 > Web 에 http://localhost:5173 과 배포 도메인을 꼭 등록할 것.
 */
let loading = null;

export function loadKakao() {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  if (loading) return loading;
  const key = import.meta.env.VITE_KAKAO_JS_KEY;
  if (!key || key.startsWith('여기에')) {
    return Promise.reject(new Error('.env 에 VITE_KAKAO_JS_KEY 를 넣어 주세요.'));
  }
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`;
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    s.onerror = () => {
      loading = null;
      reject(new Error('카카오맵 SDK를 불러오지 못했습니다. 앱 키와 Web 플랫폼 도메인 등록을 확인하세요.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** 카카오 로컬 카테고리 코드 */
export const INFRA_CATEGORIES = {
  subway: 'SW8', // 지하철역
  convenience: 'CS2', // 편의점
  mart: 'MT1', // 대형마트
};

/**
 * 서버 /api/infra 가 아직 없을 때 쓰는 대체 경로: 브라우저에서 SDK 로 직접 카테고리 검색.
 * (계획서상 정식 경로는 서버 중계·캐싱)
 */
export async function searchInfraWithSdk({ lat, lng, radius }) {
  const kakao = await loadKakao();
  const places = new kakao.maps.services.Places();
  const r = Math.min(radius, 20000); // 카카오 최대 20km
  const one = (code) =>
    new Promise((resolve) => {
      places.categorySearch(
        code,
        (data, status) => {
          if (status !== kakao.maps.services.Status.OK) return resolve([]);
          resolve(data.map((p) => ({
            id: p.id, name: p.place_name, lat: Number(p.y), lng: Number(p.x), distance_m: Number(p.distance),
          })));
        },
        { location: new kakao.maps.LatLng(lat, lng), radius: r, sort: kakao.maps.services.SortBy.DISTANCE }
      );
    });
  const entries = await Promise.all(Object.entries(INFRA_CATEGORIES).map(async ([k, code]) => [k, await one(code)]));
  return Object.fromEntries(entries);
}

/** 키워드로 중심지 검색 (예: "동의대학교") */
export async function searchKeyword(query) {
  const kakao = await loadKakao();
  const places = new kakao.maps.services.Places();
  return new Promise((resolve) => {
    places.keywordSearch(query, (data, status) => {
      if (status !== kakao.maps.services.Status.OK) return resolve([]);
      resolve(data.slice(0, 5).map((p) => ({ name: p.place_name, address: p.address_name, lat: Number(p.y), lng: Number(p.x) })));
    });
  });
}

/** 좌표 → 법정동 코드 앞 5자리 (매물에 lawd_cd 가 없을 때 대체용) */
export async function coordToLawdCd(lat, lng) {
  const kakao = await loadKakao();
  const geocoder = new kakao.maps.services.Geocoder();
  return new Promise((resolve) => {
    geocoder.coord2RegionCode(lng, lat, (result, status) => {
      if (status !== kakao.maps.services.Status.OK) return resolve(null);
      const b = result.find((r) => r.region_type === 'B');
      resolve(b ? b.code.slice(0, 5) : null);
    });
  });
}
