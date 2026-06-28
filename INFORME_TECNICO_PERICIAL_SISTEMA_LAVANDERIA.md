# Informe tecnico del sistema de lavanderia / POS

**Proyecto revisado:** Sistema de Lavanderia / POS Multicaja / SaaS  
**Fecha de revision tecnica:** 2026-06-01  
**Rama Git revisada:** `Sistema_delivery`  
**Commit Git identificado:** `13a2e60979b8676b5894b5f5d4a376f7b4b17b6b`  
**Directorio de trabajo revisado:** `C:\SISTEMA_ LAVANDERIA`  
**Proposito del documento:** describir profesionalmente como esta desarrollado el sistema, sus tecnologias, arquitectura, modulos, flujos operativos y evidencias tecnicas localizadas en el repositorio.

> Nota de alcance: este documento es un informe tecnico de software elaborado a partir de la revision del repositorio local. No constituye asesoria legal ni dictamen juridico. Para su uso en juicio, se recomienda anexar copia integra del repositorio, evidencia de cadena de custodia digital, hash de archivos relevantes y, en su caso, ratificacion por perito autorizado.

---

## 1. Resumen ejecutivo

El proyecto corresponde a un sistema integral para operacion de lavanderia/tintoreria y punto de venta. El repositorio no contiene una aplicacion aislada, sino un ecosistema completo compuesto por:

- Aplicacion web principal para punto de venta, inventario, ordenes, clientes, caja, reportes, administracion, licencias, delivery y configuracion.
- Backend local en Node.js/Express con base de datos SQLite para ejecucion offline en equipos de escritorio.
- Aplicacion de escritorio empaquetable con Electron, incluyendo autoactualizaciones e integracion con impresoras, bascula y backend local.
- Backend cloud basado en Supabase: autenticacion, PostgreSQL, Row Level Security, funciones RPC, storage y Edge Functions.
- Portal de facturacion separado, construido tambien con React/Vite, para operaciones fiscales y CFDI.
- Aplicacion movil Android/Capacitor que consume el build web.
- Modulo delivery con portal de repartidor, seguimiento publico por token, notificaciones WhatsApp/SMS, evidencia fotografica y control de pagos/abonos.

La arquitectura demuestra un enfoque hibrido: operacion en nube con Supabase y tolerancia local para escenarios sin internet mediante SQLite/Electron. El sistema esta disenado para multiples tiendas o clientes bajo un modelo SaaS, con aislamiento por `user_id`, politicas RLS y controles por rol.

---

## 2. Identificacion tecnica del repositorio

### 2.1 Manifiestos principales

| Area | Archivo | Hallazgo |
|---|---|---|
| Raiz / escritorio | `package.json` | Define app Electron, scripts de build, Electron Builder, OpenAI SDK y publicacion GitHub. |
| Frontend principal | `frontend/package.json` | React 19, Vite, Supabase JS, React Router, Recharts, SweetAlert2, Vitest, XLSX. |
| Backend local | `backend/package.json` | Express, Sequelize, SQLite3, JWT, bcryptjs, dotenv, CORS, XLSX y Groq SDK. |
| Movil | `mobile_app/package.json` | Capacitor Core/Android para empaquetar la aplicacion como Android. |
| Portal fiscal | `portal-facturacion/package.json` | React/Vite, Supabase JS, Tailwind, Lucide, SweetAlert2. |

### 2.2 Estado Git observado

Durante la revision se observo un arbol de trabajo con elementos no confirmados en Git, entre ellos documentacion y carpetas de videos/demos. Esto debe considerarse si el documento se usa como evidencia, porque el commit identifica una base historica, mientras que los archivos no versionados pueden contener cambios posteriores.

Archivos/carpetas no versionados observados:

- `DOCUMENTO_FLUJO_SISTEMA_DELIVERY.md`
- `GUIA_REACTIVACION_LICENCIAS_SUPABASE.md`
- `public/logo_nexum.png`
- `scratch/`
- `video-comercial-sistema/`
- `video-explicativo-bascula/`
- `video-hook/`

Tambien se observo modificacion en:

- `supabase/.temp/cli-latest`

---

## 3. Tecnologias utilizadas

### 3.1 Frontend principal

La interfaz principal esta desarrollada con:

