/* Seastar GW — Background Service Worker
 *
 * 1. 활동 폴링 (1분마다): 새 메시지/연차/결재/공지 → chrome.notifications
 * 2. 영구 세션 유지 (chrome.storage)
 * 3. 자동 업데이트 체크 (1시간마다 update_url)
 * 4. 메시지 허브
 */

import { storage, KEYS, DEFAULTS } from '../lib/storage.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(()=>{});

const UPDATE_URL = 'https://swgs-internal.pages.dev/version.json';

// 폴링 주기 = 옵션값(기본 1분) — alarm 최소 주기는 Chrome 정책상 1분
async function setupAlarms() {
  let p = parseInt(await storage.get(KEYS.POLL_INTERVAL_MIN), 10);
  if (!Number.isFinite(p) || p < 1) p = DEFAULTS.poll_interval_min;
  if (p > 30) p = 30;
  chrome.alarms.create('swgs_activity_poll', { periodInMinutes: p, when: Date.now() + 5000 });
  // ★ 30분마다 새 버전 확인 (Chrome 기본 5~10시간 → 30분으로 단축)
  chrome.alarms.create('swgs_update_check', { periodInMinutes: 30, when: Date.now() + 15000 });
}

chrome.runtime.onInstalled.addListener(() => { setupAlarms(); setupContextMenus(); });
chrome.runtime.onStartup.addListener(() => {
  setupAlarms();
  setupContextMenus();
  // 시작 시 즉시 한 번 체크
  setTimeout(() => checkUpdate(true), 3000);
});

/* ════════ 빠른 접근 — 단축키 + 우클릭 메뉴 ════════ */
async function openSedms()     { chrome.tabs.create({ url: (await storage.get(KEYS.SEDMS_HOST)) || DEFAULTS.sedms_host }); }
async function openGroupware() { chrome.tabs.create({ url: (await storage.get(KEYS.GW_HOST))    || DEFAULTS.gw_host }); }

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'swgs-open-sedms',     title: '📂 SEDMS 새 창으로 열기',     contexts: ['action'] });
    chrome.contextMenus.create({ id: 'swgs-open-groupware', title: '🌐 그룹웨어 새 창으로 열기',   contexts: ['action'] });
  });
}
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'swgs-open-sedms')     openSedms();
  else if (info.menuItemId === 'swgs-open-groupware') openGroupware();
});
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === 'open-sedms')     openSedms();
  else if (cmd === 'open-groupware') openGroupware();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'swgs_activity_poll') pollActivity();
  else if (alarm.name === 'swgs_update_check') checkUpdate();
});

/* ════════ 활동 폴링 — SGW 페이지 keep-alive 방식 ════════
 * SGW (sgw.seastar.work)는 React MockServer 기반이라 별도 API endpoint가 없음.
 * 따라서 SGW 탭이 열려있으면 그 탭의 content script가 직접 알림을 보냄 (3초 루프).
 * 탭이 없으면 — 사이드 패널이 폴링 시 백그라운드 탭으로 SGW를 잠깐 열어 활동을 받아옴.
 */
async function pollActivity() {
  const enabled = await storage.get(KEYS.NOTIFICATIONS_ENABLED);
  if (enabled === false) return;
  const empNum = await storage.get(KEYS.EMP_NUM);
  if (!empNum) return;

  // SGW 탭이 이미 열려있는지 확인
  const host = (await storage.get(KEYS.GW_HOST)) || DEFAULTS.gw_host;
  const tabs = await chrome.tabs.query({ url: host + '/*' });
  if (tabs.length > 0) {
    // 열려있으면 — content script 가 자동 보고 (별도 작업 불필요)
    // 사이드 패널만 갱신
    chrome.runtime.sendMessage({ type: 'SWGS_COUNTS_UPDATE', counts: _stateCounts }).catch(()=>{});
    return;
  }

  // SGW 탭 없음 → 백그라운드로 잠시 keep-alive (옵션)
  // 너무 공격적이면 사용자 산만 → 주석 처리, 필요시 활성화
  // try {
  //   const win = await chrome.windows.create({ url: host, focused: false, state: 'minimized' });
  //   setTimeout(() => chrome.windows.remove(win.id).catch(()=>{}), 15000);
  // } catch (e) {}
}

