# SGW — 작업지시서 (Claude 세션 인계)

> **새 세션 시작 시 이 파일을 가장 먼저 읽을 것.**
> 이 폴더(`E:\code-project\swgs`)는 **SGW 전용**. SDU·auth 코드와 완전 격리됨.

---

## 📌 프로젝트 구성

| 폴더/서비스 | 역할 | 배포 URL |
|-------------|------|----------|
| `extension/` | Chrome MV3 확장 (직원 사이드패널) | `swgs-internal.pages.dev` (CRX 자동배포) |
| `installer/` | 사내 PC 원클릭 설치 (.bat 런처) | `sgw-install.pages.dev` |
| `E:\code-project\sgw-admin\` | **별도 프로젝트** — 직원 DB 관리 (Cloudflare D1) | `sgw-admin.pages.dev` |
| `E:\code-project\auth\` | **별도 프로젝트** — Naver+Google OAuth 라이브러리 | standalone (복사해서 사용) |

> **격리 원칙**: `swgs/` 는 extension + installer만. sgw-admin·auth는 별도 폴더.

---

## 🔢 현재 버전

| 항목 | 값 |
|------|-----|
| Extension 버전 | **v1.0.8** (빌드·CRX·실Chrome로드 검증 + **swgs-internal.pages.dev 배포 완료 LIVE**) |
| Extension ID | `ajlojcldaocimafbolojgokhpdfhkpkb` (영구 고정 · v1.0.8에서도 ID 유지 확인) |
| 정식 도메인 | **`sgw.seastar.work`** (CF Pages 커스텀 도메인 active/cert active — API 확인 2026-07-06). 프로젝트 내부명 `sgw-seastar-work.pages.dev` |
| 관리자 시스템 | `sgw-admin.pages.dev` (D1 + Pages Functions) |
| **SEDMS 실제 URL** | **`http://dms.seastar.work`** (그룹웨어 appConfig.EXTERNAL.DMS_URL 기준 — 기존 `sedms.seastar.co.kr`는 오기, v1.0.8에서 정정) |
| 마지막 업데이트 | 2026-06-25 |

---

## ✅ 완료된 작업 (누적)

### Extension (v1.0.8) — 2026-06-25 (SDU 참조 완성판)
- **★ SEDMS URL 정정**: `sedms.seastar.co.kr`(오기) → **`http://dms.seastar.work`** (그룹웨어 본체 appConfig 기준). manifest host_permissions/content_scripts, storage.js, sidepanel 메뉴카드, auth-bridge 감지 전부 일괄 수정.
- **★ 연차 탭 실데이터 구현**: 그룹웨어 localStorage(`app_users`/`app_leave_requests`)를 content script(auth-bridge.js)가 chrome.storage로 스냅샷 → 사이드패널이 총/사용/잔여 연차 + 최근 신청내역(상태 뱃지) 렌더. (placeholder "로딩 중..." 제거)
- **★ SEDMS 대기결재 실데이터**: `app_approvals`에서 본인(approverId) pending 결재만 추려 사이드패널에 목록 렌더. (placeholder 제거)
- **★ 설정(Options) 페이지 신설**: `options/options.html`+`options.js` — 그룹웨어/SEDMS 주소, OS알림 on/off, 폴링주기(1~30분) 설정. 저장 시 SW가 alarm 주기 재생성(`SWGS_APPLY_SETTINGS`).
- **★ 빠른 접근**: 단축키 `Ctrl+Shift+S`(SEDMS) / `Ctrl+Shift+G`(그룹웨어) + 확장아이콘 우클릭 메뉴(contextMenus).
- **★ BUG FIX**: build.ps1 `$includePatterns`에 `options/*` 누락 → 추가(없으면 options_page 참조 깨짐).
- 검증: manifest JSON 유효 · 전 JS `node --check` 통과 · manifest 참조파일 12/12 존재 · vm 샌드박스 런타임 스모크(전 모듈 로드+SW 리스너 등록) 통과 · 연차/결재 계산 assert 통과 · 실제 Chrome 헤드리스 로드 에러 0 · `--pack-extension` 정상 패킹 · Extension ID 유지 확인.
- **★ 배포 LIVE (2026-06-25)**: CF Pages `swgs-internal` 프로젝트 신규 생성 후 배포. 라이브 확인 — `/`(랜딩 다운로드) 200 · `version.json` 200 · `updates.xml` 200 · `swgs-latest.crx` 200 · `swgs-latest.zip` 200 · `install-internal.bat` 200. 직원 PC는 `install-internal.bat`(Chrome/Whale/Edge 강제설치 정책) → 30분 내 자동 업데이트.

