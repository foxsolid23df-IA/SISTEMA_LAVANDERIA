@echo off
echo ========================================
echo   SISTEMA LAVANDERIA - Empaquetado
echo ========================================
echo.

echo [1/3] Verificando entorno virtual...
if not exist "venv" (
    echo Creando entorno virtual...
    python -m venv venv
)

echo [2/3] Instalando dependencias...
call venv\Scripts\activate
pip install -r requirements.txt pyinstaller --quiet

echo [3/3] Generando ejecutable...
pyinstaller --noconfirm --onefile --windowed ^
    --name "SistemaLavanderia" ^
    --icon "assets\icono.ico" ^
    --add-data "assets;assets" ^
    --add-data "config.py;." ^
    --add-data "database;database" ^
    --add-data "ui;ui" ^
    --add-data "reportes;reportes" ^
    --add-data "utils;utils" ^
    --hidden-import "database" ^
    --hidden-import "database.conexion" ^
    --hidden-import "database.modelos" ^
    --hidden-import "database.seed" ^
    --hidden-import "ui" ^
    --hidden-import "ui.login" ^
    --hidden-import "ui.principal" ^
    --hidden-import "ui.ordenes" ^
    --hidden-import "ui.cobro" ^
    --hidden-import "ui.caja" ^
    --hidden-import "ui.reportes" ^
    --hidden-import "ui.clientes" ^
    --hidden-import "ui.ticket_config" ^
    --hidden-import "ui.configuracion" ^
    --hidden-import "reportes.ticket" ^
    --hidden-import "reportes.impresor" ^
    --hidden-import "utils.fechas" ^
    --hidden-import "utils.moneda" ^
    main.py

echo.
echo ========================================
echo   ¡Listo! Ejecutable en: dist\SistemaLavanderia.exe
echo ========================================
pause
