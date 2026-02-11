import { useState, useEffect, useCallback, useRef } from 'react';
import { scaleService } from '../services/scaleService';

export const useScale = () => {
    const [weight, setWeight] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const [isReading, setIsReading] = useState(false);
    const [lastDataTime, setLastDataTime] = useState(null);

    const readingActive = useRef(false);
    const autoConnectAttempted = useRef(false); // Solo intentar auto-connect UNA VEZ

    const startReading = useCallback(async () => {
        if (readingActive.current) {
            console.warn("⚠️ Lectura ya activa, ignorando duplicado.");
            return;
        }

        readingActive.current = true;
        setIsReading(true);
        try {
            await scaleService.readWeight((newWeight) => {
                setWeight(newWeight);
                setLastDataTime(Date.now());
                setError(null); // Limpiar error si hay datos
            });
        } catch (err) {
            console.error("Scale reading stopped:", err);
            if (err.message && (
                err.message.includes('break') ||
                err.message.includes('closed') ||
                err.message.includes('disconnect') ||
                err.message.includes('locked')
            )) {
                setIsConnected(false);
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
            setError(null);
        } catch (err) {
            console.error(err);
        }
    }, []);

    // Auto-connect UNA SOLA VEZ al montar el componente
    useEffect(() => {
        // SOLO intentar una vez por sesión
        if (autoConnectAttempted.current) return;
        autoConnectAttempted.current = true;

        let mounted = true;
        const autoConnect = async () => {
            try {
                const autoConnected = await scaleService.checkPreviousConnection();
                if (mounted && autoConnected) {
                    setIsConnected(true);
                    startReading();
                }
            } catch (err) {
                console.warn("Auto-connect failed (normal si no hay báscula):", err);
                // NO mostrar error al usuario por auto-connect fallido
            }
        };

        autoConnect();

        return () => {
            mounted = false;
        };
    }, [startReading]);

    return {
        weight,
        isConnected,
        error,
        isReading,
        lastDataTime,
        connect,
        connectSimulation,
        disconnect
    };
};
