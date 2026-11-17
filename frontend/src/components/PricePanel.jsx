/**
 * SFR-005 시세 패널: 판정 문구 + 비교 막대 + 월별 추이.
 * 기간(6/12개월)·지역(매물의 lawd_cd)이 바뀌면 다시 조회한다.
 */
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { coordToLawdCd } from '../lib/kakao.js';
import { comparePrice, regionAverage, RECENT_MONTHS, verdictText } from '../lib/price.js';
import PriceCompareChart from './charts/PriceCompareChart.jsx';
import PriceTrendChart from './charts/PriceTrendChart.jsx';

export default function PricePanel({ listing }) {
  const [months, setMonths] = useState(12);
  const [trend, setTrend] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setTrend(null);
    setError(null);
    (async () => {
      try {
        const lawdCd = listing.lawd_cd || (await coordToLawdCd(listing.lat, listing.lng));
        if (!lawdCd) throw new Error('매물의 법정동 코드를 찾지 못했어요.');
        const rows = await api.getPriceTrend({ lawdCd, months, roomType: listing.room_type });
        if (alive) setTrend(rows);
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => { alive = false; };
  }, [listing.listing_id, listing.lawd_cd, listing.lat, listing.lng, listing.room_type, months]);

  const avg = trend ? regionAverage(trend) : null;
  const rentCmp = avg ? comparePrice(listing.rent, avg.avgRent) : null;
  const depCmp = avg ? comparePrice(listing.deposit, avg.avgDeposit) : null;

  return (
    <section className="price-panel">
      <div className="panel-head">
        <h3>시세 비교</h3>
        <div className="seg">
          {[6, 12].map((m) => (
            <button key={m} className={months === m ? 'on' : ''} onClick={() => setMonths(m)}>{m}개월</button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!trend && !error && <p className="muted">시세 불러오는 중…</p>}

      {trend && (
        <>
          <div className={`verdict ${rentCmp?.direction || ''}`}>
            {verdictText(rentCmp, '월세')}
            <div className="sub">{verdictText(depCmp, '보증금')}</div>
          </div>
          <PriceCompareChart listing={listing} average={avg} />
          <h4>월별 평균 월세 추이 · {listing.room_type}</h4>
          <PriceTrendChart trend={trend} myRent={listing.rent} />
          <p className="footnote">
            출처: 국토교통부 전월세 실거래가(공공데이터포털). 지역 평균은 최근 {RECENT_MONTHS}개월 거래
            {avg ? ` ${avg.count}건` : ''}의 가중 평균이며, 신고 시차로 최근 1~2개월은 표본이 적을 수 있어요.
          </p>
        </>
      )}
    </section>
  );
}
