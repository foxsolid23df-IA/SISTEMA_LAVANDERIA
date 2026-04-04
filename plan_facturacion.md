# Plan de Implementación: Auto-Facturación con Folio y PIN

Este documento detalla la arquitectura y el flujo exacto utilizado en el sistema POS actual para el proceso de auto-facturación a través de un portal web. Este mismo plan debe replicarse paso a paso en el proyecto de **SISTEMA_LAVANDERIA**.

## 1. Modificaciones en la Base de Datos (Supabase)

Para poder validar los tickets, la tabla principal transaccional (ej. `sales` en POS, posiblemente `orders` o `tickets` en la lavandería) debe contener los siguientes campos clave:

- **`pin_facturacion`** (`text`): Un código alfanumérico corto (ej. 4 a 6 caracteres como `F7D1`) generado aleatoriamente en el momento en que se concreta la venta.
- **`facturado`** (`boolean`): Un switch que arranca en `false`. Si la venta ya fue procesada ante el SAT, cambia a `true`.
- **`ticket_uuid`** (`uuid` o `text`): Un identificador global único que se usará internamente para el timbrado con el PAC (Proveedor Autorizado de Certificación, ej. Facturama) asegurando que este identificador sea el *Reference ID* en su API para evitar dobles facturaciones.
- **`total`** (`numeric` o `float`): El monto cobrado exacto.

Se requiere además una tabla **`invoices`** (facturas) que guarde una relación con la tabla de ventas para almacenar el estatus tras el timbrado:
- `id` (Identificador del invoice de Facturama o ID propio)
- `sale_id` o `order_id` (UUID foráneo que liga al ticket)
- `uuid_cfdi` (El folio fiscal del SAT)
- `xml_url` y `pdf_url` (Los enlaces para descarga)
- `status` (Ej. VIGENTE o CANCELADO)

---

## 2. Lógica del Sistema Principal (Emisión del Ticket)

El sistema de lavandería, al procesar y concluir una nueva orden, debe realizar esta secuencia:

1. **Generación del PIN**: En el código o mediante un trigger de base de datos, crear el `pin_facturacion`. 
2. **Impresión del Recibo**: El formato del ticket físico (impresora térmica) y/o el comprobante de WhatsApp debe incorporar en el pie de página el bloque de facturación:

```text
*** FACTURACIÓN EN LÍNEA ***
Para obtener su factura, ingrese a:
http://misitio.facturacion.com
Tiene el mes en curso para facturar.

Folio: [ID de la Orden / Folio Corto]
PIN de Seguridad: [pin_facturacion]
Total: $[total]
```

---

## 3. Lógica del Portal de Auto-Facturación (Frontend de Lavandería)

El portal web de cara al cliente requiere 3 validaciones simultáneas de seguridad para evitar peticiones maliciosas, enumeración de facturas de otros clientes, o facturaciones fantasma.

### A. Búsqueda y Validación
Al inicio (Paso 1), se solicita:
1. Folio del Ticket
2. PIN de Seguridad
3. Total Exacto de la Compra

En el frontend (o a través de una función segura) se evalúa:
```javascript
// Validación 1: El Folio y el PIN deben converger.
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .eq('id', inputFolio) // El Folio
  .eq('pin_facturacion', inputPin.toUpperCase()) // El PIN, ignorando minúsculas
  .single();
```

Luego se realiza la **Validación del Monto (Total)**:
Debido a fluctuaciones en el guardado de los flotantes en bases relacionales, se recomienda un margen de diferencia (`tolerancia`) de `0.01` centavos:
```javascript
if (Math.abs(dbTotal - inputTotal) > 0.01) {
  throw new Error('El monto ingresado no coincide con el registrado en el ticket.');
}
```

### B. Flujo de Estados
Una vez validado el ticket, el flujo se divide:

- **Si el ticket YA está facturado** (`data.facturado === true`):
  El sistema consulta la tabla `invoices`, recupera los enlaces del PDF y el XML, y lleva al cliente de modo directo a la **Pantalla de Éxito**, donde sólamente visualizará los botones de *Descargar PDF*, *Descargar XML* o *Reenviar por Correo*.

- **Si el ticket NO está facturado** (`data.facturado === false`):
  El sistema le mostrará el ticket detectado por un segundo, y avanzará a la captura de sus Datos Fiscales (RFC, Razón Social, C.P. y Regimen / Uso de CFDI).

---

## 4. Ejecución del Timbrado (Backend / Edge Functions)

Para que la lavandería trabaje mediante el mismo esquema seguro por tokenizaciones, las peticiones hacia el PAC no deben hacerse nunca desde el cliente frontend de facturación.

1. **Edge Function "timbrar"**: El portal enviará los campos fiscales junto con el ID de la Venta (o `ticket_uuid`). La función:
   - Extraerá los conceptos y artículos directo de la base de datos de producción (SISTEMA_LAVANDERIA).
   - Ensamblará el JSON para Facturama.
   - Timbrará la petición.
   - Insertará los recibos en la tabla `invoices`.
   - Modificará la venta actualizando `facturado = true`.
   - Devolverá los links para su descarga.

2. **Funcionalidad Auxiliar**:
   - Una endpoint `enviar-factura-email` para despachar el correo con la confirmación.
   - Una endpoint `cancelar-cfdi` (La cual evalúa desde Supabase si la emisión ocurrió en las últimas 24 hrs. En POS, existe un botón expuesto en la página final que permite autocancelar la factura asumiendo que esté dentro del tiempo límite, lo que cambia el estado a 'Cancelado').
