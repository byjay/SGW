-- SGW shared employee roster (read model) — separate from sgw-admin owned `employees` table.
-- Idempotent: safe to re-run. Source of truth: services/mockServer.ts INITIAL_USERS (11).
CREATE TABLE IF NOT EXISTS sgw_users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  role TEXT,
  department TEXT,
  position TEXT,
  annual_leave INTEGER,
  join_date TEXT,
  status TEXT,
  is_part_time INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO sgw_users (id, name, email, role, department, position, annual_leave, join_date, status, is_part_time) VALUES
  ('1',  '고영관', 'kohyk@seastargo.com',      'manager', '임원', 'CEO',        0,  '2010-01-01', 'active', 0),
  ('2',  '고재이', 'jkohkr@seastargo.com',     'user',    '임원', '이사',       0,  '',           'active', 0),
  ('3',  '김미진', 'kimmj@seastargo.com',      'user',    '배관', '부장',       19, '2023-10-16', 'active', 0),
  ('4',  '김민경', 'min55@seastargo.com',      'user',    '배관', '과장',       19, '2018-12-11', 'active', 0),
  ('5',  '김봉정', 'designsir@seastargo.com',  'admin',   '전장', '부장',       19, '2019-04-01', 'active', 0),
  ('6',  '김정인', 'bsbinin@seastargo.com',    'user',    '전장', '부장',       19, '2024-01-15', 'active', 0),
  ('7',  '박규진', 'elcon0955@seastargo.com',  'user',    '임원', '전무',       19, '',           'active', 0),
  ('8',  '윤승현', 'seayun@seastargo.com',     'user',    '',     '아르바이트', 0,  '',           'active', 1),
  ('9',  '이선우', 'lsw00@seastargo.com',      'manager', '배관', '부장',       19, '2017-07-01', 'active', 0),
  ('10', '이재명', 'jmlee@seastargo.com',      'user',    '임원', '전무',       19, '2020-01-01', 'active', 0),
  ('11', '장현영', 'hyjang9593@seastargo.com', 'user',    '서무', '주임',       19, '2026-03-03', 'active', 0);
