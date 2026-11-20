-- sgw_users 비밀번호 인증 컬럼 추가 + 초기 비번 '1' 시드.
-- password_hash: PBKDF2-HMAC-SHA256 (functions/_lib/password.js 포맷) pbkdf2$iter$salt$hash.
-- 주의: D1은 ADD COLUMN IF NOT EXISTS 미지원 → 재실행 시 아래 ALTER는 'duplicate column' 에러.
--       최초 1회만 파일 실행. 이후엔 UPDATE 문만 개별 실행하면 멱등.
ALTER TABLE sgw_users ADD COLUMN password_hash TEXT;

-- 전 사용자 초기 비번 '1' 해시로 시드(아직 미설정 계정만 — 이미 바꾼 비번 보존).
UPDATE sgw_users
   SET password_hash = 'pbkdf2$100000$LiNTpQ2qnbLTSUUeBgl2iA==$CrY6poCCtxb1JUfl4FO0aMO8rA47SqC1hmnRLnwHRGE='
 WHERE password_hash IS NULL OR password_hash = '';
