# 🚀 Guía de Despliegue en Vercel - Sistema Lavandería

Para subir la aplicación a producción en Vercel, sigue estos pasos detallados.

## 1. Requisitos Previos

- Una cuenta en [Vercel](https://vercel.com).
- El código subido a un repositorio de GitHub (Recomendado).

## 2. Preparar el repositorio

Asegúrate de que la carpeta `frontend` sea el directorio raíz para Vercel o configura el "Root Directory" adecuadamente.

## 3. Configuración en Vercel

Al crear el nuevo proyecto, usa estas configuraciones:

- **Framework Preset**: Vite
- **Root Directory**: `frontend` (si el repo tiene el backend también)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

## 4. Variables de Entorno (CRÍTICO)

Debes copiar las variables de tu archivo `.env` a la sección de Variables de Entorno en Vercel:

1. `VITE_SUPABASE_URL`: Tu URL de proyecto Supabase.
2. `VITE_SUPABASE_ANON_KEY`: Tu llave pública anónima.

## 5. Consideraciones del Backend

- **Base de Datos**: Supabase ya está en la nube, por lo que el frontend se conectará directamente sin problemas.
- **Backend Local (SQLite/Electron)**: El panel de administración que creamos en React funcionará en Vercel, pero las funciones que dependan de la base de datos **local** (como sincronización con SQLite local) solo funcionarán cuando abras el sistema desde la aplicación de escritorio instalada.

## 6. Pasos para Producción

1. Haz un `push` a tu rama `main`.
2. Vercel detectará el cambio y comenzará el despliegue automáticamente.
3. Una vez terminado, Vercel te dará una URL (ej: `lavanderia-2026.vercel.app`).

---

### 💡 Recomendación Pro

Configura un dominio personalizado (ej: `admin.lavanderia.com`) desde el panel de Vercel -> Settings -> Domains.
