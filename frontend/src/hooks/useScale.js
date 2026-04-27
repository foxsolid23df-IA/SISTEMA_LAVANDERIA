import { useState, useEffect, useCallback, useRef } from 'react';
import { scaleService } from '../services/scaleService';

/**
 * Hook para conectarse a la báscula serial.
 * 
 * ARQUITECTURA: Este hook es un "suscriptor ligero" del scaleService singleton.
 * - Al montarse: se suscribe para recibir lecturas de peso.
 * - Al desmontarse: se desuscribe SIN detener la lectura ni cerrar el puerto.
 * - La lectura serial y la reconexión viven en el servicio, NO en el hook.
 * 
 * Esto permite que el KgQuantityModal se abra y cierre múltiples veces
 * sin perder la conexión con la báscula.
 */
export const useScale = () => {
    const [weight, setWeight] = useState(0);
    const [isConnected, setIsConnected] = useState(scaleService.isConnected);
    const [error, setError] = useState(null);
    const [isReading, setIsReading] = useState(scaleService._isReading);
    const [lastDataTime, setLastDataTime] = useState(null);
    const callbackRef = useRef(null);
    const autoConnectAttempted = useRef(false);

    // Crear callback estable que siempre apunta al estado actual
    useEffect(() => {
        const weightCallback = (newWeight) => {
            setWeight(newWeight);
            setLastDataTime(Date.now());
            setError(null);
        };
        callbackRef.current = weightCallback;

        // Suscribirse al servicio
        scaleService.subscribe(weightCallback);

        // Sincronizar estado inicial
        setIsConnected(scaleService.isConnected);
        setIsReading(scaleService._isReading);
        if (scaleService._lastWeight > 0) {
            setWeight(scaleService._lastWeight);
        }

        return () => {
            // Al desmontar: desuscribir pero NO desconectar
            scaleService.unsubscribe(weightCallback);
            callbackRef.current = null;
        };
    }, []);

    // Sincronizar isConnected e isReading con el servicio (polling ligero)
    useEffect(() => {
        const syncInterval = setInterval(() => {
            setIsConnected(scaleService.isConnected);
            setIsReading(scaleService._isReading);
        }, 500);

        return () => clearInterval(syncInterval);
    }, []);

    // Auto-connect UNA SOLA VEZ al montar
    useEffect(() => {
        if (autoConnectAttempted.current) return;
        autoConnectAttempted.current = true;

        const autoConnect = async () => {
            try {
                const connected = await scaleService.checkPreviousConnection();
                if (connected) {
                    setIsConnected(true);
                    setIsReading(true);
                }
            } catch (err) {
                console.warn("Auto-connect failed (normal si no hay báscula):", err);
            }
        };

        autoConnect();
    }, []);

    const connect = useCallback(async () => {
        try {
            setError(null);
            const connected = await scaleService.connect();
            if (connected) {
                setIsConnected(true);
                setIsReading(true);
                setLastDataTime(Date.now());
            }
        } catch (err) {
            console.error("Manual connection error:", err);
            setError(err.message || 'Error al conectar con la báscula');
            setIsConnected(false);
        }
    }, []);

    const connectSimulation = useCallback(async () => {
        try {
            setError(null);
            await scaleService.connectSimulation();
            setIsConnected(true);
            setIsReading(true);
            setLastDataTime(Date.now());
        } catch (err) {
            setError(err.message);
        }
    }, []);

    const disconnect = useCallback(async () => {
        try {
            await scaleService.disconnect();
            setIsConnected(false);
            setIsReading(false);
            setLastDataTime(null);
            setWeight(0);
            setError(null);
        } catch (err) {
            console.error(err);
        }
    }, []);

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