chrome.notifications.onClicked.addListener(async (nid) => {
  if (!nid.startsWith('swgs-')) return;
  // 알림 클릭 → 해당 페이지 열기 + 알림 닫기
  const kind = nid.split('-')[1];
  const host = (await storage.get(KEYS.GW_HOST)) || DEFAULTS.gw_host;
  const path = ({ notice: '/board', leave: '/leave', message: '/messages', approval: '/approval' })[kind] || '/';
  if (kind === 'message') {
    // 쪽지는 메신저 팝업 창으로
    chrome.windows.create({ url: host + '/messages', type: 'popup', width: 460, height: 760, focused: true }).catch(() => chrome.tabs.create({ url: host + path }));
  } else {
    chrome.tabs.create({ url: host + path });
  }
  chrome.notifications.clear(nid);
});

/* ════════ 업데이트 확인 (알림만 — 자동 reload/download 없음) ════════
 * 새 버전 감지 시 사이드패널 배너 + OS 알림만 표시.
 * 실제 적용은 사용자가 명시적으로 SWGS_FORCE_RELOAD 메시지를 보내야 실행됨.
 */
async function autoUpdateNow() {
  try {
    const r = await fetch(UPDATE_URL + '?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return { ok: false, err: 'HTTP ' + r.status };
    const j = await r.json();
    const myVer = chrome.runtime.getManifest().version;
    if (compareVer(j.version, myVer) <= 0) {
      return { ok: true, upToDate: true, version: myVer };
    }
    // 새 버전 있음 — 알림만 표시 (자동 reload 없음)
    chrome.runtime.sendMessage({ type: 'SWGS_UPDATE_AVAILABLE', version: j.version }).catch(()=>{});
    chrome.notifications.create('swgs-update-' + j.version, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: '✨ Seastar GW 업데이트',
      message: `v${j.version} 새 버전이 있습니다. 사이드패널에서 즉시 적용하세요.`,
      priority: 1, requireInteraction: false
    });
    return { ok: true, notified: true, newVersion: j.version };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

/* ════════ 자동 업데이트 (CF Pages 빌드 → CRX 실다운로드 + 알림) ════════
 * ★ chrome.runtime.reload()는 "지금 디스크에 설치된 버전"으로 재시작만 할 뿐
 *   update_url에서 새 CRX를 받아오지 않는다 — 실제 다운로드/설치는
 *   chrome.runtime.requestUpdateCheck()가 담당한다. 이 호출이 빠지면
 *   "즉시 업데이트"를 눌러도 옛 버전 그대로 재시작되어 "자동 업데이트 안 됨"처럼 보인다. */
async function checkUpdate(verbose = false) {
  try {
    const r = await fetch(UPDATE_URL + '?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    const myVer = chrome.runtime.getManifest().version;
    await storage.set('swgs_last_update_check', Date.now());
    await storage.set('swgs_server_version', j.version);

    if (compareVer(j.version, myVer) <= 0) {
      if (verbose) chrome.runtime.sendMessage({ type: 'SWGS_UPDATE_CHECKED', upToDate: true, version: myVer }).catch(()=>{});
      return;
    }

    console.log('[SGW SW] 새 버전 감지:', myVer, '→', j.version);

    // ★ Chrome에 실제 CRX 재다운로드/설치를 요청 (policy update_url 기준)
    try { await chrome.runtime.requestUpdateCheck(); } catch (e) { console.warn('[SGW SW] requestUpdateCheck 실패:', e); }

    // 사이드패널에 알림 배너 표시
    chrome.runtime.sendMessage({ type: 'SWGS_UPDATE_AVAILABLE', version: j.version }).catch(()=>{});

    // OS 네이티브 알림 (클릭 시 다운로드 페이지)
    chrome.notifications.create('swgs-update-' + j.version, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: '✨ Seastar GW 업데이트',
      message: `v${j.version} 새 버전이 있습니다. 클릭하여 업데이트`,
      priority: 1, requireInteraction: false
    });
  } catch(e) {
    console.warn('[SGW SW] update check failed:', e);
  }
}

// 업데이트 알림 클릭 시 사이드패널 배너 갱신 (자동 reload 없음 — 사용자가 직접 적용)
chrome.notifications.onButtonClicked.addListener((nid, btnIdx) => {
  // 자동 reload 제거 — 사용자가 사이드패널의 즉시 적용 버튼을 통해 명시적으로 적용
});
function compareVer(a, b) {
  const A = (a||'0').split('.').map(Number); const B = (b||'0').split('.').map(Number);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i]||0, y = B[i]||0; if (x !== y) return x - y;
  } return 0;
}

