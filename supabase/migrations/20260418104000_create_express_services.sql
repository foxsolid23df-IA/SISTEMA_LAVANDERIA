-- Creación de la tabla para almacenar los nombres de los Servicios Express

CREATE TABLE IF NOT EXISTS public.express_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.express_services ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view their own express services" 
ON public.express_services FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own express services" 
ON public.express_services FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own express services" 
ON public.express_services FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own express services" 
ON public.express_services FOR DELETE 
USING (auth.uid() = user_id);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_express_services_user_id ON public.express_services(user_id);
