/**
 * SFR-005 비교 그래프: 선택 매물 vs 지역 평균 (막대)
 * 월세(수십 만원)와 보증금(수백~수천 만원)은 단위 차이가 커서 차트를 둘로 나눈다.
 */
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = { mine: '#3b6ef5', avg: '#b8c0cc' };

function MiniBar({ title, mine, avg }) {
  const data = [
    { name: '이 매물', value: mine, key: 'mine' },
    { name: '지역 평균', value: avg, key: 'avg' },
  ];
  return (
    <div className="mini-chart">
      <div className="mini-title">{title} (만원)</div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={48} />
          <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}만원`, title]} cursor={{ fill: '#f5f7fa' }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.key} fill={COLORS[d.key]} />)}
            <LabelList dataKey="value" position="top" fontSize={12} formatter={(v) => Number(v).toLocaleString()} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PriceCompareChart({ listing, average }) {
  if (!average) return <p className="muted">비교할 지역 시세 데이터가 없어요.</p>;
  return (
    <div className="compare-grid">
      <MiniBar title="월세" mine={listing.rent} avg={average.avgRent} />
      <MiniBar title="보증금" mine={listing.deposit} avg={average.avgDeposit} />
    </div>
  );
}
