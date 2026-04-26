# Plan de Implementación: Servicios Express

El objetivo es agregar la funcionalidad de "Servicio Express" en el módulo de ventas (POS). Los usuarios podrán configurar los nombres de estos servicios (ej. "Servicio Express Ropa", "Servicio Express Toallas"). Durante una venta, al seleccionar uno de estos servicios, el sistema pedirá el precio en ese momento y lo registrará en la orden sin afectar el inventario (comportándose como un "Producto Común").

## Modelo y Base de Datos propuestos

1. **Nueva tabla `express_services`:**
   Se creará una nueva tabla para guardar los nombres de los servicios configurados.
   - Columnas: `id` (uuid), `name` (text), `user_id` (uuid), `created_at` (timestamp).
   - Se aplicarán las políticas RLS correspondientes para que cada local vea únicamente sus servicios express configurados.

## Servicios (Frontend)

1. **Nuevo archivo `frontend/src/services/expressServicesService.js`:**
   - Este servicio encapsulará las funciones de interacción con Supabase.
   - Contendrá acciones como obtener los servicios express activos, agregar un nuevo servicio y (opcionalmente) desactivar o eliminar un servicio configurado.

## Interfaz de Administración (Configuración)

1. **Actualización de `ConfiguracionPortal.jsx`:**
   - Agregar una nueva tarjeta "Servicios Express" que dirija el usuario a la sección de configuración de estos servicios.

2. **Nuevo componente `ServiciosExpressSettings.jsx`:**
   - Interfaz con un formulario sencillo para agregar un nuevo nombre de servicio ("Servicio Express Cobertor", etc.).
   - Visualización de la lista de servicios configurados.

3. **Actualización de `routing.jsx` (y AppRouter):**
   - Registrar la ruta `/configuracion-servicios-express`.

## Interfaz del Punto de Venta (`Sales.jsx`)

1. **Nuevo Modo de Venta "EXPRESS":**
   - Agregaremos un nuevo botón "SERVICIOS EXPRESS" al lado izquierdo de los botones actuales ("SERVICIOS", "PRODUCTOS", "PRODUCTO COMÚN").
   - El estado de la vista se apoyará en algo como `setSaleMode('EXPRESS')`.

2. **Carga y Renderizado:**
   - Se utilizará un `useEffect` para cargar al montar el componente (y en el provider, según convenga) los nombres configurados.
   - En el panel (grid) donde se listan los productos, se renderizarán estos botones de servicios, de forma parecida a como se muestran los productos actuales.

3. **Lógica al Dar Clic:**
   - En vez de añadir el servicio al carrito automáticamente (ya que no tienen precio fiho), se utilizará un modal de `SweetAlert2` (o similar al que usa "Producto Común") especificando explícitamente la **Cantidad** y pidiendo que el usuario ingrese manualmente el **Precio Unitario**.
   - Los datos recogidos por el modal se ensamblarán como un item común en el payload que se manda a `agregarProducto(item)`. Se utilizarán campos que aseguren que no descuente el inventario (`is_common: true`).

## Revisión Solicitada

¿Estás de acuerdo con el plan técnico? Específicamente, si deseas que esto maneje "Ropa", "Toallas", ¿el sistema no requerirá un seguimiento de peso (kg) en báscula verdad? 
Si todo es correcto, indícamelo para proceder a crear la migración y escribir los servicios.
