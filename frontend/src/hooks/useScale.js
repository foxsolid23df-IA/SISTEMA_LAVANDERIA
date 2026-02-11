import { useState, useEffect, useCallback, useRef } from 'react';
import { scaleService } from '../services/scaleService';

export const useScale = () => {
    const [weight, setWeight] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const [isReading, setIsReading] = useState(false);
    const [lastDataTime, setLastDataTime] = useState(null);

    // Usamos ref para evitar dependencias circulares en useCallback
    const readingActive = useRef(false);

    const startReading = useCallback(async () => {
        if (readingActive.current) return;

        readingActive.current = true;
        setIsReading(true);
        try {
            await scaleService.readWeight((newWeight) => {
                setWeight(newWeight);
                setLastDataTime(Date.now());
            });
        } catch (err) {
            console.error("Scale reading stopped:", err);
            // Si el error es fatal (puerto cerrado), la conexión se pierde
            if (err.message && (err.message.includes('break') || err.message.includes('closed') || err.message.includes('disconnect'))) {
                setIsConnected(false);
                readingActive.current = false;
            }
        } finally {
            setIsReading(false);
            readingActive.current = false;
        }
    }, []);

    const connect = useCallback(async () => {
        try {
            setError(null);
            const connected = await scaleService.connect();
            if (connected) {
                setIsConnected(true);
                setLastDataTime(Date.now());
                // Start reading automatically upon connection
                startReading();
            }
        } catch (err) {
            console.error("Manual connection error:", err);
            setError(err.message || 'Error al conectar con la báscula');
            setIsConnected(false);
        }
    }, [startReading]);

    const connectSimulation = useCallback(async () => {
        try {
            setError(null);
            await scaleService.connectSimulation((newWeight) => {
                setWeight(newWeight);
                setLastDataTime(Date.now());
            });
            setIsConnected(true);
            setLastDataTime(Date.now());
            setIsReading(true);
        } catch (err) {
            setError(err.message);
        }
    }, []);

    const disconnect = useCallback(async () => {
        try {
            await scaleService.disconnect();
            setIsConnected(false);
            setIsReading(false);
            readingActive.current = false;
            setLastDataTime(null);
            setWeight(0);
        } catch (err) {
            console.error(err);
        }
    }, []);

    // Attempt auto-connect on mount
    useEffect(() => {
        let mounted = true;
        const autoConnect = async () => {
            try {
                const autoConnected = await scaleService.checkPreviousConnection();
                if (mounted && autoConnected) {
                    setIsConnected(true);
                    startReading();
                }
            } catch (err) {
                console.warn("Auto-connect failed:", err);
            }
        };

        if (!isConnected) {
            autoConnect();
        }

        return () => {
            mounted = false;
        };
    }, [startReading, isConnected]);

    return {
        weight,
        isConnected,
        error,
        isReading,
        lastDataTime, // Expose timestamp to check for stale data
        connect,
        connectSimulation,
        disconnect
    };
};