- **React 19.1.1**: construccion de componentes, vistas y estado de UI.
- **Vite 7.1.1**: empaquetado y servidor de desarrollo.
- **React Router DOM 7.8.0**: enrutamiento por vistas.
- **Supabase JS 2.90.1**: autenticacion, consultas, RPC, storage y Edge Functions.
- **Recharts**: graficas y estadisticas.
- **SweetAlert2**: alertas y confirmaciones.
- **html5-qrcode**: lectura de codigos QR/codigos visuales.
- **xlsx**: importacion/exportacion de datos Excel.
- **Vitest + Testing Library**: pruebas unitarias y de componentes.

Evidencia: `frontend/package.json`, `frontend/src/App.jsx`, `frontend/src/router/routing.jsx`, `frontend/src/supabase.js`.

### 3.2 Backend local

El backend local esta desarrollado con:

- **Node.js**.
- **Express 5.2.1**: API REST local.
- **Sequelize 6.37.7**: ORM para modelos locales.
- **SQLite3**: persistencia local en archivo.
- **dotenv**: variables de entorno.
- **CORS**: comunicacion entre frontend y API local.
- **bcryptjs / jsonwebtoken**: soporte de autenticacion/seguridad en rutas locales.

Evidencia: `backend/package.json`, `backend/index.js`, `backend/db/conexion.js`, `backend/models/*.js`, `backend/routes/*.js`.

### 3.3 Backend cloud / BaaS

El sistema utiliza **Supabase** como backend en la nube:

- **Supabase Auth** para autenticacion de usuarios.
- **PostgreSQL** como base de datos principal.
- **Row Level Security (RLS)** para aislamiento multi-tenant.
- **RPC SQL** para operaciones transaccionales y de administracion.
- **Supabase Storage** para imagenes/evidencias.
- **Supabase Edge Functions** en TypeScript/Deno para procesos seguros del lado servidor.

Evidencia: `supabase_schema.sql`, `supabase/migrations/*.sql`, `supabase/functions/*/index.ts`.

### 3.4 Escritorio

La aplicacion de escritorio se implementa con:

- **Electron 39.2.7**.
- **Electron Builder** para instalador Windows NSIS.
- **electron-updater** para actualizaciones automaticas.
- **electron-log** para registro de eventos.
- **Preload script** con aislamiento de contexto.
- Integracion con impresoras del sistema.
- Gestion de puerto serial para bascula mediante Web Serial API en Electron.
- Backend local iniciado como proceso auxiliar.

Evidencia: `package.json`, `electron-main.js`, `preload.js`.

### 3.5 Movil

La parte movil esta preparada con:

- **Capacitor 8.1.0**.
- Proyecto Android nativo en `mobile_app/android`.
- Configuracion `appId`: `com.foxsolid.lavanderia`.
- `webDir`: `../dist`, reutilizando el build web.

Evidencia: `mobile_app/capacitor.config.ts`, `mobile_app/android/*`.

### 3.6 Portal de facturacion

Existe un portal fiscal independiente:

- React 19.
- Vite.
- Supabase JS.
- Tailwind CSS.
- React Router.
- Integracion visual con assets propios.

Evidencia: `portal-facturacion/package.json`, `portal-facturacion/src/App.jsx`, `portal-facturacion/src/supabase.js`.

---

## 4. Arquitectura general

### 4.1 Vision de alto nivel

```text
Usuario / Cajero / Administrador
        |
        v
Frontend React + Vite
        |
        +--> Supabase Auth / PostgreSQL / Storage / RPC / Edge Functions
        |
        +--> Backend local Express (Electron)
                |
                v
              SQLite local
```

En modo web, la aplicacion opera principalmente contra Supabase. En modo escritorio Electron, la aplicacion puede comunicarse con un backend local en `127.0.0.1:3001`, el cual persiste datos en SQLite para continuidad operativa.

### 4.2 Separacion de responsabilidades

