-- SGW 사전 허용목록(초대) — 회사 도메인(@seastargo.com) 밖 구글 계정의 가입 경로 B.
--
-- 가입 경로 3종:
--   A. 자동(JIT)     : @seastargo.com  → 첫 구글 로그인 시 즉시 active + 최소 권한('user')
--   B. 사전 허용(초대): 이 표에 이메일이 등록됨 → 첫 로그인 시 즉시 active + 등록된 역할/부서
--   C. 가입 신청     : 위 둘 다 아님 → status='pending' 생성, 세션 발급 없음(403). 관리자 승인 필요
--
-- role 은 부여 시점에 코드(_lib/sgw-roles.js canGrantRole)가 화이트리스트 검증한다.
-- 멱등: CREATE TABLE IF NOT EXISTS — 재실행 안전.
CREATE TABLE IF NOT EXISTS sgw_invites (
  email      TEXT PRIMARY KEY,   -- 소문자 정규화해서 저장
  role       TEXT DEFAULT 'user',
  department TEXT DEFAULT '',
  position   TEXT DEFAULT '',
  note       TEXT DEFAULT '',
  created_by TEXT,               -- 초대한 관리자 sgw_users.id
  created_at INTEGER,
  used_at    INTEGER             -- 첫 로그인으로 소진된 시각(null=미사용)
);

CREATE INDEX IF NOT EXISTS idx_sgw_invites_used ON sgw_invites(used_at);
