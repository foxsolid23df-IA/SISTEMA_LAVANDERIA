-- ==========================================
-- SCRIPT: ADD TAX AND BILLING FIELDS
-- ==========================================
-- Descripción: Agrega los campos de configuración de impuestos a la tabla 
-- business_settings y los flags de facturación a sales y orders.

DO $$
BEGIN
    -- 1. Agregar configuración de impuestos a business_settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'tax_percentage') THEN
        ALTER TABLE public.business_settings ADD COLUMN tax_percentage NUMERIC DEFAULT 16.0;
    END IF;

    -- 2. Agregar campos a sales
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'has_tax') THEN
        ALTER TABLE public.sales ADD COLUMN has_tax BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'tax_amount') THEN
        ALTER TABLE public.sales ADD COLUMN tax_amount NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'invoice_requested') THEN
        ALTER TABLE public.sales ADD COLUMN invoice_requested BOOLEAN DEFAULT false;
    END IF;

    -- 3. Agregar campos a orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'has_tax') THEN
        ALTER TABLE public.orders ADD COLUMN has_tax BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tax_amount') THEN
        ALTER TABLE public.orders ADD COLUMN tax_amount NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'invoice_requested') THEN
        ALTER TABLE public.orders ADD COLUMN invoice_requested BOOLEAN DEFAULT false;
    END IF;
END $$;
