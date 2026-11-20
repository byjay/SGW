-- SGW 게시판/공지(posts + post_comments) — Cloudflare D1 shared backend.
-- Idempotent: safe to re-run. Source of truth: services/mockServer.ts INITIAL_POSTS.
-- 기존 테이블(employees/sgw_users/presence/messages/chat_*) 미접촉.
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  type TEXT,
  author_id TEXT,
  author_name TEXT,
  title TEXT,
  content TEXT,
  timestamp INTEGER,
  likes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  author_id TEXT,
  author_name TEXT,
  content TEXT,
  timestamp INTEGER
);

INSERT OR IGNORE INTO posts (id, type, author_id, author_name, title, content, timestamp, likes) VALUES
  ('post1', 'notice', '5', '김봉정',
   '[공지] 커뮤니티 이용 수칙 안내',
   '모두가 즐거운 커뮤니티를 위해 서로 존중하며 대화합시다. 비방이나 욕설은 금지됩니다.',
   1782854000000, 5),
  ('post2', 'notice', 'system', '시스템 관리자',
   '[안내] 초기 비밀번호 강제 변경 및 보안 정책 시행',
   '정보보안 규정에 따라, 입사 시 발급받은 초기 비밀번호(1)는 최초 로그인 후 반드시 변경해야 합니다. 초기 비밀번호 변경은 최대 3회까지만 연기(다음에 변경하기)할 수 있으며, 3회를 초과하면 비밀번호를 변경해야만 시스템을 이용할 수 있습니다. 안전한 업무 환경을 위해 반드시 영문/숫자 포함 4자리 이상의 비밀번호로 변경해주시기 바랍니다.',
   1782859000000, 0);
