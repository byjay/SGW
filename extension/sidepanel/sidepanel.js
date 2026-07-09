/* Seastar GW — Sidepanel v2.0.0 */
import { storage, KEYS, DEFAULTS } from '../lib/storage.js';

let _uiAttached = false; // 이중 등록 방지

let state = {
  empNum: null, empName: null, token: null, authAt: 0,
  counts: { notice: 0, leave: 0, message: 0, approval: 0 },
  activities: [],
  gwHost: DEFAULTS.gw_host,
  sedmsHost: DEFAULTS.sedms_host
};

/* ── 버전 비교 ── */
function compareVer(a, b) {
  const A = (a||'0').split('.').map(Number);
  const B = (b||'0').split('.').map(Number);
  for (let i=0; i<Math.max(A.length,B.length); i++) {
    const x=A[i]||0, y=B[i]||0; if(x!==y) return x-y;
  } return 0;
}

/* ── init: storage 읽기 + UI 결정 ── */
async function init() {
  state.empNum  = await storage.get(KEYS.EMP_NUM);
  state.empName = await storage.get(KEYS.EMP_NAME);
  state.token   = await storage.get(KEYS.AUTH_TOKEN);
  state.authAt  = await storage.get(KEYS.AUTH_AT);
  state.gwHost   = (await storage.get(KEYS.GW_HOST)) || DEFAULTS.gw_host;
  state.sedmsHost = (await storage.get(KEYS.SEDMS_HOST)) || DEFAULTS.sedms_host;
  state.userEmail = await storage.get(KEYS.USER_EMAIL);

  if (state.empNum) { showApp(); }
  else               showLogin();

  // 업데이트 상태 표시
  const lastCheck = await storage.get('swgs_last_update_check');
  const serverVer = await storage.get('swgs_server_version');
  const myVer     = chrome.runtime.getManifest().version;
  if (lastCheck) {
    const min   = Math.round((Date.now() - lastCheck) / 60000);
    const newer = serverVer && compareVer(serverVer, myVer) > 0;
    const txt   = newer
      ? `🎉 서버 v${serverVer} 사용 가능 (현재 v${myVer})`
      : `<span class="ts">${min}분 전 확인 · 최신 v${myVer}</span>`;
    showUpdateStatus(txt, newer, serverVer);
  }

  // 폴링 요청 (SW에게)
  chrome.runtime.sendMessage({ type: 'SWGS_TRIGGER_POLL' }).catch(() => {});
  setTimeout(checkSgwTab, 1500);
  setInterval(checkSgwTab, 30000);
}

/* ── auth 업데이트 (init() 재실행 없음) ── */
async function onAuthUpdated() {
  state.empNum   = await storage.get(KEYS.EMP_NUM);
  state.empName  = await storage.get(KEYS.EMP_NAME);
  state.userEmail = await storage.get(KEYS.USER_EMAIL);
  state.token    = await storage.get(KEYS.AUTH_TOKEN);
  if (state.empNum) { showApp(); toast(`✓ ${state.empName||'사용자'}님 연결됨`, 'green'); }
  else              showLogin();
  chrome.runtime.sendMessage({ type: 'SWGS_TRIGGER_POLL' }).catch(() => {});
}

/* ── SGW 탭 상태 표시 ── */
async function checkSgwTab() {
  try {
    const tabs = await chrome.tabs.query({ url: state.gwHost + '/*' });
    const sub  = document.getElementById('userInfo');
    if (sub && state.empNum) {
      const live = tabs.length > 0 ? '🟢 연결됨' : '⚪ 미연결';
      const who = (state.empName || state.userEmail || '로그인됨');
      sub.textContent = who + ' · ' + live;
    }
  } catch(e) {}
}

/* ── 화면 전환 ── */
function showLogin() {
  document.getElementById('loginScreen').style.display = '';
  document.getElementById('app').style.display = 'none';
  // ★ 그룹웨어 실제 로그인 페이지를 그대로 내장 — 여기서 한 번만 로그인하면
  //   auth-bridge(all_frames)가 즉시 감지해 자동으로 메인 화면(showApp)으로 전환된다.
  const lf = document.getElementById('loginFrame');
  if (lf && (!lf.src || lf.src === 'about:blank')) lf.src = state.gwHost + '/';
}
function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = '';
  const ui = document.getElementById('userInfo');
  // 이름 우선 표시 (숫자 id 노출 방지), 보조로 이메일
  if (ui) ui.textContent = (state.empName || state.userEmail || '로그인됨') + (state.userEmail ? ' · ' + state.userEmail : '');
  const cv = document.getElementById('curVer');
  if (cv) cv.textContent = 'v' + chrome.runtime.getManifest().version;
  loadAppFrame(); // ★ 앱 탭(기본)에 그룹웨어 로드
}

