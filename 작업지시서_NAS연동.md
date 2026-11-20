# 작업지시서 — SWGS ↔ SEASTAR NAS 파일 접근 연동 (권한 기반)

> 작성 2026-07-10 · 대상 프로젝트 `E:\code-project\swgs` (sgw.seastar.work)
> 목표: 직원이 SWGS 로그인 1회로 **자기 권한에 맞는 NAS 폴더를 내 PC 탐색기처럼** 열람·복사·이동·수정.
> 원칙: **비밀번호·토큰은 코드/화면에 노출 0** — 관리자가 Secret으로 일괄 세팅. 접근권한은 **관리자가 스위치처럼 일괄 토글**.

---

## 0. 한 줄 요약

```
[직원] ─로그인(JWT/RBAC)─> [SWGS Functions] ─Cloudflare Tunnel─> [nas.seastar.work] ─> [DSM FileStation API] ─> 볼륨
                                 │
                        권한 매트릭스(관리자 스위치) + DSM 폴더 ACL(백스톱)  ← 이중 방어
```

- 앱단 권한(SWGS RBAC + 폴더 매트릭스)과 NAS 폴더 ACL이 **이중**으로 막아 안전.
- 관리자는 SWGS 관리화면에서 **역할×폴더 스위치**만 켜고 끔. 직원은 비번·토큰을 볼 일 없음.

---

## 1. 선결 조건 (관리자가 일괄 세팅 — 값은 절대 코드에 안 넣음)

| # | 항목 | 설정 위치(경로) | 관리자 액션 | 노출 여부 |
|---|------|----------------|-------------|-----------|
| 1 | NAS 외부 연결 | Cloudflare Zero Trust → Networks → Tunnels | 터널 `seastar-nas` 생성 → Public Hostname `nas.seastar.work` → Service `HTTPS localhost:5001` (No TLS Verify) | 터널 토큰은 Container Manager에만 입력 |
| 2 | NAS 서비스 계정 | DSM → 제어판 → 사용자 및 그룹 | 전용 계정 `nas-api` 생성: administrators **아님**, FileStation 권한만, 2FA off, 사내 IP·터널 IP만 허용 | 비밀번호 노출 X |
| 3 | Secret 등록 | 터미널: `npx wrangler pages secret put <NAME> --project-name sgw-seastar-work` | 아래 3개 Secret 입력(값은 관리자만 타이핑) | CF Pages Secret에만 저장 |

**등록할 Secret 이름 (값 아님):**

```
NAS_BASE_URL      = https://nas.seastar.work        (공개 가능, 값 노출 무해)
NAS_SVC_ACCOUNT   = nas-api                          (계정명)
NAS_SVC_PASSWORD  = ********                          ← 관리자만 입력, 화면·코드·깃 금지
```

> 코드에는 `env.NAS_SVC_PASSWORD` 처럼 **참조만** 한다. 실제 값은 Cloudflare Secret 저장소에만 존재.

---

## 2. 권한 모델 — "스위치처럼" (관리자 일괄 토글)

### 2-1. RBAC 확장 (`functions/_lib/rbac.js`)
기존 `ROLE_PERMISSIONS`에 `nas.*` 네임스페이스 추가:

```
nas.read      : 폴더/파일 목록·미리보기
nas.download  : 다운로드
nas.write     : 업로드·수정·이름변경
nas.move      : 복사·이동
nas.delete    : 삭제(휴지통)
nas.admin     : 폴더 권한 매트릭스 편집(= 스위치 조작)
```

역할별 기본값(예): `owner=*`, `admin=nas.*`, `engineer=read/download/write/move(담당 폴더)`, `viewer=read(저해상도/읽기전용)`.

### 2-2. 폴더 접근 매트릭스 (DB — sgw-admin D1)
테이블 `nas_acl` — **관리자가 화면 스위치로 채우는 표**:

| 컬럼 | 예 | 의미 |
|------|-----|------|
| `subject_type` | role \| dept \| user | 대상 종류 |
| `subject` | engineer / 설계부 / kohyk | 대상 |
| `folder_key` | proj_active / proj_done / share / ext / admin | 논리 폴더 |
| `level` | RW \| RO \| HIDDEN | 접근 수준 |

