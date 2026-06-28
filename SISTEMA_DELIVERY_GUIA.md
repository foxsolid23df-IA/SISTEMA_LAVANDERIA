# 🚚 Guía: Rama `Sistema_delivery` — Ejecución Local y Pruebas

## ¿Qué incluye esta rama?

La rama `Sistema_delivery` (actualmente activa en tu workspace) agrega el **módulo completo de Delivery y Portal Repartidor** al Sistema de Lavandería. Es un módulo **opcional por tienda** que se activa desde el Portal Maestro.

### Commits incluidos (respecto a `main`)
| Commit | Descripción |
|--------|-------------|
| `476229b` | feat: rollout delivery module by store |
| `2389600` | fix: support vercel spa routes from frontend root |
| `fae3d52` | fix: use hash routes for vercel previews |
| `591c959` | fix: allow master admins to toggle delivery module |
| `13a2e60` | feat: harden delivery production flows |

---

## 🗺️ Arquitectura del Módulo

```
Frontend (React + Vite)
├── /delivery          → DeliveryDashboard   (sucursal: tablero operativo)
├── /chofer            → DriverPortal        (repartidor: móvil/PWA)
└── /tracking/:token   → OrderTracking       (cliente: rastreo público, sin login)

Supabase (Backend)
├── Edge Functions
│   ├── delivery-actions          (acciones críticas: asignar, recoger, entregar, pagos)
│   ├── verify-driver-pin         (validar PIN del repartidor)
│   ├── get-delivery-tracking     (tracking público seguro)
│   ├── update-delivery-request   (cliente confirma prendas y preferencia de pago)
│   ├── notify-order              (envío de WhatsApp al cliente y repartidor)
│   └── handle-whatsapp-webhook   (crea solicitudes desde WhatsApp entrante)
└── Migraciones SQL (20260527... → 20260528...)
    ├── delivery_orders            (tabla principal de pedidos)
    ├── customers                  (directorio de clientes)
    ├── delivery_payments          (pagos y abonos del repartidor)
    ├── delivery_notification_logs (auditoría de WhatsApp)
    └── Feature Flag: profiles.delivery_enabled (activa por tienda)
```

---

## ✅ Prerrequisitos

Antes de comenzar verifica que tienes instalado:

```powershell
node --version   # Debe ser >= 18
npm --version
git --version
```

> **Supabase CLI**: Está disponible vía `npx supabase` (versión 2.105.0 detectada). No es necesario instalarlo globalmente.

---

## 🔐 Paso 1: Configurar Variables de Entorno del Frontend

Crea (si no existe) el archivo `frontend/.env`:

```powershell
cd "c:\SISTEMA_ LAVANDERIA\frontend"
New-Item -ItemType File -Name .env -Force
```

Abre `frontend/.env` y agrega:

```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Dónde obtener estos valores:**
1. Ve a [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto → **Settings → API**
3. Copia **Project URL** y **anon public key**

> ⚠️ **Nunca subas `.env` a Git.** Ya está en `.gitignore`.

---

## 📦 Paso 2: Instalar Dependencias

```powershell
# Frontend
cd "c:\SISTEMA_ LAVANDERIA\frontend"
npm install

