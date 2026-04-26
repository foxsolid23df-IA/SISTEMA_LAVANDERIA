# Plan de Implementación: Formas de Pago

Este documento describe los cambios técnicos necesarios para agregar el módulo "Formas de Pago" a la sección de Configuración del sistema, tal como se solicitó en el diseño y capturas de pantalla proporcionadas.

## 1. Base de Datos (Supabase)
**Objetivo:** Almacenar los métodos de pago personalizados para que dejen de estar en código duro ("hardcoded").

* **Nueva Tabla:** `payment_methods`
    * `id` (uuid, primary key)
    * `name` (varchar, ej. "Vales de Despensa")
    * `sat_key` (varchar, ej. "08")
    * `is_system` (boolean, defecto: false. Identifica métodos base como Efectivo, Tarjeta, Transferencia para evitar que los borren por error).
    * `is_active` (boolean, defecto: true. Permite ocultarlos en nueva venta).
    * `created_at` (timestamp)
* **Políticas (RLS):** Permitir lectura autenticada; inserción y actualización a usuarios de tipo administrador.
* **Datos Semilla (Seed):** Insertar los tres métodos iniciales marcados como `is_system=true`:
  1. Efectivo (SAT: 01)
  2. Tarjeta (SAT: 04)
  3. Transferencia (SAT: 03)

## 2. Capa de Servicios (Frontend)
**Objetivo:** Conectar el frontend con la nueva tabla de Supabase.

* **Nuevo Archivo:** `frontend/src/services/paymentMethodsService.js`
* **Funciones requeridas:**
    * `getPaymentMethods()`: Obtener la lista ordenada (primero "Sistema", luego personalizados, luego inactivos).
    * `addPaymentMethod({ name, sat_key })`: Insertar un nuevo método.
    * `updatePaymentMethod(id, data)`: Renombrar o cambiar clave SAT.
    * `togglePaymentMethodStatus(id, isActive)`: Activar o desactivar (ocultar en ventas).
    * `deletePaymentMethod(id)`: Borrar permanentemente (aplicará validación para evitar borrar `is_system`).

## 3. Interfaz de Usuario (Frontend)

### 3.1 Portal de Configuración
* **Archivo a modificar:** `frontend/src/components/config/ConfiguracionPortal.jsx`
* **Cambio:** Agregar un nuevo `NavLink` o "tarjeta" similar a las demás ("Tipos de Cambio", "Usuarios"), que dirija a `/configuracion-pagos`.
* **Iconos:** Utilizar un ícono de pagos/dinero (`payments` o `account_balance_wallet` en Material Icons).

### 3.2 Nueva Pantalla de Formas de Pago
* **Archivos nuevos:** 
  * `frontend/src/components/admin/PaymentMethodsSettings.jsx`
  * `frontend/src/components/admin/PaymentMethodsSettings.css` (opcional, si los estilos no están en Tailwind directamente).
* **Componentes visuales:**
    1. **Botón de regreso:** Un botón `<button>` en la parte superior que llame a `navigate('/configuracion')` con el texto "<- Regresar a Configuración" envuelto en un estilo `exchange-rate-settings-container`.
    2. **Encabezado:** Título "Formas de Pago" y subtítulo solicitados ("Administra los métodos de pago disponibles en el sistema Punto de Venta.").
    3. **Formulario de Alta (`Card`):**
        * Input text: `NOMBRE DEL MÉTODO` (Ej. Vales de Despensa).
        * Input text: `CLAVE SAT (OPCIONAL)` (Ej. 08).
        * Botón principal: `+ Añadir` (`type="submit"`, color azul principal).
    4. **Listado de Métodos Existentes (`Card` individual por cada uno):**
        * Renderizado iterando el resultado de `getPaymentMethods()`.
        * Icono genérico de método de pago (billete para efectivo, tarjeta para plásticos, etc.).
        * Texto principal (Nombre).
        * Un _Badge_ (Etiqueta Verde) para la clave SAT (Ej. `SAT: 01`).
        * Un _Badge_ secundario (Azul claro) para indicar `Sistema` (solo si `is_system` es true).
        * **Menú contextual (Tres Puntos):** 
            * **Editar:** Renombrar o cambiar clave SAT (abrirá un modal o cambiará la fila a modo edición).
            * **Desactivar / Activar:** Ocultar/mostrar en ventas mediante el campo `is_active`.
            * **Eliminar:** Borrar (no mostrar en `is_system`).

## 4. Enrutamiento
* **Archivo a modificar:** `frontend/src/router/routing.jsx`
* **Cambio:** Importar `PaymentMethodsSettings` y registrar la ruta `/configuracion-pagos` envuelta con protección de autenticación (y verificación `isAdmin` si corresponde).

## 5. Próximos pasos (Una vez implementado esto)
Después de tener esta configuración finalizada, la actualización natural es conectar las pantallas de venta (`Sales.jsx`, `Orders.jsx`) para cambiar los estados `useState("cash")` quemados por un componente que itere los pagos activos de esta misma base de datos, logrando flexibilidad del 100%.

---
**NOTA:** El plan está documentado y guardado de forma local como se solicitó. Favor de aprobar el plan de implementación para proceder a la etapa de CÓDIGO.
