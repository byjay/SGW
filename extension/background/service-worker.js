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

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('swgs_activity_poll', { periodInMinutes: 1, when: Date.now() + 5000 });
  // ★ 30분마다 새 버전 확인 (Chrome 기본 5~10시간 → 30분으로 단축)
  chrome.alarms.create('swgs_update_check', { periodInMinutes: 30, when: Date.now() + 15000 });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('swgs_activity_poll', { periodInMinutes: 1, when: Date.now() + 5000 });
  chrome.alarms.create('swgs_update_check', { periodInMinutes: 30, when: Date.now() + 15000 });
  // 시작 시 즉시 한 번 체크
  setTimeout(() => checkUpdate(true), 3000);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'swgs_activity_poll') pollActivity();
  else if (alarm.name === 'swgs_update_check') checkUpdate();
});

/* ════════ 활동 폴링 — SGW 페이지 keep-alive 방식 ════════
 * SGW (sgw-seastar-work.pages.dev)는 React MockServer 기반이라 별도 API endpoint가 없음.
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

chrome.notifications.onClicked.addListener((nid) => {
  if (!nid.startsWith('swgs-')) return;
  // 알림 클릭 → 해당 페이지 열기
  const kind = nid.split('-')[1];
  const host = DEFAULTS.gw_host;
  const path = ({ notice: '/board', leave: '/leave', message: '/messages', approval: '/approval' })[kind] || '/';
  chrome.tabs.create({ url: host + path });
});

/* ════════ 자동 업데이트 (CF Pages 빌드 → 즉시 적용) ════════ */
async function checkUpdate(verbose = false) {
  try {
    const r = await fetch(UPDATE_URL + '?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    const myVer = chrome.runtime.getManifest().version;
    await storage.set('swgs_last_update_check', Date.now());
    await storage.set('swgs_server_version', j.version);

    if (compareVer(j.version, myVer) <= 0) {
      // 최신 상태
      if (verbose) chrome.runtime.sendMessage({ type: 'SWGS_UPDATE_CHECKED', upToDate: true, version: myVer }).catch(()=>{});
      return;
    }

    console.log('[SGW SW] 새 버전 감지:', myVer, '→', j.version);

    // ★★ 1순위: Chrome 표준 자동 업데이트 강제 트리거
    //   ExtensionInstallForcelist로 설치된 경우 → CRX 자동 설치됨
    if (chrome.runtime.requestUpdateCheck) {
      chrome.runtime.requestUpdateCheck((status, details) => {
        console.log('[SGW SW] requestUpdateCheck:', status, details);
        if (status === 'update_available') {
          // 다음 idle 시 자동 reload + 새 버전 활성화
          chrome.notifications.create('swgs-update-ready-' + j.version, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
            title: '✨ Seastar GW v' + j.version + ' 자동 업데이트 준비 완료',
            message: '브라우저 재시작 시 자동 적용됩니다. 즉시 적용하려면 클릭.',
            priority: 2, requireInteraction: false,
            buttons: [{ title: '🔄 즉시 적용 (재로드)' }]
          });
        }
        // 업데이트 가능 표시 → 사이드패널에 통지
        chrome.runtime.sendMessage({
          type: 'SWGS_UPDATE_AVAILABLE',
          version: j.version, status: status
        }).catch(()=>{});
      });
    }

    // ★★ 2순위: ZIP 백업 다운로드 (정책 미설치 PC를 위함)
    const dlUrl = 'https://swgs-internal.pages.dev' + (j.zip || j.zip_latest || '/swgs-latest.zip');
    chrome.downloads.download({
      url: dlUrl, filename: `swgs-update/swgs-v${j.version}.zip`,
      saveAs: false, conflictAction: 'overwrite'
    }, () => { /* silent */ });
  } catch (e) {
    console.warn('[SGW SW] update check failed:', e);
  }
}

// 알림 클릭 시 즉시 reload (확장이 새 버전으로 재시작)
chrome.notifications.onButtonClicked.addListener((nid, btnIdx) => {
  if (nid.startsWith('swgs-update-ready-') && btnIdx === 0) {
    chrome.runtime.reload();  // ★ 즉시 새 버전 활성화
  }
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
    case 'SWGS_FORCE_UPDATE_CHECK':
      // ★ 사용자가 즉시 업데이트 확인 요청
      checkUpdate(true).then(()=>sendResponse({ok:true})).catch(e=>sendResponse({ok:false, err:e.message}));
      return true;
    case 'SWGS_FORCE_RELOAD':
      // ★ 즉시 확장 재로드 (다운로드된 새 버전 활성화)
      sendResponse({ok:true});
      setTimeout(() => chrome.runtime.reload(), 500);
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
  const KIND_META = {
    notice:   { prefix: '📢 공지',     priority: 1, requireInteraction: false },
    leave:    { prefix: '🌴 연차',     priority: 2, requireInteraction: true  },  // ★ 연차는 강조 + 자동 안 닫힘
    message:  { prefix: '💬 새 쪽지',  priority: 2, requireInteraction: false },  // ★ 쪽지는 priority 높임
    approval: { prefix: '✍️ 결재',    priority: 2, requireInteraction: true  }
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
  if (auth.auth_token || auth.jwt) await storage.set(KEYS.AUTH_TOKEN, auth.auth_token || auth.jwt);
  await storage.set(KEYS.AUTH_AT, Date.now());
  await storage.set('swgs_persistent_login', true);  // 영구 플래그
  chrome.runtime.sendMessage({ type: 'SWGS_AUTH_UPDATED' }).catch(()=>{});
}

async function manualLogin(empNum, password) {
  const host = (await storage.get(KEYS.GW_HOST)) || DEFAULTS.gw_host;
  // 회사 그룹웨어 로그인 API (실제 endpoint에 맞게 조정 필요)
  const r = await fetch(host + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empNum, password })
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
}

console.log('[Seastar GW SW] started · ' + new Date().toISOString());
