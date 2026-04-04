-- ==============================================================================
-- Esquema de Facturación para SISTEMA_LAVANDERIA
-- ==============================================================================

-- 1. Crear tabla de clientes fiscales (SaaS Ready)
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(), -- Multi-tenant
    rfc text NOT NULL,
    razon_social text NOT NULL,
    regimen_fiscal text NOT NULL, 
    codigo_postal text NOT NULL,
    email text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, rfc) -- RFC único POR tienda
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own clients" ON public.clients FOR ALL USING (auth.uid() = user_id);

-- 2. Detección automática y creación de tabla Invoices
DO $$ 
DECLARE
    sales_id_type text;
BEGIN
    SELECT data_type INTO sales_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'id' AND table_schema = 'public';

    IF sales_id_type IS NULL THEN
        RAISE EXCEPTION 'La tabla sales no existe en este proyecto.';
    END IF;

    -- Tabla de Invoices (Facturas Timbradas)
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.invoices (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
        sale_id %s REFERENCES public.sales(id),
        client_id uuid REFERENCES public.clients(id),
        facturama_id text,
        folio text,
        serie text,
        uuid_fiscal text,
        xml_url text,
        pdf_url text,
        status text DEFAULT ''VIGENTE'', -- VIGENTE | CANCELADO
        total numeric,
        created_at timestamptz DEFAULT now()
    )', sales_id_type);
END $$;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id);

-- 3. Inyectar columnas de facturación a la tabla de VENTAS (Sales)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='ticket_uuid') THEN
        ALTER TABLE public.sales ADD COLUMN ticket_uuid uuid DEFAULT gen_random_uuid();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='pin_facturacion') THEN
        ALTER TABLE public.sales ADD COLUMN pin_facturacion text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='facturado') THEN
        ALTER TABLE public.sales ADD COLUMN facturado boolean DEFAULT false;
    END IF;
END $$;

-- 4. Función y Trigger para el PIN Aleatorio (4 dígitos)
CREATE OR REPLACE FUNCTION generate_billing_pin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pin_facturacion IS NULL THEN
        -- Generar un PIN de 4 dígitos (ej: 4821)
        NEW.pin_facturacion := LPAD(floor(random() * 10000)::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_billing_pin ON public.sales;
CREATE TRIGGER trigger_generate_billing_pin
BEFORE INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION generate_billing_pin();
