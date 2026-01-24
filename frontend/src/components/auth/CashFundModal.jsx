import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../../hooks/useAuth';
import './CashFundModal.css';

export const CashFundModal = ({ staffName, staffId, onSessionCreated }) => {
    const { openCashSession, isAdmin } = useAuth();
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            // Limitar a 2 decimales
            const parts = amount.split('.');
            if (parts[1] && parts[1].length >= 2) return;
            setAmount(prev => prev + digit);
        }
    };

    const handleQuickAmount = (value) => {
        setAmount(value.toString());
    };

    const handleSubmit = async () => {
        const openingFund = parseFloat(amount) || 0;

        // Validar monto mínimo (puede ser 0)
        if (openingFund < 0) {
            Swal.fire({
                title: 'Monto inválido',
                text: 'El fondo de caja no puede ser negativo.',
                icon: 'warning'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const session = await openCashSession(openingFund);

            Swal.fire({
                title: '¡Caja Abierta!',
                html: `<p>Fondo inicial: <strong>${formatMoney(openingFund)}</strong></p>`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

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
            <div className="cash-fund-modal">
                <div className="cash-fund-header">
                    <div className="cash-fund-icon">💰</div>
                    <h1>Fondo de Caja Inicial</h1>
                    <p>Ingresa el monto con el que inicias tu turno</p>
                    <span className="cash-fund-staff">Operador: {staffName}</span>
                </div>

                <div className="cash-fund-display">
                    <span className="currency-symbol">$</span>
                    <span className="amount-value">{amount || '0'}</span>
                    <span className="currency-code">MXN</span>
                </div>

                {/* Montos rápidos */}
                <div className="quick-amounts">
                    <button onClick={() => handleQuickAmount(0)} className="quick-btn">$0</button>
                    <button onClick={() => handleQuickAmount(100)} className="quick-btn">$100</button>
                    <button onClick={() => handleQuickAmount(500)} className="quick-btn">$500</button>
                    <button onClick={() => handleQuickAmount(1000)} className="quick-btn">$1,000</button>
                    <button onClick={() => handleQuickAmount(2000)} className="quick-btn">$2,000</button>
                </div>

                {/* Teclado numérico */}
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
                            Abriendo Caja...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined">point_of_sale</span>
                            Iniciar Caja
                        </>
                    )}
                </button>

                {/* Opción para administradores: Ver sistema sin abrir caja */}
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
