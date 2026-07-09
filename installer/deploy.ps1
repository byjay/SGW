# Seastar Groupware - Standalone Installer Deploy
$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUILD = Join-Path $ROOT "_build"
$DEPLOY = Join-Path $BUILD "deploy"
$PROJECT = "sgw-install"

if (Test-Path $BUILD)  { Remove-Item $BUILD -Recurse -Force }
New-Item -ItemType Directory -Path "$DEPLOY\installer" -Force | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem

# Install ZIP (initial install bundle)
$zipPath = Join-Path $DEPLOY "installer\Install-SGW.zip"
Compress-Archive -Path (Join-Path $ROOT "Install-SGW.bat"), (Join-Path $ROOT "Uninstall-SGW.bat") -DestinationPath $zipPath -Force
Write-Host ("[Build] Install ZIP: " + [math]::Round((Get-Item $zipPath).Length/1024,2) + " KB") -ForegroundColor Green

# Direct .bat / .ps1 deploy (Force-Update is one-click .bat download)
Copy-Item (Join-Path $ROOT "Install-SGW.bat")        (Join-Path $DEPLOY "installer\Install-SGW.bat") -Force
Copy-Item (Join-Path $ROOT "Install-SGW.ps1")        (Join-Path $DEPLOY "installer\Install-SGW.ps1") -Force
Copy-Item (Join-Path $ROOT "Uninstall-SGW.bat")      (Join-Path $DEPLOY "installer\Uninstall-SGW.bat") -Force
Copy-Item (Join-Path $ROOT "Force-Update-SGW.bat")   (Join-Path $DEPLOY "installer\Force-Update-SGW.bat") -Force
Copy-Item (Join-Path $ROOT "Force-Update-SGW.ps1")   (Join-Path $DEPLOY "installer\Force-Update-SGW.ps1") -Force
Copy-Item (Join-Path $ROOT "index.html")             (Join-Path $DEPLOY "index.html") -Force

# attachment headers for .bat / .ps1
$headerLines = @(
  "/installer/*.bat",
  "  Content-Type: application/x-bat",
  "  Content-Disposition: attachment",
  "  Cache-Control: public, max-age=300",
  "/installer/*.ps1",
  "  Content-Type: text/plain; charset=utf-8",
  "  Cache-Control: public, max-age=60",
  "/installer/*.zip",
  "  Cache-Control: public, max-age=3600",
  ""
)
$headers = ($headerLines -join "`r`n")
[System.IO.File]::WriteAllText((Join-Path $DEPLOY "_headers"), $headers, [System.Text.UTF8Encoding]::new($false))

Push-Location (Split-Path -Parent $ROOT)
try {
  npx wrangler pages deploy $DEPLOY --project-name=$PROJECT --commit-dirty=true 2>&1
  Write-Host ""
  Write-Host "=== DEPLOY COMPLETE ===" -ForegroundColor Cyan
  Write-Host ("  Landing      : https://" + $PROJECT + ".pages.dev/")
  Write-Host ("  Install ZIP  : https://" + $PROJECT + ".pages.dev/installer/Install-SGW.zip")
  Write-Host ("  Force-Update : https://" + $PROJECT + ".pages.dev/installer/Force-Update-SGW.bat  (one-click)")
} finally { Pop-Location }
