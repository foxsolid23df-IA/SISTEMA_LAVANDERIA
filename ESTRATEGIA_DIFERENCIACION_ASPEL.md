# Estrategia de Diferenciacion Frente a Aspel

## Resumen ejecutivo

El sistema no debe venderse como "otro POS". Aspel compite fuerte cuando la
conversacion se reduce a punto de venta, precio mensual y facturacion incluida.
La ventaja competitiva de este proyecto esta en posicionarlo como una
plataforma vertical para lavanderias y tintorerias: operacion, control,
delivery, seguimiento, caja, evidencia, facturacion y retencion de clientes.

Mensaje guia:

> Aspel te ayuda a vender; nosotros te ayudamos a operar, entregar y retener
> clientes de lavanderia.

## Paquetes comerciales

### 1. Core Lavanderia

Para negocios que quieren control operativo sin iniciar todavia con delivery.

Incluye:

- POS multicaja.
- Ordenes de lavanderia y tintoreria.
- Clientes e historial operativo.
- Caja, cortes, arqueo ciego, retiros y cancelaciones autorizadas.
- Inventario, kardex, insumos y reportes.
- Bascula y tickets profesionales.
- Portal de autofacturacion por folio, PIN y total.
- Operacion de escritorio con Electron y soporte offline/sincronizacion.

Argumento de venta:

"No es solo cobrar; es controlar cada prenda, cada anticipo, cada saldo y cada
cierre de caja."

### 2. Growth Delivery

Para lavanderias que quieren captar pedidos y crecer servicio a domicilio.

Incluye todo Core Lavanderia mas:

- Solicitudes de recoleccion por WhatsApp.
- Cotizacion de delivery antes de enviar chofer.
- Confirmacion del cliente desde link publico.
- Tracking publico del pedido.
- Portal de chofer con PIN.
- Rutas asignadas, llamada, WhatsApp y mapa.
- Evidencia fotografica de recoleccion.
- Registro de pagos o abonos cobrados por repartidor.
- Conciliacion de efectivo del repartidor en sucursal.
- Carga del pedido al POS para cobro final.

Argumento de venta:

"Convierte WhatsApp en un canal ordenado de pedidos, no en una libreta caotica
de mensajes."

### 3. Multi-Sucursal

Para cadenas, negocios en expansion o modelos de franquicia.

Incluye todo Growth Delivery mas:

- Panel maestro.
- Activacion de modulos por tienda.
- Licencias y control de clientes activos.
- Reportes por sucursal.
- Control central del negocio.
- Aislamiento multi-tienda con Row Level Security.
- Preparacion para operacion en red y franquicias.

Argumento de venta:

"El dueno puede ver la operacion completa sin depender de reportes manuales de
cada sucursal."

## Como explicar la facturacion

La objecion principal contra Aspel aparece cuando el prospecto percibe doble
cobro: sistema por un lado y facturacion por otro. La respuesta comercial debe
separar tres conceptos:

- **Sistema:** operacion, POS, caja, ordenes, delivery, reportes y control.
- **Implementacion fiscal:** configuracion inicial de emisor, CSD, portal,
  pruebas y capacitacion.
- **Proveedor fiscal/PAC:** timbres, servicio externo o costo fiscal que no
  depende directamente del sistema.

Recomendacion de empaque:

- Incluir la configuracion inicial de facturacion dentro del onboarding.
- Mostrar por separado cualquier costo del PAC o proveedor de timbrado.
- Ofrecer un plan con "facturacion incluida hasta X volumen mensual" si el
  margen comercial lo permite.
- Evitar presentar la facturacion como modulo aislado de alto costo; venderla
  como parte del flujo completo de ticket, portal y CFDI.

## Respuesta comercial sugerida

Entiendo perfecto la comparacion con Aspel si se analiza solo como punto de
venta con facturacion. Ahi Aspel es una alternativa economica. Nuestra propuesta
va por otro lado: esta pensada para lavanderias que quieren controlar todo el
ciclo, desde que el cliente pide recoleccion por WhatsApp hasta que el chofer
recoge, sube evidencia, se concilia el pago, se carga al POS y el cliente puede
facturar.

Si hoy tu prioridad es solo vender y facturar barato, Aspel puede resolverlo. Si
tu prioridad es crecer servicio a domicilio, reducir perdidas de prendas,
controlar caja y retener clientes, ahi es donde nuestro sistema se diferencia.

## Comparacion corta para ventas

