# 백엔드 API 명세

- 서버 주소: `http://퍼블릭IP:4000` (EC2를 껐다 켜면 IP가 바뀝니다. 바뀌면 카톡으로 알려드립니다.)
- 금액 단위는 만원, 면적은 ㎡, `distance`는 미터입니다.
- 로그인이 필요한 API는 헤더에 `Authorization: Bearer <토큰>`을 보냅니다.
- 오류는 항상 `{"error":"메시지"}` 형태입니다.
- 이미지는 `서버주소 + image_path`로 접근합니다. 예: `http://서버:4000/uploads/abc.png`

## 중심지 검색

`GET /api/places/search?query=동의대`

- 응답: `[{name, address, roadAddress, category, lat, lng}]` (최대 5개, 전국 대상)

## 매물

### 반경 조회
`GET /api/listings?lat=&lng=&radius=1000`

- 선택: `minDeposit`, `maxDeposit`, `minRent`, `maxRent`, `roomType`, `sort=distance|price`
- 응답: `[{id, title, address, lat, lng, lawd_cd, deposit, rent, area, room_type, image_path, distance}]` (최대 200개)

### 상세
`GET /api/listings/:id` — 매물 전체 정보 (`description`, `contact_public`, `report_count` 등 포함)

### 등록 (로그인, multipart/form-data)
`POST /api/listings`

| 필드 | 설명 |
|---|---|
| title, address | 필수 |
| deposit, rent, area | 필수, 숫자 (만원, ㎡) |
| room_type | 원룸 / 투룸 / 오피스텔 / 기타 |
| description, contact_public | 선택 (`contact_public`은 1 또는 0) |
| image | 선택, jpg/png/webp, 5MB 이하 |

- 응답: `201 {id, warning}` — 월세가 지역 시세와 크게 다르면 `warning`에 문구가 들어가고, 아니면 `null`입니다.

### 내 매물 / 수정 / 삭제 / 신고 (로그인)
| API | 설명 |
|---|---|
| `GET /api/listings/mine` | 내 매물 목록 |
| `PUT /api/listings/:id` | 본인만. multipart, 바뀐 필드만 보내면 됨 → `{ok:true}` |
| `DELETE /api/listings/:id` | 본인만 → `{ok:true}` |
| `POST /api/listings/:id/report` | JSON `{"reason":"..."}` → `{ok:true}`. 이미 신고했으면 409, 본인 매물이면 400 |

## 시세 (그래프용)

`GET /api/prices/trend?lawdCd=26230&months=12`

- 응답: `[{ym:"2025-12", avg_rent, avg_deposit, count}]` (오래된 달 → 최근 달 순)
- 부산 16개 구·군이 모두 들어 있습니다. `lawdCd`는 매물의 `lawd_cd`를 그대로 쓰면 됩니다.
- 마지막 달은 신고가 덜 들어와 `count`가 적을 수 있습니다.

## AI

### 코멘트
`GET /api/ai/comment/:매물id`

```json
{
  "listingId": 1,
  "comment": "…",
  "cached": false,
  "basis": {
    "market": { "months": 6, "avgRent": 44, "avgDeposit": 1810, "samples": 3072, "oldest": 41, "latest": 43 },
    "infra": [ { "label": "편의점", "radius": 500, "count": 11, "nearestM": 8 } ]
  }
}
```
`basis.market`과 `basis.infra`는 데이터가 없으면 `null`입니다.

### 체크리스트
`GET /api/ai/checklist/:매물id`

- 응답: `{listingId, items:[{category, text}], cached}` — `category`는 시설 / 계약 / 안전 / 비용 / 주변
- 처음 부르면 몇 초 걸리므로 로딩 표시가 필요합니다. 같은 매물은 이후 바로 응답합니다(7일 캐시).
- IP당 분당 20회 제한(429), AI 오류 시 502를 돌려줍니다.

## 로그인

| API | 설명 |
|---|---|
| `POST /api/auth/:provider` | `{code, redirectUri}` → `{token, user}` |
| `GET /api/me` | 로그인 필요 → `user` |

## 부산 지역코드 (lawdCd)

| 구·군 | 코드 | 구·군 | 코드 |
|---|---|---|---|
| 중구 | 26110 | 남구 | 26290 |
| 서구 | 26140 | 북구 | 26320 |
| 동구 | 26170 | 해운대구 | 26350 |
| 영도구 | 26200 | 사하구 | 26380 |
| 부산진구 | 26230 | 금정구 | 26410 |
| 동래구 | 26260 | 강서구 | 26440 |
| 연제구 | 26470 | 수영구 | 26500 |
| 사상구 | 26530 | 기장군 | 26710 |