| Capa | Responsabilidad |
|---|---|
| `frontend/src/components` | Vistas y componentes funcionales. |
| `frontend/src/services` | Capa de acceso a datos, Supabase, RPC, Edge Functions y API local. |
| `frontend/src/hooks` | Estado de autenticacion, carrito, conectividad, escala, filtros y scanner. |
| `frontend/src/contexts` | Estado global de productos y configuracion. |
| `backend/controllers` | Logica de endpoints locales. |
| `backend/routes` | Declaracion de rutas REST locales. |
| `backend/models` | Modelos Sequelize para SQLite. |
| `supabase/migrations` | Evolucion del esquema cloud PostgreSQL. |
| `supabase/functions` | Logica serverless segura y automatizaciones externas. |
| `electron-main.js` | Ciclo de vida de escritorio, impresion, updates, backend local y dispositivos. |

---

## 5. Modulos funcionales identificados

### 5.1 Autenticacion y sesion

El sistema usa Supabase Auth para usuarios propietarios/tiendas. Ademas, maneja un concepto de empleado activo mediante PIN local/operativo. El `AuthProvider` administra:

- Sesion Supabase.
- Perfil de tienda.
- Empleado activo.
- Bloqueo de pantalla.
- Modo administrador.
- Validacion de terminal.
- Sesion de caja.
- Verificacion de permisos.

Evidencia: `frontend/src/hooks/useAuth.jsx`, `frontend/src/router/routing.jsx`, `frontend/src/services/staffService.js`.

### 5.2 Punto de venta

El POS permite registrar ventas, generar tickets, manejar metodos de pago, actualizar stock y emitir datos para facturacion. La venta intenta registrarse en Supabase; si falla la nube o no hay internet, el servicio guarda localmente mediante la API Express.

Evidencia:

- `frontend/src/components/sales/Sales.jsx`
- `frontend/src/components/sales/TicketVenta.jsx`
- `frontend/src/services/salesService.js`
- `backend/routes/saleRoutes.js`
- `backend/controllers/saleController.js`
- `backend/models/Sale.js`

### 5.3 Inventario y servicios

El sistema diferencia productos y servicios. Permite CRUD, imagenes, codigos de barras, stock, stock minimo/maximo, importacion masiva, movimientos y kardex.

Evidencia:

- `frontend/src/components/inventory/Inventory.jsx`
- `frontend/src/components/inventory/InventoryControl.jsx`
- `frontend/src/components/inventory/KardexHistory.jsx`
- `frontend/src/services/productService.js`
- `frontend/src/services/inventoryService.js`
- `supabase/migrations/20260402000000_create_product_inventory_tracking.sql`
- `supabase/migrations/20260402010000_inventory_kardex_setup.sql`

### 5.4 Ordenes de lavanderia

Existe un flujo especifico de ordenes de lavanderia separado de ventas simples. Las ordenes manejan:

- Cliente.
- Items.
- Estado operativo.
- Abonos/pago.
- Folio secuencial.
- Promesa de entrega.
- Soft delete con motivo y empleado.
- Restauracion de stock si se cancela/elimina.

Evidencia:

- `frontend/src/components/sales/Orders.jsx`
- `frontend/src/services/orderService.js`
- `supabase/migrations/20260421180000_folio_counter_and_soft_delete.sql`
- `add_staff_id_to_orders.sql`

### 5.5 Caja, cortes y reportes

El sistema incluye sesiones de caja, fondo inicial, retiros, cortes, reportes de caja y control de cancelaciones.

Evidencia:

- `frontend/src/components/cashcut/CashCut.jsx`
- `frontend/src/components/cashcut/CashWithdrawalModal.jsx`
- `frontend/src/components/reports/CashReportsView.jsx`
- `frontend/src/components/reports/CancellationsReport.jsx`
- `frontend/src/services/cashSessionService.js`
- `frontend/src/services/cashCutService.js`
- `frontend/src/services/cashWithdrawalService.js`
- `supabase/migrations/20260413000000_add_cancellation_tracking.sql`

### 5.6 Clientes

El sistema mantiene directorio de clientes para POS, ordenes y delivery. Los clientes se asocian al usuario/tienda.

Evidencia:

- `frontend/src/components/admin/ClientManager.jsx`
- `frontend/src/services/customerService.js`
- `supabase/migrations/20260527120000_add_delivery_system.sql`

### 5.7 Usuarios, roles y permisos

La aplicacion maneja usuarios/empleados, roles operativos y restricciones de rutas. Entre los roles identificados estan administrador, cajero y roles de delivery como `repartidor` o `chofer`.

Evidencia:

