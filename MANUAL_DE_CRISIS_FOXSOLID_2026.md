# 🚨 Manual de Crisis: Sistema de Gestión FoxSolid 2026

**Versión:** 1.0
**Estado:** Operativo / Emergencia
**Última Revisión:** Enero 2026

Este manual describe los procedimientos de acción inmediata ante situaciones críticas que puedan afectar la operación del negocio. Su objetivo es minimizar el tiempo de inactividad y garantizar la integridad de los datos.

---

## 🚩 Índice de Emergencias

1.  [Infraestructura y Conectividad](#1-infraestructura-y-conectividad)
2.  [Errores de Software y Base de Datos](#2-errores-de-software-y-base-de-datos)
3.  [Crisis Operativas (Caja e Inventario)](#3-crisis-operativas-caja-e-inventario)
4.  [Protocolos de Seguridad](#4-protocolos-de-seguridad)
5.  [Directorio de Soporte Técnico](#5-directorio-de-soporte-técnico)

---

## 1. Infraestructura y Conectividad 🌐

### 1.1 Corte de Internet

**Qué pasa:** El indicador de estado en la barra lateral se pone en **ROJO** (Desconectado).

- **Cómo evitarlo:** Contar con una conexión de respaldo (Hotspot de celular).
- **Cómo resolverlo:**
  1. No cierres la sesión. El sistema puede seguir vendiendo en modo **Offline**.
  2. Las ventas se guardarán localmente en la PC.
  3. Una vez vuelva el internet, presiona el botón **Sincronizar (Sync)** 🔄.
  4. **Nota:** No intentes actualizar precios o crear productos hasta recuperar la conexión.

### 1.2 Falla de Energía Eléctrica

**Qué pasa:** La computadora se apaga repentinamente.

- **Cómo evitarlo:** Uso obligatorio de No-Break (UPS) con al menos 15 minutos de autonomía.
- **Cómo resolverlo:**
  1. Al encender, verifica que el servicio de base de datos local (Backend) inicie correctamente.
  2. Si el sistema no abre, ejecuta el acceso directo `FoxSolid Repair` o reinicia la PC.
  3. Verifica la última venta realizada para asegurar que se guardó.

### 1.3 Falla de la Impresora de Tickets

**Qué pasa:** El sistema marca venta exitosa pero no sale el ticket.

- **Cómo evitarlo:** Revisar niveles de papel térmico cada mañana.
- **Cómo resolverlo:**
  1. Ve al historial de **Ventas** en el Panel de Administración.
  2. Busca el último ticket y presiona **Reimprimir**.
  3. Si persiste, revisa la conexión USB del cable de la impresora.

---

## 2. Errores de Software y Base de Datos 💻

### 2.1 Error: "Servicio no disponible" (Supabase Down)

**Qué pasa:** El sistema no carga productos o marca errores 500 al intentar guardar.

- **Cómo resolverlo:**
  1. El sistema entrará automáticamente en modo de reintentos. Espera 1 minuto.
  2. Si el problema persiste a nivel global (falla de Supabase), mantén la app abierta para operar en cache local.
  3. No borres el historial del navegador ni limpies archivos temporales, ya que ahí reside la copia de seguridad inmediata.

### 2.2 Error de Sincronización (Conflictos)

**Qué pasa:** Aparece un mensaje indicando que los datos locales y la nube no coinciden.

- **Cómo resolverlo:**
  1. Ve a **Configuración** -> **Sincronización Avanzada**.
  2. Selecciona **"Priorizar Nube"** si los cambios se hicieron en otra sucursal.
  3. Selecciona **"Priorizar Local"** si las ventas de hoy aún no han subido.

### 2.3 El Sistema se queda "Congelado" o en Blanco

**Qué pasa:** La pantalla no responde a clics o queda en blanco.

- **Cómo resolverlo:**
  1. Presiona `Ctrl + R` para recargar la aplicación.
  2. Si estás en la versión de escritorio (.exe), presiona `F5` o cierra y abre nuevamente.
  3. Los datos no se pierden al cerrar la ventana, ya que se autoguardan cada 30 segundos.

---

## 3. Crisis Operativas (Caja e Inventario) 💰

### 3.1 Diferencia Negativa en Corte de Caja (Faltantes)

**Qué pasa:** El dinero real es menor al reportado por el sistema.

- **Cómo resolverlo:**
  1. Revisa el historial de ventas del turno actual para identificar si una venta se marcó como "Tarjeta" siendo "Efectivo".
  2. Verifica si se realizaron retiros parciales de efectivo (gastos de tienda) no registrados.
  3. **Acción:** No cierres el corte hasta que el propietario autorice el ajuste manual.

### 3.2 Error en Importación Masiva de Inventario

**Qué pasa:** Subiste un Excel y los precios o nombres están erróneos en todo el sistema.

- **Cómo resolverlo:**
  1. **Inmediato:** Usa la función **"Deshacer Última Importación"** en el módulo de Inventario (disponible por 10 minutos).
  2. Si pasó más tiempo, contacta a soporte para aplicar un "Rollback" a la base de datos de producción.

---

## 4. Protocolos de Seguridad 🔐

### 4.1 Olvido de PIN Maestro

**Qué pasa:** El propietario no puede acceder a funciones críticas.

- **Cómo resolverlo:**
  1. Usa el **Código de Recuperación** generado durante la instalación inicial.
  2. Si no lo tienes, deberás solicitar un reseteo de PIN a través de Soporte Técnico validando tu identidad con el correo de administración de Supabase.

### 4.2 Intento de Acceso no Autorizado

**Qué pasa:** Se detectan múltiples intentos fallidos de PIN.

- **Cómo evitarlo:** El sistema bloquea la terminal por 5 minutos tras 5 intentos fallidos.
- **Cómo resolverlo:**
  1. El administrador recibirá una notificación (si está configurado).
  2. Cambia los PINs de los empleados sospechosos desde el **Admin Panel**.

---

## 5. Directorio de Soporte Técnico 📞

| Nivel                    | Contacto                     | Tiempo de Respuesta |
| :----------------------- | :--------------------------- | :------------------ |
| **Nivel 1 (Operación)**  | Gerente de Sucursal          | Inmediato           |
| **Nivel 2 (Soporte TI)** | whatsapp: +52 [TU_NUMERO]    | < 2 horas           |
| **Nivel 3 (Desarrollo)** | foxsolid.systems@soporte.com | < 24 horas          |

---

> **⚠ REGLA DE ORO:** Ante cualquier duda o comportamiento extraño del sistema, **TOMA UNA CAPTURA DE PANTALLA O FOTO** antes de reiniciar. Esto ayuda al equipo técnico a resolver el problema más rápido.

_FoxSolid Systems © 2026_
