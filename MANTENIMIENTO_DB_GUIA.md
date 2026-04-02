# 🛠️ Guía de Mantenimiento y Limpieza de Base de Datos - Sistema Lavandería

Esta guía contiene los comandos SQL necesarios para gestionar los usuarios y realizar limpieza profunda de datos (como el borrado de cuentas demo) de forma segura.

---

## 1. 📋 Consultar Listado de Usuarios Registrados
Usa este comando para obtener los **user_id (UUID)** y correos de todos los clientes hasta la fecha.

```sql
SELECT 
    au.id AS user_uuid,
    au.email,
    p.store_name,
    p.role,
    au.created_at AS registered_at,
    au.last_sign_in_at AS last_active
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
ORDER BY au.created_at DESC;
```

---

## 2. ⚡ Actualización de la Función RPC (Limpieza Profunda)
Ejecuta este código una vez en el **SQL Editor** para que la función de borrado permanente sea compatible con todas las tablas actuales (`supply_movements`, `business_settings`, etc.).

```sql
CREATE OR REPLACE FUNCTION delete_client_permanently(
    target_user_id UUID,
    master_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_expected_pin TEXT := '2026SOP'; -- PIN Maestro de Soporte
    v_target_email TEXT;
BEGIN
    -- 1. Validar PIN Maestro
    IF master_pin IS NULL OR master_pin != v_expected_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN Maestro incorrecto');
    END IF;

    -- 2. Verificar Super Admin (si se llama desde la app)
    v_caller_id := auth.uid();
    IF v_caller_id IS NOT NULL THEN
        SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
        IF v_caller_role IS NULL OR v_caller_role != 'super_admin' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Se requiere rol super_admin');
        END IF;
    END IF;

    -- 3. Obtener email para confirmar
    SELECT email INTO v_target_email FROM public.profiles WHERE id = target_user_id;
    IF v_target_email IS NULL THEN
        SELECT email INTO v_target_email FROM auth.users WHERE id = target_user_id;
    END IF;

    -- 4. ELIMINACIÓN EN CASCADA (Orden estricto de dependencias)
    -- Items de ventas y órdenes
    DELETE FROM public.order_items WHERE user_id = target_user_id;
    DELETE FROM public.sale_items WHERE user_id = target_user_id;
    
    -- Movimientos de insumos y caja
    DELETE FROM public.supply_movements WHERE user_id = target_user_id;
    DELETE FROM public.supply_reconciliations WHERE user_id = target_user_id;
    DELETE FROM public.cash_withdrawals WHERE user_id = target_user_id;
    DELETE FROM public.cash_cuts WHERE user_id = target_user_id;
    
    -- Documentos principales
    DELETE FROM public.orders WHERE user_id = target_user_id;
    DELETE FROM public.sales WHERE user_id = target_user_id;
    DELETE FROM public.active_carts WHERE user_id = target_user_id;
    
    -- Sesiones y Catálogos
    DELETE FROM public.cash_sessions WHERE user_id = target_user_id;
    DELETE FROM public.terminals WHERE user_id = target_user_id;
    DELETE FROM public.products WHERE user_id = target_user_id;
    DELETE FROM public.customers WHERE user_id = target_user_id;
    DELETE FROM public.supplies WHERE user_id = target_user_id;
    DELETE FROM public.staff WHERE user_id = target_user_id;
    
    -- Configuraciones
    DELETE FROM public.exchange_rates WHERE user_id = target_user_id;
    DELETE FROM public.business_settings WHERE user_id = target_user_id;
    
    -- Liberar códigos de invitación
    UPDATE public.invitation_codes 
    SET used = false, used_by = NULL, used_at = NULL 
    WHERE used_by = target_user_id;

    -- Perfil y Auth (Liberar emails)
    DELETE FROM public.profiles WHERE id = target_user_id;
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Limpieza completa del cliente',
        'email', v_target_email
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

---

## 3. 🗑️ Cómo Borrar Clientes Demo (Limpieza Total)
Si deseas borrar las cuentas `demo1@lavaplus.com` y `demo2@lavaplus.com` sigue estos pasos:

1.  Usa el listado del punto #1 para encontrar su **user_uuid**.
2.  Ejecuta la función `delete_client_permanently` con el PIN Maestro (`2026SOP`).

**Ejemplo:**
```sql
-- Para demo1
SELECT delete_client_permanently('EL_UUID_DE_DEMO1', '2026SOP');

-- Para demo2
SELECT delete_client_permanently('EL_UUID_DE_DEMO2', '2026SOP');
```

---

## 4. ✅ Verificar que no quedaron rastros
Después de borrar, puedes confirmar que los emails han sido liberados:

```sql
SELECT id, email FROM auth.users 
WHERE email IN ('demo1@lavaplus.com', 'demo2@lavaplus.com');
-- Esperado: 0 resultados.
```

---

> [!CAUTION]
> Estas operaciones son **IRREVERSIBLES**. Borran todo el historial de ventas, productos y configuración del cliente seleccionado.