/* ── 앱 탭: 그룹웨어 iframe (어플 구조) ── */
function loadAppFrame(path) {
  const fr = document.getElementById('appFrame');
  if (!fr) return;
  const want = state.gwHost + (path || '/');
  if (path || !fr.src || fr.src === 'about:blank') fr.src = want;
}

/* ── 로그아웃 ── */
async function doLogout() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  // ★ 그룹웨어(iframe) 세션도 함께 정리 — 확장만 로그아웃되고 웹앱은 로그인 상태로 남는 불일치 방지
  try {
    const appFr = document.getElementById('appFrame');
    if (appFr && appFr.contentWindow) appFr.contentWindow.postMessage({ type: 'SWGS_FORCE_LOGOUT' }, '*');
  } catch(e) {}
  chrome.runtime.sendMessage({ type: 'SWGS_LOGOUT' }).catch(()=>{});
  await storage.remove(KEYS.EMP_NUM);
  await storage.remove(KEYS.EMP_NAME);
  await storage.remove(KEYS.AUTH_TOKEN);
  await storage.remove(KEYS.AUTH_AT);
  state.empNum = null; state.empName = null; state.token = null;
  showLogin();
  // 로그인 화면도 강제 새로고침 — 캐시된 로그인 상태가 그대로 보이는 것 방지
  const lf = document.getElementById('loginFrame');
  if (lf) lf.src = state.gwHost + '/?_lo=' + Date.now();
  toast('로그아웃 완료', 'green');
}

/* ── 사이드패널 닫기 ── */
async function closeSidepanel() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await chrome.sidePanel.setOptions({ tabId: tabs[0].id, enabled: false });
    }
  } catch(e) {}
  try { window.close(); } catch(e) {}
}

/* ── 카운트/활동 렌더 ── */
function updateCounts() {
  ['notice','leave','message','approval'].forEach(k => {
    const el = document.getElementById('cnt' + k.charAt(0).toUpperCase() + k.slice(1));
    if (el) el.textContent = state.counts[k]||0;
  });
  const total = Object.values(state.counts).reduce((a,b)=>a+b, 0);
  const badge = document.getElementById('badgeAll');
  if (badge) { badge.textContent=total; badge.dataset.zero = total===0?'true':'false'; }
}

function renderActivities() {
  const list = document.getElementById('activityList');
  if (!list) return;
  list.innerHTML = '';
  if (!state.activities.length) { list.innerHTML='<div class="empty">📭 최근 활동 없음</div>'; return; }
  state.activities.slice(0,20).forEach(a => {
    const item = document.createElement('div'); item.className='item';
    const icon = ({notice:'📢',leave:'🌴',message:'💬',approval:'✍️'})[a.kind]||'📌';
    const head = a.kind==='message'&&a.sender
      ? `${icon} <strong>${a.sender}</strong>님의 새 쪽지`
      : `${icon} ${a.title||a.from||'활동'}`;
    item.innerHTML = `<div class="head">${head}</div><div class="body">${(a.content||a.body||'').slice(0,80)}</div>`;
    item.onclick = ()=>openLink(a.kind);
    list.appendChild(item);
  });
}

function openLink(kind) {
  if (kind === 'message') { openMessengerPopup(state.gwHost + '/messages'); return; }
  const path = ({notice:'/board',leave:'/leave',approval:'/approval'})[kind]||'/';
  openGwTab(state.gwHost + path);
}

/* ── 메신저 팝업 창 (로그인 사용자용) ── */
function openMessengerPopup(url) {
  try {
    chrome.windows.create({ url, type: 'popup', width: 460, height: 760, focused: true })
      .catch(() => chrome.tabs.create({ url }));
  } catch (e) { chrome.tabs.create({ url }); }
}

/* ── 그룹웨어 탭 재사용 — 메뉴 클릭마다 새 탭이 계속 쌓이고 그때마다
   초기 비밀번호 알림이 다시 뜨는 문제 방지: 이미 열린 그룹웨어 탭이 있으면
   그 탭을 재사용(주소만 갱신)하고, 없을 때만 새 탭을 연다. */
async function openGwTab(url) {
  try {
    const tabs = await chrome.tabs.query({ url: state.gwHost + '/*' });
    if (tabs.length > 0) {
      const t = tabs[0];
      await chrome.tabs.update(t.id, { url, active: true });
      await chrome.windows.update(t.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url });
    }
  } catch (e) { chrome.tabs.create({ url }); }
}

