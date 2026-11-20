# SGWS 업데이트 마스터 플랜 (Fable 기획 · Kimi/Haiku 실행 · Fable 컨펌)

- 확정일: 2026-07-20
- 최종 목표: **SGWS(sgw.seastar.work)를 SG급 UI + 그 이상의 내실로 업데이트하고, 로그인·SEDMS SSO·NAS 연동을 필드 가동 수준까지 완성 후 검증 완료**
- 실행 규율: 미완료 0까지 루프. "완료"는 실측 증거(curl 본문·상태코드·쿼리 결과·빌드 로그)가 있을 때만.

---

## 0. 불변 계약 (모든 실행자가 침해 금지)

| # | 계약 | 위반 시 |
|---|---|---|
| C1 | 인증은 서버 JWT (`POST /api/auth/login` email+password → HS256, `_middleware.js`가 전 `/api/*` 게이트) | 즉시 반려 |
| C2 | 데이터는 Cloudflare D1 `sgw-employees` 단일 원본. 클라 로컬 전용 저장 금지 | 즉시 반려 |
| C3 | 백엔드는 CF Pages Functions만. Flask/자체 상시서버 신설 금지 | 즉시 반려 |
| C4 | 외부 LLM은 `/api/ai` 서버 프록시 경유. 클라 직결·키 노출 금지 | 즉시 반려 |
| C5 | D1 스키마 변경은 **additive만** (컬럼 추가·테이블 추가). 삭제·타입변경 금지 | 즉시 반려 |
| C6 | 프로덕션 배포는 P7에서 1회. 그 전 모든 배포는 `--branch v3-staging` | 즉시 반려 |
| C7 | 고아 0 — 새 파일·화면은 반드시 진입 경로에 연결 | 반려 |
| C8 | 색상 대비 본문 ≥4.5:1 (라이트/다크 양측) | 반려 |
| C9 | 테스트 하네스 신규 제작 금지 (마스터 지시). 검증 = 라이브 curl 실측 + 기존 스위트 회귀 | — |
| C10 | 비밀(키·토큰·시크릿)은 코드/깃에 금지. CF Secret 또는 `_warehouse/secrets.json` | 즉시 반려 |

## 0-1. 리포·자원 지도

| 자원 | 경로/식별자 | 비고 |
|---|---|---|
| 프론트 작업본 | `E:\code-project\team_connect_v3\flutter_app` 브랜치 `sgw-port` | 배타 점유 — 동시 편집 금지 |
| 백엔드 | `E:\code-project\swgs\functions\`, `d1\` | CF Pages `sgw-seastar-work` |
| SG 참조본(읽기 전용) | `E:\code-project\SG\team_connect_final\flutter_app` | UI만 참조. 서버코드 이식 금지 |
| 구 라이브 소스(보존) | `E:\code-project\team_connect_v2.0\flutter_app` | 미커밋 — 삭제·clean 금지 |
| SEDMS | `E:\code-project\SEDMS_G` (CF Pages `sedms`, sedms.app) | `/sso/sgw` HMAC 수신부 기구현 |
| 스테이징 | `https://v3-staging.sgw-seastar-work.pages.dev` | preview env (전용 JWT_SECRET 주입됨) |
| 프로덕션 | `https://sgw.seastar.work` | P7 전까지 무접촉 |
| 공용 시크릿 | `E:\code-project\_warehouse\secrets.json` | gitignore |

---

## 1. 단계별 실행 계획 (의존성 순)

### P1 — SG 껍데기 전면 채용 [진행 중 / coder]
- SG의 허브형 네비 셸·아이콘·디자인 토큰 이식.
- 우리 전 화면(weekly/nas/ai_tutor/document_library/mail/meeting/wiki/leave/approval/attendance/admin/chat/notes)을 새 셸에 배선.
- **완료 기준**: analyze 0에러 · 웹빌드 통과 · 화면 도달성 표 100% · 렌더 고아 0 · 대비 4.5:1.

### P2 — 백엔드 연동 신설 [진행 중 / coder]
- `d1/mail_memo_minutes.sql` + `functions/api/{mail,memos,minutes}.js` (JWT 게이트 뒤, sub 스코핑).
- SEDMS SSO 공유 시크릿 `SGW_SSO_SECRET` 생성 → `sgw-seastar-work`·`sedms` 양측 CF Secret 설정.
- **완료 기준**: D1 테이블 존재 확인 쿼리 · 시크릿 목록 확인 · `node --check` 통과.

### P3 — Dart 배선 (메일·메모·회의록 → D1)
- P1 완료 후 착수(같은 리포 배타 점유). LocalStore 기반 3개 화면을 P2 신설 API로 전환.
- **완료 기준**: 3도메인 서버 로드/저장 코드 경로 확인 · analyze 0 · 빌드 통과 · LocalStore 잔재 0.

