@echo off
REM 그룹웨어 자동 배포 스크립트 (Windows)
REM 빌드 및 Cloudflare Pages 배포 자동화

echo 🚀 그룹웨어 자동 배포 시작...

REM 1. 빌드
echo 📦 빌드 중...
call npm run build

REM 2. 배포
echo ☁️ Cloudflare Pages에 배포 중...
call npx wrangler pages deploy dist --project-name sgw-seastar-work

echo ✅ 배포 완료!
echo 🌐 배포 URL: https://sgw-seastar-work.pages.dev
