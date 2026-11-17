// 개발용 JWT 발급 (SFR-001 로그인 완성 전까지 API 테스트용)
// 사용: node scripts/dev-token.js 1     (1 = users 테이블의 id)
require('dotenv').config();
const jwt = require('jsonwebtoken');

const id = Number(process.argv[2] || 1);
const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
console.log(token);
