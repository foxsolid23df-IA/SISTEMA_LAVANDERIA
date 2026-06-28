import { platform } from "../utils/platform";

// ConfiguraciÃ³n centralizada de la aplicaciÃ³n

export const config = {
    isElectron: platform.isElectron,
    isCapacitor: platform.isCapacitor,
    isAndroid: platform.isAndroid,
    isNativePos: platform.isNativePos,
    api: {
        baseUrl: import.meta.env.VITE_API_URL || (() => {
            const userAgent = navigator.userAgent.toLowerCase();
            const isElectron = userAgent.includes('electron') || platform.isElectron;
            const isCapacitor = platform.isCapacitor;
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            if (isElectron) return 'http://127.0.0.1:3001';

            // Si estamos en Capacitor (Android/iOS), usamos la IP especial para el host
            if (isCapacitor && isLocal) return 'http://10.0.2.2:3001';

            // Si es web normal en localhost
            if (isLocal) return 'http://127.0.0.1:3001';

            return '';
        })()
    },
    app: {
        name: import.meta.env.VITE_APP_NAME || 'Sistema ventas',
        version: import.meta.env.VITE_APP_VERSION || '1.0.0'
    },
    dev: {
        mode: import.meta.env.VITE_DEV_MODE === 'true' || false
    }
}

// Helper para logs en desarrollo
export const devLog = (...args) => {
    if (config.dev.mode) {
        console.log('[DEV]', ...args)
    }
}

