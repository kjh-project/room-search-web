// Gemini API (Interactions API, REST) 호출 헬퍼 — SDK 없이 fetch만 사용
// .env: GEMINI_API_KEY, GEMINI_MODEL (모델 이름은 `node scripts/test-gemini.js models`로 확인)
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// 응답에서 텍스트 꺼내기: output_text 우선, 없으면 steps 마지막 text 블록
function extractText(data) {
  if (data && typeof data.output_text === 'string') return data.output_text;
  const steps = (data && data.steps) || [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const c = steps[i] && steps[i].content;
    if (Array.isArray(c)) {
      const t = c.filter((x) => x && x.type === 'text').map((x) => x.text).join('');
      if (t) return t;
    }
  }
  return null;
}

async function generateText(prompt, opts = {}) {
  const key = process.env.GEMINI_API_KEY;
  const model = opts.model || process.env.GEMINI_MODEL;
  if (!key) throw new Error('.env에 GEMINI_API_KEY가 없습니다.');
  if (!model) throw new Error('.env에 GEMINI_MODEL이 없습니다.');

  const res = await fetch(`${BASE}/interactions`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: prompt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini 호출 실패 ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return { text: extractText(data), raw: data };
}

async function listModels() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('.env에 GEMINI_API_KEY가 없습니다.');
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`모델 목록 실패 ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return (data.models || []).map((m) => m.name);
}

module.exports = { generateText, listModels, extractText };
