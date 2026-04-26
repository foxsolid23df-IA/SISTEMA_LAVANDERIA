-- Migration to create payment_methods table
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sat_key VARCHAR(50),
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Enable read access for authenticated users" 
ON public.payment_methods FOR SELECT 
TO authenticated 
USING (true);

-- Allow insert access to authenticated users (admin logic can be enforced in frontend or with a specific role check if existing)
CREATE POLICY "Enable insert access for authenticated users" 
ON public.payment_methods FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow update access to authenticated users
CREATE POLICY "Enable update access for authenticated users" 
ON public.payment_methods FOR UPDATE 
TO authenticated 
USING (true);

-- Allow delete access to authenticated users
CREATE POLICY "Enable delete access for authenticated users" 
ON public.payment_methods FOR DELETE 
TO authenticated 
USING (true);

-- Seed initial basic payment methods
INSERT INTO public.payment_methods (name, sat_key, is_system, is_active)
VALUES 
    ('Efectivo', '01', true, true),
    ('Tarjeta', '04', true, true),
    ('Transferencia', '03', true, true)
ON CONFLICT DO NOTHING;
