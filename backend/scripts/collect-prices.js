// SFR-003 공공 Open API(국토교통부 전월세 실거래가) 연동 및 월별 시세 집계
// 사용:
//   node scripts/collect-prices.js <법정동코드5자리> [최근 N개월=12]   예) node scripts/collect-prices.js 26230 12
//   node scripts/collect-prices.js busan [최근 N개월=12]               부산 16개 구·군 전체
// 결과: price_cache(lawd_cd, deal_ym)에 월별 평균 월세·보증금·건수를 저장 (다시 돌려도 중복 없이 갱신)
require('dotenv').config();
const db = require('../src/db');

const BASE = 'https://apis.data.go.kr/1613000';
const SOURCES = [
  { name: '연립다세대', path: 'RTMSDataSvcRHRent/getRTMSDataSvcRHRent' },
  { name: '오피스텔', path: 'RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent' },
];
const BUSAN = {
  26110: '중구', 26140: '서구', 26170: '동구', 26200: '영도구',
  26230: '부산진구', 26260: '동래구', 26290: '남구', 26320: '북구',
  26350: '해운대구', 26380: '사하구', 26410: '금정구', 26440: '강서구',
  26470: '연제구', 26500: '수영구', 26530: '사상구', 26710: '기장군',
};
const MAX_AREA = 40; // 자취방(원룸 위주) 시세만 집계하기 위한 전용면적 상한(㎡)
const PAGE = 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (s) => Number(String(s || '').replace(/,/g, '')) || 0;

function serviceKey() {
  const k = process.env.PUBLIC_DATA_API_KEY || '';
  // Encoding 키(%포함)를 넣은 경우 이중 인코딩 방지
  return k.includes('%') ? decodeURIComponent(k) : k;
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : '';
}

function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const o = {};
    for (const t of m[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) o[t[1]] = t[2].trim();
    return o;
  });
}

async function fetchMonth(src, lawdCd, ym) {
  const items = [];
  for (let page = 1; ; page++) {
    const qs = new URLSearchParams({
      serviceKey: serviceKey(),
      LAWD_CD: lawdCd,
      DEAL_YMD: ym,
      numOfRows: String(PAGE),
      pageNo: String(page),
    });
    const res = await fetch(`${BASE}/${src.path}?${qs}`);
    const xml = await res.text();
    if (!res.ok) throw new Error(`${src.name} HTTP ${res.status}: ${xml.slice(0, 150)}`);
    const code = tag(xml, 'resultCode');
    if (code && code !== '000' && code !== '00') {
      throw new Error(`${src.name} 오류 ${code}: ${tag(xml, 'resultMsg')}`);
    }
    if (!code && !xml.includes('<items')) {
      throw new Error(`${src.name} 예상치 못한 응답: ${xml.slice(0, 150)}`);
    }
    const got = parseItems(xml);
    items.push(...got);
    if (got.length < PAGE) break;
  }
  return items;
}

// 일시적 오류(네트워크 등)에 대비해 한 번 더 시도
async function fetchMonthRetry(src, lawdCd, ym) {
  try {
    return await fetchMonth(src, lawdCd, ym);
  } catch (e) {
    await sleep(1500);
    return fetchMonth(src, lawdCd, ym);
  }
}

// 월세 거래(월세>0)만 평균. 전세(월세 0)는 제외, 전용면적 MAX_AREA 이하만 포함
function aggregate(items) {
  const rows = items.filter((i) => {
    const area = Number(i.excluUseAr);
    return num(i.monthlyRent) > 0 && area > 0 && area <= MAX_AREA;
  });
  if (!rows.length) return null;
  const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
  return {
    avg_rent: Math.round(sum((r) => num(r.monthlyRent)) / rows.length),
    avg_deposit: Math.round(sum((r) => num(r.deposit)) / rows.length),
    count: rows.length,
  };
}

function recentMonths(n) {
  const now = new Date();
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

async function collectDistrict(lawdCd, label, months) {
  console.log(`\n== ${label}(${lawdCd}) ==`);
  for (const ym of recentMonths(months)) {
    const all = [];
    let okSources = 0;
    for (const src of SOURCES) {
      try {
        all.push(...(await fetchMonthRetry(src, lawdCd, ym)));
        okSources++;
      } catch (e) {
        console.error(`  ! ${ym} ${e.message}`);
      }
      await sleep(200);
    }
    if (!okSources) { console.log(`${ym}: 모든 API 호출 실패 → 건너뜀`); continue; }
    const agg = aggregate(all);
    if (!agg) { console.log(`${ym}: 조건에 맞는 월세 거래 없음 (수집 ${all.length}건)`); continue; }
    await db.query(
      `INSERT INTO price_cache (lawd_cd, deal_ym, avg_deposit, avg_rent, sample_count)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE avg_deposit=VALUES(avg_deposit), avg_rent=VALUES(avg_rent), sample_count=VALUES(sample_count)`,
      [lawdCd, ym, agg.avg_deposit, agg.avg_rent, agg.count]
    );
    console.log(`${ym}: 월세 ${agg.avg_rent}만 / 보증금 ${agg.avg_deposit}만 / ${agg.count}건`);
  }
}

async function main() {
  const target = process.argv[2];
  const months = Math.min(Math.max(parseInt(process.argv[3], 10) || 12, 1), 36);
  const isBusan = target === 'busan';
  if (!isBusan && !/^\d{5}$/.test(target || '')) {
    console.error('사용법: node scripts/collect-prices.js <법정동코드5자리|busan> [개월수]');
    process.exit(1);
  }
  if (!process.env.PUBLIC_DATA_API_KEY) {
    console.error('.env에 PUBLIC_DATA_API_KEY가 없습니다.');
    process.exit(1);
  }

  const districts = isBusan ? Object.entries(BUSAN) : [[target, BUSAN[target] || '지정 지역']];
  for (const [code, label] of districts) {
    await collectDistrict(code, label, months);
  }
  console.log('\n완료');
  await db.end();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { parseItems, aggregate, num, BUSAN };
