# 📱 Guía: Desplegar Evolution API para WhatsApp

## ¿Por qué Evolution API?

El sistema de Delivery usa **Evolution API** como gateway de WhatsApp para:
- **Recibir** solicitudes de recogida enviadas por clientes vía WhatsApp
- **Enviar** confirmaciones, links de tracking, asignación de repartidor y comprobantes de pago

El sistema soporta dos modos de pasarela configurables por tienda:

| Modo (`whatsapp_gateway_type`) | Descripción |
|-------------------------------|-------------|
| `qr_linked` | Evolution API propia del negocio (escanear QR desde el número real) |
| `central_saas` | Twilio WhatsApp (número 1-800 compartido, requiere cuenta Twilio) |

> Esta guía cubre el modo `qr_linked` con Evolution API — el más práctico para negocios con número propio.

---

## 🧩 Cómo se usa en este proyecto

```
Cliente WhatsApp
     │
     ▼ Mensaje o ubicación
Evolution API (tu servidor)
     │
     ▼ POST al webhook con store_id
Supabase Edge Function: handle-whatsapp-webhook
     │
     ├── Verifica delivery_enabled para la tienda
     ├── Detecta dirección o ubicación GPS
     ├── Crea customer + delivery_order en la BD
     └── Responde al cliente con link de tracking
```

Las **notificaciones salientes** (asignación, recogida, entrega, pagos) también las envía tu Evolution API desde la Edge Function `notify-order`.

---

## Opción A — Docker Local + ngrok (para pruebas/demo)

Es la forma más rápida. Levanta Evolution API en tu PC y lo expone con una URL pública temporal.

### Requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- [ngrok](https://ngrok.com/download) instalado (crea cuenta gratuita en ngrok.com)

### Paso 1: Levantar Evolution API con Docker

