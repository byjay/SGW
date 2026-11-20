/* ============================================================
   SGW NAS 로컬 브릿지 — window.sgwNasLocal  (2026-07-23)

   목적: 하이브리드 NAS의 "브라우저 직결" 절반.
     Cloudflare Worker는 사내망 NAS에 접근할 수 없다. 대신 사용자가 1회
     NAS 공유(UNC/매핑드라이브) 폴더를 고르면 FileSystemDirectoryHandle을
     IndexedDB에 영속 저장하고, 이후 목록/읽기/쓰기를 브라우저가 직접 한다.
     미지원 브라우저·미설정·권한거부면 decideMode()가 'server'를 반환해
     호출부가 기존 /api/nas/* (서버 경유)로 자동 폴백한다.

   출처(재사용 · 신규작성 아님):
     _warehouse/03-services-engines/localFs.ts
       → SEDMS_G/public/static/sedms-nas-folder.js (실동작 검증 486줄)
       → 본 파일: SEDMS 전용 로직(Layer2 org_slug 배포·리본 결선·엑셀 임포트 UI·
         토스트·모달) 전부 제거하고 범용 파일탐색기 API로 정리 + Dart interop 규약 추가.

   ★ Dart(Flutter web) interop 규약 — 반드시 지킬 것
     1) 모든 함수는 Promise를 반환하고 **절대 reject 하지 않는다.**
        실패도 `{ ok:false, error:'<code>', message:'<사람용>' }` 로 resolve.
        (dart:js_interop 에서 reject 처리는 비용이 크고 스택이 유실된다)
     2) 반환 객체는 전부 plain object / 배열 / ArrayBuffer 뿐. 클래스 인스턴스·
        FileSystemHandle 을 Dart로 넘기지 않는다(핸들은 모듈 내부에만 존재).
     3) list() 응답 스키마는 서버 GET /api/nas/list 와 동일: { files:[{name,path,isdir,size,mtime}] }
        → Dart 모델 1개로 로컬/서버 두 모드를 모두 소비한다.
     4) 시간은 epoch millis(number), 크기는 bytes(number).

   정책
     - 덮어쓰기 금지(기본): 동명 파일이면 `_v2`, `_v3` … 자동 증분. overwrite:true 로만 덮어씀.
     - 경로: 루트 기준 상대경로만. '..' · 절대경로(/, C:\) · Windows 금지문자는 차단/치환.
     - 루트는 rootKey별로 따로 저장(예: 'default', 'proj_active', 'share') → 폴더별 권한 분리.
   ============================================================ */