우선순위: **user > dept > role**, 그리고 **HIDDEN > RW > RO**. NA(접근불가)는 매트릭스에 없음 = 기본 차단.

---

## 3. NAS 폴더 경로 매핑 (확정 구조 — 최대 통합)

| 논리 folder_key | 실제 NAS 경로 | 기본 접근 |
|-----------------|---------------|-----------|
| `proj_active` | `/01_프로젝트/진행중/<프로젝트명>` | 담당 그룹만 RW (진행중만 세밀 권한) |
| `proj_done` | `/01_프로젝트/완료` | 전 직원 RO(읽기전용 아카이브) ※권장 |
| `share` | `/02_공유` | 전 직원 RW |
| `ext` | `/03_외부공유/<회사>` | 링크 방식(외부인), 직원 RW |
| `admin` | `/09_관리자` | 관리자만 RW (앱에서 HIDDEN) |

> FileStation API 경로는 실제 경로를 그대로 사용. `folder_key`↔실제경로 매핑은 서버 상수(`functions/_lib/nas-map.js`)에 둔다.

---

## 4. 백엔드 구현 (`functions/api/nas/`)

공통: 모든 엔드포인트는 `readAuth()`로 사용자 확인 → `nas_acl` 매트릭스 조회 → 허용 시에만 FileStation 호출. 서비스 계정 세션(sid)은 서버가 관리(직원에게 노출 X).

| 엔드포인트 | 메서드 | 권한 | FileStation 매핑 |
|-----------|--------|------|------------------|
| `/api/nas/list` | GET | nas.read | `SYNO.FileStation.List` |
| `/api/nas/download` | GET | nas.download | `SYNO.FileStation.Download` |
| `/api/nas/thumb` | GET | nas.read | `SYNO.FileStation.Thumb` |
| `/api/nas/upload` | POST | nas.write | `SYNO.FileStation.Upload` |
| `/api/nas/rename` | POST | nas.write | `SYNO.FileStation.Rename` |
| `/api/nas/copymove` | POST | nas.move | `SYNO.FileStation.CopyMove` |
| `/api/nas/delete` | POST | nas.delete | `SYNO.FileStation.Delete` |
| `/api/nas/acl` | GET/POST | nas.admin | `nas_acl` 매트릭스 read/write |

- 서버는 요청 경로가 매트릭스에서 허용된 `folder_key` 하위인지 **경로 화이트리스트 검증**(디렉터리 탈출 `..` 차단).
- 서비스 계정 로그인: `SYNO.API.Auth` (env 값 사용, 응답 sid는 서버 메모리/KV 캐시, 만료 시 재로그인).

---

## 5. 프론트엔드 — 탐색기 UI (`components/NasExplorer.tsx`)

내 PC 탐색기처럼 동작:

- **왼쪽**: 폴더 트리(권한상 보이는 것만; HIDDEN은 아예 안 뜸).
- **오른쪽**: 파일 목록(이름/크기/수정일/형식), 더블클릭 미리보기.
- **툴바**: 업로드·다운로드·복사·이동·이름변경·삭제 — 버튼은 **권한에 따라 자동 비활성화**(RO면 읽기 버튼만).
- **드래그&드롭** 업로드/이동, 다중선택, 빵부스러기 경로.
- RO 폴더는 편집 버튼 회색, RW 폴더는 전부 활성.

> 기존 `components/`(AdminUsers·Board 등)와 같은 디자인 토큰(Pretendard·Tailwind) 사용. 모바일은 `sgw_flutter`에 동일 API로 별도 화면.

---

## 6. 관리자 권한 스위치 화면 (`sgw-admin` 또는 SWGS admin 탭)

"전체 접근권한을 스위치처럼 일괄" 요구 반영:

- **역할×폴더 매트릭스 그리드**: 행=역할/부서/직원, 열=폴더(proj_active/done/share/ext/admin), 셀=토글(RW·RO·숨김).
- **일괄 스위치**: 열 헤더 클릭 → 그 폴더를 전 직원 RO/RW로 한 번에. 행 클릭 → 그 대상의 전 폴더 일괄.
- **진행중 프로젝트 배정**: 프로젝트 선택 → 담당자 체크 → 저장하면 해당 `proj_active` 폴더에 RW 부여.
- 저장 시 `POST /api/nas/acl` → `nas_acl` 테이블 갱신 + 감사 로그.
- (선택) DSM 폴더 ACL도 동기화하려면 관리자 승인 후 별도 배치(백스톱 일치).

