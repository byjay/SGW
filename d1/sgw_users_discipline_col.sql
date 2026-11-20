-- SGW sgw_users.discipline 컬럼 마이그레이션 — 주간보고 담당(discipline) 매핑.
-- discipline ∈ {piping,steel,cabin,machinery,electric} (null=미지정, 사용자가 UI에서 선택).
-- NOTE: SQLite `ADD COLUMN`은 컬럼이 이미 있으면 "duplicate column name" 에러 → best-effort 실행
--       (그 에러만 무시). 아래 UPDATE 시드는 완전 멱등(재실행 안전).
ALTER TABLE sgw_users ADD COLUMN discipline TEXT;

-- 부서 매칭 시드: 배관→piping, 전장→electric. 나머지 부서는 null 유지(UI에서 선택).
UPDATE sgw_users SET discipline = 'piping'   WHERE department = '배관';
UPDATE sgw_users SET discipline = 'electric' WHERE department = '전장';
