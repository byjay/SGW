-- SGW 전자결재(approvals) — Cloudflare D1 shared backend.
-- Idempotent: safe to re-run. mockServer Approval 모델에 맞춘 필드 (초기 시드 없음).
-- doc_type / steps_json 은 v2 team_connect 다단계 결재 forward-compat용(nullable).
-- 기존 테이블(employees/sgw_users/presence/messages/chat_*) 미접촉.
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  doc_type TEXT,
  title TEXT,
  requester_id TEXT,
  requester_name TEXT,
  approver_id TEXT,
  approver_name TEXT,
  status TEXT,
  content TEXT,
  attachment TEXT,
  steps_json TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
