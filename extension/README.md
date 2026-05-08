# Seastar Groupware - Browser Extension (v1.0.4)

> 그룹웨어 통합 사이드 패널 확장앱 — Chrome / Whale / Edge / Brave / Opera / Vivaldi / Yandex / Chromium

## 핵심 기능

- ⭐ **사이드 패널** — 도구 모음 클릭 한 번으로 그룹웨어 통합 뷰
- 🔒 **영구 로그인** — chrome.storage 자동 복원 (쿠키 청소에도 유지)
- 🔔 **실시간 알림** — 4종 (📢 공지 / 🌴 연차 / 💬 쪽지 / ✍️ 결재)
- 📋 **10개 페이지 빠른 접근** — 홈/공지/메시지/채팅/연차/결재/캘린더/메일/SEDMS/관리자
- 🚀 **30분 자동 업데이트** — CF Pages 빌드 → 자동 적용

## 자체 완결 폴더 구조

```
swgs/                                    ← 이 프로젝트 루트
├── extension/                           ← 확장 소스 (이 폴더)
│   ├── manifest.json                    MV3 + update_url
│   ├── background/service-worker.js
│   ├── content/{auth-bridge,page-bridge}.js
│   ├── sidepanel/{html,css,js}
│   ├── icons/                           16/48/128 PNG
│   ├── lib/{messaging,storage}.js
│   ├── rules/bypass.json
│   ├── build.ps1                        ZIP 빌드 (forward-slash safe)
│   ├── build-crx.ps1                    CRX 서명 (Chrome --pack-extension)
│   ├── deploy-cf.ps1                    CF Pages 자동 배포
│   ├── install-internal.bat             사내 정책 1회 등록
│   └── get-crx-id.cjs                   Extension ID 계산
├── installer/                           ← 사용자용 설치기
│   ├── Install-SGW.bat
│   ├── Uninstall-SGW.bat
│   ├── index.html                       랜딩 페이지
│   └── deploy.ps1
└── .keys/swgs.pem                       ← Private key (gitignored)
```

## 빌드 + 배포 (swgs/extension/ 안에서)

```powershell
# 1. CRX 빌드 (자동 키 생성/재사용)
powershell -ExecutionPolicy Bypass -File build-crx.ps1

# 2. CF Pages 배포 (확장 자체)
powershell -ExecutionPolicy Bypass -File deploy-cf.ps1
# → https://swgs-internal.pages.dev/

# 3. 사용자 설치기 배포 (cd ..\installer)
cd ..\installer
powershell -ExecutionPolicy Bypass -File deploy.ps1
# → https://sgw-install.pages.dev/
```

## Extension ID
```
ajlojcldaocimafbolojgokhpdfhkpkb
```
(키 분실 시 ID 변경 + 모든 PC 재설치 필요. `.keys/swgs.pem` 절대 공유 금지)

## 사용자 측 설치 (회사 직원)

1. https://sgw-install.pages.dev/ 접속
2. **[🚀 사내 자동 설치 다운로드 (ZIP)]** 클릭
3. 압축 풀기 → `Install-SGW.bat` 더블클릭
4. UAC [예]
5. 브라우저 재시작 → ⭐ 자동 표시

## 자동 업데이트

```
[당신: deploy-cf.ps1 실행]
  ↓ CF Pages 갱신
[사용자 PC: 30분 폴링]
  ↓ 새 버전 감지 → CRX 자동 다운로드
[브라우저 재시작 시 자동 활성]
```

사용자 측 클릭: 0회.

## 보안

- 모든 데이터: `chrome.storage.local` (외부 전송 없음)
- 통신: `sgw-seastar-work.pages.dev` 본체 그룹웨어만
- declarativeNetRequest: 사내 도메인 한정 헤더 정책
- API 키, JWT, 사원번호: 로컬 저장 (영구 세션)
