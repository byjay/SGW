// nas-client.js — Synology FileStation 클라이언트.
// 서비스계정 세션(sid)은 모듈 전역 캐시(직원 노출 X). 401/세션만료 시 자동 재로그인.
// 비밀은 env에만: NAS_BASE_URL / NAS_SVC_ACCOUNT / NAS_SVC_PASSWORD. 미설정 시 NasNotConfigured.
// 응답을 v2 계약({files:[{name,path,isdir,size,mtime초}]} 등)으로 변환.

let _sid = null;      // 캐시된 세션 id
let _sidBase = null;  // sid가 속한 base url

export class NasNotConfigured extends Error {
  constructor(msg) { super(msg || 'NAS 미설정'); this.name = 'NasNotConfigured'; }
}
export class NasError extends Error {
  constructor(msg, code) { super(msg); this.name = 'NasError'; this.code = code; }
}

// 세션 만료/무효 관련 Synology 에러코드.
const SESSION_CODES = new Set([105, 106, 107, 119]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isConfigured(env) {
  return !!(env && env.NAS_BASE_URL && env.NAS_SVC_ACCOUNT && env.NAS_SVC_PASSWORD);
}

function cfg(env) {
  if (!isConfigured(env)) throw new NasNotConfigured('NAS 미설정');
  return {
    base: String(env.NAS_BASE_URL).replace(/\/+$/, ''),
    account: env.NAS_SVC_ACCOUNT,
    passwd: env.NAS_SVC_PASSWORD,
  };
}

async function login(env) {
  const { base, account, passwd } = cfg(env);
  const url = `${base}/webapi/auth.cgi?api=SYNO.API.Auth&version=6&method=login`
    + `&account=${encodeURIComponent(account)}&passwd=${encodeURIComponent(passwd)}`
    + `&session=FileStation&format=sid`;
  const res = await fetch(url);
  const j = await res.json().catch(() => null);
  if (!j || !j.success || !j.data || !j.data.sid) {
    throw new NasError('NAS 로그인 실패', j && j.error ? j.error.code : 'no_sid');
  }
  _sid = j.data.sid;
  _sidBase = base;
  return _sid;
}

async function sid(env, force = false) {
  const { base } = cfg(env);
  if (force || !_sid || _sidBase !== base) return login(env);
  return _sid;
}

// entry.cgi GET 호출 + 세션만료 시 1회 재로그인.
async function apiGet(env, params) {
  const { base } = cfg(env);
  let s = await sid(env);
  for (let attempt = 0; attempt < 2; attempt++) {
    const qs = new URLSearchParams({ ...params, _sid: s }).toString();
    const res = await fetch(`${base}/webapi/entry.cgi?${qs}`);
    const j = await res.json().catch(() => null);
    if (j && j.success) return j;
    const code = j && j.error ? j.error.code : null;
    if (attempt === 0 && SESSION_CODES.has(code)) { s = await sid(env, true); continue; }
    throw new NasError('FileStation 오류', code);
  }
  throw new NasError('FileStation 오류', 'unreachable');
}

// 비동기 작업(CopyMove/Delete) taskid 폴링.
async function pollTask(env, api, version, taskid, maxMs = 25000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const j = await apiGet(env, { api, version, method: 'status', taskid });
    if (j.data && j.data.finished) {
      if (j.data.errors && j.data.errors.code) throw new NasError('작업 실패', j.data.errors.code);
      return true;
    }
    await sleep(600);
  }
  throw new NasError('작업 시간초과', 'timeout');
}

// ── 공개 API ──────────────────────────────────────────

