// nas-map.js — folder_key ↔ 실제 NAS 경로 매핑 + 경로 화이트리스트 가드.
// 지시서 §3 확정 구조. 서버 상수(비밀 아님).

// ★ 순서가 의미를 가진다 — folderKeyOf 는 위에서부터 첫 매칭을 채택하므로
//   더 구체적인 경로(/01_프로젝트/진행중)가 상위 경로(/01_프로젝트)보다 먼저 와야 한다.
export const FOLDER_ROOTS = {
  // ── 레거시(기존 nas_acl 행이 이 키를 참조 중 — 절대 이름 변경/삭제 금지) ──
  proj_active: '/01_프로젝트/진행중',
  proj_done: '/01_프로젝트/완료',
  share: '/02_공유',
  ext: '/03_외부공유',
  admin: '/09_관리자',
  // ── SEASTAR NAS 폴더 표준 v1.0 (SoT: SEDMS_G/docs/NAS_FOLDER_STANDARD.md §2) ──
  //    신 Synology SEASTAR 볼륨 실계층. additive — 기존 키 동작 불변.
  //    ACL 미등록 키는 accessFor 기본값 HIDDEN 이라 등록 전까지 자동 차단된다.
  admin_std: '/00_관리자',
  work: '/00_작업',
  proj: '/01_프로젝트',
  deploy: '/02_배포_SEDMS',
  dept: '/03_부서공유',
  ext_share: '/04_외부공유',
  r2mirror: '/05_R2동기화',
};

export const FOLDER_KEYS = Object.keys(FOLDER_ROOTS);

// 경로 정규화: 역슬래시→슬래시, 중복 슬래시 축약, 끝 슬래시 제거(루트 제외).
export function normalizePath(p) {
  if (!p) return '';
  let s = String(p).replace(/\\/g, '/').replace(/\/+/g, '/');
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

// 디렉터리 탈출(..)·상대경로 차단. 반드시 절대경로.
export function isSafePath(p) {
  if (!p) return false;
  const s = normalizePath(p);
  if (!s.startsWith('/')) return false;
  return !s.split('/').includes('..');
}

// 실제 경로가 속한 folder_key. 화이트리스트 밖이면 null.
export function folderKeyOf(p) {
  const s = normalizePath(p);
  for (const [key, root] of Object.entries(FOLDER_ROOTS)) {
    if (s === root || s.startsWith(root + '/')) return key;
  }
  return null;
}

// 클라 경로 검증+해석. { ok, path, folderKey } | { ok:false, error }.
export function resolvePath(p) {
  if (!isSafePath(p)) return { ok: false, error: 'bad_path' };
  const path = normalizePath(p);
  const folderKey = folderKeyOf(path);
  if (!folderKey) return { ok: false, error: 'outside_whitelist' };
  return { ok: true, path, folderKey };
}

// 셀프체크(프레임워크 없이) — 표준 루트 추가로 기존 매핑이 밀리면 로드 시 즉시 throw.
if (
  folderKeyOf('/01_프로젝트/진행중/32_동국22K') !== 'proj_active' ||
  folderKeyOf('/01_프로젝트/기타') !== 'proj' ||
  folderKeyOf('/03_외부공유') !== 'ext' ||
  folderKeyOf('/04_외부공유/yuil') !== 'ext_share' ||
  folderKeyOf('/99_없음') !== null ||
  isSafePath('/a/../b') !== false ||
  isSafePath('a/b') !== false
) {
  throw new Error('nas-map.js self-check failed');
}