/* ── 업데이트 상태 ── */
function showUpdateStatus(text, ready, newVersion) {
  const el = document.getElementById('updateStatus');
  if (!el) return;
  if (!text) { el.innerHTML=''; el.className='update-status'; return; }
  el.className = 'update-status'+(ready?' ready':'');
  if (ready) {
    el.innerHTML = `${text} <button class="apply-btn" id="btnApplyNow">즉시 적용</button>`;
    const applyBtn = document.getElementById('btnApplyNow');
    if (applyBtn) applyBtn.onclick = async()=>{
      if (!confirm(`v${newVersion}으로 즉시 업데이트합니다.\n사이드 패널이 잠시 닫혔다가 다시 열립니다.`)) return;
      chrome.runtime.sendMessage({ type: 'SWGS_FORCE_RELOAD' }).catch(()=>{});
    };
  } else { el.innerHTML=text; }
}

/* ── Toast ── */
function toast(m, type='green') {
  const el = document.createElement('div');
  el.className = 'toast '+type; el.textContent = m;
  const box = document.getElementById('toasts');
  if (box) { box.appendChild(el); setTimeout(()=>el.remove(), 2500); }
}

/* ── UI 이벤트 바인딩 (한 번만 실행) ── */
function attachUI() {
  if (_uiAttached) return;
  _uiAttached = true;

  // 로그인 화면 (내장 iframe) 툴바
  const blr = document.getElementById('btnLoginReload');
  if (blr) blr.onclick = ()=>{ const f=document.getElementById('loginFrame'); if (f) f.src = state.gwHost + '/?_r=' + Date.now(); };
  const bgw = document.getElementById('btnOpenGW');
  if (bgw) bgw.onclick = ()=>{ openGwTab(state.gwHost); toast('🌐 브라우저 탭에서 열림', 'green'); };

  // 헤더
  const br = document.getElementById('btnRefresh');
  if (br) br.onclick = ()=>{ chrome.runtime.sendMessage({ type:'SWGS_TRIGGER_POLL' }).catch(()=>{}); toast('🔄 새로고침', 'green'); };
  const bl = document.getElementById('btnLogout');
  if (bl) bl.onclick = doLogout;
  const bc = document.getElementById('btnCloseSide');
  if (bc) bc.onclick = closeSidepanel;

  // 업데이트 (자동 reload 제거 — 알림만)
  const cu = document.getElementById('checkUpdate');
  if (cu) cu.onclick = async(e)=>{
    e.preventDefault();
    showUpdateStatus('🔄 새 버전 확인 중...', false);
    chrome.runtime.sendMessage({ type: 'SWGS_FORCE_UPDATE_CHECK' }).catch(()=>{});
    toast('🔄 업데이트 확인 중...', 'green');
  };

  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.tab-btn').forEach(x=>x.classList.toggle('active',x===b));
    document.querySelectorAll('.tab-pane').forEach(p=>p.classList.toggle('active',p.dataset.tab===b.dataset.tab));
    if (b.dataset.tab==='app')   loadAppFrame();
  });

  // 앱 탭 툴바
  const fr = document.getElementById('appFrame');
  const fb = document.getElementById('btnFrameBack');
  if (fb) fb.onclick = ()=>{ try { fr.contentWindow.history.back(); } catch(e) { loadAppFrame('/'); } };
  const fh = document.getElementById('btnFrameHome');
  if (fh) fh.onclick = ()=>loadAppFrame('/');
  const fre = document.getElementById('btnFrameReload');
  if (fre) fre.onclick = ()=>{ if (fr && fr.src) fr.src = fr.src; };
  const bof = document.getElementById('btnOpenFull');
  if (bof) bof.onclick = ()=>{ openGwTab((fr && fr.src && fr.src !== 'about:blank') ? fr.src : state.gwHost); toast('🗖 전체 페이지로 이동', 'green'); };

  // 메뉴 카드
  document.querySelectorAll('.menu-card').forEach(card=>{
    card.onclick=()=>{
      const path=card.dataset.go; const isExt=card.dataset.ext==='1'; const isPopup=card.dataset.popup==='1';
      const url = isExt ? path : (state.gwHost + path);
      const label = card.querySelector('.ml')?.textContent||'';
      if (isPopup) { openMessengerPopup(url); toast(`💬 ${label} 팝업 열기`, 'green'); }
      else if (isExt) { chrome.tabs.create({ url }); toast(`🌐 ${label} 열기`, 'green'); }
      else { openGwTab(url); toast(`🌐 ${label} 열기`, 'green'); }
    };
  });

  // 💬 메신저 팝업 버튼
  const bmsg = document.getElementById('btnMessenger');
  if (bmsg) bmsg.onclick = ()=>{ openMessengerPopup(state.gwHost+'/messages'); toast('💬 메신저 팝업 열기','green'); };

  const bgh = document.getElementById('btnGoHome');
  if (bgh) bgh.onclick = ()=>openGwTab(state.gwHost+'/');
  const bra = document.getElementById('btnRefreshAll');
  if (bra) bra.onclick = ()=>{ chrome.runtime.sendMessage({ type:'SWGS_TRIGGER_POLL' }).catch(()=>{}); toast('🔄 알림 갱신','green'); };

  // 카운트 카드 클릭
  document.querySelectorAll('.cnt-card').forEach(c=>{
    c.onclick = ()=>openLink(c.classList.contains('msg')?'message':Array.from(c.classList).find(cl=>['notice','leave','approval'].includes(cl))||'notice');
  });

  // options 페이지
  const oo = document.getElementById('openOptions');
  if (oo) oo.onclick = (e)=>{ e.preventDefault(); chrome.runtime.openOptionsPage?.().catch(()=>{}); };
}

