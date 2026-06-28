#!/bin/bash
set -e

echo "============================================"
echo " Building APK - Sistema Lavanderia"
echo "============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# 1. Build frontend
echo "[1/4] Building frontend (Vite)..."
cd "$ROOT_DIR/frontend"
npm run build
echo "OK"

# 2. Sync Capacitor
echo "[2/4] Syncing assets with Capacitor..."
cd "$ROOT_DIR/mobile_app"
npx cap sync android
echo "OK"

# 3. Build APK
BUILD_TYPE="${1:-debug}"
echo "[3/4] Building APK ($BUILD_TYPE)..."

cd "$ROOT_DIR/mobile_app/android"

if [ "$BUILD_TYPE" = "release" ]; then
    ./gradlew assembleRelease
else
    ./gradlew assembleDebug
fi
echo "OK"

# 4. Show result
echo "[4/4] Looking for generated APK..."
echo ""

if [ "$BUILD_TYPE" = "release" ]; then
    APK_DIR="app/build/outputs/apk/release"
else
    APK_DIR="app/build/outputs/apk/debug"
fi

ls -la "$ROOT_DIR/mobile_app/android/$APK_DIR/"*.apk 2>/dev/null || echo "No APK found"

echo ""
echo "============================================"
echo " Build completed successfully"
echo "============================================"
echo ""
echo "APK location: mobile_app/android/$APK_DIR/"
echo ""
