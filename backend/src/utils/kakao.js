// 주소 -> 좌표 + 법정동 코드 (카카오 로컬 API, 서버에서만 호출)
async function geocode(address) {
  const url = 'https://dapi.kakao.com/v2/local/search/address.json?query=' + encodeURIComponent(address);
  const res = await fetch(url, {
    headers: { Authorization: 'KakaoAK ' + process.env.KAKAO_REST_API_KEY },
  });
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

module.exports = { geocode };
