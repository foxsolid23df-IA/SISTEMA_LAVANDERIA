import { createClient } from '@supabase/supabase-js';

// Usaremos las mismas variables de entorno que el POS principal
// Recuerda crear un archivo .env en la raíz de portal-facturacion
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan variables de entorno para Supabase");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
