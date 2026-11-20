-- SGW 전자결재(approvals) Batch4 컬럼 마이그레이션 — 첨부/금액 온전화.
-- v2 team_connect ApprovalDoc의 amount / attachmentName / attachmentData 왕복 지원.
-- NOTE: SQLite `ADD COLUMN`은 컬럼이 이미 있으면 "duplicate column name" 에러를 낸다.
--       세 ALTER를 best-effort로 각각 실행(그 에러만 무시)하면 멱등적으로 안전하다.
ALTER TABLE approvals ADD COLUMN amount INTEGER;
ALTER TABLE approvals ADD COLUMN attachment_name TEXT;
ALTER TABLE approvals ADD COLUMN attachment_data TEXT;
