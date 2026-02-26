# 그룹웨어 배포 자동화 가이드

## 🚀 자동 배포 방법

### 방법 1: GitHub Actions (권장)
GitHub Secrets를 설정하면 `git push`만으로 자동 배포됩니다.

**Secrets 설정:**
https://github.com/byjay/SGW/settings/secrets/actions

| Secret Name | Value |
|-------------|-------|
| `CLOUDFLARE_ACCOUNT_ID` | `65a3e734c27681a2734f87c0c5721ccb` |
| `CLOUDFLARE_API_TOKEN` | `v7zolsDGTztwrP6nO3c731ZVzz6qeZd-tMEEUB7g` |
| `CLOUDFLARE_PROJECT_NAME` | `sgw-seastar-work` |

**배포 테스트:**
```bash
git add .
git commit -m "test deployment"
git push
```

---

### 방법 2: 스크립트 사용

#### Windows (deploy.bat)
```cmd
deploy.bat
```

#### Linux/Mac (deploy.sh)
```bash
./deploy.sh
```

---

### 방법 3: 수동 배포

```bash
# 빌드
npm run build

# 배포
npx wrangler pages deploy dist --project-name sgw-seastar-work
```

---

## 🌐 배포 URL
- **프로덕션**: https://sgw.seastar.work (도메인 연동 후)
- **Preview**: https://851e857b.sgw-seastar-work.pages.dev

---

## 🔧 작업 흐름

```
코드 수정 → git add → git commit → git push → 자동 배포
```

---

## ⚠️ 주의사항

1. **GitHub Actions 설정**: Secrets를 추가해야 자동 배포가 작동합니다
2. **도메인 연동**: Cloudflare Dashboard에서 DNS 설정 필요
3. **빌드 성공 확인**: 배포 전 `npm run build` 성공 확인

---

## 📊 현재 상태

| 항목 | 상태 |
|------|------|
| GitHub 리포지토리 | ✅ https://github.com/byjay/SGW |
| Cloudflare Pages | ✅ sgw-seastar-work |
| 배포 방식 | Direct Upload (Actions 사용 불가) |
| 도메인 | ⏳ sgw.seastar.work (pending) |

---

**현재 배포 URL**: https://851e857b.sgw-seastar-work.pages.dev
