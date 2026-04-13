# Mejoras en el Sistema de Cancelaciones - Documentación Técnica

## Fecha: 13 de abril de 2026
## Versión: 1.5.0

---

## 📋 Resumen de Cambios

Se ha implementado un sistema completo para manejar las cancelaciones de órdenes en el cierre de caja y tickets de impresión, además de agregar un reporte dedicado para visualizar todas las cancelaciones.

---

## 🔧 Archivos Modificados

### 1. **cashCutService.js** - Servicio de Corte de Caja
**Ubicación:** `frontend/src/services/cashCutService.js`

#### Cambios Realizados:
- **Separación de órdenes canceladas:** Ahora el servicio separa las órdenes con `status === 'cancelled'` de las ventas activas
- **Cálculo independiente por método de pago:** 
  - `cancelledCash`: Total de cancelaciones pagadas en efectivo
  - `cancelledCard`: Total de cancelaciones pagadas con tarjeta
  - `cancelledTransfer`: Total de cancelaciones pagadas con transferencia
- **Actualización de `getCurrentShiftSummary`:**
  - Retorna `cancelledOrders`, `cancelledCount`, `cancelledTotal` y desglose por método de pago
  - Las ventas activas se calculan por separado para no afectar los totales esperados

#### Ejemplo de uso:
```javascript
const summary = await cashCutService.getCurrentShiftSummary('turno');
console.log(summary.cancelledCount); // Número de órdenes canceladas
console.log(summary.cancelledTotal); // Monto total cancelado
console.log(summary.cancelledCash); // Monto cancelado en efectivo
```

---

### 2. **CashCut.jsx** - Componente de Corte de Caja
**Ubicación:** `frontend/src/components/cashcut/CashCut.jsx`

#### Cambios Realizados:
- **Función `processSummaryData`:**
  - Filtra ventas activos vs cancelados
  - Calcula el efectivo esperado **restando** las cancelaciones en efectivo
  - Agrega datos de cancelaciones al resumen retornado

- **Función `executeCut`:**
  - Ahora incluye datos de cancelaciones en `cutData`:
    ```javascript
    {
      cancelledCount: 2,
      cancelledTotal: 240.00,
      cancelledCash: 240.00,
      cancelledCard: 0,
      cancelledTransfer: 0,
      cancelledOrders: [...] // Array de órdenes canceladas
    }
    ```

#### Impacto en el Cálculo:
**ANTES:**
```
Efectivo Esperado = Fondo Inicial + Ventas en Efectivo - Retiros
```

**AHORA:**
```
Efectivo Esperado = Fondo Inicial + Ventas en Efectivo - Cancelaciones Efectivo - Retiros
```

---

### 3. **TicketCorte.jsx** - Ticket de Corte de Caja
**Ubicación:** `frontend/src/components/cashcut/TicketCorte.jsx`

#### Cambios Realizados:
- **Nueva sección de cancelaciones en el ticket:**
  - Se muestra **antes** de los retiros/gastos
  - Formato:
    ```
    CANCELACIONES (2):
    -$240.00
    - #011394 - Esteban Diaz     $240.00
    - #011395 - Otro Cliente     $150.00
    ```
  - Color rojo para destacar visualmente
  - Incluye folio/número y nombre del cliente

---

### 4. **orderService.js** - Servicio de Órdenes
**Ubicación:** `frontend/src/services/orderService.js`

#### Nuevo Método: `getCancellationStatistics`
```javascript
async getCancellationStatistics(signal)
```

**Retorna:**
```javascript
{
  all: { count: 10, total: 2400, byMethod: { cash: 1200, card: 800, ... } },
  today: { count: 2, total: 480, byMethod: {...} },
  week: { count: 5, total: 1200, byMethod: {...} },
  month: { count: 10, total: 2400, byMethod: {...} }
}
```

**Uso:** Este método puede ser utilizado en el dashboard para mostrar estadísticas de cancelaciones.

---

### 5. **Sidebar.jsx** - Navegación Lateral
**Ubicación:** `frontend/src/components/sidebar/Sidebar.jsx`

#### Cambios Realizados:
- Agregado nuevo enlace de navegación:
  ```jsx
  <NavLink to="/reporte-cancelaciones">
    <span className="material-icons-outlined">cancel</span>
    <span>Cancelaciones</span>
  </NavLink>
  ```
- **Permiso requerido:** `canViewAudit` (mismo que Auditoría)
- **Icono:** `cancel` (Material Icons)

---

