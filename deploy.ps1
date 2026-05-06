param(
  [string]$Version = "v01.00"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildStamp = Get-Date -Format "HH:mm ddMMyy"
$buildMetaPath = Join-Path $projectRoot "build-meta.js"

$buildMetaContent = @"
window.APP_VERSION = "$Version";
window.APP_BUILD_STAMP = "$buildStamp";
window.APP_AUTHOR = "Ti\u1ebfn \u0110\u1ee9c";
"@

Set-Content -LiteralPath $buildMetaPath -Value $buildMetaContent -Encoding UTF8

Write-Host "Build stamp: $buildStamp"
Write-Host "Deploying to Netlify..."

npx netlify-cli deploy --prod --dir .
