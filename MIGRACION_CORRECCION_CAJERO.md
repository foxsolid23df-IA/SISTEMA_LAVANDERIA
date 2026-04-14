# 🔄 Migración: Corrección de Cajero en Órdenes y Cancelaciones

## Problema Detectado

1. Las órdenes mostraban "Cajero Prueba" en lugar del nombre real del cajero que las generó.
2. El reporte de cancelaciones no mostraba qué cajero realizó la cancelación.

## Causa Raíz

El sistema no estaba guardando qué empleado (cajero) creó o canceló cada orden. Solo se guardaba el `user_id` del propietario de la tienda, lo que hacía imposible distinguir qué empleado específico realizó cada venta o cancelación.

## Solución Implementada

### 1. **Nuevos campos en la base de datos**

Se agregaron dos campos a la tabla `orders`:

- `created_by_staff_id`: Referencia al empleado que creó la orden
- `cancelled_by_staff_id`: Referencia al empleado que canceló la orden

### 2. **Cambios en el código**

#### `frontend/src/services/orderService.js`

- ✅ `createOrder()`: Ahora guarda `created_by_staff_id` al crear la orden
- ✅ `updateOrderStatus()`: Ahora guarda `cancelled_by_staff_id` al cancelar
- ✅ `getOrders()`: Incluye join con tabla `staff` para obtener nombre del cajero (creador y cancelador)
- ✅ `getOrdersByStatus()`: Incluye join con tabla `staff`
- ✅ `getOrdersInRange()`: Incluye join con tabla `staff`
- ✅ `getOrdersSince()`: Incluye join con tabla `staff`
- ✅ `getOrdersBySession()`: Incluye join con tabla `staff`

#### `frontend/src/components/sales/Sales.jsx`

- ✅ `finalizeOrder()`: Envía `created_by_staff_id` al crear la orden (usa `activeStaff.id`)

#### `frontend/src/components/sales/Orders.jsx`

- ✅ Importa `useAuth` para obtener `activeStaff`
- ✅ `handleStatusChange()`: Pasa `activeStaff.id` al cancelar una orden
- ✅ `getEmployeeName()`: Ahora recibe la orden completa y extrae `order.staff.name`
- ✅ Fallback: Muestra "Sistema" para órdenes antiguas sin información de staff

#### `frontend/src/components/reports/CancellationsReport.jsx`

- ✅ `loadCancellations()`: Incluye join con `cancelled_by_staff` para obtener nombre del cajero
- ✅ Tabla de cancelaciones: Nueva columna "Cancelado por"
- ✅ Exportación Excel: Incluye campo "Cajero que Canceló"

## 📋 Pasos para Aplicar la Migración

### PASO 1: Ejecutar SQL en Supabase

1. Abre tu proyecto en **Supabase Dashboard**
2. Ve a **SQL Editor**
3. Crea una nueva query y pega el contenido del archivo:
   ```
   add_staff_id_to_orders.sql
   ```
4. Ejecuta la query
5. Verifica que aparezca un mensaje de éxito

**Contenido del SQL:**

```sql
-- Migración: Agregar campos de seguimiento de empleados a la tabla orders

-- 1. Agregar la columna created_by_staff_id si no existe
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS created_by_staff_id BIGINT REFERENCES public.staff(id);

-- 2. Agregar la columna cancelled_by_staff_id si no existe (para rastrear quién canceló)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cancelled_by_staff_id BIGINT REFERENCES public.staff(id);

-- 3. Agregar índices para mejorar rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_orders_created_by_staff ON public.orders(created_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_by_staff ON public.orders(cancelled_by_staff_id);

-- Agregar comentarios a las columnas
COMMENT ON COLUMN public.orders.created_by_staff_id IS 'ID del empleado (staff) que creó esta orden. NULL para órdenes antiguas.';
COMMENT ON COLUMN public.orders.cancelled_by_staff_id IS 'ID del empleado (staff) que canceló esta orden. NULL si no ha sido cancelada o es antigua.';
```

