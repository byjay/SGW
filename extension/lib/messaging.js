/* Seastar GW — 공용 메시지 헬퍼 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.__SWGS_MSG__) return;
  var ENV = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) ? 'extension' : 'page';
  function send(type, payload) {
    var msg = Object.assign({ type: type, _ts: Date.now() }, payload || {});
    if (ENV === 'extension') { try { chrome.runtime.sendMessage(msg); } catch(e){} }
    else { try { window.parent.postMessage(msg, '*'); } catch(e){} try { if (window.opener) window.opener.postMessage(msg, '*'); } catch(e){} }
  }
  function on(type, handler) {
    if (ENV === 'extension') {
      chrome.runtime.onMessage.addListener(function (m, s, r) {
        if (m && m.type === type) try { handler(m, s, r); } catch(e) { console.error(e); }
      });
    } else {
      window.addEventListener('message', function (e) { if (e.data && e.data.type === type) handler(e.data, e); });
    }
  }
  window.__SWGS_MSG__ = { send: send, on: on };
})();
