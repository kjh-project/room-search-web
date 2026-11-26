/**
 * SFR-007 AI 주거 환경 코멘트 / SFR-008 체크리스트 생성 및 응답 캐싱
 *   GET /api/ai/comment/:id    → { listingId, comment, cached, basis }
 *   GET /api/ai/checklist/:id  → { listingId, items:[{category,text}], cached }
 * 같은 입력(프롬프트)은 ai_cache 에 저장된 응답을 재사용한다 (7일).
 */
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { generateText } = require('../utils/gemini');
const { countNearby } = require('../utils/infra');

const router = express.Router();
const TTL_DAYS = 7;
const AI_TIMEOUT_MS = 40000;

// ---- 간단한 IP별 호출 제한 (무료 사용량 보호): 분당 20회 ----
const hits = new Map();
router.use((req, res, next) => {
  const now = Date.now();
  const arr = (hits.get(req.ip) || []).filter((t) => now - t < 60000);
  if (arr.length >= 20) return res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
  arr.push(now);
  hits.set(req.ip, arr);
  next();
});

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('AI 응답 시간 초과')), ms))]);

async function loadListing(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: '잘못된 매물 번호입니다.' }); return null; }
  const [rows] = await db.query(
    'SELECT id, title, address, lat, lng, lawd_cd, deposit, rent, area, room_type FROM listings WHERE id = ?', [id]);
  if (!rows.length) { res.status(404).json({ error: '매물을 찾을 수 없습니다.' }); return null; }
  return rows[0];
}

// 최근 완성된 6개월(이번 달은 신고가 덜 들어와 제외)의 건수 가중 평균
async function marketStats(lawdCd) {
  if (!lawdCd) return null;
  const d = new Date();
  const thisYm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const [rows] = await db.query(
    `SELECT deal_ym, avg_rent, avg_deposit, sample_count FROM price_cache
     WHERE lawd_cd = ? AND deal_ym < ? ORDER BY deal_ym DESC LIMIT 6`, [lawdCd, thisYm]);
  if (!rows.length) return null;
  const n = rows.reduce((a, r) => a + r.sample_count, 0) || 1;
  const w = (f) => Math.round(rows.reduce((a, r) => a + f(r) * r.sample_count, 0) / n);
  return {
    months: rows.length,
    avgRent: w((r) => r.avg_rent),
    avgDeposit: w((r) => r.avg_deposit),
    samples: n,
    oldest: rows[rows.length - 1].avg_rent,
    latest: rows[0].avg_rent,
  };
}

const modelName = () => process.env.GEMINI_MODEL || '';

// 캐시 조회 → 없으면 생성 후 저장. validate 가 값을 돌려줘야 저장한다.
async function cachedGenerate(type, listingId, prompt, parse) {
  const key = crypto.createHash('sha256').update(`${type}\n${modelName()}\n${prompt}`).digest('hex');
  const [hit] = await db.query(
    `SELECT content FROM ai_cache WHERE cache_key = ? AND created_at > NOW() - INTERVAL ${TTL_DAYS} DAY`, [key]);
  if (hit.length) return { value: parse(hit[0].content), cached: true };

  const { text } = await withTimeout(generateText(prompt), AI_TIMEOUT_MS);
  if (!text) throw new Error('AI 응답에서 텍스트를 찾지 못했습니다.');
  const value = parse(text); // 형식이 틀리면 여기서 예외 → 저장 안 함
  await db.query(
    `INSERT INTO ai_cache (cache_key, type, listing_id, content) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE content = VALUES(content), created_at = NOW()`,
    [key, type, listingId, text]);
  return { value, cached: false };
}

function describeListing(l) {
  return `${l.title} / ${l.address} / ${l.room_type} / 전용 ${l.area}㎡ / 보증금 ${l.deposit}만원 / 월세 ${l.rent}만원`;
}

function describeMarket(m) {
  if (!m) return '시세 데이터 없음';
  return `최근 ${m.months}개월 해당 구 평균 월세 ${m.avgRent}만원, 평균 보증금 ${m.avgDeposit}만원 (실거래 ${m.samples}건, 40㎡ 이하 월세 거래 기준)`;
}

