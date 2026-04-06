# 📖 Guía de Flujo de Trabajo: Sube cambios sin Miedo

¡Bienvenido al nuevo flujo de trabajo! Esta guía te enseñará cómo subir cambios a tu proyecto de Lavandería de forma profesional, asegurándote de que siempre puedas volver atrás si algo falla.

---

## 🚀 1. Ciclo de Vida de un Cambio

Sigue estos pasos para cada nueva funcionalidad o corrección:

### Paso 1: Crea una Rama (Branch)
Nunca trabajes directamente en `main`. Crea una rama nueva para tu tarea:
```bash
git checkout -b feature/mi-nueva-mejora
```

### Paso 2: Desarrolla y Haz Commits
Haz tus cambios y guárdalos con mensajes claros:
```bash
git add .
git commit -m "feat: agregada nueva validación de stock"
```

### Paso 3: Sube la Rama a GitHub
```bash
git push origin feature/mi-nueva-mejora
```

### Paso 4: Abre un Pull Request (PR)
1. Ve a tu repositorio en GitHub.
2. Verás un cartel amarillo que dice "Compare & pull request". Haz clic.
3. **Espera la validación:** Nuestra nueva **GitHub Action** se ejecutará automáticamente para verificar que el código compila y pasa los tests.
4. **Prueba en Vercel:** Vercel te dará una URL especial de "Preview". Ábrela y verifica que todo funcione.

### Paso 5: Merge (Fusión)
Si la validación de GitHub está en verde ✅ y la previsualización de Vercel es correcta, haz clic en **Merge pull request**. Tus cambios ahora se desplegarán automáticamente a la URL principal.

---

## 🆘 2. ¡Socorro! Algo falló en Producción

Si después del merge descubres un error grave, no entres en pánico. Tienes el "Botón del Pánico":

### Rollback en Vercel (Instantáneo)
1. Entra a [vercel.com](https://vercel.com) y selecciona tu proyecto.
2. Ve a la pestaña **Deployments**.
3. Busca el despliegue anterior (el que funcionaba bien).
4. Haz clic en los tres puntos `...` y selecciona **Rollback**.
5. Confirma. ¡Tu sitio volverá a la versión anterior en segundos!

---

## 🤖 3. Cómo pedirme cambios a mí (Antigravity)

Cuando me pidas algo, yo seguiré este flujo automáticamente:
1.  Te diré: *"Voy a crear una rama para este cambio"*.
2.  Implementaré los cambios en esa rama.
3.  Te pediré que revises el **Preview de Vercel**.
4.  Subiré el cambio para que tú mismo hagas el **Merge** en GitHub cuando estés listo.

> **Ejemplo de petición:**
> *"Antigravity, agrega un reporte de ventas mensual pero sigue el flujo de ramas seguro"*

---

## ⚙️ 4. Configuración Final (IMPORTANTE)

Para que el sistema sea 100% seguro, debes activar la protección de rama en GitHub:

1. En GitHub, ve a **Settings** -> **Branches**.
2. Haz clic en **Add branch protection rule**.
3. En `Branch name pattern` escribe: `main`.
4. Marca **"Require a pull request before merging"**.
5. Marca **"Require status checks to pass before merging"**.
6. En la lista de checks, busca y selecciona `build-and-test` (que es el nombre del trabajo en nuestro archivo `.yml`).
7. Haz clic en **Create**.

¡Listo! Ahora tu rama `main` está blindada.