### Extension (v1.0.7)
- MV3 Manifest + `update_url` (자동 업데이트)
- 사이드패널 4탭 UI (알림/메뉴/연차/SEDMS)
- **★ Phase 4**: 사이드패널 로그인 폼 → `sgw-admin.pages.dev/auth/employee-login` API 연동
  - 사원번호 + 비밀번호 입력 → JWT → chrome.storage 저장
- **★ BUG FIX**: `attachUI()` dead-code 버그 수정 (UI 이벤트가 연결 안 되던 문제)
- 영구 로그인 자동 복원 (`auth-bridge.js`: chrome.storage → SGW localStorage 재주입)
- 원클릭 자동 업데이트 버튼 (`⚡ 지금 업데이트`)
- 정식 도메인 `sgw.seastar.work` 단일 연결 (CF Pages 빌드 주소 fallback 제거)
- `SWGS_AUTO_UPDATE_NOW` 메시지 핸들러 (service-worker)

### sgw-admin (`E:\code-project\sgw-admin\`)
- Cloudflare D1 (`sgw-employees` DB) + Pages Functions
- 관리자 로그인 (PBKDF2 해시 + JWT HttpOnly 쿠키)
- 직원 CRUD API (사원번호/이름/전화/이메일/부서/직책)
- **직원 로그인 API**: `POST /auth/employee-login` (사원번호+비밀번호 → JWT 7일)
- 감사 로그 (모든 CRUD/로그인 DB 기록)
- **JWT_SECRET** Cloudflare Pages Secret 등록 완료
- 단일 페이지 관리자 UI (`public/index.html`)

### 설치기 (installer/)
- `Install-SGW.bat` → 런처 패턴 (서버에서 PS1 내려받아 실행)
- 8개 Chromium 브라우저 정책 동시 등록
- `Force-Update-SGW.bat` — 강제 업데이트

### auth 라이브러리 (`E:\code-project\auth\`) — 완전 독립 프로젝트
- Naver + Google OAuth (CF Pages Functions, npm 의존성 0)
- 단순 로그인 + **승인 플로우** (가입신청 → 관리자 승인) 두 가지 버전
- AI 에이전트 통합 가이드 (`AGENT-GUIDE.md`)
- `/oauth-cf` 스킬로 어느 CF Pages 프로젝트에나 자동 주입 가능

---

## 🔜 다음 세션 작업 목록 (우선순위 순)

### ★ P1 — sgw-admin 초기 설정 (마스터가 직접)
```
1. https://sgw-admin.pages.dev 접속
2. 관리자 계정 설정 (최초 1회, /auth/setup)
3. 직원 등록 (사원번호 + 이름 + 비밀번호)
4. 직원 PC에서 확장 사이드패널 로그인 테스트
```
- **이게 안 되면 아무것도 동작하지 않음** — 최우선

### ★ P2 — SEDMS SSO (핵심 비전)
- 사원번호 1회 로그인 → SEDMS 자동 진입 (재로그인 없음)
- 구현 옵션 (선택):
  1. `declarativeNetRequest`로 Authorization 헤더 주입 (가장 깨끗)
  2. content script로 SEDMS 로그인 폼 자동 채움 (빠름)
  3. 도메인 쿠키 공유 (seastar.co.kr 하위 도메인이면)
- 선결: SEDMS 실제 URL + 인증 방식 확인

### P3 — Extension v2.0.0 (직원 전용 데스크탑 워크스페이스)
- `manifest.json` v2.0.0, name "Seastar Workspace"
- `chrome.commands` — `Ctrl+Shift+S` → SEDMS 새창 / `Ctrl+Shift+G` → 그룹웨어
- `chrome.windows.create({ type: 'popup', state: 'maximized' })` — standalone 진입
- `chrome.contextMenus` — 우클릭 메뉴 (SEDMS 새 창, 그룹웨어 새 창)
- 5탭 UI (알림/메뉴/연차/SEDMS/그룹웨어)
- 디자인 토큰 통일 (Vantablack, Pretendard, Solar 아이콘)

### P4 — Naver/Google OAuth 연동 (선택 — auth 라이브러리 사용)
- sgw.seastar.work 또는 sgw-admin에 소셜 로그인 추가 필요 시
- `E:\code-project\auth\AGENT-GUIDE.md` 읽고 `/oauth-cf` 스킬 실행
- Naver 앱: `https://developers.naver.com/apps` (앱 1개, 콜백 URL만 추가)
- Google 앱: `https://console.cloud.google.com/apis/credentials`

