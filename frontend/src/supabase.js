import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('[Supabase] URL configurada:', supabaseUrl ? 'OK' : 'FALTA');
console.log('[Supabase] Key configurada:', supabaseKey ? 'OK' : 'FALTA');

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Faltan variables de entorno de Supabase.');
}

const FETCH_TIMEOUT = 15000;

const fetchWithTimeout = (url, options = {}) => {
    const controller = new AbortController();
    const signal = controller.signal;
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const existingSignal = options.signal;
    if (existingSignal) {
        if (existingSignal.aborted) {
            clearTimeout(timeoutId);
            return fetch(url, options);
        }
        existingSignal.addEventListener('abort', () => controller.abort());
    }

    return fetch(url, { ...options, signal }).finally(() => clearTimeout(timeoutId));
};

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
    global: {
        fetch: fetchWithTimeout,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        storageKey: 'supabase_auth',
    },
})
