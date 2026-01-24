# 📔 Manual de la API Administrativa y Soporte Forense 🛡️ (Edición Global 2026)

Este manual explica cómo utilizar la infraestructura de administración y monitoreo del Sistema de Ventas Multi-Caja. El sistema ahora cuenta con un modelo **Híbrido** que permite el soporte tanto local como remoto mediante la nube.

---

## 1. Arquitectura de Soporte (Local vs Global) 🌍

El sistema de administración opera bajo dos modalidades automáticas:

- **API Local:** Se utiliza cuando estás físicamente en el negocio. Se comunica con el servidor local para tareas que afectan directamente a la PC del cliente.
- **API Global (Supabase):** Permite el soporte remoto desde cualquier lugar del mundo. Se comunica con la nube de Supabase para gestionar los datos maestros del negocio.

---

## 2. Monitor de Salud (Health Check) 🩺

En la interfaz de mantenimiento, ahora encontrarás tres indicadores de estado:

1.  **API Local:**
    - `ONLINE`: El servidor local en la tienda está activo.
    - `OFFLINE`: El servidor local está apagado (Normal si estás accediendo desde la nube/Vercel).
2.  **API Global:**
    - `CONECTADA`: La nube de Supabase está lista para recibir órdenes de soporte.
    - `INACTIVA`: Hay un problema de conexión con la infraestructura web.
3.  **Base de Datos:**
    - `VINCULADA`: La conexión con los datos del cliente es exitosa.

---

## 3. Acceso y Seguridad �

El acceso está blindado por una **Triple Capa de Seguridad**:

- **Capa 1 (Auth):** Solo los usuarios con perfil `Administrador` pueden ver la ruta de soporte.
- **Capa 2 (PIN Maestro):** Se requiere el código `2026SOP` (o el configurado en `.env`) para desbloquear las acciones.
- **Capa 3 (Edge Security):** Las llamadas globales están protegidas por la API KEY de Supabase.

### Acceso a la Interfaz

Ruta global: `https://[tu-app].vercel.app/#/soporte-tecnico-especializado-foxsolid`

---

## 4. Auditoría Forense 🕵️‍♂️

Todas las acciones (Resets, Cambios, Limpiezas) se guardan en una tabla inmutable de **System Logs**.

- **Consulta:** La tabla de logs se puede consultar al final del panel de mantenimiento.
- **Evidencia:** Cada log incluye la acción realizada, detalles técnicos, fecha y la IP real del técnico que ejecutó el comando.

---

## 5. Funciones de Mantenimiento 🛠️

| Función                   | Impacto                                     | Recomendación                       |
| :------------------------ | :------------------------------------------ | :---------------------------------- |
| **Resetear Dispositivos** | Libera licencias de terminales registradas. | Usar al cambiar de PC o tablet.     |
| **Limpiar Transacciones** | Borra ventas, sesiones y cortes.            | Usar para cierres anuales.          |
| **Reset Usuarios**        | Borra cajeros, mantiene al Admin.           | Usar al cambiar de personal.        |
| **Reset de Fábrica**      | Borra PRODUCTOS, VENTAS y USUARIOS.         | **EXTREMO:** Solo bajas de cliente. |

---

## 6. Configuración Técnica (Developers) 🚀

### Despliegue de la Edge Function

La lógica global vive en Supabase Functions bajo el nombre `admin-service`.

- **Configuración Crítica:** En el panel de Supabase -> Edge Functions -> admin-service -> Settings, la opción **"Verify JWT"** debe estar **OFF** (Desactivada) para permitir la validación por PIN Maestro.

### Variables de Entorno Requeridas

En el archivo `.env` del frontend:

- `VITE_SUPABASE_URL`: URL del proyecto.
- `VITE_SUPABASE_ANON_KEY`: Llave pública para la API Global.

---

_Actualizado el 23 de Enero, 2026 - Auditoría y Soporte FoxSolid (Versión 1.2.0)_
