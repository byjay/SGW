# Seastar Groupware - Standalone Installer Deploy
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUILD = Join-Path $ROOT "_build"
$DEPLOY = Join-Path $BUILD "deploy"
$PROJECT = "sgw-install"

if (Test-Path $BUILD)  { Remove-Item $BUILD -Recurse -Force }
New-Item -ItemType Directory -Path "$DEPLOY\installer" -Force | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem

# ZIP 1: Install-SGW (BAT만)
$zipPath = Join-Path $DEPLOY "installer\Install-SGW.zip"
Compress-Archive -Path (Join-Path $ROOT "Install-SGW.bat"), (Join-Path $ROOT "Uninstall-SGW.bat") -DestinationPath $zipPath -Force
Write-Host ("[Build] " + $zipPath + " (" + [math]::Round((Get-Item $zipPath).Length/1024,2) + " KB)") -ForegroundColor Green

# 개별 파일도 함께 배포
Copy-Item (Join-Path $ROOT "Install-SGW.bat") (Join-Path $DEPLOY "installer\Install-SGW.bat") -Force
Copy-Item (Join-Path $ROOT "Uninstall-SGW.bat") (Join-Path $DEPLOY "installer\Uninstall-SGW.bat") -Force
Copy-Item (Join-Path $ROOT "index.html") (Join-Path $DEPLOY "index.html") -Force

# headers
$headers = "/installer/*.bat`r`n  Content-Type: application/x-bat`r`n  Content-Disposition: attachment`r`n  Cache-Control: public, max-age=300`r`n/installer/*.zip`r`n  Cache-Control: public, max-age=3600`r`n"
[System.IO.File]::WriteAllText((Join-Path $DEPLOY "_headers"), $headers, [System.Text.UTF8Encoding]::new($false))

Push-Location (Split-Path -Parent $ROOT)
try {
  npx wrangler pages deploy $DEPLOY --project-name=$PROJECT --commit-dirty=true 2>&1
  Write-Host ""
  Write-Host "=== DEPLOY COMPLETE ===" -ForegroundColor Cyan
  Write-Host "  Landing : https://$PROJECT.pages.dev/"
  Write-Host "  ZIP     : https://$PROJECT.pages.dev/installer/Install-SGW.zip"
} finally { Pop-Location }
