require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/listings', require('./routes/listings'));
app.use('/api', require('./routes/auth'));            // SFR-001 POST /api/auth/:provider, GET /api/me
app.use('/api/favorites', require('./routes/favorites')); // SFR-001 마이페이지 찜
app.use('/api/prices', require('./routes/prices'));   // SFR-005 그래프용 price_cache 조회

// 에러 처리 (multer 용량/형식 오류 포함)
app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log('server on :' + port));
