# 🎫 Manual de Control de Licencias y Alta de Lavanderías

Este documento explica cómo habilitar el sistema para **Nuevas Lavanderías** (Clientes B2B) y cómo tener el control de sus licencias.

## 1. Arquitectura del Sistema (SaaS)

El sistema está construido como una plataforma de **Software como Servicio (SaaS)**. Esto significa que:

- Solo necesitas desplegar la aplicación **UNA VEZ** en un servidor (Vercel, Netlify, etc.).
- Cada dueño de lavandería que se registre tendrá su propio "entorno aislado" con sus propios clientes, precios y órdenes.
- El control de acceso se basa en **Códigos de Invitación** que tú generas.

## 2. Procedimiento para Habilitar un Nuevo Cliente (Lavandería)

Cuando vendes una licencia a una nueva lavandería, debes seguir estos pasos:

### Paso A: Generar el Código de Invitación (Licencia)

Entra a tu panel de **Supabase -> SQL Editor** y ejecuta:

```sql
INSERT INTO public.invitation_codes (code, expires_at, notes)
VALUES ('LAV-PREMIUM-2026', now() + interval '7 days', 'Licencia para Lavandería El Sol');
```

_Este código expirará en 7 días si el cliente no lo usa para registrarse._

### Paso B: Registro del Cliente

Envía al cliente el enlace de registro con su código:
`https://tu-sistema-lavanderia.com/#/register/LAV-PREMIUM-2026`

El cliente completará su nombre, correo y contraseña. Al terminar, el sistema lo marcará como el **Dueño/Administrador** de su propia sucursal.

## 3. Control y Gestión de Licencias

Desde tu base de datos (o una futura pantalla de admin), puedes controlar el estatus de cada negocio:

### Activar una Licencia (Después del Pago)

Cuando el cliente te paga su mensualidad o anualidad, debes actualizar su perfil:

```sql
UPDATE public.profiles
SET
  license_status = 'active',
  license_type = 'monthly',
  expiration_date = now() + interval '30 days'
WHERE id = 'ID-DEL-USUARIO-LAVANDERIA';
```

### Suspender un Servicio

Si un cliente deja de pagar, puedes bloquear su acceso sin borrar sus datos:

```sql
UPDATE public.profiles SET license_status = 'suspended' WHERE id = '...';
```

## 4. Próximos Pasos Recomendados

Para un control total, se puede implementar una **"Muro de Pago" (License Wall)** en el frontend:

- Si el `license_status` no es `active`, el sistema redirige automáticamente a una pantalla de "Servicio Suspendido" pidiendo que contacten al administrador.

---

_Este sistema garantiza que tú seas el único con el poder de "Habilitar" nuevas instancias del programa y cobrar por ellas._
