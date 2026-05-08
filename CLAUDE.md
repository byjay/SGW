# Seastar Groupware (SGW) — Claude 세션 인계 노트

> 이 파일은 다음 Claude 세션이 즉시 작업을 이어갈 수 있도록 현재 상태를
> 정리한 핸드오프 문서입니다. 새 대화 시작 시 가장 먼저 읽어주세요.

---

## 📌 프로젝트 개요

**Seastar Groupware (SGW)** — 사내 직원용 그룹웨어 + 브라우저 확장앱

| 구성 | 위치 | 역할 |
|------|------|------|
| **본체 (Vite + React)** | `E:\code-project\swgs\` (루트) | 그룹웨어 React 앱 → CF Pages |
| **확장 v1.0.4** | `extension/` | 사이드 패널 + 영구 로그인 + 알림 |
| **설치기** | `installer/` | 사용자 PC 자동 설치 (.bat + ZIP) |
| **Private Key** | `.keys/swgs.pem` | CRX 서명 (gitignored, **절대 공유 금지**) |

---

## 🌐 배포된 URL (전부 활성)

| 자원 | URL | 비고 |
|--|--|--|
| **그룹웨어 본체** | https://sgw-seastar-work.pages.dev/ | React 앱 (기존) |
| **확장 자동 업데이트** | https://swgs-internal.pages.dev/ | CRX + updates.xml |
| **사용자 설치기** | https://sgw-install.pages.dev/ | ZIP 다운로드 + 안내 |
| **GitHub** | https://github.com/byjay/SGW | extension/ + installer/ |

**Extension ID**: `ajlojcldaocimafbolojgokhpdfhkpkb` (영구 고정)

---

## ✅ 하던 일 (완료된 작업)

### 1. 확장앱 v1.0.4 (extension/)
- ✅ MV3 매니페스트 + update_url
- ✅ 사이드 패널 4-tab UI (알림 / 메뉴 / 연차 / SEDMS)
- ✅ **영구 로그인** (chrome.storage 자동 복원, 쿠키 청소에도 유지)
- ✅ **연차 신청 폼 제출 자동 감지**
- ✅ **쪽지 도착 DOM Mutation Observer** (발신자 표시)
- ✅ 4종 알림 차별화 (📢 공지 / 🌴 연차 / 💬 쪽지 / ✍️ 결재)
- ✅ 30분 자동 업데이트 (`chrome.runtime.requestUpdateCheck()` 강제 트리거)
- ✅ 10개 페이지 빠른 메뉴 (홈/공지/메시지/채팅/연차/결재/캘린더/메일/SEDMS/관리자)
- ✅ 8개 Chromium 브라우저 호환 (Chrome/Whale/Edge/Brave/Opera/Vivaldi/Yandex/Chromium)

### 2. 자동 배포 인프라
- ✅ `build.ps1` (forward-slash safe ZIP)
- ✅ `build-crx.ps1` (Chrome `--pack-extension` 서명)
- ✅ `deploy-cf.ps1` (CF Pages 자동 배포)
- ✅ `get-crx-id.cjs` (Extension ID 계산)
- ✅ `install-internal.bat` (사내 PC 정책 1회 등록)

### 3. 사용자 설치기 (installer/)
- ✅ `Install-SGW.bat` — 8개 브라우저 정책 동시 등록
- ✅ `Uninstall-SGW.bat` — 정책 제거
- ✅ `index.html` — 랜딩 페이지 (파란 테마)
- ✅ `deploy.ps1` — sgw-install.pages.dev 배포
- ✅ 자동 닫힘 방지 (PAUSE 모든 분기에)
- ✅ Self-contained (외부 install.bat 의존 제거)

### 4. 폴더 구조 정리 (2026-05-08)
- ✅ SDU 프로젝트와 완전 분리
  - 이전: `E:\code-project\SDU\swgs_app\` + `_installer-sgw\` + `_keys\swgs.pem`
  - 현재: `swgs/extension/` + `swgs/installer/` + `swgs/.keys/swgs.pem` (자체 완결)
- ✅ GitHub `byjay/SGW` repo에 push 완료 (commit b870e55)

---

## 🔜 할 일 (다음 세션 작업 목록)

### 우선순위 높음

- [ ] **★ SEDMS SSO 통합 (핵심 비전)**
  - **목표**: 직원이 SGW 사원번호로 한 번 로그인 → **자동으로 SEDMS 진입** (재로그인 X)
  - **사용자 시나리오**:
    1. 직원이 도구 모음 ⭐ 클릭 → 사이드 패널
    2. 사원번호 + 비밀번호 입력 (또는 영구 로그인 자동 인식)
    3. [📂 SEDMS] 클릭 또는 자동 redirect
    4. SEDMS가 이미 로그인된 상태로 열림 (SSO)
  - **기술 옵션 (택일/병행)**:
    1. **SAML / OAuth 정식 SSO**: 회사 IDP 있으면 가장 깨끗 (best practice)
    2. **JWT 브릿지**: SGW 로그인 시 발급된 토큰을 SEDMS의 `Authorization: Bearer` 헤더로 주입 (declarativeNetRequest 활용)
    3. **Cookie 공유**: 두 도메인이 sub/super 관계면 도메인 쿠키로 자동 전달
    4. **확장이 자동 로그인 폼 채움**: SEDMS 로그인 페이지 도착 시 content script가 사원번호+비밀번호 자동 입력 후 submit (가장 간단, IDP 없을 때)
  - **확장에 필요한 변경**:
    - `manifest.json` `host_permissions`에 SEDMS 도메인 추가
    - `content_scripts.matches`에 SEDMS 추가 (로그인 페이지 후킹용)
    - `content/sedms-bridge.js` (신규) — SEDMS 페이지 진입 시 자동 인증 처리
    - `background/service-worker.js`에 `case 'SWGS_OPEN_SEDMS'` 핸들러 추가
    - `lib/storage.js` `DEFAULTS.sedms_host` 실제 URL로 갱신
  - **선결 사항**:
    - SEDMS 인증 방식 확인 (자체 ID/PW vs SGW 통합)
    - 회사 IDP/SSO 인프라 존재 여부
    - SEDMS 도메인 + 로그인 페이지 URL
    - SGW와 SEDMS의 사원번호 동일 사용 여부

- [ ] **그룹웨어 본체 ↔ 확장 실 데이터 연동 검증**
  - 본체는 현재 MockServer 사용 중 (`services/mockServer.ts`)
  - 확장은 `auth-bridge.js`로 localStorage 동기화 가정
  - 실제 회사 그룹웨어 API 연결 시 endpoint 매핑 필요
  - `gw_host` 변경: `lib/storage.js`의 `DEFAULTS.gw_host`

- [ ] **SEDMS 실제 URL 확인 후 반영**
  - 현재: `https://sedms.seastar.co.kr/` (placeholder)
  - 사이드 패널의 [📂 SEDMS 열기] 링크 + 매뉴얼 갱신
  - 위 SSO 통합 항목과 함께 진행