# Backend (Express + SQLite local)
cd "c:\SISTEMA_ LAVANDERIA\backend"
npm install
```

---

## 🗄️ Paso 3: Aplicar Migraciones de Delivery en Supabase

Las migraciones del módulo Delivery **deben ejecutarse en tu proyecto Supabase** (el mismo al que apunta tu `.env`).

### Opción A — Supabase CLI (recomendado)

```powershell
cd "c:\SISTEMA_ LAVANDERIA"
npx supabase db push
```

> Esto aplica **todas** las migraciones pendientes en orden, incluyendo las del módulo Delivery.

### Opción B — SQL Manual (Supabase Dashboard)

Si prefieres aplicarlas una a una, en el **SQL Editor** de Supabase ejecuta los archivos en este orden:

| Orden | Archivo |
|-------|---------|
| 1 | `supabase/migrations/20260527120000_add_delivery_system.sql` |
| 2 | `supabase/migrations/20260527131000_tenant_identity_repair.sql` |
| 3 | `supabase/migrations/20260527132000_add_staff_phone.sql` |
| 4 | `supabase/migrations/20260528001000_secure_delivery_tracking.sql` |
| 5 | `supabase/migrations/20260528002000_delivery_payment_preferences.sql` |
| 6 | `supabase/migrations/20260528003000_delivery_pickup_quote_marker.sql` |
| 7 | `supabase/migrations/20260528004000_delivery_pickup_evidence.sql` |
| 8 | `supabase/migrations/20260528005000_delivery_module_feature_flag.sql` |
| 9 | `supabase/migrations/20260528006000_delivery_production_hardening.sql` |

### Tablas que deben existir después de las migraciones

En **Supabase → Table Editor** verifica que existan:
- ✅ `delivery_orders`
- ✅ `customers`
- ✅ `delivery_payments`
- ✅ `delivery_notification_logs`
- ✅ `profiles` (con columnas `delivery_enabled`, `whatsapp_gateway_type`, `whatsapp_session_token`)
- ✅ `staff` (con columna `phone`)

---

## 📁 Paso 4: Crear Bucket de Storage para Evidencias

En **Supabase → Storage**, crea un bucket llamado exactamente:

```
delivery-evidence
```

Configúralo como **privado** (Private). Las políticas RLS para este bucket ya están en la migración `20260528006000_delivery_production_hardening.sql`.

---

## 🚀 Paso 5: Desplegar Edge Functions (Desarrollo con Supabase Cloud)

Para que las funciones de delivery funcionen, se deben desplegar en tu proyecto Supabase:

```powershell
cd "c:\SISTEMA_ LAVANDERIA"
npx supabase functions deploy delivery-actions
npx supabase functions deploy verify-driver-pin
npx supabase functions deploy get-delivery-tracking
npx supabase functions deploy update-delivery-request
npx supabase functions deploy notify-order
npx supabase functions deploy handle-whatsapp-webhook
```

> **Nota de desarrollo**: El frontend tiene un **fallback automático** para desarrollo local. Si las Edge Functions no están desplegadas o fallan, `deliveryService.js` usa Supabase directamente para `get-delivery-tracking` y `update-delivery-request`. Las acciones críticas (`delivery-actions`) sí requieren la función desplegada.

---

## ▶️ Paso 6: Ejecutar la Aplicación Localmente

### Terminal 1 — Frontend (React + Vite)

```powershell
cd "c:\SISTEMA_ LAVANDERIA\frontend"
npm run dev
```

Accede en: **http://localhost:5173**

### Terminal 2 — Backend (Express + SQLite) — Opcional para POS local

```powershell
cd "c:\SISTEMA_ LAVANDERIA\backend"
npm run dev
```

Backend disponible en: **http://127.0.0.1:3001**

> El módulo Delivery usa **Supabase directamente** (no el backend Express). El backend Express es para el POS desktop (Electron). Puedes omitirlo si solo vas a probar Delivery.

---

## 🔑 Paso 7: Activar el Módulo Delivery para tu Tienda de Prueba

El módulo está **desactivado por defecto**. Para activarlo:

1. Inicia sesión en la app (`http://localhost:5173`)
2. Ve a **`/#/portal-maestro`**
3. Inicia sesión con el **PIN Maestro** (`2026SOP`)
4. En la pestaña **"Clientes Activos"**, localiza tu tienda
5. Haz clic en el botón **"Activar Delivery"**

Esto ejecuta `toggle_delivery_module()` en Supabase y habilita la columna `profiles.delivery_enabled = true` para esa tienda.

---

## 🧪 Paso 8: Pruebas Funcionales del Módulo Delivery

### 8.1 Dashboard de Delivery (Sucursal)

URL: `http://localhost:5173/#/delivery`

**Flujo a probar:**

