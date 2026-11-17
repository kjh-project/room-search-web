# 자취방 탐색기 프론트엔드 (React + Vite) — 담당 최준희

SFR-001 소셜 로그인·마이페이지 · SFR-003 카카오맵 인프라 핀 · SFR-005 시세 비교·추이 그래프

## 1. 바로 실행해 보기 (서버 없이, 목업 모드)

```bash
cd frontend
npm install
cp .env.example .env        # 카카오 JS 키 입력 (없어도 목업 모드로 실행됨)
npm run dev                 # http://localhost:5173
npm test                    # 시세 계산 단위 테스트
# Windows 는 실행하기.bat 더블클릭으로도 가능
```

`.env` 가 없거나 `VITE_USE_MOCK=false` 가 아니면 목업 모드입니다. 목업 모드에서는 동의대 주변 가짜 매물 24개, 12개월 시세, 가짜 로그인으로 모든 화면이 동작합니다.

## 2. 요구사항별 구현 내용

| ID | 파일 | 내용 |
|---|---|---|
| SFR-001 | `src/auth/*`, `pages/LoginPage·OAuthCallback·MyPage.jsx`, `backend/src/routes/auth.js·favorites.js` | 카카오·구글 인가 코드 로그인, state(CSRF) 검증, 최초 로그인 자동 가입, JWT(2시간 만료), 마이페이지(찜·최근 조회·내 매물), JWT 검증 미들웨어 |
| SFR-003 | `components/KakaoMap.jsx`, `LayerToggle.jsx`, `lib/kakao.js` | 가격 라벨 핀, 인포윈도우(상세 보기), 중심 마커와 반경 원, 지하철역(SW8)·편의점(CS2)·대형마트(MT1) 핀, 레이어 토글, 지도 이동 후 0.5초 디바운스로 다시 조회 |
| SFR-005 | `components/PricePanel.jsx`, `charts/*`, `lib/price.js`, `backend/src/routes/prices.js` | 이 매물과 지역 평균 비교(월세·보증금 막대 차트), 12/6개월 월세 추이 꺾은선 차트, "주변 평균 대비 약 O% 저렴/비쌈" 문구 |

추가로 넣은 것:
- `lib/analytics.js`: `track()` 함수. 종환 님이 GA4 gtag.js를 넣으면 toggle_layer, change_radius, view_listing, add_favorite, login 이벤트가 자동으로 전송됩니다.
- 모바일 반응형 레이아웃 (COR-001)

## 3. backend 와 연결

- 실제 서버에 붙일 때: `frontend/.env` 에 `VITE_USE_MOCK=false`, backend 를 4000번에서 실행 (`/api` 는 vite 가 4000번으로 프록시)
- 준희 담당 backend 라우트: `backend/src/routes/auth.js`(로그인·/api/me), `favorites.js`(찜), `prices.js`(price_cache 읽기 전용 → 그래프)
- JWT 페이로드는 `{ id }` 로 `middleware/auth.js` 와 동일. `scripts/dev-token.js` 토큰도 그대로 사용 가능
- 서버 응답의 `id`, `distance` 는 `src/api/client.js` 에서 `listing_id`, `distance_m` 으로 바꿔 씀
- `/api/infra` 는 아직 없음 → 브라우저에서 카카오 SDK 로 직접 검색 (동작함). 서버 중계·캐싱은 추후
- `price_cache` 에 방 유형 컬럼이 없어서 그래프는 방 유형 구분 없이 지역 전체 평균

## 4. 키 발급과 콘솔 설정

1. **카카오 디벨로퍼스**: 앱 생성 → JavaScript 키, REST API 키 발급 → 플랫폼 > Web에 `http://localhost:5173`과 배포 도메인 등록 → 카카오 로그인 활성화, Redirect URI `…/oauth/kakao` 등록 → 동의항목에서 닉네임 설정
2. **Google Cloud Console**: OAuth 클라이언트 ID(웹) 생성 → 승인된 리디렉션 URI에 `…/oauth/google` 등록
3. 서버 `.env`에 `backend/.env.example` 의 SFR-001 항목 채우기, `ALLOWED_REDIRECT_URIS`에 위 URI를 똑같이 입력

## 5. 발표 Q&A 대비

- **"월세만 비교하면 보증금 차이는 반영 안 되지 않나요?"** → 보증금도 따로 비교해서 보여줍니다. 더 정확하게 하려면 전월세 전환율로 계산한 환산 월세를 쓰는 방법이 있습니다 (향후 개선 사항).
- **"지역 평균은 어떻게 계산했나요?"** → 같은 시군구(법정동 코드 앞 5자리)와 같은 방 유형의 최근 3개월 실거래를 거래 건수로 가중 평균했습니다. 신고 시차 때문에 1개월만 쓰면 표본이 너무 적습니다.
