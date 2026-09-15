import { supabase } from '../supabase';
import { config } from '../config';

const LICENSE_SYNC_URL = config.api.baseUrl + '/api/admin/sync/license';
const LOCAL_HEALTH_URL = config.api.baseUrl + '/api/admin/health';

const SUPABASE_TIMEOUT = 10000;
const MAX_SYNC_RETRIES = 3;
const HEALTH_FETCH_TIMEOUT = 8000;

const withTimeout = (promise, ms) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

const fetchWithTimeout = (url, options = {}, timeoutMs = HEALTH_FETCH_TIMEOUT) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() =>
        clearTimeout(timeoutId)
    );
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const licenseService = {
    /**
     * Sincroniza la fecha de expiración desde Supabase al backend local (Electron)
     * Incluye reintentos con backoff para tolerar latencia de Supabase.
     */
    syncLicenseWithLocal: async () => {
        if (!config.isElectron) {
            return null;
        }

        for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
            try {
                const { data: { user } } = await withTimeout(
                    supabase.auth.getUser(),
                    SUPABASE_TIMEOUT
                );
                if (!user) return null;

                const { data: profile, error } = await withTimeout(
                    supabase
                        .from('profiles')
                        .select('license_expires_at')
                        .eq('id', user.id)
                        .maybeSingle(),
                    SUPABASE_TIMEOUT
                );

                if (error) throw error;
                if (!profile?.license_expires_at) return null;

                const response = await fetchWithTimeout(LICENSE_SYNC_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-master-pin': '2026SOP',
                    },
                    body: JSON.stringify({ expiresAt: profile.license_expires_at }),
                });

                if (!response.ok) throw new Error('No se pudo guardar la licencia localmente');
                return profile.license_expires_at;
            } catch (error) {
                console.error(
                    `[LicenseService] Error sincronizando licencia (intento ${attempt}/${MAX_SYNC_RETRIES}):`,
                    error.message
                );
                if (attempt < MAX_SYNC_RETRIES) {
                    await delay(Math.min(1000 * Math.pow(2, attempt - 1), 8000));
                }
            }
        }

        console.error('[LicenseService] Agotados todos los reintentos de sincronización.');
        return null;
    },

    /**
     * Verifica si la licencia es válida consultando el backend local (Funciona offline)
     * @returns {Object} { isValid: boolean, expiresAt: Date, isOffline: boolean }
     */
    checkLicense: async () => {
        if (!config.isElectron) {
            try {
                const { data: { user } } = await withTimeout(
                    supabase.auth.getUser(),
                    SUPABASE_TIMEOUT
                );
                if (!user) return { isValid: false, isOffline: false, message: 'No autenticado.' };

                const { data: superAdmin } = await withTimeout(
                    supabase
                        .from('super_admins')
                        .select('id')
                        .eq('email', user.email)
                        .maybeSingle(),
                    SUPABASE_TIMEOUT
                );

                if (superAdmin) {
                    return { isValid: true, isOffline: false, message: 'Modo SuperAdmin Activo' };
                }

                const { data: profile } = await withTimeout(
                    supabase.from('profiles').select('role, license_expires_at').eq('id', user.id).maybeSingle(),
                    SUPABASE_TIMEOUT
                );

                const { data: invCode, error: invError } = await withTimeout(
                    supabase
                        .from('invitation_codes')
                        .select('expires_at')
                        .eq('used_by', user.id)
                        .single(),
                    SUPABASE_TIMEOUT
                );

                const now = new Date();
                let expiresAt = null;

                if (!invError && invCode && invCode.expires_at) {
                    expiresAt = new Date(invCode.expires_at);
                } else if (profile?.license_expires_at) {
                    expiresAt = new Date(profile.license_expires_at);
                }

                if (!expiresAt) {
                    return { isValid: false, expiresAt: null, message: 'No se encontró registro de licencia.' };
                }

                const isValid = expiresAt > now;
                return {
                    isValid,
                    expiresAt,
                    isOffline: false,
                    message: isValid ? 'Licencia válida' : 'La licencia ha expirado.',
                };
            } catch (err) {
                console.error('[LicenseService] Error verificando licencia web:', err);
                return { isValid: false, isOffline: false, message: 'Error al validar la licencia.' };
            }
        }

        try {
            let response;
            try {
                response = await fetchWithTimeout(LOCAL_HEALTH_URL + '?masterPin=2026SOP', {}, HEALTH_FETCH_TIMEOUT);
            } catch (e) {
                console.warn('[LicenseService] Falló conexión primaria, reintentando con IP directa...');
                response = await fetchWithTimeout(
                    'http://127.0.0.1:3001/api/admin/health?masterPin=2026SOP',
                    {},
                    HEALTH_FETCH_TIMEOUT
                );
            }

            if (!response.ok) throw new Error('Offline');

            const health = await response.json();
            let expiresAt = health.license_expires_at ? new Date(health.license_expires_at) : null;
            const now = new Date();

            if ((!expiresAt || expiresAt <= now) && navigator.onLine) {
                const newExpiry = await licenseService.syncLicenseWithLocal();
                if (newExpiry) {
                    expiresAt = new Date(newExpiry);
                }
            }

            if (!expiresAt) {
                return { isValid: false, expiresAt: null, message: 'No se encontró registro de licencia local.' };
            }

            const isValid = expiresAt > now;

            return {
                isValid,
                expiresAt,
                isOffline: !navigator.onLine,
                message: isValid ? 'Licencia válida' : 'La licencia ha expirado.',
            };
        } catch (error) {
            console.warn('[LicenseService] Error verificando licencia (Backend Offline?):', error);

            const isElectron = navigator.userAgent.toLowerCase().includes('electron');
            if (!isElectron) {
                return { isValid: true, isOffline: false, message: 'Modo Supervisión Web Activo' };
            }

            return { isValid: false, expiresAt: null, message: 'Error de comunicación con el sistema de licencias local.' };
        }
    },
};
