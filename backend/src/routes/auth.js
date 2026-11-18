/**
 * SFR-001 소셜 로그인 (OAuth 2.0 인가 코드 방식) — 담당 최준희
 *   POST /api/auth/:provider  { code, redirectUri }  → { token, user }
 *     1) 인가 코드 → 제공자 access token 교환
 *     2) 제공자 사용자 정보 조회
 *     3) users 에 없으면 자동 가입
 *     4) JWT 발급 (페이로드 { id } — middleware/auth.js 와 동일)
 *   GET  /api/me  (JWT 필요)  → user
 *
 * 환경 변수: JWT_SECRET, JWT_EXPIRES_IN, KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET(선택),
 *           GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_REDIRECT_URIS
 * 최소 정보만 저장 (SIR-003): 제공자 회원번호와 닉네임만 저장, 이메일은 저장하지 않음
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const form = (obj) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v)).toString();

async function postForm(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: form(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('소셜 로그인 토큰 교환에 실패했습니다.'), { status: 401, detail: data });
  return data;
}

async function getJson(url, accessToken) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('소셜 사용자 정보 조회에 실패했습니다.'), { status: 401 });
  return data;
}

// 제공자별: 인가 코드 → { providerId, nickname }
const PROVIDERS = {
  async kakao(code, redirectUri) {
    const tok = await postForm('https://kauth.kakao.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY,
      client_secret: process.env.KAKAO_CLIENT_SECRET, // 콘솔에서 사용 설정한 경우만
      redirect_uri: redirectUri,
      code,
    });
    const me = await getJson('https://kapi.kakao.com/v2/user/me', tok.access_token);
    return {
      providerId: String(me.id),
      nickname: me.kakao_account?.profile?.nickname || me.properties?.nickname || '카카오 사용자',
    };
  },
  async google(code, redirectUri) {
    const tok = await postForm('https://oauth2.googleapis.com/token', {
      grant_type: 'authorization_code',
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code,
    });
    const me = await getJson('https://openidconnect.googleapis.com/v1/userinfo', tok.access_token);
    return { providerId: String(me.sub), nickname: me.name || me.given_name || 'Google 사용자' };
  },
};

const allowedRedirects = () =>
  (process.env.ALLOWED_REDIRECT_URIS || '').split(',').map((s) => s.trim()).filter(Boolean);

const toUser = (row) => ({ id: row.id, nickname: row.nickname, provider: row.provider });

router.post('/auth/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, redirectUri } = req.body || {};
    if (!PROVIDERS[provider]) return res.status(400).json({ error: '지원하지 않는 로그인 방식입니다.' });
    if (typeof code !== 'string' || !code) return res.status(400).json({ error: '인가 코드가 없습니다.' });
    // 콘솔에 등록한 redirect URI 만 허용
    if (!allowedRedirects().includes(redirectUri)) return res.status(400).json({ error: '허용되지 않은 redirect URI 입니다.' });

    const { providerId, nickname } = await PROVIDERS[provider](code, redirectUri);

    // 최초 로그인이면 자동 가입 (이미 있으면 그대로)
    await db.query(
      `INSERT INTO users (provider, provider_id, nickname) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE nickname = nickname`,
      [provider, providerId, nickname.slice(0, 50)]
    );
    const [rows] = await db.query(
      'SELECT id, nickname, provider FROM users WHERE provider = ? AND provider_id = ?',
      [provider, providerId]
    );
    const user = rows[0];
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '2h', // SIR-001 토큰 만료
    });
    res.json({ token, user: toUser(user) });
  } catch (e) {
    console.error(e.message, e.detail || '');
    res.status(e.status || 500).json({ error: e.status ? e.message : '로그인 처리 중 오류가 발생했습니다.' });
  }
});

router.get('/me', auth, async (req, res) => {
  const [rows] = await db.query('SELECT id, nickname, provider FROM users WHERE id = ?', [req.user.id]);
  if (!rows.length) return res.status(401).json({ error: '존재하지 않는 사용자입니다.' });
  res.json(toUser(rows[0]));
});

module.exports = router;