- [ ] **사내 정식 IT 배포 테스트**
  - 직원 PC 1대에서 `Install-SGW.bat` 검증
  - 8개 정책 등록 확인 → 브라우저 재시작 → 자동 설치 확인
  - 문제 발생 시 매뉴얼/FAQ 추가

### 우선순위 중간
- [ ] **쪽지 알림 정확도 향상**
  - `page-bridge.js`의 MutationObserver는 SGW의 React 렌더링 패턴에 따라 false positive 가능
  - 실제 쪽지 페이지 DOM 구조 분석 후 셀렉터 정밀화
  - 현재: `[data-message-id], .message-item, .msg-item, .chat-message, [class*="MessageItem"]`

- [ ] **연차 신청 감지 휴리스틱 개선**
  - 현재 폼 submit 이벤트 + URL 패턴 휴리스틱
  - SGW의 LeaveManagement.tsx 컴포넌트 분석해서 이벤트 명시적으로 후킹

- [ ] **AI 요약 기능 비활성/활성**
  - 현재 sidepanel은 SDU Master에 있던 AI 탭 일부 코드 흔적
  - SGW에는 불필요 → 제거 또는 회의록 요약 기능으로 재활용

- [ ] **알림 사운드 옵션**
  - 현재 chrome.notifications `silent: false` (기본 사운드)
  - 옵션 페이지에서 사운드 ON/OFF 토글 추가

### 우선순위 낮음 (미래 기능)
- [ ] **다중 계정 지원** — 사원번호 여러 개 전환
- [ ] **알림 기록 보관함** — 받은 알림 7일 이력
- [ ] **위젯 모드** — 사이드 패널 외 작은 PIP 창
- [ ] **모바일 동기화** — chrome.storage.sync 활용
- [ ] **알림 일정 설정** — 점심시간/퇴근 후 알림 OFF

### 운영 태스크
- [ ] **공식 매뉴얼 작성** — `installer/manual.html` 제작
- [ ] **운영 가이드** — IT 관리자용 (정책 일괄 배포, 문제 해결)
- [ ] **버전 정책** — 메이저/마이너 변경 기준 정의
- [ ] **CHANGELOG.md** — 버전별 변경 이력

---

## 🎯 향후 SSO 비전 (SGW + SEDMS 통합)

