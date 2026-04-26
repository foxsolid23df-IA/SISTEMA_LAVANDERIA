import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeRateService } from '../../services/exchangeRateService';
import './ExchangeRateSettings.css';

const SUPPORTED_CURRENCIES = [
    { code: 'USD', name: 'Dólares (USD)' },
    { code: 'EUR', name: 'Euros (EUR)' },
    { code: 'CAD', name: 'Dólares Canadienses (CAD)' }
];

const ExchangeRateSettings = () => {
    const navigate = useNavigate();
    const [currencies, setCurrencies] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchAllRates();
    }, []);

    const fetchAllRates = async () => {
        try {
            setLoading(true);
            const data = await exchangeRateService.getAllCurrencies();
            
            const currencyMap = {};
            data.forEach(item => {
                currencyMap[item.currency_code] = {
                    rate: item.rate || '',
                    isActive: item.is_active || false
                };
            });
            
            // Initialize defaults if missing
            SUPPORTED_CURRENCIES.forEach(c => {
                if (!currencyMap[c.code]) {
                    currencyMap[c.code] = { rate: '', isActive: false };
                }
            });

            setCurrencies(currencyMap);
        } catch (error) {
            console.error('Error cargando tipos de cambio:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            for (const c of SUPPORTED_CURRENCIES) {
                const data = currencies[c.code];
                await exchangeRateService.updateCurrencyRate(
                    c.code, 
                    parseFloat(data.rate) || 0, 
                    data.isActive
                );
            }
            setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
        } catch (error) {
            console.error('Error guardando:', error);
            setMessage({ type: 'error', text: 'Error al guardar la configuración' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = (currencyCode) => {
        setCurrencies(prev => ({
            ...prev,
            [currencyCode]: {
                ...prev[currencyCode],
                isActive: !prev[currencyCode].isActive
            }
        }));
    };

    const handleRateChange = (currencyCode, value) => {
        setCurrencies(prev => ({
            ...prev,
            [currencyCode]: {
                ...prev[currencyCode],
                rate: value
            }
        }));
    };

    if (loading) return <div className="p-4 text-slate-400">Cargando configuración...</div>;

    return (
        <div className="exchange-rate-settings-container">
            <div style={{ marginBottom: '1rem' }}>
                <button 
                    onClick={() => navigate('/configuracion')}
                    style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                    <span className="material-icons-outlined">arrow_back</span>
                    Volver a Configuración
                </button>
            </div>
            <h2 className="settings-title">Monedas Internacionales</h2>
            <p className="settings-subtitle">Administración de monedas extranjeras aceptadas.</p>

            {message && (
                <div className={`message-alert ${message.type}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className="settings-form">
                <div className="currencies-grid">
                    {SUPPORTED_CURRENCIES.map((currency) => {
                        const data = currencies[currency.code] || { rate: '', isActive: false };
                        
                        return (
                            <div key={currency.code} className={`currency-card ${!data.isActive ? 'card-disabled' : ''}`}>
                                <div className="card-top">
                                    <div className="form-group-switch">
                                        <label className="switch-label">
                                            <span className="label-text">{currency.name}</span>
                                            <div className="switch-wrapper">
                                                <input 
                                                    type="checkbox" 
                                                    checked={data.isActive} 
                                                    onChange={() => handleToggle(currency.code)}
                                                    className="switch-input" 
                                                />
                                                <span className="switch-slider"></span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div className="card-body">
                                    <div className={`form-group-input ${!data.isActive ? 'disabled' : ''}`}>
                                        <label>Tipo de Cambio Actual</label>
                                        <div className="input-with-icon">
                                            <span className="currency-symbol">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="0.00"
                                                value={data.rate}
                                                onChange={(e) => handleRateChange(currency.code, e.target.value)}
                                                disabled={!data.isActive}
                                                required={data.isActive}
                                            />
                                            <span className="currency-code">MXN</span>
                                        </div>
                                        <p className="input-hint">Por 1 {currency.code}</p>
                                    </div>

                                    <div className="preview-box">
                                        <span className="preview-label">10.00 {currency.code} = </span>
                                        <span className="preview-value">
                                            {data.rate ? `$${(10 * parseFloat(data.rate)).toFixed(2)}` : '$0.00'} MXN
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="settings-actions">
                    <button 
                        type="submit" 
                        className="btn-save-settings" 
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <span className="material-icons-outlined animate-spin" style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>refresh</span>
                                Guardando...
                            </>
                        ) : 'Guardar Configuración'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ExchangeRateSettings;
