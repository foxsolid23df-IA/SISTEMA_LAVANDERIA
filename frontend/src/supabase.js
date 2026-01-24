import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug para Vercel (ver en consola del navegador)
console.log('[Supabase] URL configurada:', supabaseUrl ? 'OK' : 'FALTA');
console.log('[Supabase] Key configurada:', supabaseKey ? 'OK' : 'FALTA');

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Faltan variables de entorno de Supabase.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '')
