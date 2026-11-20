/**
 * scan-orphan.mjs — SGW 고아 컴포넌트/모듈 2단계 전수 탐지 (글로벌 규율 §5)
 *
 * SOURCE: _warehouse/05-scripts-build/scan-orphan-logic.mjs 를 SGW 구조에 맞게 확장.
 *   창고 원본 = services/ 함수 단위 + 모듈 단위 1.5단계.
 *   본 스크립트 = ① 모듈 고아 ② 렌더 고아 ③ functions/ 라우트 도달성 3종.
 *
 * ① 모듈 고아  : 어디서도 import(정적/동적/재수출) 되지 않는 소스 파일.
 * ② 렌더 고아  : import 은 되지만 JSX(<X>)/createElement 로 렌더된 적이 없는 컴포넌트.
 *                 (SEcMS NodeRelationBuilderTab 사고 유형 — prefetch import 착시)
 * ③ 라우트 고아: functions/ 아래 라우트 파일인데 onRequest* 를 export 하지 않아
 *                 Cloudflare Pages 파일라우팅으로 절대 도달 불가한 핸들러.
 *
 * 사용: node scripts/scan-orphan.mjs           (전체 리포트)
 *       node scripts/scan-orphan.mjs --guard   (신규 고아 발견 시 EXIT 1 — 빌드 차단)
 *       node scripts/scan-orphan.mjs --json    (기계 판독용)
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = process.argv.includes('--guard');
const JSON_OUT = process.argv.includes('--json');

// ── 대상/제외 ────────────────────────────────────────────────────────────────
const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.wrangler', '_archive', 'scripts',
  'extension', 'installer', 'sgw_flutter', 'public', 'sgwextensionv0.1.0', 'd1', 'docs',
]);
const SCAN_DIRS = ['components', 'services', 'utils', 'contexts', 'hooks', 'constants', 'functions'];
// 번들러/런타임 진입점 — 아무도 import 하지 않는 게 정상.
const ENTRYPOINTS = new Set(['index.tsx', 'App.tsx', 'types.ts', 'global.d.ts', 'vite.config.ts']);
const SRC_EXT = ['.ts', '.tsx', '.js', '.mjs'];

/**
 * 공인 화이트리스트 — 의도적 미연결. 사유를 반드시 적을 것.
 * 여기 없는 신규 고아가 생기면 --guard 가 빌드를 차단한다.
 */
const KNOWN_ORPHANS = {
  // 2026-07-23 스캔 최초 도입 시점의 기존 고아 — 마스터 판정 대기(신규 회귀와 구분용).
  'utils/index.ts':
    '범용 유틸 배럴(storage/date/string/validation/device/error). 어디서도 미사용. 삭제 or 채택 판정 대기',
  'components/LoginPopup.tsx':
    '로그인 후 "알림" 팝업(당일 연차자/결재요청). App.tsx가 import만 하고 렌더 안 함 — 표시 시점 정책 미정',
};

