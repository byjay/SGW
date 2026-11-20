-- SGW 채팅 메시지(chat_messages) 첨부 컬럼 마이그레이션 — 그룹채팅 첨부 서버 영속.
-- v2 team_connect 그룹채팅 파일/이미지 첨부(fileName/fileData) 왕복 지원(1:1 쪽지와 동일 규격).
-- NOTE: SQLite `ADD COLUMN`은 컬럼이 이미 있으면 "duplicate column name" 에러를 낸다.
--       각 ALTER를 best-effort로 실행(그 에러만 무시)하면 멱등적으로 안전하다.
ALTER TABLE chat_messages ADD COLUMN file_name TEXT;
ALTER TABLE chat_messages ADD COLUMN file_data TEXT;
