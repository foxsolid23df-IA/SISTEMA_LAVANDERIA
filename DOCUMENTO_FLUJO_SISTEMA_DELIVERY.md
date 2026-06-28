# Flujo del Sistema Delivery y Portal Repartidor

## 1. Resumen Ejecutivo

El modulo de Delivery permite que una Tintoreria reciba solicitudes de recogida a domicilio, cotice la tarifa de recoleccion, confirme con la clienta que prendas entregara y como desea pagar, asigne un repartidor, controle la ruta, registre evidencias, capture pagos o abonos y conecte el proceso con el POS.

El sistema esta disenado como un modulo opcional por Tintoreria. Esto significa que puede activarse solo para Tintorerias que lo necesiten, sin afectar a Tintorerias que utilizan solamente el POS tradicional.

## 2. Objetivo del Modulo

El objetivo es profesionalizar el servicio de recogida y entrega de ropa a domicilio, dando control a tres partes:

- **Sucursal:** recibe, cotiza, asigna, supervisa y cobra.
- **Repartidor:** ve sus rutas, reporta recogidas, registra evidencia y pagos.
- **Clienta:** confirma que entregara, acepta la tarifa de delivery, elige como pagar y consulta el estatus en vivo.

## 3. Modulos Involucrados

### Portal Maestro

Permite activar o desactivar el modulo Delivery por tienda.

Funciones principales:

- Activar Delivery para tiendas piloto.
- Desactivar Delivery sin borrar historial.
- Evitar que clientes sin el modulo vean menus o rutas de Delivery.
- Mantener el POS tradicional sin cambios para clientes actuales.

### Configuracion de Usuarios

Permite crear empleados con rol de `repartidor` o `chofer`.

Datos importantes:

- Nombre del repartidor.
- PIN de acceso al portal chofer.
- Telefono del repartidor para recibir WhatsApp.
- Estado activo/inactivo.

Si un repartidor no tiene telefono, el sistema bloquea la asignacion hasta completar el dato.

### Modulo Delivery en Sucursal

Es el tablero operativo del negocio.

Desde aqui la sucursal puede:

- Ver nuevas solicitudes de recogida.
- Escuchar alerta sonora y ver aviso persistente cuando llega una nueva solicitud.
- Revisar direccion, telefono, notas y prendas indicadas por la clienta.
- Cotizar la tarifa de recogida o delivery, incluso en `$0.00`.
- Esperar confirmacion de la clienta antes de enviar chofer.
- Asignar repartidor.
- Ver pedidos en ruta.
- Consultar evidencia fotografica de recogida.
- Registrar costo del servicio de lavanderia.
- Conciliar pagos cobrados por el chofer.
- Cargar el pedido al POS para cobro o cierre.

### Link Publico de Seguimiento

La clienta recibe un enlace de seguimiento por WhatsApp.

Desde ese enlace puede:

- Ver el estatus del pedido sin iniciar sesion.
- Confirmar que prendas va a entregar.
- Ver la tarifa de recogida/delivery antes de aceptar.
- Elegir preferencia de pago:
  - pagar o abonar al entregar al chofer,
  - pagar cuando reciba la ropa lista,
  - pagar cuando pase a recoger en sucursal.
- Consultar repartidor asignado, direccion, notas, costos, abonos y saldo.

El enlace publico no muestra informacion interna como IDs de tienda, telefono del chofer, tokens, rutas de evidencia o datos administrativos.

### Portal Repartidor

Es una pantalla optimizada para celular.

El repartidor entra con PIN y solo ve sus rutas asignadas.

Puede:

- Ver lista compacta de rutas.
- Abrir detalle de cada pedido.
- Abrir mapa.
- Llamar a la clienta.
- Enviar WhatsApp a la clienta.
- Registrar pago o abono.
- Marcar ropa como recogida.
- Escribir reporte obligatorio de lo recogido.
- Agregar foto opcional como evidencia.
- Marcar entrega en sucursal.

El portal esta preparado para funcionar como PWA instalable en el celular del repartidor.

### WhatsApp y Notificaciones

El sistema usa WhatsApp como canal principal.

Notificaciones principales:

- Confirmacion de solicitud recibida.
- Aviso de tarifa de recogida/delivery.
- Aviso de repartidor asignado.
- Aviso de ropa recogida.
- Aviso de ropa entregada en sucursal.
- Comprobante de pago o abono.
- Aviso de pedido completado o cancelado.

Si el envio falla, la operacion principal no se revierte. Por ejemplo, un pedido puede quedar asignado aunque WhatsApp no haya podido confirmar el envio.

## 4. Flujo Completo del Servicio

### Paso 1: Solicitud por WhatsApp

La clienta escribe a la lavanderia o envia su ubicacion/direccion.

El webhook identifica la tienda y crea una solicitud en estado:

`requested`

La sucursal recibe una alerta visual y sonora.

### Paso 2: Revision de Sucursal

La sucursal revisa:

- nombre de la clienta,
- telefono,
- direccion,
- notas,
- prendas indicadas, si ya existen.

Antes de mandar al repartidor, la sucursal debe cotizar la tarifa de recogida/delivery.

### Paso 3: Cotizacion de Delivery

La sucursal captura la tarifa de recogida.

Ejemplos:

- `$0.00` si no se cobrara delivery.
- `$30.00` si aplica tarifa local.
- `$50.00` si aplica zona extendida.

