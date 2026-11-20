-- audit_log — 불변 감사로그(체인 해시). functions/_lib/audit.js writeAudit()/verifyAuditChain() 전용.
-- Idempotent: safe to re-run. 기존 테이블 미접촉.
--
-- ⚠ 왜 이 파일이 필요한가: NAS 삭제/ACL 변경/로그인 실패 등 모든 보안 이벤트가 writeAudit()으로
--   기록되는데, 호출부가 전부 `.catch(() => {})` 라 **테이블이 없으면 감사로그가 조용히 전부 유실**된다.
--   (감사 누락은 사고 후 추적 불가 = 보안 결함) → 스키마를 리포에 고정한다.
--
-- 컬럼은 audit.js 의 INSERT 문과 1:1 대응(순서·이름 동일해야 함).
CREATE TABLE IF NOT EXISTS audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,          -- epoch ms
  event     TEXT    NOT NULL,          -- 'nas.delete' | 'auth.login.success' | ...
  severity  TEXT    DEFAULT 'INFO',    -- INFO | WARN | ERROR | CRITICAL
  sub       TEXT,                      -- 행위자(토큰 sub)
  project   TEXT,
  ip        TEXT,
  ua        TEXT,
  resource  TEXT,                      -- 대상(파일 경로 등)
  action    TEXT,
  result    TEXT,
  meta_json TEXT,
  prev_hash TEXT NOT NULL,             -- 직전 행의 hash (체인)
  hash      TEXT NOT NULL              -- SHA-256(prev_hash + canonical(row))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log (ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_sub ON audit_log (sub);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log (event);
