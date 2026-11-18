/**
 * SFR-001 마이페이지 관심 매물(찜) — 담당 최준희. 모두 JWT 필요
 *   GET    /api/favorites              내 찜 목록 (매물 정보 포함)
 *   POST   /api/favorites/:listingId   찜 추가 (이미 있으면 그대로 204)
 *   DELETE /api/favorites/:listingId   찜 해제
 */
const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

function parseId(req, res) {
  const id = Number(req.params.listingId);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: '잘못된 매물 번호입니다.' });
    return null;
  }
  return id;
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.id, l.title, l.address, l.lat, l.lng, l.deposit, l.rent, l.area, l.room_type, l.lawd_cd,
              l.image_path, f.created_at AS favorited_at
         FROM favorites f JOIN listings l ON l.id = f.listing_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '관심 매물 조회 중 오류가 발생했습니다.' });
  }
});

router.post('/:listingId', async (req, res) => {
  const id = parseId(req, res);
  if (!id) return;
  try {
    await db.query('INSERT IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)', [req.user.id, id]);
    res.status(204).end();
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ error: '매물을 찾을 수 없습니다.' });
    console.error(e);
    res.status(500).json({ error: '찜 처리 중 오류가 발생했습니다.' });
  }
});

router.delete('/:listingId', async (req, res) => {
  const id = parseId(req, res);
  if (!id) return;
  try {
    await db.query('DELETE FROM favorites WHERE user_id = ? AND listing_id = ?', [req.user.id, id]);
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '찜 해제 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
