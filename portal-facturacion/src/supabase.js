import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan variables de entorno para Supabase");
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: fetchWithTimeout,
    },
})
