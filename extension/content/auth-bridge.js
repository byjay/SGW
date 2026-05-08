/* Seastar GW — Auth Bridge (sgw-seastar-work.pages.dev 연동)
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

  /* ── 3. SGW → chrome.storage 동기화 (양방향) ── */
  function syncAuth() {
    try {
      const cur = localStorage.getItem('current_user_id');
      const name = localStorage.getItem('savedName');
      if (cur && cur !== userId) {
        userId = cur;
        SDU.send('SWGS_AUTH_SYNC', {
          auth: { current_user_id: cur, savedName: name || '', emp_num: cur, url: location.href }
        });
        console.log('[SGW Bridge] ✓ auth synced:', cur, name);
      }
    } catch (e) {}
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
    // ★ 페이지 로드 시 즉시 영구 로그인 복원 시도
    const restored = await restoreAuthFromExtIfNeeded();
    if (restored) return;  // reload 예약됨

    setTimeout(syncAuth, 800);
    setTimeout(syncAuth, 3000);
    setInterval(syncAuth, 30000);
    setInterval(checkLocalStorageActivity, 5000);
    setTimeout(checkLocalStorageActivity, 2500);

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
