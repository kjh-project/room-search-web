// Gemini 연결 확인용
//   node scripts/test-gemini.js models   사용 가능한 모델 이름 목록
//   node scripts/test-gemini.js          GEMINI_MODEL로 짧은 질문을 보내 응답 구조 확인
require('dotenv').config();
const { generateText, listModels } = require('../src/utils/gemini');

(async () => {
  if (process.argv[2] === 'models') {
    const names = await listModels();
    console.log(names.filter((n) => /gemini/i.test(n)).join('\n') || '(gemini 모델 없음)');
    return;
  }
  console.log('모델:', process.env.GEMINI_MODEL);
  const { text, raw } = await generateText('부산 자취방을 구할 때 확인할 것 한 가지만 한 문장으로 알려줘.');
  console.log('\n[추출한 텍스트]\n' + text);
  console.log('\n[응답 JSON 앞부분]\n' + JSON.stringify(raw, null, 2).slice(0, 1500));
})().catch((e) => { console.error(e.message); process.exit(1); });
