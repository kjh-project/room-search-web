/**
 * SFR-005 시세 그래프용 조회 API (읽기 전용) — 담당 최준희
 *   GET /api/prices/trend?lawdCd=26230&months=12
 *   → [{ ym: '2025-11', avg_rent, avg_deposit, count }]  (오래된 달 → 최근 달 순)
 *
 * price_cache 를 채우는 수집 로직(SFR-002)은 종환 님 담당. 여기서는 읽기만 한다.
 * price_cache 에 방 유형 구분이 없어서 roomType 파라미터는 현재 무시한다.
 */
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/trend', async (req, res) => {
  const lawdCd = String(req.query.lawdCd || '');
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 12, 1), 24);
  if (!/^\d{5}$/.test(lawdCd)) return res.status(400).json({ error: 'lawdCd(법정동 코드 5자리)가 필요합니다.' });
  try {
    const [rows] = await db.query(
      `SELECT deal_ym, avg_rent, avg_deposit, sample_count
         FROM price_cache
        WHERE lawd_cd = ?
        ORDER BY deal_ym DESC
        LIMIT ?`,
      [lawdCd, months]
    );
    res.json(rows.reverse().map((r) => ({
      ym: `${r.deal_ym.slice(0, 4)}-${r.deal_ym.slice(4, 6)}`,
      avg_rent: r.avg_rent,
      avg_deposit: r.avg_deposit,
      count: r.sample_count,
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '시세 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