### P4 — SEDMS SSO 필드 활성화
- SEDMS 측 시크릿 반영(필요 시 `npm run deploy`) · SGW `/api/sedms-sso` 경로 검증.
- **완료 기준**: 무토큰 401 / 시크릿 미설정 503이 아님을 코드경로로 증명 + (가능 시) 인증 토큰으로 302 Location 헤더 실측.

### P5 — NAS 필드 세팅 점검
- `functions/api/nas/*` + `nas_service.dart` 완비 확인, ACL 테이블 확인, 시크릿 3종(`NAS_BASE_URL`/`NAS_SVC_ACCOUNT`/`NAS_SVC_PASSWORD`) 상태 조회.
- **완료 기준**: 코드측 잔여 0 보고. 미설정 시 503이 정상 동작임을 실측.

### P6 — 통합 빌드 + 스테이징 배포 + 검증 테스트 전수
- 재빌드 → `--branch v3-staging` 배포 → 검증표 전 항목 실측.
- **검증표(필수 항목)**: `/` 200 · `/api/health` 200 db:true · 무토큰 employees/leave/board/weekly/mail/memos/minutes 전부 401 · login 오자격 401 · login 필드계약(email/password) · SSO·AI·NAS 미설정 시 예상 코드 · 기존 테스트 회귀 0.
- **완료 기준**: 불일치 0 (불일치 있으면 원인분석 후 수정→재검증 루프).

### P7 — 프로덕션 업데이트
- `cd E:/code-project/swgs && wrangler pages deploy ../team_connect_v3/flutter_app/build/web --project-name sgw-seastar-work --commit-dirty=true`
- 배포 직후 라이브 검증표 재실측. 실패 시 **즉시 롤백**(CF 이전 배포 rollback — 정적만 교체되므로 즉시 복귀).
- **완료 기준**: sgw.seastar.work 검증표 통과.

### P8 — 마무리
- `CONTEXT.md`·`CLAUDE.md` 정체카드 갱신, 커밋 정리(비밀 스캔 후), 잔여 마스터 항목 재고지.

---

## 2. 실행자 배분 (Kimi / Haiku / coder)

원칙: **Kimi = 독립·대규모 실행 / Haiku(scout) = 조회·기록 / coder(Opus) = 정밀 수정·배포 / Fable = 기획·검토·컨펌.**

| 단계 | 실행자 | 사유 |
|---|---|---|
| P1 | coder | 셸 교체는 다파일 정밀 수정 + 고아 0 판단 필요 |
| P2 | coder | CF/D1 실행 + 시크릿 취급 |
| P3 | coder | 리포 배타 점유 |
| P4·P5 조사 | **Haiku(scout)** | 읽기 전용 조회 — 저비용 |
| P4·P5 실행 | coder | 배포·시크릿 |
| P6 검증 실측 | **Haiku(scout)** 1차 수집 → coder 판정 | curl 나열은 저비용, 판정은 정밀 |
| P7 | coder | 프로덕션 — 최고 주의 |
| P8 기록 | **Haiku** | CONTEXT/문서 갱신 |
| Kimi | 문서 생성·독립 산출물 | 폴백: 429/한도 시 즉시 coder 전환 |

Kimi 운용 규칙: `kimi -p "한줄 지시"` 단독(--yolo 조합 금지), 동시 3개 이하, 실행 폴더에 `AGENTS.md` 필요(원본 `C:\Users\FREE\kimi-work\AGENTS.md`).

---

## 3. Fable 컨펌 게이트 (각 단계 종료 시)

각 실행자는 아래를 제출해야 하며, **Fable이 컨펌하기 전에는 다음 단계로 넘어가지 않는다.**
1. 변경 파일 목록
2. 완료 기준 대비 실측 증거 (상태코드·쿼리 결과·빌드 로그 인용)
3. 계약 C1~C10 침해 여부 자가 선언
4. 잔여·리스크

Fable 반려 사유: 증거 없는 PASS / 계약 침해 / 고아 발생 / 회귀 / 프로덕션 무단 접촉.

---

## 4. 리스크 · 롤백

| 리스크 | 대응 |
|---|---|
| 셸 교체로 화면 유실 | 도달성 표 100% 강제, 미달 시 반려 |
| D1 스키마 사고 | additive만 → 롤백 시 무해 |
| 프로덕션 사고 | CF 이전 배포 rollback 즉시 |
| 동시 편집 파일 유실 | 리포 배타 점유(같은 리포 동시 2에이전트 금지) |
| Kimi 한도 | 즉시 coder 폴백, 중단 없음 |

## 5. 코드 밖 잔여 (마스터 전용 · 코드는 완비)
1. `AI_API_KEY` — CF Secret 등록 시 AI 즉시 활성
2. NAS Cloudflare Tunnel + DSM `nas-api` 계정 + 시크릿 3종 — 등록 시 NAS 즉시 활성
3. Android 릴리스 키스토어 위치 (기존 설치본 업데이트 서명용)

---

*이 문서가 실행 기준선이다. 실행자는 착수 전 이 문서를 읽고, 완료 시 §3 컨펌 게이트 양식으로 보고한다.*
