# 🚚 Manual Integral: Despliegue, Configuración y Pruebas del Módulo Delivery

Este manual contiene las instrucciones detalladas para levantar, configurar, vincular y probar el **Módulo de Delivery** y su integración con **WhatsApp (Evolution API)** de manera local en tu entorno de desarrollo.

---

## 🗺️ Arquitectura del Módulo de Delivery

El sistema consta de los siguientes componentes interconectados:

```
[ Cliente (WhatsApp) ] 
       │ (1. Mensaje de dirección)
       ▼
[ Evolution API (Docker) ] 
       │ (2. Webhook por ngrok)
       ▼
[ Supabase Edge Functions (handle-whatsapp-webhook) ] ── (3. Crea Pedido en DB)
       │
       ▼ (4. Notificaciones por Evolution API)
[ Cliente / Repartidor (WhatsApp) ] ◄──► [ Sistema Web /delivery /chofer ]
```

---

## 💻 Fase 1: Entorno Docker de Evolution API

Tu máquina local ejecuta Evolution API bajo un entorno de Docker multi-contenedor. A continuación se detallan sus credenciales y estructura.

### 1. Directorio del Proyecto
El entorno Docker se encuentra en la carpeta:
`C:\evolution-api\`

### 2. Estructura de Contenedores Levantados
*   **`evolution-local`** (Puerto `8080`): El motor principal de la API.
*   **`evolution-postgres`** (Puerto `5432`): Base de datos para almacenar instancias.
*   **`evolution-redis`** (Puerto `6379`): Servidor de caché para optimizar las sesiones de WhatsApp.

### 3. Credenciales del Evolution Manager
Para acceder al administrador gráfico y vincular tu número de WhatsApp:

*   **URL del Manager:** `http://localhost:8080/manager`
*   **Server URL:** `http://localhost:8080` (dentro del panel)
*   **API Key Global:** `ClavePruebaSaaS2026`

---

## 🌐 Fase 2: Exponer la API Local con ngrok

Las Edge Functions de Supabase en la nube necesitan comunicarse con tu Evolution API local. Debes crear un túnel seguro a internet.

1.  Abre una terminal en tu computadora.
2.  Inicia el túnel en el puerto `8080` ejecutando:
    ```powershell
    ngrok http 8080
    ```
3.  Copia la URL pública generada de tipo **`https://abc123-xyz.ngrok-free.app`**.
    > ⚠️ **Nota:** Si usas la versión gratuita de ngrok, esta URL cambiará cada vez que detengas y vuelvas a iniciar el comando.

---

## 🔗 Fase 3: Crear Instancia de WhatsApp y Configurar Webhook

### Paso 1: Conectar tu WhatsApp en Evolution Manager
1.  Ingresa a `http://localhost:8080/manager` con la API Key Global `ClavePruebaSaaS2026`.
2.  Haz clic en **"New Instance"**.
3.  Asigna el nombre: `lavanderia-demo` (sin espacios ni caracteres especiales).
4.  Haz clic en **"Connect"** y escanea el **código QR** desde la aplicación de WhatsApp de tu celular (Dispositivos vinculados).

### Paso 2: Obtener tu Store ID (ID de Tienda en Supabase)
1.  Ve a tu **Supabase Dashboard** de tu proyecto.
2.  Accede a la pestaña **Authentication → Users** o ve a la tabla **`profiles`**.
3.  Copia el `id` (formato UUID, ej: `8f1e3194-e8b9-4a9c-bc0a-428d01d4a82b`) del usuario administrador de tu tienda. Este es tu `store_id`.

### Paso 3: Configurar el Webhook en la Instancia
En el panel de la instancia en Evolution Manager:
1.  Ve a la sección **Webhook**.
2.  En **Webhook URL** ingresa la URL de tu Edge Function en Supabase, añadiendo tu ID de tienda al final:
    ```
    https://jugyosyrbixwsmzvdksp.supabase.co/functions/v1/handle-whatsapp-webhook?store_id=TU_STORE_ID_AQUI
    ```
