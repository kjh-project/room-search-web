const jwt = require('jsonwebtoken');

// SFR-001(준희)이 발급한 JWT 검증. 페이로드에 { id } 가 있다고 가정
module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id };
    next();
  } catch (e) {
    res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
  }
};