### 6. **routing.jsx** - Enrutador Principal
**Ubicación:** `frontend/src/router/routing.jsx`

#### Cambios Realizados:
- Importación del nuevo componente:
  ```javascript
  import CancellationsReport from "../components/reports/CancellationsReport";
  ```

- Nueva ruta registrada:
  ```javascript
  <Route 
    path="/reporte-cancelaciones" 
    element={
      <PrivateLayout>
        <CancellationsReport />
      </PrivateLayout>
    } 
  />
  ```

---

## 📁 Archivos Nuevos

### 1. **CancellationsReport.jsx** - Componente de Reporte
**Ubicación:** `frontend/src/components/reports/CancellationsReport.jsx`

#### Características:
- **Filtros:**
  - Rango de fechas (inicio/fin)
  - Búsqueda por folio, cliente o notas

- **Tarjetas de Resumen:**
  - Total de cancelaciones (cantidad)
  - Monto total cancelado
  - Desglose por método de pago (efectivo, tarjeta, transferencia, dólares)

- **Tabla de Datos:**
  - Fecha y hora
  - Folio de la orden
  - Nombre del cliente
  - Total cancelado
  - Método de pago
  - Notas

- **Exportación a Excel:**
  - Botón "📊 Exportar Excel"
  - Genera archivo `.xlsx` con todas las cancelaciones del período

#### Estructura del Componente:
```jsx
<CancellationsReport>
  ├── Filtros (fecha inicio, fecha fin, búsqueda)
  ├── Summary Cards (4 tarjetas con estadísticas)
  └── Tabla de Cancelaciones
      └── Botón de Exportar Excel
</CancellationsReport>
```

---

### 2. **CancellationsReport.css** - Estilos
**Ubicación:** `frontend/src/components/reports/CancellationsReport.css`

#### Características:
- Diseño responsive (mobile-friendly)
- Tarjetas con hover effect
- Badges de colores para métodos de pago:
  - 🟢 Efectivo: `#d1fae5` / `#065f46`
  - 🔵 Tarjeta: `#dbeafe` / `#1e40af`
  - 🟡 Transferencia: `#fef3c7` / `#92400e`
  - 🟣 Dólares: `#ede9fe` / `#5b21b6`

---

### 3. **20260413000000_add_cancellation_tracking.sql** - Migración de Base de Datos
**Ubicación:** `supabase/migrations/20260413000000_add_cancellation_tracking.sql`

#### Nuevas Columnas en `cash_cuts`:
```sql
ALTER TABLE cash_cuts
ADD COLUMN cancelled_count INTEGER DEFAULT 0,
ADD COLUMN cancelled_total DECIMAL(10,2) DEFAULT 0,
ADD COLUMN cancelled_cash DECIMAL(10,2) DEFAULT 0,
ADD COLUMN cancelled_card DECIMAL(10,2) DEFAULT 0,
ADD COLUMN cancelled_transfer DECIMAL(10,2) DEFAULT 0;
```

#### ⚠️ IMPORTANTE:
Debes ejecutar esta migración en tu base de datos de Supabase para que el sistema funcione correctamente.

**Pasos para aplicar la migración:**
1. Ve a tu proyecto en Supabase
2. Navega a "SQL Editor"
3. Copia y pega el contenido del archivo de migración
4. Ejecuta el script

---

## 🎯 Flujo de Funcionamiento

### Cuando se Cancela una Orden:

1. **Orden se marca como cancelada:**
   ```javascript
   await orderService.updateOrderStatus(orderId, 'cancelled');
   ```

2. **El stock se restaura automáticamente:**
   - Llamada a `increment_stock` RPC
   - Productos vuelven a estar disponibles

3. **En el próximo Cierre de Caja:**
   - La orden cancelada aparece en `cancelledOrders`
   - Se resta del efectivo esperado si fue pagada en efectivo
   - Se muestra en el ticket de corte con detalle

### Ejemplo de Ticket de Corte con Cancelaciones:

```
=====================================
         MI LAVANDERIA PRO
        CORTE DE TURNO
      13/04/2026 02:30 PM
-------------------------------------
Operador: Juan Pérez
Terminal: Caja Principal
-------------------------------------
FONDO INICIAL:              $500.00
EFECTIVO:                  $1,240.00
TARJETA:                     $800.00
-------------------------------------
CANCELACIONES (2):          -$390.00
- #011394 - Esteban Diaz     $240.00
- #011395 - María Lopez      $150.00
-------------------------------------
RETIROS (1):                 -$200.00
- Pago a proveedor           $200.00
-------------------------------------
TOTAL VENTAS (15):          $2,740.00
-------------------------------------
EFECTIVO ESPERADO MXN:     $1,050.00
EFECTIVO CONTADO MXN:      $1,050.00
DIFERENCIA:                  CORRECTO ✓
=====================================
```

