/* Seastar GW - Page Bridge (페이지 컨텍스트, v1.0.3)
 *
 * 강화된 알림 가로채기:
 * 1. sendNativeNotification 가로채기 (4종 자동 분류)
 * 2. ★ 연차 신청 제출 감지 (form submit + URL 변화)
 * 3. ★ 쪽지 도착 실시간 감지 (DOM mutation observer)
 * 4. ★ MockServer 메서드 가로채기 (직접 호출 시 감지)
 */
(function () {
  'use strict';
  if (window.__SWGS_PAGE_BRIDGE__) return;
  window.__SWGS_PAGE_BRIDGE__ = true;

  const FROM = 'sgw-page-bridge';
  const post = (data) => { try { window.postMessage(Object.assign({ __from: FROM }, data), '*'); } catch (e) {} };

  /* ── 1. sendNativeNotification 가로채기 (4종 자동 분류) ── */
  function hookNotify() {
    if (typeof window.sendNativeNotification !== 'function') return false;
    const orig = window.sendNativeNotification;
    window.sendNativeNotification = function (title, body) {
      let kind = 'notice';
      const t = (title || '').toString();
      const b = (body || '').toString();
      if (/연차|휴가|반차/.test(t + b)) kind = 'leave';
      else if (/쪽지|메시지|💬|DM/.test(t + b)) kind = 'message';
      else if (/결재|승인|반려|✍/.test(t + b)) kind = 'approval';
      else if (/공지|알림|📢/.test(t + b)) kind = 'notice';

      // 발신자 추출 (쪽지 패턴: "홍길동님이 메시지를 보냈습니다")
      let sender = '';
      const sm = b.match(/^([^\s:님]+)(?:님)?[:\s]/);
      if (sm) sender = sm[1];

      const urgent = /긴급|승인 필요|즉시|⚠/.test(t + b);
      post({ type: 'SGW_NOTIFICATION', kind, title: t, body: b, sender, urgent });
      try { return orig.apply(this, arguments); } catch (e) {}
    };
    return true;
  }

  /* ── 2. ★ 연차 신청 폼 제출 감지 ── */
  function hookLeaveSubmit() {
    document.addEventListener('submit', (e) => {
      const f = e.target;
      if (!f || !f.matches) return;
      // 연차 폼 휴리스틱: action/class/id에 leave 포함
      const idAttr = (f.id || '') + (f.className || '') + (f.action || '');
      if (/leave|annual|vacation|연차|휴가/i.test(idAttr) || isLeavePage()) {
        const dateInput = f.querySelector('input[type="date"], input[name*="date"]');
        const reasonInput = f.querySelector('textarea, input[name*="reason"], input[name*="사유"]');
        const date = dateInput ? dateInput.value : '';
        const reason = reasonInput ? (reasonInput.value || '').slice(0, 50) : '';
        post({
          type: 'SGW_LEAVE_SUBMITTED',
          body: (date ? date + ' ' : '') + (reason || '연차 신청서가 제출됐습니다')
        });
      }
    }, true);
  }
  function isLeavePage() { return /\/leave|\/vacation|\/annual/i.test(location.pathname); }

  /* ── 3. ★ 쪽지/메시지 DOM 변화 감지 (실시간) ── */
  let lastMessageCount = 0;
  function setupMessageWatcher() {
    const observer = new MutationObserver(() => {
      // 메시지 페이지에서 .message-item, [data-message-id] 등 새로 추가될 때 감지
      const items = document.querySelectorAll(
        '[data-message-id], .message-item, .msg-item, .chat-message, [class*="MessageItem"]'
      );
      const cur = items.length;
      if (cur > lastMessageCount && lastMessageCount > 0 && /\/messages|\/chat/.test(location.pathname)) {
        // 새 항목 추가됨
        const newest = items[items.length - 1];
        const sender = (newest.querySelector('.sender, .from, [class*="sender"]') || {}).textContent || '';
        const body = (newest.querySelector('.content, .body, .text, p') || {}).textContent || newest.textContent || '';
        post({
          type: 'SGW_NEW_MESSAGE',
          sender: (sender || '').trim().slice(0, 20),
          body: (body || '').trim().slice(0, 100)
        });
      }
      lastMessageCount = cur;
    });
    setTimeout(() => {
      const target = document.querySelector('main, #root, #app, body');
      if (target) observer.observe(target, { childList: true, subtree: true });
    }, 2000);
  }

  /* ── 4. unread 카운트 추출 (DOM 텍스트) ── */
  function reportState() {
    try {
      const payload = {
        userId: localStorage.getItem('current_user_id'),
        userName: localStorage.getItem('savedName')
      };
      const allText = document.body ? document.body.innerText : '';
      const m1 = allText.match(/메시지\s*\((\d+)\)/);  if (m1) payload.unreadMessage = +m1[1];
      const m2 = allText.match(/공지\s*\((\d+)\)/);    if (m2) payload.unreadNotice = +m2[1];
      const m3 = allText.match(/연차\s*\((\d+)\)/);    if (m3) payload.unreadLeave = +m3[1];
      const m4 = allText.match(/결재\s*\((\d+)\)/);    if (m4) payload.unreadApproval = +m4[1];
      post({ type: 'SGW_STATE', payload });
    } catch (e) {}
  }

  /* ── 5. 부트 ── */
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if (hookNotify() || tries > 40) clearInterval(iv);
  }, 500);
  setTimeout(hookLeaveSubmit, 1500);
  setupMessageWatcher();
  setInterval(reportState, 5000);
  setTimeout(reportState, 1500);

  console.log('[SGW Page Bridge] v1.0.3 installed (연차/쪽지 강화)');
})();
