# Manual: Panel Admin para avisos remotos

Version requerida: 1.4.51 o superior.

Este panel permite crear, editar, activar, apagar y eliminar avisos remotos desde Supabase sin publicar una nueva version para cada mensaje. Los avisos pueden mostrarse al abrir caja, cerrar caja, o en ambos eventos.

## Requisitos

- Tener instalada la version 1.4.51 o superior en el equipo administrador.
- Tener aplicada la migracion de Supabase que crea la tabla `remote_notices`.
- Usar una cuenta registrada como super admin en la tabla `super_admins`.
- Contar con el PIN Maestro de Operaciones.
- Tener internet para leer y guardar cambios en Supabase.

## Como entrar al panel admin

1. Abre el sistema.
2. Entra a `/#/portal-maestro`.
3. Ingresa el `Correo Administrativo` y la `Contrasena Maestra`.
4. Al iniciar sesion, el sistema entra al `Portal Corporativo`.
5. Abre `/#/super-admin/licencias` si no se redirige automaticamente.
6. En la pantalla `Desbloqueo de Seguridad`, ingresa el `PIN Maestro de Operaciones`.
7. En el gestor, selecciona la pestana `Avisos`.

## Como crear un aviso

1. Entra a la pestana `Avisos`.
2. Captura el titulo y mensaje.
3. Marca los eventos donde debe aparecer:
   - `Abrir caja`
   - `Cerrar caja`
4. Configura las fechas de vigencia si aplica.
5. Activa o desactiva el estado del aviso.
6. Captura el texto del boton, por ejemplo `Contactar por WhatsApp`.
7. Captura la URL del boton, por ejemplo `https://wa.me/5215650607108`.
8. Selecciona los clientes destino.
9. Presiona `Crear aviso`.

## Como elegir a quien mandarlo

- Usa el buscador de clientes para ubicar una tienda.
- Marca solo los clientes que deben recibir el aviso.
- Usa `Todos visibles` para seleccionar todos los clientes filtrados.
- Usa `Limpiar` para quitar la seleccion.

Cada cliente seleccionado recibe su propio aviso remoto. Los clientes no seleccionados no lo leeran ni lo veran.

## Como cambiar el texto

1. Busca el aviso en la lista.
2. Presiona `Editar`.
3. Cambia titulo, mensaje, eventos, fechas, boton o URL.
4. Guarda los cambios.

Los cambios aplican desde Supabase. No se necesita generar otra version para modificar un aviso existente.

## Como apagar un aviso

1. Busca el aviso.
2. Presiona el control de estado para apagarlo.

Un aviso apagado no se muestra aunque el cliente y el evento coincidan.

## Como eliminar un aviso

1. Busca el aviso.
2. Presiona `Eliminar`.
3. Confirma la accion.

Usa eliminar solo cuando ya no se requiere conservar el aviso. Para pausarlo temporalmente, es mejor apagarlo.

## Validacion rapida

- Aviso activo y vigente: aparece al evento configurado.
- Aviso vencido o fuera de fecha: no aparece.
- Aviso inactivo: no aparece.
- Cliente no seleccionado: no puede leer el aviso.
- Si Supabase falla o no hay internet, abrir y cerrar caja deben continuar funcionando.

