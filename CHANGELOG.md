# Changelog

## [Comercial] - 2026-06-16

### Added

- **Estrategia de diferenciacion frente a Aspel:** Se agrego un documento comercial con posicionamiento vertical para lavanderias, paquetes sugeridos, respuesta a objeciones, roadmap de captacion y guion de demo.

## [1.4.43] - 2026-04-05

### Fixed

- **Aislamiento Visual de Caja:** Optimización del diseño en módulos de Corte de Caja y Retiros, incrementando el desenfoque de fondo y opacidad para una experiencia más profesional e independiente ("apartado solo para ella").

## [1.4.42] - 2026-04-05

### Added

- **Fondo Inicial en Cortes de Caja:** Se implementó la persistencia del `opening_fund` (fondo inicial) en la tabla de cortes de caja (`cash_cuts`), permitiendo una auditoría completa del flujo de efectivo (Fondo Inicial + Ventas - Gastos = Esperado).
- **Enriquecimiento Histórico:** Se ejecutó un proceso de migración de datos para recuperar los fondos iniciales de los cortes históricos vinculándolos con sus respectivas sesiones de caja.

### Fixed

- **Fallback de Fondos:** Se agregó un mecanismo inteligente en el servicio de cortes para obtener dinámicamente el fondo inicial desde la sesión de caja si el registro del corte no lo contiene, asegurando reportes precisos incluso en casos de borde.

## [1.4.36] - 2026-04-02

### Added

- **Impresión Automática de Corte de Insumos:** Se implementó la generación y apertura automática del ticket de impresión tras confirmar un ajuste de auditoría o balance de período en el inventario de insumos, optimizando el flujo de trabajo del operador.

## [1.4.32] - 2026-03-12

### Fixed

- **Inventario Interno:** Se simplificó la confirmación al borrar un insumo. Ahora solo requiere hacer clic en el botón de confirmación en lugar de escribir el nombre exacto del producto, mejorando la experiencia de uso.

 
### Added
 
- **Permiso de Solo Lectura para Insumos (`can_view_supplies`):** Implementación de un nuevo permiso granular que permite a los usuarios visualizar el stock y usar la libreta digital sin permisos de edición o eliminación.
- **Filtrado Dinámico de Interfaz:** El módulo de insumos ahora oculta automáticamente las pestañas administrativas (Entradas, Catálogo, Corte Semanal, Movimientos) para usuarios con acceso de solo lectura.
- **Seguridad Granular:** Mejoras en el guard de rutas y componentes para asegurar que el principio de menor privilegio se aplique al control de inventario interno.

## [1.4.30] - 2026-03-12

### Added

- **Indicador de Unidad en Libreta:** Visualización dinámica de la unidad de medida (kg, L, piezas, etc.) junto al campo de cantidad gastada en la Libreta Digital para evitar errores de captura.

- **Preparación para Auto-Update:** Sincronización de versiones en `package.json` para asegurar que las actualizaciones automáticas funcionen correctamente.

## [1.4.20] - 2026-02-28

### Added

- **Insumos Internos (Control Pro):** Implementación de funciones avanzadas de edición y borrado en el Resumen de Existencias.
- **Edición Flex:** Capacidad para ajustar manualmente el Stock Actual, Nombre, Unidad y Stock Mínimo (reservado para Gerente y Admin).
- **Seguridad y Validación:** Sistema de doble confirmación por texto para eliminación de insumos, evitando acciones accidentales.
- **Borrado Suave:** Integración de borrado lógico (is_active) para mantener la integridad referencial en reportes históricos.
- **Multi-Entorno:** Optimización garantizada para ejecución estable tanto en versión Web como instalador `.exe`.

## [1.4.16] - 2026-02-17

### Fixed

- **Ticket de Venta:** Corrección en la alineación del encabezado y estilos inline para asegurar que la impresión sea centrada y legible.
- **Báscula USB:** Implementación de soporte para básculas que envían datos en formato binario/HID.
- **Robustez de Conexión:** Corrección del error "The device has been lost" que impedía reconectar la báscula sin reiniciar la aplicación.
- **Limpieza de Estado:** El servicio de báscula ahora limpia correctamente los recursos al detectar una desconexión física.

