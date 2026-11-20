-- nas_acl — NAS 폴더 접근 권한 매트릭스 (sgw-employees D1).
-- subject_type: role | dept | user, folder_key: proj_active|proj_done|share|ext|admin, level: RW|RO|HIDDEN.
-- 우선순위 user>dept>role, 없으면 기본 HIDDEN(서버 nas-acl.js 참조).
CREATE TABLE IF NOT EXISTS nas_acl (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL,
  subject      TEXT NOT NULL,
  folder_key   TEXT NOT NULL,
  level        TEXT NOT NULL,
  UNIQUE(subject_type, subject, folder_key)
);

-- 기본 시드(역할별). admin→전폴더 RW, engineer→proj/share/ext RW·admin HIDDEN, viewer→share RO·나머지 HIDDEN.
INSERT OR REPLACE INTO nas_acl(subject_type, subject, folder_key, level) VALUES
 ('role','admin','proj_active','RW'),
 ('role','admin','proj_done','RW'),
 ('role','admin','share','RW'),
 ('role','admin','ext','RW'),
 ('role','admin','admin','RW'),
 ('role','engineer','proj_active','RW'),
 ('role','engineer','proj_done','RW'),
 ('role','engineer','share','RW'),
 ('role','engineer','ext','RW'),
 ('role','engineer','admin','HIDDEN'),
 ('role','viewer','proj_active','HIDDEN'),
 ('role','viewer','proj_done','HIDDEN'),
 ('role','viewer','share','RO'),
 ('role','viewer','ext','HIDDEN'),
 ('role','viewer','admin','HIDDEN');
