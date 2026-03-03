# PLAN DE MONITOREO PROACTIVO: SISTEMA LAVANDERÍA

Este plan está diseñado para detectar lentitud, cuellos de botella y problemas de infraestructura **antes de que los usuarios finales (cajeros, administradores) lo reporten**.

---

## 1. Monitoreo de la Base de Datos (Supabase / Postgres)

_Supabase es el núcleo del sistema. Cualquier lentitud aquí se reflejará en todas las interfaces._

### Acciones de Implementación:

1. **Activar e Inspeccionar `pg_stat_statements`**:
   - En el Dashboard de Supabase, ir a **Database -> Query Performance**.
   - Esto muestra qué consultas SQL consumen más tiempo y recursos.
   - **Métrica de éxito:** Ninguna consulta recurrente debe tomar más de `200ms`.
2. **Dashboard de Salud (Database Health)**:
   - Monitorear Uso de CPU, Memoria RAM y Disk IO.
   - Si la CPU supera el 70% recurrentemente, es necesario optimizar consultas (añadir índices) o escalar el servidor.
3. **Alertas Automáticas de Uso**:
   - Configurar notificaciones por correo en la sección de **Project Settings -> Spend Caps & Alerts** de Supabase para recibir un aviso si el consumo de recursos llega al 75% del límite del plan.

---

## 2. Monitoreo de Frontend Web (Vercel) y App

_Permite saber si la interfaz se congela o si hay errores de red invisibles._

### Acciones de Implementación:

1. **Rastreo de Errores con Sentry (Recomendado)**:
   - Integrar [Sentry](https://sentry.io/) (el plan gratuito es suficiente) en el proyecto de React/Vite.
   - **¿Qué hace?** Captura "Excepciones No Controladas" (pantallas blancas) y peticiones HTTP fallidas.
   - Sentry te alertará inmediatamente cuando un endpoint falle o un componente rompa la pantalla.
2. **Vercel Speed Insights (Web Vitals)**:
   - Activar la pestaña "Speed Insights" en el Dashboard de Vercel.
   - Monitorea la velocidad de carga real de los usuarios (LCP, FID). Si la carga inicial sube de 2.5 segundos, Vercel registrará la métrica como "Pobre" permitiéndote actuar sobre el rendimiento del código.
3. **Monitoreo de Uptime (Disponibilidad)**:
   - Usar [UptimeRobot](https://uptimerobot.com/) (Gratis).
   - Configurar un monitor que haga "ping" a la web de Vercel y al backend (si está en la nube) cada 5 minutos.
   - Te enviará un correo o mensaje de Telegram si la página se cae completamente antes de que el cliente abra la tienda.

---

## 3. Monitoreo del Cliente de Escritorio (Electron / Backend Local)

_Para las cajas que corren el instalable local `.exe`._

### Acciones de Implementación:

1. **Logs Estructurados Proactivos**:
   - Utilizar el paquete `electron-log` (ya pre-instalado en tu `package.json`).
   - Todos los errores de "Network Timeout", "Fallo de Impresión" o "Desconexión de Supabase" deben guardarse en los logs locales de la máquina (`%USERPROFILE%\AppData\Roaming\Sistema de Ventas\logs\`).
2. **Ping de Sincronización P2P**:
   - El sistema ya tiene lógica para conectarse al backend local (`http://localhost:3002`). Se debe implementar un recuento de fallos de conexión.
   - Si un nodo local ("caja hija") pierde conexión con el servidor maestro por más de 1 minuto, la interfaz debe mostrar un indicador proactivo (ej. un semáforo rojo en la barra superior) en lugar de fallar al intentar guardar una nueva venta.

---

## 4. Arquitectura de Alertas (El "Bunker" de Soporte)

_No sirve monitorear si nadie ve las alertas._

1. **Canal Centralizado (Discord o Slack)**:
   - Crear un servidor/canal privado llamado `#alertas-lavanderia`.
   - Conectar **UptimeRobot**, **Sentry** y **Vercel Webhooks** a este canal.
2. **Semáforo de Gravedad**:
   - 🔴 **CRÍTICO (P0)**: Supabase caído, UptimeRobot reporta web inactiva, picos de errores HTTP 500. _(Acción inmediata)_.
   - 🟡 **ADVERTENCIA (P1)**: Consultas lentas (>1000ms) reportadas por Supabase, CPU > 75%, errores de sincronización offline. _(Analizar y parchear en menos de 24 hrs)_.
   - 🔵 **INFORMATIVO**: Tiempos de carga web ligeramente elevados. _(Tarea técnica rutinaria)_.

---

## Siguientes Pasos (Implementación)

Si decides ejecutar este plan de monitoreo, los pasos recomendados a pedir a la IA son:

1. _"Implementar Sentry en el frontend para rastreo de errores."_
2. _"Configurar en Supabase una vista para ver las consultas más lentas de la base de datos."_
3. _"Agregar alertas visuales en el Punto de Venta (semáforo) si la conexión local supera los 1000ms de latencia."_
