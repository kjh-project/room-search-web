/**
 * SFR-005 시세 계산 로직 (화면과 분리해서 테스트 가능하게)
 */

/** 주변 평균으로 쓸 최근 개월 수. 실거래는 시차가 있어 1개월만 쓰면 표본이 적다. */
export const RECENT_MONTHS = 3;
/** 이 범위(%) 안이면 "비슷함"으로 판정 */
export const SIMILAR_BAND = 3;

/** 최근 n개월을 거래 건수로 가중 평균 → { avgRent, avgDeposit, count } */
export function regionAverage(trend, n = RECENT_MONTHS) {
  const rows = (trend || []).filter((r) => r.count > 0).slice(-n);
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (!total) return null;
  const w = (key) => rows.reduce((s, r) => s + r[key] * r.count, 0) / total;
  return { avgRent: round1(w('avg_rent')), avgDeposit: Math.round(w('avg_deposit')), count: total };
}

/** 매물 값과 평균 비교 → { pct, direction: 'cheaper'|'pricier'|'similar' } */
export function comparePrice(value, avg) {
  if (value == null || !avg) return null;
  const pct = ((value - avg) / avg) * 100;
  const direction = Math.abs(pct) < SIMILAR_BAND ? 'similar' : pct < 0 ? 'cheaper' : 'pricier';
  return { pct: Math.round(Math.abs(pct)), direction };
}

/** 화면에 띄울 판정 문구: "주변 평균 시세 대비 약 12% 저렴" */
export function verdictText(cmp, label = '월세') {
  if (!cmp) return `${label} 비교 데이터가 부족해요`;
  if (cmp.direction === 'similar') return `${label}가 주변 평균 시세와 비슷해요`;
  return `${label}가 주변 평균 시세 대비 약 ${cmp.pct}% ${cmp.direction === 'cheaper' ? '저렴' : '비쌈'}`;
}

/** 'YYYY-MM' → 'YY.M월' 축 라벨 */
export function ymLabel(ym) {
  const [y, m] = ym.split('-');
  return `${y.slice(2)}.${Number(m)}월`;
}

const round1 = (x) => Math.round(x * 10) / 10;
