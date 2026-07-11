@echo off
chcp 65001 >nul
title Construir APK Chofer - Sistema Lavanderia

echo ============================================
echo  Construyendo APK CHOFER - FoxSolid Chofer
echo ============================================
echo.

:: 1. Build frontend en modo driver
echo [1/4] Compilando frontend en modo DRIVER (Vite)...
cd /d "%~dp0frontend"
call npm run build:driver
if %ERRORLEVEL% neq 0 (
    echo ERROR: Fallo la compilacion del frontend
    exit /b 1
)
echo OK

:: 2. Sync Capacitor (mobile_app_chofer)
echo [2/4] Sincronizando assets con Capacitor (chofer)...
cd /d "%~dp0mobile_app_chofer"
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo ERROR: Fallo la sincronizacion de Capacitor
    exit /b 1
)
echo OK

:: 3. Elegir modo de build
set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=debug

echo [3/4] Compilando APK chofer (%BUILD_TYPE%)...
cd /d "%~dp0mobile_app_chofer\android"

if /i "%BUILD_TYPE%"=="release" (
    call gradlew.bat assembleRelease
) else (
    call gradlew.bat assembleDebug
)

if %ERRORLEVEL% neq 0 (
    echo ERROR: Fallo la compilacion del APK
    exit /b 1
)
echo OK

:: 4. Mostrar resultado
echo [4/4] Buscando APK generado...
echo.

if /i "%BUILD_TYPE%"=="release" (
    set APK_DIR=app\build\outputs\apk\release
) else (
    set APK_DIR=app\build\outputs\apk\debug
)

dir "%~dp0mobile_app_chofer\android\%APK_DIR%\*.apk" 2>nul

echo.
echo ============================================
echo  APK CHOFER compilado exitosamente
echo ============================================
echo.
echo APK ubicacion: mobile_app_chofer\android\%APK_DIR%\
echo Package ID: com.foxsolid.lavanderia.chofer
echo Nombre app: FoxSolid Chofer
echo.
