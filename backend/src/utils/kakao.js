// 카카오 로컬 API (서버에서만 호출, REST API 키는 .env의 KAKAO_REST_API_KEY)
const headers = () => ({ Authorization: 'KakaoAK ' + process.env.KAKAO_REST_API_KEY });

// 주소 -> 좌표 + 법정동 코드 (SFR-012 매물 등록)
async function geocode(address) {
  const url = 'https://dapi.kakao.com/v2/local/search/address.json?query=' + encodeURIComponent(address);
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error('카카오 주소 검색 실패: ' + res.status);
  const data = await res.json();
  const doc = data.documents && data.documents[0];
  if (!doc) return null;
  const bCode = doc.address && doc.address.b_code; // 10자리 법정동 코드
  return {
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
    lawd_cd: bCode ? bCode.slice(0, 5) : null,
  };
}

// 장소 이름(키워드) -> 후보 장소 목록 (SFR-004 중심지 검색)
async function searchPlaces(query, size = 5) {
  const url =
    'https://dapi.kakao.com/v2/local/search/keyword.json?query=' +
    encodeURIComponent(query) + '&size=' + size;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error('카카오 장소 검색 실패: ' + res.status);
  const data = await res.json();
  return (data.documents || []).map((d) => ({
    name: d.place_name,
    address: d.address_name,
    roadAddress: d.road_address_name || null,
    category: d.category_group_name || null,
    lat: parseFloat(d.y),
    lng: parseFloat(d.x),
  }));
}

module.exports = { geocode, searchPlaces };
