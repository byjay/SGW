# NAS 하이브리드 — JS ↔ Dart interop 계약 (v1.0 · 2026-07-23)

> 이 문서가 **다음 배치(Dart 화면 배선)의 단일 규격**이다. 여기 적힌 시그니처와 스키마를 바꾸려면 이 문서를 먼저 고친다.

## 0. 두 절반

| 모드 | 경로 | 주체 | 언제 |
|---|---|---|---|
| **local** | `window.sgwNasLocal.*` (File System Access API + IndexedDB 핸들 영속) | 브라우저가 사내망 NAS를 **직접** 읽고 씀 | Chromium 계열 + https/localhost + 사용자가 1회 폴더 선택 완료 |
| **server** | `GET/POST /api/nas/*` (Synology FileStation, `_lib/nas-client.js`) | Cloudflare Worker 경유 | 위 조건이 하나라도 불충족 (Firefox/Safari, 미설정, 권한거부) |

Cloudflare Worker는 사내망 NAS에 접근할 수 없다(현재 `NAS_BASE_URL` 등 미설정 → 서버 경로는 503). 따라서 **local 이 주 경로, server 는 폴백**이다.

## 1. 산출물 파일

| 파일 | 역할 |
|---|---|
| `public/static/sgw-nas-local.js` | 로컬 브릿지 본체. IIFE, 의존성 0, `window.sgwNasLocal` 전역 노출 |
| `functions/api/nas/audit.js` | 로컬 작업의 ACL 판정 + 감사로그 (아래 §5) |
| `functions/_lib/nas-map.js` | 폴더키↔실경로 매핑 (SEASTAR 표준 루트 additive 반영됨) |

> ⚠ `sgw-nas-local.js` 는 현재 **의도적 미연결**(고아 아님). 정적 자산으로 `/static/sgw-nas-local.js` 에 서빙되며, 소비자(Flutter web `web/index.html`)가 다음 배치에서 `<script defer src="/static/sgw-nas-local.js"></script>` 로 로드한다.

## 2. 전역 API 시그니처 (`window.sgwNasLocal`)

**불변 규약 3가지**
1. 모든 함수는 Promise를 반환하고 **절대 reject 하지 않는다.** 실패도 `{ok:false, error, message}` 로 resolve. (Dart interop에서 rejection 처리 비용·스택 유실 회피)
2. 반환값은 plain object / 배열 / ArrayBuffer / 원시값만. `FileSystemHandle` 은 절대 Dart로 넘기지 않는다(모듈 내부 IndexedDB에만 존재).
3. 시간 = epoch millis(number), 크기 = bytes(number).

| 함수 | 인자 | 반환 |
|---|---|---|
| `isSupported()` | — | `boolean` (동기) |
| `decideMode(rootKey?)` | `string` | `{mode:'local'\|'server', reason}` |
| `getStatus(rootKey?)` | `string` | `{supported,configured,name,granted,rootKey}` |
| `hasHandle(rootKey?)` | `string` | `boolean` |
| `pickFolder({rootKey?})` | obj | `{ok:true,name,rootKey}` \| `{ok:false,error}` — **사용자 제스처 필수** |
| `forget(rootKey?)` | `string` | `{ok:true}` |
| `list({rootKey?,path?,depth?,exts?})` | obj | `{ok:true, files:[FileEntry]}` \| `{ok:false,error}` |
| `readFile({rootKey?,path,as?})` | obj | `{ok:true,name,path,size,mtime,type,data}` \| `{ok:false,error}` |
| `writeFile({rootKey?,path,data,overwrite?,createDirs?})` | obj | `{ok:true,name,path,renamed}` \| `{ok:false,error}` |

**FileEntry (서버 `/api/nas/list` 와 동일 스키마 — Dart 모델 1개로 양쪽 소비)**
```
{ name:string, path:string, isdir:bool, size:int, mtime:int }
```

**인자 상세**
- `rootKey` — 폴더별 루트 분리 저장 키. `'default'` 기본. 표준 폴더키(`proj_active`,`share`,`deploy`…)를 그대로 쓰면 §5 audit 의 `folderKey` 와 1:1로 맞아떨어진다.
- `path` — **루트 기준 상대경로만**. `..`·`/시작`·`C:/`·UNC(`\\srv\share`)는 전부 거부(`path_escape`/`absolute_path`). 각 세그먼트는 Windows 금지문자 `\ / : * ? " < > |`·제어문자 치환, 선행 `.` 제거, 예약어(`CON`,`PRN`…) 앞에 `_`.
- `data` (writeFile) — `ArrayBuffer` / TypedArray / `Blob` / `string`. Dart의 `Uint8List` 는 `.toJS` 로 넘기면 된다.
- `as` (readFile) — `'text'` 면 `data:string`, 기본은 `data:ArrayBuffer`.
- `overwrite` — 기본 `false` = **덮어쓰기 금지**. 동명 파일이면 `_v2`, `_v3` … 자동 증분하고 `renamed:true` 반환.
- `depth` (list) — 0 기본(해당 폴더만). `exts:['xlsx','pdf']` 확장자 필터.

