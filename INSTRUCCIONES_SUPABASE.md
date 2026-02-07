# 🚀 PASOS FINALES PARA ACTIVAR LAS FUNCIONES DE SUPER ADMIN

Para que los botones de **"Eliminar"** y **"Reset Pass"** funcionen, debes realizar estas 2 acciones manuales en tu panel de Supabase.

---

## 1️⃣ EJECUTAR EL SQL (Base de Datos)

Este paso habilita las funciones de eliminación segura, el trigger para perfiles limpios y los permisos.

1.  Ve a tu proyecto en **Supabase**.
2.  Entra a **SQL Editor**.
3.  Copia y pega **TODO** el código del siguiente archivo que ya subí a tu repositorio:
    `supabase/migrations/EJECUTAR_PRIMERO_super_admin_functions.sql`
4.  Dale click a **RUN**.

---

## 2️⃣ DESPLEGAR LA EDGE FUNCTION (Para cambiar contraseñas)

Esta función permite cambiar la contraseña directamente sin enviar correos. Debes desplegarla usando Supabase CLI.

### Opción A: Si tienes Supabase CLI configurado

Ejecuta este comando en tu terminal:

```bash
supabase functions deploy admin-update-password --no-verify-jwt
```

### Opción B: Si NO tienes CLI (Copia manual)

Si no usas la CLI, necesitarás configurar esto en el dashboard si tu plan lo permite, o pedir a un desarrollador que despliegue la función `supabase/functions/admin-update-password`.

**Nota Importante:**
La función espera que el **PIN Maestro** sea `2026SOP`. Puedes cambiarlo editando el archivo `supabase/functions/admin-update-password/index.ts` antes de desplegar.

---

## ✅ VERIFICACIÓN

1.  Intenta registrar un usuario nuevo -> **Debe crearse con perfil vacío (sin datos de otros).**
2.  Intenta eliminar un cliente -> **Debe pedir confirmar escribiendo "ELIMINAR".**
3.  Intenta resetear contraseña -> **Debe pedir la nueva contraseña y cambiarla al instante.**
