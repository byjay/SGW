-- SGW 게시판(posts) Batch4 컬럼 마이그레이션 — 카테고리 영속화.
-- v2 team_connect Notice.category(전체/인사/총무/IT/행사) 왕복 지원.
-- NOTE: SQLite `ADD COLUMN`은 컬럼이 이미 있으면 "duplicate column name" 에러를 낸다.
--       best-effort로 실행(그 에러만 무시)하면 멱등적으로 안전하다.
ALTER TABLE posts ADD COLUMN category TEXT;