---

## 📊 Reporte de Cancelaciones

### Acceso:
- **URL:** `/reporte-cancelaciones`
- **Menú Lateral:** Icono "Cancelaciones" (requiere permiso de auditoría)

### Funcionalidades:

1. **Filtrado por Fechas:**
   - Por defecto: últimos 7 días
   - Selector de fecha inicio y fin

2. **Búsqueda:**
   - Por folio de orden
   - Por nombre de cliente
   - Por notas/comentarios

3. **Estadísticas en Tiempo Real:**
   - Número total de cancelaciones
   - Monto total cancelado
   - Desglose por método de pago

4. **Exportación:**
   - Click en "📊 Exportar Excel"
   - Archivo generado: `Cancelaciones_YYYY-MM-DD_YYYY-MM-DD.xlsx`

---

## 🔐 Permisos Requeridos

Para acceder al reporte de cancelaciones, el usuario necesita:
- **Permiso:** `canViewAudit` (Ver Auditoría)
- **Roles típicos:** Admin, Gerente, Propietario

---

## 🧪 Pruebas Recomendadas

### 1. Probar Cancelación en Orden:
```
1. Crear una orden (#011394 - Esteban Diaz - $240)
2. Marcar la orden como "cancelled"
3. Verificar que el stock se restauró
```

### 2. Probar Cierre de Caja con Cancelaciones:
```
1. Realizar varias ventas (al menos una en efectivo)
2. Cancelar al menos una orden pagada en efectivo
3. Realizar el cierre de caja
4. Verificar en el ticket:
   - Sección "CANCELACIONES" aparece
   - Monto se resta del esperado
   - Detalle de órdenes canceladas es correcto
```

### 3. Probar Reporte de Cancelaciones:
```
1. Navegar a "/reporte-cancelaciones"
2. Verificar que aparecen todas las cancelaciones
3. Probar filtros de fecha y búsqueda
4. Exportar a Excel y verificar datos
```

---

## 🐛 Solución de Problemas

### Problema: Las cancelaciones no aparecen en el corte
**Causa:** Migración de base de datos no aplicada
**Solución:** Ejecutar el script SQL `20260413000000_add_cancellation_tracking.sql`

### Problema: El monto cancelado no se resta del esperado
**Causa:** La orden no tiene `status === 'cancelled'`
**Solución:** Verificar que el estado sea exactamente "cancelled" (minúsculas)

### Problema: El reporte muestra datos incorrectos
**Causa:** Problema de filtrado de fechas
**Solución:** Verificar formato de fechas (YYYY-MM-DD)

---

## 📈 Mejoras Futuras Sugeridas

1. **Dashboard de Cancelaciones:**
   - Agregar tarjeta de estadísticas en `/estadisticas`
   - Gráfico de tendencia de cancelaciones

2. **Motivo de Cancelación:**
   - Agregar campo "reason" al cancelar órdenes
   - Reporte de motivos más frecuentes

3. **Alertas:**
   - Notificación si cancelaciones exceden cierto monto
   - Alerta de posible fraude

4. **Auditoría:**
   - Log de quién canceló y cuándo
   - Requisito de PIN para cancelaciones mayores a $X

---

## ✨ Beneficios de Estas Mejoras

1. **Control Financiero:**
   - Las cancelaciones ahora se reflejan correctamente en el cierre de caja
   - Se puede auditar cuánto dinero se canceló y cómo

2. **Transparencia:**
   - El ticket de corte muestra todas las cancelaciones con detalle
   - Se puede rastrear cada orden cancelada

3. **Reportes Dedicados:**
   - Acceso rápido a todas las cancelaciones
   - Exportación a Excel para análisis externo

4. **Prevención de Fraude:**
   - Las cancelaciones no desaparecen del sistema
   - Se pueden auditar fácilmente

---

## 📞 Soporte

Si encuentras algún problema con estas mejoras:
1. Verifica que la migración de base de datos esté aplicada
2. Revisa la consola del navegador por errores
3. Limpia caché del navegador
4. Contacta al equipo de desarrollo

---

**Implementado por:** Qwen Code AI Assistant  
**Fecha de implementación:** 13 de abril de 2026  
**Versión del sistema:** 1.5.0
