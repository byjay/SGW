/* Seastar GW — Sidepanel Logic */
import { storage, KEYS, DEFAULTS } from '../lib/storage.js';

let state = {
  empNum: null, empName: null, token: null, authAt: 0,
  counts: { notice: 0, leave: 0, message: 0, approval: 0 },
  activities: [],
  gwHost: DEFAULTS.gw_host
};

async function init() {
  state.empNum = await storage.get(KEYS.EMP_NUM);
  state.empName = await storage.get(KEYS.EMP_NAME);
  state.token = await storage.get(KEYS.AUTH_TOKEN);
  state.authAt = await storage.get(KEYS.AUTH_AT);
  state.gwHost = (await storage.get(KEYS.GW_HOST)) || DEFAULTS.gw_host;
  state.sedmsHost = DEFAULTS.sedms_host;

  if (state.empNum) showApp();
  else showLogin();

  // 마지막 업데이트 체크 시각 표시
  const lastCheck = await storage.get('swgs_last_update_check');
  const serverVer = await storage.get('swgs_server_version');
  const myVer = chrome.runtime.getManifest().version;
  if (lastCheck) {
    const min = Math.round((Date.now() - lastCheck) / 60000);
    const txt = serverVer && compareVerLocal(serverVer, myVer) > 0
      ? `🎉 서버 v${serverVer} 사용 가능 (현재 v${myVer})`
      : `<span class="ts">${min}분 전 확인 · 최신 v${myVer}</span>`;
    showUpdateStatus(txt, serverVer && compareVerLocal(serverVer, myVer) > 0, serverVer);
  }
}
function compareVerLocal(a, b) {
  const A = (a||'0').split('.').map(Number); const B = (b||'0').split('.').map(Number);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i]||0, y = B[i]||0; if (x !== y) return x - y;
  } return 0;

  attachUI();
  setTimeout(() => chrome.runtime.sendMessage({ type: 'SWGS_TRIGGER_POLL' }).catch(()=>{}), 500);

  // SGW 탭 확인 → 없으면 안내
  setTimeout(checkSgwTab, 1500);
  setInterval(checkSgwTab, 30000);
}

async function checkSgwTab() {
  const tabs = await chrome.tabs.query({ url: state.gwHost + '/*' });
  const sub = document.getElementById('userInfo');
  if (sub && state.empNum) {
    const live = tabs.length > 0 ? '🟢' : '⚪';
    const persistent = await storage.get('swgs_persistent_login') ? '🔒' : '';
    sub.textContent = state.empNum + ' · ' + (state.empName || '') + ' ' + live + ' ' + persistent;
    sub.title = (tabs.length > 0 ? '✓ SGW 활성 (실시간 알림 작동)' : '⚪ SGW 탭 없음 — 알림은 SGW 탭이 열려있을 때 활성')
              + (persistent ? ' · 🔒 영구 로그인 ON (자동 복원)' : '');
  }
}

function showLogin() {
  document.getElementById('loginScreen').style.display = '';
  document.getElementById('app').style.display = 'none';
}
function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = '';
  document.getElementById('userInfo').textContent = state.empNum + ' · ' + (state.empName || '');
  document.getElementById('curVer').textContent = 'v' + chrome.runtime.getManifest().version;
}

async function doLogin(e) {
  e.preventDefault();
  // 수동 등록 — 그룹웨어 페이지를 거치지 않을 때만 사용
  const empNum = document.getElementById('empNum').value.trim();
  if (!empNum) return;
  await storage.set(KEYS.EMP_NUM, empNum);
  await storage.set(KEYS.EMP_NAME, empNum);
  await storage.set(KEYS.AUTH_AT, Date.now());
  state.empNum = empNum; state.empName = empNum;
  showApp();
  toast('✓ 사원번호 등록됨 — SGW 페이지 로그인 권장', 'green');
}

function openGW() {
  chrome.tabs.create({ url: state.gwHost });
  toast('🌐 SGW 페이지 열림 — 로그인 후 자동 반영', 'green');
}

async function doLogout() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  await chrome.runtime.sendMessage({ type: 'SWGS_LOGOUT' });
  state.empNum = null; state.empName = null; state.token = null;
  showLogin();
  toast('로그아웃 완료', 'green');
}

function updateCounts() {
  document.getElementById('cntNotice').textContent = state.counts.notice;
  document.getElementById('cntLeave').textContent = state.counts.leave;
  document.getElementById('cntMessage').textContent = state.counts.message;
  document.getElementById('cntApproval').textContent = state.counts.approval;
  const total = Object.values(state.counts).reduce((a,b) => a+b, 0);
  const badge = document.getElementById('badgeAll');
  badge.textContent = total;
  badge.dataset.zero = total === 0 ? 'true' : 'false';
}

function renderActivities() {
  const list = document.getElementById('activityList');
  list.innerHTML = '';
  if (state.activities.length === 0) {
    list.innerHTML = '<div class="empty">📭 최근 활동 없음</div>';
    return;
  }
  state.activities.slice(0, 20).forEach(a => {
    const item = document.createElement('div');
    item.className = 'item';
    const icon = ({ notice: '📢', leave: '🌴', message: '💬', approval: '✍️' })[a.kind] || '📌';
    // 쪽지의 경우 발신자를 굵게 표시
    const head = a.kind === 'message' && a.sender
      ? `${icon} <strong>${a.sender}</strong>님의 새 쪽지`
      : `${icon} ${a.title || a.from || '활동'}`;
    item.innerHTML = `
      <div class="head">${head}</div>
      <div class="body">${(a.content || a.body || '').slice(0, 80)}</div>
    `;
    item.onclick = () => openLink(a.kind);
    list.appendChild(item);
  });
}