- [ ] Se muestra el tablero de solicitudes
- [ ] Crear pedido manualmente: Nombre, teléfono, dirección, notas
- [ ] Cotizar tarifa de delivery (`$0.00` también debe funcionar)
- [ ] Ver el pedido en estado `requested`
- [ ] Alerta sonora/visual al llegar nueva solicitud (simular vía Supabase Dashboard insertando un registro)

### 8.2 Crear un Repartidor con PIN

Antes de asignar repartidor, crea un empleado con rol `repartidor` o `chofer`:

1. Ve a **`/#/usuarios`** (solo admin)
2. Crea nuevo empleado: Nombre, PIN de 4 dígitos, teléfono, rol `repartidor`
3. El teléfono es **obligatorio** para poder asignar

### 8.3 Flujo Completo de un Pedido

```
[requested] → [assigned] → [picked_up] → [delivered_to_store] → [completed]
```

**En el Dashboard `/delivery`:**
1. Cotizar tarifa → Esperar confirmación del cliente
2. Asignar repartidor → Verificar que tiene teléfono
3. El pedido pasa a `assigned`

**En el Portal Repartidor `/chofer`:**
4. Ingresar PIN del repartidor
5. Ver lista de rutas asignadas
6. Abrir pedido → Escribir reporte de recogida (obligatorio)
7. (Opcional) Tomar foto de evidencia
8. Marcar como `picked_up`
9. Registrar pago o abono del cliente si aplica
10. Marcar entrega en sucursal → `delivered_to_store`

**De vuelta en Dashboard `/delivery`:**
11. Ver evidencia fotográfica (URL firmada temporal de 5 min)
12. Capturar costo del servicio de lavandería
13. Conciliar pagos cobrados por el repartidor
14. Completar pedido → `completed`

### 8.4 Tracking Público (Sin Login)

URL: `http://localhost:5173/#/tracking/TOKEN_UUID`

Donde `TOKEN_UUID` es el campo `tracking_token` del pedido en la tabla `delivery_orders`.

**Verificar:**
- [ ] Se muestra el estado del pedido sin login
- [ ] El cliente puede confirmar prendas a entregar
- [ ] El cliente puede elegir preferencia de pago
- [ ] No se exponen datos internos (IDs, tokens, rutas de storage, teléfono del chofer)

### 8.5 Portal Repartidor como PWA

1. Abre `http://localhost:5173/#/chofer` en el celular (misma red WiFi)
2. En Chrome móvil → Menú → "Añadir a pantalla de inicio"
3. El sistema registra un Service Worker y un manifest PWA
4. Verifica que el portal funciona sin barra del navegador (modo app)

> **Nota**: En escritorio, el sistema muestra una pantalla de advertencia indicando que está diseñado para móvil. Puedes elegir "Continuar en modo prueba" para previsualizar.

### 8.6 Tienda sin Delivery Activado

Verifica el comportamiento cuando `delivery_enabled = false`:

- [ ] La ruta `/delivery` muestra "Módulo no disponible para esta tienda"
- [ ] La ruta `/chofer` muestra "Módulo no disponible para esta tienda"
- [ ] El Sidebar **no** muestra el enlace de Delivery
- [ ] El webhook de WhatsApp rechaza pedidos si la tienda no tiene Delivery activo

---

## 🧪 Paso 9: Ejecutar Tests Automáticos

```powershell
cd "c:\SISTEMA_ LAVANDERIA\frontend"
npm run test -- --run
```

**Resultado esperado** (ya verificado):
```
Test Files  6 passed (6)
Tests       26 passed (26)
```

Los tests cubren: `cashSessionService`, `salesService`, `printService`, `scaleService`, `useCart`, `TicketVenta`.

> Los tests de Delivery se ejecutan a través de los servicios existentes. Las acciones críticas se validan vía Edge Function en producción.

---

## 🐛 Solución de Problemas Frecuentes

### Error: "Módulo delivery no disponible para esta tienda"

La Edge Function `delivery-actions` verifica `profiles.delivery_enabled`. Solución:
1. Ir a `/#/portal-maestro` → Activar Delivery para tu tienda.

### Error: "Primero captura la tarifa de recogida"