function describeInfra(infra) {
  if (!infra) return '주변 시설 정보 없음';
  return infra.map((i) =>
    `${i.label}: 반경 ${i.radius}m 안 ${i.count}곳` + (i.nearestM != null ? `, 가장 가까운 곳 ${i.nearestM}m` : '')).join('\n');
}

// ---------------- SFR-007 ----------------
router.get('/comment/:id', async (req, res) => {
  try {
    const l = await loadListing(req, res);
    if (!l) return;
    const [market, infra] = await Promise.all([marketStats(l.lawd_cd), countNearby(l.lat, l.lng)]);

    const prompt = [
      '너는 부산 자취방 탐색 서비스의 주거 환경 분석가야. 아래 [매물], [시세], [주변 시설] 데이터만 근거로 한국어 코멘트를 써.',
      '규칙:',
      '- 3~4문장, 400자 이내, 마크다운 없이 평문.',
      '- 제공된 숫자만 사용해. 소음·치안·채광·건물 상태처럼 주어지지 않은 정보는 추측하지 마.',
      '- 월세가 시세보다 비싼지 저렴한지 숫자로 비교해서 분명히 말해.',
      '- 마지막 문장에는 직접 확인해야 할 점 하나를 적어.',
      '',
      `[매물] ${describeListing(l)}`,
      `[시세] ${describeMarket(market)}`,
      `[주변 시설]\n${describeInfra(infra)}`,
    ].join('\n');

    const { value, cached } = await cachedGenerate('comment', l.id, prompt, (t) => String(t).trim());
    res.json({ listingId: l.id, comment: value, cached, basis: { market, infra } });
  } catch (e) {
    console.error(e.message);
    res.status(502).json({ error: 'AI 코멘트를 만드는 중 오류가 발생했습니다.' });
  }
});

// ---------------- SFR-008 ----------------
const CATEGORIES = ['시설', '계약', '안전', '비용', '주변'];

function parseChecklist(text) {
  const cleaned = String(text).replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('체크리스트 JSON 형식이 아닙니다.');
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  const items = (Array.isArray(obj.items) ? obj.items : [])
    .filter((i) => i && typeof i.text === 'string' && i.text.trim())
    .map((i) => ({
      category: CATEGORIES.includes(i.category) ? i.category : '시설',
      text: i.text.trim().slice(0, 120),
    }))
    .slice(0, 15);
  if (items.length < 5) throw new Error('체크리스트 항목이 너무 적습니다.');
  return items;
}

router.get('/checklist/:id', async (req, res) => {
  try {
    const l = await loadListing(req, res);
    if (!l) return;
    const market = await marketStats(l.lawd_cd);
    let level = '시세 비교 불가';
    if (market) {
      const diff = Math.round(((l.rent - market.avgRent) / market.avgRent) * 100);
      level = diff > 15 ? `시세보다 약 ${diff}% 비쌈` : diff < -15 ? `시세보다 약 ${-diff}% 저렴` : '시세와 비슷';
    }

    const prompt = [
      '너는 부산에서 자취방을 구하는 사람을 돕는 도우미야. 아래 매물을 직접 보러 갈 때 확인할 체크리스트를 만들어.',
      '규칙:',
      '- 항목은 10~12개, 각 항목은 한 문장(60자 이내)의 구체적인 행동.',
      '- 매물 유형, 면적, 시세 대비 가격 수준에 맞게 항목을 고르고, 가격이 시세보다 매우 싸거나 비싸면 그 이유를 확인하는 항목을 포함해.',
      '- category 는 반드시 시설, 계약, 안전, 비용, 주변 중 하나.',
      '- 출력은 JSON만. 다른 설명이나 마크다운 금지. 형식: {"items":[{"category":"시설","text":"..."}]}',
      '',
      `[매물] ${describeListing(l)}`,
      `[시세 대비] ${level}`,
    ].join('\n');

    const { value, cached } = await cachedGenerate('checklist', l.id, prompt, parseChecklist);
    res.json({ listingId: l.id, items: value, cached });
  } catch (e) {
    console.error(e.message);
    res.status(502).json({ error: '체크리스트를 만드는 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
