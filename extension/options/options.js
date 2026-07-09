/* Seastar GW — Options (설정 저장/복원) */
import { storage, KEYS, DEFAULTS } from '../lib/storage.js';

const $ = (id) => document.getElementById(id);

async function load() {
  $('gw_host').value    = (await storage.get(KEYS.GW_HOST))    || DEFAULTS.gw_host;
  $('sedms_host').value = (await storage.get(KEYS.SEDMS_HOST)) || DEFAULTS.sedms_host;
  const notif = await storage.get(KEYS.NOTIFICATIONS_ENABLED);
  $('notifications_enabled').checked = (notif === undefined) ? DEFAULTS.notifications_enabled : !!notif;
  $('poll_interval_min').value = (await storage.get(KEYS.POLL_INTERVAL_MIN)) || DEFAULTS.poll_interval_min;
}

function flash(msg, ok = true) {
  const s = $('status');
  s.textContent = msg;
  s.style.color = ok ? 'var(--green)' : 'var(--danger)';
  setTimeout(() => { s.textContent = ''; }, 2500);
}

async function save() {
  const gw    = ($('gw_host').value || '').trim().replace(/\/+$/, '');
  const sedms = ($('sedms_host').value || '').trim().replace(/\/+$/, '');
  let poll    = parseInt($('poll_interval_min').value, 10);
  if (!/^https?:\/\//.test(gw))    return flash('그룹웨어 주소는 http(s):// 로 시작해야 합니다', false);
  if (!/^https?:\/\//.test(sedms)) return flash('SEDMS 주소는 http(s):// 로 시작해야 합니다', false);
  if (!Number.isFinite(poll) || poll < 1) poll = DEFAULTS.poll_interval_min;
  if (poll > 30) poll = 30;

  await storage.set(KEYS.GW_HOST, gw);
  await storage.set(KEYS.SEDMS_HOST, sedms);
  await storage.set(KEYS.NOTIFICATIONS_ENABLED, $('notifications_enabled').checked);
  await storage.set(KEYS.POLL_INTERVAL_MIN, poll);
  // 폴링 주기 변경을 SW에 반영 (alarm 재생성)
  chrome.runtime.sendMessage({ type: 'SWGS_APPLY_SETTINGS' }).catch(() => {});
  flash('✓ 저장 완료 — 즉시 적용됩니다');
}

async function reset() {
  await storage.set(KEYS.GW_HOST, DEFAULTS.gw_host);
  await storage.set(KEYS.SEDMS_HOST, DEFAULTS.sedms_host);
  await storage.set(KEYS.NOTIFICATIONS_ENABLED, DEFAULTS.notifications_enabled);
  await storage.set(KEYS.POLL_INTERVAL_MIN, DEFAULTS.poll_interval_min);
  await load();
  flash('기본값으로 복원했습니다');
}

$('btnSave').onclick = save;
$('btnReset').onclick = reset;
load();
