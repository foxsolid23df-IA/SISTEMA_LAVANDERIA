# Reporte: Alta y Configuración de Laundry's Express

**Fecha:** 2026-07-09
**Proyecto:** SISTEMA_LAVANDERIA_DB (Supabase)
**Cliente:** Laundry's Express
**Estado:** Fase 1 y Fase 2 completadas

---

## 1. Acciones Ejecutadas

### 1.1 Generación de Código de Invitación
Se generó un código de invitación único en la tabla `public.invitation_codes`:

| Campo | Valor |
|---|---|
| ID | 28 |
| Código | `LAUNDRY-EXPRESS-2026` |
| Usado | `true` |
| Usado por (user_id) | `49fbb06f-b00f-4db7-b34d-1a54434f3a8b` |
| Fecha de uso | 2026-07-09 19:16:57 UTC |
| Fecha de creación | 2026-07-09 19:06:59 UTC |
| Fecha de expiración | 2026-07-16 19:06:59 UTC (7 días) |
| Notas | Licencia Laundry's Express |
| Creado por | Soporte Tecnico |

### 1.2 Enlace de Registro
El cliente debe registrarse usando el siguiente enlace:

```
https://sistema-lavanderia-nu.vercel.app/#/register/LAUNDRY-EXPRESS-2026
```

> Nota: La URL anterior `sistema-ventas-topaz.vercel.app` quedó obsoleta. La URL de producción actual es `sistema-lavanderia-nu.vercel.app`.

---

## 2. Estado del Sistema

- **Total de códigos activos (no usados, no vencidos):** 5
- **No se afectaron otras tiendas:** La inserción fue única y aislada en `invitation_codes`.
- **Registro completado:** El cliente `Yael` se registró con email `laundrysexpress@nexumpos.com`.
- **User ID del cliente:** `49fbb06f-b00f-4db7-b34d-1a54434f3a8b`
- **Licencia actual:** Vence el `2026-08-09 23:59:59 UTC` (1 mes), estado `active`.

---

## 3. Próximos Pasos

### Paso 2.1: Registro del Cliente ✅ COMPLETADO
El cliente `Yael` completó el registro con éxito.

### Paso 2.2: Activación de Licencia ✅ COMPLETADO
Licencia actualizada a 1 mes:

```sql
UPDATE public.profiles
SET license_expires_at = '2026-08-09 23:59:59+00',
    license_status = 'active'
WHERE id = '49fbb06f-b00f-4db7-b34d-1a54434f3a8b';
```

### Paso 2.3: Catálogo de Servicios ✅ COMPLETADO
Se crearon 9 servicios iniciales para Laundry's Express (IDs 1031-1039). Verificación confirmó que solo existen bajo el `user_id` del cliente.

| ID | Servicio | Precio | Tipo de cobro | Categoría |
|---|---|---|---|---|
| 1031 | Lavado por kg | $25.00 | kg | Lavado |
| 1032 | Planchado por pieza | $15.00 | unidad | Planchado |
| 1033 | Planchado por docena | $130.00 | unidad | Planchado |
| 1034 | Tintorería por pieza | $130.00 | unidad | Tintorería |
| 1035 | Edredón | $120.00 | unidad | Lavado |
| 1036 | Cobija | $120.00 | unidad | Lavado |
| 1037 | Tenis (par) | $75.00 | unidad | Lavado |
| 1038 | Chamarra | $110.00 | unidad | Lavado |
| 1039 | Saco | $110.00 | unidad | Lavado |

> Nota: Los precios son sugerencias basadas en el análisis del ODS. El cliente puede ajustarlos desde el panel de administración.

### Paso 2.4: Módulo de Gastos ✅ COMPLETADO
Se implementó el módulo de gastos operativos para reemplazar la sección "GASTOS" del Excel.

**Cambios realizados:**
- Migración SQL: `supabase/migrations/20260709150000_add_expenses_module.sql`
- Tabla `public.expenses` asegurada con RLS multi-tenant (`auth.uid() = user_id`)
- Servicio: `frontend/src/services/expenseService.js`
- Componente: `frontend/src/components/expenses/Expenses.jsx`
- Ruta: `/gastos` (solo accesible para admin)
- Enlace en sidebar con badge "NUEVO"

**Funcionalidades:**
- Registrar gastos con fecha, categoría, descripción, monto y método de pago
- Editar y eliminar gastos
- Filtrar por rango de fechas y categoría
- Resumen por categoría con total general
- Exportar a Excel

**Categorías disponibles:**
Suministros, Renta, Nómina, Servicios públicos, Mantenimiento, Transporte, Marketing, Otros

**Verificación:**
- Build exitoso: `✓ built in 21.55s`
- Prueba de inserción/eliminación en BD exitosa
- Confirmado aislamiento por `user_id`

### Paso 2.5: Entrega del Instalador (.exe)
Generar el instalador con `build-installer.bat` y entregárselo al cliente.

### Paso 2.6: Activación Offline
El cliente debe:
1. Instalar el `.exe`.
2. Iniciar sesión con internet.
3. Hacer clic en **Sincronizar** en la barra lateral para descargar licencia, inventario y el nuevo módulo de gastos.

---

## 4. Consideraciones de Seguridad

- El código expira en 7 días. Si el cliente no lo usa, se debe generar uno nuevo.
- La licencia está activa hasta el 2026-08-09.
- El módulo de gastos tiene RLS estricta: cada usuario solo ve y modifica sus propios gastos.
- Los 9 servicios creados pertenecen únicamente a Laundry's Express.
- En modo offline, la validación es estricta; el cliente debe sincronizar periódicamente.
- El build se generó correctamente, pero aún no se despliega a producción. El despliegue debe hacerse con `vercel --prod` cuando se confirme.

---

## 5. Fase 3: Despliegue a Producción ✅ COMPLETADO

| Detalle | Valor |
|---|---|
| Deployment ID | `dpl_4GQkxvDY6ieKjVZGoaFMwBxAqu3i` |
| Status | Ready |
| URL producción | https://sistema-lavanderia-nu.vercel.app |
| Fecha despliegue | 2026-07-09 14:11:31 CST |
| URL gastos | https://sistema-lavanderia-nu.vercel.app/#/gastos |
| Verificación HTTP | 200 OK en ambas URLs |

> El módulo de gastos ya está disponible para Laundry's Express y todos los clientes. Solo visible para usuarios admin.

---

**Reporte generado automáticamente por OpenCode.**
