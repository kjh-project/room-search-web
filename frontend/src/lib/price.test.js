import { describe, expect, it } from 'vitest';
import { comparePrice, regionAverage, verdictText, ymLabel } from './price.js';
import { haversine } from './geo.js';

describe('regionAverage', () => {
  it('최근 3개월을 거래 건수로 가중 평균한다', () => {
    const trend = [
      { ym: '2026-06', avg_rent: 999, avg_deposit: 9999, count: 99 }, // 3개월 밖 → 제외
      { ym: '2026-07', avg_rent: 100, avg_deposit: 9999, count: 50 },
      { ym: '2026-08', avg_rent: 40, avg_deposit: 500, count: 10 },
      { ym: '2026-09', avg_rent: 50, avg_deposit: 1000, count: 30 },
      { ym: '2026-10', avg_rent: 45, avg_deposit: 700, count: 0 }, // 거래 없는 달은 건너뜀
    ];
    // 거래 0건인 10월을 빼면 마지막 3개월 = 07, 08, 09
    const avg = regionAverage(trend);
    expect(avg.count).toBe(90);
    expect(avg.avgRent).toBeCloseTo((100 * 50 + 40 * 10 + 50 * 30) / 90, 1);
  });
  it('데이터가 없으면 null', () => {
    expect(regionAverage([])).toBeNull();
    expect(regionAverage(undefined)).toBeNull();
  });
});

describe('comparePrice / verdictText', () => {
  it('저렴', () => {
    const c = comparePrice(40, 50);
    expect(c).toEqual({ pct: 20, direction: 'cheaper' });
    expect(verdictText(c)).toBe('월세가 주변 평균 시세 대비 약 20% 저렴');
  });
  it('비쌈', () => {
    expect(comparePrice(60, 50)).toEqual({ pct: 20, direction: 'pricier' });
  });
  it('±3% 미만은 비슷', () => {
    expect(comparePrice(51, 50).direction).toBe('similar');
  });
  it('평균 없으면 null', () => {
    expect(comparePrice(40, 0)).toBeNull();
    expect(verdictText(null)).toContain('부족');
  });
});

describe('기타', () => {
  it('ymLabel', () => expect(ymLabel('2026-03')).toBe('26.3월'));
  it('haversine: 위도 0.01도 ≈ 1.11km', () => {
    expect(Math.round(haversine(35, 129, 35.01, 129))).toBeGreaterThan(1100);
    expect(Math.round(haversine(35, 129, 35.01, 129))).toBeLessThan(1120);
  });
});
