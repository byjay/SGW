// POST /api/auth/change-password  {newPassword}  (인증 필요)
//  → 토큰 신원(sub)의 sgw_users.password_hash 갱신. 초기 '1' 강제변경 플로우용.
import { json } from '../../_lib/social-auth.js';
import { readAuth } from '../../_lib/rbac.js';
import { hashPassword, verifyPassword } from '../../_lib/password.js';

// 초기 배포 비밀번호 — 이 값을 쓰고 있는 계정은 "강제 변경" 플로우라 현재 비번 재확인을 면제한다.
const INITIAL_PASSWORD = '1';

export async function onRequestPost({ request, env, data }) {
  try {
    if (!env || !env.DB) return json({ ok: false, error: 'no_db' }, { status: 500 });
    const user = (data && data.user) || (await readAuth(request, env).catch(() => null));
    if (!user || !user.sub) return json({ ok: false, error: 'auth_required' }, { status: 401 });

    let body;
    try { body = await request.json(); } catch { body = null; }
    const newPassword = body && body.newPassword != null ? String(body.newPassword) : '';
    if (newPassword.length < 8) {
      return json({ ok: false, error: 'weak_password' }, { status: 400 });
    }

    // ★ 계정 탈취 방지: 세션 토큰만으로 비밀번호를 갈아끼우면 토큰 유출 = 계정 영구 탈취가 된다.
    //   현재 비밀번호 재확인을 요구하되, 초기 비번('1') 강제변경 플로우는 면제한다
    //   (그 계정은 이미 누구나 아는 값이라 재확인의 보안 가치가 0이고, 기존 UX가 깨진다).
    const row = await env.DB.prepare('SELECT password_hash FROM sgw_users WHERE id = ?')
      .bind(String(user.sub))
      .first();
    if (!row || !row.password_hash) {
      return json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    const isInitial = await verifyPassword(INITIAL_PASSWORD, row.password_hash);
    if (!isInitial) {
      const current = body && body.currentPassword != null ? String(body.currentPassword) : '';
      if (!current || !(await verifyPassword(current, row.password_hash))) {
        return json({ ok: false, error: 'current_password_required' }, { status: 403 });
      }
    }

    const hash = await hashPassword(newPassword);
    await env.DB.prepare('UPDATE sgw_users SET password_hash = ? WHERE id = ?')
      .bind(hash, String(user.sub))
      .run();

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: 'change_failed' }, { status: 500 });
  }
}
