# 📦 Guía de Lanzamiento: Cómo publicar actualizaciones en GitHub

Esta guía explica el paso final y más importante para que tus clientes reciban las actualizaciones automáticas. Sin este proceso, el sistema no podrá encontrar los archivos nuevos.

---

### 🕒 Paso 1: Esperar a que el sistema termine de "Cocinarse"

Cada vez que subes una versión (ej: v1.3.4), GitHub comienza a construir el instalador. Esto tarda aproximadamente **5 minutos**.

1. Entra a tu repositorio en GitHub.
2. Haz clic en la pestaña **"Actions"**.
3. Verás un proceso llamado **"Build and Release"**.
4. **Espera** a que el círculo pase de color naranja (proceso) a **verde con un check (éxito)**.

---

### 🚀 Paso 2: Publicar la Versión (El paso CRITICO)

Cuando el proceso termina en verde, GitHub crea la versión pero la guarda como un **"Borrador" (Draft)**. Los borradores son invisibles para el sistema de actualización de tus clientes.

1. Ve a la columna derecha de tu repositorio y busca donde dice **"Releases"**.
2. Haz clic en la versión más reciente (ej: `1.3.4`). Verás una etiqueta roja que dice **"Draft"**.
3. Haz clic en el botón del **lápiz (Edit)** arriba a la derecha.
4. Desliza hasta el final de la página.
5. Verás tres archivos en la sección "Assets":
   - `latest.yml` (El imán de actualizaciones).
   - `Sistema-de-Ventas-Setup-X.X.X.exe` (El instalador).
   - `...blockmap` (Archivo de control).
6. Haz clic en el botón verde grande que dice **"Publish release"**.

---

### ✅ Paso 3: Confirmación

Una vez que hagas clic en **Publish release**:

- La etiqueta roja de **"Draft"** desaparecerá.
- Aparecerá una etiqueta verde que dice **"Latest"**.
- **¡LISTO!** En ese instante, todos los sistemas de tus clientes detectarán que hay una nueva versión y comenzarán a descargarla automáticamente.

---

### 💡 Recordatorio de Oro

> **"Si no hay etiqueta VERDE (Latest) en GitHub, no hay actualización para el cliente."**

Si tus clientes te dicen que no les llega la actualización, el 99% de las veces es porque la versión se quedó en "Draft" (Borrador) y solo falta hacer clic en **Publish**.
