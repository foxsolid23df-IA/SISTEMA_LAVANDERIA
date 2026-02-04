import { config } from "../config";

const API_URL = `${config.api.baseUrl}/api/supplies`;

export const supplyService = {
    // Obtener todos los insumos
    getAll: async () => {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Error al obtener insumos");
        return response.json();
    },

    // Crear nuevo insumo
    create: async (data) => {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Error al crear insumo");
        return response.json();
    },

    // Registrar entrada (Administradora)
    addWeekly: async (data) => {
        const response = await fetch(`${API_URL}/add-weekly`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Error al registrar entrada");
        return response.json();
    },

    // Registrar uso (Cajera)
    recordUsage: async (data) => {
        const response = await fetch(`${API_URL}/record-usage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Error al registrar uso");
        return response.json();
    },

    // Reconciliación / Corte
    // Reconciliación / Corte
    closeWeek: async (data) => {
        const response = await fetch(`${API_URL}/reconciliation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Error al realizar reconciliación");
        return response.json();
    },
};