- `frontend/src/components/admin/UserManager.jsx`
- `frontend/src/services/staffService.js`
- `frontend/src/router/routing.jsx`
- `supabase_schema.sql`
- `supabase/migrations/20260527132000_add_staff_phone.sql`

### 5.8 Portal maestro y licencias

Existe una capa de administracion superior para licencias, super administradores, invitaciones, expiracion de clientes y activacion de modulos.

Evidencia:

- `frontend/src/components/admin/MasterLicenseManager.jsx`
- `frontend/src/services/adminLicenseService.js`
- `frontend/src/components/auth/SuperAdminLogin.jsx`
- `frontend/src/components/common/SuperAdminLayout.jsx`
- `supabase/migrations/20260305_super_admins_init.sql`
- `supabase/migrations/EJECUTAR_PRIMERO_super_admin_functions.sql`
- `supabase/functions/admin-create-superadmin/index.ts`
- `supabase/functions/admin-update-password/index.ts`

### 5.9 Delivery y portal repartidor

El modulo Delivery permite gestionar solicitudes de recogida, asignacion de repartidor, evidencia, pagos y seguimiento. El sistema contempla:

- Activacion/desactivacion por tienda.
- Solicitud de recogida desde WhatsApp/webhook.
- Seguimiento publico por `tracking_token`.
- Confirmacion de prendas y preferencia de pago por cliente.
- Cotizacion de tarifa de recogida.
- Asignacion de chofer/repartidor.
- Portal movil para repartidor.
- Sesion de repartidor con token firmado.
- Registro de evidencia fotografica.
- Registro y conciliacion de pagos.
- Notificaciones transaccionales WhatsApp/SMS.

Evidencia:

- `frontend/src/components/delivery/DeliveryDashboard.jsx`
- `frontend/src/components/delivery/DriverPortal.jsx`
- `frontend/src/components/delivery/OrderTracking.jsx`
- `frontend/src/services/deliveryService.js`
- `DOCUMENTO_FLUJO_SISTEMA_DELIVERY.md`
- `supabase/migrations/20260527120000_add_delivery_system.sql`
- `supabase/migrations/20260528001000_secure_delivery_tracking.sql`
- `supabase/migrations/20260528002000_delivery_payment_preferences.sql`
- `supabase/migrations/20260528004000_delivery_pickup_evidence.sql`
- `supabase/migrations/20260528005000_delivery_module_feature_flag.sql`
- `supabase/migrations/20260528006000_delivery_production_hardening.sql`
- `supabase/functions/delivery-actions/index.ts`
- `supabase/functions/get-delivery-tracking/index.ts`
- `supabase/functions/notify-order/index.ts`
- `supabase/functions/handle-whatsapp-webhook/index.ts`
- `supabase/functions/verify-driver-pin/index.ts`

### 5.10 Facturacion electronica

El sistema incluye funcionalidad fiscal:

- Clientes fiscales.
- Emisores fiscales.
- Carga/configuracion CSD.
- Timbrado CFDI mediante Facturama.
- Descarga/persistencia de PDF/XML en base64.
- Cancelacion de CFDI.
- Portal separado de facturacion.

Evidencia:

- `portal-facturacion/`
- `frontend/src/components/config/BillingIssuers.jsx`
- `frontend/src/components/config/BillingPortalModal.jsx`
- `frontend/src/components/config/InvoiceCancellation.jsx`
- `frontend/src/services/billingService.js`
- `supabase/functions/timbrar/index.ts`
- `supabase/functions/timbrar/facturama-service.ts`
- `supabase/functions/cancelar-cfdi/index.ts`
- `supabase/functions/upload-csd/index.ts`
- `supabase/migrations/20240404000000_billing_system.sql`
- `supabase/migrations/20260404_billing_issuers_portals.sql`

### 5.11 Pantalla de cliente, scanner, bascula e impresion

Se identifican componentes de soporte operativo:

- Pantalla de cliente en ruta independiente.
- Scanner/camara.
- Bascula por Web Serial API en Electron.
- Impresion silenciosa de tickets.
- Previsualizacion de tickets.

Evidencia:

