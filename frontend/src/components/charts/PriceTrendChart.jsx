/**
 * SFR-005 추이 그래프: 최근 N개월 월별 평균 월세 (꺾은선) — "시간에 따른 변동성"
 * 선택 매물 월세를 기준선(ReferenceLine)으로 함께 표시.
 */
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ymLabel } from '../../lib/price.js';

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{r.ym}</strong>
      <div>평균 월세 {r.avg_rent}만원</div>
      <div>평균 보증금 {Number(r.avg_deposit).toLocaleString()}만원</div>
      <div className="muted">거래 {r.count}건</div>
    </div>
  );
}

export default function PriceTrendChart({ trend, myRent }) {
  if (!trend?.length) return <p className="muted">해당 지역의 실거래 데이터가 없어요.</p>;
  const data = trend.map((r) => ({ ...r, label: ymLabel(r.ym) }));
  const values = data.map((d) => d.avg_rent).concat(myRent ?? []);
  const min = Math.floor(Math.min(...values) - 3);
  const max = Math.ceil(Math.max(...values) + 3);

  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
        <YAxis domain={[min, max]} tickLine={false} axisLine={false} fontSize={11} width={48} unit="만" />
        <Tooltip content={<TrendTooltip />} />
        {myRent != null && (
          <ReferenceLine
            y={myRent} stroke="#3b6ef5" strokeDasharray="4 4"
            label={{ value: `이 매물 ${myRent}만`, position: 'insideTopRight', fill: '#3b6ef5', fontSize: 11 }}
          />
        )}
        <Line
          type="monotone" dataKey="avg_rent" name="평균 월세" stroke="#e8590c" strokeWidth={2.5}
          dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
