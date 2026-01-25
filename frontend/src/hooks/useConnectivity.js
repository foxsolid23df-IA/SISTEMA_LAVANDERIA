import { useState, useEffect } from 'react';

/**
 * Hook para detectar el estado de conexión a internet
 * @returns {boolean} isOnline
 */
export const useConnectivity = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            console.log('[Connectivity] Internet restaurado');
            setIsOnline(true);
        };
        const handleOffline = () => {
            console.warn('[Connectivity] Sin conexión a internet');
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};