3.  Activa únicamente el evento: **`MESSAGES_UPSERT`**.
4.  Guarda la configuración del Webhook.

---

## 🔐 Fase 4: Configuración de Supabase (Base de Datos y Secrets)

### 1. Migraciones de la Base de Datos
Aplica el esquema de tablas del módulo de delivery en tu proyecto:
```powershell
cd "c:\SISTEMA_ LAVANDERIA"
npx supabase db push
```

### 2. Bucket de Almacenamiento (Storage)
1.  En tu panel de Supabase, ve a **Storage**.
2.  Crea un bucket **Privado** llamado exactamente: **`delivery-evidence`**.
    *   *Nota: Las políticas de acceso seguro RLS ya se instalan mediante las migraciones.*

### 3. Configurar Secrets en Supabase Cloud
Para que las Edge Functions conozcan tu Evolution API local y tu URL de Vercel, ejecuta en la consola de tu computadora:

```powershell
# URL pública del túnel de ngrok
npx supabase secrets set EVOLUTION_API_URL="https://abc123-xyz.ngrok-free.app"

# Nombre de la instancia que creaste en el Manager
npx supabase secrets set EVOLUTION_INSTANCE_NAME="lavanderia-demo"

# URL de tu frontend (local o desplegado)
npx supabase secrets set APP_BASE_URL="http://localhost:5173"
```

### 4. Desplegar Edge Functions
Sube el código de las funciones a tu nube de Supabase:
```powershell
cd "c:\SISTEMA_ LAVANDERIA"
npx supabase functions deploy delivery-actions
npx supabase functions deploy verify-driver-pin
npx supabase functions deploy get-delivery-tracking
npx supabase functions deploy update-delivery-request
npx supabase functions deploy notify-order
npx supabase functions deploy handle-whatsapp-webhook
```

---

## ⚙️ Fase 5: Configurar y Activar el Módulo en la Aplicación Web