/* ── BG 메시지 수신 ── */
chrome.runtime.onMessage.addListener((msg)=>{
  if (!msg||!msg.type) return;
  switch(msg.type) {
    case 'SWGS_NEW_ACTIVITY':
      state.counts[msg.kind] = (state.counts[msg.kind]||0)+msg.count;
      if (msg.items) state.activities.unshift(...msg.items.map(it=>({...it, kind:msg.kind})));
      state.activities = state.activities.slice(0,50);
      updateCounts(); renderActivities(); break;
    case 'SWGS_COUNTS_UPDATE':
      Object.assign(state.counts, msg.counts);
      updateCounts(); break;
    case 'SWGS_AUTH_UPDATED':
      onAuthUpdated(); // ★ init() 재실행 금지 — 이중 attachUI 방지
      break;
    case 'SWGS_UPDATE_AVAILABLE':
      showUpdateStatus(`🎉 새 버전 v${msg.version} 사용 가능`, true, msg.version);
      toast(`✨ v${msg.version} 업데이트 가능`, 'green'); break;
    case 'SWGS_UPDATE_CHECKED':
      if (msg.upToDate) {
        showUpdateStatus(`✓ 최신 버전 (v${msg.version})`, false);
        setTimeout(()=>showUpdateStatus('',false), 5000);
      } break;
  }
});

/* ── 확장 컨텍스트 무효화 감지 ──
   백그라운드 자동 업데이트(30분 주기 배포) 도중 사이드패널이 이미 열려 있으면
   Chrome이 그 열린 패널의 JS 컨텍스트를 무효화한다 — 화면은 그대로 보이지만
   chrome.* 호출이 전부 조용히 실패해 "버튼이 하나도 안 눌러짐"처럼 보인다.
   주기적으로 감지해 새로고침 배너를 띄운다. */
function watchExtensionContext() {
  setInterval(() => {
    if (!chrome.runtime?.id) showContextInvalidBanner();
  }, 3000);
}
function showContextInvalidBanner() {
  if (document.getElementById('ctxInvalidBanner')) return;
  const b = document.createElement('div');
  b.id = 'ctxInvalidBanner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#d29922;color:#0d1117;font-weight:800;font-size:12px;padding:10px;text-align:center;cursor:pointer';
  b.textContent = '⚡ 확장 프로그램이 업데이트되었습니다 — 클릭해서 새로고침';
  b.onclick = () => location.reload();
  document.body.prepend(b);
}

/* ── 부트 (readyState 분기 — DOMContentLoaded 타이밍 레이스 방지) ── */
function _boot() {
  watchExtensionContext();
  // splash 1.2초 후 숨기기
  setTimeout(()=>{
    const sp = document.getElementById('splash');
    if (sp) sp.style.display = 'none';
  }, 1200);

  init().catch(e=>{
    console.error('[SGW Panel] init error:', e);
    // 오류 시에도 로그인 화면은 표시
    const ls = document.getElementById('loginScreen');
    const ap = document.getElementById('app');
    if (ls) ls.style.display = '';
    if (ap) ap.style.display = 'none';
  });

  attachUI(); // ★ init() 완료 여부와 무관하게 반드시 실행
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', _boot);
} else {
  _boot();
}