// ── 1) 소스 수집 ─────────────────────────────────────────────────────────────
/** @type {{rel:string, abs:string, txt:string}[]} */
const files = [];
function walk(dir) {
  let entries;
  try { entries = readdirSync(join(ROOT, dir), { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(join(dir, e.name));
    } else {
      const rel = join(dir, e.name).replace(/\\/g, '/');
      if (!SRC_EXT.includes(extname(e.name))) continue;
      if (e.name.endsWith('.d.ts') || /\.(test|spec)\./.test(e.name)) continue;
      files.push({ rel, abs: join(ROOT, rel), txt: readFileSync(join(ROOT, rel), 'utf8') });
    }
  }
}
SCAN_DIRS.forEach(walk);
for (const rf of ENTRYPOINTS) {
  const abs = join(ROOT, rf);
  if (existsSync(abs) && statSync(abs).isFile()) {
    files.push({ rel: rf, abs, txt: readFileSync(abs, 'utf8') });
  }
}
const byRel = new Map(files.map(f => [f.rel, f]));

// ── 2) import 그래프 ─────────────────────────────────────────────────────────
/** 상대 specifier → 리포 기준 rel 경로 해석 (확장자 생략/index 배럴/.js→.ts 매핑 포함) */
function resolveSpec(spec, fromRel) {
  if (!spec.startsWith('.')) return null; // bare 의존성
  const baseAbs = resolve(ROOT, dirname(fromRel), spec);
  const cands = [
    baseAbs,
    ...SRC_EXT.map(x => baseAbs + x),
    // TS 소스를 .js 확장자로 import 하는 ESM 관행
    ...(baseAbs.endsWith('.js') ? ['.ts', '.tsx'].map(x => baseAbs.slice(0, -3) + x) : []),
    ...SRC_EXT.map(x => join(baseAbs, 'index' + x)),
  ];
  for (const c of cands) {
    if (existsSync(c) && statSync(c).isFile()) {
      return relative(ROOT, c).replace(/\\/g, '/');
    }
  }
  return null;
}

/** import 문에서 로컬 바인딩 이름 추출: default / * as ns / { a, b as c } */
function parseBindings(clause) {
  const out = [];
  if (!clause) return out;
  const ns = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (ns) out.push(ns[1]);
  const braced = clause.match(/\{([\s\S]*?)\}/);
  if (braced) {
    for (const part of braced[1].split(',')) {
      const p = part.trim().replace(/^type\s+/, '');
      if (!p) continue;
      const as = p.match(/\bas\s+([A-Za-z_$][\w$]*)/);
      out.push(as ? as[1] : p.split(/\s+/)[0]);
    }
  }
  const head = clause.replace(/\{[\s\S]*?\}/g, '').replace(/\*\s+as\s+[A-Za-z_$][\w$]*/g, '');
  const def = head.replace(/^\s*type\s+/, '').split(',')[0].trim();
  if (/^[A-Za-z_$][\w$]*$/.test(def)) out.push(def);
  return [...new Set(out)];
}

/** rel → Set<importer rel> */
const importedBy = new Map(files.map(f => [f.rel, new Set()]));
/** rel → { importerRel: string[] bindings } */
const bindingsOf = new Map(files.map(f => [f.rel, new Map()]));
/** importer rel → import 문만 제거한 본문 (식별자 사용처 판정용) */
const bodyOf = new Map();

const RE_STATIC = /(?:^|\n)\s*import\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g;
const RE_SIDE = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
const RE_REEXPORT = /(?:^|\n)\s*export\s+(?:\*|\{[\s\S]*?\})\s*from\s*['"]([^'"]+)['"]/g;
const RE_DYNAMIC = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const RE_REQUIRE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

function link(targetRel, importerRel, bindings) {
  if (!targetRel || targetRel === importerRel) return;
  if (!importedBy.has(targetRel)) return;
  importedBy.get(targetRel).add(importerRel);
  const m = bindingsOf.get(targetRel);
  m.set(importerRel, [...new Set([...(m.get(importerRel) || []), ...bindings])]);
}

for (const f of files) {
  let body = f.txt;
  for (const [re, specIdx, clauseIdx] of [[RE_STATIC, 2, 1], [RE_SIDE, 1, null], [RE_REEXPORT, 1, null]]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(f.txt))) {
      link(resolveSpec(m[specIdx], f.rel), f.rel, clauseIdx ? parseBindings(m[clauseIdx]) : []);
    }
    body = body.replace(re, '\n');
  }
  for (const re of [RE_DYNAMIC, RE_REQUIRE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(f.txt))) link(resolveSpec(m[1], f.rel), f.rel, []);
  }
  bodyOf.set(f.rel, body);
}