**error 코드 전량**
`unsupported` · `insecure_context` · `cancelled` · `pick_failed` · `no_handle` · `permission_denied` · `path_required` · `absolute_path` · `path_escape` · `bad_segment` · `not_found` · `read_failed` · `write_failed`

## 3. 폴백(모드) 판정 로직

`decideMode(rootKey)` 하나만 보고 분기한다.

```
showDirectoryPicker 없음        → { mode:'server', reason:'unsupported' }       // Firefox/Safari
window.isSecureContext === false → { mode:'server', reason:'insecure_context' }  // http
IndexedDB에 핸들 없음            → { mode:'server', reason:'no_handle' }         // 최초 사용
queryPermission != 'granted'    → { mode:'server', reason:'permission_denied' }  // 사용자가 회수
그 외                            → { mode:'local',  reason:'ok' }
```

`no_handle` / `permission_denied` 는 **복구 가능** → UI에서 "NAS 폴더 연결" 버튼(=`pickFolder`, 사용자 제스처)을 노출한다.
`unsupported` / `insecure_context` 는 복구 불가 → 서버 경로만 사용하고, 서버가 503이면 "관리자에게 NAS 설정 요청" 안내.
`decideMode` 는 `requestPermission` 을 호출하지 않으므로(비대화형) 화면 진입 시 자유롭게 호출해도 브라우저 팝업이 뜨지 않는다.

## 4. Dart 래퍼 설계 (다음 배치에서 구현 — 파일명·시그니처 고정)

> 대상 리포는 `team_connect_v3`(현재 다른 에이전트 점유). 아래 경로는 그 리포 기준 제안이며, 이번 배치에서는 **작성하지 않는다.**

```
lib/services/nas/
├── nas_local_js.dart      # dart:js_interop 원시 바인딩 (@JS('sgwNasLocal'))
├── nas_entry.dart         # FileEntry 모델 (local/server 공용) + fromJson
├── nas_repository.dart    # 하이브리드 파사드 — decideMode 로 local/server 자동 선택
└── nas_server_api.dart    # /api/nas/* HTTP 클라이언트 (기존 dio/http 재사용)
```

### 4-1. `nas_local_js.dart` — 원시 바인딩
```dart
@JS('sgwNasLocal')
external NasLocalJs? get _sgwNasLocal;

extension type NasLocalJs._(JSObject o) implements JSObject {
  external bool isSupported();
  external JSPromise<JSObject> decideMode([JSString? rootKey]);
  external JSPromise<JSObject> getStatus([JSString? rootKey]);
  external JSPromise<JSBoolean> hasHandle([JSString? rootKey]);
  external JSPromise<JSObject> pickFolder(JSObject opts);
  external JSPromise<JSObject> forget([JSString? rootKey]);
  external JSPromise<JSObject> list(JSObject opts);
  external JSPromise<JSObject> readFile(JSObject opts);
  external JSPromise<JSObject> writeFile(JSObject opts);
}
```
- `opts` 는 `JSObject()` 에 `setProperty` 로 조립(또는 `jsify`).
- 스크립트 미로드 대비: `_sgwNasLocal == null` 이면 곧바로 server 모드로 취급.

### 4-2. `nas_repository.dart` — 파사드 (화면이 쓰는 유일한 API)
```dart
enum NasMode { local, server }

class NasRepository {
  Future<NasMode> mode({String rootKey = 'default'});
  Future<NasPickResult> connectFolder({String rootKey});          // local 전용, 사용자 제스처에서 호출
  Future<void> disconnectFolder({String rootKey});
  Future<List<NasEntry>> list({String rootKey, String path, int depth, List<String> exts});
  Future<Uint8List> read({String rootKey, String path});
  Future<NasWriteResult> write({String rootKey, String path, Uint8List bytes, bool overwrite});
}
```
- 내부 규칙: `mode()==local` → JS 호출 후 **성공/실패 모두** `/api/nas/audit` 로 보고. `mode()==server` → `nas_server_api` 호출(서버가 이미 감사·ACL 수행하므로 audit 중복 호출 금지).
- write/delete 는 **작업 전 audit preflight** → `allowed:false` 면 JS 호출 자체를 하지 않는다.
- JS가 `{ok:false}` 를 주면 Dart 예외(`NasException(code, message)`)로 변환해 화면에서 일관 처리.

## 5. `POST /api/nas/audit` 계약

로컬 모드는 서버를 거치지 않아 기존 `guardPath`/`writeAudit` 가 적용되지 않는다. 이 엔드포인트가 그 공백을 메운다(로직 신규작성 0 — 두 함수 재사용).

