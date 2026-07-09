/* Seastar GW — Auth Bridge (sgw.seastar.work 연동)
 *
 * v1.0.3 핵심 개선:
 * 1. ★ 영구 로그인 자동 복원: SGW localStorage 비어있으면 chrome.storage에서 자동 재주입
 * 2. 연차/쪽지/결재/공지 4종 알림 가로채기 강화
 * 3. localStorage 청소(쿠키삭제 등) 후에도 자동 복원
 * 4. 30초마다 양방향 sync로 어떤 경로로 풀려도 즉시 복구
 */
(function () {
  'use strict';
  if (window.__SWGS_BRIDGE__) return;
  window.__SWGS_BRIDGE__ = true;

  const SDU = window.__SWGS_MSG__;
  let userId = null;

  /* ── 0. ★ 즉시 로그인 감지: localStorage.setItem 훅 ──
   * SPA(React) 로그인은 페이지 새로고침 없이 current_user_id만 씀 → 폴링(30초)로는 느림.
   * setItem을 가로채 즉시 syncAuth() 실행 → 확장앱이 지연 없이 바로 반영(2중 로그인 방지 핵심). */
  try {
    const _origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      _origSetItem(key, value);
      if (key === 'current_user_id' || key === 'savedName' || key === 'savedEmail') {
        setTimeout(syncAuth, 30);
      }
    };
  } catch (e) {}

  /* ── 1. 페이지 컨텍스트 주입 ── */
  function injectPageBridge() {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('content/page-bridge.js');
    s.onload = function () { this.remove(); };
    (document.documentElement || document.head).appendChild(s);
  }
  try { injectPageBridge(); } catch (e) {}

  /* ── 2. ★ 영구 로그인: chrome.storage → SGW localStorage 자동 재주입 ── */
  async function restoreAuthFromExtIfNeeded() {
    try {
      const cur = localStorage.getItem('current_user_id');
      if (cur) return false;  // 이미 로그인됨

      // chrome.storage에서 저장된 사원번호 조회
      const stored = await new Promise(resolve => {
        chrome.storage.local.get(['swgs_emp_num', 'swgs_emp_name', 'swgs_auth_token'], resolve);
      });
      if (!stored.swgs_emp_num) return false;

      // SGW 페이지에 자동 재주입
      localStorage.setItem('current_user_id', stored.swgs_emp_num);
      if (stored.swgs_emp_name) localStorage.setItem('savedName', stored.swgs_emp_name);
      if (stored.swgs_auth_token) localStorage.setItem('auth_token', stored.swgs_auth_token);
      console.log('[SGW Bridge] ✓ 영구 로그인 자동 복원:', stored.swgs_emp_num);
      // 페이지 새로고침으로 React가 새 인증 상태를 인식하도록
      setTimeout(() => location.reload(), 500);
      return true;
    } catch (e) { console.warn('[SGW Bridge] 자동 복원 실패', e); return false; }
  }

  /* ── 2-2. ★ SEDMS SSO: chrome.storage → SEDMS 세션 쿠키 자동 재주입 ── */
  async function restoreSedmsAuthIfNeeded() {
    try {
      const isSedms = location.hostname.includes('sedms.app') || location.hostname.includes('sedms');
      if (!isSedms) return false;

      // 이미 세션 쿠키가 존재하거나, 이미 SSO 교환을 시도했었다면 중단
      const hasCookie = document.cookie.includes('__Host-sedms_session') || document.cookie.includes('__Secure-sedms_session');
      if (hasCookie) return false;

      if (sessionStorage.getItem('swgs_sso_attempted')) return false;

      // chrome.storage에서 저장된 SGW JWT 토큰 조회
      const stored = await new Promise(resolve => {
        chrome.storage.local.get(['swgs_auth_token'], resolve);
      });
      if (!stored.swgs_auth_token) return false;

      console.log('[SGW Bridge] ⏳ SEDMS SSO 연동 시작 (SGW 토큰 검증 요청 중...)');
      sessionStorage.setItem('swgs_sso_attempted', 'true');

      // SEDMS 백엔드 API에 교환 요청 전송
      const apiUrl = `${location.origin}/api/platform/auth/sgw-exchange`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ sgw_token: stored.swgs_auth_token }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const resData = await response.json();
      console.log('[SGW Bridge] ✓ SEDMS SSO 자동 로그인 연동 완료 (플랫폼 세션 수립 성공)', resData);

      // 성공 시 페이지를 새로고침하여 로그인된 상태로 화면 로드
      setTimeout(() => location.reload(), 300);
      return true;
    } catch (e) {
      console.warn('[SGW Bridge] SEDMS SSO 연동 실패:', e.message);
      return false;
    }
  }

  /* ── 3. SGW → chrome.storage 동기화 (양방향) ── */
  function syncAuth() {
    try {
      const cur = localStorage.getItem('current_user_id');
      const name = localStorage.getItem('savedName');
      const email = localStorage.getItem('savedEmail') || '';
      if (cur && cur !== userId) {
        userId = cur;
        // current_user_id = 그룹웨어 실제 사용자 id(숫자). 이것을 emp_num으로 저장해야 자동복원이 정확.
        SDU.send('SWGS_AUTH_SYNC', {
          auth: { current_user_id: cur, savedName: name || '', savedEmail: email, emp_num: cur, url: location.href }
        });
        console.log('[SGW Bridge] ✓ auth synced:', cur, name, email);
      }
    } catch (e) {}
  }

  /* ── 3-2. ★ 그룹웨어 연차/결재 실데이터 스냅샷 → chrome.storage ──
   * content script는 그룹웨어 페이지의 localStorage를 직접 읽을 수 있다.
   * 사이드패널은 페이지 origin이 아니라 localStorage 접근 불가 → 여기서 미리 떠서 넣어준다.
   * (app_users / app_leave_requests / app_approvals = services/mockServer.ts STORAGE_KEYS) */
  function snapshotGroupwareData() {
    try {
      const cur = localStorage.getItem('current_user_id');
      if (!cur) return;
      const getJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
      const users     = getJSON('app_users');
      const leave     = getJSON('app_leave_requests');
      const approvals = getJSON('app_approvals');
      const me = Array.isArray(users) ? users.find(u => String(u.id) === String(cur)) : null;
      chrome.storage.local.set({
        swgs_snap_at: Date.now(),
        swgs_snap_uid: cur,
        swgs_snap_me: me ? {
          id: me.id, name: me.name, department: me.department, position: me.position,
          totalLeave: me.totalLeave, carryover: me.carryover, leaveBalance: me.leaveBalance
        } : null,
        swgs_snap_leave: Array.isArray(leave)
          ? leave.filter(l => String(l.userId) === String(cur))
                 .sort((a, b) => (b.requestDate || 0) - (a.requestDate || 0)).slice(0, 30)
          : [],
        swgs_snap_approvals: Array.isArray(approvals)
          ? approvals.filter(a => String(a.approverId) === String(cur) && a.status === 'pending')
                     .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          : []
      });
    } catch (e) { /* 페이지 구조 다름 — 무시 */ }
  }

  /* ── 4. localStorage 변화 감지 ── */
  function checkLocalStorageActivity() {
    if (!userId) return;
    const keys = {
      notice:   'last_seen_notice_' + userId,
      leave:    'last_seen_leave_' + userId,
      message:  'last_seen_msg_' + userId,
      approval: 'last_seen_approval_' + userId
    };
    const cur = {};
    for (const [k, lsk] of Object.entries(keys)) {
      cur[k] = parseInt(localStorage.getItem(lsk) || '0', 10);
    }
    SDU.send('SWGS_LASTSEEN_SNAPSHOT', { snapshot: cur });
  }

  /* ── 4-2. 확장 사이드패널 → 강제 로그아웃 (postMessage, 부모 프레임에서 옴) ──
   * 확장에서 로그아웃하면 이 iframe(그룹웨어) 세션도 함께 정리해야
   * "확장만 로그아웃되고 웹앱은 로그인 상태로 남는" 불일치가 생기지 않는다. */
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'SWGS_FORCE_LOGOUT') return;
    try {
      localStorage.removeItem('current_user_id');
      localStorage.removeItem('savedName');
      localStorage.removeItem('savedEmail');
      localStorage.removeItem('auth_token');
    } catch (_) {}
    userId = null;
    location.reload();
  });

  /* ── 5. page-bridge.js 메시지 수신 (알림 가로챔 결과) ── */
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.__from !== 'sgw-page-bridge') return;
    if (d.type === 'SGW_NOTIFICATION') {
      SDU.send('SWGS_PAGE_NOTIFICATION', {
        kind: d.kind || 'notice',
        title: d.title || '활동',
        body: d.body || '',
        sender: d.sender || '',          // 쪽지 발신자
        urgent: d.urgent || false,        // 연차/결재 긴급
        url: location.href
      });
    } else if (d.type === 'SGW_STATE') {
      SDU.send('SWGS_STATE_UPDATE', d.payload);
    } else if (d.type === 'SGW_LEAVE_SUBMITTED') {
      // ★ 본인 연차 신청 제출 알림
      SDU.send('SWGS_PAGE_NOTIFICATION', {
        kind: 'leave', title: '🌴 연차 신청 완료',
        body: d.body || '연차 신청서가 제출됐습니다', urgent: false
      });
    } else if (d.type === 'SGW_NEW_MESSAGE') {
      // ★ 쪽지 도착 (실시간 감지)
      SDU.send('SWGS_PAGE_NOTIFICATION', {
        kind: 'message', title: '💬 새 쪽지',
        body: (d.sender ? d.sender + ': ' : '') + (d.body || ''),
        sender: d.sender, urgent: false
      });
    }
  });

  /* ── 6. 주기 작업 (영구 로그인 핵심) ── */
  window.addEventListener('load', async () => {
    // ★ 페이지 로드 시 즉시 SEDMS SSO 복원 시도
    const restoredSedms = await restoreSedmsAuthIfNeeded();
    if (restoredSedms) return;

    // ★ 페이지 로드 시 즉시 영구 로그인 복원 시도
    const restored = await restoreAuthFromExtIfNeeded();
    if (restored) return;  // reload 예약됨

    setTimeout(syncAuth, 800);
    setTimeout(syncAuth, 3000);
    setInterval(syncAuth, 30000);
    setInterval(checkLocalStorageActivity, 5000);
    setTimeout(checkLocalStorageActivity, 2500);

    // ★ 연차/결재 실데이터 스냅샷 (로드 직후 + 30초 주기)
    setTimeout(snapshotGroupwareData, 1500);
    setInterval(snapshotGroupwareData, 30000);

    // ★ 30초마다 localStorage 사라졌는지 점검 → 자동 복원
    setInterval(async () => {
      const cur = localStorage.getItem('current_user_id');
      if (!cur && userId) {
        // 로그인이 풀렸으나 우리는 알고있음 → 즉시 복원
        console.warn('[SGW Bridge] localStorage 사라짐 — 자동 복원');
        await restoreAuthFromExtIfNeeded();
      }
    }, 30000);
  });

  console.log('[SGW Bridge] v1.0.3 installed (영구 로그인 + 자동 복원)');
})();
