# Changelog

## [1.4.27] - 2026-03-08

### Added

- **Automatización de Releases:** Configuración completa de GitHub Actions para generar el instalador `.exe` de forma automática al detectar una etiqueta de versión (v\*) o manualmente.
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
