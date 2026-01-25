# 📶 Guía de Operación y Configuración: MODO OFFLINE 2026

Esta guía explica cómo configurar y utilizar el sistema de ventas en modo sin conexión (Offline) tras la actualización de la Fase 1.

---

## 🛠️ Instalación y Requisitos

Al utilizar la versión de escritorio (**Electron**), no es necesario instalar software adicional en el equipo final. Sin embargo, para **generar** el archivo .exe (instalar en nuevas PCs), siga estos pasos:

### Cómo crear el archivo .exe (Instalador)

1. **Abrir la carpeta del proyecto** en su computadora.
2. Localice el archivo llamado `build-installer.bat`.
3. **Haga doble clic** en `build-installer.bat`. Se abrirá una ventana de comandos de Windows.
4. Espere a que el proceso termine (puede tardar unos minutos la primera vez mientras descarga dependencias).
5. Una vez finalizado, se creará una carpeta llamada **`release`**.
6. Dentro de `release`, encontrará el archivo: **`Sistema de Ventas Setup 1.3.0.exe`**.

Este es el archivo que debe copiar a la USB o enviar al cliente para su instalación.

### Requisito Crítico:

- **Ejecutar desde el Acceso Directo**: Asegúrese de abrir el programa siempre desde el icono de escritorio generado por el instalador. Esto garantiza que el servidor local (localhost:3001) se inicie junto con la ventana.

---

## 📋 Pasos para el Uso Diario (Paso a Paso)

### 1. Sincronización Inicial (Obligatorio)

Antes de llevar el equipo a un lugar sin internet, debe realizar una sincronización de inventario:

1. Conecte el equipo a internet.
2. Inicie el programa.
3. En la barra lateral izquierda, busque el indicador **"En Línea"** (Punto Verde).
4. Haga clic en el icono de **Sincronización (Sync)** 🔄.
5. El sistema confirmará que los productos han sido guardados en el equipo local.

### 2. Operación en Zona sin Internet

Cuando el equipo pierde la conexión:

1. El indicador cambiará automáticamente a **"Sin Conexión"** (Punto Rojo).
2. El sistema permitirá:
   - **Buscar Productos**: Por nombre o código de barras (usando la copia local).
   - **Realizar Ventas**: Puede agregar productos al carrito y finalizar la venta.
   - **Imprimir Tickets**: La impresión funciona de manera normal y local.
3. Al finalizar la venta, aparecerá un aviso: _"Venta guardada localmente (pendiente de sincronización)"_.

### 3. Sincronización de Ventas al Recuperar Conexión

Una vez que el equipo vuelva a tener acceso a internet:

1. El indicador volverá a **"En Línea"**.
2. **Auto-Sincronización**: Al detectar internet, el sistema intentará subir las ventas pendientes.
3. **Control Manual**: Puede hacer clic en el botón de **Sincronización** 🔄 para forzar la subida y asegurarse de que su inventario en la nube esté actualizado.

---

## 🔐 Control de Licencia Offline

El sistema permite trabajar sin internet, pero tiene una protección de seguridad:

- **Validación Silenciosa**: Cada vez que sincroniza productos, el sistema descarga un "permiso de operación" que le permite trabajar offline hasta su próxima fecha de pago.
- **Bloqueo de Seguridad**: Si llega la fecha de vencimiento y el equipo ha pasado muchos días sin internet, el sistema mostrará una pantalla de bloqueo solicitando conexión para validar el pago. Una vez conectado, se desbloquea automáticamente en segundos.

---

## ❓ Preguntas Frecuentes

- **¿Se pierden las ventas si apago la computadora sin internet?**
  No. Las ventas se guardan en el disco duro (SQLite) y permanecerán ahí hasta que se detecte internet para subirlas.
- **¿Puedo agregar productos nuevos sin internet?**
  No. La creación de productos nuevos, edición de precios y gestión de usuarios requiere internet para asegurar que todos los equipos tengan la misma información. El modo offline es principalmente para **VENTAS**.

---

_Soporte Técnico Especializado FoxSolid 2026_
