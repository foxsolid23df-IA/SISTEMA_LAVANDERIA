# 📔 Manual de Usuario: Herramienta de Soporte Maestro

Este manual está diseñado para el equipo de soporte técnico y administradores del programa. Explica cómo realizar limpiezas profundas del sistema sin afectar el inventario de los clientes.

---

## 🔏 Acceso de Seguridad

La herramienta no aparece en los menús para evitar que los clientes la usen por error. Siga estos pasos:

1. **URL Directa**: En el navegador, después de la dirección de la tienda, escriba exactamente:
   `#/soporte-tecnico-especializado-nexusprolavanderia`
2. **Validación**: Verá una pantalla azul. Ingrese el código maestro: `2026SOP`.
3. **Identificación**: Una vez dentro, ya puede ver las opciones de limpieza.

---

## 📋 Casos de Uso (Ejemplos Reales)

### Caso 1: Cambio de Computadora (Liberar Licencia)

- **Situación**: El cliente compró una computadora nueva y quiere pasar el programa a esa.
- **Acción**: Marque **"Resetear Dispositivos"**.
- **Resultado**: Todas las máquinas registradas se borran. En la computadora nueva, el cliente podrá darle un nombre nuevo y empezar a vender.

### Caso 4: Baja de Cliente (Reset de Fábrica)

- **Cuándo usar**: Cuando el cliente cancela el servicio y el sistema debe quedar vacío para un nuevo dueño.
- **Acción**: Escribir `BORRAR-TODO` y presionar el botón rojo.
- **Resultado**: Se borran ventas, productos, cajeros y perfiles.
- **NOTA DE EMERGENCIA**: Si la herramienta automática no responde, use el archivo `RESET_MANUAL_SUPABASE.md` para hacerlo directamente desde el panel de Supabase.

### Caso 2: Limpieza de Fin de Año

- **Situación**: El cliente quiere empezar el año con el historial de ventas en cero, pero manteniendo todos sus productos.
- **Acción**: Marque **"Limpiar Transacciones"**.
- **Resultado**: Se borran ventas, cortes y dinero en caja. Los productos, precios y stock **se mantienen intactos**.

### Caso 3: Reconfiguración de Personal

- **Situación**: Hubo rotación de personal y el cliente quiere borrar a todos los cajeros antiguos de un solo golpe.
- **Acción**: Marque **"Resetear Usuarios Secundarios"**.
- **Resultado**: Solo queda la cuenta del dueño (Admin). Las cuentas de los empleados se eliminan.

---

## 🛠️ Guía Paso a Paso (El Proceso)

### Paso A: Preparación

Antes de empezar, pregunte al cliente: _"¿Está seguro? Esta acción no se puede deshacer"_. Es recomendable que el cliente termine su turno del día antes del reset.

### Paso B: Selección de Limpieza

Seleccione la opción deseada (puede marcar varias a la vez). Note que el botón abajo está gris y bloqueado; esto es normal.

### Paso C: Código de Desbloqueo

1. Diríjase al cuadro que dice "Escriba RESET para habilitar".
2. Escriba **RESET** en mayúsculas.
3. El botón se pondrá rojo. Haga clic en **"Ejecutar Limpieza"**.

### Paso D: Confirmación Final

El navegador lanzará una última pregunta: _"¿Desea realizar esta acción?"_. Haga clic en **Aceptar**.

---

## ❓ Preguntas de Emergencia

**¿Qué pasa si borro todo por error?**

> Solo se borra el historial de ventas y los nombres de las máquinas. Los productos y precios **nunca** se borran con esta herramienta. Es un proceso seguro para el inventario.

**El botón no se pone rojo, ¿por qué?**

> Debe escribir la palabra "RESET" exactamente en mayúsculas. Si hay un espacio extra o está en minúsculas, el botón seguirá bloqueado.

---

_Soporte NexusProLavanderia - Gestión Segura de Datos_
