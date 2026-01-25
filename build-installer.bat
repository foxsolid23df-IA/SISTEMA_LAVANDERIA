@echo off
setlocal
:: Asegurar que el script se ejecute en su propia carpeta
cd /d "%~dp0"

echo ====================================
echo Sistema de Ventas - Build Installer
echo ====================================
echo.

echo [1/5] Limpiando carpetas de salida anteriores...
if exist release rmdir /s /q release
if exist dist rmdir /s /q dist
echo.

echo [1/5] Instalando dependencias principales...
call npm install
if %errorlevel% neq 0 goto error

echo.
echo [2/5] Instalando dependencias del backend...
cd backend
call npm install
if %errorlevel% neq 0 goto error
cd ..

echo.
echo [3/5] Instalando dependencias del frontend...
cd frontend
call npm install
if %errorlevel% neq 0 goto error
cd ..

echo.
echo [4/5] Construyendo aplicacion...
call npm run build:all
if %errorlevel% neq 0 goto error

echo.
echo [5/5] Creando instalador (.exe)...
call npm run electron:build
if %errorlevel% neq 0 goto error

echo.
echo ====================================
echo ✅ BUILD COMPLETADO EXITOSAMENTE!
echo ====================================
echo.
echo El instalador esta en: %~dp0release\
echo Archivo: Sistema de Ventas Setup 1.3.0.exe
echo.
pause
goto end

:error
echo.
echo ====================================
echo ❌ ERROR EN EL BUILD
echo ====================================
echo Por favor, revise los mensajes de arriba para identificar el fallo.
echo.
pause
exit /b 1

:end
endlocal
