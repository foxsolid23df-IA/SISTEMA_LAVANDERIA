# 🔄 Migración: Corrección de Cajero en Órdenes

## Problema Detectado
Las órdenes estaban mostrando "Cajero Prueba" en lugar del nombre real del cajero que las generó.

## Causa Raíz
El sistema no estaba guardando qué empleado (cajero) creó cada orden. Solo se guardaba el `user_id` del propietario de la tienda, lo que hacía imposible distinguir qué empleado específico realizó cada venta.

## Solución Implementada

### 1. **Nuevo campo en la base de datos**
Se agregó el campo `created_by_staff_id` a la tabla `orders` que referencia el ID del empleado en la tabla `staff`.

### 2. **Cambios en el código**

#### `frontend/src/services/orderService.js`
- ✅ `createOrder()`: Ahora guarda `created_by_staff_id` al crear la orden
- ✅ `getOrders()`: Incluye join con tabla `staff` para obtener nombre del cajero
- ✅ `getOrdersByStatus()`: Incluye join con tabla `staff`
- ✅ `getOrdersInRange()`: Incluye join con tabla `staff`
- ✅ `getOrdersSince()`: Incluye join con tabla `staff`
- ✅ `getOrdersBySession()`: Incluye join con tabla `staff`

#### `frontend/src/components/sales/Sales.jsx`
- ✅ `finalizeOrder()`: Envía `created_by_staff_id` al crear la orden (usa `activeStaff.id`)

#### `frontend/src/components/sales/Orders.jsx`
- ✅ `getEmployeeName()`: Ahora recibe la orden completa y extrae `order.staff.name`
- ✅ Fallback: Muestra "Sistema" para órdenes antiguas sin información de staff

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
-- Migración: Agregar campo created_by_staff_id a la tabla orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS created_by_staff_id BIGINT REFERENCES public.staff(id);

-- Agregar índice para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_orders_created_by_staff ON public.orders(created_by_staff_id);

-- Agregar comentario a la columna
COMMENT ON COLUMN public.orders.created_by_staff_id IS 'ID del empleado (staff) que creó esta orden. NULL para órdenes antiguas.';
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

### ⚠️ Órdenes ANTIGUAS (antes de la migración)
- Muestran "Sistema" como fallback
- Esto es esperado ya que no se guardó información del cajero original

## 🔍 Estructura de Datos

### Antes (problema):
```javascript
order = {
  id: 123,
  user_id: "uuid-propietario",  // ❌ Solo el ID del dueño
  customers: { name: "Cliente" },
  // No hay forma de saber qué cajero creó la orden
}
```

### Después (solución):
```javascript
order = {
  id: 123,
  user_id: "uuid-propietario",
  created_by_staff_id: 5,  // ✅ ID del cajero
  staff: {                  // ✅ Join automático
    id: 5,
    name: "Juan Pérez",
    role: "cajero"
  },
  customers: { name: "Cliente" }
}
```

## 📝 Notas Importantes

1. **Las órdenes antiguas no se actualizan**: Solo las nuevas órdenes tendrán el nombre del cajero
2. **Si un cajero es eliminado**: Las órdenes que creó seguirán mostrando su nombre (historial)
3. **Compatibilidad**: El sistema maneja graceful fallback para órdenes sin información de staff
4. **Índice de rendimiento**: Se creó un índice en `created_by_staff_id` para consultas rápidas

## 🧪 Testing Checklist

- [ ] SQL ejecutado correctamente en Supabase
- [ ] Código desplegado en producción
- [ ] Login con cajero (no propietario)
- [ ] Crear orden de prueba
- [ ] Verificar que muestra nombre correcto del cajero
- [ ] Verificar que órdenes antiguas muestran "Sistema"
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
