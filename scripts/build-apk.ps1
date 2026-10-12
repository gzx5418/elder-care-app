param([string]$SdkPath=$env:ANDROID_HOME,[string]$JavaPath=$env:JAVA_HOME,[switch]$PublicBuild)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
if(!$SdkPath){$SdkPath=$env:ANDROID_SDK_ROOT}
if(!$SdkPath -and (Test-Path 'D:\Android\Sdk')){$SdkPath='D:\Android\Sdk'}
if(!$SdkPath -and (Test-Path "$env:LOCALAPPDATA\Android\Sdk")){$SdkPath="$env:LOCALAPPDATA\Android\Sdk"}
if(!$SdkPath -or !(Test-Path $SdkPath)){throw '请通过 -SdkPath 指定 Android SDK（需 API 34 和 Build Tools 34.0.0）。'}
if(!$JavaPath -or !(Test-Path (Join-Path $JavaPath 'bin\java.exe'))){throw '请通过 -JavaPath 指定 JDK 17 或 21 路径。'}
$env:JAVA_HOME=$JavaPath
$env:Path="$JavaPath\bin;$env:Path"
$previousBuildMode=$env:BUILD_WITHOUT_PRIVATE_KEY
if($PublicBuild){$env:BUILD_WITHOUT_PRIVATE_KEY='1'}
Push-Location $projectRoot
try {
    & npm.cmd ci
    if($LASTEXITCODE -ne 0){throw '依赖安装失败'}
    & npm.cmd run sync
    if($LASTEXITCODE -ne 0){throw 'Web 资源同步失败'}
    $sdkNormalized=$SdkPath.Replace('\','/')
    Set-Content -LiteralPath 'android\local.properties' -Encoding ascii -Value "sdk.dir=$sdkNormalized"
    & .\android\gradlew.bat -p android assembleDebug --no-daemon --console=plain
    if($LASTEXITCODE -ne 0){throw '安卓编译失败'}
    New-Item -ItemType Directory -Force 'release' | Out-Null
    $apkName=if($env:BUILD_WITHOUT_PRIVATE_KEY -eq '1'){'silver-age-assistant-v3.2.4-public.apk'}else{'银龄助手-v3.2.4-百炼私用版.apk'}
    $outputApk=Join-Path 'release' $apkName
    Copy-Item -LiteralPath 'android\app\build\outputs\apk\debug\app-debug.apk' -Destination $outputApk -Force
    Get-FileHash -LiteralPath $outputApk -Algorithm SHA256
} finally {Pop-Location;if($null -eq $previousBuildMode){Remove-Item Env:\BUILD_WITHOUT_PRIVATE_KEY -ErrorAction SilentlyContinue}else{$env:BUILD_WITHOUT_PRIVATE_KEY=$previousBuildMode}}