```
[직원 PC]
  ↓ 도구 모음 ⭐ 클릭
[Seastar GW 사이드 패널]
  ↓ 사원번호 한 번 로그인 (영구 유지)
  ↓ [📂 SEDMS] 클릭
[자동 SSO 처리 — 사용자 클릭 0회]
  ├─ Option 1: SAML/OAuth IDP 통한 정식 SSO
  ├─ Option 2: JWT 브릿지 (declarativeNetRequest 헤더 주입)
  ├─ Option 3: Cookie 공유 (도메인 sub/super)
  └─ Option 4: content script 자동 로그인 폼 채움
  ↓
[SEDMS — 이미 로그인된 상태로 진입]
  · 결재 / 문서 / 회람 즉시 사용 가능
  · 재로그인 불필요
```

**핵심 가치 제안**: "사원이 사내 시스템 N개 다닐 때마다 매번 로그인 안 함"
- SGW 사원번호 1회 로그인 → SEDMS / 그룹웨어 / 메일 / 캘린더 모두 자동 인증
- 도구 모음 ⭐ 한 번 → 회사의 모든 디지털 자산에 즉시 접근

---

## 🔧 빌드/배포 빠른 참조

### 일상 개발 흐름
```powershell
# 1. 확장 코드 수정
cd E:\code-project\swgs\extension
# 코드 변경...

# 2. 빌드 + 배포 (한 번에)
powershell -ExecutionPolicy Bypass -File deploy-cf.ps1
# → swgs-internal.pages.dev 갱신
# → 30분 내 사용자 PC에 자동 적용

# 3. 설치기 변경 시
cd ..\installer
powershell -ExecutionPolicy Bypass -File deploy.ps1
# → sgw-install.pages.dev 갱신

# 4. GitHub push
cd ..
git add .
git commit -m "..."
git push origin main
```

### 버전 올리기
```powershell
# extension/manifest.json 의 "version" 수동 수정
# 예: "1.0.4" → "1.0.5"
# 그 후 deploy-cf.ps1 실행 → 자동 배포
```

### Extension ID 재확인
```bash
cd extension
node get-crx-id.cjs
# 출력: ajlojcldaocimafbolojgokhpdfhkpkb
```

---

## 🔑 키 관리

`.keys/swgs.pem` (RSA private key, ~1.7 KB)
- **절대 GitHub에 커밋하지 말 것** (.gitignore 등록됨)
- 분실 시 Extension ID 변경 → 모든 PC 재설치 필요
- **반드시 별도 백업** (USB / 클라우드 비공개 폴더 권장)
- 새 키로 빌드 시 모든 정책 재배포 필요

---

## 📞 알려진 이슈 / FAQ

### Q. 사용자 PC에서 설치가 안 됨
- UAC 거부 → `Install-SGW.bat` 우클릭 → "관리자 권한으로 실행"
- 정책 등록 확인: `chrome://policy/` 또는 `whale://policy/`
- 정책 다시 로드 버튼 클릭

### Q. 확장 자동 업데이트가 안 옴
- 사이드 패널 [🔄 업데이트 확인] 클릭으로 강제 폴링
- `chrome://extensions/` → 우상단 [업데이트] 버튼

### Q. EXE로 만들었더니 Defender가 차단
- PS2EXE 결과는 false positive로 격리됨
- code-signing 인증서 없으면 .bat이 더 안정적
- 향후 인증서 도입 시 `Install-Seastar.ps1` (별도 보관) 활용 가능

### Q. 영구 로그인이 풀림
- 시크릿 모드 사용 시 풀림 (정상 동작)
- 브라우저 데이터 직접 삭제 시 풀림 → 그룹웨어 페이지 진입 시 자동 복원
- chrome.storage.local 직접 청소해도 풀림 → 같은 자동 복원 동작

---

## 📦 GitHub Repo 구조

```
byjay/SGW (main)
├── 본체 React 앱 (기존)
│   ├── App.tsx, components/, services/
│   ├── package.json, vite.config.ts
│   └── dist/ (빌드 산출물)
└── extension/ + installer/ (신규)
    └── ... (이 문서의 폴더 구조 참조)
```

마지막 commit: **b870e55** — "Refactor: Move extension + installer into swgs/ for self-contained dev"

---

## 🔄 다음 Claude 세션 시작 시 추천 첫 명령

```
1. 이 CLAUDE.md를 먼저 읽어주세요
2. git log --oneline -5 로 최근 변경 확인
3. extension/manifest.json 의 version 확인 (현재 1.0.4)
4. https://swgs-internal.pages.dev/version.json 으로 배포 상태 확인
5. 위 "할 일" 섹션 중 하나 골라서 진행
```

---

**최종 업데이트**: 2026-05-08
**작업자**: designsir + Claude (Sonnet)
**다음 마일스톤**: 사내 IT 배포 테스트 → 실제 직원 사용 시작