---

## 7. 보안 규칙 (필수 · 위반 시 봉인 불가)

1. **시크릿 노출 0**: NAS 계정·비번·토큰은 CF Pages Secret에만. 코드/깃/로그/프론트 응답에 절대 포함 금지. 직원 화면엔 파일만 보이고 자격증명은 안 보임.
2. **관리자 일괄 세팅**: Secret 등록·권한 매트릭스는 관리자(owner/admin)만. 직원은 부여된 접근만 사용.
3. **경로 화이트리스트**: 서버가 `folder_key` 매핑 밖 경로·`..` 탈출 차단.
4. **최소 권한 서비스 계정**: `nas-api`는 FileStation 권한만, administrators 아님, 사내/터널 IP 제한.
5. **감사 로그**: 모든 업로드/이동/삭제/권한변경을 `_lib/audit.js`로 기록(누가·언제·무엇을·어느 파일).
6. **세션·CSRF·rate-limit**: 기존 `_lib/refresh.js`·`rate-limit.js` 재사용. 삭제는 확인 모달 + 휴지통(복구 가능).
7. **전송 암호화**: 전 구간 HTTPS(터널 포함).

---

## 8. 마일스톤 / 산출물

| 단계 | 산출물 | 완료 기준 |
|------|--------|-----------|
| M1 선결 | 터널 nas.seastar.work · nas-api 계정 · Secret 3종 | `curl https://nas.seastar.work` 200, 서비스계정 로그인 OK |
| M2 백엔드 | `functions/api/nas/*` + `_lib/nas-map.js` + `nas_acl` 테이블 | 권한별 list/download/upload/move/delete 동작 |
| M3 매트릭스 | 관리자 스위치 UI + `/api/nas/acl` | 관리자가 토글→저장→즉시 반영 |
| M4 탐색기 | `components/NasExplorer.tsx` | 탐색기처럼 복사·이동·수정, 권한별 버튼 제어 |
| M5 모바일 | `sgw_flutter` NAS 화면 | 동일 API로 폰에서 열람·업/다운 |
| M6 검증 | 역할 5종 시나리오 테스트 + 감사로그 확인 | viewer=읽기만, engineer=담당RW, admin=전체 통과 |

---

## 9. 관리자 세팅 체크리스트 (경로 포함 · 값 노출 없음)

```
[ ] 1. Cloudflare Zero Trust → Networks → Tunnels → 터널 seastar-nas 생성
       → Public Hostname: nas.seastar.work → HTTPS localhost:5001 (No TLS Verify)
[ ] 2. NAS Container Manager → cloudflare/cloudflared 컨테이너에 터널 토큰 입력(관리자만)
[ ] 3. DSM → 제어판 → 사용자 및 그룹 → 계정 nas-api 생성
       (FileStation 권한만 / 2FA off / 사내·터널 IP만 허용)
[ ] 4. 터미널에서 Secret 3종 등록 (값은 관리자가 직접 타이핑):
       npx wrangler pages secret put NAS_BASE_URL     --project-name sgw-seastar-work
       npx wrangler pages secret put NAS_SVC_ACCOUNT   --project-name sgw-seastar-work
       npx wrangler pages secret put NAS_SVC_PASSWORD  --project-name sgw-seastar-work
[ ] 5. sgw-admin 권한 매트릭스 화면에서 역할×폴더 스위치 세팅 → 저장
[ ] 6. 직원 1명으로 로그인 → NasExplorer에서 권한대로 보이는지 테스트
```

---

## 10. 의존 관계 / 참고

- 본 기능은 **nas.seastar.work 터널**이 선결(그룹웨어는 클라우드, NAS는 사내). 터널 없으면 클라우드 함수가 NAS에 못 닿음.
- 권한 매트릭스는 NAS 폴더 ACL(제어판에서 그룹 기반으로 이미 설계)과 **일치**시키는 것을 권장(이중 방어).
- 관련 문서: NAS측 `SEDMS_SEASTAR_연동_아키텍처.md`, `SEASTAR_운영매뉴얼.md`(폴더·권한), 본 프로젝트 `CLAUDE.md`(RBAC·배포).
- 기존 RBAC(`_lib/rbac.js`)·감사(`_lib/audit.js`)·레이트리밋(`_lib/rate-limit.js`)·인증(`readAuth`) **재사용** — 새 인증체계 만들지 말 것.

