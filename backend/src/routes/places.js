/**
 * SFR-004 중심지 검색
 *   GET /api/places/search?query=동의대
 *   → [{ name, address, roadAddress, category, lat, lng }]  (최대 5개)
 * 사용자가 후보 중 하나를 고르면 그 lat/lng 로 GET /api/listings?lat=&lng=&radius= 를 호출한다.
 */
const express = require('express');
const { searchPlaces } = require('../utils/kakao');

const router = express.Router();

router.get('/search', async (req, res) => {
  const query = String(req.query.query || '').trim();
  if (!query) return res.status(400).json({ error: 'query 가 필요합니다.' });
  if (query.length > 50) return res.status(400).json({ error: 'query 는 50자 이하여야 합니다.' });
  try {
    res.json(await searchPlaces(query));
  } catch (e) {
    console.error(e.message);
    res.status(502).json({ error: '장소 검색 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
