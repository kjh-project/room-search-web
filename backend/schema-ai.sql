USE jachwi;
-- SFR-008 AI 응답 캐시 (같은 입력이면 저장된 응답을 다시 사용)
CREATE TABLE IF NOT EXISTS ai_cache (
  cache_key  CHAR(64) PRIMARY KEY,           -- sha256(종류 + 모델 + 프롬프트)
  type       VARCHAR(20) NOT NULL,           -- comment | checklist
  listing_id BIGINT NOT NULL,
  content    MEDIUMTEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_listing (listing_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);
