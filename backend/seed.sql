USE jachwi;
-- 테스트용 사용자 2명 (id 1, 2). 본인 매물 / 타인 매물 권한 테스트에 사용
INSERT IGNORE INTO users (provider, provider_id, nickname) VALUES
  ('dev', 'dev1', '테스트유저1'),
  ('dev', 'dev2', '테스트유저2');
