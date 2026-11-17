const db = require('../db');

// 입력 월세가 해당 지역 최근 12개월 평균에서 크게 벗어나면 경고 문구 반환 (SFR-012)
// price_cache는 SFR-003에서 채워짐. 데이터가 없으면 경고 없음.
async function rentWarning(lawd_cd, rent) {
  if (!lawd_cd) return null;
  const [rows] = await db.query(
    `SELECT AVG(avg_rent) AS m FROM (
       SELECT avg_rent FROM price_cache
       WHERE lawd_cd = ? AND avg_rent IS NOT NULL
       ORDER BY deal_ym DESC LIMIT 12) t`,
    [lawd_cd]
  );
  const mean = rows[0] && rows[0].m;
  if (!mean) return null;
  if (rent > mean * 1.5) return `입력한 월세가 지역 평균(약 ${Math.round(mean)}만원)보다 매우 높습니다.`;
  if (rent < mean * 0.5) return `입력한 월세가 지역 평균(약 ${Math.round(mean)}만원)보다 매우 낮습니다.`;
  return null;
}

module.exports = { rentWarning };
