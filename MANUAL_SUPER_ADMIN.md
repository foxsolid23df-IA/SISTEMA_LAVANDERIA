# Manual de Super Administrador - Sistema de Gestión

Este documento detalla el uso del Panel de Control Maestro para la administración de licencias, usuarios y códigos de invitación en el sistema POS.

## 1. Acceso al Panel

El panel de administración es una ruta protegida y oculta. No aparece en los menús de navegación estándar por seguridad.

**URL de Acceso:**
`/#/super-admin/licencias`

(Ejemplo: `https://tu-dominio.vercel.app/#/super-admin/licencias`)

### Requisitos de Entrada

Para acceder, debes cumplir dos condiciones:

1.  **Estar logueado** en el sistema con tu cuenta de usuario.
2.  **Tener el rol de `super_admin`** asignado a tu usuario.

Si no tienes el rol, el sistema te redirigirá automáticamente al inicio o al login.

### Autenticación Secundaria

Una vez en la pantalla, se solicitará un **PIN Maestro** de seguridad para desbloquear las funciones.

- **PIN Actual:** `2026SOP`

---

## 2. Gestión de Licencias de Clientes

En la pestaña "Licencias Activas", verás un listado de todos los negocios registrados en el sistema.

### Información Visible

- **Nombre del Negocio**: Identificador de la tienda.
- **Propietario**: Nombre y correo electrónico.
- **Estado**:
  - **Etiqueta Verde/Roja**: Indica la fecha de vencimiento o si está "Sin Licencia".
  - **Etiqueta SUPER ADMIN**: (Color púrpura) Indica si el usuario tiene privilegios de administración total.

### Acciones Disponibles

#### Renovar Licencia

Puedes extender la vigencia del servicio para cualquier cliente:

- **Botón `+30 Días`**: Agrega un mes a la fecha de vencimiento actual.
- **Botón `+1 Año`**: Agrega un año completo.

> **Nota:** Si la licencia ya había vencido, el tiempo se agrega a partir del momento actual. Si aún estaba vigente, se suma a la fecha futura.

#### Suspender Servicio

- **Botón `Suspender`**: Revoca el acceso inmediato del cliente al sistema.
  - Esto establece la fecha de vencimiento al día de ayer.
  - El cliente no podrá usar el sistema hasta que renueves su licencia.

#### Gestión de Roles (Administradores)

- **Botón `Hacer Admin`** (Púrpura): Convierte inmediatamente a un usuario normal en Super Admin, dándole acceso a este panel.
- **Botón `Degradar`** (Gris): Quita los privilegios de Super Admin, devolviéndolo a usuario normal.

---

## 3. Generación de Invitaciones

Para registrar nuevos negocios o socios, es necesario generar un **Código de Invitación**. El registro público está desactivado por seguridad.

1.  Ve a la pestaña **"Generar Invitaciones"**.
2.  (Opcional) Escribe una nota de referencia (ej: "Sucursal Norte", "Socio Roberto").
3.  Haz clic en **"Generar Código"**.

### Compartir el Código

El sistema te mostrará:

- **El Código**: (ej: `ADMIN-AB12`)
- **Link Directo**: Un enlace que puedes copiar y enviar por WhatsApp/Correo.
  - El usuario al abrir este link verá el formulario de registro desbloqueado y listo para usar.

---

## 4. Solución de Problemas Comunes

**"Acceso Denegado: PIN Incorrecto"**

- Verifica que estás escribiendo `2026SOP` correctamente.

**"Acceso Denegado: Se requiere rol super_admin"**

- Si eres el dueño y no puedes entrar, contacta a soporte técnico para que ejecuten el script de asignación inicial en la base de datos (o usa el código de rescate si fue proporcionado).

**El usuario no aparece en la lista**

- Haz clic en el botón **"Refrescar Lista"** en la parte superior derecha para recargar los datos más recientes desde el servidor.
