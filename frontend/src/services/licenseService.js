import { supabase } from '../supabase';
import { config } from '../config';

const LICENSE_SYNC_URL = config.api.baseUrl + '/api/admin/sync/license';
const LOCAL_HEALTH_URL = config.api.baseUrl + '/api/admin/health';

export const licenseService = {
    /**
     * Sincroniza la fecha de expiración desde Supabase al backend local (Electron)
     */
    syncLicenseWithLocal: async () => {
        // --- AJUSTE PARA VERCEL / WEB ---
        if (!config.isElectron) {
            return null;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            // 1. Obtener perfil de Supabase
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('license_expires_at')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            if (!profile?.license_expires_at) return null;

            // 2. Enviar al backend local para persistencia offline
            const response = await fetch(LICENSE_SYNC_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-master-pin': '2026SOP'
                },
                body: JSON.stringify({ expiresAt: profile.license_expires_at })
            });

            if (!response.ok) throw new Error('No se pudo guardar la licencia localmente');
            return profile.license_expires_at;
        } catch (error) {
            console.error('[LicenseService] Error sincronizando licencia:', error);
            return null;
        }
    },

    /**
     * Verifica si la licencia es válida consultando el backend local (Funciona offline)
     * @returns {Object} { isValid: boolean, expiresAt: Date, isOffline: boolean }
     */
    checkLicense: async () => {
        // --- AJUSTE PARA VERCEL / WEB ---
        if (!config.isElectron) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return { isValid: false, isOffline: false, message: "No autenticado." };

                // 1. Verificar si es super admin en la nueva tabla (bypass total)
                const { data: superAdmin } = await supabase
                    .from('super_admins')
                    .select('id')
                    .eq('email', user.email)
                    .maybeSingle();

                if (superAdmin) {
                    return { isValid: true, isOffline: false, message: "Modo SuperAdmin Activo" };
                }

                // Si no es super admin, buscamos su perfil regular
                const { data: profile } = await supabase.from('profiles').select('role, license_expires_at').eq('id', user.id).maybeSingle();

                // 2. Buscar en invitation_codes (Prioridad según la guía corporativa)
                const { data: invCode, error: invError } = await supabase
                    .from('invitation_codes')
                    .select('expires_at')
                    .eq('used_by', user.id)
                    .single();

                const now = new Date();
                let expiresAt = null;

                if (!invError && invCode && invCode.expires_at) {
                    expiresAt = new Date(invCode.expires_at);
                } else if (profile?.license_expires_at) {
                    // Fallback a profile si no se usó código de invitación
                    expiresAt = new Date(profile.license_expires_at);
                }

                if (!expiresAt) {
                    return { isValid: false, expiresAt: null, message: "No se encontró registro de licencia." };
                }

                const isValid = expiresAt > now;
                return {
                    isValid,
                    expiresAt,
                    isOffline: false,
                    message: isValid ? "Licencia válida" : "La licencia ha expirado."
                };
            } catch (err) {
                console.error('[LicenseService] Error verificando licencia web:', err);
                return { isValid: false, isOffline: false, message: "Error al validar la licencia." };
            }
        }

        try {
            // Intentamos obtener salud y licencia desde backend local
            let response;
            try {
                response = await fetch(LOCAL_HEALTH_URL + `?masterPin=2026SOP`);
            } catch (e) {
                // Si falla el primero, intentamos con la IP directa
                console.warn('[LicenseService] Falló conexión primaria, reintentando con IP directa...');
                response = await fetch(`http://127.0.0.1:3001/api/admin/health?masterPin=2026SOP`);
            }

            if (!response.ok) throw new Error('Offline');

            const health = await response.json();
            let expiresAt = health.license_expires_at ? new Date(health.license_expires_at) : null;
            const now = new Date();

            // Si no hay fecha local o ya expiró, y hay internet, re-sincronizamos
            if ((!expiresAt || expiresAt <= now) && navigator.onLine) {
                const newExpiry = await licenseService.syncLicenseWithLocal();
                if (newExpiry) {
                    expiresAt = new Date(newExpiry);
                }
            }

            if (!expiresAt) {
                return { isValid: false, expiresAt: null, message: "No se encontró registro de licencia local." };
            }

            // Comparar fecha local (Funciona aunque no haya internet)
            const isValid = expiresAt > now;

            return {
                isValid,
                expiresAt,
                isOffline: !navigator.onLine,
                message: isValid ? "Licencia válida" : "La licencia ha expirado."
            };
        } catch (error) {
            console.warn('[LicenseService] Error verificando licencia (Backend Offline?):', error);

            // --- AJUSTE PARA VERCEL / WEB ---
            // Si no estamos en Electron (es decir, en Vercel o navegador normal), 
            // permitimos el acceso si Supabase ya validó la sesión.
            const isElectron = navigator.userAgent.toLowerCase().includes('electron');
            if (!isElectron) {
                return { isValid: true, isOffline: false, message: "Modo Supervisión Web Activo" };
            }

            // Si es la App de escritorio, sí bloqueamos por seguridad.
            return { isValid: false, expiresAt: null, message: "Error de comunicación con el sistema de licencias local." };
        }
    }
};