/* ════════ 메시지 허브 ════════ */
let _lastSeenSnapshot = { notice: 0, leave: 0, message: 0, approval: 0 };
let _stateCounts = { notice: 0, leave: 0, message: 0, approval: 0 };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return false;
  switch (msg.type) {
    case 'SWGS_AUTH_SYNC':
      handleAuthSync(msg.auth).then(()=>sendResponse({ok:true}));
      return true;
    case 'SWGS_LOGIN_MANUAL':
      manualLogin(msg.empNum, msg.password).then(sendResponse).catch(e=>sendResponse({ok:false, err:e.message}));
      return true;
    case 'SWGS_LOGOUT':
      doLogout().then(()=>sendResponse({ok:true}));
      return true;
    case 'SWGS_TRIGGER_POLL':
      pollActivity().then(()=>sendResponse({ok:true}));
      return true;
    case 'SWGS_APPLY_SETTINGS':
      // 옵션 저장 시 — 폴링 주기 alarm 재생성
      setupAlarms().then(()=>sendResponse({ok:true}));
      return true;
    case 'SWGS_FORCE_UPDATE_CHECK':
      // ★ 사용자가 즉시 업데이트 확인 요청
      checkUpdate(true).then(()=>sendResponse({ok:true})).catch(e=>sendResponse({ok:false, err:e.message}));
      return true;
    case 'SWGS_FORCE_RELOAD':
      // ★ reload 전에 반드시 requestUpdateCheck로 새 CRX를 실제로 받아와야 한다
      //   (reload만 하면 디스크의 옛 버전으로 재시작될 뿐 — 업데이트 안 됨의 원인)
      chrome.runtime.requestUpdateCheck().catch(()=>{}).finally(() => {
        sendResponse({ok:true});
        setTimeout(() => chrome.runtime.reload(), 1200);
      });
      return true;
    case 'SWGS_AUTO_UPDATE_NOW':
      // ★ 원클릭 자동 업데이트 (다운로드/팝업 없이 끝까지 한 번에)
      autoUpdateNow().then(sendResponse).catch(e => sendResponse({ ok: false, err: e.message }));
      return true;
    case 'SWGS_LASTSEEN_SNAPSHOT':
      // content가 5초마다 보내는 last_seen_* 스냅샷 → 변화 감지
      handleLastSeenSnapshot(msg.snapshot);
      return false;
    case 'SWGS_PAGE_NOTIFICATION':
      // SGW 페이지의 sendNativeNotification 호출을 가로챈 알림
      handlePageNotification(msg);
      return false;
    case 'SWGS_STATE_UPDATE':
      // 페이지 unread 카운트 갱신
      handleStateUpdate(msg);
      return false;
    default:
      return false;
  }
});

function handleLastSeenSnapshot(snap) {
  // SGW 페이지가 last_seen_* 키를 갱신할 때마다 호출됨
  // 다른 사용자가 어떤 활동을 하면 페이지에 새 데이터 도착 → setNewNotice 등 → last_seen 갱신 안 함
  // 따라서 여기서는 스냅샷 변화를 ts로 기록만 함 (실제 알림은 handlePageNotification에서)
  Object.assign(_lastSeenSnapshot, snap);
}