### PASO 2: Desplegar el código actualizado

Si estás usando **Vercel**:

```bash
git add .
git commit -m "fix: track cashier name in orders using created_by_staff_id"
git push
```

Si estás en **desarrollo local**:

```bash
cd frontend
npm run dev
```

### PASO 3: Verificar la migración

1. **Inicia sesión** con un cajero (no el propietario)
2. **Crea una nueva orden** de prueba
3. Ve a la sección **Gestión de Órdenes**
4. **Verifica** que la orden muestre el nombre del cajero correcto (no "Cajero Prueba")

## 🎯 Resultados Esperados

### ✅ Órdenes NUEVAS (después de la migración)

- Muestran el **nombre real del cajero** que creó la orden
- Ejemplo: "👤 Juan Pérez" en lugar de "👤 Cajero Prueba"

### ✅ Reporte de Cancelaciones

- Nueva columna "Cancelado por" que muestra el nombre del cajero que realizó la cancelación
- Exportación a Excel incluye el campo "Cajero que Canceló"

### ⚠️ Órdenes ANTIGUAS (antes de la migración)

- Muestran "Sistema" o "N/A" como fallback
- Esto es esperado ya que no se guardó información del cajero original

## 🔍 Estructura de Datos

### Antes (problema):

```javascript
order = {
  id: 123,
  user_id: "uuid-propietario", // ❌ Solo el ID del dueño
  customers: { name: "Cliente" },
  // No hay forma de saber qué cajero creó la orden
};
```

### Después (solución):

```javascript
order = {
  id: 123,
  user_id: "uuid-propietario",
  created_by_staff_id: 5, // ✅ ID del cajero que creó
  cancelled_by_staff_id: 8, // ✅ ID del cajero que canceló (si aplica)
  staff: {
    // ✅ Join automático - creador
    id: 5,
    name: "Juan Pérez",
    role: "cajero",
  },
  cancelled_by_staff: {
    // ✅ Join automático - cancelador
    id: 8,
    name: "María López",
    role: "admin",
  },
  customers: { name: "Cliente" },
};
```

## 📝 Notas Importantes

1. **Las órdenes antiguas no se actualizan**: Solo las nuevas órdenes tendrán el nombre del cajero
2. **Si un cajero es eliminado**: Las órdenes que creó/canceló seguirán mostrando su nombre (historial)
3. **Compatibilidad**: El sistema maneja graceful fallback para órdenes sin información de staff
4. **Índices de rendimiento**: Se crearon índices en `created_by_staff_id` y `cancelled_by_staff_id` para consultas rápidas

## 🧪 Testing Checklist

- [ ] SQL ejecutado correctamente en Supabase
- [ ] Código desplegado en producción
- [ ] Login con cajero (no propietario)
- [ ] Crear orden de prueba
- [ ] Verificar que muestra nombre correcto del cajero
- [ ] Verificar que órdenes antiguas muestran "Sistema"
- [ ] Cancelar una orden de prueba
- [ ] Verificar que el reporte de cancelaciones muestra "Cancelado por" con el nombre correcto
- [ ] Exportar cancelaciones a Excel y verificar campo "Cajero que Canceló"
- [ ] Probar con múltiples cajeros diferentes
- [ ] Verificar vista Kanban y Grid muestran el nombre

## 🚨 Troubleshooting

### Si las órdenes nuevas siguen mostrando "Sistema":

1. Verifica que el SQL se ejecutó correctamente
2. Verifica que el cajero tiene un `id` válido en la tabla `staff`
3. Revisa la consola del navegador por errores
4. Confirma que `activeStaff` está definido en `useAuth()`

### Si aparece error de base de datos:

1. Verifica que la tabla `staff` existe
2. Verifica que `created_by_staff_id` se agregó correctamente
3. Revisa las políticas RLS en Supabase

---

**Fecha de migración**: 13 de abril de 2026  
**Versión**: 1.0.0  
**Autor**: Sistema de Lavandería