Crea un archivo `docker-compose.yml` en cualquier carpeta (ej. `C:\evolution-api\`):

```yaml
version: "3.8"

services:
  evolution-api:
    image: atendai/evolution-api:latest
    container_name: evolution_api
    restart: always
    ports:
      - "8080:8080"
    environment:
      # — Servidor
      SERVER_URL: http://localhost:8080
      
      # — Autenticación (API Key global)
      AUTHENTICATION_TYPE: apikey
      AUTHENTICATION_API_KEY: TU_API_KEY_SECRETA_AQUI
      AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES: true
      
      # — Base de datos (SQLite simple para desarrollo)
      DATABASE_ENABLED: false
      
      # — Configuración de Instancias
      DEL_INSTANCE: false
      
      # — WhatsApp
      QRCODE_LIMIT: 30
      
      # — Webhook global (déjalo vacío, se configura por instancia)
      WEBHOOK_GLOBAL_URL: ""
      WEBHOOK_GLOBAL_ENABLED: false
      
      # — Logs
      LOG_LEVEL: ERROR,WARN,DEBUG,INFO,LOG,VERBOSE,DARK,WEBHOOKS
      
    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store

volumes:
  evolution_instances:
  evolution_store:
```

Inicia el contenedor:

```powershell
cd C:\evolution-api
docker compose up -d
```

Verifica que está corriendo:

```powershell
docker logs evolution_api --tail 30
# Debe mostrar: "Server is listening on port 8080"
```

El **Manager visual** estará en: **http://localhost:8080/manager**

---

### Paso 2: Exponer Evolution API con ngrok

Abre una terminal y ejecuta:

```powershell
ngrok http 8080
```

Verás algo como:

```
Forwarding   https://abc123-xyz.ngrok-free.app -> http://localhost:8080
```

> 🔑 Copia la URL `https://...ngrok-free.app` — la necesitarás en los siguientes pasos.

**Importante:** En la cuenta gratuita de ngrok, la URL cambia cada vez que reinicias. Para uso estable, considera ngrok Pro o usa la Opción B.

---

### Paso 3: Crear una Instancia de WhatsApp en Evolution API

#### Via Manager (UI visual)

1. Abre **http://localhost:8080/manager**
2. Ingresa tu `AUTHENTICATION_API_KEY` (la que pusiste en docker-compose)
3. Clic en **"New Instance"**
4. Llena:
   - **Instance Name**: `lavanderia-demo` (el nombre de tu tienda, sin espacios)
   - **Token**: (déjalo vacío, se genera automáticamente)
5. Guarda y luego haz clic en **"Connect"**
6. Escanea el **código QR** con el WhatsApp del número de la lavandería

#### Via API (alternativa)

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "apikey" = "TU_API_KEY_SECRETA_AQUI"
}
$body = @{
    instanceName = "lavanderia-demo"
    integration = "WHATSAPP-BAILEYS"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/instance/create" `
    -Method POST -Headers $headers -Body $body
```

---

### Paso 4: Configurar el Webhook hacia Supabase

Una vez conectada la instancia, configura el webhook para que Evolution API notifique a tu Edge Function cuando llegue un mensaje:

#### URL del Webhook de Supabase

```
https://TU_PROYECTO.supabase.co/functions/v1/handle-whatsapp-webhook?store_id=TU_USER_ID_DE_TIENDA
```

**Cómo obtener `store_id`:**
- Es el `id` del usuario en Supabase Auth → es el mismo `user_id` de la tabla `profiles`
- Puedes verlo en Supabase Dashboard → Authentication → Users

#### Configurar vía Manager

1. En el Manager, abre tu instancia `lavanderia-demo`
2. Ve a **"Webhook"** o **"Settings"**
3. En **Webhook URL** pega la URL completa con `store_id`
4. Activa los eventos: `MESSAGES_UPSERT`
5. Guarda

#### Configurar vía API

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "apikey" = "TU_API_KEY_SECRETA_AQUI"
}
$body = @{
    url = "https://TU_PROYECTO.supabase.co/functions/v1/handle-whatsapp-webhook?store_id=TU_USER_ID"
    webhook_by_events = $false
    webhook_base64 = $false
    events = @("MESSAGES_UPSERT")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/webhook/set/lavanderia-demo" `
    -Method POST -Headers $headers -Body $body
```

---

## Opción B — Railway (Nube, URL permanente)

Para tener una URL fija sin depender de ngrok.

### Paso 1: Crear proyecto en Railway

1. Ve a [railway.app](https://railway.app) e inicia sesión con GitHub
2. Clic en **"New Project"** → **"Deploy from Docker Image"**
3. Imagen: `atendai/evolution-api:latest`

### Paso 2: Variables de entorno en Railway

En la configuración del servicio, agrega estas variables:

```
SERVER_URL            = https://TU-APP.railway.app
AUTHENTICATION_TYPE   = apikey
AUTHENTICATION_API_KEY = TU_API_KEY_SECRETA
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES = true
DATABASE_ENABLED      = false
DEL_INSTANCE          = false
QRCODE_LIMIT          = 30
LOG_LEVEL             = ERROR,WARN,DEBUG,INFO,LOG
```

### Paso 3: Exponer el puerto

En Railway, ve a **Settings → Networking** → genera un **Public Domain** en el puerto `8080`.

Tu URL quedará como: `https://evolution-api-production-XXXX.up.railway.app`

Continúa desde el **Paso 3** de la Opción A para crear la instancia y configurar el webhook.

---

## ⚙️ Configurar la Tienda en el Sistema (UI)

Después de tener Evolution API corriendo, vincúlalo a la tienda desde la aplicación:

### 1. Ir a Configuración de la Tienda

En la app (`http://localhost:5173`), ve a:
**`/#/configuracion`** o directamente abre el modal **"Mensajería"** desde el dashboard de Delivery (`/#/delivery`).

### 2. Configurar el Gateway

| Campo | Valor |
|-------|-------|
| Tipo de Gateway | `qr_linked` (Evolution API propia) |
| Session Token / API Key | Tu `AUTHENTICATION_API_KEY` de Evolution API |

Esto guarda `whatsapp_gateway_type = 'qr_linked'` y `whatsapp_session_token = 'TU_API_KEY'` en la tabla `profiles` de Supabase.

---

## 🔐 Variables de Entorno en Supabase Edge Functions

Las Edge Functions necesitan conocer tu URL de Evolution API. Configúralas en:

**Supabase Dashboard → Settings → Edge Functions → Secrets**

```
EVOLUTION_API_URL       = https://abc123-xyz.ngrok-free.app   # o tu URL de Railway
EVOLUTION_INSTANCE_NAME = lavanderia-demo
APP_BASE_URL            = https://sistema-ventas-topaz.vercel.app
```

Si usas Twilio como fallback:

```
TWILIO_ACCOUNT_SID      = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN       = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER     = +15551234567
TWILIO_WHATSAPP_NUMBER  = whatsapp:+14155238886
```

#### Configurar via Supabase CLI

```powershell
cd "c:\SISTEMA_ LAVANDERIA"

npx supabase secrets set EVOLUTION_API_URL="https://abc123-xyz.ngrok-free.app"
npx supabase secrets set EVOLUTION_INSTANCE_NAME="lavanderia-demo"
npx supabase secrets set APP_BASE_URL="https://sistema-ventas-topaz.vercel.app"
```

---

## 🧪 Probar el Flujo Completo

### Prueba 1: Verificar que Evolution API responde

```powershell
# Estado de la instancia
Invoke-RestMethod -Uri "http://localhost:8080/instance/fetchInstances" `
    -Headers @{ "apikey" = "TU_API_KEY" }
```

Debe devolver tu instancia con `"state": "open"` si el QR fue escaneado correctamente.

### Prueba 2: Enviar un mensaje de prueba

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "apikey" = "TU_API_KEY"
}
$body = @{
    number = "521XXXXXXXXXX"   # Número destino con código de país
    text   = "Prueba de Evolution API desde Sistema Lavandería 🚀"
    delay  = 1200
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/message/sendText/lavanderia-demo" `
    -Method POST -Headers $headers -Body $body
```

### Prueba 3: Simular un mensaje entrante del cliente

Envía desde el teléfono del cliente un **WhatsApp con dirección** al número de la lavandería:

```
Calle Juárez 456, Colonia Centro, entre Morelos y Hidalgo
```

Verifica en:
1. **Supabase → Table Editor → `delivery_orders`**: Debe aparecer una nueva fila con `status = 'requested'`
2. **Supabase → Table Editor → `customers`**: Debe aparecer el número del cliente
3. El cliente debe recibir un WhatsApp automático con su link de tracking
4. En la app: `/#/delivery` debe mostrar la nueva solicitud con alerta sonora

### Prueba 4: Revisar logs de notificaciones

```sql
-- En Supabase SQL Editor
SELECT * FROM delivery_notification_logs
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🗂️ Resumen de Endpoints Evolution API usados

| Endpoint | Método | Uso en el sistema |
|----------|--------|------------------|
| `/instance/fetchInstances` | GET | Verificar estado de conexión |
| `/message/sendText/{instance}` | POST | Enviar mensajes al cliente/repartidor |
| `/chat/whatsappNumbers/{instance}` | POST | Validar si un número tiene WhatsApp |
| `/webhook/set/{instance}` | POST | Configurar webhook a Supabase |

---

## 🐛 Solución de Problemas Frecuentes

### "Error 401 Unauthorized" en Evolution API
La `apikey` del request no coincide con `AUTHENTICATION_API_KEY` del servidor. Verifica que el `whatsapp_session_token` en el perfil de la tienda sea exactamente igual.

### El webhook no llega a Supabase
- Verifica que ngrok esté corriendo y la URL sea correcta
- Asegúrate de incluir `?store_id=TU_USER_ID` en la URL del webhook
- Revisa los logs de la Edge Function: Supabase Dashboard → Edge Functions → `handle-whatsapp-webhook` → Logs

### "delivery_disabled" — El pedido no se crea
El campo `delivery_enabled` de la tienda es `false`. Actívalo desde `/#/portal-maestro` → PIN `2026SOP` → Activar Delivery.

### La instancia muestra `"state": "close"` o `"connecting"`
El QR expiró. Ve al Manager (`http://localhost:8080/manager`) y vuelve a escanear el QR.

### ngrok desconectado — URL cambió
Actualiza `EVOLUTION_API_URL` en los Secrets de Supabase Edge Functions con la nueva URL de ngrok, y redespliega las funciones:
```powershell
npx supabase secrets set EVOLUTION_API_URL="https://NUEVA-URL.ngrok-free.app"
npx supabase functions deploy notify-order
npx supabase functions deploy handle-whatsapp-webhook
```

---

## ✅ Checklist Final

- [ ] Evolution API corre (`http://localhost:8080/manager` o URL de Railway)
- [ ] Instancia creada y QR escaneado → `state: "open"`
- [ ] Webhook configurado apuntando a Supabase con `?store_id=...`
- [ ] Secrets `EVOLUTION_API_URL` e `EVOLUTION_INSTANCE_NAME` en Supabase
- [ ] Edge Functions `notify-order` y `handle-whatsapp-webhook` desplegadas
- [ ] `whatsapp_gateway_type = 'qr_linked'` en el perfil de la tienda
- [ ] `whatsapp_session_token = 'TU_API_KEY'` en el perfil de la tienda
- [ ] `delivery_enabled = true` para la tienda desde el Portal Maestro
- [ ] Prueba de mensaje entrante: pedido creado en `delivery_orders`
- [ ] Prueba de notificación saliente: cliente recibe WhatsApp con link de tracking
