# 🎨 Admin Panel - Guía de Uso

## Acceso al Panel

El **Admin Panel** está disponible en la ruta `/admin` y solo es accesible para usuarios con rol de **Administrador** o **Propietario**.

### Cómo Acceder

1. Inicia sesión como administrador
2. En el menú lateral, busca el enlace **"Admin Panel"** (icono de escudo)
3. Haz clic para acceder al dashboard

---

## Características Implementadas

### 📊 1. Dashboard Principal

Vista general con 8 tarjetas estadísticas en tiempo real:

- **Total Productos**: Cantidad de productos en inventario
- **Bajo Stock**: Productos con menos de 5 unidades (alerta naranja)
- **Ventas Hoy**: Número de ventas realizadas hoy
- **Ingresos Hoy**: Total de ingresos del día en formato monetario
- **Órdenes Activas**: Órdenes de lavandería pendientes de entrega
- **Clientes**: Total de clientes registrados en el sistema
- **Personal Activo**: Empleados activos y disponibles
- **Cortes Recientes**: Últimos 10 cortes de caja realizados

**Características**:

- Actualización en tiempo real
- Tarjetas con colores distintivos
- Efectos hover interactivos
- Botón de refrescar datos

---

### 📦 2. Productos

Vista completa del inventario con las siguientes funcionalidades:

**Columnas Mostradas**:

- Nombre del producto
- Código de barras
- Precio unitario
- Stock disponible
- Estado (Disponible/Agotado)
- Fecha de creación

**Funcionalidades**:

- Búsqueda en tiempo real por nombre o código de barras
- Contador de productos filtrados
- Indicadores visuales de stock bajo (badge rojo < 5 unidades)
- Tabla responsive con scroll horizontal

---

### 💰 3. Ventas

Análisis detallado de las últimas 100 transacciones:

**Información Mostrada**:

- ID de la venta
- Total de la transacción
- Método de pago (efectivo, tarjeta, transferencia)
- Cantidad de items vendidos
- Fecha y hora exacta

**Características**:

- Total acumulado de ingresos
- Badges de colores por método de pago
- Ordenadas por fecha descendente
- Formato monetario consistente

---

### 🧺 4. Órdenes de Lavandería

Gestión completa de órdenes con seguimiento de estado:

**Columnas**:

- ID de orden
- Nombre del cliente
- Total a pagar
- Monto pagado
- Estado de la orden (Recibido, En Proceso, Listo, Entregado, Cancelado)
- Estado de pago (Pagado/Pendiente)
- Fecha prometida de entrega
- Fecha de creación

**Estados Visuales**:

- 🔵 Recibido - Orden ingresada al sistema
- 🟠 En Proceso - Lavado en curso
- 🟢 Listo - Orden lista para recoger
- ⚪ Entregado - Orden completada
- 🔴 Cancelado - Orden cancelada

---

### 👥 5. Clientes

Administración de la base de clientes:

**Datos Mostrados**:

- Nombre completo
- Teléfono de contacto
- Email
- Dirección
- Fecha de registro

**Funcionalidades**:

- Búsqueda por nombre, teléfono o email
- Contador de clientes filtrados
- Visualización de datos de contacto completos

---

### 👨‍💼 6. Personal

Gestión de empleados y roles del sistema:

**Información**:

- Nombre del empleado
- Rol (Administrador ⭐, Gerente 👔, Cajero 🛒)
- PIN (oculto por seguridad)
- Estado (Activo/Inactivo)
- Fecha de creación

**Badges de Roles**:

- 🟣 Administrador - Acceso total
- 🔵 Gerente - Ventas + Reportes
- 🟢 Cajero - Solo ventas

---

### 💵 7. Cortes de Caja

Historial completo de cortes con auditoría:

**Datos Registrados**:

- Nombre del empleado
- Tipo de corte (Turno, Día, Parcial)
- Cantidad de ventas
- Total de ventas
- Efectivo esperado
- Efectivo real contado
- Diferencia (positiva/negativa)
- Fecha y hora del corte

**Indicadores Visuales**:

- ✅ Verde: Diferencia positiva (sobrante)
- ❌ Rojo: Diferencia negativa (faltante)
- ⚪ Gris: Sin diferencia (cuadrado perfecto)

---

### ⚙️ 8. Configuración

Panel de información del sistema:

**Información Mostrada**:

- Nombre de la tienda
- Usuario actual
- Email del administrador
- Versión del sistema

**Acciones Disponibles**:

- 🔄 Sincronizar Datos
- 💾 Exportar Backup
- 📊 Generar Reporte

---

## Diseño y Estética

### Tema Oscuro Premium

- Paleta de colores oscuros inspirada en Django Admin
- Sidebar lateral con gradiente
- Tarjetas con bordes de colores
- Efectos hover suaves

### Componentes Visuales

- **Badges**: Etiquetas de colores para estados
- **Tablas**: Diseño limpio con hover effects
- **Búsqueda**: Input con foco verde
- **Iconos**: Material Design Icons

### Responsive

- Sidebar colapsable en móviles
- Tablas con scroll horizontal
- Grid adaptativo para tarjetas

---

## Seguridad

- ✅ Solo usuarios con rol `admin` pueden acceder
- ✅ Protección a nivel de ruta con `AdminRoute`
- ✅ Validación de permisos en el backend
- ✅ PINs ocultos en vista de personal
- ✅ Datos aislados por usuario (RLS de Supabase)

---

## Navegación

### Atajos de Teclado

- Click en el icono de escudo en el sidebar para acceder
- Botón de refrescar en el header para actualizar datos

### Rutas

- Dashboard: `/admin`
- Todas las secciones se cargan dinámicamente sin cambiar la URL

---

## Soporte Técnico

Para reportar problemas o solicitar nuevas funciones, contacta al equipo de desarrollo.

**Versión**: 2.0.0  
**Última actualización**: Enero 2026  
**Estado**: ✅ Todas las secciones implementadas y funcionales
