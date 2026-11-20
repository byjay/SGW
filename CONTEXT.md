# CONTEXT 기록 — SGW 프로젝트 대화·결정 축

## 2026-07-20 final본 검수 → 전면 채용 불가 판정 + 체리픽 2건
- 핵심결정: 마스터가 가져온 team_connect_final(1).tar.gz(→ E:\code-project\SG\team_connect_final\flutter_app 해제)를 검수 — **별개 갈래(우리 sgw-port B0~B9 미포함, 공통조상 f984ff7), Flask 3,147 LOC 증축, D1 연동 4도메인뿐, 연차 4타입/3상태 재축소, SSO·AI프록시 없음** → 기획서 §5 계약 위반으로 전면 채용 불가. 유일 개선=서버 JWT 로그인 채택(이름 로그인 0건). 판정: 우리 sgw-port 베이스 유지 + 클라 우수분만 체리픽.
- 체리픽 채택 2건(sgw-port 커밋 7b0582f·7d14f3a): ① 카카오톡식 새 대화 시트(chat_list_screen, D1 createRoom 그대로) ② 쪽지 스레드 UI(notes_screen+note_thread_screen 신규, LocalStore 재배선). 기각 다수(minutes/nas/memo/chat 등 — 전부 Flask 회귀 또는 우리 것이 우수, 사유 문서화됨).
- 검증: analyze 0에러, 웹 빌드 통과, 테스트 150 pass 회귀 0 (advanced_chat 간헐실패는 baseline에서도 재현되는 테스트 전역상태 오염 flakiness로 격리 증명).
- 다음할일: 체리픽 반영 스테이징 재배포 → 마스터 프리뷰 육안확인 → 프로덕션 전환 승인 대기 (전환 명령은 기존 기록 참조).

## 2026-07-20 v3 완벽이식 B0~B9 완료 + 스테이징 검증 통과
- **핵심결정**: 주간보고 화면=v2 weekly_screen 채택(D1 스키마 1:1), v3 로컬 주간보고 경로 삭제. AI는 클라 직결(설정 비번 Bearer 노출) 발견→전부 /api/ai 프록시 전환. Flask(server/ 11파일+backend_api.dart) 완전 삭제, 사내메일·메모는 local_store.dart 로컬 이관. NAS downloadUrl 잠복 403 버그→서명 downloadlink 방식 수정.
- **산출물**: team_connect_v3 sgw-port 브랜치 커밋 11개(03640d3~c7f7561: B0 pubspec/B1 인증/B2 모델·SgwApi·write-through/B3 연차완전판/B4 근태·댓글좋아요/B5 결재 첨부·금액·draft/B6 주간보고/B7 SSO·AI프록시/B8 NAS/B9 Flask제거·고아0). swgs functions/api/leave.js 매니저 대리등록 수정(미커밋·프리뷰에만 배포됨).
- **검증**: flutter analyze 0에러, 웹 빌드 통과(DART_VM_OPTIONS=--old_gen_heap_size=12288), 테스트 150 pass/기존실패 2(위키 백링크 — v3 원래 결함), 회귀 0.
- **스테이징 LIVE**: https://v3-staging.sgw-seastar-work.pages.dev (CF Pages preview 브랜치 v3-staging, deployment e0be98bc). 실측: / 200, /api/health 200 db:true, 무토큰 employees/leave/board/weekly/ai 전부 401, login 틀린비번 401 invalid_credentials(PBKDF2 경로 증명). Preview 환경에 전용 JWT_SECRET(랜덤 96hex) CF API PATCH로 주입(production 무변경 증거 확보).
- **미해결**: ① 마스터 프리뷰 육안확인+프로덕션 전환 승인 대기(전환 명령: cd E:/code-project/swgs && wrangler pages deploy ../team_connect_v3/flutter_app/build/web --project-name sgw-seastar-work --commit-dirty=true). ② git push 미실행(sgw-port 로컬만). ③ 사내메일·메모·회의록 D1 후속 배치. ④ Android 키스토어 위치 마스터 확인. ⑤ SGW_SSO_SECRET·AI_API_KEY·NAS 시크릿 마스터 설정. ⑥ v3 기존 위키 결함 2건.
- **다음할일**: 마스터 승인 → 프로덕션 전환 → 전환 후 실측 → 커밋/푸시(비밀 스캔 후).

## 2026-07-20 v3 접수·평가·이식 착수
- **핵심결정**: 다른 에이전트 강화본 v3(team_connect_full_source.tar.gz)를 버전업 인정, **v3 베이스 + 현재 라이브의 인증·연차·D1 백본 이식** 전략 확정 (마스터 지침). v3는 v2 HEAD(88a9721)+34커밋 형제 브랜치로 SGW/D1 통합(미커밋 워킹트리)을 전혀 모름. v3 로그인=이름만(보안회귀)·연차 서버영속 없음 → 배포불가, Flask 백엔드 폐기하고 CF Functions+D1 유지.
- **산출물**: 
  - `E:\code-project\team_connect_v3\flutter_app\` (해제본, 브랜치 sgw-port)
  - `C:\Users\FREE\Downloads\SGW_v3_평가서_및_업데이트기획서.md` (평가 6.0/10 + 컴플레인 6건 + v4 요구스펙)
  - 이식 사양서 patch는 세션 스크래치패드 v2_sgw.patch
- **진행**:
  - B0(pubspec xlsio)+B1(서버 JWT 로그인 이식, 이름 로그인 0건, analyze 0에러, 웹빌드 통과 — DART_VM_OPTIONS=--old_gen_heap_size=12288 필요) 커밋 03640d3·d4b9856
  - B2(모델 정합+SgwApi 도메인+write-through) 진행 중
- **미해결**:
  - B3~B9(연차완전판/근태·presence/게시판·결재/주간보고/SSO·AI/NAS/Flask잔재 제거)
  - 사내메일·메모·회의록 D1 재작성(후속)
  - Google 로그인 결정 보류
  - Android 키스토어 위치 마스터 확인 필요
  - v2.0 폴더 미커밋 상태(삭제 금지)
- **다음할일**: B2 완료 검증 → B3 → … → 스테이징 프리뷰 배포 검증 → 도메인 전환
