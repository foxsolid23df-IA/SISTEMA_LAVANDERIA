import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../../contexts/SettingsContext";
import Swal from "sweetalert2";

export default function TaxSettings() {
    const navigate = useNavigate();
    const { settings, updateSettings, loading } = useSettings();
    const [taxPercentage, setTaxPercentage] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings) {
            setTaxPercentage(settings.tax_percentage || 0);
        }
    }, [settings]);

    const handleSave = async () => {
        if (taxPercentage === "" || isNaN(taxPercentage) || taxPercentage < 0 || taxPercentage > 100) {
            Swal.fire("Error", "Por favor ingresa un porcentaje de impuesto válido (0-100).", "error");
            return;
        }

        setIsSaving(true);
        try {
            await updateSettings({ tax_percentage: parseFloat(taxPercentage) });
            Swal.fire({
                title: "Guardado",
                text: "Configuración de impuestos guardada exitosamente.",
                icon: "success",
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error(error);
            Swal.fire("Error", "Hubo un problema al guardar la configuración.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading && !settings) {
        return (
            <div className="flex-1 p-6 md:p-8 ml-0 lg:ml-64 bg-slate-50 dark:bg-slate-900 min-h-screen">
                <p className="dark:text-white">Cargando configuración...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 md:p-8 ml-0 lg:ml-64 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-200">
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <button 
                        onClick={() => navigate('/configuracion')}
                        style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', marginBottom: '1.5rem', padding: 0 }}>
                        <span className="material-icons-outlined">arrow_back</span>
                        Volver a Configuración
                    </button>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <span className="material-icons-outlined text-primary">request_quote</span>
                        Configuración de Impuestos
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Establece el porcentaje de impuestos aplicable a las facturas.
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold mb-4 dark:text-white">Detalles del Impuesto</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Porcentaje de Impuesto (%)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={taxPercentage}
                                onChange={(e) => setTaxPercentage(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-lg font-medium dark:text-white"
                                placeholder="Ej: 16.00"
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-icons-outlined text-[20px]">
                                {isSaving ? 'hourglass_empty' : 'save'}
                            </span>
                            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