### P5 — 운영 안정화
- 직원 PC 1대에서 `Install-SGW.bat` → 정책 등록 → 자동 설치 검증
- `chrome://policy/` 에서 8개 정책 등록 확인
- 알림 false positive 줄이기 (page-bridge.js MutationObserver 셀렉터 정밀화)

---

## 🔧 개발 빠른 참조

### 확장 빌드 + 배포
```powershell
cd E:\code-project\swgs\extension
powershell -ExecutionPolicy Bypass -File deploy-cf.ps1
# → swgs-internal.pages.dev 갱신 → 30분 내 직원 PC 자동 업데이트
```

### 버전 올리기
```powershell
# extension/manifest.json "version" 수동 수정 후
powershell -ExecutionPolicy Bypass -File deploy-cf.ps1
```

### sgw-admin 재배포
```powershell
cd E:\code-project\sgw-admin
npx wrangler pages deploy public --project-name sgw-admin --commit-dirty=true
```

### 확장 Extension ID 확인
```powershell
cd extension; node get-crx-id.cjs
# 출력: ajlojcldaocimafbolojgokhpdfhkpkb
```

### 배포 상태 확인
```powershell
curl https://swgs-internal.pages.dev/version.json
curl https://sgw-admin.pages.dev/auth/status
```

---

## 📁 프로젝트 파일 구조 (핵심)

```
E:\code-project\swgs\            ← 이 프로젝트 (SGW 전용)
├── CLAUDE.md                    ← 지금 이 파일
├── extension/                   ← Chrome 확장 소스
│   ├── manifest.json            ← v1.0.7, ID: ajlojcldaocimafbolojgokhpdfhkpkb
│   ├── background/service-worker.js
│   ├── content/auth-bridge.js   ← SGW 페이지 ↔ chrome.storage 동기화
│   ├── content/page-bridge.js   ← 알림 가로챔 (React 주입)
│   ├── lib/storage.js           ← KEYS, DEFAULTS (gw_host, admin_host)
│   ├── sidepanel/sidepanel.js   ← UI 로직 + Phase 4 로그인 API 연동
│   ├── sidepanel/sidepanel.html ← 로그인 폼 (사원번호 + 비밀번호)
│   ├── build.ps1                ← ZIP 빌드
│   ├── build-crx.ps1            ← CRX 서명 빌드
│   └── deploy-cf.ps1            ← CF Pages 배포
├── installer/                   ← 사내 PC 설치기
│   ├── Install-SGW.bat          ← 런처 (.bat → PS1 서버에서 내려받아 실행)
│   └── Install-SGW.ps1          ← 실제 설치 로직 (서버 호스팅)
└── .keys/swgs.pem               ← CRX 서명 키 (gitignored, 절대 공유 금지)

E:\code-project\sgw-admin\      ← 직원 관리 시스템 (별도 프로젝트)
E:\code-project\auth\           ← OAuth 라이브러리 (별도 프로젝트, 공용)
```

---

## 🔑 보안 / 키 관리

| 항목 | 위치 | 주의 |
|------|------|------|
| CRX 서명 키 | `.keys/swgs.pem` | 분실 = Extension ID 변경 = 전 직원 재설치 |
| JWT_SECRET | CF Pages Secret (sgw-admin) | 등록 완료 (96자 랜덤 hex) |
| sgw-admin 비밀번호 | 마스터만 알고 있음 | `/auth/setup` 최초 1회만 가능 |

---

## ❓ 알려진 이슈 / FAQ

| 증상 | 원인 / 해결 |
|------|-------------|
| 설치 안 됨 | `Install-SGW.bat` 우클릭 → 관리자 권한으로 실행 |
| 자동 업데이트 안 옴 | 사이드패널 `⚡ 지금 업데이트` 클릭 |
| 로그인이 풀림 | 시크릿 모드 or 브라우저 데이터 삭제 → SGW 페이지 진입 시 자동 복원 |
| sgw-admin.pages.dev 접속 안 됨 | `setup_done: false` 상태 = 관리자 계정 미설정 → P1 작업 필요 |

---

## 🧭 새 세션 시작 시 첫 5분

```
1. 이 CLAUDE.md 읽기
2. git log --oneline -5         (최근 커밋 확인)
3. extension/manifest.json      (현재 버전 확인 = v1.0.7)
4. curl https://swgs-internal.pages.dev/version.json   (배포 상태)
5. curl https://sgw-admin.pages.dev/auth/status         (관리자 설정 여부)
6. 위 "다음 세션 작업 목록"에서 P1부터 착수
```

---

*최종 업데이트: 2026-05-14 | 작업자: designsir + Claude (Sonnet)*
