@echo off
echo 🌐 배포 URL: https://sgw-seastar-work.pages.dev ☁️ Cloudflare Pages에 배포 중...
call npm run build
call npx wrangler pages deploy dist --project-name sgw-seastar-work --branch main
echo ✅ 배포 완료!
pause