(function () {
  'use strict';

  var DB_NAME = 'sgw-nas';
  var DB_VERSION = 1;
  var STORE = 'handles';
  var CTRL_RE = new RegExp('[\\u0000-\\u001f\\u007f]', 'g'); // 리터럴 제어문자 회피
  var WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

  function key(rootKey) { return 'root:' + (rootKey || 'default'); }
  function fail(code, msg) { return { ok: false, error: code, message: msg || code }; }

  // ── 지원 여부 ────────────────────────────────────────────────────────────
  // File System Access API 는 보안 컨텍스트(https / localhost)에서만 노출된다.
  function isSupported() {
    return typeof window !== 'undefined' &&
      typeof window.showDirectoryPicker === 'function' &&
      (window.isSecureContext !== false);
  }

  // ── IndexedDB (의존성 0) ─────────────────────────────────────────────────
  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbReq(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  async function idbGet(k) {
    try { var db = await openDB(); return await idbReq(db.transaction(STORE, 'readonly').objectStore(STORE).get(k)); }
    catch (e) { return null; }
  }
  async function idbSet(k, v) {
    try { var db = await openDB(); await idbReq(db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k)); return true; }
    catch (e) { return false; }
  }
  async function idbDel(k) {
    try { var db = await openDB(); await idbReq(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(k)); return true; }
    catch (e) { return false; }
  }

  // ── 권한 ─────────────────────────────────────────────────────────────────
  // interactive=false 면 requestPermission(사용자 제스처 필요)을 호출하지 않는다.
  async function verifyPermission(handle, interactive) {
    if (!handle || typeof handle.queryPermission !== 'function') return true; // mock/구현없음 통과
    var opts = { mode: 'readwrite' };
    try {
      if ((await handle.queryPermission(opts)) === 'granted') return true;
      if (!interactive) return false;
      return (await handle.requestPermission(opts)) === 'granted';
    } catch (e) { return false; }
  }

  async function loadRoot(rootKey, interactive) {
    if (!isSupported()) return null;
    var h = await idbGet(key(rootKey));
    if (!h) return null;
    return (await verifyPermission(h, !!interactive)) ? h : null;
  }

  // ── 이름/경로 위생 ───────────────────────────────────────────────────────
  // Windows 금지문자 \ / : * ? " < > | · 제어문자 제거, 선행 '.' 제거, 예약어 회피.
  function sanitizeName(name, fallback) {
    var s = String(name == null ? '' : name)
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(CTRL_RE, '')
      .replace(/^\.+/, '')
      .replace(/[. ]+$/, '')   // Windows: 끝의 점·공백 금지
      .trim();
    if (s.length > 180) s = s.slice(0, 180);
    if (WIN_RESERVED.test(s)) s = '_' + s;
    return s || (fallback || 'file');
  }

  /**
   * 루트 기준 상대경로 파싱.
   * 절대경로('/x', 'C:\x', '\\\\srv\\share')와 '..' 세그먼트는 **거부**(치환 아님) —
   * 조용히 다른 폴더에 쓰는 사고를 막는다.
   * @returns {{ok:true, dirs:string[], name:string}|{ok:false,error:string}}
   */
  function parseRelPath(p) {
    var raw = String(p == null ? '' : p).replace(/\\/g, '/');
    if (!raw.trim()) return { ok: false, error: 'path_required' };
    if (raw.charAt(0) === '/' || /^[a-zA-Z]:\//.test(raw)) return { ok: false, error: 'absolute_path' };
    var segs = raw.split('/').filter(function (s) { return s !== '' && s !== '.'; });
    if (!segs.length) return { ok: false, error: 'path_required' };
    for (var i = 0; i < segs.length; i++) {
      if (segs[i] === '..') return { ok: false, error: 'path_escape' };
      // 위생 처리로 세그먼트가 통째로 사라지면(예: '...') 거부
      if (!sanitizeName(segs[i], '')) return { ok: false, error: 'bad_segment' };
    }
    var clean = segs.map(function (s) { return sanitizeName(s, ''); });
    return { ok: true, dirs: clean.slice(0, -1), name: clean[clean.length - 1] };
  }

  async function resolveDir(root, dirs, create) {
    var cur = root;
    for (var i = 0; i < dirs.length; i++) {
      cur = await cur.getDirectoryHandle(dirs[i], { create: !!create });
    }
    return cur;
  }

  async function fileExists(dir, name) {
    try { await dir.getFileHandle(name); return true; } catch (e) { return false; }
  }
  function splitExt(name) {
    var i = name.lastIndexOf('.');
    return (i > 0) ? { base: name.slice(0, i), ext: name.slice(i) } : { base: name, ext: '' };
  }
  // 덮어쓰기 금지 정책: 동명 존재 시 _v2, _v3 … 첫 빈 이름.
  // ponytail: 999회까지 선형 탐색 후 타임스탬프. 실무상 도달 불가한 한계.
  async function uniqueName(dir, name) {
    if (!(await fileExists(dir, name))) return name;
    var p = splitExt(name);
    for (var i = 2; i <= 999; i++) {
      var cand = p.base + '_v' + i + p.ext;
      if (!(await fileExists(dir, cand))) return cand;
    }
    return p.base + '_' + Date.now() + p.ext;
  }

  function toBlob(data) {
    if (data == null) return new Blob([]);
    if (typeof Blob !== 'undefined' && data instanceof Blob) return data;
    if (typeof data === 'string') return new Blob([data], { type: 'text/plain;charset=utf-8' });
    // ArrayBuffer / TypedArray / DataView (Dart의 ByteBuffer·Uint8List 포함)
    return new Blob([data]);
  }

  // ── 공개 API ─────────────────────────────────────────────────────────────

  /** 1회 폴더 선택(사용자 제스처 필요). → {ok,name} | {ok:false,error} */
  async function pickFolder(opts) {
    opts = opts || {};
    if (!isSupported()) return fail('unsupported', '이 브라우저는 폴더 직접 접근을 지원하지 않습니다 (Chrome/Edge 필요)');
    try {
      var h = await window.showDirectoryPicker({
        mode: 'readwrite',
        id: 'sgw-nas-' + (opts.rootKey || 'default'),
        startIn: 'documents',
      });
      await idbSet(key(opts.rootKey), h);
      return { ok: true, name: h.name || '', rootKey: opts.rootKey || 'default' };
    } catch (e) {
      if (e && e.name === 'AbortError') return fail('cancelled', '사용자가 취소했습니다');
      return fail('pick_failed', String((e && e.message) || e));
    }
  }

  /** 저장된 루트 핸들 존재+권한 여부(비대화형). → boolean */
  async function hasHandle(rootKey) {
    return !!(await loadRoot(rootKey, false));
  }

  /** 상태 요약. → {supported, configured, name, granted, rootKey} */
  async function getStatus(rootKey) {
    var st = { supported: isSupported(), configured: false, name: '', granted: false, rootKey: rootKey || 'default' };
    if (!st.supported) return st;
    var h = await idbGet(key(rootKey));
    if (!h) return st;
    st.configured = true;
    st.name = h.name || '';
    st.granted = await verifyPermission(h, false);
    return st;
  }

  /** 이 rootKey의 설정 해제. → {ok:true} */
  async function forget(rootKey) {
    await idbDel(key(rootKey));
    return { ok: true };
  }

  /**
   * 하이브리드 모드 판정 — 호출부는 이 값만 보고 로컬/서버를 고른다.
   * → { mode:'local'|'server', reason:'ok'|'unsupported'|'insecure_context'|'no_handle'|'permission_denied' }
   */
  async function decideMode(rootKey) {
    if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
      return { mode: 'server', reason: 'unsupported' };
    }
    if (window.isSecureContext === false) return { mode: 'server', reason: 'insecure_context' };
    var h = await idbGet(key(rootKey));
    if (!h) return { mode: 'server', reason: 'no_handle' };
    if (!(await verifyPermission(h, false))) return { mode: 'server', reason: 'permission_denied' };
    return { mode: 'local', reason: 'ok' };
  }

  /**
   * 폴더 목록. opts: { rootKey?, path?:'sub/dir', depth?:0, exts?:string[], interactive?:bool }
   * depth 0 = 해당 폴더만. 스키마는 서버 /api/nas/list 와 동일.
   * → { ok:true, files:[{name,path,isdir,size,mtime}] } | {ok:false,error}
   */
  async function list(opts) {
    opts = opts || {};
    var root = await loadRoot(opts.rootKey, !!opts.interactive);
    if (!root) return fail('no_handle', 'NAS 폴더가 설정되지 않았거나 권한이 없습니다');

    var base = root, prefix = '';
    if (opts.path) {
      var segs = String(opts.path).replace(/\\/g, '/').split('/').filter(Boolean);
      for (var i = 0; i < segs.length; i++) {
        if (segs[i] === '..') return fail('path_escape', '상위 폴더 접근이 차단되었습니다');
        var seg = sanitizeName(segs[i], '');
        if (!seg) return fail('bad_segment', '잘못된 폴더명');
        try { base = await base.getDirectoryHandle(seg, { create: false }); }
        catch (e) { return fail('not_found', '폴더를 찾을 수 없습니다: ' + segs[i]); }
        prefix += seg + '/';
      }
    }

    var matchRe = null;
    if (Array.isArray(opts.exts) && opts.exts.length) {
      var cleaned = opts.exts.map(function (e) { return String(e).replace(/[^a-z0-9]/gi, ''); }).filter(Boolean);
      if (cleaned.length) matchRe = new RegExp('\\.(' + cleaned.join('|') + ')$', 'i');
    }
    var maxDepth = (typeof opts.depth === 'number' && opts.depth >= 0) ? opts.depth : 0;

    var out = [];
    async function scan(dir, pre, depth) {
      for await (var pair of dir.entries()) {
        var nm = pair[0], entry = pair[1];
        if (entry.kind === 'directory') {
          out.push({ name: nm, path: pre + nm, isdir: true, size: 0, mtime: 0 });
          if (depth < maxDepth) { try { await scan(entry, pre + nm + '/', depth + 1); } catch (e) { /* 권한 없는 하위 건너뜀 */ } }
        } else if (entry.kind === 'file') {
          if (matchRe && !matchRe.test(nm)) continue;
          var size = 0, mtime = 0;
          try { var f = await entry.getFile(); size = f.size; mtime = f.lastModified; } catch (e) { /* 잠긴 파일 */ }
          out.push({ name: nm, path: pre + nm, isdir: false, size: size, mtime: mtime });
        }
      }
    }
    try { await scan(base, prefix, 0); }
    catch (e) { return fail('read_failed', String((e && e.message) || e)); }

    // 폴더 먼저, 그 다음 최신 파일 우선.
    out.sort(function (a, b) {
      if (a.isdir !== b.isdir) return a.isdir ? -1 : 1;
      if (a.isdir) return a.name.localeCompare(b.name, 'ko');
      return (b.mtime || 0) - (a.mtime || 0);
    });
    return { ok: true, files: out };
  }

  /**
   * 파일 읽기. opts: { rootKey?, path:'sub/file.xlsx', as?:'arraybuffer'|'text' }
   * → { ok:true, name, path, size, mtime, type, data:ArrayBuffer|string }
   */
  async function readFile(opts) {
    opts = opts || {};
    var rel = parseRelPath(opts.path);
    if (!rel.ok) return fail(rel.error, '잘못된 경로입니다: ' + opts.path);
    var root = await loadRoot(opts.rootKey, false);
    if (!root) return fail('no_handle', 'NAS 폴더가 설정되지 않았거나 권한이 없습니다');
    try {
      var dir = await resolveDir(root, rel.dirs, false);
      var fh = await dir.getFileHandle(rel.name, { create: false });
      var file = await fh.getFile();
      var data = (opts.as === 'text') ? await file.text() : await file.arrayBuffer();
      return {
        ok: true, name: rel.name, path: rel.dirs.concat([rel.name]).join('/'),
        size: file.size, mtime: file.lastModified, type: file.type || '', data: data,
      };
    } catch (e) {
      if (e && (e.name === 'NotFoundError')) return fail('not_found', '파일을 찾을 수 없습니다');
      return fail('read_failed', String((e && e.message) || e));
    }
  }

  /**
   * 파일 쓰기(기본 비파괴). opts: { rootKey?, path, data, overwrite?:false, createDirs?:true }
   * data: ArrayBuffer | TypedArray | Blob | string
   * → { ok:true, name, path, renamed:boolean }
   */
  async function writeFile(opts) {
    opts = opts || {};
    var rel = parseRelPath(opts.path);
    if (!rel.ok) return fail(rel.error, '잘못된 경로입니다: ' + opts.path);
    var root = await loadRoot(opts.rootKey, true);   // 쓰기는 필요 시 권한 재확인(사용자 제스처 맥락)
    if (!root) return fail('no_handle', 'NAS 폴더가 설정되지 않았거나 권한이 없습니다');
    try {
      var dir = await resolveDir(root, rel.dirs, opts.createDirs !== false);
      var fname = opts.overwrite ? rel.name : await uniqueName(dir, rel.name);
      var fh = await dir.getFileHandle(fname, { create: true });
      var w = await fh.createWritable();
      try { await w.write(toBlob(opts.data)); } finally { await w.close(); }
      return {
        ok: true, name: fname, path: rel.dirs.concat([fname]).join('/'),
        renamed: fname !== rel.name,
      };
    } catch (e) {
      if (e && e.name === 'NotFoundError') return fail('not_found', '대상 폴더가 없습니다');
      if (e && e.name === 'NotAllowedError') return fail('permission_denied', '쓰기 권한이 거부되었습니다');
      return fail('write_failed', String((e && e.message) || e));
    }
  }

  window.sgwNasLocal = {
    version: '1.0.0',
    isSupported: isSupported,
    decideMode: decideMode,
    getStatus: getStatus,
    hasHandle: hasHandle,
    pickFolder: pickFolder,
    forget: forget,
    list: list,
    readFile: readFile,
    writeFile: writeFile,
    // 테스트 전용(하네스에서 직접 호출) — UI/Dart는 쓰지 않는다.
    _sanitizeName: sanitizeName,
    _parseRelPath: parseRelPath,
    _uniqueName: uniqueName,
  };
})();
