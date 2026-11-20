-- SGW 근태(attendance) — Cloudflare D1 shared backend.
-- Idempotent: safe to re-run. 출퇴근 기록(clock_in/clock_out) 크로스브라우저 영속.
-- v2 team_connect Home 출퇴근(GPS+비번 재인증) 왕복 지원.
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT,           -- 'clock_in' | 'clock_out'
  timestamp INTEGER,
  location TEXT
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_ts ON attendance(user_id, timestamp);
