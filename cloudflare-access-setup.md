# Cloudflare Access 설정 가이드

## 📋 개요
그룹웨어 앱 접근 제어를 위해 Cloudflare Zero Trust (Access) 기능을 설정합니다.

**보안 정책:**
- 회사 이메일(`@seastar.work`)만 접근 허용
- 외부인 접근 차단
- OTP(One-Time Password) 인증으로 보안 강화

---

## 🚀 단계 1: Cloudflare Dashboard 접속

### 1.1. 접속 경로
```
https://dash.cloudflare.com/[your-domain]/access/apps
```

예시:
```
https://dash.cloudflare.com/sgw.seastar.work/access/apps
```

### 1.2. Zero Trust 섹션으로 이동
- 왼쪽 메뉴에서 `Zero Trust` → `Access` → `Applications` 클릭

---

## 🔐 단계 2: Application 생성

### 2.1. 새 Application 생성
1. 우측 상단 `Create application` 버튼 클릭
2. 아래 설정 입력:

| 항목 | 값 |
|------|-----|
| **Application name** | `그룹웨어 인증` |
| **Application type** | `Self-hosted` |
| **Session duration** | `8h` (8시간) |

3. `Create application` 클릭

---

## 📧 단계 3: Authentication Policy 설정

### 3.1. 첫 번째 Policy (회사 이메일 허용 + OTP)

**3.1.1. Policy 생성**
1. `Add a policy` 클릭
2. 아래 설정 입력:

| 항목 | 값 |
|------|-----|
| **Policy name** | `회사 직원 OTP 인증` |
| **Policy action** | `Allow` |
| **Policy type** | `Application` |

**3.1.2. Include rules 설정:**

**Rule 1: 회사 이메일만 허용**
- `If`: `Email`
- `Choose from list`: `is in`
- `Value list`: `@seastar.work`

**Rule 2: OTP 요구**
- `Then`: `Require` → `One-time password`

### 3.1.3. Session duration 설정
- **Then**: `Then` → `Configure session`
- `Session lifetime**: `8h`

### 3.3.4. 저장
- 우측 하단 `Save policy` 클릭

---

### 3.2. 두 번째 Policy (외부인 차단)

**3.2.1. Policy 생성**
1. `Add another policy` 클릭
2. 아래 설정 입력:

| 항목 | 값 |
|------|-----|
| **Policy name** | `외부인 접근 차단` |
| **Policy action** | `Block` |
| **Policy type** | `Application` |

**3.2.2. Include rules 설정:**

**Rule: 회사 이메일이 아닌 경우 차단**
- `If`: `Email`
- `Choose from list`: `is not in`
- `Value list`: `@seastar.work`

### 3.2.3. 저장**
- `Save policy` 클릭

---

## 🔢 단계 4: OTP 설정

### 4.1. OTP 구성으로 이동
1. 생성된 Application 클릭
2. `Settings` 탭 클릭
3. `OTP` 섹션으로 스크롤

### 4.2. OTP 설정값 입력

| 항목 | 값 |
|------|-----|
| **OTP length** | `6` (자리수) |
| **Lifetime** | `10` (분) |
| **From email** | `noreply@seastar.work` |
| **Subject** | `그룹웨어 접속 인증 코드` |
| **Allowed email addresses** | `*seastar.work` |
| **OTP Provider** | `Email` |

### 4.3. OTP 템플릿 설정

**Subject 템플릿:**
```
그룹웨어 접속 인증 코드

인증 코드: {{#Code}}

이 코드는 10분 동안 유효합니다.

재발송을 원하시면 다시 로그인해주세요.
```

---

## ✅ 단계 5: 정책 우선순위 확인

### 5.1. 우선순위 확인
1. `Applications` → `그룹웨어 인증` 클릭
2. 상단 `Policy` 탭 클릭
3. 우선순위 확인:

```
1. 회사 직원 OTP 인증 (Allow)
2. 외부인 접근 차단 (Block)
```

이 순서가 맞지 않으면 정책의 `↕` `↔` 버튼으로 재정렬합니다.

---

## 🔍 단계 6: 테스트

### 6.1. 내부 사용자 테스트 (회사 이메일)
1. 브라우저 시크릿 모드/시크릿 창 열기
2. `https://sgw.seastar.work` 접속
3. **예상되는 동작:**
   - 이메일 인증 요청
   - 회사 이메일로 6자리 OTP 전송
   - OTP 입력 후 접속 성공 ✅

### 6.2. 외부인 접근 테스트
1. 다른 브라우저나 디바이스 사용
2. `https://sgw.seastar.work` 접속
3. **예상되는 동작:**
   - 차단 메시지 표시 ❌
   - 접속 불가

### 6.3. 성공 지표
- ✅ 회사 이메일 사용자만 접근 가능
- ✅ OTP 6자리 코드가 정상 발송
- ✅ 외부인 접근이 차단됨
- ✅ 세션이 8시간 후 자동 만료

---

## 🛠️ 문제 해결

### 문제 1: OTP가 오지 않음
**원인:** 스팸함 폴더로 전송됨
**해결:**
- 이메일 제목 확인
- 스팸함 폴더 확인
- OTP Provider를 `Email`로 설정

### 문제 2: 차단이 안 됨
**원인:** Policy 순서 문제
**해결:**
- 정책 우선순위 재확인
- `Block` 정책이 `Allow` 정책보다 위에 있어야 함

### 문제 3: 세션 만료 설정이 안 됨
**원인:** 세션 설정이 Policy에 없음
**해결:**
- `Then` → `Configure session`에서 설정 확인
- `Session lifetime` 값을 `8h`로 설정

### 문제 4: 이메일이 안 도착
**원인:** SMTP 설정 문제 또는 수신거부
**해결:**
- 이메일 주소 확인: `noreply@seastar.work`
- Cloudflare DNS의 MX 레코드 확인
- 스팸함 정책 확인

---

## 📝 참고 사항

### 세션 만료 후 동작
- 세션 만료 후 재로그인 필요
- 사용자 경험 향상을 위해 8시간 권장

### OTP 재발송
- 사용자가 재발송을 원하면 다시 로그인 진행
- OTP 유효 기간 내에만 재발송 가능

### 로깅
- Cloudflare Access Dashboard → `Analytics` → `Access logs`
- 접근 시도 로그 확인 가능
- 실패한 접근 시도 IP 추적 가능

---

## 🎯 완료 체크리스트

- [ ] Application 생성 완료
- [ ] 첫 번째 Policy (회사 OTP 인증) 생성 완료
- [ ] 두 번째 Policy (외부인 차단) 생성 완료
- [ ] OTP 설정 완료
- [ ] Policy 우선순위 확인 완료
- [ ] 내부 사용자 테스트 완료
- [ ] 외부인 접근 차단 테스트 완료
- [ ] 세션 만료 기능 테스트 완료
- [ ] 로그 확인 설정 완료

---

## 📞 지원

**Cloudflare Access 문서:**
- https://developers.cloudflare.com/access/
- https://developers.cloudflare.com/zero-trust/

**문제 발생 시:**
- Cloudflare Dashboard → `Analytics` → `Access logs`에서 로그 확인
- IT 팀에 문의: `it-support@seastar.work`
