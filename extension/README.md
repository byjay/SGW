# Seastar Groupware - Browser Extension (v1.0.4)

> 그룹웨어와 통합되는 브라우저 사이드 패널 확장앱
> Chrome / Whale / Edge / Brave / Opera / Vivaldi / Yandex / Chromium 지원

## 핵심 기능

- ⭐ **사이드 패널** — 도구 모음 클릭 한 번으로 그룹웨어 통합 뷰
- 🔒 **영구 로그인** — 한 번 로그인 → chrome.storage 자동 복원, 쿠키 청소에도 유지
- 🔔 **실시간 알림** — 4종 (📢 공지 / 🌴 연차 / 💬 쪽지 / ✍️ 결재)
- 🌴 **연차 신청 감지** — 폼 제출 자동 감지 + 알림
- 💬 **쪽지 도착 감지** — DOM Mutation Observer로 실시간 + 발신자 표시
- 📋 **10개 페이지 빠른 접근** — 홈/공지/메시지/채팅/연차/결재/캘린더/메일(MailPlug)/SEDMS/관리자
- 🚀 **자동 업데이트** — 30분 폴링 + CF Pages → Chrome Web Store 우회 자동 적용
- 🏢 **사내 자동 배포** — `install.bat` 1회 실행으로 회사 전 PC 정책 등록

## 폴더 구조

```
extension/
├── manifest.json              MV3 매니페스트 + update_url
├── background/
│   └── service-worker.js      알림 폴링 + 자동 업데이트 + AI 메시지 허브
├── content/
│   ├── auth-bridge.js         그룹웨어 ↔ 확장 인증 동기화 (영구 로그인)
│   └── page-bridge.js         페이지 컨텍스트 알림 가로채기
├── sidepanel/
│   ├── sidepanel.html         3탭 UI (알림/메뉴/연차/SEDMS)
│   ├── sidepanel.css          다크 테마
│   └── sidepanel.js           로그인 + 카운트 + 업데이트 상태
├── icons/                     16/48/128 PNG
├── lib/
│   ├── messaging.js           공용 메시지 헬퍼
│   └── storage.js             chrome.storage Promise 래퍼
├── rules/                     declarativeNetRequest
├── build.ps1                  forward-slash safe ZIP 빌드
├── build-crx.ps1              CRX 서명 (Chrome --pack-extension)
├── deploy-cf.ps1              CF Pages 자동 배포
├── install-internal.bat       사내 자동 설치 정책
└── get-crx-id.js              Extension ID 계산 (.pem → SHA256 → a-p)
```

## 빌드 + 배포

```powershell
# 1. ZIP + CRX 빌드
powershell -ExecutionPolicy Bypass -File build.ps1
powershell -ExecutionPolicy Bypass -File build-crx.ps1

# 2. CF Pages 배포 (자동 업데이트 포함)
powershell -ExecutionPolicy Bypass -File deploy-cf.ps1
```

배포 결과:
- https://swgs-internal.pages.dev/ — 랜딩
- https://swgs-internal.pages.dev/swgs-latest.crx — 서명 패키지
- https://swgs-internal.pages.dev/updates.xml — 자동 업데이트 endpoint
- https://swgs-internal.pages.dev/version.json — 버전 정보

## 자동 업데이트

```
[개발자] deploy-cf.ps1 실행
  ↓ 30초 안에 CF Pages 배포
[사용자 PC] background SW 30분 폴링
  ↓ 새 버전 감지 → chrome.runtime.requestUpdateCheck()
  ↓ Chrome이 update_url 즉시 폴링 → CRX 자동 다운로드
  ↓ OS 알림 + [즉시 적용] 버튼
[사용자] 클릭 또는 다음 브라우저 시작 시 자동 활성화
```

## 사내 배포

IT 관리자가 각 PC에서 `install-internal.bat` 한 번만 관리자 권한으로 실행:
- 8개 Chromium 브라우저 정책 동시 등록 (Group Policy)
- `ExtensionInstallForcelist` + `ExtensionInstallSources`
- 이후 모든 업데이트는 백그라운드 자동 적용

## Extension ID

```
ajlojcldaocimafbolojgokhpdfhkpkb
```

(개인 키 `_keys/swgs.pem` 분실 시 ID 변경 + 모든 PC 재설치 필요. 절대 공유/커밋 금지)

## 보안

- API 키, JWT, 사용자 정보는 모두 `chrome.storage.local`에 로컬 저장
- 외부 서버 전송 없음 (그룹웨어 본체 sgw-seastar-work.pages.dev 통신만)
- declarativeNetRequest로 X-Frame-Options 등 일부 헤더 정책 우회 (사내 도메인 한정)