> 끝. 이 지시서대로면 직원은 SWGS 로그인 한 번으로 권한에 맞는 NAS를 탐색기처럼 쓰고, 관리자는 스위치로 전권을 통제하며, 비밀번호는 아무 데도 노출되지 않는다.

---

## 11. 이중 앱 통합 — SWGS + SEDMS 공유 (NAS = 중앙 원본 저장소)

두 앱이 **같은 NAS**를 공유. NAS=유일 원본, R2=게시본.

```
[SWGS 직원]  ┐
             ├─ nas.seastar.work(터널) ─ DSM FileStation ─ NAS 볼륨(원본)
[SEDMS 도면] ┘                                                │
                                          배포: R2 게시본 + secure-download + 메일 일괄
```

- **접근 계층 1개**: 두 앱 모두 같은 터널·`nas-api`·`nas_acl` 매트릭스 공유 → 권한 앱별로 안 갈림.
- **원본은 NAS, 게시본만 R2**: 배포 시에만 R2로 복사. 원본 도면은 NAS에 보존(스냅샷·백업 대상).

| SEDMS 동작 | 경로/방식 |
|------|-----------|
| 도면 저장(원본) | `/01_프로젝트/진행중/<프로젝트>/도면/` |
| 도면 열람 | 담당자 권한(nas_acl)로 NAS 직접 |
| 배포(내부) | NAS 공유링크 or SWGS 탐색기 |
| 배포(외부인) | NAS 원본 → R2 게시본 → secure-download 링크/메일 (원본 비노출) |
| 완료 프로젝트 | `/01_프로젝트/완료/` 이동 → 전직원 RO |

---

## 12. 관리자 콘솔 — "초간단·직관적" 설계 (핵심 요구)

> 슈퍼관리자가 **기술 몰라도**, 프리셋 버튼·스위치·자연어·마법사로 전부 처리. ACL을 직접 손대는 일이 없어야 함.

### 12-1. 원클릭 프리셋 (자주 하는 일 = 버튼 1개)
| 버튼 | 자동 실행 내용 |
|------|----------------|
| **＋ 새 직원 온보딩** | users 그룹 추가 · 기본 폴더 접근 · 개인 메일함 폴더 생성 · 초기비번 발급 |
| **＋ 새 프로젝트 시작** | `진행중/<프로젝트>` 폴더 + `proj_<이름>` 그룹 생성 + 담당자 체크 배정 (한 화면) |
| **✔ 프로젝트 종료** | `완료`로 이동 + 전 직원 RO 전환 (한 번에) |
| **＋ 외부 협력사 추가** | 회사 폴더 + 공유링크(비번·만료) 생성 |

### 12-2. 권한 = 스위치 그리드 (한눈에)
- 행=사람/역할/부서, 열=폴더. 셀 토글: **초록 RW / 파랑 RO / 회색 숨김**.
- **열 헤더 클릭** = 그 폴더를 전원 일괄. **행 클릭** = 그 사람 전 폴더 일괄.
- 저장 = 즉시 반영 + 감사 로그. 되돌리기 버튼.

### 12-3. 자연어 액션바
- 상단 검색창: `"김미진 동국22K 넣어줘"` → 실행. (또는 에이전트에게 위임 → 브라우저로 대행)

### 12-4. 기술 세팅은 1회성 마법사
- 터널·시크릿 등록을 **단계 카드 + [복사] 버튼 + 상태등(초록✔/빨강✖)**. 안 되면 "무엇을 하라"까지 안내. 다 되면 초록 체크.

### 12-5. 위험 작업 가드
- 삭제·권한 회수·프로젝트 종료는 **확인 모달 + 되돌리기**(휴지통/스냅샷). 실수해도 복구 가능.

> 원칙: 관리자는 "**버튼·스위치·검색**"만. 폴더 경로·ACL·시크릿은 시스템이 뒤에서 처리.