| Tema | POS generico / Aspel | Plataforma vertical lavanderia |
| --- | --- | --- |
| Venta en mostrador | Si | Si |
| Facturacion | Si | Si, con portal de autofacturacion |
| Ordenes de lavanderia | Limitado o configurable | Flujo especializado |
| Delivery por WhatsApp | No es el centro del producto | Canal operativo completo |
| Tracking para cliente | No es diferenciador central | Link publico por pedido |
| Portal de repartidor | No es el centro del producto | PIN, rutas, evidencia y pagos |
| Evidencia de recoleccion | No es el centro del producto | Foto y reporte operativo |
| Caja y conciliacion | Caja POS | Caja + abonos + repartidor |
| Multi-sucursal/franquicia | Depende del paquete | Enfoque SaaS multi-tienda |
| Propuesta principal | Cobrar y facturar | Operar, entregar y retener |

## Roadmap para captar mas clientes

### Alta prioridad

- CRM simple de lavanderia: historial por cliente, frecuencia, gasto promedio,
  prendas comunes y recordatorios.
- Campanas por WhatsApp: ropa lista, cliente inactivo, promo martes, servicio
  express y recoge hoy.
- Programa de lealtad: puntos, visitas acumuladas, cupones y saldo promocional.

### Media prioridad

- Tablero de clientes en riesgo: clientes que no regresan en 30, 60 o 90 dias.
- Cotizador rapido por WhatsApp/link: el cliente pide recoleccion y recibe
  precio estimado.
- Reporte "que debe estar colgado hoy": prendas listas, atrasadas y pendientes
  de entrega.

### Diferenciador comercial inmediato

- Demo de 10 minutos con flujo completo:
  WhatsApp -> pedido -> cotizacion -> chofer -> evidencia -> POS -> factura.

## Demo comercial de 10 minutos

1. Abrir el tablero de delivery.
2. Simular una solicitud de cliente por WhatsApp.
3. Cotizar la recoleccion y mostrar el link publico.
4. Confirmar prendas y preferencia de pago como cliente.
5. Asignar chofer y entrar al portal de repartidor.
6. Registrar evidencia y abono.
7. Entregar en sucursal y conciliar pago.
8. Cargar al POS.
9. Mostrar ticket con folio/PIN.
10. Abrir el portal de autofacturacion y validar el ticket.

Objetivo de la demo:

- En menos de 5 minutos el prospecto debe entender tres beneficios: mas pedidos,
  menos descontrol y mejor seguimiento.
- En 10 minutos debe quedar claro que la comparacion correcta no es "POS vs
  POS", sino "POS generico vs operacion completa de lavanderia".

## Oferta piloto recomendada

Propuesta:

- Piloto de 30 dias.
- Setup incluido.
- Una sucursal o tienda piloto.
- Activacion de Core Lavanderia y Growth Delivery si el cliente ofrece
  recoleccion.
- Capacitacion corta al administrador y operadores.

Indicadores de exito:

- Pedidos recibidos por WhatsApp.
- Tiempo de cierre de caja.
- Ordenes con evidencia registrada.
- Pedidos con tracking compartido al cliente.
- Disminucion de llamadas o mensajes preguntando por estatus.

## Argumentos contra objeciones

### "Aspel es mas barato"

Correcto si solo comparas POS y facturacion. Nuestra propuesta incluye control
especializado de lavanderia, delivery, tracking, chofer, evidencia, pagos y caja
operativa.

### "No quiero pagar doble por facturacion"

La configuracion fiscal debe ir incluida en el onboarding. El unico costo
externo que puede existir es el del PAC o proveedor fiscal, y se presenta de
forma transparente.

### "Solo necesito vender"

Entonces un POS generico puede ser suficiente. Este sistema conviene cuando el
problema real es controlar prendas, tiempos, anticipos, saldos, repartidores y
clientes recurrentes.

### "No tengo delivery todavia"

Se puede iniciar con Core Lavanderia y activar Growth Delivery cuando el negocio
quiera crecer recoleccion a domicilio.

## Funciones existentes para destacar

- Delivery por WhatsApp con tracking.
- Portal de chofer con PIN.
- Evidencia de recoleccion.
- Conciliacion de efectivo del repartidor.
- Autofacturacion por folio, PIN y total.
- Ventas offline con sincronizacion pendiente.
- Bascula.
- Kardex.
- Cortes de caja.
- Cancelaciones autorizadas.
- Reportes.
- Panel maestro y activacion de modulos por tienda.

## Referencias internas

- `README.md`
- `INFORME_TECNICO_PERICIAL_SISTEMA_LAVANDERIA.md`
- `SISTEMA_DELIVERY_GUIA.md`
- `DOCUMENTO_FLUJO_SISTEMA_DELIVERY.md`
- `MANUAL_DESPLIEGUE_PRUEBAS_DELIVERY.md`
- `plan_facturacion.md`
- `PROPUESTA_SISTEMA_RED_Y_FRANQUICIAS_LEVI.md`
