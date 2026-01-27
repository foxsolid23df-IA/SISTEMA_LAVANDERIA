# 🔐 Manual de Seguridad y Administración de Cuentas (FoxSolid 2026)

Este manual explica cómo gestionar los niveles de acceso y proteger la cuenta maestra del sistema de lavandería para evitar el uso indebido de contraseñas principales.

---

## 1. Conceptos de Seguridad

Para garantizar la integridad de los datos y la operación de la tienda, el sistema separa las credenciales en tres niveles:

1.  **Contraseña Maestra (Email/Password)**: Se utiliza únicamente para el registro inicial y el inicio de sesión en nuevos dispositivos. **No debe compartirse con nadie.**
2.  **PIN Maestro Administrativo**: Un código de 6 dígitos configurado por el dueño para el uso diario. Permite desbloquear la pantalla con permisos totales sin exponer la contraseña maestra.
3.  **PIN de Empleado**: Un código de 4 a 6 dígitos para cajeros y gerentes, con acceso limitado según su rol.

---

## 2. Configuración del PIN Maestro

Para dejar de usar tu contraseña principal en la pantalla de bloqueo:

1.  Ve al **Panel Administrativo** -> **Configuración**.
2.  Busca la sección **Seguridad de la Cuenta (FoxSolid 2026)**.
3.  Haz clic en **Configurar PIN Maestro**.
4.  Ingresa un código de 6 números que solo tú conozcas.
5.  ¡Listo! A partir de ahora, cuando presiones "Soy el Propietario" en la pantalla de bloqueo, solo necesitarás este PIN.

---

## 3. Código de Recuperación (Desvinculación Segura)

El **Código de Recuperación** es un identificador único que permite cerrar la sesión de la tienda (desvincular el equipo) sin necesidad de internet o contraseñas complejas.

### Cómo generarlo:

- En la misma sección de **Configuración**, haz clic en **Generar Código de Recuperación**.
- Se te mostrará un código alfanumérico (ej: `A1B2-C3D4`).
- **IMPORTANTE**: Anota este código en un lugar físico seguro.

### Cuándo usarlo:

- Si necesitas retirar el software de una PC y no quieres ingresar tu contraseña frente a terceros.
- Si olvidas tu PIN Maestro.

---

## 4. Niveles de Acceso en Pantalla de Bloqueo

Cuando el sistema está bloqueado, tienes las siguientes opciones:

| Acción                 | Credencial Requerida                         | Uso Recomendado                                    |
| :--------------------- | :------------------------------------------- | :------------------------------------------------- |
| **Ingreso Operativo**  | PIN de Empleado (Cajero/Gerente)             | Operación diaria de ventas.                        |
| **Soy el Propietario** | **PIN Maestro (6 dígitos)**                  | Arqueos, reportes y configuración rápida.          |
| **Desvincular Tienda** | **PIN Maestro** o **Código de Recuperación** | Retirar el sistema del equipo o cierre definitivo. |

---

## 5. Prevención de Manipulación Incorrecta

Para evitar que el dueño o clientes del negocio manipulen incorrectamente el sistema:

- **Auditoría de Sesiones**: Cada vez que se desbloquea con el PIN Maestro, queda registrado en el historial de acciones (próximamente en reportes).
- **Bloqueo por Intentos**: Si se detectan múltiples fallos en el PIN Maestro, el sistema requerirá obligatoriamente la **Contraseña Maestra** para validar la identidad original.

---

_Soporte Técnico Especializado FoxSolid 2026_
