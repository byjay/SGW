-- SGW 사내메일·메모·회의록 — Cloudflare D1 shared backend (v2 team_connect + swgs 공유).
-- Idempotent & additive: safe to re-run. 기존 테이블(employees/sgw_users/presence/messages/
-- chat_*/leave_requests/posts/weekly_*/approvals/attendance/nas_acl) 전부 미접촉.

-- 사내메일: 발신자↔수신자 1:1 메일. sender/recipient 만 조회 가능(토큰 sub 스코프).
CREATE TABLE IF NOT EXISTS internal_mail (
  id TEXT PRIMARY KEY,
  sender_id TEXT,
  sender_name TEXT,
  recipient_id TEXT,
  recipient_name TEXT,
  subject TEXT,
  body TEXT,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_internal_mail_recipient ON internal_mail (recipient_id);
CREATE INDEX IF NOT EXISTS idx_internal_mail_sender ON internal_mail (sender_id);

-- 개인 메모: 소유자 전용(user_id 스코프). 작성/조회/수정/삭제 모두 소유자만.
CREATE TABLE IF NOT EXISTS memos (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT,
  content TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_memos_user ON memos (user_id);

-- 회의록: 전직원 열람. 작성/수정/삭제는 작성자(author)만. doc_data 는 base64 docx(옵션).
CREATE TABLE IF NOT EXISTS minutes (
  id TEXT PRIMARY KEY,
  author_id TEXT,
  author_name TEXT,
  title TEXT,
  content TEXT,
  attendees TEXT,
  meeting_date TEXT,
  doc_data TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_minutes_created ON minutes (created_at);
