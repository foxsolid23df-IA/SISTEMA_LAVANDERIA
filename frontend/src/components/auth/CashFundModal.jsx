import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../../hooks/useAuth';
import { exchangeRateService } from '../../services/exchangeRateService';
import { noticeService, NOTICE_EVENTS } from '../../services/noticeService';
import './CashFundModal.css';

export const CashFundModal = ({ staffName, staffId, onSessionCreated, onClose }) => {
    const { openCashSession, isAdmin } = useAuth();
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeCurrencies, setActiveCurrencies] = useState([]);
    const [rates, setRates] = useState({});

    useEffect(() => {
        const fetchCurrentRates = async () => {
            try {
                const data = await exchangeRateService.getActiveRates();
                if (data && data.length > 0) {
                    setActiveCurrencies(data);
                    const initialRates = {};
                    data.forEach(item => {
                        const val = parseFloat(item.rate);
                        initialRates[item.currency_code] = val > 0 ? val.toString() : '1.0';
                    });
                    setRates(initialRates);
                }
            } catch (error) {
                console.error('Error fetching rates:', error);
            }
        };
        fetchCurrentRates();
    }, []);

    const formatMoney = (value) => {
        const num = parseFloat(value) || 0;
        return num.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN'
        });
    };

    const handleKeypadInput = (digit) => {
        if (digit === 'backspace') {
            setAmount(prev => prev.slice(0, -1));
        } else if (digit === '.') {
            if (!amount.includes('.')) {
                setAmount(prev => prev + '.');
            }
        } else if (digit === 'clear') {
            setAmount('');
        } else {
            const parts = amount.split('.');
            if (parts[1] && parts[1].length >= 2) return;
            setAmount(prev => prev + digit);
        }
    };

    const handleQuickAmount = (value) => {
        setAmount(value.toString());
    };

    const handleRateChange = (code, value) => {
        setRates(prev => ({
            ...prev,
            [code]: value
        }));
    };

    const handleSubmit = async () => {
        const openingFund = parseFloat(amount) || 0;

        if (openingFund < 0) {
            Swal.fire({
                title: 'Monto inválido',
                text: 'El fondo de caja no puede ser negativo.',
                icon: 'warning'
            });
            return;
        }

        // Validate all active rates
        for (const currency of activeCurrencies) {
            const rString = rates[currency.currency_code];
            const rate = parseFloat(rString) || 0;
            
            if (rate <= 0) {
                const result = await Swal.fire({
                    title: 'Tipo de Cambio en 0',
                    text: `El tipo de cambio para ${currency.currency_code} es 0. ¿Deseas continuar así?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, continuar',
                    cancelButtonText: 'Corregir',
                    confirmButtonColor: '#f59e0b'
                });

                if (!result.isConfirmed) return;
                
                // Set to 1.0 internally if they allowed 0, to avoid division by zero errors in POS
                handleRateChange(currency.currency_code, "1.00");
            }
        }

        const ratesHtml = activeCurrencies.map(c => `
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">T.C. ${c.currency_code}:</span>
                <strong style="color: #6366f1;">$${parseFloat(rates[c.currency_code] || 0).toFixed(2)} MXN</strong>
            </div>
        `).join('');

        const result = await Swal.fire({
            title: 'Confirmar Apertura',
            html: `
                <div class="swal-opening-confirm">
                    <p>Estás por iniciar el turno con los siguientes valores:</p>
                    <div style="margin: 20px 0; text-align: left; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span style="color: #64748b;">Fondo Inicial:</span>
                            <strong style="color: #1e293b;">${formatMoney(openingFund)}</strong>
                        </div>
                        ${ratesHtml}
                    </div>
                    <p style="font-size: 0.9rem; color: #ef4444;">¿Los datos son correctos?</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, abrir caja',
            cancelButtonText: 'Cancelar y revisar',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b'
        });

        if (!result.isConfirmed) return;

        setIsSubmitting(true);

        try {
            for (const currency of activeCurrencies) {
                const currentRate = parseFloat(rates[currency.currency_code]) || 0;
                await exchangeRateService.updateCurrencyRate(currency.currency_code, currentRate, true);
            }

            const session = await openCashSession(openingFund);

            Swal.fire({
                title: '¡Caja Abierta!',
                html: `<p>Fondo inicial: <strong>${formatMoney(openingFund)}</strong></p>`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

            await noticeService.showNoticesForEvent(NOTICE_EVENTS.OPEN_CASH);
            onSessionCreated(session);
        } catch (error) {
            console.error('Error abriendo caja:', error);
            Swal.fire({
                title: 'Error',
                text: 'No se pudo abrir la caja. Intenta nuevamente.',
                icon: 'error'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="cash-fund-overlay">
            <div className="cash-fund-modal" style={{ maxWidth: '380px', maxHeight: '95vh', overflowY: 'auto', position: 'relative' }}>
                <div className="cash-fund-header">
                    {onClose && (
                        <button className="cash-fund-close" onClick={onClose}>
                             <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                    <div className="header-title-row">
                        <span className="cash-fund-icon">💰</span>
                        <h1>Apertura de Turno</h1>
                    </div>
                    <p>Configura el efectivo y tipo de cambio</p>
                    <span className="cash-fund-staff">Operador: {staffName}</span>
                </div>

                <div className="exchange-rates-container">
                    {activeCurrencies.map(currency => (
                        <div key={currency.currency_code} className="exchange-rate-input-container">
                            <label>T.C. {currency.currency_code} hoy:</label>
                            <div className="rate-input-wrapper">
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>currency_exchange</span>
                                <input 
                                    type="number" 
                                    value={rates[currency.currency_code] || ''}
                                    onChange={(e) => handleRateChange(currency.currency_code, e.target.value)}
                                    placeholder="0.00"
                                    step="0.01"
                                />
                                <span className="rate-suffix">MXN</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="cash-fund-display">
                    <span className="currency-symbol">$</span>
                    <span className="amount-value">{amount || '0'}</span>
                    <span className="currency-code">MXN</span>
                </div>

                <div className="quick-amounts">
                    <button onClick={() => handleQuickAmount(0)} className="quick-btn">$0</button>
                    <button onClick={() => handleQuickAmount(100)} className="quick-btn">$100</button>
                    <button onClick={() => handleQuickAmount(500)} className="quick-btn">$500</button>
                    <button onClick={() => handleQuickAmount(1000)} className="quick-btn">$1k</button>
                    <button onClick={() => handleQuickAmount(2000)} className="quick-btn">$2k</button>
                </div>

                <div className="cash-fund-keypad">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
                        <button
                            key={digit}
                            className="keypad-btn"
                            onClick={() => handleKeypadInput(digit.toString())}
                            disabled={isSubmitting}
                        >
                            {digit}
                        </button>
                    ))}
                    <button 
                        className="keypad-btn clear-btn" 
                        onClick={() => handleKeypadInput('clear')}
                        disabled={isSubmitting}
                    >
                        C
                    </button>
                    <button 
                        className="keypad-btn" 
                        onClick={() => handleKeypadInput('0')}
                        disabled={isSubmitting}
                    >
                        0
                    </button>
                    <button 
                        className="keypad-btn" 
                        onClick={() => handleKeypadInput('.')}
                        disabled={isSubmitting}
                    >
                        .
                    </button>
                </div>

                <button
                    className="cash-fund-submit"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <span className="spinner"></span>
                            Procesando...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined">point_of_sale</span>
                            Iniciar Caja
                        </>
                    )}
                </button>

                {isAdmin && (
                    <button 
                        className="cash-fund-skip-btn"
                        onClick={() => window.location.hash = '#/inventario'}
                        style={{
                            marginTop: '10px',
                            background: 'transparent',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '0.9rem',
                            width: '100%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                        Solo ver Inventario / Estadísticas
                    </button>
                )}

                <p className="cash-fund-note">
                    💡 El fondo inicial será considerado en el corte de caja
                </p>
            </div>
        </div>
    );
};