### 1. Variables de Entorno del Frontend
Asegúrate de que tu archivo [frontend/.env](file:///c:/SISTEMA_%20LAVANDERIA/frontend/.env) contenga las claves correctas:
```env
VITE_SUPABASE_URL=https://jugyosyrbixwsmzvdksp.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_pkUlkLzd6rPbvG9dD4usPg_qALhsbSd
```

### 2. Activar la Licencia de Delivery
Por defecto, las tiendas tienen el módulo desactivado. Para activarlo:
1.  Ejecuta la app localmente (`npm run dev` en la carpeta `frontend`).
2.  Accede a: `http://localhost:5173/#/portal-maestro`.
3.  Ingresa el PIN Maestro: `2026SOP`.
4.  Busca tu tienda en la lista y haz clic en **"Activar Delivery"**.

### 3. Configurar Gateway en el Módulo de Delivery
1.  Inicia sesión con tu cuenta de tienda.
2.  Entra al módulo en: `http://localhost:5173/#/delivery`.
3.  Haz clic en **"Mensajería"** (icono de engrane arriba a la derecha).
4.  Selecciona: **WhatsApp Vinculado por QR (Evolution API)**.
5.  En **API Token de la Sesión QR**, ingresa la clave de Evolution: `ClavePruebaSaaS2026`.
6.  Haz clic en **"Guardar Cambios"**.

---

## 🧪 Fase 6: Guía Paso a Paso para Pruebas de Flujo Completo

Realiza esta prueba de extremo a extremo para verificar que todo está correctamente configurado:

### 1. Preparar un Repartidor
1.  En el sistema, ve a **Usuarios** (Dashboard lateral).
2.  Crea un nuevo usuario:
    *   **Nombre:** Repartidor de Pruebas
    *   **Rol:** `repartidor` o `chofer`
    *   **Teléfono:** Su celular real (con código de país, ej. `521XXXXXXXXXX` o `52XXXXXXXXXX`)
    *   **PIN:** `1234` (Código numérico de acceso de 4 dígitos)

### 2. Simular Entrada de Pedido por WhatsApp (Cliente)
1.  Desde un número celular distinto (el del cliente de prueba), envía un WhatsApp al número que vinculaste en Evolution API.
2.  Envía un mensaje únicamente con una dirección de entrega, por ejemplo:
    `Calle Benito Juárez #123, Col. Centro, CP 68000`
3.  **Resultado esperado:**
    *   El bot de Supabase (`handle-whatsapp-webhook`) detectará la dirección automáticamente.
    *   Se creará un registro de pedido en la tabla `delivery_orders`.
    *   El cliente de prueba recibirá un mensaje de WhatsApp automático con el link de tracking:
        `https://localhost:5173/#/tracking/UUID_DEL_PEDIDO`

### 3. Gestionar Pedido en el Dashboard de Sucursal (`/#/delivery`)
1.  Abre el panel en `http://localhost:5173/#/delivery`. Verás la solicitud en la columna **Pendientes de Recogida**.
2.  Haz clic en **"Cotizar"** y define la tarifa de envío (ej. `$50.00` o `$0.00` para gratis). Guarda.
3.  El cliente de prueba recibirá una notificación por WhatsApp indicando el costo y solicitando que confirme su método de pago.
4.  **Confirmación del cliente:** Abre el enlace de tracking que recibió el cliente, describe las prendas a enviar (ej. *2 bolsas de ropa de color*) y selecciona pagar al recibir.
5.  En tu dashboard de sucursal, haz clic en **"Aceptar y Asignar"** sobre la tarjeta del pedido. Selecciona a tu repartidor de pruebas.

### 4. Ejecución del Repartidor (`/#/chofer`)
1.  Entra en `http://localhost:5173/#/chofer` (simula la pantalla del celular del repartidor).
2.  Introduce el PIN: `1234`.
3.  Verás la lista de viajes asignados. Haz clic en el pedido correspondiente.
4.  Cuando el repartidor llegue a la casa del cliente y recoja la ropa:
    *   Captura una foto de evidencia de la bolsa.
    *   Escribe el reporte de recolección en el campo de texto.
    *   Registra si se cobró algún anticipo en efectivo.
    *   Haz clic en **"Marcar como Recogido"**.
5.  Al regresar a la tienda con la ropa, el repartidor marca el botón **"Recibido en Sucursal"**.

### 5. Finalización y Conciliación del Pedido
1.  Vuelve al panel de administración de sucursal (`http://localhost:5173/#/delivery`).
2.  El pedido ahora se encuentra en la columna **En Sucursal (Listo para Cobro)**.
3.  Podrás ver la evidencia fotográfica que subió el repartidor haciendo clic en **"Ver evidencia de recogida"**.
4.  Escribe el peso/resumen de prendas y el costo definitivo del servicio de lavado en el botón **"Procesar Prendas"**.
5.  Si el repartidor cobró en efectivo, haz clic en el botón **"Conciliar"** para autorizar que la sucursal ya recibió ese dinero físico.
6.  Por último, haz clic en **"Cargar en Caja / Cobrar"** para importar la orden de delivery directo al carrito de ventas del POS local y generar el ticket final.

---

## 🛠️ Resolución de Errores Comunes

| Síntoma | Causa Posible | Solución |
|---------|---------------|----------|
| **Error 401 Unauthorized** al iniciar sesión en el Manager | La API Key escrita no coincide con el Docker. | Verifica que estés usando `ClavePruebaSaaS2026` y que el URL del servidor no tenga diagonales de más al final. |
| **El webhook no dispara pedidos** | El túnel de ngrok está apagado o la URL cambió. | Abre una terminal, ejecuta `ngrok http 8080`, copia la nueva dirección https y actualízala en los Settings del Webhook en tu Evolution Manager e inyéctala como secret en Supabase. |
| **Error: "Módulo no disponible"** | La tienda no está activada en el sistema. | Entra a `http://localhost:5173/#/portal-maestro` con el PIN `2026SOP` y activa la tienda. |
| **Los mensajes no se envían** | La sesión de WhatsApp se desconectó. | Abre el manager, ve a tu instancia `lavanderia-demo` y asegúrate de que el estado figure como **"open"**. Si dice "closed", dale "Connect" y escanea de nuevo el QR. |