// SYNO.FileStation.List → { files:[{name,path,isdir,size,mtime}] }.
export async function list(env, path) {
  const j = await apiGet(env, {
    api: 'SYNO.FileStation.List', version: '2', method: 'list',
    folder_path: path, additional: '["size","time","type"]',
  });
  const files = ((j.data && j.data.files) || []).map((f) => ({
    name: f.name,
    path: f.path,
    isdir: !!f.isdir,
    size: f.additional && f.additional.size != null ? Number(f.additional.size) : 0,
    mtime: f.additional && f.additional.time ? Number(f.additional.time.mtime) : 0,
  }));
  return { files };
}

// SYNO.FileStation.Download → 원본 스트림 Response(호출부가 그대로 pass-through).
export async function download(env, path) {
  const { base } = cfg(env);
  const build = (sess) =>
    `${base}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&mode=download`
    + `&path=${encodeURIComponent(path)}&_sid=${encodeURIComponent(sess)}`;
  let s = await sid(env);
  let res = await fetch(build(s));
  // 세션만료 시 JSON 에러가 돌아옴 → 1회 재로그인 후 재시도.
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    const j = await res.clone().json().catch(() => null);
    if (j && !j.success) { s = await sid(env, true); res = await fetch(build(s)); }
  }
  return res;
}

// SYNO.FileStation.Upload (multipart, 파일 파트 마지막). fileBlob = Blob/File.
export async function upload(env, dirPath, fileName, fileBlob) {
  const { base } = cfg(env);
  const doUpload = async (sess) => {
    const fd = new FormData();
    fd.append('api', 'SYNO.FileStation.Upload');
    fd.append('version', '2');
    fd.append('method', 'upload');
    fd.append('path', dirPath);
    fd.append('create_parents', 'true');
    fd.append('overwrite', 'true');
    fd.append('file', fileBlob, fileName); // ★ 파일 파트는 반드시 마지막
    return fetch(`${base}/webapi/entry.cgi?_sid=${encodeURIComponent(sess)}`, { method: 'POST', body: fd });
  };
  let s = await sid(env);
  let res = await doUpload(s);
  let j = await res.json().catch(() => null);
  if (j && !j.success && j.error && SESSION_CODES.has(j.error.code)) {
    s = await sid(env, true);
    res = await doUpload(s);
    j = await res.json().catch(() => null);
  }
  if (!j || !j.success) throw new NasError('업로드 실패', j && j.error ? j.error.code : null);
  return { ok: true };
}

// SYNO.FileStation.Rename.
export async function rename(env, path, name) {
  await apiGet(env, { api: 'SYNO.FileStation.Rename', version: '2', method: 'rename', path, name });
  return { ok: true };
}

// SYNO.FileStation.CopyMove (비동기 taskid 폴링). move=true → 이동, false → 복사.
export async function copyMove(env, from, toDir, move) {
  const start = await apiGet(env, {
    api: 'SYNO.FileStation.CopyMove', version: '3', method: 'start',
    path: from, dest_folder_path: toDir, overwrite: 'false', remove_src: move ? 'true' : 'false',
  });
  const taskid = start.data && start.data.taskid;
  if (taskid) await pollTask(env, 'SYNO.FileStation.CopyMove', '3', taskid);
  return { ok: true };
}

// SYNO.FileStation.Delete (비동기 taskid 폴링).
// ponytail: FileStation.Delete는 영구삭제(휴지통 API 미제공). 복구는 DSM 스냅샷/버전관리에 의존.
export async function del(env, path) {
  const start = await apiGet(env, {
    api: 'SYNO.FileStation.Delete', version: '2', method: 'start', path,
  });
  const taskid = start.data && start.data.taskid;
  if (taskid) await pollTask(env, 'SYNO.FileStation.Delete', '2', taskid);
  return { ok: true };
}

// SYNO.FileStation.Sharing → { url }.
export async function shareLink(env, path) {
  const j = await apiGet(env, { api: 'SYNO.FileStation.Sharing', version: '3', method: 'create', path });
  const links = (j.data && j.data.links) || [];
  const url = links.length ? links[0].url : null;
  if (!url) throw new NasError('공유링크 생성 실패');
  return { url };
}