- `frontend/src/components/customer/CustomerDisplay.jsx`
- `frontend/src/components/common/CameraScanner.jsx`
- `frontend/src/hooks/scanner/useGlobalScanner.js`
- `frontend/src/services/scaleService.js`
- `frontend/src/services/printService.js`
- `electron-main.js`
- `VALIDACION_CAMARA_ESCRITORIO.md`
- `MANUAL_CONFIGURACION_IMPRESORA.md`

---

## 6. Base de datos y modelo de datos

### 6.1 Base principal Supabase/PostgreSQL

El esquema contiene tablas para:

- `profiles`
- `products`
- `sales`
- `sale_items`
- `staff`
- `cash_cuts`
- `invitation_codes`
- `customers`
- `orders`
- `order_items`
- `cash_sessions`
- `cash_withdrawals`
- `business_settings`
- `supplies`
- `supply_movements`
- `supply_reconciliations`
- `product_movements`
- `product_reconciliations`
- `billing_issuers`
- `billing_portals`
- `clients`
- `invoices`
- `payment_methods`
- `express_services`
- `folio_counters`
- `delivery_orders`
- `delivery_payments`
- `delivery_notification_logs`
- `super_admins`

Evidencia: `supabase_schema.sql` y migraciones en `supabase/migrations`.

### 6.2 Aislamiento multi-tenant

El patron predominante es asociar registros a `user_id` y aplicar politicas RLS del tipo:

```text
auth.uid() = user_id
```

Esto permite que cada tienda/usuario acceda a sus propios datos. Tambien se observan funciones `SECURITY DEFINER` para operaciones administrativas o transaccionales que requieren permisos controlados.

Evidencia:

- `supabase_schema.sql`
- `supabase/migrations/20260227_master_isolation_rls.sql`
- `supabase/migrations/20260227_isolate_business_settings.sql`
- `supabase/migrations/20260528006000_delivery_production_hardening.sql`

### 6.3 Base local SQLite

El backend local crea una base SQLite en:

- Produccion Electron: carpeta de datos dentro de `APPDATA`/usuario.
- Desarrollo: `backend/data`.

Modelo local relevante:

- `Product`
- `Sale`
- `User`
- `Terminal`
- `SystemLog`
- `StoreSetting`
- `Supply`
- `SupplyMovement`
- `WeeklyReconciliation`

Evidencia: `backend/db/conexion.js`, `backend/models/*.js`.

---

## 7. Flujo operativo principal

### 7.1 Flujo POS con nube y respaldo local

1. El usuario inicia sesion con Supabase.
2. Se valida perfil, empleado activo y terminal.
3. El cajero selecciona productos/servicios.
4. El sistema registra la venta en Supabase.
5. Se insertan items de venta.
6. Se descuenta stock por RPC.
7. Se genera ticket, PIN/UUID de facturacion y se imprime si aplica.
8. Si Supabase falla o no hay internet, se guarda venta en SQLite local.
9. Posteriormente, el modulo de sincronizacion sube ventas pendientes a Supabase.

Evidencia: `frontend/src/services/salesService.js`, `backend/routes/saleRoutes.js`, `backend/models/Sale.js`.

### 7.2 Flujo de orden de lavanderia

1. Se crea cliente o se selecciona uno existente.
2. Se obtiene folio secuencial por RPC.
3. Se crea cabecera de orden.
4. Se insertan items.
5. Se descuenta stock cuando aplica.
6. La orden cambia de estado durante el proceso operativo.
7. Si se cancela o elimina, el sistema restaura stock y conserva trazabilidad mediante soft delete.

Evidencia: `frontend/src/services/orderService.js`.

### 7.3 Flujo delivery resumido

1. Cliente envia direccion o ubicacion por WhatsApp.
2. Edge Function `handle-whatsapp-webhook` identifica tienda y cliente.
3. Se crea/actualiza cliente y se registra `delivery_order` en estado `requested`.
4. Se envia link de seguimiento.
5. Sucursal cotiza tarifa de recogida.
6. Cliente confirma prendas/preferencia de pago.
7. Sucursal asigna repartidor.
8. Repartidor opera desde portal movil con sesion validada.
9. Se registra recogida, resumen obligatorio y evidencia opcional.
10. Se registra entrega a sucursal.
11. Se capturan costos, pagos/abonos y conciliacion.
12. Se completa o cancela el pedido.

Evidencia: `DOCUMENTO_FLUJO_SISTEMA_DELIVERY.md`, `frontend/src/services/deliveryService.js`, `supabase/functions/delivery-actions/index.ts`.

