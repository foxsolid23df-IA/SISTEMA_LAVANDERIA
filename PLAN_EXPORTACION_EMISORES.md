# Plan de Exportación: Módulo de Emisores Fiscales

## 1. Objetivo General
Exportar e integrar la funcionalidad completa de **Emisores Fiscales** y **Branding del Portal de Facturación** desde el actual sistema POS hacia el proyecto **SISTEMA_LAVANDERIA**, asegurando que opere como una copia perfecta y completamente funcional dentro del submódulo de Configuración.

---

## 2. Base de Datos (Supabase)

Para que el modelo de datos sea idéntico, es necesario migrar la estructura y dependencias de la BDD.

### 2.1 Tablas y Esquemas
Se deben copiar los scripts de SQL de creación (Schema) desde el servidor POS para habilitar:
- **`billing_issuers`**: Tabla maestra que contiene todo el detalle de los emisores (RFC, Razón Social, Régimen Fiscal, Código Postal, Nombre de Sucursal) y que sirve para atar timbrados a una razón social.
- **`billing_portals`**: Tabla donde se guarda la asociación de apariencia (p.ej., `logo_url` y configuración visual) de un emisor para su portal de cara al cliente.

### 2.2 Políticas RLS (Row Level Security)
Replicar exactamente las políticas de permisos para lectura (`SELECT`), inserción (`INSERT`), actualización (`UPDATE`) y borrado (`DELETE`). Solo administradores / dueños deben poder registrar y borrar emisores fiscales.

### 2.3 Storage / Buckets
Asegurar que exista en el nuevo Supabase un Bucket designado a logos o archivos de portal (ej. `logos`, `portals`), con reglas para carga pública. No almacenar *nunca* archivos `.cer` o `.key` aquí (esos solo se mandan al vuelo).

---

## 3. Lógica Backend (Facturama + Supabase Edge Functions)

El proceso crítico de validación e inscripción de Certificados de Sellos Digitales se hace vía Edge Functions para no sobrexponer claves secretas.

### 3.1 Edge Function: `upload-csd`
1. Replicar todo el código de la función ubicada típicamente en `supabase/functions/upload-csd/`.
2. Incluir el manejo de peticiones de red y respuestas detalladas (con lectura estricta de variables de Facturama).
3. **Variables de Secreto:** En el panel de Supabase Dashboard del `SISTEMA_LAVANDERIA`, se deben configurar los _Secrets_ idénticos requierdos para consumir el Endpoint de API de Facturama o el Relay que se use.

---

## 4. Frontend: Migración de Componentes de UI

Copiar exactamente el mismo frontend garantizando la integridad visual, UX y *Glassmorphism*.

### 4.1 Componentes a Transferir
Localizados actualmente en `frontend/src/components/config/` (o estructura similar):
1. **`BillingIssuers.jsx`**
   - Importar manejo de base64 para cargar los archivos `.cer` y `.key`.
   - Llama a `supabase.functions.invoke('upload-csd', { ... })`.
   - Gestión de layout visual de listas, tabla y modal de carga.
2. **`BillingPortalModal.jsx`**
   - Modal secundario integrado para modificar detalles de visualización/Branding del emisor. 

### 4.2 Integración en `ConfiguracionHub`
Ubicarse en la pestaña unificada (por ejemplo `ConfiguracionHub.jsx`) en `SISTEMA_LAVANDERIA`:
- Ajustar el enrutador / pestañas estáticas para agrupar esta vista de "Emisores Fiscales".
- Importar temporalmente `<BillingIssuers />` y asignarle un identificador/tabulable en la barra lateral del menú de ajustes (por ejemplo, con un icono de `account_balance`).

---

## 5. Implementación y Fase de Pruebas

Para coronar el despliegue con cero regresiones, sigan este flujo de testeo validado en POS:

1. **Test del Payload Base64**: Intentar el alta de Emisor usando los CSD (Certificados y Llaves de Privada) de pruebas provistos por el SAT.
2. **Verificar Respuesta de Edge Function**: Asegurarse que el JSON arroje `success` en la conexión a Facturama y un registro real en `billing_issuers`.
3. **Verificación Visual Rápida**: Eliminar un Emisor recién creado. Reafirmar que la experiencia de React se actualiza localmente sin trabas.
4. **Branding de portales limitados**: Relacionar al emisor con las imágenes correctas en Storage mediante Subalida en el sub-modal de Branding (`BillingPortalModal`).

**✅ Listo**: Si completa los pasos anteriores, la pantalla será _pixel perfect_ y clonada en funcionalidad respecto a su contraparte POS originaria.
