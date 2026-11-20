-- SGW leave columns migration for sgw_users (Batch 2 — 연차 온전화).
-- Adds total_leave / carryover to the shared roster read model.
-- NOTE: SQLite `ADD COLUMN` errors if the column already exists ("duplicate column name").
--       Run the two ALTER statements best-effort (ignore that specific error); the
--       UPDATE seed below is fully idempotent (re-runnable). Source of truth for the
--       seed values: services/mockServer.ts INITIAL_USERS (totalLeave / carryover).
ALTER TABLE sgw_users ADD COLUMN total_leave INTEGER DEFAULT 15;
ALTER TABLE sgw_users ADD COLUMN carryover INTEGER DEFAULT 0;

UPDATE sgw_users SET total_leave = 0,  carryover = 0 WHERE id = '1';   -- 고영관 CEO
UPDATE sgw_users SET total_leave = 0,  carryover = 0 WHERE id = '2';   -- 고재이 이사
UPDATE sgw_users SET total_leave = 19, carryover = 0 WHERE id = '3';   -- 김미진
UPDATE sgw_users SET total_leave = 19, carryover = 0 WHERE id = '4';   -- 김민경
UPDATE sgw_users SET total_leave = 19, carryover = 0 WHERE id = '5';   -- 김봉정 (admin)
UPDATE sgw_users SET total_leave = 19, carryover = 0 WHERE id = '6';   -- 김정인
UPDATE sgw_users SET total_leave = 19, carryover = 0 WHERE id = '7';   -- 박규진
UPDATE sgw_users SET total_leave = 0,  carryover = 0 WHERE id = '8';   -- 윤승현 (part-time)
UPDATE sgw_users SET total_leave = 19, carryover = 0 WHERE id = '9';   -- 이선우
UPDATE sgw_users SET total_leave = 19, carryover = 0 WHERE id = '10';  -- 이재명
UPDATE sgw_users SET total_leave = 19, carryover = 0 WHERE id = '11';  -- 장현영
