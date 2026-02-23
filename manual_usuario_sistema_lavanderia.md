# 📘 Manual de Usuario Completo: Sistema de Lavandería

Este documento es la guía definitiva para el uso del Sistema de Lavandería, estructurado por niveles de acceso: **Nivel Empleado (Operador)** y **Nivel Dueño (Administrador)**.

---

## 👥 PARTE 1: NIVEL EMPLEADO (Operador)

Los empleados tienen acceso a las funciones operativas diarias del negocio: recepción de prendas, cobro, gestión de órdenes en proceso y registro de clientes.

### 1.1 Inicio de Sesión y Apertura de Caja

- **Acceso:** Ingresa con el PIN de empleado asignado.
- **Fondo de Caja:** Al iniciar el turno (si la caja está cerrada), el sistema pedirá ingresar el monto inicial con el que se abre la caja. Este paso es obligatorio para comenzar a cobrar.
- **Bloqueo Rápido:** Si te alejas de la computadora, puedes bloquear la pantalla para evitar uso no autorizado. Se desbloquea con el mismo PIN.

### 1.2 Módulo de Ventas (Nueva Recepción)

_Ruta: Menú > Nueva Venta / Inicio_

Es el corazón del sistema donde se reciben las prendas del cliente.

1. **Selección del Cliente (Obligatorio):**
   - Busca al cliente por nombre o teléfono.
   - Si no existe, usa el botón "+" para registrarlo.
2. **Agregar Servicios y Productos:**
   - Haz clic en los servicios (ej. Lavado, Planchado) o productos (ej. Suavizante) en la parte central.
   - Ajusta cantidades o pesos utilizando las opciones en pantalla (o conectando báscula si aplica).
3. **Resumen de la Orden (Carrito):**
   - A la derecha verás el desglose. Puedes aplicar descuentos, eliminar ítems o agregar notas a prendas específicas.
4. **Cobrar y Generar Ticket:**
   - Haz clic en "Pagar". Selecciona el método de pago (Efectivo, Tarjeta, Transferencia) y si se deja pagado o pendiente (si el sistema lo permite).
   - El ticket se generará y se imprimirá automáticamente según la configuración.

### 1.3 Gestión de Órdenes (Tablero / Kanban)

_Ruta: Menú > Órdenes_

Aquí se controla el flujo de trabajo de la ropa, desde que entra hasta que se entrega.

- **Vistas:** Puedes ver las órdenes en formato de lista tradicional o en un tablero interactivo (Kanban) arrastrable.
- **Estados de la Orden:**
  1. _Pendiente:_ Ropa recién recibida.
  2. _En Proceso:_ Lavándose/Secándose/Planchándose.
  3. _Lista para Entrega:_ Terminada, esperando al cliente.
  4. _Entregada:_ El ciclo ha concluido.
- **Acciones:** Arrastra las tarjetas para cambiar su estado o haz clic en ellas para ver los detalles, imprimir nuevamente un ticket o marcar como pagada una orden con saldo pendiente.

### 1.4 Gestión de Clientes

_Ruta: Menú > Clientes (o desde Nueva Venta)_

- **Registrar:** Se solicitan datos como Nombre Completo (obligatorio), Teléfono (para notificaciones de WhatsApp) y Dirección (para entregas a domicilio).
- **Prevención de Duplicados:** El sistema advertirá si ingresas un número o nombre ya existente.
- **Historial:** En el perfil de un cliente se pueden visualizar todas sus órdenes pasadas y su estatus.

### 1.5 Funciones Auxiliares

- **Pantalla de Cliente (Customer Display):** En monitores dobles, muestra al cliente su carrito de compras y total a pagar en tiempo real.
- **Corte de Caja (Cerrar Turno):** Al finalizar el turno, el empleado debe realizar el corte de caja, indicando cuánto efectivo tiene físicamente. El sistema generará el ticket de "Corte Z" e indicará si hay sobrantes o faltantes.

---

## 👑 PARTE 2: NIVEL DUEÑO (Administrador)

Los dueños y administradores tienen acceso a toda la información estratégica, configuraciones, reportes financieros y edición del catálogo.

### 2.1 Panel de Administración (Dashboard)

_Ruta: Menú > Admin_

Un panel gerencial donde se visualiza el control total del negocio.

- Acceso a atajos rápidos hacia reportes financieros, manejo de inventarios y configuración del sistema empresarial.

### 2.2 Historial de Ventas y Cortes de Caja

_Ruta: Menú > Historial_

- **Control de Notas:** Búsqueda rápida de cualquier folio, ticket o venta realizada.
- **Revisión de Cortes:** Acceso al histórico de cortes de caja de todos los empleados. Ideal para auditorías y cuadrar cuentas de días anteriores.

### 2.3 Estadísticas y Reportes

_Ruta: Menú > Estadísticas_

- **Desempeño Financiero:** Gráficos de ingresos mensuales, semanales o diarios.
- **Servicios Estrella:** Visualiza cuáles son los servicios/productos más vendidos.
- **Rendimiento por Empleado:** Monitorea qué trabajador registra más ingresos.
- _Exportación:_ Posibilidad de descargar reportes en formatos manejables para contabilidad.

### 2.4 Control de Inventarios y Catálogos

El sistema maneja 3 tipos de catálogos distintos:

1. **Servicios** _(Ruta: Menú > Servicios)_: Ej. Lavado por Kilo, Edredón Matrimonial, Planchado de Camisa. Se define precio y categoría.
2. **Productos** _(Ruta: Menú > Productos)_: Artículos de venta directa como ganchos, bolsas, jabón líquido, suavizante. Controlan stock.
3. **Insumos** _(Ruta: Menú > Insumos)_: Materia prima de uso interno (detergente de 20L, desengrasante). Ayuda a llevar el control del gasto operativo.

### 2.5 Gestión de Usuarios (Empleados)

_Ruta: Menú > Usuarios_

- **Crear / Editar Empleado:** Registra a tu staff.
- **Asignación de PIN:** Define el PIN numérico de acceso para cada trabajador.
- **Permisos (Roles):** Define si un usuario es "Admin" (acceso total a dinero e inventario) o "Vendedor/Operador" (solo acceso a ventas y órdenes).

### 2.6 Configuraciones Avanzadas del Negocio

- **Lista de Precios Especiales** _(Ruta: Admin > Precios)_: Permite configurar precios diferenciados para clientes de mayoreo, hoteles o corporativos, facilitando la retención de grandes cuentas.
- **Tipo de Cambio (Dólares)** _(Ruta: Admin > Config. Dólares)_: Si tu negocio está en frontera o recibe moneda extranjera, puedes fijar la tasa de cambio diaria para que el sistema calcule el cobro automáticamente en la pantalla de ventas.
- **Configuración del Ticket** _(Ruta: Admin > Config. Ticket)_: Personaliza el encabezado, logotipo, pie de página (ej. "¡Gracias por su preferencia!") y parámetros de la impresora térmica de 58mm u 80mm.

---

_Fin del Manual._  
_Si tienes requerimientos de soporte técnico, ponte en contacto con los medios oficiales de Foxsolid._
