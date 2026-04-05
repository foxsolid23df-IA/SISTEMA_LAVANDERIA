# 🛒 Sistema de Ventas POS - SaaS

Sistema de Punto de Venta (POS) profesional desarrollado con React y Supabase, diseñado para pequeños y medianos negocios.

![Version](https://img.shields.io/badge/version-1.3.7-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-19.1-61DAFB?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)

## 🌐 Demo en Vivo

**URL de Producción:** https://sistema-ventas-topaz.vercel.app

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Arquitectura](#-arquitectura)
- [Tecnologías](#-tecnologías)
- [Instalación](#-instalación)
- [Configuración de Supabase](#-configuración-de-supabase)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Módulos del Sistema](#-módulos-del-sistema)
- [Sistema de Autenticación](#-sistema-de-autenticación)
- [API de Servicios](#-api-de-servicios)
- [Despliegue](#-despliegue)
- [Esquema de Base de Datos](#-esquema-de-base-de-datos)
- [Documentación Adicional](#-documentación-adicional)

---

## ✨ Características

### Punto de Venta (POS)

- ✅ **Soporte Multi-Caja**: Sistema diseñado para múltiples terminales simultáneas.
- ✅ **Pantalla del Cliente**: Interfaz secundaria para que el cliente vea su compra en tiempo real.
- ✅ **Persistencia de Carrito**: El carrito se mantiene incluso al navegar o refrescar la página.
- ✅ **Escaneo de códigos de barras**: Soporte para lectores automáticos y manuales.
- ✅ **Búsqueda Inteligente**: Localización de productos por nombre en milisegundos.
- ✅ **Tickets Profesionales**: Impresión de tickets detallados para cada venta.

### Inventario y Proveedores

- ✅ **Importación Masiva**: Carga de inventario completo mediante plantillas de Excel.
- ✅ **Gestión de Proveedores**: Módulo dedicado para administrar contactos y suministros.
- ✅ **Control de Stock**: Alertas de stock mínimo y actualización automática.
- ✅ **Imágenes Integradas**: Soporte para fotografías de productos (Base64/URL).

### Gestión y Auditoría

- ✅ **Administrative API (v1.3)**: Nueva API dedicada para mantenimiento, salud del sistema y logs forenses.

- ✅ **Sistema Multi-rol**: Propietario, Admin, Gerente y Cajero con permisos granulares.
- ✅ **Cortes de Caja**: Cierres de turno por terminal y cierre diario global del negocio.
- ✅ **Módulo de Auditoría**: Historial detallado de transacciones para supervisión.
- ✅ **Arqueo Ciego**: Comparación de efectivo esperado vs contado para evitar discrepancias.
- ✅ **Soporte Maestro (Propuesta)**: Nueva API administrativa para reseteos seguros y gestión técnica remota.

### Seguridad y Privacidad

- ✅ **Row Level Security (RLS)**: Protección de datos a nivel de base de datos en Supabase.
- ✅ **Aislamiento Multi-tienda**: Arquitectura SaaS para gestionar múltiples clientes de forma aislada.
- ✅ **Repositorio Privado**: Este código es propiedad intelectual y está diseñado para despliegues privados.

---

## 🚀 Guía de Inicio Profesional

### 1. Requisitos del Sistema

- **Node.js**: v18.0.0 o superior.
- **Base de Datos**: Instancia de Supabase configurada.
- **Navegador**: Chrome/Edge (recomendado para soporte de escáner HID).

### 2. Estructura del Ecosistema

El proyecto está dividido en tres áreas clave:

- `frontend/`: Aplicación SPA construida con React 19 + Vite.
- `backend/`: Microservicio para gestión de sesiones locales y lógica offline.
- `supabase/`: Definiciones de esquemas para la nube.

---

## 🛠 Configuración Rápida (Quickstart)

1. **Clonación Segura**:

   ```bash
   git clone https://github.com/foxsolid23df-IA/POS.git
   cd POS
   ```

2. **Despliegue de Frontend**:

   ```bash
   cd frontend
   npm install
   npm run build
   ```

3. **Variables Críticas**:
   Crea un archivo `.env` en `frontend/` con tus credenciales:
   ```env
   VITE_SUPABASE_URL=tu_url_de_supabase
   VITE_SUPABASE_ANON_KEY=tu_llave_anonima
   ```

---

## 🏗 Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│              React + Vite + CSS                      │
│                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Sales  │ │Inventory│ │  Users  │ │CashCut  │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
│       │           │           │           │         │
│  ┌────┴───────────┴───────────┴───────────┴────┐   │
│  │              Services Layer                  │   │
│  │  productService | salesService | staffService│   │
│  └────────────────────┬────────────────────────┘   │
└───────────────────────┼─────────────────────────────┘
                        │ HTTPS
┌───────────────────────┼─────────────────────────────┐
│                       ▼                              │
│                  SUPABASE                            │
│  ┌─────────────────────────────────────────────┐   │
│  │              Authentication                   │   │
│  │         (Email/Password + Sessions)           │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │              PostgreSQL                       │   │
│  │  profiles | products | sales | staff | cuts   │   │
│  │           + Row Level Security (RLS)          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 🛠 Tecnologías

### Frontend

| Tecnología   | Versión | Uso          |
| ------------ | ------- | ------------ |
| React        | 19.1.1  | Framework UI |
| Vite         | 7.1.1   | Build tool   |
| React Router | 7.8.0   | Navegación   |
| SweetAlert2  | 11.26   | Alertas      |
| React Icons  | 5.5.0   | Iconografía  |

### Backend (Supabase)

| Servicio           | Uso                    |
| ------------------ | ---------------------- |
| Supabase Auth      | Autenticación          |
| Supabase Database  | PostgreSQL             |
| Row Level Security | Seguridad multi-tenant |

### Despliegue

| Plataforma     | Uso                  |
| -------------- | -------------------- |
| Vercel         | Hosting frontend     |
| Supabase Cloud | Backend as a Service |

---

## 📦 Instalación

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Cuenta de Supabase

### Pasos

1. **Clonar el repositorio**

```bash
git clone https://github.com/foxsolid23df-IA/sistema-ventas.git
cd sistema-ventas
```

2. **Instalar dependencias del frontend**

```bash
cd frontend
npm install
```

3. **Configurar variables de entorno**

```bash
cp .env.example .env
```

Editar `.env`:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima
```

4. **Iniciar en desarrollo**

```bash
npm run dev
```

---

## 🔧 Configuración de Supabase

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Copia la URL y Anon Key

### 2. Ejecutar el esquema SQL

Ve a **SQL Editor** en Supabase y ejecuta el contenido de `supabase_schema.sql`

### 3. Configurar autenticación

1. Ve a **Authentication > Settings**
2. Desactiva "Email Confirmations" para desarrollo
3. Configura redirect URLs si es necesario

---

## 📁 Estructura del Proyecto

```
Sistema ventas/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   ├── Login.css
│   │   │   │   ├── LockScreen.jsx
│   │   │   │   └── LockScreen.css
│   │   │   ├── sales/
│   │   │   │   ├── Sales.jsx
│   │   │   │   ├── Sales.css
│   │   │   │   └── TicketVenta.jsx
│   │   │   ├── inventory/
│   │   │   │   ├── Inventory.jsx
│   │   │   │   └── Inventory.css
│   │   │   ├── cashcut/
│   │   │   │   ├── CashCut.jsx
│   │   │   │   └── CashCut.css
│   │   │   ├── admin/
│   │   │   │   ├── UserManager.jsx
│   │   │   │   └── UserManager.css
│   │   │   └── sidebar/
│   │   │       ├── Sidebar.jsx
│   │   │       └── Sidebar.css
│   │   ├── services/
│   │   │   ├── productService.js
│   │   │   ├── salesService.js
│   │   │   ├── staffService.js
│   │   │   └── cashCutService.js
│   │   ├── hooks/
│   │   │   ├── useAuth.jsx
│   │   │   ├── useApi.jsx
│   │   │   ├── useCart.jsx
│   │   │   └── scanner.jsx
│   │   ├── router/
│   │   │   └── routing.jsx
│   │   ├── supabase.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
├── supabase_schema.sql
└── README.md
```

---

## 📱 Módulos del Sistema

### 1. Punto de Venta (`/`)

- Escaneo de códigos de barras
- Búsqueda de productos por nombre
- Carrito de compras
- Finalización de venta
- Impresión de ticket

### 2. Inventario (`/inventario`)

- Lista de productos
- Agregar/Editar/Eliminar productos
- Gestión de stock
- Subida de imágenes

### 3. Historial (`/historial`)

- Registro de ventas
- Filtros por fecha
- Detalle de cada venta

### 4. Estadísticas (`/estadisticas`)

- Dashboard de ventas
- Gráficos de rendimiento
- Métricas del negocio

### 5. Usuarios (`/usuarios`)

- Gestión de empleados
- Asignación de roles
- PINs de acceso

---

## 🔐 Sistema de Autenticación

### Flujo de Autenticación

```
┌──────────────────────────────────────────────────────┐
│                   PROPIETARIO                         │
│            (Email + Contraseña)                       │
│                      │                                │
│                      ▼                                │
│    ┌─────────────────────────────────┐               │
│    │        SESIÓN DE TIENDA         │               │
│    │      (Persiste en dispositivo)   │               │
│    └─────────────────────────────────┘               │
│                      │                                │
│         ┌───────────┴───────────┐                    │
│         ▼                       ▼                    │
│  ┌─────────────┐         ┌─────────────┐            │
│  │  EMPLEADO   │         │ PROPIETARIO │            │
│  │   (PIN)     │         │(Contraseña) │            │
│  └─────────────┘         └─────────────┘            │
└──────────────────────────────────────────────────────┘
```

### Roles y Permisos

| Acción            | Cajero | Gerente | Admin | Propietario |
| ----------------- | ------ | ------- | ----- | ----------- |
| Punto de Venta    | ✅     | ✅      | ✅    | ✅          |
| Ver Inventario    | ✅     | ✅      | ✅    | ✅          |
| Editar Inventario | ❌     | ✅      | ✅    | ✅          |
| Ver Historial     | ✅     | ✅      | ✅    | ✅          |
| Estadísticas      | ❌     | ✅      | ✅    | ✅          |
| Gestión Usuarios  | ❌     | ❌      | ✅    | ✅          |
| Cerrar Sesión     | ❌     | ❌      | ✅    | ✅          |

---

## 🔌 API de Servicios

### productService.js

```javascript
getProducts(); // Obtener todos los productos
createProduct(data); // Crear producto
updateProduct(id, data); // Actualizar producto
deleteProduct(id); // Eliminar producto
```

### salesService.js

```javascript
createSale(data); // Crear venta
getSales(limit); // Obtener ventas
getSalesSince(date); // Ventas desde fecha
getTodaySales(); // Ventas de hoy
```

### staffService.js

```javascript
getStaff(); // Obtener empleados
createStaff(data); // Crear empleado
updateStaff(id, data); // Actualizar empleado
deleteStaff(id); // Eliminar empleado
validatePin(pin); // Validar PIN
```

### cashCutService.js

```javascript
getCurrentShiftSummary(); // Resumen del turno
createCashCut(data); // Crear corte
getCashCuts(limit); // Historial de cortes
getLastCut(); // Último corte
```

---

## 🚀 Despliegue

### Vercel (Recomendado)

1. **Instalar Vercel CLI**

```bash
npm install -g vercel
```

2. **Desplegar**

```bash
cd frontend
vercel --prod
```

### Variables de Entorno en Vercel

Configura en el dashboard de Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 🗃 Esquema de Base de Datos

### Tablas

#### profiles

```sql
- id (uuid, PK, references auth.users)
- store_name (text)
- full_name (text)
- role (text)
- created_at (timestamp)
```

#### products

```sql
- id (bigint, PK)
- user_id (uuid, FK)
- name (text)
- barcode (text)
- price (numeric)
- stock (integer)
- image_url (text)
- created_at (timestamp)
```

#### sales

```sql
- id (bigint, PK)
- user_id (uuid, FK)
- total (numeric)
- created_at (timestamp)
```

#### sale_items

```sql
- id (bigint, PK)
- sale_id (bigint, FK)
- user_id (uuid, FK)
- product_name (text)
- quantity (integer)
- price (numeric)
- total (numeric)
```

#### staff

```sql
- id (bigint, PK)
- user_id (uuid, FK)
- name (text)
- role (text)
- pin (text)
- active (boolean)
- created_at (timestamp)
```

#### cash_cuts

```sql
- id (bigint, PK)
- user_id (uuid, FK)
- staff_name (text)
- staff_role (text)
- cut_type (text)
- start_time (timestamp)
- end_time (timestamp)
- sales_count (integer)
- sales_total (numeric)
- expected_cash (numeric)
- actual_cash (numeric)
- difference (numeric)
- notes (text)
- created_at (timestamp)
```

---

---

## 📚 Documentación Adicional

Para una comprensión profunda del sistema, consulta los siguientes manuales y guías:

### Guías Técnicas y de Despliegue
- [Guía de Despliegue en Vercel](GUIA_DESPLIEGUE_VERCEL.md)
- [Documentación de la API de Servicios](DOCUMENTACION_API.md)
- [Manual de API Administrativa 2026](MANUAL_API_ADMINISTRATIVA_2026.md)
- [Manual de Despliegue Local](MANUAL_DESPLEGUE_LOCAL.md)
- [Manual de Mantenimiento de DB](MANTENIMIENTO_DB_GUIA.md)

### Guías de Operación y Soporte
- [Manual Integral FoxSolid 2026](MANUAL_INTEGRAL_FOXSOLID_2026.md)
- [Guía de Operación Offline 2026](GUIA_OPERACION_OFFLINE_2026.md)
- [Manual de Seguridad 2026](MANUAL_SEGURIDAD_2026.md)
- [Guía para Habilitar Nuevos Clientes](Habilitar_Nuevo_Cliente.md)
- [Guía de Actualización de Clientes](GUIA_ACTUALIZACION_CLIENTES.md)

---

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

---

## 👤 Autor

**FoxSolid23df-IA**

---

## 📞 Soporte

Para soporte técnico o consultas, contactar al propietario del repositorio.

---

_Última actualización: Enero 2026_


-- Deployment Trigger v1.3.7 --

- Force Refresh Vercel -