## [1.4.5] - 2026-02-07

### Added

- **Auto-Conexión de Báscula:** El sistema ahora detecta y conecta automáticamente la última báscula utilizada al iniciar la aplicación.
- **Gestión de Errores Serial:** Mensajes amigables en español cuando falla la conexión con la báscula o se cancela el permiso.
- **Mejora de Impresión:** Corrección en el cálculo del cambio en el ticket de venta cuando el anticipo es cero.
- **Robustez de Hook:** Solución definitiva al error de inicialización (`ReferenceError`) que causaba pantallas negras.

## [1.3.9] - 2026-02-03

### Added

- **IA Vision Integral:** Sistema completo de inspección visual de prendas.
- **Flujo Híbrido:** Soporte robusto para Webcam de PC y Captura Móvil (QR) en la misma sesión.
- **Vinculación a Órdenes:** Botón para trasladar el reporte técnico de la IA (Daños, Riesgo, Plan de Lavado) directamente a las notas de la venta.
- **Ticket Legal:** Impresión automática de cláusula de "Aceptación de Riesgos" en el ticket cuando la IA detecta prendas delicadas o dañadas.
- **UX Mejorada:** Interfaz de alto contraste para selección de modo de captura y corrección de errores de visualización.

## [1.3.8] - 2026-02-03

### 🚀 IA y Captura Móvil

- **IA Vision Pro**: Actualizado a **Llama 4 Scout**, el modelo más rápido y potente de Groq.
- **Backend Robusto**: Sincronización absoluta de archivos `.env`, permitiendo que la IA funcione correctamente dentro del archivo `.exe` instalado.
- **Captura Móvil Segura**: El código QR ahora utiliza túneles HTTPS vía Vercel, habilitando el permiso de cámara en dispositivos móviles de forma estable.
- **Diagnóstico Mejorado**: Mensajes de error detallados en pantalla si la API de IA presenta problemas.

Este documento resume las mejoras y correcciones implementadas recientemente en el sistema PosMulticajas.

## Módulo de Proveedores

- **Optimización de Interfaz**: Se ajustó el layout para ser completamente funcional a un zoom del 100%.
- **Scroll Interno**: Se implementó scroll independiente para la tabla de datos, manteniendo visibles los KPIs y filtros.
- **Estética**: Reducción de `line-height` global para mejorar la densidad de información.

## Módulo de Auditoría (Historial)

- **Carga de Datos**: Se refactorizó la carga de transacciones usando `Promise.all` para mayor velocidad.
- **Manejo de Estados**: Se corrigió el problema de carga infinita agregando timeouts y mejor manejo de errores.

## Módulo de Ventas (POS)

- **Persistencia de Productos**: Se solucionó el error donde los productos desaparecían al navegar entre módulos.
- **Sincronización**: Mejora en la reactividad al regresar al módulo de ventas desde otros apartados.
- **Cálculo de Cambio**: Mejora en la visualización del cambio en pagos con efectivo y dólares.

## Pantalla del Cliente (Customer Display)

- **Sincronización en Tiempo Real**: Se corrigió la actualización automática del carrito.
- **Estado Inicial**: Se eliminó el "producto fantasma" que aparecía al iniciar la pantalla por primera vez.

## Gestión de Cajas y Turnos

- **Multicajas Cloud**: Implementación de `terminal_id` para permitir múltiples cajas funcionando de forma independiente en la nube.
- **Cierre de Caja**: Rediseño visual de las ventanas de "Corte de Turno" y "Corte del Día".
- **Resumen de Turno**: Corrección de errores al cargar el resumen de ventas por terminal.

## Inventario

- **Carga Masiva**: Implementación de importación de productos mediante plantillas de Excel.
- **Nuevos Campos**: Se añadieron campos de `precio_costo`, `precio_mayoreo` y `stock_minimo`.
