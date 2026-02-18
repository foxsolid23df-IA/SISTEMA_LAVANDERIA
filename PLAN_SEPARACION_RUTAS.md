# Plan de Arquitectura v2.0: Separación Total de Rutas

> **Estado:** Propuesta para Futura Implementación (v2.0)
> **Objetivo:** Desacoplar la lógica de "Punto de Venta" (Caja/Terminal) de la lógica de "Administración" (Gestión).

## 1. El Problema Actual

Actualmente, el sistema usa un único `PrivateLayout` que envuelve **toda** la aplicación. Este layout asume que para operar, el usuario necesita una "Sesión de Caja" y una "Terminal Configurada".

Esto obliga a crear excepciones (hacks) como el `adminMode` para que los administradores puedan entrar sin caja.

## 2. La Solución Propuesta: Arquitectura de Doble Layout

La idea central es dividir la aplicación en dos grandes áreas a nivel de rutas (`react-router-dom`), cada una con sus propias reglas de negocio.

### Estructura de Rutas Propuesta

```jsx
<Routes>
  {/* Rutas Públicas (Sin cambios) */}
  <Route path="/login" element={<Login />} />

  {/* ÁREA 1: PUNTO DE VENTA (Requiere Terminal + Caja) */}
  <Route element={<POSLayout />}>
    <Route path="/pos" element={<Sales />} />
    <Route path="/pos/orders" element={<Orders />} />
    <Route path="/pos/cuts" element={<CashCut />} />
  </Route>

  {/* ÁREA 2: ADMINISTRACIÓN (Solo requiere Auth + Rol Admin) */}
  <Route element={<AdminLayout />}>
    <Route path="/admin" element={<AdminPanel />} />
    <Route path="/admin/inventory" element={<Inventory />} />
    <Route path="/admin/users" element={<Users />} />
    {/* ...otras rutas de gestión */}
  </Route>

  {/* Redirección Inteligente */}
  <Route path="/" element={<SmartRedirect />} />
</Routes>
```

---

## 3. Implementación Paso a Paso

### Paso 1: Crear `POSLayout.jsx`

Este reemplazará al actual `PrivateLayout` pero **SOLO** para las rutas de venta.

- **Responsabilidad:** Verificar Terminal y Sesión de Caja.
- **Comportamiento:** Si no hay caja, redirige a `/pos/teup` (Configuración de Terminal).

### Paso 2: Crear `AdminLayout.jsx`

Un nuevo layout exclusivo para la gestión.

- **Responsabilidad:** Verificar Rol de Usuario (Admin/Gerente).
- **Comportamiento:**
  - **NO** verifica terminal.
  - **NO** verifica sesión de caja.
  - **NO** carga el contexto de ventas innecesariamente.
  - Si no es admin, redirige a `/pos` o `/login`.

### Paso 3: Refactorizar `Sidebar.jsx`

El Sidebar actual mezcla botones de venta ("Ventas", "Corte") con botones de gestión ("Admin Panel").

- **Cambio:** El Sidebar debe ser "consciente del contexto".
  - Si estoy en `/pos`: Muestra menú de Cajero.
  - Si estoy en `/admin`: Muestra menú de Gestión (o usar el sidebar propio del AdminPanel).

### Paso 4: Componente `SmartRedirect`

Un componente invisible en la ruta raíz `/` que decide a dónde mandar al usuario al loguearse:

- **Si es Cajero:** -> `/pos`
- **Si es Admin:** -> `/admin` (o preguntar "¿A dónde quieres ir?")

---

## 4. Ventajas de esta Arquitectura

1.  **Limpieza de Código:** Se eliminan los `if (adminMode)` dispersos por todo el código.
2.  **Performance:** El área de administración no carga librerías de impresión térmica ni sockets de báscula.
3.  **Seguridad:** Es imposible que un cajero entre a admin "por error" de un flag, ya que las rutas están separadas por layouts distintos.
4.  **Escalabilidad:** Permite tener administradores remotos (desde casa) que nunca tocan el código de "Caja".

## 5. Plan de Migración (Estrategia Segura)

Dado que esto es un cambio mayor ("Breaking Change"), se recomienda:

1.  Crear una rama `refactor/router-v2`.
2.  Mover primero las rutas de Admin a su propio layout.
3.  Probar exhaustivamente que el Admin no pierda acceso a datos globales (AuthContext).
4.  Luego, aislar las rutas de POS.
5.  Finalmente, probar los flujos cruzados (un Admin yendo a vender).
