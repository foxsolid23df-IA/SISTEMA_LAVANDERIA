# 🎫 Manual de Control de Licencias y Alta de Lavanderías (Versión Offline-First 2026)

Este documento explica cómo habilitar el sistema para **Nuevas Lavanderías** (Clientes B2B) y cómo gestionar sus licencias integrando la nueva capacidad de uso sin conexión (.exe).

---

## 1. Arquitectura del Sistema (SaaS Híbrido)

El sistema funciona bajo un modelo de Software como Servicio (SaaS) con soporte offline:

- **Nube (Supabase/Vercel)**: Centraliza la base de datos maestra, usuarios y control de licencias global.
- **Local (App .exe)**: Cada sucursal corre un motor local que permite vender sin internet y valida la licencia de forma autónoma.

---

## 2. Procedimiento para Habilitar un Nuevo Cliente

### Paso A: Generar el Código de Invitación

Entra a **Supabase -> SQL Editor** y genera un código único para el cliente:

```sql
INSERT INTO public.invitation_codes (code, expires_at, notes)
VALUES ('CODIGO-CLIENTE-2026', now() + interval '7 days', 'Licencia Lavandería X');
```

### Paso B: Registro y Configuración Inicial

1. Envíale al cliente el enlace de registro: `https://tu-sistema.vercel.app/#/register/CODIGO-CLIENTE-2026`
2. El cliente crea su cuenta (Dueño).
3. **Entrega del Software**: Envíale el instalador **`.exe`** generado con `build-installer.bat`.

### Paso C: Activación en Sucursal (Crítico)

Para que el modo offline funcione y la licencia se valide:

1. El cliente instala el `.exe` e inicia sesión con internet.
2. Debe ir a la barra lateral (Sidebar) y hacer clic en **Sincronizar** 🔄.
3. El sistema descargará la fecha de licencia y el inventario. **Este paso "activa" la PC para trabajar offline.**

---

## 3. Gestión y Renovación de Licencias

El control se realiza mediante la columna `license_expires_at` en la tabla `profiles`.

### Actualizar/Renovar Licencia (Después del Pago)

Cuando el cliente pague su mensualidad, actualiza su fecha de vencimiento:

```sql
UPDATE public.profiles
SET license_expires_at = '2026-12-31 23:59:59+00' -- Cambiar por la fecha deseada
WHERE id = 'ID-DEL-USUARIO';
```

> **Nota**: El cliente no verá el cambio instantáneamente si está offline. Debe conectarse a internet y **Sincronizar** para que su equipo local "se entere" de la nueva fecha.

### Suspender Servicio

Puedes bloquear el acceso de inmediato cambiando la fecha al pasado o eliminándola:

```sql
UPDATE public.profiles SET license_expires_at = now() - interval '1 day' WHERE id = '...';
```

---

## 4. Diferencias de Validación (Web vs App)

- **En la Web (Vercel)**: La validación es flexible. Permite supervisar ventas aunque no detecte el motor local.
- **En la App (.exe)**: La validación es estricta. Si la fecha grabada localmente ha vencido y no hay internet para renovar, el sistema **bloquea las ventas** por seguridad.

---

_Soporte Técnico Especializado FoxSolid 2026_
