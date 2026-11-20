-- SGW 주간보고(weekly_reports + weekly_entries + projects) — Cloudflare D1 shared backend.
-- Idempotent: safe to re-run. 기존 테이블(sgw_users/posts/leave_requests/...) 미접촉.
-- env.DB = sgw-employees. Batch① 백엔드(스키마+시드).

-- 주차·프로젝트 단위 보고 헤더(제목·기간·결재 상태). 복합 PK로 주차×프로젝트 유일.
CREATE TABLE IF NOT EXISTS weekly_reports (
  week_id TEXT,
  project_id TEXT,
  title TEXT,
  period_from TEXT,
  period_to TEXT,
  approve_applied INTEGER DEFAULT 0,
  approve_done INTEGER DEFAULT 0,
  approve_note TEXT DEFAULT '',
  created_at INTEGER,
  updated_at INTEGER,
  PRIMARY KEY (week_id, project_id)
);

-- 담당(discipline)×섹션(this/next) 단위 항목. 담당 단위 저장이라 서로 안 덮음.
-- section ∈ {this,next}, discipline ∈ {piping,steel,cabin,machinery,electric}
CREATE TABLE IF NOT EXISTS weekly_entries (
  week_id TEXT,
  project_id TEXT,
  section TEXT,
  discipline TEXT,
  author_id TEXT,
  author_name TEXT,
  lines_json TEXT DEFAULT '[]',
  remark TEXT DEFAULT '',
  updated_at INTEGER,
  PRIMARY KEY (week_id, project_id, section, discipline)
);

-- 프로젝트 마스터. active·sort 순 노출.
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT,
  phase TEXT DEFAULT '기본설계',
  active INTEGER DEFAULT 1,
  sort INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO projects (id, name, phase, active, sort) VALUES
  ('dk22k', '동국 22K FLOATING DOCK', '기본설계', 1, 0);
