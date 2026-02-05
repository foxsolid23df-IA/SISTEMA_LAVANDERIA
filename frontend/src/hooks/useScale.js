import { useState, useEffect, useCallback } from 'react';
import { scaleService } from '../services/scaleService';

export const useScale = () => {
    const [weight, setWeight] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const [isReading, setIsReading] = useState(false);

    const connect = useCallback(async () => {
        try {
            setError(null);
            await scaleService.connect();
            setIsConnected(true);

            // Start reading automatically upon connection
            startReading();
        } catch (err) {
            setError(err.message || 'Error connecting to scale');
            setIsConnected(false);
        }
    }, []);

    const connectSimulation = useCallback(async () => {
        try {
            setError(null);
            await scaleService.connectSimulation((newWeight) => {
                setWeight(newWeight);
            });
            setIsConnected(true);
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
        } catch (err) {
            console.error(err);
        }
    }, []);

    const startReading = useCallback(async () => {
        if (isReading) return;

        setIsReading(true);
        try {
            await scaleService.readWeight((newWeight) => {
                setWeight(newWeight);
            });
        } catch (err) {
            console.error("Reading stopped:", err);
            // If reading fails, we might still be 'connected' physically but the stream broke
            // Deciding not to set isConnected(false) immediately unless it's a critical error
        } finally {
            setIsReading(false);
        }
    }, [isReading]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // We usually don't want to disconnect strictly on unmount 
            // if we want the connection to persist across re-renders,
            // but for safety in a managed hook:
            // scaleService.disconnect(); 
        };
    }, []);

    return {
        weight,
        isConnected,
        error,
        connect,
        connectSimulation,
        disconnect
    };
};
