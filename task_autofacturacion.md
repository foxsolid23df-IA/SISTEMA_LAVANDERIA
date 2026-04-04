# Plan de Implementación: Auto-Facturación Lavandería

## 1. Base de Datos (Supabase)
- [ ] Crear tabla `public.clients` para almacenar datos fiscales de clientes frecuentes.
- [ ] Crear tabla `public.invoices` para seguimiento de CFDI timbrados.
- [ ] Modificar tabla `public.sales` para añadir:
    - `ticket_uuid` (UUID) para evitar duplicidad.
    - `pin_facturacion` (TEXT) de 4 dígitos.
    - `facturado` (BOOLEAN) inicializado en `false`.
- [ ] Implementar trigger `trigger_generate_billing_pin` en `public.sales` para autogenerar el PIN.

## 2. Backend (Edge Functions)
- [ ] Migrar función `timbrar`: Adaptar lógica de Facturama para usar los productos de la lavandería.
- [ ] Migrar función `enviar-factura-email`: Configurar envío de comprobantes.
- [ ] Migrar función `cancelar-cfdi`: Gestión de errores y cancelaciones.

## 3. Frontend (Sistema Lavandería)
- [ ] Modificar `services/salesService.js` para asegurar que el `ticket_uuid` se envíe si no es generado por DB.
- [ ] Actualizar `components/sales/TicketVenta.jsx` para mostrar el Folio, PIN y URL de facturación en el pie de página.
- [ ] Verificar la impresión térmica y el formato de WhatsApp.

## 4. Portal de Facturación
- [ ] Copiar `C:\POS\portal-facturacion` al directorio de trabajo actual (o configurar repo independiente).
- [ ] Actualizar variables de entorno (URL de Lavandería, Supabase Key Pública).
- [ ] Realizar pruebas de validación de folio/pin/total.
- [ ] Desplegar en Vercel (`lavanderia-facturacion.vercel.app`).