---

## 8. Seguridad tecnica observada

### 8.1 Controles implementados

- Autenticacion con Supabase Auth.
- RLS en multiples tablas criticas.
- Aislamiento por `user_id`.
- Rutas protegidas por autenticacion y permisos de rol.
- Validacion de terminal para operacion POS.
- Bloqueo de pantalla por empleado/PIN.
- Portal maestro separado.
- Tracking publico mediante Edge Function en lugar de lectura anonima directa.
- Sesiones de repartidor firmadas con HMAC y vencimiento.
- Restriccion de evidencia fotografica al prefijo de la tienda en Supabase Storage.
- Logs de notificaciones de delivery.
- Soft delete en ordenes para conservar trazabilidad.
- Control de estados validos en delivery mediante constraint SQL y validaciones server-side.

### 8.2 Observaciones de riesgo y mejora

Estas observaciones no invalidan el sistema; se documentan como puntos tecnicos que conviene atender antes de presentar el sistema como evidencia formal:

- Se observaron valores fijos de soporte/sincronizacion en servicios frontend. Deben trasladarse a variables de entorno o mecanismos de secreto controlado.
- Algunas funciones Edge usan `Access-Control-Allow-Origin: *`; para produccion sensible se recomienda restringir origenes cuando sea posible.
- En `supabase/functions/timbrar/index.ts` existe un valor de respaldo para credenciales de Facturama. Debe eliminarse o protegerse mediante variables de entorno reales.
- El README presenta algunos textos con caracteres mal codificados; no afecta necesariamente el codigo, pero conviene normalizar documentacion oficial para presentacion judicial.
- La carpeta `node_modules` existe dentro del repositorio local; para evidencia conviene distinguir codigo fuente propio de dependencias instaladas.
- El arbol de trabajo tenia archivos no versionados. Para cadena de custodia, se recomienda congelar una copia, calcular hashes y documentar exactamente que version fue presentada.

---

## 9. Despliegue y empaquetado

### 9.1 Web / Vercel

El despliegue web usa Vercel:

- Build command: `cd frontend && npm run build`
- Output: `dist`
- Framework: Vite
- Rewrites a `index.html` para SPA.
- Headers de cache para assets y no-cache para HTML.

Evidencia: `vercel.json`, `frontend/vite.config.mjs`.

### 9.2 Escritorio Windows

El empaquetado se realiza con Electron Builder:

- Product name: `Sistema de Ventas`
- Target: NSIS Windows.
- Output: `release`.
- Incluye frontend compilado y backend como recurso adicional.
- Publicacion configurada hacia GitHub.
- Auto updater activo en produccion.

Evidencia: `package.json`, `electron-main.js`.

### 9.3 Android

Capacitor toma el build `dist` y lo empaqueta en el proyecto Android.

Evidencia: `mobile_app/capacitor.config.ts`, `mobile_app/android`.

---

## 10. Pruebas y validacion

El proyecto incluye configuracion de pruebas en frontend:

- Vitest.
- jsdom.
- Testing Library.
- Coverage V8.

Pruebas identificadas:

- `frontend/src/__tests__/cashSessionService.test.js`
- `frontend/src/__tests__/scaleService.test.js`
- `frontend/src/__tests__/salesService.test.js`
- `frontend/src/__tests__/printService.test.js`
- `frontend/src/__tests__/TicketVenta.test.jsx`
- `frontend/src/__tests__/useCart.test.js`

No se ejecuto una suite completa como parte de este documento; el objetivo de esta revision fue documental/arquitectonico. Para presentacion judicial se recomienda anexar reporte de ejecucion de pruebas con fecha, terminal, ambiente y resultados.

---

## 11. Documentacion existente en el repositorio

El repositorio contiene documentacion extensa, entre ella:

- `README.md`
- `MANUAL.md`
- `MANUAL_INTEGRAL_FOXSOLID_2026.md`
- `MANUAL_SEGURIDAD_2026.md`
- `MANUAL_DESPLIEGUE_LOCAL.md`
- `DOCUMENTACION_API.md`
- `DOCUMENTO_FLUJO_SISTEMA_DELIVERY.md`
- `MANUAL_CONFIGURACION_IMPRESORA.md`
- `MANTENIMIENTO_DB_GUIA.md`
- `MANUAL_SUPER_ADMIN.md`
- `MEJORAS_CANCELACIONES.md`
- `GUIA_DESPLIEGUE_VERCEL.md`
- `GUIA_OPERACION_OFFLINE_2026.md`

