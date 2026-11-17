const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');
const { geocode } = require('../utils/kakao');
const { rentWarning } = require('../utils/priceCheck');

const router = express.Router();

// ---- 이미지 업로드: 형식·용량 검증 (SIR-002) ----
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error('jpg/png/webp 이미지만 업로드할 수 있습니다.')),
});

const ROOM_TYPES = ['원룸', '투룸', '오피스텔', '기타'];
const toBool = (v) => (v === '1' || v === 'true' || v === true ? 1 : 0);

function validate(body, partial = false) {
  const errs = [];
  const missing = (k) => !partial && (body[k] === undefined || body[k] === '');
  if (missing('title')) errs.push('title');
  if (missing('address')) errs.push('address');
  for (const k of ['deposit', 'rent', 'area']) {
    if (missing(k)) errs.push(k);
    else if (body[k] !== undefined && (isNaN(Number(body[k])) || Number(body[k]) < 0)) errs.push(k);
  }
  if (missing('room_type')) errs.push('room_type');
  else if (body.room_type !== undefined && !ROOM_TYPES.includes(body.room_type)) errs.push('room_type');
  return errs;
}

// ---- GET /api/listings : 반경·가격 조건 탐색 (SFR-004) ----
// query: lat, lng, radius(m), minDeposit, maxDeposit, minRent, maxRent, roomType, sort(distance|price)
router.get('/', async (req, res) => {
  try {
    const { lat, lng, radius = 1000, minDeposit, maxDeposit, minRent, maxRent, roomType, sort = 'distance' } = req.query;
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (isNaN(la) || isNaN(ln)) return res.status(400).json({ error: 'lat, lng 가 필요합니다.' });

    const where = [];
    const params = [la, ln, la]; // 거리식 파라미터
    if (minDeposit) { where.push('deposit >= ?'); params.push(Number(minDeposit)); }
    if (maxDeposit) { where.push('deposit <= ?'); params.push(Number(maxDeposit)); }
    if (minRent)    { where.push('rent >= ?');    params.push(Number(minRent)); }
    if (maxRent)    { where.push('rent <= ?');    params.push(Number(maxRent)); }
    if (roomType)   { where.push('room_type = ?'); params.push(roomType); }
    params.push(Number(radius)); // HAVING

    const orderBy = sort === 'price' ? 'rent ASC, deposit ASC' : 'distance ASC';
    const sql = `
      SELECT id, title, address, lat, lng, deposit, rent, area, room_type, image_path,
             (6371000 * ACOS(LEAST(1,
               COS(RADIANS(?)) * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS(?)) +
               SIN(RADIANS(?)) * SIN(RADIANS(lat))))) AS distance
      FROM listings
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      HAVING distance <= ?
      ORDER BY ${orderBy}
      LIMIT 200`;
    const [rows] = await db.query(sql, params);
    res.json(rows.map((r) => ({ ...r, distance: Math.round(r.distance) })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '매물 조회 중 오류가 발생했습니다.' });
  }
});

// ---- GET /api/listings/mine : 내 매물 목록 (SFR-013) ---- (/:id 보다 먼저 선언)
router.get('/mine', auth, async (req, res) => {
  const [rows] = await db.query(
    'SELECT * FROM listings WHERE owner_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(rows);
});

// ---- GET /api/listings/:id ----
router.get('/:id', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: '매물을 찾을 수 없습니다.' });
  res.json(rows[0]);
});

