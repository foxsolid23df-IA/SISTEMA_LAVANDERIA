# ☢️ Guía de Reset de Fábrica Manual (Supabase)

Esta guía es para técnicos de NexusProLavanderia. Siga estos pasos para evitar borrar un cliente por error.

## Paso 0: Verificación de Identidad (¡CRÍTICO!)

Antes de borrar nada, asegúrese de que está en el proyecto correcto:

1. **Nombre del Proyecto**: En la esquina superior izquierda de Supabase, verifique que el nombre coincida con el negocio del cliente.
2. **Confirmar Datos Reales**:
   - Ve a **Table Editor** -> cuadro de búsqueda -> escribe **`profiles`**.
   - Mira los correos electrónicos. Si ves el nombre o el correo del cliente que quiere darse de baja, estás en el lugar correcto.
   - Si no reconoces los nombres, **¡DETENTE!** Estás en el proyecto de otro cliente.

## Paso 1: Limpieza de Datos (SQL Editor)

1. Entra a tu proyecto en [Supabase](https://supabase.com/dashboard).
2. Ve a la sección **SQL Editor** (icono de `>_` en la barra lateral).
3. Haz clic en **"New Query"**.
4. Pega el siguiente código y presiona **"Run"**:

```sql
-- 1. Deshabilitar temporalmente restricciones
SET CONSTRAINTS ALL DEFERRED;

-- 2. Vaciar TODAS las tablas del sistema (Limpieza Absoluta)
TRUNCATE TABLE
    public.sale_items,
    public.sales,
    public.active_carts,
    public.staff, -- Esta tabla suele bloquear el borrado de usuarios
    public.cash_sessions,
    public.cash_cuts,
    public.products,
    public.terminals,
    public.invitation_codes,
    public.exchange_rates,
    public.profiles
RESTART IDENTITY CASCADE;

-- 3. Confirmación
SELECT 'Bases de datos vaciadas con éxito. Ya puede borrar los usuarios en Authentication.' as status;
```

## Paso 2: Borrar Usuarios (Authentication)

El SQL anterior borra los _datos_, pero el "usuario" (correo y contraseña) vive en una zona protegida de Supabase.

1. En Supabase, ve a **Authentication** -> **Users**.
2. Selecciona a todos los usuarios (incluyendo `admin@admin.com`).
3. Haz clic en **Delete User** para cada uno.

---

## Paso 3: Habilitar Nuevo Cliente

Ahora que el sistema está 100% vacío:

1. Ejecuta este comando en el **SQL Editor** para crear el código de invitación para el nuevo cliente:

```sql
INSERT INTO public.invitation_codes (code, used)
VALUES ('NUEVO-CLIENTE-2026', false);
```

2. Ve a la URL de tu sistema y usa ese código para registrar al nuevo administrador.

> [!CAUTION]
> Este proceso es irreversible. Una vez ejecutado el TRUNCATE, no hay forma de recuperar las ventas o productos anteriores si no tienes un respaldo manual.
