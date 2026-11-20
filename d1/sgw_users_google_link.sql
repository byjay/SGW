-- SGW: 구글 계정 연동(link) 컬럼 — "구글 1회 연동 → 이후 이름 기반 간편 로그인" 기반 스키마.
--
-- 보안 전제(코드와 동일한 계약):
--   * 이름(name)은 **인증 수단이 아니라 계정 선택기**다. 실제 신원 증명은 구글 ID 토큰이 한다.
--   * 여기 저장되는 google_sub 은 구글 계정의 불변 식별자(ID 토큰 `sub` 클레임).
--     로그인 시 서버가 검증한 ID 토큰의 sub 과 이 값이 일치할 때만 세션을 발급한다.
--
-- 주의: D1(SQLite)은 `ADD COLUMN IF NOT EXISTS` 미지원 → 재실행 시 ALTER 는
--       'duplicate column name' 에러. 최초 1회만 파일 전체 실행(기존 마이그레이션 관례 동일).
--       CREATE UNIQUE INDEX 는 IF NOT EXISTS 라 멱등.
ALTER TABLE sgw_users ADD COLUMN google_sub TEXT;
ALTER TABLE sgw_users ADD COLUMN google_email TEXT;
ALTER TABLE sgw_users ADD COLUMN google_linked_at INTEGER;

-- 한 구글 계정이 여러 직원 계정에 연결되는 것을 DB 레벨에서 차단.
-- (SQLite UNIQUE 인덱스는 NULL 을 중복으로 보지 않으므로 미연결 계정 다수는 정상)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sgw_users_google_sub ON sgw_users(google_sub);

-- 이름 기반 후보 조회(POST /api/auth/lookup) 인덱스.
CREATE INDEX IF NOT EXISTS idx_sgw_users_name ON sgw_users(name);
