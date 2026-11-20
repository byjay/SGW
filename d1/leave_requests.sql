-- SGW 연차(leave_requests) — Cloudflare D1 shared backend (v2 team_connect + swgs React 공유).
-- Idempotent: safe to re-run. Source of truth: services/mockServer.ts INITIAL_LEAVE_REQUESTS.
-- 기존 테이블(employees/sgw_users/presence/messages/chat_*) 미접촉.
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  type TEXT,
  start_date TEXT,
  end_date TEXT,
  days REAL,
  status TEXT,
  reason TEXT,
  emergency_contact TEXT,
  request_date INTEGER
);

INSERT OR IGNORE INTO leave_requests (id, user_id, user_name, type, start_date, end_date, days, status, reason, emergency_contact, request_date) VALUES
  ('leave_1',  '9', '이선우', 'annual',         '2026-01-02', '2026-01-02', 1,   'approved', '', '', 1767312000000),
  ('leave_2',  '9', '이선우', 'morning_half',   '2026-02-03', '2026-02-03', 0.5, 'approved', '', '', 1770076800000),
  ('leave_3',  '3', '김미진', 'morning_half',   '2026-02-05', '2026-02-05', 0.5, 'approved', '', '', 1770249600000),
  ('leave_4',  '3', '김미진', 'afternoon_half', '2026-02-25', '2026-02-25', 0.5, 'approved', '', '', 1771977600000),
  ('leave_14', '3', '김미진', 'afternoon_half', '2026-02-27', '2026-02-27', 0.5, 'approved', '', '', 1772150400000),
  ('leave_5',  '4', '김민경', 'annual',         '2026-01-09', '2026-01-09', 1,   'approved', '', '', 1767916800000),
  ('leave_6',  '4', '김민경', 'annual',         '2026-01-16', '2026-01-16', 1,   'approved', '', '', 1768521600000),
  ('leave_7',  '4', '김민경', 'annual',         '2026-01-23', '2026-01-23', 1,   'approved', '', '', 1769126400000),
  ('leave_11', '4', '김민경', 'annual',         '2026-02-27', '2026-02-27', 1,   'approved', '', '', 1772150400000),
  ('leave_12', '4', '김민경', 'afternoon_half', '2026-03-06', '2026-03-06', 0.5, 'approved', '', '', 1772755200000),
  ('leave_13', '4', '김민경', 'annual',         '2026-03-25', '2026-03-25', 1,   'approved', '', '', 1774396800000);