function openLink(kind) {
  const path = ({ notice: '/board', leave: '/leave', message: '/messages', approval: '/approval' })[kind] || '/';
  chrome.tabs.create({ url: state.gwHost + path });
}

function attachUI() {
  document.getElementById('loginForm').onsubmit = doLogin;
  document.getElementById('btnOpenGW').onclick = openGW;
  document.getElementById('btnLogout').onclick = doLogout;
  document.getElementById('btnRefresh').onclick = () => {
    chrome.runtime.sendMessage({ type: 'SWGS_TRIGGER_POLL' });
    toast('🔄 새로고침', 'green');
  };
  // ★ 원클릭 자동 업데이트 — 다운로드/팝업 없이 자동 적용 + 자동 재시작
  document.getElementById('checkUpdate').onclick = async (e) => {
    e.preventDefault();
    showUpdateStatus('🔄 새 버전 확인 중...', false);
    toast('🔄 자동 업데이트 진행 중...', 'green');
    const r = await chrome.runtime.sendMessage({ type: 'SWGS_AUTO_UPDATE_NOW' });
    if (r && r.applied) {
      showUpdateStatus('✓ 새 버전 적용 — 재시작 중...', false);
      toast(`✓ v${r.newVersion} 적용 → 재시작`, 'green');
      // 백그라운드가 1초 후 chrome.runtime.reload() 실행 → 사이드 패널 자동 재로드
    } else if (r && r.upToDate) {
      showUpdateStatus(`✓ 이미 최신 (v${r.version})`, false);
      toast('✓ 이미 최신 버전', 'green');
      setTimeout(() => showUpdateStatus('', false), 4000);
    } else {
      showUpdateStatus('⚠ ' + ((r && r.err) || '확인 실패'), false);
      toast('⚠ 업데이트 실패', 'red');
    }
  };
  document.getElementById('btnLeaveOpen').onclick = () => chrome.tabs.create({ url: state.gwHost + '/leave' });
  document.getElementById('btnLeaveNew').onclick = () => chrome.tabs.create({ url: state.gwHost + '/leave?new=1' });
  document.getElementById('btnSedmsOpen').onclick = () => chrome.tabs.create({ url: 'https://sedms.seastar.co.kr/' });
  document.getElementById('btnSedmsApprove').onclick = () => chrome.tabs.create({ url: state.gwHost + '/approval' });
  // 전체 메뉴 카드들 (10개)
  document.querySelectorAll('.menu-card').forEach(card => {
    card.onclick = () => {
      const url = card.dataset.go;
      const isExt = card.dataset.ext === '1';
      const fullUrl = isExt ? url : (state.gwHost + url);
      chrome.tabs.create({ url: fullUrl });
      const label = card.querySelector('.ml')?.textContent || '';
      toast(`🌐 ${label} 열기`, 'green');
    };
  });
  document.getElementById('btnGoHome').onclick = () => chrome.tabs.create({ url: state.gwHost + '/' });
  document.getElementById('btnRefreshAll').onclick = () => {
    chrome.runtime.sendMessage({ type: 'SWGS_TRIGGER_POLL' });
    toast('🔄 알림 갱신', 'green');
  };
  // Tab switch
  document.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.tab === b.dataset.tab));
  });
  // Count card click → 해당 페이지
  document.querySelectorAll('.cnt-card').forEach(c => {
    c.onclick = () => openLink(c.classList[1] === 'msg' ? 'message' : c.classList[1]);
  });
}

// Background로부터 활동 알림
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'SWGS_NEW_ACTIVITY') {
    state.counts[msg.kind] = (state.counts[msg.kind] || 0) + msg.count;
    if (msg.items) state.activities.unshift(...msg.items.map(it => ({ ...it, kind: msg.kind })));
    state.activities = state.activities.slice(0, 50);
    updateCounts();
    renderActivities();
  } else if (msg.type === 'SWGS_COUNTS_UPDATE') {
    // SGW 페이지의 unread 카운트 직접 업데이트
    Object.assign(state.counts, msg.counts);
    updateCounts();
  } else if (msg.type === 'SWGS_AUTH_UPDATED') {
    init();
  } else if (msg.type === 'SWGS_UPDATE_AVAILABLE') {
    // ★ CF Pages에 새 버전 빌드 감지됨
    showUpdateStatus(
      `🎉 새 버전 v${msg.version} 다운로드 완료`,
      true,
      msg.version
    );
    toast(`✨ v${msg.version} 적용 준비됨`, 'green');
  } else if (msg.type === 'SWGS_UPDATE_CHECKED') {
    if (msg.upToDate) {
      showUpdateStatus(`✓ 최신 버전 (v${msg.version})`, false);
      setTimeout(() => showUpdateStatus('', false), 5000);
    }
  }
});

function showUpdateStatus(text, ready, newVersion) {
  const el = document.getElementById('updateStatus');
  if (!el) return;
  if (!text) { el.innerHTML = ''; el.className = 'update-status'; return; }
  el.className = 'update-status' + (ready ? ' ready' : '');
  if (ready) {
    el.innerHTML = `${text} <button class="apply-btn" id="btnApplyNow">즉시 적용</button>`;
    document.getElementById('btnApplyNow').onclick = async () => {
      if (!confirm(`v${newVersion}으로 즉시 업데이트합니다.\n사이드 패널이 잠시 닫혔다가 다시 열립니다.`)) return;
      await chrome.runtime.sendMessage({ type: 'SWGS_FORCE_RELOAD' });
    };
  } else {
    el.innerHTML = text;
  }
}

function toast(m, type='green') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = m;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

window.addEventListener('DOMContentLoaded', () => {
  init().catch(e => console.error(e));
});
