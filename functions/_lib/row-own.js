// row-own.js — 클라이언트가 지정한 PK로 `INSERT OR REPLACE` 할 때
// **타인 소유 행을 덮어쓰는 것**을 막는 공용 가드.
//
// 왜 필요한가: 대부분의 쓰기 API가 `body.id` 를 그대로 PK로 쓰고 INSERT OR REPLACE 한다.
// 소유자 컬럼(sender_id 등)은 토큰 sub 로 강제되지만, **행 자체는 남의 것을 지정할 수 있다**.
// → 공격자가 `id: 'msg_1770000000'` 처럼 남의 행 id를 넣으면 그 행이 통째로 덮여
//   (내용 변조 · 소유권 이전 · 데이터 소실) 된다. 이 헬퍼가 그 경로를 닫는다.
//
// 규칙: 행이 없으면 신규 → 허용. 있으면 ownerCols 중 하나라도 uid와 같아야 허용.
// table/idCol/ownerCols 는 **호출부의 서버 상수만** 넘긴다(사용자 입력 금지 — SQL 식별자 자리).

export async function ownsRow(env, table, ownerCols, id, uid, idCol = 'id') {
  if (!env || !env.DB) return false;
  const r = await env.DB.prepare(
    `SELECT ${ownerCols.join(', ')} FROM ${table} WHERE ${idCol} = ?`
  )
    .bind(String(id))
    .first()
    .catch(() => null);
  if (!r) return true; // 존재하지 않는 id → 신규 생성
  return ownerCols.some((c) => r[c] != null && String(r[c]) === String(uid));
}

// 셀프체크(프레임워크 없이): 소유 판정 불변식이 깨지면 로드 직후 즉시 throw.
const mockDb = (row) => ({
  DB: { prepare: () => ({ bind: () => ({ first: () => Promise.resolve(row) }) }) },
});
Promise.all([
  ownsRow(mockDb(null), 't', ['owner'], 'x', '1'), // 없는 행 → 신규 → true
  ownsRow(mockDb({ owner: '1' }), 't', ['owner'], 'x', '1'), // 본인 → true
  ownsRow(mockDb({ owner: '2' }), 't', ['owner'], 'x', '1'), // 타인 → false
]).then(([a, b, c]) => {
  if (a !== true || b !== true || c !== false) {
    throw new Error('row-own.js self-check failed');
  }
});