Esta tarifa es independiente del costo del servicio de lavanderia.

La clienta recibe el enlace para revisar y confirmar.

### Paso 4: Confirmacion de la Clienta

La clienta confirma:

- que prendas entregara,
- como prefiere pagar.

El sistema no debe enviar chofer hasta tener esta confirmacion.

### Paso 5: Asignacion del Repartidor

La sucursal selecciona un repartidor activo.

El pedido cambia a:

`assigned`

El repartidor recibe WhatsApp con:

- numero de orden,
- nombre de clienta,
- telefono,
- direccion,
- notas,
- link de mapa,
- link al portal chofer.

### Paso 6: Recogida por Chofer

El repartidor llega al domicilio y valida lo recibido.

Debe capturar un texto obligatorio, por ejemplo:

`2 bolsas negras, 1 cobertor matrimonial, ropa delicada aparte`

Opcionalmente agrega una foto.

El pedido cambia a:

`picked_up`

La clienta puede ver el avance en su tracking.

### Paso 7: Entrega en Sucursal

El repartidor entrega la ropa en la lavanderia.

El pedido cambia a:

`delivered_to_store`

La sucursal revisa las prendas, pesa o clasifica el servicio y captura el costo real del servicio de lavanderia.

### Paso 8: Pago, Abonos y POS

Hay tres escenarios de pago:

1. La clienta paga o abona al chofer.
2. La clienta paga cuando recibe la ropa lista.
3. La clienta paga en sucursal cuando pasa a recoger.

Si el chofer cobra:

- el pago queda como `driver_collected`,
- la sucursal debe conciliarlo,
- al conciliarlo queda como `reconciled`,
- si el pedido ya esta vinculado al POS, el abono se refleja en el pedido de venta.

Si no hay abono inicial, no se considera error. El pedido queda con saldo pendiente hasta liquidacion final.

### Paso 9: Cierre del Pedido

El pedido se completa cuando:

- la ropa fue entregada a la clienta o recogida en sucursal,
- el saldo esta liquidado,
- o un administrador autoriza cierre con saldo pendiente.

Estado final:

`completed`

## 5. Estados del Pedido

| Estado | Significado |
| --- | --- |
| `requested` | Solicitud recibida por WhatsApp o sucursal |
| `assigned` | Repartidor asignado y en camino |
| `picked_up` | Ropa recogida en domicilio |
| `delivered_to_store` | Ropa entregada en lavanderia |
| `completed` | Pedido finalizado |
| `cancelled` | Solicitud cancelada |

## 6. Seguridad y Control

El modulo incluye controles para uso en produccion:

- Delivery se activa por tienda desde Portal Maestro.
- Tiendas sin Delivery no ven menus ni pueden operar rutas directas.
- El webhook no crea pedidos si la tienda no tiene Delivery activo.
- El portal chofer valida PIN desde backend.
- El chofer solo puede ver y operar pedidos asignados a su ID.
- Las acciones criticas pasan por backend:
  - asignar chofer,
  - marcar recogido,
  - entregar en sucursal,
  - registrar pagos,
  - conciliar pagos,
  - completar o cancelar.
- La evidencia fotografica se guarda privada.
- La sucursal abre la evidencia mediante URL firmada temporal.
- El tracking publico no expone datos internos.

## 7. Beneficios para la Lavanderia

- Menos llamadas para preguntar estatus.
- Control claro de rutas.
- Evidencia de lo recogido.
- Registro de pagos cobrados por chofer.
- Mayor confianza para la clienta.
- Separacion entre tarifa de delivery y costo del servicio.
- Activacion gradual por tienda sin afectar clientes existentes.
- Mejor trazabilidad para resolver aclaraciones.

## 8. Requisitos para Operar

Para activar el modulo en una tienda se requiere:

- Activar Delivery desde Portal Maestro.
- Tener configurado WhatsApp/Evolution o gateway correspondiente.
- Crear al menos un empleado con rol `repartidor` o `chofer`.
- Registrar telefono del repartidor.
- Definir el proceso interno para conciliacion de efectivo.
- Capacitar a sucursal para cotizar delivery antes de asignar.
- Capacitar al chofer para registrar reporte de recogida.

## 9. Recomendacion de Implementacion con Cliente

Se recomienda iniciar con una tienda piloto.

Fase 1:

- Activar Delivery solo para la tienda piloto.
- Probar solicitudes reales controladas.
- Validar mensajes WhatsApp.
- Validar portal chofer en celular.
- Validar pagos y conciliacion.

Fase 2:

- Ajustar textos, tarifas y operacion diaria.
- Capacitar operadores.
- Definir responsables de conciliacion.

Fase 3:

- Activar en otras sucursales o clientes que requieran delivery.

## 10. Alcance Actual

El sistema actualmente cubre:

- Solicitud por WhatsApp.
- Cotizacion de delivery.
- Confirmacion de clienta.
- Preferencia de pago.
- Asignacion de repartidor.
- Portal chofer movil.
- Evidencia opcional.
- Pagos y abonos del chofer.
- Conciliacion en sucursal.
- Tracking publico.
- Activacion por tienda.

No se incluye todavia:

- Optimizacion automatica de rutas.
- Geolocalizacion en tiempo real del chofer.
- Firma digital de entrega.
- Cobro en linea con pasarela bancaria.
- Impresion automatica de comprobante fisico desde el portal chofer.

Estos puntos pueden agregarse en fases posteriores.