// ── 3) functions/ 라우트 도달성 (파일라우팅) ─────────────────────────────────
// Cloudflare Pages: 경로 세그먼트 중 하나라도 '_' 로 시작하면 라우팅 제외(= 라이브러리).
// 단 파일명이 '_middleware' 인 것은 특수 진입점.
const fnSegs = rel => rel.replace(/^functions\//, '').split('/');
const isFnRoute = rel => rel.startsWith('functions/') && !fnSegs(rel).some(s => s.startsWith('_'));
const isFnLib = rel => rel.startsWith('functions/') && fnSegs(rel).some(s => s.startsWith('_'));
const RE_HANDLER = /export\s+(?:async\s+function|function|const)\s+(onRequest[A-Za-z]*)\b/;

const routeOrphans = files
  .filter(f => isFnRoute(f.rel) && !RE_HANDLER.test(f.txt))
  .map(f => f.rel);

// ── 4) ① 모듈 고아 ───────────────────────────────────────────────────────────
// 진입점 + Pages 파일라우팅 대상(_middleware 포함)은 "import 안 됨"이 정상.
const moduleOrphans = files
  .filter(f => !ENTRYPOINTS.has(f.rel))
  .filter(f => !isFnRoute(f.rel) && !(isFnLib(f.rel) && basename(f.rel) === '_middleware.js'))
  .filter(f => importedBy.get(f.rel).size === 0)
  .map(f => f.rel);

// ── 5) ② 렌더 고아 ───────────────────────────────────────────────────────────
// 컴포넌트를 export 하는 파일이 import 은 되지만 어떤 importer 에서도 렌더되지 않음.
const RE_COMPONENT_EXPORT = [
  /export\s+const\s+([A-Z][\w$]*)\s*:\s*React\.FC/,
  /export\s+(?:default\s+)?(?:function|class)\s+([A-Z][\w$]*)/,
  /export\s+default\s+([A-Z][\w$]*)\s*;/,
  // 오탐 방지: React.memo / forwardRef 래핑
  /export\s+const\s+([A-Z][\w$]*)\s*=\s*(?:React\.)?(?:memo|forwardRef)\s*\(/,
];
function exportsComponent(txt) {
  return RE_COMPONENT_EXPORT.some(re => re.test(txt));
}

const renderOrphans = [];
for (const f of files) {
  if (!/^(components|features)\//.test(f.rel)) continue;
  if (!exportsComponent(f.txt)) continue;
  const importers = [...importedBy.get(f.rel)];
  if (importers.length === 0) continue; // ①에서 이미 잡힘

  let rendered = false;
  for (const imp of importers) {
    const body = bodyOf.get(imp) || '';
    let names = bindingsOf.get(f.rel).get(imp) || [];
    // lazy(() => import('./X')) 별칭: const X = lazy(...) 바인딩을 회수
    const lazyRe = new RegExp(
      `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:React\\.)?lazy\\(\\s*\\(\\)\\s*=>\\s*import\\(\\s*['"][^'"]*${basename(f.rel).replace(/\.(tsx?|jsx?)$/, '')}(?:\\.[jt]sx?)?['"]`,
      'g');
    let lm;
    while ((lm = lazyRe.exec(bodyOf.get(imp) || (byRel.get(imp)?.txt ?? '')))) names.push(lm[1]);
    names = [...new Set(names)];

    for (const n of names) {
      const esc = n.replace(/[$]/g, '\\$');
      if (new RegExp(`<${esc}[\\s/>]`).test(body)) { rendered = true; break; }
      if (new RegExp(`createElement\\(\\s*${esc}\\b`).test(body)) { rendered = true; break; }
      // 라우트 테이블/설정 객체에 컴포넌트로 등록되는 형태
      if (new RegExp(`(?:component|element|render|Component)\\s*:\\s*${esc}\\b`).test(body)) { rendered = true; break; }
    }
    if (rendered) break;
  }
  if (!rendered) renderOrphans.push(f.rel);
}

// ── 6) 리포트 ────────────────────────────────────────────────────────────────
const tag = rel => (rel in KNOWN_ORPHANS ? `⚪ 공인(${KNOWN_ORPHANS[rel]})` : '🔴 신규');
const newOnly = list => list.filter(r => !(r in KNOWN_ORPHANS));

const result = {
  scanned: files.length,
  moduleOrphans, renderOrphans, routeOrphans,
  newModuleOrphans: newOnly(moduleOrphans),
  newRenderOrphans: newOnly(renderOrphans),
  newRouteOrphans: newOnly(routeOrphans),
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const bar = '═'.repeat(72);
  console.log(`\n${bar}\n🎭 SGW 고아 스캔 — 소스 ${files.length}개 검사\n${bar}`);

  console.log(`\n① 모듈 통째 고아 (어디서도 import 안 됨): ${moduleOrphans.length}건`);
  moduleOrphans.length
    ? moduleOrphans.forEach(r => console.log(`   ${tag(r)}  ${r}`))
    : console.log('   ✅ 없음');

  console.log(`\n② 렌더 고아 (import 되지만 JSX 렌더 0건): ${renderOrphans.length}건`);
  renderOrphans.length
    ? renderOrphans.forEach(r => console.log(`   ${tag(r)}  ${r}   ← import 착시 주의`))
    : console.log('   ✅ 없음');

  console.log(`\n③ 라우트 고아 (functions/ 인데 onRequest* 없음 = 도달 불가): ${routeOrphans.length}건`);
  routeOrphans.length
    ? routeOrphans.forEach(r => console.log(`   ${tag(r)}  ${r}`))
    : console.log('   ✅ 없음');
  console.log('');
}

const newTotal = result.newModuleOrphans.length + result.newRenderOrphans.length + result.newRouteOrphans.length;
if (newTotal > 0) {
  if (!JSON_OUT) {
    console.log(`🔴🔴🔴 신규 고아 ${newTotal}건 — 메뉴/라우팅에 재연결하거나 죽은 코드면 삭제하십시오.`);
    console.log(`   의도적 미연결이면 scripts/scan-orphan.mjs 의 KNOWN_ORPHANS 에 사유와 함께 등록.\n`);
  }
  process.exit(GUARD ? 1 : 0); // 리포트 모드는 종료코드 0 (가드 모드만 빌드 차단)
}
if (!JSON_OUT) console.log('✅ 고아 0건 (공인 화이트리스트 제외).\n');
process.exit(0);
