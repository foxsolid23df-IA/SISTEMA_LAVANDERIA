# Historial de Cambios Recientes

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