// ---- POST /api/listings : 매물 등록 (SFR-012) ----
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const errs = validate(req.body);
    if (errs.length) return res.status(400).json({ error: '입력값 오류', fields: errs });

    const geo = await geocode(req.body.address);
    if (!geo) return res.status(400).json({ error: '주소를 찾을 수 없습니다.', fields: ['address'] });

    const b = req.body;
    const [r] = await db.query(
      `INSERT INTO listings
       (owner_id, title, address, lat, lng, lawd_cd, deposit, rent, area, room_type, description, image_path, contact_public)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, b.title, b.address, geo.lat, geo.lng, geo.lawd_cd,
       Number(b.deposit), Number(b.rent), Number(b.area), b.room_type,
       b.description || null, req.file ? '/uploads/' + req.file.filename : null,
       toBool(b.contact_public)]
    );
    const warning = await rentWarning(geo.lawd_cd, Number(b.rent));
    res.status(201).json({ id: r.insertId, warning });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '매물 등록 중 오류가 발생했습니다.' });
  }
});

// ---- 본인 소유 확인 (SIR-001: 서버 측 권한 검증) ----
async function ownListing(req, res) {
  const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
  if (!rows.length) { res.status(404).json({ error: '매물을 찾을 수 없습니다.' }); return null; }
  if (rows[0].owner_id !== req.user.id) {
    res.status(403).json({ error: '본인이 등록한 매물만 수정/삭제할 수 있습니다.' });
    return null;
  }
  return rows[0];
}

// ---- PUT /api/listings/:id : 수정 (SFR-013) ----
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const cur = await ownListing(req, res);
    if (!cur) return;
    const errs = validate(req.body, true);
    if (errs.length) return res.status(400).json({ error: '입력값 오류', fields: errs });

    const b = req.body;
    const sets = [], vals = [];
    for (const k of ['title', 'description', 'room_type']) {
      if (b[k] !== undefined) { sets.push(`${k} = ?`); vals.push(b[k]); }
    }
    for (const k of ['deposit', 'rent', 'area']) {
      if (b[k] !== undefined) { sets.push(`${k} = ?`); vals.push(Number(b[k])); }
    }
    if (b.contact_public !== undefined) { sets.push('contact_public = ?'); vals.push(toBool(b.contact_public)); }
    if (b.address !== undefined && b.address !== cur.address) {
      const geo = await geocode(b.address);
      if (!geo) return res.status(400).json({ error: '주소를 찾을 수 없습니다.', fields: ['address'] });
      sets.push('address = ?', 'lat = ?', 'lng = ?', 'lawd_cd = ?');
      vals.push(b.address, geo.lat, geo.lng, geo.lawd_cd);
    }
    if (req.file) { sets.push('image_path = ?'); vals.push('/uploads/' + req.file.filename); }
    if (!sets.length) return res.status(400).json({ error: '수정할 내용이 없습니다.' });

    await db.query(`UPDATE listings SET ${sets.join(', ')} WHERE id = ?`, [...vals, cur.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '매물 수정 중 오류가 발생했습니다.' });
  }
});

// ---- DELETE /api/listings/:id ----
router.delete('/:id', auth, async (req, res) => {
  const cur = await ownListing(req, res);
  if (!cur) return;
  await db.query('DELETE FROM listings WHERE id = ?', [cur.id]);
  res.json({ ok: true });
});

// ---- POST /api/listings/:id/report : 허위 매물 신고 (SFR-013) ----
router.post('/:id/report', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [l] = await conn.query('SELECT id, owner_id FROM listings WHERE id = ?', [req.params.id]);
    if (!l.length) { await conn.rollback(); return res.status(404).json({ error: '매물을 찾을 수 없습니다.' }); }
    if (l[0].owner_id === req.user.id) { await conn.rollback(); return res.status(400).json({ error: '본인 매물은 신고할 수 없습니다.' }); }
    try {
      await conn.query('INSERT INTO listing_reports (listing_id, reporter_id, reason) VALUES (?,?,?)',
        [req.params.id, req.user.id, ((req.body && req.body.reason) || '').slice(0, 200) || null]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') { await conn.rollback(); return res.status(409).json({ error: '이미 신고한 매물입니다.' }); }
      throw e;
    }
    await conn.query('UPDATE listings SET report_count = report_count + 1 WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: '신고 처리 중 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