**요청**
```json
{ "action": "read|write|delete|list|pick",
  "folderKey": "proj_active",          // 선택. 표준 폴더키면 ACL 판정 수행
  "path": "하위/경로/파일.xlsx",         // folderKey 기준 상대경로 ('..'·절대경로 금지)
  "name": "파일.xlsx", "size": 12345,
  "result": "ok|fail", "message": "..." }
```
**응답**
| 상태 | 본문 | 의미 |
|---|---|---|
| 200 | `{ok:true, allowed:true, level:'RW'\|'RO', mapped:true}` | 진행 허용 |
| 200 | `{ok:true, allowed:true, level:'UNMAPPED', mapped:false}` | 표준 폴더 밖(사용자 임의 폴더) — 차단 불가, WARN으로 기록만 |
| 403 | `{ok:false, allowed:false, error:'forbidden', level:'HIDDEN'}` | **클라이언트는 작업을 중단해야 한다** |
| 400 | `{ok:false, error:'bad_action'\|'bad_path'\|'too_long'\|'bad_json'}` | 입력 오류 |
| 401 | `{error:'auth_required'}` | `_middleware.js` 가 `/api/*` 전체에 토큰 요구 |

감사 이벤트명: `nas.local.<action>` (서버 경유는 `nas.upload` 등 → 접두어로 구분). `meta` 에 `mode:'local'`, `folder_key`, `level`, `name`, `size` 기록.

> ⚠ **정직한 한계**: 클라이언트 자진 신고 구조라 이 판정은 **권고적(advisory)** 이다. 실제 강제력은 NAS 공유 권한(SMB/DSM 계정)이 가진다. 이 로그는 "앱이 무엇을 했다고 보고했는가"의 기록이며, 위·변조 방지는 `audit.js` 의 chain hash 가 담당한다.

## 6. 폴더 표준 매핑 (`_lib/nas-map.js`)

SEASTAR NAS 폴더 표준 v1.0(SoT: `SEDMS_G/docs/NAS_FOLDER_STANDARD.md` §2)의 최상위 계층을 **additive** 로 추가했다. 기존 키는 `nas_acl` 행이 참조 중이라 이름 변경·삭제 금지.

| folderKey | 실경로 | 비고 |
|---|---|---|
| `proj_active` / `proj_done` / `share` / `ext` / `admin` | `/01_프로젝트/진행중` · `/01_프로젝트/완료` · `/02_공유` · `/03_외부공유` · `/09_관리자` | 레거시(기존) |
| `admin_std` | `/00_관리자` | 표준 |
| `work` | `/00_작업` | 표준 |
| `proj` | `/01_프로젝트` | 표준(레거시 진행중/완료보다 **뒤** 선언 — 구체 경로 우선 매칭 유지) |
| `deploy` | `/02_배포_SEDMS` | 표준 · SEDMS Layer2 배포 타겟 |
| `dept` | `/03_부서공유` | 표준 |
| `ext_share` | `/04_외부공유` | 표준 |
| `r2mirror` | `/05_R2동기화` | 표준 · **읽기 전용 미러**(쓰기 ACL 부여 금지) |

신규 키는 `nas_acl` 에 행이 없으면 `accessFor` 기본값 `HIDDEN` 이라 등록 전까지 자동 차단된다 → 안전한 additive.
프로젝트 코드 매핑(`dk22k-fd` ↔ `32-동국 22K` 등)은 폴더**명** 수준 데이터라 코드 상수로 박지 않는다(구서버 이관이 진행 중 = 값이 변한다). `NAS_PROJECT_CODE_MAP.md` 를 SoT로 두고, 필요 시 D1 테이블로 올린다.

## 7. 검증 상태

| 항목 | 결과 |
|---|---|
| `sgw-nas-local.js` 로직 (mock FS API + mock IndexedDB) | **51/51 PASS** — 파일명 위생·경로탈출·덮어쓰기 증분·목록 스키마·폴백 판정·전 API reject 0 |
| `POST /api/nas/audit` (mock D1) | **14/14 PASS** — RW/RO/HIDDEN 판정, 거부 기록, unmapped 기록, 입력검증 |
| `nas-map.js` 셀프체크 | 모듈 로드 시 실행(순서 회귀 시 즉시 throw) |
| 실제 폴더 선택·NAS 쓰기 | ❌ **미검증 — 브라우저에서만 가능. 마스터 확인 항목**(§8) |

## 8. 마스터 확인 항목 (브라우저 필요)

1. Chrome/Edge 에서 `showDirectoryPicker` 로 NAS 매핑드라이브(또는 `\\<NAS주소>\SEASTAR`)를 실제로 선택할 수 있는지 — **UNC 경로가 탐색기 대화상자에서 선택 가능한지**가 관건.
2. 새로고침 후 권한 자동 유지 여부(핸들 영속은 되지만 브라우저 정책상 재확인을 요구할 수 있음).
3. 쓰기 실제 반영 + `_v2` 증분 동작.
