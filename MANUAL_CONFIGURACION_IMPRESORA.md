# 🖨️ Manual de Configuración de Impresión (POS)

Este manual detalla cómo configurar y utilizar el sistema de impresión de tickets tanto en la aplicación nativa (`.exe`) como a través de un navegador web.

---

## 🚀 Arquitectura Híbrida

El sistema utiliza un modelo de **"Impresión Unificada"**:

- **En el .exe (Electron):** Utiliza comunicación directa (IPC) para impresión silenciosa nativa.
- **En la Web (Chrome/Edge):** Utiliza el backend local (Puerto 3001) como un puente (Bridge) para enviar comandos a la impresora del sistema.

---

## 🛠️ Pasos para la Configuración

### 1. Preparación de la Impresora en Windows

Antes de configurar el sistema, asegúrese de que la impresora esté lista en Windows:

1. Conecte su impresora térmica vía USB.
2. Installe los drivers oficiales del fabricante.
3. En el **Panel de Control > Dispositivos e Impresoras**, asegúrese de que la impresora aparezca con un nombre claro (ej. `POS-80` o `XP-58`).
4. (Recomendado) Establezca la impresora como "Predeterminada" si solo usará una.

### 2. Configuración en el Sistema

Acceda al panel administrativo para vincular la impresora:

1. Inicie sesión como **Administrador**.
2. Diríjase a **Configuración > Ticket**.
3. Localice la nueva sección: **"Configuración de Impresora POS"**.
4. **Seleccionar Impresora:** Elija su impresora de la lista desplegable. Si no aparece, presione el botón de recarga (🔄).
5. **Ancho del Papel:** Seleccione `58mm` para impresoras térmicas pequeñas o `80mm` para el estándar grande.
6. **Pruebas:** Presione el botón **"Pruebas"**. Debería imprimirse un ticket de ejemplo con los datos de su negocio.
7. **Guardar:** Una vez confirmada la impresión, presione **"Guardar Cambios"**.

---

## 🌐 Uso en el Navegador Web (Modo Remoto)

Si utiliza el sistema desde una tablet u otra PC dentro de la misma red local:

- El navegador intentará comunicarse con el backend que corre en la PC principal.
- Si el backend local no está disponible, el sistema mostrará automáticamente el **diálogo de impresión del navegador** como medida de seguridad (Fallback).

---

## 🔍 Solución de Problemas (FAQ)

### La lista de impresoras está vacía

- Verifique que la impresora esté encendida y conectada.
- Si está en la Web, asegúrese de que el motor de datos (`backend`) se esté ejecutando en la PC principal.
- Reinicie la aplicación.

### El ticket sale con letras muy pequeñas o grandes

- Ajuste el valor de **"Tamaño Fuente (px)"** en la configuración de Ticket. El valor recomendado para 58mm es `10-12px` y para 80mm es `12-14px`.

### El ticket se corta antes de terminar o sobra mucho espacio

- Ajuste el **"Margen (px)"** en la configuración.
- Verifique las preferencias de impresión en el driver de Windows (Preferencias de impresión > Opciones avanzadas > Tamaño de papel).

---

## 📁 Archivos Técnicos Involucrados

Para desarrolladores o soporte técnico:

- **Frontend Service:** `frontend/src/services/printService.js` (Lógica de detección y envío).
- **Backend Controller:** `backend/controllers/printerController.js` (Puente PowerShell para Web).
- **Electron Main:** `electron-main.js` (IPC Handlers para impresión silenciosa native).
- **Preload:** `preload.js` (Exposición segura de APIs nativas).
