# 📘 Manual Integral del Sistema de Gestión FoxSolid 2026

**Versión del Documento:** 1.0 (Consolidado)
**Última Actualización:** Enero 2026

Bienvenido al manual unificado del sistema de gestión para Lavanderías y Tiendas. Este documento está dividido en secciones según el perfil del usuario: Propietarios, Personal Operativo y Soporte Técnico.

---

## ÍNDICE

1.  [SECCIÓN A: MANUAL PARA PROPIETARIOS Y ADMINISTRADORES](#sección-a-manual-para-propietarios-y-administradores)
    - 1.1 Seguridad de la Cuenta y Accesos
    - 1.2 Panel de Administración
    - 1.3 Operación Offline (Sin Internet)
    - 1.4 Gestión de Licencias
2.  [SECCIÓN B: MANUAL OPERATIVO PARA EL PERSONAL](#sección-b-manual-operativo-para-el-personal)
    - 2.1 Acceso y Turnos
    - 2.2 Ventas de Mostrador
    - 2.3 Gestión de Lavandería
    - 2.4 Cortes de Caja
3.  [SECCIÓN C: SOPORTE TÉCNICO Y DESPLIEGUE](#sección-c-soporte-técnico-y-despliegue)
    - 3.1 Instalación (Local y Nube)
    - 3.2 Habilitar Nuevas Sucursales

---

# SECCIÓN A: MANUAL PARA PROPIETARIOS Y ADMINISTRADORES

Esta sección es exclusiva para dueños de negocio y gerentes generales.

## 1.1 Seguridad de la Cuenta y Accesos 🔐

Para proteger tu negocio, el sistema utiliza un esquema de seguridad jerárquico.

### Niveles de Acceso

1.  **Contraseña Maestra (Email/Password)**: Es tu llave principal de Supabase. **Úsala SOLO para configurar equipos nuevos**. No la compartas con nadie.
2.  **PIN Maestro (6 dígitos)**: Es tu código de operación diaria. Permite desbloquear la pantalla como "Propietario" y realizar acciones sensibles (cancelaciones, cortes) sin escribir tu contraseña larga.
3.  **PIN de Empleado (4 dígitos)**: Acceso limitado para cajeros.

### Configuración del PIN Maestro

1.  Ingresa al sistema y ve a **Admin Panel** -> **Configuración**.
2.  En la sección "Seguridad de la Cuenta", selecciona **Configurar PIN Maestro**.
3.  Ingresa un código de 6 números.

### Código de Recuperación (Desvinculación)

Si necesitas retirar el sistema de una computadora (por ejemplo, para cambiarla o cerrarla), no ingreses tu contraseña frente a empleados.

1.  En **Configuración**, genera un **Código de Recuperación**.
2.  Guárdalo en un lugar seguro (físico o en tu celular).
3.  Usa este código en la pantalla de bloqueo cuando quieras cerrar la sesión de la tienda definitivamente.

## 1.2 Panel de Administración 📊

Accede a `/admin` o el icono de escudo en el menú lateral. Aquí podrás ver:

- **Dashboard**: Resumen en tiempo real de ventas, stock bajo y personal activo.
- **Ventas**: Historial detallado de cada transacción.
- **Cortes de Caja**: Auditoría de los cierres de turno de tus empleados. El sistema marca en **ROJO** si falta dinero y **VERDE** si sobra.
- **Personal**: Crea y edita los PINs de tus empleados.
- **Inventario**: Gestiona productos, precios y stock.

## 1.3 Operación Offline (Sin Internet) 📶

El sistema está diseñado para funcionar aunque se vaya el internet "Offline-First".

- **Indicador de Estado**: En la barra lateral verás un punto Verde (En Línea) o Rojo (Sin Conexión).
- **Vender sin Internet**: Puedes seguir cobrando y registrando órdenes normalmente. Los datos se guardan en el disco duro del equipo.
- **Sincronización**:
  - Al volver el internet, el sistema intentará subir las ventas automáticamente.
  - Puedes presionar el botón de **Sincronización (Sync)** 🔄 para forzar el envío de datos y descargar cambios de precios o productos nuevos.

> **Nota**: No puedes crear productos nuevos ni cambiar precios mientras estás offline. Estas acciones requieren internet.

## 1.4 Gestión de Licencias

El sistema verifica tu licencia periódicamente.

- En modo Offline, el sistema tiene un "permiso temporal" para operar.
- Si la licencia vence y no hay conexión a internet por muchos días, el sistema podría bloquearse por seguridad hasta que se conecte nuevamente para verificar el pago.

---

# SECCIÓN B: MANUAL OPERATIVO PARA EL PERSONAL

Guía rápida para cajeros y personal de mostrador.

## 2.1 Acceso y Turnos

- Inicia tu turno ingresando tu **PIN de 4 dígitos**.
- Si te alejas de la computadora, presiona **Bloquear Pantalla** en el menú. Nunca dejes la sesión abierta.

## 2.2 Ventas de Mostrador (POS) 🛒

1.  Ve a la pestaña **Ventas**.
2.  Escanea el producto o búscalo por nombre.
3.  Ingresa la cantidad.
4.  Presiona **Cobrar** (F12 usualmente o botón en pantalla).
5.  Selecciona EFE (Efectivo) o TAR (Tarjeta).
6.  Entrega el ticket al cliente.

## 2.3 Gestión de Lavandería 🧺

El módulo de "Órdenes" es para el servicio de lavado por encargo:

1.  **Nueva Orden**: Registra el cliente y las prendas. Pesa la ropa frente al cliente.
2.  **Estados**:
    - `Recibido`: Ropa en espera.
    - `En Proceso`: Ropa lavándose/secándose.
    - `Listo`: Ropa doblada y empaquetada. (Notifica al cliente si está activo).
    - `Entregado`: Cliente recogió y pagó el saldo pendiente.

## 2.4 Cortes de Caja 💰

Al finalizar tu turno:

1.  Ve a **Corte de Caja**.
2.  Cuenta el dinero real que tienes en el cajón.
3.  Ingresa la cantidad en el sistema.
4.  El sistema te dirá si tu cuenta es correcta.

---

# SECCIÓN C: SOPORTE TÉCNICO Y DESPLIEGUE

Sección reservada para personal de TI e Instaladores.

## 3.1 Instalación y Despliegue

### Entorno Local (Windows)

Para generar el instalador `.exe` para un cliente:

1.  Ejecuta `build-installer.bat` en la raíz del proyecto.
2.  El instalador se generará en la carpeta `release/`.
3.  Instala en la PC del cliente y asegúrate de iniciar desde el Acceso Directo creado.

### Entorno Nube (Vercel/Supabase)

- **Supabase**: Asegura que las migraciones SQL estén aplicadas.
- **Vercel**: Conecta el repositorio GitHub. Las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` son obligatorias.

## 3.2 Habilitar Nuevas Sucursales

Para dar de alta un nuevo cliente:

1.  Genera un **Código de Invitación** en la base de datos (Tabla `invitation_codes`).
2.  Proporciona la URL de registro al cliente: `https://tu-app.vercel.app/#/register/CODIGO`.
3.  Una vez registrado, entrégale el instalador `.exe`.
4.  El cliente debe iniciar sesión y sincronizar por primera vez con internet para activar su licencia local.

## 3.3 Soporte y Reseteo

En caso de errores graves de sincronización o corrupción de datos locales:

- Usa el script de reseteo (si disponible) o reinstala la aplicación marcando "Borrar datos de usuario".
- Verifica los logs en la consola (Ctrl+Shift+I) para diagnósticos de red.

---

_FoxSolid Systems © 2026 - Documentación Confidencial_