El sistema bloquea la asignación de repartidor si no hay `pickup_quote_confirmed_at`. Debes cotizar la tarifa (puede ser `$0.00`) antes de asignar.

### Error: "La clienta aún no confirma preferencia de pago"

El sistema bloquea la asignación si la clienta no ha confirmado su preferencia de pago desde el link de tracking. En desarrollo puedes actualizar directamente el campo `payment_preference_confirmed_at` en Supabase.

### Error: "El repartidor no tiene teléfono registrado"

Ve a `/usuarios` → edita el repartidor y agrega su número de teléfono.

### Edge Functions no responden (Error 404 / fetch failed)

Las funciones están en Supabase Cloud. Verifica que estén desplegadas:
```powershell
npx supabase functions list
```
Si no aparecen, ejecuta el paso 5 nuevamente.

### Variables de entorno no cargadas

```powershell
# Reiniciar Vite después de editar .env
# Ctrl+C y luego:
npm run dev
```

---

## 📋 Checklist Pre-Merge a `main`

Antes de hacer merge de `Sistema_delivery` a `main`:

- [ ] ✅ Tests automáticos pasan: `npm run test -- --run` (26/26)
- [ ] ✅ Módulo Delivery visible y funcional con `delivery_enabled = true`
- [ ] ✅ Ruta `/delivery` bloqueada con `delivery_enabled = false`
- [ ] ✅ Ruta `/chofer` bloqueada con `delivery_enabled = false`
- [ ] ✅ Tracking público `/tracking/:token` funciona sin login
- [ ] ✅ No se exponen datos internos en tracking público
- [ ] ✅ Portal Repartidor funcional en móvil
- [ ] ✅ Flujo completo: `requested → assigned → picked_up → delivered_to_store → completed`
- [ ] ✅ Pagos del repartidor y conciliación funcionan
- [ ] ✅ Evidencia fotográfica se sube y se lee con URL firmada
- [ ] ✅ Edge Functions desplegadas en producción
- [ ] ✅ Bucket `delivery-evidence` creado como privado
- [ ] ✅ Migraciones SQL aplicadas en base de datos de producción

---

## 📂 Archivos Clave de la Implementación

| Archivo | Propósito |
|---------|-----------|
| [deliveryService.js](file:///c:/SISTEMA_%20LAVANDERIA/frontend/src/services/deliveryService.js) | Toda la lógica de negocio del módulo |
| [DeliveryDashboard.jsx](file:///c:/SISTEMA_%20LAVANDERIA/frontend/src/components/delivery/DeliveryDashboard.jsx) | Tablero operativo de la sucursal |
| [DriverPortal.jsx](file:///c:/SISTEMA_%20LAVANDERIA/frontend/src/components/delivery/DriverPortal.jsx) | Portal móvil del repartidor |
| [OrderTracking.jsx](file:///c:/SISTEMA_%20LAVANDERIA/frontend/src/components/delivery/OrderTracking.jsx) | Tracking público para el cliente |
| [delivery-actions/index.ts](file:///c:/SISTEMA_%20LAVANDERIA/supabase/functions/delivery-actions/index.ts) | Edge Function: acciones críticas |
| [routing.jsx](file:///c:/SISTEMA_%20LAVANDERIA/frontend/src/router/routing.jsx) | Rutas `/delivery`, `/chofer`, `/tracking/:token` |
| [MasterLicenseManager.jsx](file:///c:/SISTEMA_%20LAVANDERIA/frontend/src/components/admin/MasterLicenseManager.jsx) | Activar/desactivar Delivery por tienda |
| [20260528005000_delivery_module_feature_flag.sql](file:///c:/SISTEMA_%20LAVANDERIA/supabase/migrations/20260528005000_delivery_module_feature_flag.sql) | Feature flag + RPC `toggle_delivery_module` |
| [DOCUMENTO_FLUJO_SISTEMA_DELIVERY.md](file:///c:/SISTEMA_%20LAVANDERIA/DOCUMENTO_FLUJO_SISTEMA_DELIVERY.md) | Documentación completa del flujo operativo |