function handlePageNotification(msg) {
  // SGW의 sendNativeNotification 가로챈 알림 → chrome.notifications 발행 (종류별 차별화)
  const kind = msg.kind || 'notice';
  // ★ 강력알림: 쪽지·공지·연차·결재 전부 사용자가 직접 닫기 전까지 화면에 유지
  const KIND_META = {
    notice:   { prefix: '📢 공지',     priority: 2, requireInteraction: true },
    leave:    { prefix: '🌴 연차',     priority: 2, requireInteraction: true },
    message:  { prefix: '💬 새 쪽지',  priority: 2, requireInteraction: true },
    approval: { prefix: '✍️ 결재',    priority: 2, requireInteraction: true }
  };
  const meta = KIND_META[kind] || { prefix: '📌', priority: 1, requireInteraction: false };

  // 쪽지의 경우 발신자를 제목에 표시
  let title = meta.prefix;
  if (kind === 'message' && msg.sender) {
    title = meta.prefix + ' · ' + msg.sender;
  } else if (msg.title) {
    title = meta.prefix + ' · ' + msg.title.replace(/^[📢🌴💬✍️]\s*/, '');
  }

  // 긴급 표시
  if (msg.urgent) title = '⚠️ ' + title;

  chrome.notifications.create('swgs-' + kind + '-' + Date.now(), {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: title,
    message: (msg.body || msg.title || '').slice(0, 150),
    priority: meta.priority,
    requireInteraction: meta.requireInteraction,
    silent: false   // 사운드 ON
  });
  _stateCounts[kind] = (_stateCounts[kind] || 0) + 1;
  chrome.runtime.sendMessage({
    type: 'SWGS_NEW_ACTIVITY', kind, count: 1,
    items: [{ title: msg.title, body: msg.body, sender: msg.sender, ts: Date.now() }]
  }).catch(()=>{});
}

function handleStateUpdate(msg) {
  // 페이지 unread 카운트 (SGW에서 추출됨)
  if (msg.unreadNotice !== undefined) _stateCounts.notice = msg.unreadNotice;
  if (msg.unreadLeave !== undefined) _stateCounts.leave = msg.unreadLeave;
  if (msg.unreadMessage !== undefined) _stateCounts.message = msg.unreadMessage;
  if (msg.unreadApproval !== undefined) _stateCounts.approval = msg.unreadApproval;
  chrome.runtime.sendMessage({ type: 'SWGS_COUNTS_UPDATE', counts: _stateCounts }).catch(()=>{});
}

async function handleAuthSync(auth) {
  // ★ 영구 저장 — 절대 만료 안 함
  if (auth.emp_num || auth.current_user_id) {
    await storage.set(KEYS.EMP_NUM, auth.emp_num || auth.current_user_id);
  }
  if (auth.savedName) await storage.set(KEYS.EMP_NAME, auth.savedName);
  if (auth.savedEmail) await storage.set(KEYS.USER_EMAIL, auth.savedEmail);
  if (auth.auth_token || auth.jwt) await storage.set(KEYS.AUTH_TOKEN, auth.auth_token || auth.jwt);
  await storage.set(KEYS.AUTH_AT, Date.now());
  await storage.set('swgs_persistent_login', true);  // 영구 플래그
  chrome.runtime.sendMessage({ type: 'SWGS_AUTH_UPDATED' }).catch(()=>{});
}

async function manualLogin(empNum, password) {
  // ★ B9 수정: GW_HOST(그룹웨어) 대신 admin_host API 사용
  const host = DEFAULTS.admin_host;
  const r = await fetch(host + '/auth/employee-login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emp_num: empNum, password })
  });
  if (!r.ok) throw new Error('로그인 실패 (HTTP ' + r.status + ')');
  const j = await r.json();
  await storage.set(KEYS.EMP_NUM, empNum);
  await storage.set(KEYS.EMP_NAME, j.name || empNum);
  if (j.token) await storage.set(KEYS.AUTH_TOKEN, j.token);
  await storage.set(KEYS.AUTH_AT, Date.now());
  return { ok: true, name: j.name };
}

async function doLogout() {
  await storage.remove(KEYS.EMP_NUM);
  await storage.remove(KEYS.EMP_NAME);
  await storage.remove(KEYS.AUTH_TOKEN);
  await storage.remove(KEYS.AUTH_AT);
  await storage.remove('swgs_persistent_login');  // 자동복원 중단
  // 연차/결재 스냅샷도 정리
  await storage.remove(KEYS.SNAP_ME);
  await storage.remove(KEYS.SNAP_LEAVE);
  await storage.remove(KEYS.SNAP_APPROVALS);
}

console.log('[Seastar GW SW] started · ' + new Date().toISOString());
