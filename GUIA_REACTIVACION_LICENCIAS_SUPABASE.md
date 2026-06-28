# 🛠️ Guía de Soporte: Reactivación de Licencias Suspendidas (Supabase)

Este manual describe el procedimiento técnico para reactivar cuentas de clientes que aparecen como **"Suspendidas"** en el sistema, incluso cuando se intenta utilizar funciones administrativas.

## ⚡ Solución Inmediata (Manual)

Para reactivar a un cliente de forma instantánea, se debe actualizar directamente la fecha de expiración en el **SQL Editor** de Supabase.

### Pasos a seguir:

1. **Obtener el UUID del cliente**: Identifica el `id` del usuario en la tabla `auth.users` o `public.profiles`.
2. **Acceder a Supabase**: Entra al panel de control del proyecto.
3. **Ejecutar SQL**: Ve al **SQL Editor** y ejecuta el siguiente comando (ajustando el ID y la fecha deseada):

```sql
-- REACIVACIÓN DE LICENCIA
-- Sustituye el ID por el del cliente afectado
UPDATE public.profiles
SET
    license_expires_at = '2026-12-31 23:59:59', -- Fecha de expiración deseada
    updated_at = NOW()
WHERE id = 'ID_DEL_CLIENTE_AQUÍ';
```

---

## 📋 Casos Específicos

### Ejemplo: Lavandería El Cañotal

Para este cliente específico, el comando es:

```sql
UPDATE public.profiles
SET license_expires_at = '2026-12-31 23:59:59', updated_at = NOW()
WHERE id = '80cb0874-5973-4cbe-b9b9-3a3cb4586fc1';
```

---

## 🛡️ Recomendaciones para el Equipo

- **Verificación**: Después de ejecutar el SQL, el cliente debe reiniciar su aplicación (.exe) o recargar la página para que el nuevo token refleje el cambio.

---

> [!IMPORTANT]
> **Seguridad**: Nunca compartan la `service_role_key` de Supabase en canales públicos. Si necesitan automatizar este proceso, se debe crear una función RPC que solo acepte el `target_user_id` y los días de extensión, validando siempre con el PIN Maestro.

---\_
