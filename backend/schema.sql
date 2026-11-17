CREATE DATABASE IF NOT EXISTS jachwi DEFAULT CHARACTER SET utf8mb4;
USE jachwi;

-- 회원 (SFR-001: 준희가 로그인 구현 시 사용, 외래키용으로 먼저 정의)
CREATE TABLE IF NOT EXISTS users (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider    VARCHAR(20)  NOT NULL,            -- kakao | google
  provider_id VARCHAR(100) NOT NULL,
  nickname    VARCHAR(50),
  email       VARCHAR(100),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_provider (provider, provider_id)
);

-- 매물 (SFR-012, 013)
CREATE TABLE IF NOT EXISTS listings (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_id       BIGINT NOT NULL,
  title          VARCHAR(100) NOT NULL,
  address        VARCHAR(200) NOT NULL,
  lat            DECIMAL(10,7) NOT NULL,
  lng            DECIMAL(10,7) NOT NULL,
  lawd_cd        CHAR(5),                       -- 법정동 코드 앞 5자리 (시세 조회용)
  deposit        INT NOT NULL,                  -- 보증금(만원)
  rent           INT NOT NULL,                  -- 월세(만원)
  area           DECIMAL(6,2) NOT NULL,         -- 면적(㎡)
  room_type      VARCHAR(20) NOT NULL,          -- 원룸 | 투룸 | 오피스텔 | 기타
  description    TEXT,
  image_path     VARCHAR(255),
  contact_public TINYINT(1) NOT NULL DEFAULT 0, -- 연락처 공개 동의
  report_count   INT NOT NULL DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  INDEX idx_geo (lat, lng)
);

-- 허위 매물 신고 (한 사용자가 같은 매물을 중복 신고하지 못하게)
CREATE TABLE IF NOT EXISTS listing_reports (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  listing_id  BIGINT NOT NULL,
  reporter_id BIGINT NOT NULL,
  reason      VARCHAR(200),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report (listing_id, reporter_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES users(id)
);

-- 관심 매물 (SFR-002 마이페이지, 준희)
CREATE TABLE IF NOT EXISTS favorites (
  user_id    BIGINT NOT NULL,
  listing_id BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- 월별 시세 캐시 (SFR-003: 내가 채우고, 준희 그래프 009/010이 읽음)
CREATE TABLE IF NOT EXISTS price_cache (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  lawd_cd      CHAR(5) NOT NULL,
  deal_ym      CHAR(6) NOT NULL,                -- 예: 202610
  avg_deposit  INT,
  avg_rent     INT,
  sample_count INT NOT NULL DEFAULT 0,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_price (lawd_cd, deal_ym)
);