Esta documentacion sirve como soporte operativo y tecnico, aunque para un procedimiento judicial se recomienda consolidar anexos numerados y controlar versiones.

---

## 12. Conclusiones tecnicas

1. El proyecto corresponde a un sistema comercial completo de lavanderia/POS con arquitectura hibrida cloud/local.
2. El frontend principal esta desarrollado con React y Vite, y consume Supabase como backend cloud.
3. El backend local usa Express, Sequelize y SQLite para continuidad operativa en escritorio.
4. La aplicacion de escritorio usa Electron, integra impresion, autoactualizaciones, backend local y soporte para dispositivos como bascula.
5. La base de datos cloud esta modelada en PostgreSQL/Supabase con politicas RLS y migraciones historicas.
6. El sistema esta preparado para multi-tienda/SaaS mediante aislamiento por `user_id`.
7. El modulo delivery es una extension funcional completa con tracking publico, portal repartidor, WhatsApp, evidencia y pagos.
8. Existe soporte fiscal mediante portal de facturacion y Edge Functions para timbrado/cancelacion CFDI.
9. El repositorio contiene documentacion, scripts, pruebas, recursos de marketing y builds/artefactos relacionados.
10. Para uso judicial, conviene preservar una copia inalterada del repositorio, registrar hashes, limpiar o clasificar secretos y anexar evidencias de ejecucion.

---

## 13. Anexos sugeridos para juicio

Para robustecer la presentacion del sistema en contexto juridico, se recomienda preparar:

- Captura del commit y rama revisada.
- Exportacion ZIP del repositorio fuente sin `node_modules`, salvo que se requiera reproducibilidad offline.
- Hash SHA-256 del ZIP presentado.
- Reporte de `npm audit` si se pretende discutir seguridad de dependencias.
- Reporte de pruebas automatizadas (`npm test` en frontend).
- Capturas de pantalla de modulos principales.
- Diagrama de arquitectura firmado/fechado.
- Copia de migraciones SQL aplicadas.
- Copia de variables de entorno con secretos censurados.
- Video corto de flujo POS, flujo orden y flujo delivery.
- Bitacora de despliegue Vercel/Supabase si se requiere acreditar operacion en nube.

---

## 14. Archivos clave de evidencia tecnica

| Archivo | Importancia |
|---|---|
| `package.json` | Define version, build Electron, empaquetado, dependencias raiz. |
| `frontend/package.json` | Dependencias del frontend principal. |
| `frontend/src/router/routing.jsx` | Rutas, protecciones, modulos y portal delivery. |
| `frontend/src/hooks/useAuth.jsx` | Autenticacion, empleado activo, bloqueo y modo admin. |
| `frontend/src/services/salesService.js` | Registro de ventas nube/local y sincronizacion. |
| `frontend/src/services/orderService.js` | Ordenes, folios, estados, cancelacion y soft delete. |
| `frontend/src/services/deliveryService.js` | API cliente del modulo delivery. |
| `backend/index.js` | Servidor Express local y rutas. |
| `backend/db/conexion.js` | Ubicacion/configuracion SQLite. |
| `backend/models/Sale.js` | Modelo local de ventas offline. |
| `backend/models/Product.js` | Modelo local de productos. |
| `electron-main.js` | Escritorio, backend local, impresoras, bascula, auto updater. |
| `supabase_schema.sql` | Esquema inicial principal. |
| `supabase/migrations` | Historial de evolucion de base de datos. |
| `supabase/functions/delivery-actions/index.ts` | Acciones server-side de delivery. |
| `supabase/functions/get-delivery-tracking/index.ts` | Tracking publico controlado. |
| `supabase/functions/notify-order/index.ts` | Notificaciones WhatsApp/SMS y logging. |
| `supabase/functions/timbrar/index.ts` | Timbrado CFDI. |
| `portal-facturacion/package.json` | Portal fiscal independiente. |
| `mobile_app/capacitor.config.ts` | Empaquetado Android. |

